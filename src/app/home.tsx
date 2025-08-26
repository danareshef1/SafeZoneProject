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
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { sendLocationToBackend } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import proj4 from 'proj4';
import { Animated } from 'react-native';
import * as Contacts from 'expo-contacts';
import { getUserEmail } from '../../utils/auth';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

/**
 * HomeScreen — UPDATED
 *  - Single bootstrap pipeline (serial) to avoid spikes of parallel Lambda invocations
 *  - Keeps UX and features intact
 *  - Adds small caches and defensive guards
 */

const API_URL_SHELTERS = 'https://naxldowhfc.execute-api.us-east-1.amazonaws.com/get-il-shelters';
const API_URL_ALERTS   = 'https://j5tn0rj9rc.execute-api.us-east-1.amazonaws.com/prod/alerts';
const API_URL_HOSPITALS = 'https://p7543alg74.execute-api.us-east-1.amazonaws.com/prod/hospitals';
const API_URL_SIGNED   = 'https://bct0wzeaba.execute-api.us-east-1.amazonaws.com/sign-upload';

// ---- Projections (ITM/EPSG:2039 ↔ WGS84) ----
proj4.defs(
  'EPSG:2039',
  '+proj=tmerc +lat_0=31.7343938888889 +lon_0=35.2045169444444 '
  + '+k=1.0000067 +x_0=219529.584 +y_0=626907.39 '
  + '+ellps=GRS80 +units=m +no_defs'
);

// Calibration (as in your original file)
const sampleE = 179254.9219000004;
const sampleN = 665111.2525999993;
const targetLat = 32.0785788989309;
const targetLon = 34.7786417155005;
const [invE, invN] = proj4('EPSG:4326','EPSG:2039',[ targetLon, targetLat ]);
const deltaE = invE - sampleE;
const deltaN = invN - sampleN;

function convertITMtoWGS84(easting: number, northing: number) {
  const correctedE = easting + deltaE;
  const correctedN = northing + deltaN;
  const [lon, lat] = proj4('EPSG:2039', 'EPSG:4326', [correctedE, correctedN]);
  return { latitude: lat, longitude: lon };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlmb = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlmb / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // meters
}

function kmDistance(lat1:number, lon1:number, lat2:number, lon2:number) {
  return calculateDistance(lat1, lon1, lat2, lon2) / 1000;
}

// ---- Types ----
 type Alarm = {
  id: string;
  date: string;
  time: string;
  descriptions: string[];
  expanded?: boolean;
};

const HOME_RADIUS_METERS = 50;
const LOAD_COUNT = 100;

// Small caches to avoid repeated network calls
let hospitalsCache: { data: any[]; fetchedAt: number } | null = null;
const HOSP_TTL_MS = 10 * 60 * 1000;

async function fetchHospitalsCached(): Promise<any[]> {
  const now = Date.now();
  if (hospitalsCache && now - hospitalsCache.fetchedAt < HOSP_TTL_MS) return hospitalsCache.data;
  const res = await fetch(API_URL_HOSPITALS);
  const data = await res.json();
  hospitalsCache = { data, fetchedAt: now };
  return data;
}

const HomeScreen: React.FC = () => {
  // ---- Map & UI state ----
  const [mapRegion, setMapRegion] = useState<null | {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }>(null);

  const [isSheltersLoading, setIsSheltersLoading] = useState(true);
  const [rawShelters, setRawShelters] = useState<Shelter[]>([]);
  const [allShelters, setAllShelters] = useState<Shelter[]>([]);
  const [sheltersToShow, setSheltersToShow] = useState<Shelter[]>([]);
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [alerts, setAlerts] = useState<Alarm[]>([]);

  const mapRef = useRef<MapView | null>(null);
  const router = useRouter();

  // ---- Animations ----
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const scaleAnim = useMemo(() => new Animated.Value(0.8), []);
  const pulseAnim = useMemo(() => new Animated.Value(1), []);
  const snapPoints = useMemo(() => ['8%', '50%', '90%'], []);

  // ---- Bootstrap: SERIAL pipeline then parallel batch ----
  useEffect(() => {
    (async () => {
      try {
        // (1) Push permissions + send Expo token (serial)
        const email = await getUserEmail();
        await refreshAndSendExpoPushToken(email);

        // (2) Get location (serial)
        let lat = 32.0853, lon = 34.7818; // Tel Aviv fallback
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const here = await Location.getCurrentPositionAsync({});
          lat = here.coords.latitude; lon = here.coords.longitude;
        } else {
          Alert.alert('Permission Denied', 'Permission to access location was denied. Using default location.');
        }
        setMapRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.01, longitudeDelta: 0.005 });

        // (4) Parallel group (after the above steps finished)
        await Promise.all([
          fetchShelters(lat, lon),
          fetchAlerts(),
          storeNearestHospital(lat, lon),
          storeRegisteredContacts(),
          checkIfUserAtHome(),
        ]);

        // (5) Start UI animations
        if (mapRegion || true) {
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
          ]).start();
          Animated.loop(
            Animated.sequence([
              Animated.timing(pulseAnim, { toValue: 1.8, duration: 1000, useNativeDriver: true }),
              Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
          ).start();
        }
      } catch (e) {
        console.error('Error during bootstrap:', e);
        Alert.alert('Error', 'Failed to load initial data.');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Helpers ----
  const refreshAndSendExpoPushToken = async (email: string | null) => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const res = await Notifications.requestPermissionsAsync();
        if (res.status !== 'granted') {
          console.warn('❌ הרשאות התראות לא אושרו');
          return;
        }
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: (Constants as any).expoConfig?.extra?.eas?.projectId,
      });
      const expoToken = tokenData.data;

      // store locally only if changed
      const prev = await AsyncStorage.getItem('expoPushToken');
      if (prev !== expoToken) {
        await AsyncStorage.setItem('expoPushToken', expoToken);
        if (email) {
          await fetch('https://jlsl54dmzl.execute-api.us-east-1.amazonaws.com/saveToken', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, expoToken }),
          });
        }
      }
    } catch (err) {
      console.warn('❌ שגיאה בשליחת expoPushToken:', err);
    }
  };

  const storeRegisteredContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') return;

      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
      const phoneNumbers = data
        .flatMap((c) => c.phoneNumbers || [])
        .map((p) => p.number?.replace(/\D/g, ''))
        .filter((num) => !!num);

      const response = await fetch('https://rudac13hpb.execute-api.us-east-1.amazonaws.com/GetRegisteredContacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumbers }),
      });

      const json = await response.json();
      const result = json.registeredNumbers;
      await AsyncStorage.setItem('registeredContacts', JSON.stringify(result));
    } catch (error) {
      console.error(' שגיאה בשמירת אנשי קשר:', error);
    }
  };

  const checkIfUserAtHome = async () => {
    try {
      const homeLocationJson = await AsyncStorage.getItem('homeLocation');
      if (!homeLocationJson) return;
      const homeLocation = JSON.parse(homeLocationJson);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const current = await Location.getCurrentPositionAsync({});
      const dist = calculateDistance(
        current.coords.latitude,
        current.coords.longitude,
        homeLocation.latitude,
        homeLocation.longitude
      );

      const isAtHome = dist <= HOME_RADIUS_METERS;
      await AsyncStorage.setItem('isAtHome', JSON.stringify(isAtHome));
      console.log('מרחק מהמיקום שנשמר לבית:', dist);
      console.log('isAtHome?', isAtHome);
    } catch (err) {
      console.error(' שגיאה בבדיקת האם המשתמש בבית:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch(API_URL_ALERTS);
      const rawData = await response.json();
      const body = typeof rawData.body === 'string' ? JSON.parse(rawData.body) : rawData.body ?? rawData;
      if (!Array.isArray(body)) return;

      const grouped: Record<string, Alarm> = {};
      body.forEach((item: any, index: number) => {
        const timestamp = new Date(item.timestamp);
        const formatter = new Intl.DateTimeFormat('he-IL', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
          timeZone: 'Asia/Jerusalem', hour12: false,
        });
        const [dateIL, timeIL] = formatter.format(timestamp).split(',').map((s) => s.trim());
        const key = `${dateIL} ${timeIL}`;
        if (!grouped[key]) {
          grouped[key] = { id: index.toString(), date: dateIL, time: timeIL, descriptions: [], expanded: false };
        }
        grouped[key].descriptions.push(`${item.city}`);
      });

      const groupedAlerts = Object.values(grouped).sort((a, b) => {
        const [dA, mA, yA] = a.date.split('.');
        const [dB, mB, yB] = b.date.split('.');
        const f = (t: string) => {
          const [h, m] = t.split(':');
          return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        };
        const A = new Date(`${yA}-${mA}-${dA}T${f(a.time)}`);
        const B = new Date(`${yB}-${mB}-${dB}T${f(b.time)}`);
        return B.getTime() - A.getTime();
      });

      setAlerts(groupedAlerts);
    } catch (error) {
      console.error('שגיאה בקבלת התראות:', error);
    }
  };

  const fetchShelters = async (latRef?: number, lonRef?: number) => {
    setIsSheltersLoading(true);
    try {
      let items: Shelter[] = [];
      let startKey: any = null;
      do {
        const url = startKey ? `${API_URL_SHELTERS}?startKey=${encodeURIComponent(JSON.stringify(startKey))}` : API_URL_SHELTERS;
        const response = await fetch(url);
        const data = await response.json();
        items = [...items, ...data.items];
        startKey = data.lastEvaluatedKey || null;
      } while (startKey);

      const converted = items
        .map((shelter) => {
          const x = shelter.longitude; // ITM X
          const y = shelter.latitude;  // ITM Y
          const { latitude, longitude } = convertITMtoWGS84(x, y);
          return { ...shelter, latitude, longitude } as Shelter;
        })
        .filter((s) => !isNaN(s.latitude) && !isNaN(s.longitude));

      // Optional sorting by distance to current region
      let region = mapRegion;
      if (!region && latRef && lonRef) {
        region = { latitude: latRef, longitude: lonRef, latitudeDelta: 0.01, longitudeDelta: 0.005 };
      }

      if (region) {
        converted.sort((a, b) => {
          const da = calculateDistance(region!.latitude, region!.longitude, a.latitude, a.longitude);
          const db = calculateDistance(region!.latitude, region!.longitude, b.latitude, b.longitude);
          return da - db;
        });
      }

      setRawShelters(converted);
      setAllShelters(converted);
      setSheltersToShow(converted.slice(0, LOAD_COUNT));
      await AsyncStorage.setItem('shelters', JSON.stringify(converted));
    } catch (error) {
      console.error('Error fetching shelters:', error);
      Alert.alert('Error', 'Unable to fetch shelter data.');
    } finally {
      setIsSheltersLoading(false);
    }
  };

  const storeNearestHospital = async (lat: number, lon: number) => {
    try {
      const hospitals = await fetchHospitalsCached();
      if (!Array.isArray(hospitals) || hospitals.length === 0) return;
      const nearest = hospitals
        .map((h: any) => ({ ...h, distance: kmDistance(lat, lon, h.lat, h.lon) }))
        .sort((a: any, b: any) => a.distance - b.distance)[0];
      if (nearest) {
        await AsyncStorage.setItem('nearestHospital', JSON.stringify({
          id: nearest.name,
          name: nearest.name,
          latitude: nearest.lat,
          longitude: nearest.lon,
          phone: nearest.phone,
        }));
      }
    } catch (err) {
      console.error('שגיאה בשמירת בית חולים קרוב:', err);
    }
  };

  const handleSaveHomeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const home = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      await AsyncStorage.setItem('homeLocation', JSON.stringify(home));
      await sendLocationToBackend(home.latitude, home.longitude, 'home');
      Alert.alert('Success', 'Home location saved successfully!');
    } catch (error) {
      console.error('Error saving home location:', error);
      Alert.alert('Error', 'Failed to save home location.');
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
      await sendLocationToBackend(location.coords.latitude, location.coords.longitude);
      Alert.alert('Success', 'Location refreshed!');
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location.');
      console.error('Error refreshing location:', error);
    }
  };

  const getSignedUploadUrl = async (type: 'shelter') => {
    const response = await fetch(API_URL_SIGNED, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    if (!response.ok) throw new Error('Failed to get signed URL');
    return await response.json();
  };

  const uploadImageToS3 = async (localUri: string, type: 'shelter') => {
    const { uploadUrl, imageUrl } = await getSignedUploadUrl(type);
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    const buffer = Buffer.from(base64, 'base64');
    await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: buffer });
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
        const response = await fetch(`${API_URL_SHELTERS}/${selectedShelter.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: uploadedImageUrl }),
        });
        if (!response.ok) throw new Error('Failed to update shelter image');
        await fetchShelters();
        setSelectedShelter((prev) => (prev ? { ...prev, image: uploadedImageUrl } : null));
      } catch {
        Alert.alert('Error', 'Failed to upload image.');
      } finally {
        setIsImageUploading(false);
      }
    }
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

  const loadMoreShelters = () => {
    if (sheltersToShow.length >= allShelters.length) return;
    const nextItems = allShelters.slice(sheltersToShow.length, sheltersToShow.length + LOAD_COUNT);
    setSheltersToShow((prev) => [...prev, ...nextItems]);
  };

  const handleDeselectShelter: () => void = () => setSelectedShelter(null);

  // ---- Render ----
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
        <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.container}>
            <MapView ref={mapRef} style={styles.map} region={mapRegion}>
              <TouchableOpacity style={styles.refreshButton} onPress={refreshLocation}>
                <Text style={styles.refreshButtonText}>רענן את מיקומך</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveHomeButton} onPress={handleSaveHomeLocation}>
                <Text style={styles.refreshButtonText}>שמור מיקום בית</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.centerButton} onPress={() => { if (mapRegion) { mapRef.current?.animateToRegion(mapRegion, 1000); } }}>
                <Ionicons name="locate-outline" size={24} color="#fff" />
              </TouchableOpacity>

              {/* My location */}
              <Marker coordinate={{ latitude: mapRegion.latitude, longitude: mapRegion.longitude }}>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Animated.View style={{
                    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(17,153,142,0.3)',
                    transform: [{ scale: pulseAnim }],
                  }} />
                </View>
              </Marker>

              {allShelters.map((shelter) => (
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
                      const Container: any = isMultiple ? TouchableOpacity : View;
                      return (
                        <Container
                          key={alert.id}
                          style={styles.alertItem}
                          {...(isMultiple && {
                            onPress: () => setAlerts((prev) => prev.map((a, i) => ({ ...a, expanded: i === idx ? !a.expanded : false }))),
                          })}
                        >
                          <Text style={styles.alertIcon}>🚨</Text>
                          <View style={[styles.alertTextContainer, { flexDirection: 'row-reverse', alignItems: 'center' }]}>
                            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                              {isMultiple && alert.expanded ? (
                                alert.descriptions.map((desc, i) => (
                                  <Text key={i} style={styles.alertDescription}>{desc}</Text>
                                ))
                              ) : (
                                <Text style={styles.alertDescription}>
                                  {isMultiple ? `${alert.descriptions.length} איזורי התרעה` : alert.descriptions[0]}
                                </Text>
                              )}
                              <Text style={styles.alertTime}>{alert.date} - {alert.time}</Text>
                            </View>
                            {isMultiple && (
                              <Ionicons name={alert.expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color="#666" style={{ marginRight: 10, alignSelf: 'flex-start' }} />
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
                <View className="shelterDetails">
                  {selectedShelter.location && <Text style={styles.locationText}>{selectedShelter.location}</Text>}
                </View>
                <View style={styles.buttonRowInline}>
                  <TouchableOpacity style={styles.actionButtonInline} onPress={handleReport}>
                    <Ionicons name="warning-outline" size={18} color="#fff" style={{ marginRight: 5 }} />
                    <Text style={styles.actionButtonTextInline}>דווח</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButtonInline} onPress={handleAddImage} disabled={isImageUploading}>
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
                  onEndReachedThreshold={0.5}
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

// ---- Styles ----
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
  alertsTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'right', color: '#333' },
  alertItem: {
    flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#e74c3c',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  alertIcon: { fontSize: 22, marginLeft: 10 },
  alertTextContainer: { flex: 1, alignItems: 'flex-end', flexDirection: 'row-reverse' },
  alertDescription: { fontSize: 15, fontWeight: '500', color: '#444', marginBottom: 2 },
  alertTime: { fontSize: 13, color: '#888' },
  selectedShelter: { position: 'absolute', bottom: 120, right: 10, left: 10 },
  refreshButton: {
    position: 'absolute', top: 20, right: 20, backgroundColor: '#11998e', paddingVertical: 10,
    paddingHorizontal: 16, borderRadius: 25, zIndex: 10, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },
  refreshButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  contentContainer: { flex: 1 },
  listTitle: { textAlign: 'center', fontSize: 16, marginVertical: 5, marginBottom: 20 },
  imagePreviewContainer: { marginTop: 10, alignItems: 'center' },
  previewImage: { width: '100%', height: 150, borderRadius: 10, resizeMode: 'cover' },
  buttonRow: {
    position: 'absolute', bottom: 60, right: 10, left: 10, flexDirection: 'row', justifyContent: 'space-between',
    gap: 10, backgroundColor: 'white', padding: 10, borderRadius: 10, elevation: 5,
  },
  imageLoaderOverlay: { position: 'absolute', top: '50%', left: '50%', marginLeft: -10, marginTop: -10 },
  actionButton: { flex: 1, backgroundColor: '#11998e', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  reportButtonContainer: { position: 'absolute', bottom: 60, right: 10, left: 10, backgroundColor: 'white', padding: 10, borderRadius: 10, elevation: 5 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(176, 255, 247, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  centerButton: {
    position: 'absolute', top: 80, right: 20, backgroundColor: '#11998e', padding: 10, borderRadius: 25, zIndex: 10,
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },
  shelterInfoBox: {
    position: 'absolute', top: 120, left: 20, right: 20, backgroundColor: '#fff', borderRadius: 15, padding: 15,
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, zIndex: 15,
  },
  shelterHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
  shelterTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', flexShrink: 1, textAlign: 'right' },
  shelterDetails: { flexDirection: 'column', alignItems: 'flex-end', marginBottom: 15 },
  locationText: { fontSize: 14, color: '#666', marginTop: 5, textAlign: 'right' },
  buttonRowInline: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  actionButtonInline: {
    flexDirection: 'row', alignItems: 'center', flex: 1, backgroundColor: '#11998e', paddingVertical: 10,
    justifyContent: 'center', borderRadius: 8,
  },
  actionButtonTextInline: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  saveHomeButton: {
    position: 'absolute', top: 20, right: 280, backgroundColor: '#11998e', paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 25, zIndex: 10, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },
});

export default HomeScreen;
