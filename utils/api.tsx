// utils/api.ts
import * as Notifications from 'expo-notifications';
import { getUserEmail } from './auth';
import { AlertZone, findUserZone } from './zoneUtils';
import * as Location from 'expo-location';

const UPDATE_API = 'https://4rmea844n9.execute-api.us-east-1.amazonaws.com/add-user-location';
const ZONES_API = 'https://4i7xc6hael.execute-api.us-east-1.amazonaws.com/GetAllAlertZones';
const GET_USER_LOCATION_API = 'https://4rmea844n9.execute-api.us-east-1.amazonaws.com/get-user-location';

let zonesCache: { data: AlertZone[]; fetchedAt: number } | null = null;
const ZONES_TTL_MS = 5 * 60 * 1000;

// ❗ נעילה גלובלית כדי למנוע ריצות כפולות בו־זמן
let sendLocationMutex = false;

async function getAllZonesFromAPI(): Promise<AlertZone[]> {
  const now = Date.now();
  if (zonesCache && now - zonesCache.fetchedAt < ZONES_TTL_MS) {
    return zonesCache.data;
  }
  const res = await fetch(ZONES_API);
  const payload = await res.json().catch(() => null);
  const data =
    Array.isArray(payload) ? payload :
    Array.isArray(payload?.body) ? payload.body :
    typeof payload?.body === 'string' ? JSON.parse(payload.body) : [];
  zonesCache = { data, fetchedAt: now };
  return data;
}

async function getUserLastCityByEmail(email: string): Promise<string | undefined> {
  const res = await fetch(`${GET_USER_LOCATION_API}?email=${encodeURIComponent(email)}`);
  if (!res.ok) return;
  const json = await res.json().catch(() => ({} as any));
  return json?.city || json?.City || undefined;
}

async function getExpoPushTokenSafe(): Promise<string | undefined> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    const status = perm.status === 'granted'
      ? 'granted'
      : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    return (await Notifications.getExpoPushTokenAsync()).data;
  } catch {
    return;
  }
}
const normalizeCity = (s?: string | null) =>
  (s || '').replace(/\s+/g, ' ').replace(/[\"״]/g, '').trim() || null;

// utils/api.ts (רק sendLocationToBackend)
const FETCH_TIMEOUT_MS = 8000; // אפשר לכוונן

export async function sendLocationToBackend(
  lat: number,
  lon: number,
  source: 'home' | 'device' | 'manual' = 'device',
  accuracy?: number
) {
  // מנע כפילויות: אם יש שליחה רצה, נוותר בשקט
  if (sendLocationMutex) return;
  sendLocationMutex = true;

  try {
    const email = await getUserEmail().catch(() => null);
    if (!email) {
      console.warn('sendLocationToBackend: missing email — aborting');
      return;
    }

    // 1) ננסה להפיק עיר בצד המכשיר
    let city: string | null = null;
    try {
      const placemarks = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      const p = placemarks?.[0];
      city = normalizeCity(p?.city || p?.subregion || p?.district || p?.region);
    } catch {}

    // 2) אם אין לנו עיר מהמכשיר — ננסה להביא את האחרונה מהשרת (עדיף מ-null)
    if (!city) {
      try {
        const last = await getUserLastCityByEmail(email!);
        if (last) city = last;
      } catch {}
    }

    // 3) שליחת העדכון עם timeout
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(UPDATE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          email,
          lat,
          lng: lon,     // שדה השרת
          source,
          accuracy,
          city,         // אם עדיין null — השרת ישלים/ישמור בלי, אבל ניסינו פעמיים
        }),
      });
      if (!res.ok) {
        console.warn('sendLocationToBackend: server responded', res.status);
      }
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    console.warn('sendLocationToBackend error:', e);
  } finally {
    sendLocationMutex = false;
  }
}

