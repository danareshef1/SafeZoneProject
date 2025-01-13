import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';

interface Hospital {
  id: string;
  name: string;
  distance: string;
  latitude: number;
  longitude: number;
}

const HospitalsScreen: React.FC = () => {
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const emergencyContacts = [
    { name: 'משטרה', phone: '100' },
    { name: 'מגן דוד אדום', phone: '101' },
    { name: 'מכבי אש', phone: '103' },
    { name: '(ער״ן) מוקד תמיכה נפשית', phone: '1201' },
  ];

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Denied',
            'Permission to access location was denied. Defaulting to Tel Aviv.'
          );
          setCurrentLocation({
            latitude: 32.0853,
            longitude: 34.7818,
          });
          setLoading(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        setCurrentLocation({ latitude, longitude });

        // Replace this with an API call for real hospital data
        setHospitals([
          {
            id: '1',
            name: 'Hospital A',
            distance: '2.5 km',
            latitude: latitude + 0.01,
            longitude: longitude + 0.01,
          },
          {
            id: '2',
            name: 'Hospital B',
            distance: '3.0 km',
            latitude: latitude + 0.02,
            longitude: longitude + 0.02,
          },
        ]);
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Unable to fetch location.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading location and data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: currentLocation?.latitude || 32.0853,
          longitude: currentLocation?.longitude || 34.7818,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {hospitals.map((hospital) => (
          <Marker
            key={hospital.id}
            coordinate={{
              latitude: hospital.latitude,
              longitude: hospital.longitude,
            }}
            title={hospital.name}
            description={`Distance: ${hospital.distance}`}
          />
        ))}
      </MapView>

      <FlatList
        data={hospitals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.hospitalItem}>
            <Text style={styles.hospitalName}>{item.name}</Text>
            <Text style={styles.hospitalDistance}>{item.distance}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Nearest Hospitals</Text>}
      />

      <FlatList
        data={emergencyContacts}
        keyExtractor={(item) => item.phone}
        renderItem={({ item }) => (
          <View style={styles.contactItem}>
            <Text style={styles.contactName}>{item.name}</Text>
            <TouchableOpacity
              style={styles.phoneContainer}
              onPress={() => handleCall(item.phone)}
            >
              <MaterialIcons name="phone" size={20} color="blue" />
              <Text style={styles.contactPhone}>{item.phone}</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Emergency Contacts</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '40%' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hospitalItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  hospitalName: { fontSize: 16, fontWeight: 'bold' },
  hospitalDistance: { fontSize: 14, color: '#555' },
  contactItem: {
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactName: { fontSize: 16 },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactPhone: {
    fontSize: 16,
    color: 'blue',
    marginLeft: 5,
    textDecorationLine: 'underline',
  },
  listContainer: { padding: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 10 },
});

export default HospitalsScreen;
