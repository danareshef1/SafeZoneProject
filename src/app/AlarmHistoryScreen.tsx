import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';

type Alarm = {
  id: string;
  time: string;
  description: string;
};

const AlarmHistoryScreen = () => {
  const [filter, setFilter] = useState<'today' | 'this week' | 'this month'>('today');
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlarms = async () => {
      try {
        const response = await fetch('https://j5tn0rj9rc.execute-api.us-east-1.amazonaws.com/prod/alerts'); 
        const rawData = await response.json();
  
        const body = typeof rawData.body === 'string'
          ? JSON.parse(rawData.body)
          : rawData.body ?? rawData;
  
        const formatted = body.map((item: any) => ({
          id: item.alertId,
          time: new Date(item.timestamp).toLocaleTimeString("he-IL"),
          description: `אזעקה ב${item.city}`,
        }));
  
        setAlarms(formatted);
      } catch (error) {
        console.error('שגיאה בקבלת התראות:', error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchAlarms();
  }, []);
  const filteredAlarms = alarms;

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
          <Text style={styles.filterText}>היום</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'this week' && styles.activeFilter]}
          onPress={() => setFilter('this week')}
        >
          <Text style={styles.filterText}>השבוע</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'this month' && styles.activeFilter]}
          onPress={() => setFilter('this month')}
        >
          <Text style={styles.filterText}>החודש</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : (
        <FlatList
          data={filteredAlarms}
          keyExtractor={(item) => item.id}
          renderItem={renderAlarm}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>אין התראות</Text>}
        />
      )}
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
