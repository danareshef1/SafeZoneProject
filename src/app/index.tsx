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
import sheltersData from '../../assets/data/shelters.json';
import ShelterListItem from '../components/ui/Map/ShelterListItem';
import CustomMarker from '../components/ui/Map/CustomMarker';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Shelter } from '../types/Shelter';
import { useRouter } from 'expo-router';

const HomeScreen: React.FC = () => {
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [mapRegion, setMapRegion] = useState<null | {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }>(null);

  const snapPoints = useMemo(() => ['8%', '50%', '90%'], []);
  const router = useRouter();

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'low load (green)':
        return '#4CAF50'; // Green
      case 'medium load (yellow)':
        return '#FFEB3B'; // Yellow
      case 'high load (red)':
        return '#F44336'; // Red
      default:
        return '#9E9E9E'; // Default gray
    }
  };

  const resetSheltersData = async () => {
    try {
      const defaultShelters = sheltersData.map((shelter) => ({
        ...shelter,
        status: shelter.status || 'Low Load (Green)', // Ensure default status
      }));

      // Reset only the 'shelters' key in AsyncStorage
      await AsyncStorage.setItem('shelters', JSON.stringify(defaultShelters));
      setShelters(defaultShelters); // Update local state

      console.log('Shelter data has been reset.');
    } catch (error) {
      console.error('Error resetting shelters data:', error);
    }
  };

  useEffect(() => {
    const loadSheltersFromStorage = async () => {
      try {
        const storedShelters = await AsyncStorage.getItem('shelters');
        if (storedShelters) {
          setShelters(JSON.parse(storedShelters));
        } else {
          await resetSheltersData(); // Initialize with default shelters if none exist
        }
      } catch (error) {
        console.error('Error loading shelters:', error);
      }
    };

    loadSheltersFromStorage();
  }, []);

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
        <MapView style={styles.map} region={mapRegion}>
          {shelters.map((shelter) => (
            <CustomMarker
              key={`${shelter.id}-${shelter.status}`}
              shelter={shelter}
              pinColor={getStatusColor(shelter.status)} // Pass dynamic pin color
              onPress={() => setSelectedShelter(shelter)}
            />
          ))}
        </MapView>

        {selectedShelter && (
          <>
            <View style={styles.selectedShelter}>
              <ShelterListItem
                shelter={selectedShelter}
                containerStyle={{}}
                statusColor={getStatusColor(selectedShelter.status)} // Pass dynamic color
              />
            </View>
            <View style={styles.reportButtonContainer}>
              <Button title="Report Shelter" onPress={handleReport} />
            </View>
          </>
        )}

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
                  statusColor={getStatusColor(item.status)} // Pass dynamic color
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
