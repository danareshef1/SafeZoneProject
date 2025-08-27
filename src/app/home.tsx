// src/app/home.tsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
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
import { sendLocationToBackend } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { Animated } from 'react-native';
import * as Contacts from 'expo-contacts';
import { getUserEmail } from '../../utils/auth';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';


/* ---------- Concurrency limiter: max 10 lambdas in parallel ---------- */
const MAX_LAMBDA_CONCURRENCY = 10;
let __active = 0;
const __queue: Array<() => void> = [];
async function __limit<T>(fn: () => Promise<T>): Promise<T> {
  if (__active >= MAX_LAMBDA_CONCURRENCY) {
    await new Promise<void>((res) => __queue.push(res));
  }
  __active++;
  try {
    return await fn();
  } finally {
    __active--;
    const next = __queue.shift();
    if (next) next();
  }
}
const lambdaFetch = (url: string, init?: RequestInit) => __limit(() => fetch(url, init));

/* -------------------- Helpers: עיר -------------------- */
const API_URL_USER_LOC = 'https://4rmea844n9.execute-api.us-east-1.amazonaws.com/get-user-location';

const normalizeCity = (name?: string | null) =>
  (name || '').replace(/\s+/g, ' ').replace(/[\"״]/g, '').trim() || null;

const detectCityName = async (lat: number, lon: number) => {
  try {
    const placemarks = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    const p = placemarks?.[0];
    const c = normalizeCity(p?.city || p?.subregion || p?.district || p?.region);
    return c;
  } catch {
    return null;
  }
};

const getCityFromServer = async (email: string | null) => {
  if (!email) return null;
  try {
    const res = await lambdaFetch(`${API_URL_USER_LOC}?email=${encodeURIComponent(email)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const body = typeof data?.body === 'string' ? JSON.parse(data.body) : (data?.body ?? data);
    const city = (body?.city || '').replace(/\s+/g, ' ').replace(/[\"״]/g, '').trim();
    return city || null;
  } catch {
    return null;
  }
};

/* -------------------- URLs -------------------- */
const API_URL_SHELTERS = 'https://naxldowhfc.execute-api.us-east-1.amazonaws.com/get-il-shelters';
const API_URL_ALERTS = 'https://rvx1waqqmj.execute-api.us-east-1.amazonaws.com/get-alerts-logs';
const API_URL_HOSPITALS = 'https://0p6zgldny2.execute-api.us-east-1.amazonaws.com/get-hospitals';
const API_URL_SIGNED = 'https://bct0wzeaba.execute-api.us-east-1.amazonaws.com/sign-upload';
const API_URL_SHELTER_ITEM = API_URL_SHELTERS.replace('/get-il-shelters', '/shelters');

/* -------------------- Distance helper -------------------- */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlmb = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlmb / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function kmDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  return calculateDistance(lat1, lon1, lat2, lon2) / 1000;
}

/* -------------------- Types & consts -------------------- */
type Alarm = {
  id: string;
  date: string;
  time: string;
  descriptions: string[];
  expanded?: boolean;
};
const HOME_RADIUS_METERS = 50;
const LOAD_COUNT = 100;

/* -------------------- Hospitals cache -------------------- */
let hospitalsCache: { data: any[]; fetchedAt: number } | null = null;
const HOSP_TTL_MS = 10 * 60 * 1000;
async function fetchHospitalsCached(): Promise<any[]> {
  const now = Date.now();
  if (hospitalsCache && now - hospitalsCache.fetchedAt < HOSP_TTL_MS) return hospitalsCache.data;
  const res = await lambdaFetch(API_URL_HOSPITALS);
  const raw = await res.json();
  const data = Array.isArray(raw) ? raw : (typeof raw?.body === 'string' ? JSON.parse(raw.body) : (raw?.body ?? raw));
  hospitalsCache = { data, fetchedAt: now };
  return data || [];
}

/* -------------------- City options (combobox) -------------------- */
const CITY_OPTIONS = [
  'תל אביב-יפו','ירושלים','חיפה','ראשון לציון','פתח תקווה','אשדוד','באר שבע','נתניה','חולון',
  'רמת גן','אשקלון','בת ים','חדרה','הרצליה','כפר סבא','ראש העין','מודיעין-מכבים-רעות','רחובות',
  'נהריה','טבריה','כרמיאל','רעננה','לוד','רמלה','בית שמש','גבעתיים','נס ציונה','קריית גת',
  'קריית מוצקין','קריית ים','קריית ביאליק','קריית אתא','אילת','עפולה','רמת השרון','קרית שמונה',
  'ביתר עילית','אלעד','מעלה אדומים','אריאל','אור עקיבא','כפר קאסם','הוד השרון','שוהם'
];

/* ==================== Component ==================== */
const HomeScreen: React.FC = () => {
  /* ---- Map & UI state ---- */
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

  // ---- City selection ----
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<string[]>(CITY_OPTIONS.slice(0, 30));
  const [currentLL, setCurrentLL] = useState<{ lat: number; lon: number } | null>(null);

  const mapRef = useRef<MapView | null>(null);
  const router = useRouter();
const suppressMapClearUntilRef = useRef<number>(0);

  /* ---- Animations ---- */
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const scaleAnim = useMemo(() => new Animated.Value(0.8), []);
  const pulseAnim = useMemo(() => new Animated.Value(1), []);
  const snapPoints = useMemo(() => ['8%', '50%', '90%'], []);

  useEffect(() => {
    if (!mapRegion) return;
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
  }, [mapRegion]);

  /* ---- Bootstrap ---- */
  useEffect(() => {
    (async () => {
      try {
        // 1) Push token
        const email = await getUserEmail();
        await refreshAndSendExpoPushToken(email);

        // 2) Location (עם שמירה ושליחה)
        let lat = 32.0853, lon = 34.7818; // TA fallback
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const here = await Location.getCurrentPositionAsync({});
          lat = here.coords.latitude;
          lon = here.coords.longitude;

          // שמירה ושליחת מיקום בכניסה
          await AsyncStorage.setItem('lastLocation', JSON.stringify({ latitude: lat, longitude: lon }));
          await AsyncStorage.setItem('lastLocationAt', new Date().toISOString());
          await sendLocationToBackend(lat, lon, 'login');
        } else {
          Alert.alert('Permission Denied', 'Permission to access location was denied. Using default location.');
        }
        setCurrentLL({ lat, lon });
        setMapRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.01, longitudeDelta: 0.005 });

        // 3) City: server → device → saved → default
        const serverCity = await getCityFromServer(email);
        const deviceCity = serverCity ? null : await detectCityName(lat, lon);
        const saved = await AsyncStorage.getItem('selectedCity');
        const initialCity = (saved && saved.trim()) || serverCity || deviceCity || 'תל אביב-יפו';
        setUserCity(deviceCity || serverCity);
        setSelectedCity(initialCity);

        // 4) Light things in parallel
        await Promise.allSettled([storeNearestHospital(lat, lon), storeRegisteredContacts(), checkIfUserAtHome()]);

        // 5) Alerts
        await fetchAlerts();
      } catch (e) {
        console.error('Error during bootstrap:', e);
        Alert.alert('Error', 'Failed to load initial data.');
      }
    })();
  }, []);

  /* ---- Fetch shelters when city changes ---- */
  useEffect(() => {
    if (selectedCity && currentLL) {
      fetchShelters(currentLL.lat, currentLL.lon, selectedCity);
      AsyncStorage.setItem('selectedCity', selectedCity);
      setSelectedShelter(null);
    }
  }, [selectedCity]);

  /* -------------------- Helpers -------------------- */
const handleMarkerPress = (s: Shelter) => {
  // אל תנקה את הכרטיס מה-Map onPress במשך 800ms
  suppressMapClearUntilRef.current = Date.now() + 800;
  setSelectedShelter(s);
  // אם תרצה גם להזיז את המפה למקלט:
   mapRef.current?.animateToRegion(
    { latitude: s.latitude, longitude: s.longitude, latitudeDelta: 0.01, longitudeDelta: 0.005 },
     300
   );
};


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
      const projectId =
        (Constants as any).expoConfig?.extra?.eas?.projectId || (Constants as any).easConfig?.projectId;
      const tokenData = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
      const expoToken = tokenData.data;

      const prev = await AsyncStorage.getItem('expoPushToken');
      if (prev !== expoToken) {
        await AsyncStorage.setItem('expoPushToken', expoToken);
        if (email) {
          await lambdaFetch('https://jlsl54dmzl.execute-api.us-east-1.amazonaws.com/saveToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, expoToken }),
          });
        }
      }
    } catch (err) {
      console.warn('❌ שגיאה בשליחת expoPushToken:', err);
    }
  };

  // helper normalization, זהה ל־Lambda
function normPhone(p: string) {
  const d = (p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0') && d.length >= 9) return '+972' + d.slice(1);
  if (d.startsWith('972')) return '+' + d;
  if ((p || '').trim().startsWith('+')) return (p || '').trim();
  return '+' + d;
}

const storeRegisteredContacts = async () => {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return;

    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
    const phoneNumbers = data
      .flatMap((c) => c.phoneNumbers || [])
      .map((p) => (p.number || '').replace(/\D/g, ''))
      .map(normPhone)   
      .filter(Boolean);

    const response = await lambdaFetch(
      'https://rudac13hpb.execute-api.us-east-1.amazonaws.com/GetRegisteredContacts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 👇 שולחים "phones" (לא phoneNumbers)
        body: JSON.stringify({ phones: phoneNumbers }),
      }
    );

    const json = await response.json();
    // 👇 קולטים את השם החדש, נופלים אחורה לישן אם צריך
    const result: string[] = json.registeredPhones ?? json.registeredNumbers ?? [];
    console.log('[storeRegisteredContacts] saving', result.length, 'numbers:', result);

    await AsyncStorage.setItem('registeredContacts', JSON.stringify(result));
  } catch (error) {
    console.error(' שגיאה בשמירת אנשי קשר:', error);
    // שמור ריק כדי שהמסך לא יתקע
    await AsyncStorage.setItem('registeredContacts', JSON.stringify([]));
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
    } catch (err) {
      console.error(' שגיאה בבדיקת האם המשתמש בבית:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await lambdaFetch(API_URL_ALERTS);
      const rawData = await response.json();
      const body = typeof rawData.body === 'string' ? JSON.parse(rawData.body) : rawData.body ?? rawData;
      if (!Array.isArray(body)) return;

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

  const fetchShelters = async (latRef?: number, lonRef?: number, city?: string | null) => {
    if (!city) return;
    setIsSheltersLoading(true);
    try {
      let items: any[] = [];
      let startKey: any = null;

      do {
        const base = `${API_URL_SHELTERS}?city=${encodeURIComponent(city)}`;
        const url = startKey ? `${base}&startKey=${encodeURIComponent(JSON.stringify(startKey))}` : base;
        const response = await lambdaFetch(url);
        const data = await response.json();
        const body = typeof data.body === 'string' ? JSON.parse(data.body) : data;
        items = [...items, ...(body.items || [])];
        startKey = body.lastEvaluatedKey || null;
      } while (startKey);

      const toLatLon = (s: any) => {
        const lat = Number(s.location?.lat ?? s.location?.latitude ?? s.lat ?? s.latitude);
        const lon = Number(s.location?.lon ?? s.location?.lng ?? s.location?.longitude ?? s.lon ?? s.longitude);
        return { latitude: lat, longitude: lon };
      };

      const converted = items
        .map((s) => {
          const { latitude, longitude } = toLatLon(s);
          const id =
            s.id || s.shelterId || s._id || s.asset_id || s.uuid ||
            `${latitude},${longitude}`;

          const rawLoc = s.location;
          const address: string | null =
            typeof s.address === 'string' ? s.address :
            typeof s.street === 'string' ? s.street :
            typeof s.streetName === 'string' ? s.streetName :
            typeof s.fullAddress === 'string' ? s.fullAddress :
            typeof rawLoc === 'string' ? rawLoc : null;

          const origName = s.name || s.shelterName || s.shelter_name;
          const name = address || origName || 'מקלט';

          const distanceMeters =
            latRef != null && lonRef != null && !isNaN(latitude) && !isNaN(longitude)
              ? Math.round(calculateDistance(latRef, lonRef, latitude, longitude))
              : Number.MAX_SAFE_INTEGER;

          return {
            ...s,
            id,
            name,
            address,
            origName,
            latitude,
            longitude,
            distanceMeters,
          } as Shelter & { distanceMeters?: number };
        })
        .filter((s) => !isNaN((s as any).latitude) && !isNaN((s as any).longitude));

      const sorted = [...converted].sort((a: any, b: any) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
// אחרי sorted = [...converted].sort(...):
const nearest = sorted[0];
if (nearest) {
  await AsyncStorage.setItem('nearestShelter', JSON.stringify(nearest));
}
      setRawShelters(sorted as any);
      setAllShelters(sorted as any);
      setSheltersToShow(sorted.slice(0, LOAD_COUNT) as any);
      await AsyncStorage.setItem('shelters', JSON.stringify(sorted));

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
        .map((h: any) => ({ ...h, distance: kmDistance(lat, lon, Number(h.lat), Number(h.lon)) }))
        .sort((a: any, b: any) => a.distance - b.distance)[0];
      if (nearest) {
        await AsyncStorage.setItem(
          'nearestHospital',
          JSON.stringify({
            id: nearest.name,
            name: nearest.name,
            latitude: Number(nearest.lat),
            longitude: Number(nearest.lon),
            phone: nearest.phone,
          })
        );
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
      await AsyncStorage.setItem('lastLocation', JSON.stringify({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }));
      await AsyncStorage.setItem('lastLocationAt', new Date().toISOString());
      await sendLocationToBackend(location.coords.latitude, location.coords.longitude);
      Alert.alert('Success', 'Location refreshed!');
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location.');
      console.error('Error refreshing location:', error);
    }
  };

  const getSignedUploadUrl = async (type: 'shelter') => {
    const response = await lambdaFetch(API_URL_SIGNED, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    if (!response.ok) throw new Error('Failed to get signed URL');
    return await response.json();
  };

  const uploadImageToS3 = async (localUri: string, type: 'shelter') => {
    const { uploadUrl, imageUrl } = await getSignedUploadUrl(type);
    await FileSystem.uploadAsync(uploadUrl, localUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': 'image/jpeg' },
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
        const response = await lambdaFetch(`${API_URL_SHELTER_ITEM}/${encodeURIComponent(String(selectedShelter.id))}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: uploadedImageUrl }),
        });
        if (!response.ok) throw new Error('Failed to update shelter image');

        setSelectedShelter((prev) => (prev ? { ...prev, image: uploadedImageUrl } : null));
        setAllShelters((prev) => prev.map((s) => (s.id === selectedShelter.id ? { ...s, image: uploadedImageUrl } : s)));
        setSheltersToShow((prev) =>
          prev.map((s) => (s.id === selectedShelter.id ? { ...s, image: uploadedImageUrl } : s))
        );
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

  /* -------------------- Render -------------------- */
  if (!mapRegion) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="#11998e" />
        <Text style={{ marginTop: 10 }}>Loading shelters...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* City picker modal (עם הצעות) */}
      <Modal
        visible={cityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>בחירת עיר</Text>
            <TextInput
              placeholder="שם עיר (לדוגמה: חולון)"
              value={cityInput}
              onChangeText={(val) => {
                setCityInput(val);
                const norm = (val || '').trim().toLowerCase();
                if (!norm) return setCitySuggestions(CITY_OPTIONS.slice(0, 30));
                const filtered = CITY_OPTIONS.filter((c) => c.toLowerCase().includes(norm)).slice(0, 40);
                setCitySuggestions(filtered.length ? filtered : [val]);
              }}
              style={styles.modalInput}
              textAlign="right"
            />

            <View style={{ maxHeight: 260, marginTop: 8 }}>
              <ScrollView>
                {citySuggestions.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' }}
                    onPress={() => {
                      const norm = normalizeCity(c);
                      if (norm) setSelectedCity(norm);
                      setCityModalVisible(false);
                    }}
                  >
                    <Text style={{ fontSize: 16, textAlign: 'right' }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={{ flexDirection: 'row-reverse', marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.topButton, { flex: 1, marginLeft: 8 }]}
                onPress={() => {
                  const c = normalizeCity(cityInput);
                  if (c) setSelectedCity(c);
                  setCityModalVisible(false);
                }}
              >
                <Text style={styles.topButtonText}>אישור</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.topButton, { flex: 1 }]}
                onPress={async () => {
                  if (currentLL) {
                    const c = await detectCityName(currentLL.lat, currentLL.lon);
                    if (c) {
                      setCityInput(c);
                      setSelectedCity(c);
                    }
                  }
                  setCityModalVisible(false);
                }}
              >
                <Text style={styles.topButtonText}>השתמש בעיר הנוכחית</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.container}>
<MapView
  ref={mapRef}
  style={styles.map}
  region={mapRegion}
  onPress={() => {
    // אם אנחנו עדיין בתוך חלון הדיכוי – לא לנקות
    if (Date.now() < suppressMapClearUntilRef.current) return;
    // אופציונלי: בזמן טעינה אל תנקה
    if (isSheltersLoading) return;

    setSelectedShelter(null);
  }}
>

            {/* Top buttons bar */}
            <View style={styles.topButtons}>
              <TouchableOpacity
                style={[styles.topButton, { marginLeft: 10 }]}
                onPress={() => {
                  setCityInput('');
                  setCitySuggestions(CITY_OPTIONS.slice(0, 30));
                  setCityModalVisible(true);
                }}
              >
                <Text style={styles.topButtonText}>{selectedCity ? `עיר: ${selectedCity}` : 'בחר עיר'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.topButton} onPress={refreshLocation}>
                <Text style={styles.topButtonText}>רענן מיקומך</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.topButton, { marginRight: 10 }]} onPress={handleSaveHomeLocation}>
                <Text style={styles.topButtonText}>שמור מיקום בית</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.centerButton}
              onPress={() => {
                if (mapRegion) {
                  mapRef.current?.animateToRegion(mapRegion, 1000);
                }
              }}
            >
              <Ionicons name="locate-outline" size={24} color="#fff" />
            </TouchableOpacity>

            {/* My location pulse */}
            <Marker coordinate={{ latitude: mapRegion.latitude, longitude: mapRegion.longitude }}>
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: 'rgba(17,153,142,0.3)',
                    transform: [{ scale: pulseAnim }],
                  }}
                />
              </View>
            </Marker>

            {/* Shelters markers */}
            {sheltersToShow.map((shelter) => (
              <CustomMarker
                key={`${shelter.id}-${(shelter as any).status ?? ''}`}
                shelter={shelter}
                onPress={() => handleMarkerPress(shelter)}
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
                          onPress: () =>
                            setAlerts((prev) => prev.map((a, i) => ({ ...a, expanded: i === idx ? !a.expanded : false }))),
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
                                {isMultiple ? `${alert.descriptions.length} איזורי התרעה` : alert.descriptions[0]}
                              </Text>
                            )}
                            <Text style={styles.alertTime}>
                              {alert.date} - {alert.time}
                            </Text>
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
                {typeof (selectedShelter as any).address === 'string' && (
                  <Text style={styles.locationText}>{(selectedShelter as any).address}</Text>
                )}
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
              <Text style={styles.listTitle}>
                {selectedCity ? `מקלטים ב־${selectedCity} (${allShelters.length})` : `Over ${allShelters.length} shelters`}
              </Text>
              <BottomSheetFlatList
                data={sheltersToShow}
                onEndReached={loadMoreShelters}
                onEndReachedThreshold={0.5}
                contentContainerStyle={{ padding: 10 }}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                renderItem={({ item }) => (
                  <ShelterListItem
                    shelter={item}
                    containerStyle={{}}
                    distance={
                      mapRegion
                        ? Math.round(
                            calculateDistance(mapRegion.latitude, mapRegion.longitude, item.latitude, item.longitude)
                          )
                        : null
                    }
                  />
                )}
                keyExtractor={(item) => String(item.id)}
              />
            </View>
          </BottomSheet>
        </View>
      </Animated.View>

      {isSheltersLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#11998e" />
          <Text style={{ marginTop: 10 }}>Loading shelters...</Text>
        </View>
      )}
    </View>
  );
};

/* -------------------- Styles -------------------- */
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
  alertDescription: { fontSize: 15, fontWeight: '500', color: '#444', marginBottom: 2 },
  alertTime: { fontSize: 13, color: '#888' },
  selectedShelter: { position: 'absolute', bottom: 120, right: 10, left: 10 },

  topButtons: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  topButton: {
    backgroundColor: '#11998e',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  topButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'center'},

  contentContainer: { flex: 1 },
  listTitle: { textAlign: 'center', fontSize: 16, marginVertical: 5, marginBottom: 20 },
  imagePreviewContainer: { marginTop: 10, alignItems: 'center' },
  previewImage: { width: '100%', height: 150, borderRadius: 10, resizeMode: 'cover' },
  buttonRow: {
    position: 'absolute',
    bottom: 60,
    right: 10,
    left: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    elevation: 5,
  },
  imageLoaderOverlay: { position: 'absolute', top: '50%', left: '50%', marginLeft: -10, marginTop: -10 },
  actionButton: { flex: 1, backgroundColor: '#11998e', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
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
    top: 120,
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
  shelterHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
  shelterTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', flexShrink: 1, textAlign: 'right' },
  shelterDetails: { flexDirection: 'column', alignItems: 'flex-end', marginBottom: 15 }, // fixed typo
  locationText: { fontSize: 14, color: '#666', marginTop: 5, textAlign: 'right' },
  buttonRowInline: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#11998e',
    paddingVertical: 10,
    justifyContent: 'center',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  actionButtonTextInline: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  /* modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'right' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },
});

export default HomeScreen;
