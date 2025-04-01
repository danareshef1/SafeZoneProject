// app/contactsButton.tsx
import React, { useState } from 'react';
import { TouchableOpacity, Modal, FlatList, Text, View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';

const ContactsButton = () => {
  const [contacts, setContacts] = useState<any[]>([]);
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
        setModalVisible(true);
      } catch (err) {
        console.error('Failed to fetch matched users:', err);
      }
    }
  };
  

  return (
    <>
      <TouchableOpacity onPress={fetchContacts} style={styles.button}>
        <MaterialIcons name="phone" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Contacts</Text>
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.contactItem}>
                <Text style={styles.contactName}>{item.name}</Text>
                {item.phoneNumbers?.length > 0 && (
                  <Text style={styles.contactPhone}>
                    {item.phoneNumbers[0].number}
                  </Text>
                )}
              </View>
            )}
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
    marginBottom: 15,
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
