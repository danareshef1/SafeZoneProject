// EarlyWarningScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { TouchableOpacity, Linking, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export default function EarlyWarningScreen() {
  const { city = 'לא ידוע', timestamp } = useLocalSearchParams();
const [nearestShelter, setNearestShelter] = useState(null);

useEffect(() => {
  const loadNearestShelter = async () => {
    try {
      const data = await AsyncStorage.getItem('nearestShelter');
      if (data) {
        setNearestShelter(JSON.parse(data));
      }
    } catch (err) {
      console.error('שגיאה בשליפת המקלט הקרוב:', err);
    }
  };

  loadNearestShelter();
}, []);

const handleNavigateToShelter = () => {
  if (!nearestShelter) {
    Alert.alert('אין מקלט', 'לא נמצא מקלט קרוב');
    return;
  }

  const { latitude, longitude, name } = nearestShelter;
  const url = Platform.select({
    ios: `maps:0,0?q=${name}@${latitude},${longitude}`,
    android: `geo:0,0?q=${latitude},${longitude}(${name})`,
  });
  if (url) {
    Linking.openURL(url).catch(err => console.error('שגיאה בניווט:', err));
  }
};

  const formattedTimestamp = timestamp
    ? new Date(Number(timestamp)).toLocaleString('he-IL', {
        dateStyle: 'short',
        timeStyle: 'medium',
      })
    : 'מועד לא ידוע';

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="shield-alert" size={72} color={colors.green} style={styles.icon} />
      <Text style={styles.title}>בדקות הקרובות צפויות להתקבל התרעות באזורך</Text>
      <Text style={styles.city}>{city}</Text>
      <Text style={styles.description}>
        עליך לשפר את מיקומך למיגון המיטבי בקרבתך.
        במקרה של קבלת התרעה, יש להיכנס למרחב מוגן ולשהות בו 10 דקות.
      </Text>
      <Text style={styles.timestamp}>נשלח ב־{formattedTimestamp}</Text>
      {nearestShelter && (
  <>
    <Text style={styles.shelterTitle}>המקלט הקרוב ביותר:</Text>
    <Text style={styles.shelterName}>{nearestShelter.name ?? 'ללא שם'}</Text>

    <TouchableOpacity style={styles.navButton} onPress={handleNavigateToShelter}>
      <Text style={styles.navButtonText}>🏃 נווט למקלט הקרוב</Text>
    </TouchableOpacity>
  </>
)}

    </View>
    
  );
  
}

const colors = {
  background: '#e9f8f1',
  green: '#11998e',
  dark: '#1e3f2f',
  text: '#333',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    color: colors.green,
    marginBottom: 8,
  },
  city: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.dark,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    color: colors.text,
    marginHorizontal: 10,
    marginBottom: 24,
  },
  timestamp: {
    fontSize: 14,
    color: colors.dark,
  },
  shelterTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  marginTop: 16,
  color: colors.dark,
},
shelterName: {
  fontSize: 16,
  color: colors.text,
  marginBottom: 8,
},
navButton: {
  backgroundColor: colors.green,
  paddingVertical: 12,
  paddingHorizontal: 24,
  borderRadius: 30,
  marginTop: 10,
  elevation: 3,
},
navButtonText: {
  color: 'white',
  fontSize: 16,
  fontWeight: 'bold',
},

});

