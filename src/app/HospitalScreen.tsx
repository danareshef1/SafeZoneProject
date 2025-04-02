import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, Linking, TouchableOpacity } from 'react-native';
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
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
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
          Alert.alert('Permission Denied', 'Permission to access location was denied. Defaulting to Tel Aviv.');
          setCurrentLocation({ latitude: 32.0853, longitude: 34.7818 });
          setLoading(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });

        const response = await fetch('https://vkkdzdn7n6.execute-api.us-east-1.amazonaws.com/hospitals');
        const data = await response.json();
        setHospitals(data.map((hospital: any) => ({
          id: hospital.name,
          name: hospital.name,
          distance: 'N/A', 
          latitude: hospital.lat,
          longitude: hospital.lon,
        })));
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

  const handleMarkerPress = (hospital: Hospital) => {
    setSelectedHospital(hospital);
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
            onPress={() => handleMarkerPress(hospital)}
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
        style={styles.hospitalList}
        scrollEnabled={true}
      />

      {/* Emergency Contacts */}
      <View style={styles.fixedBottomContainer}>
        <FlatList
          data={emergencyContacts}
          keyExtractor={(item) => item.phone}
          renderItem={({ item }) => (
            <View style={styles.contactItem}>
              <Text style={styles.contactName}>{item.name}</Text>
              <TouchableOpacity style={styles.phoneContainer} onPress={() => handleCall(item.phone)}>
                <MaterialIcons name="phone" size={20} color="blue" />
                <Text style={styles.contactPhone}>{item.phone}</Text>
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={<Text style={styles.sectionTitle}>Emergency Contacts</Text>}
          style={styles.emergencyList}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '50%' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hospitalItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  hospitalName: { fontSize: 16, fontWeight: 'bold' },
  hospitalDistance: { fontSize: 14, color: '#555' },
  contactItem: { padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contactName: { fontSize: 16 },
  phoneContainer: { flexDirection: 'row', alignItems: 'center' },
  contactPhone: { fontSize: 16, color: 'blue', marginLeft: 5, textDecorationLine: 'underline' },
  listContainer: { padding: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 10 },
  hospitalList: {
    marginBottom: 100, // Give some space for the fixed emergency contact section
    height: '45%', // Limit the height of hospital list to avoid overlap
  },
  fixedBottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    elevation: 5,
    padding: 5,
  },
  emergencyList: {
    maxHeight: 120, // Shrink the height of emergency contact section
  },
});

export default HospitalsScreen;
