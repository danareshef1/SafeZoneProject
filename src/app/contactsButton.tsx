// app/contactsButton.tsx
import React, { useState } from 'react';
import { TouchableOpacity, Modal, FlatList, Text, View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import Checkbox from 'expo-checkbox'; 
import AsyncStorage from '@react-native-async-storage/async-storage';

const ContactsButton = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);

  const fetchContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === 'granted') {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      const phoneNumbers = data
        .flatMap((contact) => contact.phoneNumbers || [])
        .map((phone) => phone.number?.replace(/\D/g, ''))
        .filter((num) => !!num);

      try {
        const response = await fetch('https://lxtu11m70h.execute-api.us-east-1.amazonaws.com/GetRegisteredContacts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phoneNumbers }),
        });

        const json = await response.json();
        const result = json.registeredNumbers;

        const registeredSet = new Set(result);

        const matchedContacts = data.filter((contact) =>
          contact.phoneNumbers?.some((phone) =>
            registeredSet.has(phone.number?.replace(/\D/g, ''))
          )
        );

        setContacts(matchedContacts);
        const stored = await AsyncStorage.getItem('selectedContacts');
        if (stored) {
            setSelectedContacts(new Set(JSON.parse(stored)));
        }
        setModalVisible(true);
      } catch (err) {
        console.error('Failed to fetch matched users:', err);
      }
    }
  };

  const toggleSelect = async (id: string, phoneNumber: string, name: string) => {
    const newSet = new Set(selectedContacts);
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    
    if (newSet.has(id)) {
      newSet.delete(id);
      const updatedList = [...newSet];
      await AsyncStorage.setItem('selectedContacts', JSON.stringify(updatedList));
      
      await fetch('https://vkykumkkof.execute-api.us-east-1.amazonaws.com/removeContact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, phone: normalizedPhone }),
      });
    } else {
      newSet.add(id);
      const updatedList = [...newSet];
      await AsyncStorage.setItem('selectedContacts', JSON.stringify(updatedList));
      
      await fetch('https://vkykumkkof.execute-api.us-east-1.amazonaws.com/saveContact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, phone: normalizedPhone, name }),
      });
    }
    
    setSelectedContacts(newSet);
  };
  
  
  

  return (
    <>
      <TouchableOpacity onPress={fetchContacts} style={styles.button}>
        <MaterialIcons name="phone" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Select Contacts to Notify</Text>
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isChecked = selectedContacts.has(item.id);
              return (
                <View style={styles.contactItem}>
                  <Checkbox
                    value={isChecked}
                    onValueChange={() => toggleSelect(item.id, item.phoneNumbers[0]?.number, item.name)}
                    style={styles.checkbox}
                    />
                  <View>
                    <Text style={styles.contactName}>{item.name}</Text>
                    {item.phoneNumbers?.length > 0 && (
                      <Text style={styles.contactPhone}>{item.phoneNumbers[0].number}</Text>
                    )}
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
    padding: 20,
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
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
  },
  contactPhone: {
    fontSize: 14,
    color: 'gray',
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#11998e',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
