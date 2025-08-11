import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EarlyWarningScreen() {
  const { city = 'לא ידוע', timestamp } = useLocalSearchParams();
  const [nearestShelter, setNearestShelter] = useState(null);
const [isAtHome, setIsAtHome] = useState<boolean | null>(null);

  useEffect(() => {
  const loadData = async () => {
    try {
      const shelterData = await AsyncStorage.getItem('nearestShelter');
      const atHomeString = await AsyncStorage.getItem('isAtHome');

      if (shelterData) {
        const shelter = JSON.parse(shelterData);
        setNearestShelter(shelter);
      }

      if (atHomeString !== null) {
        setIsAtHome(atHomeString === 'true');
        console.log('📍 isAtHome from AsyncStorage:', atHomeString);
      }
    } catch (err) {
      console.error('שגיאה בטעינת נתונים:', err);
    }
  };

  loadData();
}, []);
useEffect(() => {
  AsyncStorage.getItem('isAtHome').then(console.log);
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
      {isAtHome === null ? null : (
  nearestShelter && (
    <>
     {isAtHome === null ? null : (
  <>
    {isAtHome ? (
      <Text style={styles.homeMessage}>
         אתה בבית - גש לממ"ד הקרוב
      </Text>
    ) : (
      nearestShelter && (
        <>
          <Text style={styles.shelterTitle}>המקלט הקרוב ביותר:</Text>
          <Text style={styles.shelterName}>{nearestShelter.name ?? 'ללא שם'}</Text>
          <TouchableOpacity style={styles.navButton} onPress={handleNavigateToShelter}>
            <Text style={styles.navButtonText}>🏃 נווט למקלט הקרוב</Text>
          </TouchableOpacity>
        </>
      )
    )}
  </>
)}
    </>
  )
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
  homeMessage: {
  marginTop: 12,
  fontSize: 16,
  fontWeight: 'bold',
  color: colors.dark,
  textAlign: 'center',
}

});
