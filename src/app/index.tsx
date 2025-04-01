import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Alert,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Button,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';

import ShelterListItem from '../components/ui/Map/ShelterListItem';
import CustomMarker from '../components/ui/Map/CustomMarker';
import { Shelter } from '../types/Shelter';

const API_URL = 'https://3izjdv6ao0.execute-api.us-east-1.amazonaws.com/shelters';

const HomeScreen: React.FC = () => {
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [mapRegion, setMapRegion] = useState<null | {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }>(null);

  // Snap points for the bottom sheet
  const snapPoints = useMemo(() => ['8%', '50%', '90%'], []);
  const router = useRouter();

  // Fetch shelters from your API Gateway endpoint
  const fetchShelters = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch shelters: ${response.status}`);
      }
      const data = await response.json();
      // Save to state
      setShelters(data);
      // Optionally store offline
      await AsyncStorage.setItem('shelters', JSON.stringify(data));
    } catch (error) {
      console.error('Error fetching shelters from API:', error);
      Alert.alert('Error', 'Unable to fetch shelter data.');
    }
  };

  // Load shelters on mount
  useEffect(() => {
    fetchShelters();
  }, []);

  // Get user's location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Denied',
            'Permission to access location was denied. Defaulting to Tel Aviv.'
          );
          setMapRegion({
            latitude: 32.0853,
            longitude: 34.7818,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
          return;
        }

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
        setMapRegion({
          latitude: 32.0853,
          longitude: 34.7818,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      }
    })();
  }, []);

  const handleReport = () => {
    if (selectedShelter) {
      router.push({
        pathname: '/report-shelter/[id]',
        params: { id: selectedShelter.id },
      });
    }
  };

  const handleDeselectShelter = () => setSelectedShelter(null);

  // Show a loading screen until we have the user's location
  if (!mapRegion) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Fetching your location...</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={handleDeselectShelter}>
      <View style={styles.container}>
        {/* Map */}
        <MapView style={styles.map} region={mapRegion}>
          {shelters.map((shelter) => (
            <CustomMarker
              key={`${shelter.id}-${shelter.status}`}
              shelter={shelter}
              pinColor="#4CAF50"
              onPress={() => setSelectedShelter(shelter)}
            />
          ))}
        </MapView>

        {/* Selected Shelter Info */}
        {selectedShelter && (
          <>
            <View style={styles.selectedShelter}>
              <ShelterListItem
                shelter={selectedShelter}
                containerStyle={{}}
                statusColor="#4CAF50"
              />
            </View>
            <View style={styles.reportButtonContainer}>
              <Button title="Report Shelter" onPress={handleReport} />
            </View>
          </>
        )}

        {/* Bottom Sheet with Shelters List */}
        <BottomSheet index={0} snapPoints={snapPoints}>
          <View style={styles.contentContainer}>
            <Text style={styles.listTitle}>Over {shelters.length} shelters</Text>
            <BottomSheetFlatList
              data={shelters}
              contentContainerStyle={{ gap: 10, padding: 10 }}
              renderItem={({ item }) => (
                <ShelterListItem
                  shelter={item}
                  containerStyle={{}}
                  statusColor="#4CAF50"
                />
              )}
            />
          </View>
        </BottomSheet>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '50%' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  selectedShelter: {
    position: 'absolute',
    bottom: 120,
    right: 10,
    left: 10,
  },
  reportButtonContainer: {
    position: 'absolute',
    bottom: 60,
    right: 10,
    left: 10,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    elevation: 5,
  },
  contentContainer: { flex: 1 },
  listTitle: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 5,
    marginBottom: 20,
  },
});

export default HomeScreen;