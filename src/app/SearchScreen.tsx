import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { getAuthUserEmail } from '../../utils/auth';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { findUserZone, AlertZone } from '../../utils/zoneUtils';

export default function EmergencyStatusScreen() {
  const [userZone, setUserZone] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [filteredZones, setFilteredZones] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [alertsCount, setAlertsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const email = await getAuthUserEmail();
        if (!email) return;

        const res = await fetch(`https://3xzztnl8bf.execute-api.us-east-1.amazonaws.com/get-user-location?email=${email}`);
        const userLocation = await res.json();
        console.log("📍 מיקום המשתמש:", userLocation);

        const allZonesRes = await fetch('https://x5vsugson1.execute-api.us-east-1.amazonaws.com/getAllAlertZones');
        const allZonesData = await allZonesRes.json();

        let zonesArray = [];

        if (Array.isArray(allZonesData)) {
          zonesArray = allZonesData;
        } else if (Array.isArray(allZonesData.body)) {
          zonesArray = allZonesData.body;
        } else if (typeof allZonesData.body === 'string') {
          zonesArray = JSON.parse(allZonesData.body);
        }

        if (!Array.isArray(zonesArray)) throw new Error('המידע על האזורים אינו מערך');

        setZones(zonesArray);

        const closest = findUserZone(userLocation.lat, userLocation.lng, zonesArray, userLocation.city);
        setUserZone(closest);
        console.log("✅ האזור שזוהה למשתמש:", closest);

      } catch (e) {
        console.error('❌ שגיאה בטעינת האזורים:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchZones();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    if (q.trim() === '') return setFilteredZones([]);

    const filtered = zones.filter((z) =>
      z.name?.toLowerCase().includes(q) || z.zone?.toLowerCase().includes(q)
    );
    setFilteredZones(filtered);
  }, [searchQuery]);

  useEffect(() => {
    const fetchUserZoneAlerts = async () => {
      if (userZone && !selectedZone) {
        const alerts = await getAlertsForZone(userZone.name);
        setAlertsCount(alerts);
      }
    };
    fetchUserZoneAlerts();
  }, [userZone, selectedZone]);

  const getAlertsForZone = async (zoneName: string) => {
    try {
      const res = await fetch('https://j5tn0rj9rc.execute-api.us-east-1.amazonaws.com/prod/alerts');
      const alertsData = await res.json();

      const lastMonthDate = new Date();
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

      const alertsInZone = alertsData.filter((alert: any) =>
        alert.city.includes(zoneName) && new Date(alert.timestamp) >= lastMonthDate
      );

      return alertsInZone.length;
    } catch (e) {
      console.error('❌ שגיאה בטעינת האזעקות:', e);
      return 0;
    }
  };

  const handleZoneSelect = async (zone: any) => {
    setSelectedZone(zone);
    setSearchQuery(zone.name);
    setFilteredZones([]);

    const alerts = await getAlertsForZone(zone.name);
    setAlertsCount(alerts);
  };

  const renderZone = (zone: any) => (
    <View key={zone.id} style={styles.zoneBox}>
      <View style={styles.zoneHeader}>
        <Ionicons name="location-sharp" size={24} color="#11998e" />
        <Text style={styles.zoneName}>{zone.name || 'לא ידוע'} | {zone.zone || 'לא ידוע'}</Text>
      </View>
      <View style={styles.section}>
        <Ionicons name="timer" size={20} color="#11998e" />
        <Text style={styles.sectionLabel}>זמן כניסה למרחב מוגן:</Text>
        <Text style={styles.sectionValue}>
          {zone.countdown === 0 ? 'מיידי' : `${zone.countdown} שניות`}
        </Text>
      </View>
      <View style={styles.section}>
        <Ionicons name="notifications" size={20} color="#11998e" />
        <Text style={styles.sectionLabel}>אזעקות בחודש האחרון:</Text>
        <Text style={styles.sectionValue}>
          {alertsCount !== null ? alertsCount : 'אין נתונים'}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" color="#11998e" style={{ marginTop: 50 }} />;
  }

  return (
    <View style={styles.container}>
      {userZone && !selectedZone && (
        <View style={styles.currentZoneContainer}>
          <Text style={styles.currentZoneTitle}>האזור שלך כרגע:</Text>
          {renderZone(userZone)}
        </View>
      )}

      <Text style={styles.title}>חפש אזורים נוספים</Text>
      <View style={styles.searchWrapper}>
        <FontAwesome name="search" size={20} color="#11998e" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="חפש לפי שם או אזור"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {filteredZones.length > 0 && (
        <FlatList
          data={filteredZones}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleZoneSelect(item)}>
              <View style={styles.searchItem}>
                <Ionicons name="search" size={18} color="#11998e" />
                <Text style={styles.searchText}>{item.name || 'לא ידוע'}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {selectedZone && (
        <View style={styles.selectedZoneContainer}>
          <Text style={styles.selectedZoneTitle}>סטטוס נוכחי עבור {selectedZone.name}</Text>
          {renderZone(selectedZone)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#E6FAF5',
  },
  title: {
    fontSize: 20,
    color: '#11998e',
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderColor: '#ccc',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    flex: 1,
    marginLeft: 10,
    textAlign: 'right',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 10,
  },
  searchText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 10,
  },
  zoneBox: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  zoneHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  zoneName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
  },
  section: {
    marginBottom: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 14,
    color: '#888',
    marginRight: 8,
    marginLeft: 5,
  },
  sectionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  selectedZoneContainer: {
    marginTop: 20,
    paddingTop: 15,
    paddingBottom: 15,
    backgroundColor: '#f1f1f1',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  selectedZoneTitle: {
    fontSize: 18,
    color: '#11998e',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  currentZoneContainer: {
    marginBottom: 30,
    paddingVertical: 15,
    paddingHorizontal: 10,
    backgroundColor: '#d9f5f0',
    borderRadius: 10,
    borderColor: '#11998e',
    borderWidth: 1,
  },
  currentZoneTitle: {
    fontSize: 18,
    color: '#11998e',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
});
