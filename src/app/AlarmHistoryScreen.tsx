// src/App/AlarmHistoryScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';

type Alarm = {
  id: string;
  time: string;
  description: string;
};

const mockAlarms: Alarm[] = [
  { id: '1', time: '08:00 AM', description: 'will be the place' },
  { id: '2', time: '12:00 PM', description: 'will be the place' },
  { id: '3', time: '06:00 PM', description: 'will be the place' },
  // Add more mock alarms as needed
];

const AlarmHistoryScreen = () => {
  const [filter, setFilter] = useState<'today' | 'this week' | 'this month'>('today');

  // In a real application, you'd fetch and filter data based on the selected timeframe
  const filteredAlarms = mockAlarms; // Replace with actual filtering logic

  const renderAlarm = ({ item }: { item: Alarm }) => (
    <View style={styles.alarmItem}>
      <Text style={styles.alarmTime}>{item.time}</Text>
      <Text style={styles.alarmDescription}>{item.description}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'today' && styles.activeFilter]}
          onPress={() => setFilter('today')}
        >
          <Text style={styles.filterText}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'this week' && styles.activeFilter]}
          onPress={() => setFilter('this week')}
        >
          <Text style={styles.filterText}>This Week</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'this month' && styles.activeFilter]}
          onPress={() => setFilter('this month')}
        >
          <Text style={styles.filterText}>This Month</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredAlarms}
        keyExtractor={(item) => item.id}
        renderItem={renderAlarm}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>No alarms found.</Text>}
      />
    </View>
  );
};

export default AlarmHistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeFilter: {
    backgroundColor: '#007bff',
  },
  filterText: {
    color: '#000',
  },
  listContainer: {
    paddingBottom: 20,
  },
  alarmItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  alarmTime: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  alarmDescription: {
    fontSize: 16,
    color: '#555',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#888',
    fontSize: 16,
  },
});
