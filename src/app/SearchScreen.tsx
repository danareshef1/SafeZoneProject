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

export default function EmergencyStatusScreen() {
  const [userZone, setUserZone] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [filteredZones, setFilteredZones] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<any>(null); // Store selected zone
  const [alertsCount, setAlertsCount] = useState<number | null>(null); // Store alerts count per zone
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const email = await getAuthUserEmail();
        if (!email) return;

        const res = await fetch(`https://3xzztnl8bf.execute-api.us-east-1.amazonaws.com/get-user-location?email=${email}`);
        const userLocation = await res.json();

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

        if (!Array.isArray(zonesArray)) throw new Error('Zones data is not an array');

        setZones(zonesArray);

        const closest = zonesArray.find(
          (zone: any) =>
            Math.abs(zone.lat - userLocation.lat) < 0.01 &&
            Math.abs(zone.lng - userLocation.lng) < 0.01
        );

        setUserZone(closest);
      } catch (e) {
        console.error('❌ Error loading zones:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchZones();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    if (q.trim() === '') return setFilteredZones([]); // Do not show suggestions if input is empty

    const filtered = zones.filter((z) =>
      z.name?.toLowerCase().includes(q) || z.zone?.toLowerCase().includes(q)
    );
    setFilteredZones(filtered);
  }, [searchQuery]);

  // Function to fetch alert data for the given zone
  const getAlertsForZone = async (zoneName: string) => {
    try {
      const res = await fetch('https://j5tn0rj9rc.execute-api.us-east-1.amazonaws.com/prod/alerts');
      const alertsData = await res.json();

      // Filter alerts based on the zone name and the last month's date
      const lastMonthDate = new Date();
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

      const alertsInZone = alertsData.filter((alert: any) => 
        alert.city.includes(zoneName) && new Date(alert.timestamp) >= lastMonthDate
      );

      return alertsInZone.length;
    } catch (e) {
      console.error('❌ Error fetching alerts:', e);
      return 0;
    }
  };

  const handleZoneSelect = async (zone: any) => {
    setSelectedZone(zone); // Store the selected zone
    setSearchQuery(zone.name); // Optionally set the input to the selected zone's name
    setFilteredZones([]); // Clear the filtered list once a zone is selected

    // Fetch the number of alerts for the selected zone
    const alerts = await getAlertsForZone(zone.name);
    setAlertsCount(alerts); // Store the number of alerts for the zone
  };

  const renderZone = (zone: any) => (
    <View key={zone.id} style={styles.zoneBox}>
      <Text style={styles.searchText}>{zone.name || 'Unknown'} | {zone.zone || 'Unknown'}</Text>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Time to Shelter</Text>
        <Text style={styles.sectionValue}>{zone.countdown} Seconds</Text>
      </View>
      {/* Display alerts count only if zone is selected */}
      {selectedZone && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Alerts in Last Month</Text>
          <Text style={styles.sectionValue}>
            {alertsCount !== null ? alertsCount : 'No data available'}
          </Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" color="#11998e" style={{ marginTop: 50 }} />;
  }

  return (
    <View style={styles.container}>
      {/* Only show the selected zone info if a zone is selected */}
      <Text style={styles.title}>Search Other Areas</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by name or region"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {filteredZones.length > 0 && (
        <FlatList
          data={filteredZones}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleZoneSelect(item)}>
              <Text style={styles.searchText}>{item.name || 'Unknown'}</Text>
            </TouchableOpacity>
          )}
        />
      )}
      {/* Only display selected zone details after selection */}
      {selectedZone && (
        <View style={styles.selectedZoneContainer}>
          <Text style={styles.title}>Current Status for {selectedZone.name}</Text>
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
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderColor: '#ccc',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  searchText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  zoneBox: {
    marginBottom: 30,
  },
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#888',
  },
  sectionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedZoneContainer: {
    marginTop: 20,
  },
});
