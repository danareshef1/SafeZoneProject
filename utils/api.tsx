// utils/api.ts
import * as Notifications from 'expo-notifications';
import { getUserEmail } from './auth';
import { AlertZone, findUserZone } from './zoneUtils';

const UPDATE_API = 'https://4rmea844n9.execute-api.us-east-1.amazonaws.com/update-user-location';
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

export async function sendLocationToBackend(
  lat: number,
  lon: number,
  type: 'home' | 'current' = 'current'
) {
  // 🔒 מונע קריאות מקבילות
  if (sendLocationMutex) return;
  sendLocationMutex = true;

  try {
    const email = await getUserEmail();
    if (!email) return;

    let payload: Record<string, any> = { email, type };

    if (type === 'home') {
      payload = { ...payload, lat, lon, homeLat: lat, homeLon: lon };
    } else {
      const pushToken = await getExpoPushTokenSafe();
      const allZones = await getAllZonesFromAPI();

      let zoneMatch = findUserZone(lat, lon, allZones);
      let zoneName = zoneMatch?.zone;

      if (!zoneMatch) {
        const userCity = await getUserLastCityByEmail(email);
        if (userCity) {
          const fb = allZones.find(
            z => (z.name && z.name.includes(userCity)) || (z.zone && z.zone.includes(userCity))
          );
          if (fb) { zoneMatch = fb; zoneName = fb.zone; }
        }
      }

      payload = zoneMatch && zoneName
        ? { ...payload, lat, lon, zone: zoneMatch.zone, city: zoneMatch.name, pushToken }
        : { ...payload, lat, lon, pushToken };
    }

    await fetch(UPDATE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } finally {
    sendLocationMutex = false;
  }
}
