// app/contactsButton.tsx
import React, { useState } from 'react';
import { 
  TouchableOpacity, 
  Modal, 
  FlatList, 
  Text, 
  View, 
  StyleSheet, 
  ActivityIndicator 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import Checkbox from 'expo-checkbox'; 
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ContactItem {
  id: string;
  name: string;
  phoneNumbers?: { number: string }[];
}

const ContactsButton = () => {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  const fetchContacts = async () => {
    setLoadingContacts(true);
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
        const response = await fetch('https://s9aavxmut7.execute-api.us-east-1.amazonaws.com/GetRegisteredContacts', {
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
    setLoadingContacts(false);
  };

  const toggleSelect = (id: string, phoneNumber: string, name: string) => {
    setSelectedContacts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      AsyncStorage.setItem('selectedContacts', JSON.stringify([...newSet]));
      return newSet;
    });
    doToggleAPICall(id, phoneNumber, name);
  };

  const doToggleAPICall = async (id: string, phoneNumber: string, name: string) => {
    try {
      setToggleLoading(true);
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      const stored = await AsyncStorage.getItem('selectedContacts');
      const currentSet = new Set(stored ? JSON.parse(stored) : []);
      if (currentSet.has(id)) {
        await fetch('https://jdd8xkf4o1.execute-api.us-east-1.amazonaws.com/prod/saveContact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, phone: normalizedPhone, name }),
        });
      } else {
        await fetch('https://jdd8xkf4o1.execute-api.us-east-1.amazonaws.com/prod/removeContact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, phone: normalizedPhone }),
        });
      }
    } catch (error) {
      console.error('Error in doToggleAPICall:', error);
    } finally {
      setToggleLoading(false);
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
              return (
                <View style={styles.contactItem}>
                  <Checkbox
                    value={isChecked}
                    onValueChange={() => toggleSelect(item.id, item.phoneNumbers?.[0]?.number ?? '', item.name)}
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
