// app.index.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Alert,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Button,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import ShelterListItem from '../components/ui/Map/ShelterListItem';
import CustomMarker from '../components/ui/Map/CustomMarker';
import { Shelter } from '../types/Shelter';
import { useFocusEffect } from '@react-navigation/native';
import { getColorByStatus } from '../components/ui/Map/CustomMarker';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

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

  const snapPoints = useMemo(() => ['8%', '50%', '90%'], []);
  const router = useRouter();


  const fetchShelters = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch shelters: ${response.status}`);
      }
      const data = await response.json();
      setShelters(data);
      await AsyncStorage.setItem('shelters', JSON.stringify(data));
    } catch (error) {
      console.error('Error fetching shelters from API:', error);
      Alert.alert('Error', 'Unable to fetch shelter data.');
    }
  };

  useEffect(() => {
    fetchShelters();
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      fetchShelters();
    }, [])
  );
  

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
  const handleAddImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'We need permission to access your photos.');
      return;
    }
  
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
  
    if (!result.canceled && selectedShelter) {
      const newImageUri = result.assets[0].uri;
  
      // Update image in DynamoDB
      try {
        const response = await fetch(`${API_URL}/${selectedShelter.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: newImageUri,
          }),
        });
  
        if (!response.ok) {
          throw new Error('Failed to update shelter image');
        }
  
        // Refresh shelter list
        await fetchShelters();
  
        // Update selected shelter locally
        setSelectedShelter((prev) => prev ? { ...prev, image: newImageUri } : null);
  
      } catch (error) {
        console.error('Error uploading image:', error);
        Alert.alert('Error', 'Failed to upload image.');
      }
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
              onPress={() => setSelectedShelter(shelter)}
            />
          ))}
        </MapView>

        {selectedShelter && (
  <>
    <View style={styles.selectedShelter}>
      <View style={styles.shelterHeader}>
        <Text style={styles.shelterName}>{selectedShelter.name}</Text>
        {selectedShelter.image && (
          <Image
            source={{ uri: selectedShelter.image }}
            style={styles.headerImage}
          />
        )}
      </View>

      <ShelterListItem
        shelter={selectedShelter}
        containerStyle={{}}
        statusColor={getColorByStatus(selectedShelter?.status ?? '')}
      />
    </View>

    <View style={styles.buttonRow}>
      <TouchableOpacity style={styles.actionButton} onPress={handleReport}>
        <Text style={styles.actionButtonText}>דווח על מקלט</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionButton} onPress={handleAddImage}>
        <Text style={styles.actionButtonText}>הוסף תמונה</Text>
      </TouchableOpacity>
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
                  statusColor={getColorByStatus(item.status)}
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
  imagePreviewContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  
  buttonRow: {
    position: 'absolute',
    bottom: 60,
    right: 10,
    left: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    elevation: 5,
  },

  actionButton: {
    flex: 1,
    backgroundColor: '#11998e',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default HomeScreen;