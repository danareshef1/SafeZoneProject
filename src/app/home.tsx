// app/home.tsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
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
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import ShelterListItem from '../components/ui/Map/ShelterListItem';
import CustomMarker from '../components/ui/Map/CustomMarker';
import { Shelter } from '../types/Shelter';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { sendLocationToBackend } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import proj4 from 'proj4';
import { Animated } from 'react-native';

const API_URL = 'https://ud6fou77q6.execute-api.us-east-1.amazonaws.com/prod/get-il-shelters';

proj4.defs(
  'EPSG:2039',
  '+proj=tmerc +lat_0=31.7343938888889 +lon_0=35.2045169444444 '
  + '+k=1.0000067 +x_0=219529.584 +y_0=626907.39 '
  + '+ellps=GRS80 +units=m +no_defs'
);

const sampleE = 179254.9219000004; 
const sampleN = 665111.2525999993;  
const targetLat = 32.0785788989309; 
const targetLon = 34.7786417155005;

const [invE, invN] = proj4(
  'EPSG:4326',
  'EPSG:2039',
  [ targetLon, targetLat ]   
);

const deltaE = invE - sampleE;
const deltaN = invN - sampleN;

const mapRef = useRef<MapView | null>(null);

function convertITMtoWGS84(easting: number, northing: number) {
  const correctedE = easting + deltaE;
  const correctedN = northing + deltaN;

  const [lon, lat] = proj4('EPSG:2039', 'EPSG:4326', [correctedE, correctedN]);
  return { latitude: lat, longitude: lon };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // מטרים
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return distance; // במטרים
}

type Alarm = {
  id: string;
  date: string;
  time: string;
  descriptions: string[];
  expanded?: boolean;
};

const HomeScreen: React.FC = () => {
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);

  const [allShelters, setAllShelters] = useState<Shelter[]>([]);
  const [sheltersToShow, setSheltersToShow] = useState<Shelter[]>([]);
  const LOAD_COUNT = 100;  // כמה להוסיף בכל פעם

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
  const [isSheltersLoading, setIsSheltersLoading] = useState(true);

  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const scaleAnim = useMemo(() => new Animated.Value(0.8), []);
  const pulseAnim = useMemo(() => new Animated.Value(1), []);
  const [rawShelters, setRawShelters] = useState<Shelter[]>([]);
  
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
        const key = `${dateIL} ${timeIL}`;

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

        return new Date(dateStrB).getTime() - new Date(dateStrA).getTime();
      });

      setAlerts(groupedAlerts);
    } catch (error) {
      console.error('שגיאה בקבלת התראות:', error);
    }
  };
  useEffect(() => {
    const findNearestShelter = async () => {
      try {
        const allShelters: Shelter[] = rawShelters;
if (allShelters.length === 0) {
    console.warn('אין מקלטים זמינים כרגע');
    return;
}
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.error('❌ הרשאת מיקום נדחתה');
          return;
        }
        const location = await Location.getCurrentPositionAsync({});
        const userLat = location.coords.latitude;
        const userLon = location.coords.longitude;
  
        let minDistance = Infinity;
        let closestShelter = null;
  
        allShelters.forEach((shelter) => {
          const x = shelter.longitude;
          const y = shelter.latitude;
          const { latitude, longitude } = convertITMtoWGS84(x, y);
          
        
          const distance = getDistanceFromLatLonInKm(userLat, userLon, latitude, longitude);
        
          if (distance < minDistance) {
            minDistance = distance;
            closestShelter = { ...shelter, latitude, longitude, distance };
          }
        });
  
        if (closestShelter) {
          console.log('🏠 המקלט הקרוב ביותר הוא:', closestShelter);
          try {
              await AsyncStorage.setItem('nearestShelter', JSON.stringify(closestShelter));
              console.log('✅ nearestShelter נשמר ב־AsyncStorage');
          } catch (e) {
              console.error('❌ שגיאה בשמירה ל־AsyncStorage:', e);
          }
      }
      
      
      } catch (err) {
        console.error('❌ שגיאה במציאת המקלט הקרוב:', err);
      }
    };
    }, []);
  
  
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

  const fetchShelters = async () => {
    setIsSheltersLoading(true);
    try {
      let allShelters: Shelter[] = [];
      let startKey: any = null;

      do {
        const url = startKey ? `${API_URL}?startKey=${encodeURIComponent(JSON.stringify(startKey))}` : API_URL;
        const response = await fetch(url);
        const data = await response.json();
        allShelters = [...allShelters, ...data.items];
        startKey = data.lastEvaluatedKey || null;
      } while (startKey);

      const convertedShelters = allShelters
        .map((shelter) => {
          const x = shelter.longitude;
          const y = shelter.latitude;
          const { latitude, longitude } = convertITMtoWGS84(x, y);
          return { ...shelter, latitude, longitude } as Shelter;
        })
        .filter(s => !isNaN(s.latitude) && !isNaN(s.longitude));


    if (mapRegion) {
      convertedShelters.sort((a, b) => {
        const distA = calculateDistance(mapRegion.latitude, mapRegion.longitude, a.latitude, a.longitude);
        const distB = calculateDistance(mapRegion.latitude, mapRegion.longitude, b.latitude, b.longitude);
        return distA - distB;
      });
    }

    setRawShelters(convertedShelters);
    
      //setShelters(convertedShelters);
      await AsyncStorage.setItem('shelters', JSON.stringify(convertedShelters));
    } catch (error) {
      console.error('Error fetching shelters:', error);
      Alert.alert('Error', 'Unable to fetch shelter data.');
    } finally {
      setIsSheltersLoading(false);
    }  
  };

 // ✅ תוקן כך שיחפש את המקלט הקרוב רק אחרי שכל המקלטים נטענו

useEffect(() => {
  (async () => {
      try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Permission to access location was denied.');
              setMapRegion({
                  latitude: 32.0853,
                  longitude: 34.7818,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.005,
              });
          } else {
              const location = await Location.getCurrentPositionAsync({});
              setMapRegion({
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.005,
              });
              await sendLocationToBackend(location.coords.latitude, location.coords.longitude);
          }

          await fetchShelters();
          await fetchAlerts();
      } catch (error) {
          console.error('Error during initial loading:', error);
          Alert.alert('Error', 'Failed to load initial data.');
      }
  })();
}, []);

// ✅ אפקט חדש שרץ כשהמקלטים נטענים
useEffect(() => {
  if (rawShelters.length === 0) return;

  const findNearestShelter = async () => {
      try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
              console.error('❌ הרשאת מיקום נדחתה');
              return;
          }
          const location = await Location.getCurrentPositionAsync({});
          const userLat = location.coords.latitude;
          const userLon = location.coords.longitude;

          let minDistance = Infinity;
          let closestShelter = null;

          rawShelters.forEach((shelter) => {
              const { latitude, longitude } = shelter;  // לא צריך המרה נוספת

              const distance = getDistanceFromLatLonInKm(userLat, userLon, latitude, longitude);

              if (distance < minDistance) {
                  minDistance = distance;
                  closestShelter = { ...shelter, distance };
              }
          });

          if (closestShelter) {
            console.log('🏠 המקלט הקרוב ביותר הוא:', closestShelter);
            try {
                await AsyncStorage.setItem('nearestShelter', JSON.stringify(closestShelter));
                console.log('✅ nearestShelter נשמר ב־AsyncStorage');
            } catch (e) {
                console.error('❌ שגיאה בשמירה ל־AsyncStorage:', e);
            }
        }
        
      } catch (err) {
          console.error('❌ שגיאה במציאת המקלט הקרוב:', err);
      }
  };

  findNearestShelter();
}, [rawShelters]);


  useEffect(() => {
    if (!isSheltersLoading && mapRegion) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.8,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();      
    }
  }, [isSheltersLoading, mapRegion]);
  
  useEffect(() => {
    if (mapRegion && rawShelters.length > 0) {
      const sorted = [...rawShelters].sort((a, b) => {
        const distA = calculateDistance(mapRegion.latitude, mapRegion.longitude, a.latitude, a.longitude);
        const distB = calculateDistance(mapRegion.latitude, mapRegion.longitude, b.latitude, b.longitude);
        return distA - distB;
      });
      setAllShelters(sorted);
      setSheltersToShow(sorted.slice(0, LOAD_COUNT));  // נציג רק את הראשונים בהתחלה
          } else if (rawShelters.length > 0) {
      // אם אין עדיין מיקום, תראה אותם כמות שהם
      setAllShelters(rawShelters);
      setSheltersToShow(rawShelters.slice(0, LOAD_COUNT));
    }
  }, [mapRegion, rawShelters]);

  const loadMoreShelters = () => {
    if (sheltersToShow.length >= allShelters.length) return;  // אין עוד מה להוסיף
  
    const nextItems = allShelters.slice(
      sheltersToShow.length,
      sheltersToShow.length + LOAD_COUNT
    );
    
    setSheltersToShow((prev) => [...prev, ...nextItems]);
  };
  
const handleReport = () => {
  if (selectedShelter) {
    router.push({
      pathname: '/report-shelter/[id]',
      params: { 
        id: selectedShelter.id,
        name: selectedShelter.name,
        location: selectedShelter.location,
        image: selectedShelter.image,
      },
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
      latitudeDelta: 0.01,
      longitudeDelta: 0.005,
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

const handleDeselectShelter: () => void = () => setSelectedShelter(null);

if (!mapRegion) {
  return (
    <View style={styles.loadingOverlay}>
    <ActivityIndicator size="large" color="'#11998e'" />
    <Text style={{ marginTop: 10 }}>Loading shelters...</Text>
  </View>
  );
}


return (
  <TouchableWithoutFeedback onPress={handleDeselectShelter}>
      <View style={{ flex: 1 }}>
      <Animated.View
  style={[
    styles.container,
    {
      opacity: fadeAnim,
      transform: [{ scale: scaleAnim }],
    },
  ]}
>
      <View style={styles.container}>
      <MapView   ref={mapRef} style={styles.map} region={mapRegion}>
        <TouchableOpacity style={styles.refreshButton} onPress={refreshLocation}>
          <Text style={styles.refreshButtonText}>רענן את מיקומך</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.centerButton} onPress={() => {
  if (mapRegion) {
    mapRef.current?.animateToRegion(mapRegion, 1000);
  }
}}>
  <Ionicons name="locate-outline" size={24} color="#fff" />
</TouchableOpacity>


  {/* מיקום שלי */}
  <Marker coordinate={{ latitude: mapRegion.latitude, longitude: mapRegion.longitude }}>
  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View style={{
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(17,153,142,0.3)',
      transform: [{ scale: pulseAnim }],
    }} />
  </View>
</Marker>

  
        {allShelters.map((shelter) => (
          <CustomMarker
            key={`${shelter.id}-${shelter.status}`}
            shelter={shelter}
            onPress={() => {
              setSelectedShelter(shelter);
            }}
            
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
  <Animated.View style={styles.shelterInfoBox}>
    <View style={styles.shelterHeader}>
      <Ionicons name="home-outline" size={28} color="#11998e" style={{ marginRight: 10 }} />
      <Text style={styles.shelterTitle}>{selectedShelter.name}</Text>
    </View>

    <View style={styles.shelterDetails}>
      {selectedShelter.location && (
        <Text style={styles.locationText}>{selectedShelter.location}</Text>
      )}
    </View>

    <View style={styles.buttonRowInline}>
      <TouchableOpacity style={styles.actionButtonInline} onPress={handleReport}>
        <Ionicons name="warning-outline" size={18} color="#fff" style={{ marginRight: 5 }} />
        <Text style={styles.actionButtonTextInline}>דווח</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.actionButtonInline}
        onPress={handleAddImage}
        disabled={isImageUploading}
      >
        {isImageUploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="image-outline" size={18} color="#fff" style={{ marginRight: 5 }} />
            <Text style={styles.actionButtonTextInline}>הוסף תמונה</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  </Animated.View>
)}


      <BottomSheet index={0} snapPoints={snapPoints}>
        <View style={styles.contentContainer}>
          <Text style={styles.listTitle}>Over {allShelters.length} shelters</Text>
          <BottomSheetFlatList
              data={sheltersToShow}
              onEndReached={loadMoreShelters}
              onEndReachedThreshold={0.5}  // תוכל לשחק עם זה כדי לטעון לפני שמגיעים לסוף
              contentContainerStyle={{ gap: 10, padding: 10 }}
            renderItem={({ item }) => (
              <ShelterListItem
  shelter={item}
  containerStyle={{}}
  distance={
    mapRegion
      ? Math.round(
          calculateDistance(
            mapRegion.latitude,
            mapRegion.longitude,
            item.latitude,
            item.longitude
          )
        )
      : null
  }
/>

            )}
          />
        </View>
      </BottomSheet>
    </View>
    </Animated.View>
    {isSheltersLoading && (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="'#11998e'" />
        <Text style={{ marginTop: 10 }}>Loading shelters...</Text>
      </View>
    )}
      </View>
  </TouchableWithoutFeedback>
);
};


const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '50%' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  alertIcon: { fontSize: 22, marginLeft: 10 },
  alertTextContainer: { flex: 1, alignItems: 'flex-end', flexDirection: 'row-reverse' },
  alertDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: '#444',
    marginBottom: 2,
  },
  alertTime: { fontSize: 13, color: '#888' },
  selectedShelter: { position: 'absolute', bottom: 120, right: 10, left: 10 },
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(176, 255, 247, 0.7)', 
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },  
  centerButton: {
    position: 'absolute',
    top: 80,
    right: 20,
    backgroundColor: '#11998e',
    padding: 10,
    borderRadius: 25,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  shelterInfoBox: {
    position: 'absolute',
    top: 120,  // אפשר לשחק עם זה עד שזה במקום טוב
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 15,
  },
  
  shelterHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 10,
  },
  
  shelterTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flexShrink: 1,
    textAlign: 'right',
  },
  
  shelterDetails: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    marginBottom: 15,
  },
  
  locationText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'right',
  },
  
  buttonRowInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  
  actionButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#11998e',
    paddingVertical: 10,
    justifyContent: 'center',
    borderRadius: 8,
  },
  
  actionButtonTextInline: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  
});

export default HomeScreen;