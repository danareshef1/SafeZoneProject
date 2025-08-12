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
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setLoadingContacts(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      const stored = await AsyncStorage.getItem('registeredContacts');
      const registeredNumbers = stored ? JSON.parse(stored) : [];
      const registeredSet = new Set(registeredNumbers);

      const matchedContacts = data.filter((contact) =>
        contact.phoneNumbers?.some((phone) =>
          registeredSet.has(phone.number?.replace(/\D/g, ''))
        )
      );

      setContacts(
        matchedContacts.map((contact) => ({
          id: contact.id || '',
          name: contact.name,
          phoneNumbers: contact.phoneNumbers?.map((phone) => ({
            number: phone.number || '',
          })),
        }))
      );

      const storedSelected = await AsyncStorage.getItem('selectedContacts');
      if (storedSelected) setSelectedContacts(new Set(JSON.parse(storedSelected)));

      setModalVisible(true);
    } catch (err) {
      console.error('שגיאה בטעינת אנשי קשר:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const doToggleAPICall = async (
    { id, phoneNumber, name, nextSelected }: { id: string; phoneNumber: string; name: string; nextSelected: boolean }
  ) => {
    try {
      setToggleLoading(true);

      const owner = await getAuthUserEmail();
      if (!owner) {
        Alert.alert('שגיאה', 'לא נמצא משתמש מחובר (owner).');
        return;
      }

      const normalizedPhone = normPhone(phoneNumber);
      const url = nextSelected
        ? 'https://jdd8xkf4o1.execute-api.us-east-1.amazonaws.com/prod/saveContact'
        : 'https://jdd8xkf4o1.execute-api.us-east-1.amazonaws.com/prod/removeContact';

      const body = nextSelected
        ? { owner, id, phone: normalizedPhone, name }
        : { owner, phone: normalizedPhone };

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error('Error in doToggleAPICall:', error);
    } finally {
      setToggleLoading(false);
    }
  };

  const toggleSelect = (id: string, phoneNumber: string, name: string) => {
    // חשבי את המצב הבא לפני setState
    const nextSelected = !selectedContacts.has(id);

    setSelectedContacts((prev) => {
      const newSet = new Set(prev);
      if (nextSelected) newSet.add(id);
      else newSet.delete(id);
      AsyncStorage.setItem('selectedContacts', JSON.stringify([...newSet]));
      return newSet;
    });

    // קראי ל-API לפי המצב הבא
    doToggleAPICall({ id, phoneNumber, name, nextSelected });
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
