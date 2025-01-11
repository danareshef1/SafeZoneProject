import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Text, Alert, ActivityIndicator } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location'; // Import expo-location for location services
import shelters from '../../assets/data/shelters.json';
import ShelterListItem from '../components/ShelterListItem';
import CustomMarker from '../components/CustomMarker';
import { Shelter } from '../types/Shelter';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';

const HomeScreen: React.FC = () => {
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [mapRegion, setMapRegion] = useState<null | {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }>(null); // Map region starts as null

  const snapPoints = useMemo(() => ['10%', '50%', '90%'], []);

  useEffect(() => {
    (async () => {
      try {
        // Request location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Denied',
            'Permission to access location was denied. Defaulting to Tel Aviv.'
          );
          // Fallback to Tel Aviv if permission is denied
          setMapRegion({
            latitude: 32.0853,
            longitude: 34.7818,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
          return;
        }

        // Get current location
        const location = await Location.getCurrentPositionAsync({});
        setMapRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      } catch (error) {
        console.error('Error fetching location:', error);
        Alert.alert('Error', 'Unable to fetch your location. Defaulting to Tel Aviv.');
        // Fallback to Tel Aviv if there's an error
        setMapRegion({
          latitude: 32.0853,
          longitude: 34.7818,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      }
    })();
  }, []);

  // Show loading indicator if location is not yet available
  if (!mapRegion) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Fetching your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* MapView */}
      <MapView style={styles.map} region={mapRegion}>
        {shelters.map((shelter) => (
          <CustomMarker
            key={shelter.id}
            shelter={shelter}
            onPress={() => setSelectedShelter(shelter)}
          />
        ))}
      </MapView>

      {/* Selected Shelter */}
      {selectedShelter && (
        <View style={styles.selectedShelter}>
          <ShelterListItem shelter={selectedShelter} containerStyle={{}} />
        </View>
      )}

      {/* Bottom Sheet */}
      <BottomSheet index={0} snapPoints={snapPoints}>
        <View style={styles.contentContainer}>
          <Text style={styles.listTitle}>Over {shelters.length} shelters</Text>
          <BottomSheetFlatList
            data={shelters}
            contentContainerStyle={{ gap: 10, padding: 10 }}
            renderItem={({ item }) => (
              <ShelterListItem shelter={item} containerStyle={{}} />
            )}
          />
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '50%', // Restrict map height to 50% of the screen
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedShelter: {
    position: 'absolute',
    bottom: 70,
    right: 10,
    left: 10,
  },
  contentContainer: {
    flex: 1,
  },
  listTitle: {
    textAlign: 'center',
    fontFamily: 'InterSemi',
    fontSize: 16,
    marginVertical: 5,
    marginBottom: 20,
  },
});

export default HomeScreen;
