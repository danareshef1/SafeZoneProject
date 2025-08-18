// src/app/contactsButton.tsx
import React, { useState } from 'react';
import {
  TouchableOpacity, Modal, FlatList, Text, View, StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import Checkbox from 'expo-checkbox';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthUserEmail } from '../../utils/auth';

interface ContactItem {
  id: string;
  name: string;
  phoneNumbers?: { number: string }[];
}

// ---------- logging helper ----------
const LOG_PREFIX = '[ContactsButton]';
const log = (...args: any[]) => console.log(LOG_PREFIX, ...args);
const warn = (...args: any[]) => console.warn(LOG_PREFIX, ...args);
const err = (...args: any[]) => console.error(LOG_PREFIX, ...args);

function normPhone(p: string) {
  const d = (p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0') && d.length >= 9) return '+972' + d.slice(1);
  if (d.startsWith('972')) return '+' + d;
  if ((p || '').trim().startsWith('+')) return (p || '').trim();
  return '+' + d;
}

const ContactsButton = () => {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      log('Requesting contacts permission...');
      const { status } = await Contacts.requestPermissionsAsync();
      log('Contacts permission status =', status);
      if (status !== 'granted') {
        Alert.alert('אין הרשאה', 'לא אושרה גישה לאנשי קשר');
        return;
      }

      log('Loading device contacts (with phone numbers)...');
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });
      log('Total contacts received from device =', data.length);

      // registeredContacts – מה שאצלך נשמר ב‑AsyncStorage (מספרים גולמיים/ברקמות)
      let registeredNumbers: string[] = [];
      try {
        const stored = await AsyncStorage.getItem('registeredContacts');
        registeredNumbers = stored ? JSON.parse(stored) : [];
        log('registeredContacts from AsyncStorage count =', registeredNumbers.length);
      } catch (e) {
        warn('Failed to parse registeredContacts from AsyncStorage:', e);
      }
      const asDigits = (x: string = '') => x.replace(/\D/g, '');
      const registeredSet = new Set(registeredNumbers.map(asDigits));

      // סינון אנשי קשר שיש להם לפחות מספר שנמצא ב‑registeredContacts
      const matchedContacts = data.filter((contact) =>
        contact.phoneNumbers?.some((phone) =>
          registeredSet.has(asDigits(phone.number || ''))
        )
      );

      log('Matched contacts count =', matchedContacts.length);

      setContacts(
        matchedContacts.map((contact) => ({
          id: contact.id || '',
          name: contact.name,
          phoneNumbers: contact.phoneNumbers?.map((phone) => ({
            number: phone.number || '',
          })),
        }))
      );

      try {
        const storedSelected = await AsyncStorage.getItem('selectedContacts');
        if (storedSelected) {
          const parsed = JSON.parse(storedSelected);
          setSelectedContacts(new Set(parsed));
          log('Loaded selectedContacts from AsyncStorage size =', Array.isArray(parsed) ? parsed.length : 0);
        } else {
          log('No selectedContacts in AsyncStorage');
        }
      } catch (e) {
        warn('Failed to parse selectedContacts:', e);
      }

      setModalVisible(true);
    } catch (e) {
      err('שגיאה בטעינת אנשי קשר:', e);
      Alert.alert('שגיאה', 'אירעה שגיאה בטעינת אנשי קשר');
    } finally {
      setLoadingContacts(false);
    }
  };

  // החזרת true/false להצלחת הקריאה, כולל הדפסות מלאות
  const doToggleAPICall = async (
    { id, phoneNumber, name, nextSelected }: { id: string; phoneNumber: string; name: string; nextSelected: boolean }
  ): Promise<boolean> => {
    setToggleLoading(true);
    try {
      const owner = await getAuthUserEmail();
      log('Resolved owner from token =', owner);
      if (!owner) {
        Alert.alert('שגיאה', 'לא נמצא משתמש מחובר (owner).');
        return false;
      }

      const normalizedPhone = normPhone(phoneNumber);
      if (!normalizedPhone) {
        warn('Phone normalization returned empty for raw number =', phoneNumber);
        Alert.alert('שגיאה', 'מספר טלפון לא תקין');
        return false;
      }

      const url = nextSelected
        ? 'https://jdd8xkf4o1.execute-api.us-east-1.amazonaws.com/prod/saveContact'
        : 'https://jdd8xkf4o1.execute-api.us-east-1.amazonaws.com/prod/removeContact';

      const body = nextSelected
        ? { owner, id, phone: normalizedPhone, name }
        : { owner, phone: normalizedPhone };

      log(nextSelected ? 'Calling SAVE contact' : 'Calling REMOVE contact', { url, body });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // אם הוספת Authorization ל‑API, הכניסי כאן:
          // ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* לא JSON – נשמור טקסט גולמי */ }

      log('API response:', { status: res.status, ok: res.ok, body: parsed ?? text });

      if (!res.ok) {
        Alert.alert('שגיאה', `הקריאה לשרת נכשלה (status ${res.status})`);
        return false;
      }

      // וידוא מינימלי שהשרת החזיר ok או sent וכו'
      const okish = parsed?.ok === true || typeof parsed?.sent === 'number';
      if (!okish) {
        warn('Server response did not include an {ok:true}/{sent} shape');
      }

      return true;
    } catch (e) {
      err('Error in doToggleAPICall:', e);
      Alert.alert('שגיאה', 'אירעה שגיאה בהתקשרות לשרת');
      return false;
    } finally {
      setToggleLoading(false);
    }
  };

  const toggleSelect = async (id: string, phoneNumber: string, name: string) => {
    // קבענו מראש את המצב הבא
    const wasSelected = selectedContacts.has(id);
    const nextSelected = !wasSelected;
    log('toggleSelect ->', { id, name, phoneNumber, wasSelected, nextSelected });

    // עדכון אופטימי + שמירה ל‑AsyncStorage
    setSelectedContacts((prev) => {
      const newSet = new Set(prev);
      if (nextSelected) newSet.add(id);
      else newSet.delete(id);
      AsyncStorage.setItem('selectedContacts', JSON.stringify([...newSet]))
        .then(() => log('Persisted selectedContacts with size =', newSet.size))
        .catch((e) => warn('Failed to persist selectedContacts', e));
      return newSet;
    });

    // קריאה ל‑API
    const ok = await doToggleAPICall({ id, phoneNumber, name, nextSelected });

    // אם נכשל – רולבאק למצבים הקודמים
    if (!ok) {
      log('API failed – rolling back UI selection');
      setSelectedContacts((prev) => {
        const newSet = new Set(prev);
        if (wasSelected) newSet.add(id);
        else newSet.delete(id);
        AsyncStorage.setItem('selectedContacts', JSON.stringify([...newSet]))
          .then(() => log('Rollback persisted selectedContacts with size =', newSet.size))
          .catch((e) => warn('Failed to persist selectedContacts (rollback)', e));
        return newSet;
      });
    }
  };

  return (
    <>
      <TouchableOpacity onPress={fetchContacts} style={styles.button}>
        {loadingContacts ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MaterialIcons name="phone" size={24} color="#fff" />
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.titleWrapper}>
            <Text style={styles.title}>Select Contacts</Text>
            <View style={styles.titleUnderline} />
          </View>

          {toggleLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#11998e" />
            </View>
          )}

          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isChecked = selectedContacts.has(item.id);
              const firstNumber = item.phoneNumbers?.[0]?.number ?? '';
              return (
                <View style={styles.contactItem}>
                  <Checkbox
                    value={isChecked}
                    onValueChange={() => toggleSelect(item.id, firstNumber, item.name)}
                    style={styles.checkbox}
                  />
                  <View>
                    <Text style={styles.contactName}>{item.name}</Text>
                    {firstNumber ? <Text style={styles.contactPhone}>{firstNumber}</Text> : null}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', color: 'gray', marginTop: 20 }}>
                לא נמצאו אנשי קשר תואמים ל‑registeredContacts
              </Text>
            }
          />

          <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

export default ContactsButton;

const styles = StyleSheet.create({
  button: { marginRight: 15 },
  modalContainer: {
    flex: 1,
    marginTop: 50,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  titleWrapper: { marginBottom: 30, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50', textAlign: 'center' },
  titleUnderline: { marginTop: 6, width: 120, height: 4, backgroundColor: '#11998e', borderRadius: 2 },
  listContent: { paddingBottom: 80 },
  contactItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  checkbox: { marginRight: 10 },
  contactName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  contactPhone: { fontSize: 14, color: 'gray' },
  closeButton: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    backgroundColor: '#11998e', padding: 12, borderRadius: 10, width: '50%', alignItems: 'center',
  },
  closeButtonText: { color: '#fff', fontWeight: 'bold' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
});
