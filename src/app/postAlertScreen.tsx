import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView, I18nManager } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

I18nManager.forceRTL(true);

const PostAlertScreen = () => {
  const [hospital, setHospital] = useState(null);
  const [shelter, setShelter] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const hospitalData = await AsyncStorage.getItem('nearestHospital');
        const shelterData = await AsyncStorage.getItem('nearestShelter');
        if (hospitalData) setHospital(JSON.parse(hospitalData));
        if (shelterData) setShelter(JSON.parse(shelterData));
      } catch (e) {
        console.error('שגיאה בשליפת נתונים:', e);
      }
    };
    fetchData();
  }, []);

  const emergencyContacts = [
    { name: 'משטרה', phone: '100' },
    { name: 'מגן דוד אדום', phone: '101' },
    { name: 'מכבי אש', phone: '102' },
    { name: 'ער״ן - עזרה ראשונה נפשית', phone: '1201' },
  ];

  const checklist = [
    'ודא שכל בני הבית בטוחים',
    'בדוק אם יש נזק למבנה או לרכוש',
    'היה קשוב להנחיות פיקוד העורף',
    'הכן את עצמך לאזעקות נוספות',
    'התקשר לקרובים לדווח שהכול תקין',
  ];

  const handleCall = (phone) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleNavigate = () => {
    if (!hospital) return;
    const url = `https://waze.com/ul?ll=${hospital.latitude},${hospital.longitude}&navigate=yes`;
    Linking.openURL(url);
  };

  const handleReport = () => {
    if (!shelter) return;
    router.push({
      pathname: '/report-shelter/[id]',
      params: {
        id: shelter.id,
        name: shelter.name ?? '',
        location: shelter.location ?? '',
        status: shelter.status ?? '',
        image: shelter.image ?? '',
      },
    });
  };


const handleChat = async () => {
  try {
    // שליפות אופציונליות (אם שמרת מפתחות כאלה)
    const isAtHomeStr = await AsyncStorage.getItem('isAtHome');
    const isAtHome = isAtHomeStr === 'true';
    const city = (await AsyncStorage.getItem('userCity')) || ''; // אם אין לך key כזה – אפשר להשאיר ריק

    // מה שיש לנו כבר מה־state
    const shelterName = shelter?.name ?? '';
    const distanceKm = typeof shelter?.distance === 'number' ? String(shelter.distance) : '';

    router.push({
      pathname: '/emotional-chat',
      params: {
        returnTo: 'postAlertScreen',
        city,
        isAtHome: isAtHome ? '1' : '0',   // מעבירים כמחרוזת
        shelterName,
        distanceKm,
      },
    });
  } catch (e) {
    console.error('שגיאה בפתיחת צ׳אט:', e);
  }
};

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🏥 בית החולים הקרוב:</Text>
        <Text style={styles.shelterName}>{hospital?.name ?? 'לא נמצא בית חולים'}</Text>
        {hospital && (
          <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
            <Text style={styles.navigateButtonText}>נווט עם Waze</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📋 צ׳ק ליסט אחרי אזעקה:</Text>
        {checklist.map((item, index) => (
          <Text key={index} style={styles.checklistItem}>✅ {item}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📞 מספרי חירום:</Text>
        {emergencyContacts.map((contact, index) => (
          <TouchableOpacity key={index} style={styles.contactItem} onPress={() => handleCall(contact.phone)}>
            <Text style={styles.contactText}>{contact.name}</Text>
            <View style={styles.phoneContainer}>
              <MaterialIcons name="phone" size={20} color="#fff" />
              <Text style={styles.phoneText}>{contact.phone}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleChat}>
          <Text style={styles.actionButtonText}>💬 פתיחת צ׳אט</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#e60000' }]} onPress={handleReport}>
          <Text style={styles.actionButtonText}>📢 דיווח על המקלט</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f9f9f9',
    alignItems: 'flex-start',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    marginTop: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#11998e',
    textAlign: 'right',
  },
  shelterName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
    textAlign: 'right',
  },
  navigateButton: {
    backgroundColor: '#11998e',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    alignSelf: 'flex-start',
  },
  navigateButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  checklistItem: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
    textAlign: 'right',
  },
  contactItem: {
    backgroundColor: '#FF7043',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'right',
  },
  phoneContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 16,
    color: 'white',
    marginLeft: 6,
    textDecorationLine: 'underline',
    textAlign: 'right',
  },
  buttonsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#11998e',
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default PostAlertScreen;
