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
import * as FileSystem from 'expo-file-system'; 
import { Buffer } from 'buffer'; 
import { sendLocationToBackend } from '../../utils/api'; // תוודאי שהנתיב נכון


const API_URL = 'https://3izjdv6ao0.execute-api.us-east-1.amazonaws.com/shelters';

const HomeScreen: React.FC = () => {
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [mapRegion, setMapRegion] = useState<null | {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }>(null);

  const snapPoints = useMemo(() => ['8%', '50%', '90%'], []);
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alarm[]>([]);

  type Alarm = {
    id: string;
    time: string;
    description: string;
  };
  
  const fetchAlerts = async () => {
    try {
      const response = await fetch('https://j5tn0rj9rc.execute-api.us-east-1.amazonaws.com/prod/alerts'); 
      const rawData = await response.json();
  
      const body = typeof rawData.body === 'string' ? JSON.parse(rawData.body) : rawData.body ?? rawData;
  
      if (!Array.isArray(body)) {
        console.error('❌ Alerts are not in array format:', body);
        return;
      }
  
      const formatted = body.map((item: any, index: number) => ({
        id: item.alertId || index.toString(),
        time: new Date(item.timestamp).toLocaleTimeString('he-IL'),
        description: `אזעקה ב${item.city}`,
      }));
  
      setAlerts(formatted);
    } catch (error) {
      console.error('שגיאה בקבלת התראות:', error);
    }
  };
  
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
      Alert.alert('Error', 'Unable to fetch shelter data.');
    }
  };

  useEffect(() => {
    fetchShelters();
    fetchAlerts();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchShelters();
    }, [])
  );

  useEffect(() => {
    (async () => {
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
      } else {
        const location = await Location.getCurrentPositionAsync({});
        setMapRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
  
        await sendLocationToBackend(
          location.coords.latitude,
          location.coords.longitude
        );
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
  const refreshLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission was denied');
        return;
      }
  
      const location = await Location.getCurrentPositionAsync({});
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
  
      await sendLocationToBackend(
        location.coords.latitude,
        location.coords.longitude
      );
  
      Alert.alert('Success', 'Location refreshed!');
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location.');
      console.error('Error refreshing location:', error);
    }
  };
  
  const getSignedUploadUrl = async (type: 'shelter') => {
    const response = await fetch(
      'https://uvapisjdkh.execute-api.us-east-1.amazonaws.com/prod/getSignedUploadUrl',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get signed URL');
    }

    return await response.json();
  };

  const uploadImageToS3 = async (localUri: string, type: 'shelter') => {
    const { uploadUrl, imageUrl } = await getSignedUploadUrl(type);

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const buffer = Buffer.from(base64, 'base64');

    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: buffer,
    });

    return imageUrl;
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
      const localUri = result.assets[0].uri;

      try {
        setIsImageUploading(true);
        const uploadedImageUrl = await uploadImageToS3(localUri, 'shelter');

        const response = await fetch(`${API_URL}/${selectedShelter.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: uploadedImageUrl,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update shelter image');
        }

        await fetchShelters();

        setSelectedShelter((prev) =>
          prev ? { ...prev, image: uploadedImageUrl } : null
        );
      } catch {
        Alert.alert('Error', 'Failed to upload image.');
      } finally {
        setIsImageUploading(false);
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
        <TouchableOpacity style={styles.refreshButton} onPress={refreshLocation}>
  <Text style={styles.refreshButtonText}>רענן את מיקומך</Text>
</TouchableOpacity>

          {shelters.map((shelter) => (
            <CustomMarker
              key={`${shelter.id}-${shelter.status}`}
              shelter={shelter}
              onPress={() => setSelectedShelter(shelter)}
            />
          ))}
        </MapView>
        {alerts.length > 0 && (
  <View style={styles.alertsContainer}>
    <Text style={styles.alertsTitle}>📢 התראות אחרונות</Text>
    {alerts.slice(0, 5).map((alert) => (
      <View key={alert.id} style={styles.alertItem}>
        <Text style={styles.alertIcon}>🚨</Text>
        <View style={styles.alertTextContainer}>
          <Text style={styles.alertDescription}>{alert.description}</Text>
          <Text style={styles.alertTime}>{alert.time}</Text>
        </View>
      </View>
    ))}
  </View>
)}


        {selectedShelter && (
  <>
    <View style={styles.selectedShelter}>
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
      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleAddImage}
        disabled={isImageUploading}
      >
        {isImageUploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.actionButtonText}>הוסף תמונה</Text>
        )}
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
  imageLoaderOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -10,
    marginTop: -10,
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
  alertsContainer: {
    backgroundColor: '#f9f9f9',
    marginHorizontal: 10,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  
  alertsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'right',
    color: '#333',
  },
  
  alertItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  
  alertIcon: {
    fontSize: 22,
    marginLeft: 10,
  },
  
  alertTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  
  alertDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: '#444',
    marginBottom: 2,
  },
  
  alertTime: {
    fontSize: 13,
    color: '#888',
  },  
});

export default HomeScreen;