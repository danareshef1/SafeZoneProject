import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Alert,
  ActivityIndicator,
  TouchableWithoutFeedback,
  TouchableOpacity,
  ScrollView,
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
import { sendLocationToBackend } from '../../utils/api'; 
import { Ionicons } from '@expo/vector-icons';


const API_URL = 'https://d6jaqmxif9.execute-api.us-east-1.amazonaws.com/shelters';

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
    date: string;
    time: string;
    descriptions: string[];
    expanded?: boolean;
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
  
      const grouped: Record<string, Alarm> = {};
  
      body.forEach((item: any, index: number) => {
        const timestamp = new Date(item.timestamp);
  
        const formatter = new Intl.DateTimeFormat('he-IL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Jerusalem',
          hour12: false,
        });
  
        const [dateIL, timeIL] = formatter.format(timestamp).split(',').map(s => s.trim());
        const key = `${dateIL} ${timeIL}`; // קיבוץ לפי תאריך+שעה
  
        if (!grouped[key]) {
          grouped[key] = {
            id: index.toString(),
            date: dateIL,
            time: timeIL,
            descriptions: [],
            expanded: false,
          };
        }
  
        grouped[key].descriptions.push(`${item.city}`);
      });
      const groupedAlerts = Object.values(grouped).sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split('.');
        const [dayB, monthB, yearB] = b.date.split('.');
      
        const formatTime = (time: string) => {
          const [h, m] = time.split(':');
          return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        };
      
        const dateStrA = `${yearA}-${monthA}-${dayA}T${formatTime(a.time)}`;
        const dateStrB = `${yearB}-${monthB}-${dayB}T${formatTime(b.time)}`;
      
        const dateA = new Date(dateStrA);
        const dateB = new Date(dateStrB);
      
        return dateB.getTime() - dateA.getTime(); // מהחדש לישן
      });
      
      console.log(groupedAlerts.map(a => `${a.date} ${a.time}`));

      
      setAlerts(groupedAlerts);
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
      'https://nt66vuij24.execute-api.us-east-1.amazonaws.com/getSignedUploadUrl',
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
          <View style={[styles.alertsContainer, { maxHeight: 250 }]}>
  <Text style={styles.alertsTitle}>📢 התראות אחרונות</Text>
  <View style={{ flexGrow: 1 }}>
    <ScrollView>
    {alerts.map((alert, idx) => {
  const isMultiple = alert.descriptions.length > 1;
  const Container = isMultiple ? TouchableOpacity : View;

  return (
    <Container
      key={alert.id}
      style={styles.alertItem}
      {...(isMultiple && {
        onPress: () =>
          setAlerts((prev) =>
            prev.map((a, i) => ({
              ...a,
              expanded: i === idx ? !a.expanded : false,
            }))
          ),
      })}
    >
      <Text style={styles.alertIcon}>🚨</Text>
      <View style={[styles.alertTextContainer, { flexDirection: 'row-reverse', alignItems: 'center' }]}>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
          {isMultiple && alert.expanded ? (
            alert.descriptions.map((desc, i) => (
              <Text key={i} style={styles.alertDescription}>
                {desc}
              </Text>
            ))
          ) : (
            <Text style={styles.alertDescription}>
              {isMultiple
                ? `${alert.descriptions.length} איזורי התרעה`
                : alert.descriptions[0]}
            </Text>
          )}
<Text style={styles.alertTime}>{alert.date} - {alert.time}</Text>
</View>
        {isMultiple && (
          <Ionicons
  name={alert.expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
  size={20}
  color="#666"
  style={{ marginRight: 10, alignSelf: 'flex-start' }}
/>

        )}
      </View>
    </Container>
  );
})}


    </ScrollView>
  </View>
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
  refreshButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#11998e',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
});

export default HomeScreen;