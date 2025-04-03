import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, Linking, TouchableOpacity } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';

interface Hospital {
  id: string;
  name: string;
  distance: string;
  latitude: number;
  longitude: number;
}

const HospitalsScreen: React.FC = () => {
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [nearbyHospitals, setNearbyHospitals] = useState<Hospital[]>([]); // Stores hospitals within 20 km
  const [loading, setLoading] = useState<boolean>(true);

  const emergencyContacts = [
    { name: 'משטרה', phone: '100' },
    { name: 'מגן דוד אדום', phone: '101' },
    { name: 'מכבי אש', phone: '103' },
    { name: '(ער״ן) מוקד תמיכה נפשית', phone: '1201' },
  ];

  const snapPoints = useMemo(() => ['8%', '50%', '90%'], []);

  const toRad = (value: number) => (value * Math.PI) / 180;

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  };

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Permission to access location was denied. Defaulting to Tel Aviv.');
          setCurrentLocation({ latitude: 32.0853, longitude: 34.7818 });
          setLoading(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });

        const response = await fetch('https://vkkdzdn7n6.execute-api.us-east-1.amazonaws.com/hospitals');
        const data = await response.json();

        const hospitalsWithDistance = data.map((hospital: any) => {
          const distance = haversineDistance(
            location.coords.latitude,
            location.coords.longitude,
            hospital.lat,
            hospital.lon
          );
          return {
            id: hospital.name,
            name: hospital.name,
            distance: `${distance.toFixed(2)} km`,
            latitude: hospital.lat,
            longitude: hospital.lon,
          };
        });

        const nearbyHospitals: Hospital[] = hospitalsWithDistance.filter((hospital: Hospital) => {
          const distanceInKm: number = parseFloat(hospital.distance.replace(' km', ''));
          return distanceInKm <= 20;
        });

        nearbyHospitals.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

        setNearbyHospitals(nearbyHospitals);

        setHospitals(hospitalsWithDistance);
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Unable to fetch location or hospitals.');
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
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Loading location and data...</Text>
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
        {/* Add a blue marker for the user's current location */}
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title="Your Location"
            pinColor="blue" // Set the color to blue for the current location
          />
        )}

        {hospitals.map((hospital) => (
          <Marker
            key={hospital.id}
            coordinate={{
              latitude: hospital.latitude,
              longitude: hospital.longitude,
            }}
            title={hospital.name}
            description={`Distance from me: ${hospital.distance}`}
            pinColor="#FF7043"
          />
        ))}
      </MapView>

      <FlatList
        data={nearbyHospitals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.hospitalItem}>
            <Text style={styles.hospitalName}>{item.name}</Text>
            <Text style={styles.hospitalDistance}>{item.distance}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Nearest Hospitals</Text>}
        style={styles.hospitalList}
      />

      <BottomSheet index={0} snapPoints={snapPoints} style={styles.bottomSheet}>
        <View style={styles.bottomSheetContent}>
          <Text style={styles.emergencyContactsTitle}>מספרי חירום</Text>
          
          <BottomSheetFlatList
            data={emergencyContacts}
            keyExtractor={(item) => item.phone}
            renderItem={({ item }) => (
              <View style={styles.contactItem}>
                <Text style={styles.contactName}>{item.name}</Text>
                <TouchableOpacity style={styles.phoneContainer} onPress={() => handleCall(item.phone)}>
                  <MaterialIcons name="phone" size={20} color="white" />
                  <Text style={styles.contactPhone}>{item.phone}</Text>
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={styles.listContainer}
          />
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '50%' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#000000', marginTop: 10 },
  hospitalItem: {
    padding: 12,
    marginVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  hospitalName: { fontSize: 14, fontWeight: 'bold', color: '#FF7043' },
  hospitalDistance: { fontSize: 12, color: '#757575' },
  contactItem: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FF7043',
    borderRadius: 8,
    marginVertical: 6,
  },
  contactName: { fontSize: 16, color: 'white' },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactPhone: {
    fontSize: 16,
    color: 'white',
    marginLeft: 5,
    textDecorationLine: 'underline',
  },
  listContainer: { padding: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginVertical: 12, color: '#FF7043' },
  hospitalList: {
    marginBottom: 80,
    height: '35%',
  },
  bottomSheet: { flex: 1, backgroundColor: 'white', elevation: 5 },
  bottomSheetContent: { flex: 1, padding: 16 },
  emergencyContactsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF7043',
    marginBottom: 10, 
    marginTop: -20, 
    textAlign: 'center',
  },
});

export default HospitalsScreen;
