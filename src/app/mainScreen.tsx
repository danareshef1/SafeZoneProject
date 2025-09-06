// src/app/mainScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import proj4 from 'proj4';
import * as Notifications from 'expo-notifications';
import { getUserEmail } from '../../utils/auth';
import * as Location from 'expo-location';

// === Foreground notifications ===
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

proj4.defs(
  'EPSG:2039',
  '+proj=tmerc +lat_0=31.7343938888889 +lon_0=35.2045169444444 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs'
);

// === ITM helpers (לא בשימוש) ===
const sampleE = 179254.9219000004;
const sampleN = 665111.2525999993;
const targetLat = 32.0785788989309;
const targetLon = 34.7786417155005;
const result = proj4('EPSG:4326', 'EPSG:2039', [targetLon, targetLat]);
const invE = result ? result[0] : 0;
const invN = result ? result[1] : 0;
const deltaE = invE - sampleE;
const deltaN = invN - sampleN;

// === API URLs ===
const GET_PROFILE_URL = 'https://50nq38ocfb.execute-api.us-east-1.amazonaws.com/get-help-profile';
const OPEN_HELP_URL   = 'https://50nq38ocfb.execute-api.us-east-1.amazonaws.com/open-help-request';
const NEARBY_HELP_URL = 'https://50nq38ocfb.execute-api.us-east-1.amazonaws.com/nearby-help';

// === Misc helpers ===
const DEADLINE_MS = 10 * 60 * 1000;
const nowMs = () => Date.now();
const AS_KEY_DEADLINE = 'safezoneShelterDeadline';

// ---------- Small helpers ----------
function normalizeName(s?: string): string | undefined {
  if (!s || typeof s !== 'string') return;
  return s.replace(/\s+/g, ' ').replace(/[\"״]/g, '').trim();
}
function pickDisplayZoneName(d: any): string | undefined {
  return normalizeName(d?.zone) || normalizeName(d?.city);
}
function parseStartIso(s?: string): number | undefined {
  if (!s || typeof s !== 'string') return;
  const t = Date.parse(s);
  return isNaN(t) ? undefined : t;
}
function num(n: any) { const v = Number(n); return Number.isFinite(v) ? v : NaN; }

type ZoneItem = {
  id?: number | string;
  name?: string;
  zone?: string;
  countdown?: number;
};
type HelpPin = { requestId: string; lat: number; lng: number; categories: string[]; distanceM: number; city?: string };

function parseZonesResponse(raw: any) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.zones)) return raw.zones;
  if (Array.isArray(raw?.body)) return raw.body;
  if (typeof raw?.body === 'string') {
    try {
      const p = JSON.parse(raw.body);
      if (Array.isArray(p)) return p;
      if (Array.isArray(p?.zones)) return p.zones;
    } catch {}
  }
  return [];
}

// המרה סלחנית ל-string[]
function extractCategories(raw: any): string[] {
  if (!raw) return [];
  // מערך של מיתרים רגילים
  if (Array.isArray(raw) && (raw.length === 0 || typeof raw[0] === 'string')) {
    return raw.map(String).filter(Boolean);
  }
  // המקרה [{S:"..."}, {S:"..."}]
  if (Array.isArray(raw)) {
    return raw
      .map((x: any) => (typeof x === 'string' ? x : (x?.S ?? x?.N ?? x?.B ?? '')))
      .filter(Boolean)
      .map(String);
  }
  // צורות AttributeValue נוספות
  if (raw && Array.isArray(raw.SS)) return raw.SS.map(String);
  if (raw && Array.isArray(raw.L)) {
    return raw.L
      .map((x: any) => (x?.S ?? x?.N ?? x?.B ?? ''))
      .filter(Boolean)
      .map(String);
  }
  // סטים של DocumentClient
  if (typeof raw === 'object' && raw?.type === 'Set' && Array.isArray(raw.values)) {
    return raw.values.map(String).filter(Boolean);
  }
  if (typeof raw === 'object' && Array.isArray((raw as any).values)) {
    return (raw as any).values.map(String).filter(Boolean);
  }
  return [];
}

const ShelterInfoScreen = () => {
  const [minutes, setMinutes] = useState(10);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(1);
  const [shelterLocation, setShelterLocation] = useState<string>('');
  const [zoneInfo, setZoneInfo] = useState<ZoneItem | null>(null);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [nearestShelter, setNearestShelter] = useState<any>(null);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [countdownOver, setCountdownOver] = useState(false);
  const [isAtHome, setIsAtHome] = useState<boolean | null>(null);

  // Need Help pins
  const [helpPins, setHelpPins] = useState<HelpPin[]>([]);
  const [sendingHelpReq, setSendingHelpReq] = useState(false);

  const router = useRouter();
  const deadlineRef = useRef<number>(0);

  // === Auth header (אם תוסיפי קוגניטו בעתיד) ===
  async function getAuthHeaderInScreen() {
    const idToken = ''; // TODO: await getIdToken();
    return idToken ? { Authorization: idToken } : {};
  }

  const isAlertActiveNow = () => {
    const dl = (globalThis as any).safezoneShelterDeadline;
    return typeof dl === 'number' && dl > Date.now() && !countdownOver;
  };

  const setDeadline = async (deadlineMs: number) => {
    (globalThis as any).safezoneShelterDeadline = deadlineMs;
    deadlineRef.current = deadlineMs;
    setCountdownOver(false);
    try { await AsyncStorage.setItem(AS_KEY_DEADLINE, String(deadlineMs)); } catch {}
  };

  // ====== טיימר / deadline ======
  useEffect(() => {
    const init = async () => {
      let existing: number | null = null;
      try {
        const fromStore = await AsyncStorage.getItem(AS_KEY_DEADLINE);
        if (fromStore) {
          const parsed = parseInt(fromStore, 10);
          if (!isNaN(parsed)) existing = parsed;
        }
      } catch {}

      if (typeof (globalThis as any).safezoneShelterDeadline === 'number') {
        deadlineRef.current = (globalThis as any).safezoneShelterDeadline;
      } else if (existing && existing > nowMs()) {
        (globalThis as any).safezoneShelterDeadline = existing;
        deadlineRef.current = existing;
        setCountdownOver(false);
      } else {
        const fresh = nowMs() + DEADLINE_MS;
        await setDeadline(fresh);
      }

      const tick = () => {
        const currentDeadline =
          (globalThis as any).safezoneShelterDeadline ||
          deadlineRef.current ||
          (nowMs() + DEADLINE_MS);

        deadlineRef.current = currentDeadline;

        const remainingMs = Math.max(0, currentDeadline - nowMs());
        const remSec = Math.ceil(remainingMs / 1000);

        setMinutes(Math.floor(remSec / 60));
        setSeconds(remSec % 60);
        setProgress(Math.min(1, Math.max(0, remainingMs / DEADLINE_MS)));
        if (remainingMs <= 0) setCountdownOver(true);
      };

      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    };

    let cleanup: (() => void) | undefined;
    init().then(c => { cleanup = c as any; });
    return () => { if (cleanup) cleanup(); };
  }, []);

  useEffect(() => {
    if (countdownOver) router.push('/postAlertScreen');
  }, [countdownOver]);

  // ====== טען zones פעם אחת ======
  useEffect(() => {
    (async () => {
      try {
        const zonesRes = await fetch('https://4i7xc6hael.execute-api.us-east-1.amazonaws.com/GetAllAlertZones');
        const zonesRaw = await zonesRes.json();
        setZones(parseZonesResponse(zonesRaw));
      } catch (err) {
        console.log('שגיאה בטעינת אזורי התרעה:', err);
      }
    })();
  }, []);

  // ====== Fallback: משיכת מיקום/עיר מהשרת אם אין push ======
  useEffect(() => {
    (async () => {
      try {
        const email = await getUserEmail();
        if (!email) return;

        const res = await fetch(
          `https://tnryta2al0.execute-api.us-east-1.amazonaws.com/get-user-location?email=${encodeURIComponent(email)}`
        );
        const raw = await res.json();
        const body = typeof raw?.body === 'string' ? JSON.parse(raw.body) : (raw?.body ?? raw);
        const city = normalizeName(body?.city);

        if (!shelterLocation && city) {
          setShelterLocation(city);

          if (zones.length) {
            const z = zones.find(zz =>
              normalizeName(zz.name) === city || normalizeName(zz.zone) === city
            );
            if (z) {
              setZoneInfo(z);
              if (typeof z.countdown === 'number' && !(globalThis as any).safezoneShelterDeadline) {
                await setDeadline(Date.now() + z.countdown * 1000);
              }
            }
          }
        }
      } catch (err) {
        console.log('שגיאה בשליפת עיר מהשרת:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, shelterLocation]);

  // ====== קריאה מה־push ======
  useEffect(() => {
    const subReceive = Notifications.addNotificationReceivedListener((notif) => {
      try {
        const data = notif?.request?.content?.data || {};
        applyPushData(data);
      } catch (e) {
        console.log('push receive parse error', e);
      }
    });

    const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response?.notification?.request?.content?.data || {};
        applyPushData(data);
      } catch (e) {
        console.log('push response parse error', e);
      }
    });

    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const data = last?.notification?.request?.content?.data || undefined;
        if (data) applyPushData(data);
      } catch {}
    })();

    return () => {
      subReceive.remove();
      subResponse.remove();
    };
  }, [zones]);

  // ====== טען nearestShelter + isAtHome ======
  useEffect(() => {
    (async () => {
      try {
        const data = await AsyncStorage.getItem('nearestShelter');
        const atHomeString = await AsyncStorage.getItem('isAtHome');

        if (data) {
          const s = JSON.parse(data);
          const lat = num(s.latitude ?? s.lat);
          const lon = num(s.longitude ?? s.lng);
          setNearestShelter({
            ...s,
            latitude: lat,
            longitude: lon,
            distance: typeof s.distance === 'number'
              ? s.distance
              : (typeof s.distanceMeters === 'number' ? s.distanceMeters / 1000 : undefined),
          });
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            setMapRegion({
              latitude: lat,
              longitude: lon,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
        } else {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (perm.status === 'granted') {
            const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setMapRegion({
              latitude: here.coords.latitude,
              longitude: here.coords.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            });
          }
        }

        if (atHomeString !== null) {
          setIsAtHome(atHomeString === 'true');
        }
      } catch (err) {
        console.error('שגיאה בשליפת המקלט הקרוב או isAtHome:', err);
      }
    })();
  }, []);

  // ====== טען מחדש nearestShelter בכל כניסה למסך ======
  const reloadNearest = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('nearestShelter');
      if (!raw) return;

      const s = JSON.parse(raw);
      const fixed = {
        ...s,
        latitude: num(s.latitude ?? s.lat),
        longitude: num(s.longitude ?? s.lng),
        distance: typeof s.distance === 'number'
          ? s.distance
          : (typeof s.distanceMeters === 'number' ? s.distanceMeters / 1000 : undefined),
      };

      if (!Number.isFinite(fixed.latitude) || !Number.isFinite(fixed.longitude)) {
        console.log('[mainScreen] nearestShelter missing lat/lon -> ignoring', s);
        return;
      }

      setNearestShelter(fixed);
      setMapRegion((prev: any) => prev ?? ({
        latitude: fixed.latitude,
        longitude: fixed.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }));
    } catch (e) {
      console.log('reloadNearest error', e);
    }
  }, []);

  useFocusEffect(React.useCallback(() => {
    reloadNearest();
    return () => {};
  }, [reloadNearest]));

  // ====== וידוא שיש פרופיל Need Help עם קטגוריות (GET) ======
  const ensureHelpProfileReady = async (): Promise<boolean> => {
    try {
      // 1) קאש: אם קיים וריק — לנקות, אם מלא — להחזיר true
      const cached = await AsyncStorage.getItem('needHelpProfile');
      if (cached) {
        try {
          const p = JSON.parse(cached);
          const catsCached = extractCategories(p?.categories);
          if (catsCached.length) return true;
          await AsyncStorage.removeItem('needHelpProfile'); // קאש ריק → ננקה
        } catch {
          await AsyncStorage.removeItem('needHelpProfile');
        }
      }

      // 2) אימייל
      let email = await getUserEmail();
      if (!email) email = (await AsyncStorage.getItem('userEmail')) || '';
      email = (email || '').trim().toLowerCase();
      if (!email) return false;

      // 3) קריאה לשרת (GET)
      const url = `${GET_PROFILE_URL}?email=${encodeURIComponent(email)}`;
      console.log('[NeedHelp] GET', url);
      const r = await fetch(url);
      const txt = await r.text();
      if (!r.ok) {
        console.log('[NeedHelp] status:', r.status, 'body:', txt?.slice(0, 500));
        return false;
      }

      // 4) פרסור סלחני
      let j: any = {};
      try { j = txt ? JSON.parse(txt) : {}; } catch {}
      const body    = typeof j?.body === 'string' ? (() => { try { return JSON.parse(j.body); } catch { return null; } })() : (j?.body ?? null);
      const profile = j?.profile || body?.profile || j;
      const cats: string[] = extractCategories(profile?.categories);

      console.log('[NeedHelp] categories:', cats);

      // 5) שמירה לקאש (כ־string[])
      if (cats.length) {
        await AsyncStorage.setItem('needHelpProfile', JSON.stringify({ categories: cats }));
        return true;
      }
      return false;
    } catch (e) {
      console.log('ensureHelpProfileReady error:', e);
      return false;
    }
  };

  // ====== פתיחת בקשת עזרה ======
  const openHelpRequestNow = async () => {
    if (sendingHelpReq) return;
    setSendingHelpReq(true);
    try {
      const hasProfile = await ensureHelpProfileReady();
      if (!hasProfile) {
        const email = await getUserEmail();
        Alert.alert(
          'חסר פרופיל',
          `לא נמצאו קטגוריות ל־${email || 'unknown'}.\nודאי שבטבלת NeedHelpProfiles יש categories מסוג List עם ערכים (Strings).`,
          [
            { text: 'הגדר עכשיו', onPress: () => router.push('/NeedHelp') },
            { text: 'ביטול' },
          ]
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('אין הרשאת מיקום', 'לא ניתן לפתוח בקשה ללא מיקום');
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

      const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaderInScreen()) };
      const body = { lat: coords.latitude, lng: coords.longitude, city: shelterLocation || '' };
      const r = await fetch(OPEN_HELP_URL, { method: 'POST', headers, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.ok) {
        await AsyncStorage.setItem('lastHelpRequestId', String(j.requestId));
        await AsyncStorage.setItem('lastHelpReqExpiresAt', String(j.expiresAt));
        Alert.alert('נפתח', 'בקשת עזרה נפתחה ל-15 דק׳');
      } else {
        Alert.alert('שגיאה', j?.message || 'לא ניתן לפתוח בקשה כרגע');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('שגיאה', 'אירעה תקלה בפתיחת בקשה');
    } finally {
      setSendingHelpReq(false);
    }
  };

  // ====== Polling למבקשי עזרה קרובים ======
  useEffect(() => {
    if (!isAlertActiveNow()) return;

    let cancelled = false;
    let timer: any;

    const tick = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const headers = await getAuthHeaderInScreen();
        const url = `${NEARBY_HELP_URL}?lat=${coords.latitude}&lng=${coords.longitude}&radiusM=700`;
        const r = await fetch(url, { headers });
        const j = await r.json();
        if (!cancelled && j?.ok) setHelpPins(Array.isArray(j.nearby) ? j.nearby : []);
      } catch {
        // שקט במכוון
      } finally {
        timer = setTimeout(tick, 15000);
      }
    };

    tick();
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownOver, shelterLocation]);

  // ====== לוגיקת עיבוד נתוני ה־push ======
  const applyPushData = (data: any) => {
    const zoneName = pickDisplayZoneName(data);
    if (zoneName) setShelterLocation(zoneName);

    const startMs = parseStartIso(data?.startIso);
    const durSec = typeof data?.durationSec === 'number'
      ? data.durationSec
      : (typeof data?.durationSec === 'string' ? parseInt(data.durationSec, 10) : undefined);

    if (startMs && durSec && !isNaN(durSec)) {
      const dline = startMs + durSec * 1000;
      setDeadline(dline);
      const remainingMs = Math.max(0, dline - nowMs());
      const remSec = Math.ceil(remainingMs / 1000);
      setMinutes(Math.floor(remSec / 60));
      setSeconds(remSec % 60);
      setProgress(Math.min(1, Math.max(0, remainingMs / DEADLINE_MS)));
      if (remainingMs <= 0) setCountdownOver(true);
    }

    if (zoneName && zones.length) {
      const match = zones.find(z =>
        normalizeName(z.name) === zoneName || normalizeName(z.zone) === zoneName
      );
      if (match) setZoneInfo(match);
    }
  };

  // ====== UI ======
  const circleRadius = 45;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference * (1 - progress);

  const handleUpdate = async () => {
    try {
      const atHomeFlag = (await AsyncStorage.getItem('isAtHome')) === 'true';
      const email = await getUserEmail();
      if (!email) throw new Error('Email not found');

      const tokenRes = await fetch(
        `https://p0l8kgq8gk.execute-api.us-east-1.amazonaws.com/getUserDetails?email=${encodeURIComponent(email)}`
      );
      const tokenJson = await tokenRes.json();
      const displayName = tokenJson?.displayName || '';

      const shelterName = atHomeFlag ? '' : (nearestShelter?.name ?? shelterLocation);

      const res = await fetch('https://tzjxjyn7hl.execute-api.us-east-1.amazonaws.com/notifyContactsSafe', {
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
      ios: `maps:0,0?q=${encodeURIComponent(name)}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${encodeURIComponent(name)})`,
    });
    if (url) {
      Linking.openURL(url).catch(err => console.error('שגיאה בניווט:', err));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          מיקומך: {shelterLocation ? shelterLocation : 'לא ידוע'}
        </Text>
        <Text style={styles.infoText}>
          זמן כניסה למקלט: {zoneInfo?.countdown != null ? `${zoneInfo.countdown} שניות` : 'לא ידוע'}
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
          <>
            <MapView style={styles.mapImage} region={mapRegion} showsUserLocation showsMyLocationButton>
              {nearestShelter && Number.isFinite(nearestShelter.latitude) && Number.isFinite(nearestShelter.longitude) && (
                <Marker
                  coordinate={{ latitude: nearestShelter.latitude, longitude: nearestShelter.longitude }}
                  title={nearestShelter.name ?? 'מקלט'}
                  description={
                    typeof nearestShelter.distance === 'number'
                      ? `מרחק: ${nearestShelter.distance.toFixed(2)} ק"מ`
                      : (typeof nearestShelter.distanceMeters === 'number'
                          ? `מרחק: ${(nearestShelter.distanceMeters/1000).toFixed(2)} ק"מ`
                          : undefined)
                  }
                />
              )}

              {helpPins.map(p => (
                <Marker
                  key={p.requestId}
                  coordinate={{ latitude: p.lat, longitude: p.lng }}
                  title="צריך/ה עזרה (מיקום משוער)"
                  description={`${p.city || ''} • ${Math.round(p.distanceM)} מ' • ${p.categories?.join(', ') || ''}`}
                  pinColor="#f97316"
                />
              ))}
            </MapView>

            {!isAtHome ? (
              <TouchableOpacity style={styles.floatingButton} onPress={handleNavigateToShelter}>
                <Text style={styles.floatingButtonText}>🏃 נווט למקלט</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.floatingButton, { backgroundColor: '#777' }]}>
                <Text style={styles.floatingButtonText}>🏠 אתה בבית - לך לממ״ד</Text>
              </View>
            )}
          </>
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
                strokeWidth={12}
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
          {isAlertActiveNow() && (
            <TouchableOpacity
              style={[styles.button, sendingHelpReq && { opacity: 0.6 }]}
              onPress={openHelpRequestNow}
              disabled={sendingHelpReq}
            >
              <Text style={styles.buttonText}>{sendingHelpReq ? 'פותח בקשה…' : 'אני צריך/ה עזרה'}</Text>
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
