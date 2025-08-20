import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import MapView, { Marker, Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import proj4 from 'proj4';
import { getUserEmail } from '../../utils/auth';

proj4.defs(
  'EPSG:2039',
  '+proj=tmerc +lat_0=31.7343938888889 +lon_0=35.2045169444444 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs'
);

const sampleE = 179254.9219000004;
const sampleN = 665111.2525999993;
const targetLat = 32.0785788989309;
const targetLon = 34.7786417155005;

const result = proj4('EPSG:4326', 'EPSG:2039', [targetLon, targetLat]);
const invE = result ? result[0] : 0;
const invN = result ? result[1] : 0;
const deltaE = invE - sampleE;
const deltaN = invN - sampleN;

function convertITMtoWGS84(easting: number, northing: number) {
  const correctedE = easting + deltaE;
  const correctedN = northing + deltaN;
  const [lon, lat] = proj4('EPSG:2039', 'EPSG:4326', [correctedE, correctedN]);
  return { latitude: lat, longitude: lon };
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const DEADLINE_MS = 10 * 60 * 1000;

const ShelterInfoScreen = () => {
  const [minutes, setMinutes] = useState(10);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(1);
  const [shelterLocation, setShelterLocation] = useState('תל אביב');
  const [zoneInfo, setZoneInfo] = useState<any>(null);
  const [nearestShelter, setNearestShelter] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const router = useRouter();
  const [countdownOver, setCountdownOver] = useState(false);
  const [isAtHome, setIsAtHome] = useState<boolean | null>(null);
  const deadlineRef = useRef<number>(0);

  useEffect(() => {
    if (!globalThis.safezoneShelterDeadline) {
      globalThis.safezoneShelterDeadline = Date.now() + DEADLINE_MS;
      console.log('⏱️ init local deadline (no global yet)', globalThis.safezoneShelterDeadline);
    }

    const tick = () => {
      const currentDeadline =
        globalThis.safezoneShelterDeadline ||
        deadlineRef.current ||
        (Date.now() + DEADLINE_MS);

      deadlineRef.current = currentDeadline;

      const now = Date.now();
      const remainingMs = Math.max(0, currentDeadline - now);
      const remSec = Math.ceil(remainingMs / 1000);

      setMinutes(Math.floor(remSec / 60));
      setSeconds(remSec % 60);
      setProgress(remainingMs / DEADLINE_MS);

      if (remainingMs <= 0) setCountdownOver(true);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchCityFromServer = async () => {
      try {
        const email = await getUserEmail();
        if (!email) return;

        const res = await fetch(`https://3xzztnl8bf.execute-api.us-east-1.amazonaws.com/get-user-location?email=${email}`);
        const data = await res.json();

        if (data.city) {
          setShelterLocation(data.city);

          const zonesRes = await fetch('https://x5vsugson1.execute-api.us-east-1.amazonaws.com/getAllAlertZones');
          const zonesRaw = await zonesRes.json();
          const zones = Array.isArray(zonesRaw) ? zonesRaw : JSON.parse(zonesRaw.body ?? '[]');
          const matched = zones.find((z: any) => z.name === data.city);
          if (matched) setZoneInfo(matched);
        }
      } catch (err) {
        console.log('שגיאה בשליפת עיר מהשרת:', err);
      }
    };

    fetchCityFromServer();
  }, []);

  useEffect(() => {
    if (countdownOver) {
      router.push('/postAlertScreen');
    }
  }, [countdownOver]);

  useEffect(() => {
    const loadNearestShelter = async () => {
      try {
        const data = await AsyncStorage.getItem('nearestShelter');
        const atHomeString = await AsyncStorage.getItem('isAtHome');

        if (data) {
          const shelter = JSON.parse(data);
          setNearestShelter(shelter);
          setUserLocation({ latitude: shelter.latitude, longitude: shelter.longitude });
          setMapRegion({
            latitude: shelter.latitude,
            longitude: shelter.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }

        if (atHomeString !== null) {
          setIsAtHome(atHomeString === 'true');
        }
      } catch (err) {
        console.error('שגיאה בשליפת המקלט הקרוב או isAtHome:', err);
      }
    };

    loadNearestShelter();
  }, []);

  const circleRadius = 45;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference * (1 - progress);

const handleUpdate = async () => {
  try {
    const atHomeFlag = (await AsyncStorage.getItem('isAtHome')) === 'true';
    const email = await getUserEmail();
    if (!email) throw new Error('Email not found');

    const tokenRes = await fetch(
      `https://q129s4gw8l.execute-api.us-east-1.amazonaws.com/getUserDetails?email=${encodeURIComponent(email)}`
    );
    const tokenJson = await tokenRes.json();
    const displayName = tokenJson?.displayName || '';

    // ✅ שליפת שם המקלט במקום עיר
    const shelterName = atHomeFlag ? '' : nearestShelter?.name ?? shelterLocation;

    const res = await fetch('https://vpn66bt94h.execute-api.us-east-1.amazonaws.com/notifyContactsSafe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: email,
        displayName,
        city: atHomeFlag ? shelterLocation : '',
        shelterName,
        atHome: atHomeFlag,
      }),
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);
    Alert.alert('נשלח', 'עדכנו את אנשי הקשר שבחרת שאת/ה בטוח/ה');
  } catch (e) {
    console.error(e);
    Alert.alert('שגיאה', 'לא הצלחנו לשלוח עדכון כרגע');
  }
};



  const handleChat = async () => {
    try {
      const isAtHomeStr = await AsyncStorage.getItem('isAtHome');
      const atHome = isAtHomeStr === 'true';
      const city = shelterLocation || '';
      const countdown = zoneInfo?.countdown != null ? String(zoneInfo.countdown) : '';
      const shelterName = nearestShelter?.name ?? '';
      const distanceKm = typeof nearestShelter?.distance === 'number' ? String(nearestShelter.distance) : '';

      router.push({
        pathname: '/emotional-chat',
        params: { returnTo: 'mainScreen', city, countdown, isAtHome: atHome ? '1' : '0', shelterName, distanceKm },
      });
    } catch (e) {
      console.error('שגיאה בפתיחת צ׳אט:', e);
      Alert.alert('שגיאה', 'לא הצלחתי לפתוח את הצ׳אט כרגע.');
    }
  };

  const handleReport = () => {
    if (!nearestShelter) {
      Alert.alert('אין מקלט', 'לא נמצא מקלט קרוב');
      return;
    }

    router.push({
      pathname: '/report-shelter/[id]',
      params: {
        id: nearestShelter.id,
        name: nearestShelter.name ?? '',
        location: nearestShelter.location ?? '',
        status: nearestShelter.status ?? '',
        image: nearestShelter.image ?? '',
      },
    });
  };

  const handleNavigateToShelter = () => {
    if (!nearestShelter) {
      Alert.alert('אין מקלט', 'לא נמצא מקלט קרוב');
      return;
    }
    const { latitude, longitude, name } = nearestShelter;
    const url = Platform.select({
      ios: `maps:0,0?q=${name}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${name})`,
    });
    if (url) {
      Linking.openURL(url).catch(err => console.error('שגיאה בניווט:', err));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>מיקומך: {shelterLocation}</Text>
        <Text style={styles.infoText}>
          זמן כניסה למקלט: {zoneInfo?.countdown ? `${zoneInfo.countdown} שניות` : 'לא ידוע'}
        </Text>
      </View>

      {nearestShelter && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.infoText}>המקלט הקרוב ביותר:</Text>
          <Text style={styles.infoText}>{nearestShelter.name ?? 'ללא שם'}</Text>
        </View>
      )}

      <View style={styles.mapContainer}>
        {mapRegion && (
          <MapView style={styles.mapImage} region={mapRegion} showsUserLocation showsMyLocationButton>
            {nearestShelter && (
              <Marker
                coordinate={{ latitude: nearestShelter.latitude, longitude: nearestShelter.longitude }}
                title={nearestShelter.name ?? 'מקלט'}
                description={typeof nearestShelter.distance === 'number' ? `מרחק: ${nearestShelter.distance.toFixed(2)} ק"מ` : undefined}
              />
            )}
            {!isAtHome ? (
              <TouchableOpacity style={styles.floatingButton} onPress={handleNavigateToShelter}>
                <Text style={styles.floatingButtonText}>🏃 נווט למקלט</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.floatingButton, { backgroundColor: '#777' }]}>...
                <Text style={styles.floatingButtonText}>🏠 אתה בבית - לך לממ״ד</Text>
              </View>
            )}
          </MapView>
        )}
      </View>

      <View style={styles.bottomContainer}>
        <View style={styles.timerWrapper}>
          <Text style={styles.timerTitle}>⏱ זמן עד ליציאה מהמקלט</Text>
          <View style={styles.timerContainer}>
            <Svg width={160} height={160}>
              <Circle
                cx="80"
                cy="80"
                r={70}
                stroke="#11998e"
                strokeWidth="12"
                strokeDasharray={2 * Math.PI * 70}
                strokeDashoffset={strokeDashoffset}
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
            <Text style={styles.timerText}>
              {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
            </Text>
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity style={styles.button} onPress={handleUpdate}>
            <Text style={styles.buttonText}>עדכון</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleChat}>
            <Text style={styles.buttonText}>פתיחת צ'אט</Text>
          </TouchableOpacity>
          {!isAtHome && (
            <TouchableOpacity style={styles.button} onPress={handleReport}>
              <Text style={styles.buttonText}>דיווח</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default ShelterInfoScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f0f4f8' },
  infoContainer: {
    alignItems: 'center', marginBottom: 20, padding: 20, backgroundColor: '#ffffff',
    borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 8,
  },
  infoText: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: '#222', marginBottom: 8 },
  mapContainer: {
    flex: 1.5, borderRadius: 25, overflow: 'hidden', marginBottom: 30, borderWidth: 5,
    borderColor: '#11998e', shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 8, position: 'relative',
  },
  mapImage: { width: '100%', height: '100%' },
  floatingButton: {
    position: 'absolute', bottom: 20, right: 20, backgroundColor: '#e60000',
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 10,
  },
  floatingButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bottomContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 15 },
  buttonsContainer: { flex: 1, marginLeft: 25, justifyContent: 'space-between' },
  button: {
    backgroundColor: '#11998e', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 30,
    marginBottom: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 5, elevation: 6,
  },
  buttonText: { fontSize: 16, color: '#fff', fontWeight: '700' },
  timerWrapper: { alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  timerTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#333' },
  timerContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative', width: 160, height: 160 },
  timerText: { position: 'absolute', fontSize: 30, fontWeight: '800', color: '#11998e' },
});


