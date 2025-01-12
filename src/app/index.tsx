import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Alert,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import sheltersData from '../../assets/data/shelters.json';
import ShelterListItem from '../components/ShelterListItem';
import CustomMarker from '../components/CustomMarker';
import StatusButtons from '../components/StatusButtons';
import { Shelter } from '../types/Shelter';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';

const HomeScreen: React.FC = () => {
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [mapRegion, setMapRegion] = useState<null | {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }>(null);

  const snapPoints = useMemo(() => ['10%', '50%', '90%'], []);

  // Load shelters from AsyncStorage or fallback to default data
  useEffect(() => {
    const loadSheltersFromStorage = async () => {
      try {
        const storedShelters = await AsyncStorage.getItem('shelters');
        if (storedShelters) {
          setShelters(JSON.parse(storedShelters));
        } else {
          setShelters(
            sheltersData.map((shelter) => ({
              ...shelter,
              status: shelter.status || 'green', // Ensure default status
            }))
          );
        }
      } catch (error) {
        console.error('Error loading shelters:', error);
        setShelters(
          sheltersData.map((shelter) => ({
            ...shelter,
            status: shelter.status || 'green',
          }))
        );
      }
    };

    loadSheltersFromStorage();
  }, []);

  const saveSheltersToStorage = async (updatedShelters: Shelter[]) => {
    try {
      await AsyncStorage.setItem('shelters', JSON.stringify(updatedShelters));
      console.log('Shelters saved to storage:', updatedShelters);
    } catch (error) {
      console.error('Error saving shelters to storage:', error);
    }
  };
  

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

const handleReport = (status: string) => {
  if (!selectedShelter) {
    Alert.alert('Error', 'Please select a shelter before reporting.');
    return;
  }

  const updatedShelters = shelters.map((shelter) =>
    shelter.id === selectedShelter.id ? { ...shelter, status } : shelter
  );

  setShelters(updatedShelters);
  saveSheltersToStorage(updatedShelters);

  Alert.alert('Reported', `Shelter: ${selectedShelter.location}\nStatus: ${status}`);
  console.log('Updated Shelters:', updatedShelters);

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
              key={`${shelter.id}-${shelter.status}`} // Ensure unique key for re-rendering
              shelter={shelter}
              onPress={() => setSelectedShelter(shelter)}
            />
          ))}
        </MapView>

        {selectedShelter && (
          <>
            <View style={styles.selectedShelter}>
              <ShelterListItem shelter={selectedShelter} containerStyle={{}} />
            </View>
            <Text style={styles.title}>Report Status of Shelter: {selectedShelter.location}</Text>
            <StatusButtons onReport={handleReport} />
          </>
        )}

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
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '50%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedShelter: {
    position: 'absolute',
    bottom: 120,
    right: 10,
    left: 10,
  },
  title: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  contentContainer: {
    flex: 1,
  },
  listTitle: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 5,
    marginBottom: 20,
  },
});

export default HomeScreen;
