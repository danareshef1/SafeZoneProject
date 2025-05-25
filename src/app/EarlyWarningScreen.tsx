// EarlyWarningScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

export default function EarlyWarningScreen() {
  const { city = 'לא ידוע', timestamp } = useLocalSearchParams();

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
});
