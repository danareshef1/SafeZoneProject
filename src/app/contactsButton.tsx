// src/app/contactsButton.tsx
import React, { useState } from 'react';
import {
  TouchableOpacity,
  Modal,
  FlatList,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import Checkbox from 'expo-checkbox';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthUserPhone, normalizeToE164IL } from '../../utils/auth';

interface ContactItem {
  id: string;
  name: string;
  phoneNumbers?: { number: string }[];
}

const API_BASE =
  'https://jdd8xkf4o1.execute-api.us-east-1.amazonaws.com/prod'; // ה‑stage הקיים שלך

const ContactsButton = () => {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  // טוען אנשי קשר שמופיעים גם ברשימת registeredContacts (מי שהתקין את האפליקציה)
  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setLoadingContacts(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      const stored = await AsyncStorage.getItem('registeredContacts');
      const registeredNumbers: string[] = stored ? JSON.parse(stored) : [];
      const registeredSet = new Set(registeredNumbers.map((n) => n.replace(/\D/g, '')));

      const matchedContacts = data.filter((contact) =>
        contact.phoneNumbers?.some((p) => registeredSet.has(p.number?.replace(/\D/g, '')))
      );

      setContacts(
        matchedContacts.map((c) => ({
          id: c.id || '',
          name: c.name,
          phoneNumbers: c.phoneNumbers?.map((p) => ({ number: p.number || '' })),
        }))
      );

      const storedSelected = await AsyncStorage.getItem('selectedContacts');
      if (storedSelected) setSelectedContacts(new Set(JSON.parse(storedSelected)));

      setModalVisible(true);
    } catch (err) {
      console.error('שגיאה בטעינת אנשי קשר:', err);
      Alert.alert('שגיאה', 'לא הצלחנו לטעון אנשי קשר');
    } finally {
      setLoadingContacts(false);
    }
  };

  // קריאה ל‑API – נשען על מצב הבחירה לפני השינוי (wasSelected)
  const doToggleAPICall = async (
    wasSelected: boolean,
    phoneNumber: string,
    name: string
  ) => {
    try {
      setToggleLoading(true);

      const ownerPhone = await getAuthUserPhone(); // יבוא מה‑JWT או מה‑Cognito SDK
      if (!ownerPhone) {
        Alert.alert('שגיאה', 'לא זוהה מספר המשתמש המחובר');
        return;
      }

      const normalizedPhone = normalizeToE164IL(phoneNumber);
      if (!normalizedPhone) return;

      if (!wasSelected) {
        // עכשיו מסמנים → שמירה
        await fetch(`${API_BASE}/saveContact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerPhone, phone: normalizedPhone, name }),
        });
      } else {
        // עכשיו מבטלים סימון → מחיקה
        await fetch(`${API_BASE}/removeContact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerPhone, phone: normalizedPhone }),
        });
      }
    } catch (error) {
      console.error('Error in doToggleAPICall:', error);
      Alert.alert('שגיאה', 'בעיה בשמירה/מחיקה של איש הקשר');
    } finally {
      setToggleLoading(false);
    }
  };

  // החלפת מצב + קריאת API מסודרת
  const toggleSelect = (id: string, phoneNumber: string, name: string) => {
    const wasSelected = selectedContacts.has(id); // מצב לפני שינוי
    doToggleAPICall(wasSelected, phoneNumber, name);

    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (wasSelected) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem('selectedContacts', JSON.stringify([...next]));
      return next;
    });
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
              const phone = item.phoneNumbers?.[0]?.number ?? '';
              return (
                <View style={styles.contactItem}>
                  <Checkbox
                    value={isChecked}
                    onValueChange={() => toggleSelect(item.id, phone, item.name)}
                    style={styles.checkbox}
                  />
                  <View>
                    <Text style={styles.contactName}>{item.name}</Text>
                    {phone ? <Text style={styles.contactPhone}>{phone}</Text> : null}
                  </View>
                </View>
              );
            }}
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
  button: {
    marginRight: 15,
  },
  modalContainer: {
    flex: 1,
    marginTop: 50,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  titleWrapper: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
  },
  titleUnderline: {
    marginTop: 6,
    width: 120,
    height: 4,
    backgroundColor: '#11998e',
    borderRadius: 2,
  },
  listContent: {
    paddingBottom: 80,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkbox: {
    marginRight: 10,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 14,
    color: 'gray',
  },
  closeButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#11998e',
    padding: 12,
    borderRadius: 10,
    width: '50%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
});
