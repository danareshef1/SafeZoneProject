// utils/api.ts
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { getUserEmail } from './auth';
import { AlertZone, findUserZone } from './zoneUtils';

// ===== Endpoints =====
const UPDATE_API = 'https://4rmea844n9.execute-api.us-east-1.amazonaws.com/add-user-location';
const ZONES_API = 'https://4i7xc6hael.execute-api.us-east-1.amazonaws.com/GetAllAlertZones';
const GET_USER_LOCATION_API = 'https://4rmea844n9.execute-api.us-east-1.amazonaws.com/get-user-location';

// ===== Zones cache =====
let zonesCache: { data: AlertZone[]; fetchedAt: number } | null = null;
const ZONES_TTL_MS = 5 * 60 * 1000;

// נעילה גלובלית כדי למנוע ריצות מקבילות של שליחה לשרת
let sendLocationMutex = false;

// ----- Helpers -----
function normalizeCity(s?: string | null) {
  return (s || '').replace(/\s+/g, ' ').replace(/[\"״]/g, '').trim() || null;
}

async function getAllZonesFromAPI(): Promise<AlertZone[]> {
  const now = Date.now();
  if (zonesCache && now - zonesCache.fetchedAt < ZONES_TTL_MS) {
    return zonesCache.data;
  }
  const res = await fetch(ZONES_API);
  const payload = await res.json().catch(() => null as any);

  const data: AlertZone[] =
    Array.isArray(payload) ? payload :
    Array.isArray(payload?.body) ? payload.body :
    typeof payload?.body === 'string' ? JSON.parse(payload.body) :
    [];

  zonesCache = { data, fetchedAt: now };
  return data;
}

async function getUserLastCityByEmail(email: string): Promise<string | undefined> {
  const res = await fetch(`${GET_USER_LOCATION_API}?email=${encodeURIComponent(email)}`);
  if (!res.ok) return;
  const json = await res.json().catch(() => ({} as any));
  // אם ה־Lambda שלך מחזיר body ממורשר — תוכל להוסיף כאן פענוח כמו למעלה
  return json?.city || json?.City || undefined;
}

// ===== Main API =====
const FETCH_TIMEOUT_MS = 8000;

/**
 * שולח מיקום לשרת, כולל עיר (אם הצלחנו להפיק) ו־zone (זוהה לפי lat/lon או לפי שם עיר).
 * @param lat
 * @param lon
 * @param source 'home' | 'device' | 'manual'
 * @param accuracy דיוק המיקום (לא חובה)
 */
export async function sendLocationToBackend(
  lat: number,
  lon: number,
  source: 'home' | 'device' | 'manual' = 'device',
  accuracy?: number
) {
  // מניעת ריצות מקבילות
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

    // 2) אם אין עיר מהמכשיר — ננסה להביא את האחרונה מהשרת
    if (!city) {
      try {
        const last = await getUserLastCityByEmail(email);
        if (last) city = normalizeCity(last);
      } catch {}
    }

    // 3) מציאת אזור התרעה (zone) לפי מיקום, עם fallback לפי שם עיר אם יש
    let zone: string | undefined;
    let zoneId: number | string | undefined;
    let zoneName: string | undefined;

    try {
      const zones = await getAllZonesFromAPI();
      const hit = findUserZone(lat, lon, zones, city || undefined);
      if (hit) {
        zone = hit.zone;                       // לדוגמה: "GUSH-DAN-12"
        zoneId = hit.id;                       // מזהה מספרי (אם נדרש)
        zoneName = hit.name || hit.city;       // שם יישוב, אם קיים
      }
    } catch (e) {
      console.warn('sendLocationToBackend: resolve zone error:', e);
    }

    // 4) שליחת העדכון לשרת עם timeout
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
          lng: lon,      // שם השדה בצד השרת
          source,
          accuracy,
          city,          // עשוי להיות null
          // --- zone fields ---
          zone,          // מחרוזת "zone" הקיימת בנתונים (שם/קוד אזור)
          zoneId,        // מזהה (אם השרת רוצה/יודע להשתמש)
          zoneName,      // שם אזור/יישוב (אם קיים)
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
