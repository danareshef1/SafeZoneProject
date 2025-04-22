import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';

type Alarm = {
  id: string;
  time: string;
  description: string;
  dateObj: Date;
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
        const body = typeof rawData.body === 'string' ? JSON.parse(rawData.body) : rawData.body ?? rawData;

        const formatted = body
          .filter((item: any) => item.timestamp && item.city)
          .map((item: any) => {
            const date = new Date(item.timestamp);
            return {
              id: `${item.city}-${item.timestamp}`,
              time: date.toLocaleTimeString("he-IL"),
              dateObj: date,
              description: `${item.city}`,
            };
          });

        setAlarms(formatted);
      } catch (error) {
        console.error('שגיאה בקבלת התראות:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlarms();
  }, []);

  const now = new Date();
  let filteredAlarms = alarms;

  if (filter === 'this week') {
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    filteredAlarms = alarms.filter(a => a.dateObj >= sunday && a.dateObj <= now);
  } else if (filter === 'this month') {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    filteredAlarms = alarms.filter(a => a.dateObj >= firstOfMonth && a.dateObj <= now);
  } else if (filter === 'today') {
    filteredAlarms = alarms.filter(a =>
      a.dateObj.getDate() === now.getDate() &&
      a.dateObj.getMonth() === now.getMonth() &&
      a.dateObj.getFullYear() === now.getFullYear()
    );
  }

  // 🔁 קיבוץ לפי דקה
  const groupedMap: Record<string, Alarm[]> = {};
  filteredAlarms.forEach(alarm => {
    const d = alarm.dateObj;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
    if (!groupedMap[key]) groupedMap[key] = [];
    groupedMap[key].push(alarm);
  });

  const groupedAlarms: Alarm[] = Object.entries(groupedMap)
    .sort((a, b) => b[1][0].dateObj.getTime() - a[1][0].dateObj.getTime())
    .map(([key, group]) => ({
      id: key,
      time: group[0].time,
      dateObj: group[0].dateObj,
      description: group.map(a => a.description).join(', '),
    }));

  const renderAlarm = ({ item }: { item: Alarm }) => (
    <View style={styles.alarmItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.alarmDescription}>{item.description}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
  <Text style={styles.alarmTime}>{item.time}</Text>
  {filter !== 'today' && (
    <Text style={styles.alarmDate}>
      {item.dateObj.toLocaleDateString('he-IL')}
    </Text>
  )}
</View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        {['today', 'this week', 'this month'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.activeFilter]}
            onPress={() => setFilter(f as any)}
          >
            <Text style={styles.filterText}>
              {f === 'today' ? 'היום' : f === 'this week' ? 'השבוע' : 'החודש'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : (
        <FlatList
          data={groupedAlarms}
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
    fontWeight: 'bold',
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
    marginLeft: 8,
  },
  alarmDescription: {
    fontSize: 16,
    color: '#555',
  },
  alarmDate: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#888',
    fontSize: 16,
  },
});
