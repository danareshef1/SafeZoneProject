import * as Notifications from 'expo-notifications';
import { getAuthUserEmail } from './auth';
import { AlertZone, findUserZone } from './zoneUtils';

const API_URL = 'https://3xzztnl8bf.execute-api.us-east-1.amazonaws.com/update-location';
const ZONES_API_URL = 'https://x5vsugson1.execute-api.us-east-1.amazonaws.com/getAllAlertZones';
const GET_USER_LOCATION_API = 'https://3xzztnl8bf.execute-api.us-east-1.amazonaws.com/get-user-location';

const getAllZonesFromAPI = async (): Promise<AlertZone[]> => {
  const res = await fetch(ZONES_API_URL);
  const raw = await res.json();

  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.body)) return raw.body;
  if (typeof raw.body === 'string') return JSON.parse(raw.body);
  return [];
};

export const sendLocationToBackend = async (
  lat: number,
  lon: number,
  type: 'home' | 'current' = 'current'
) => {
  try {
    const email = await getAuthUserEmail();
    if (!email) return;

    let payload: any = {
      email,
      type,  // ✅ חובה כדי שהלמבדה תדע מה עושים
    };

   if (type === 'home') {
  payload = {
    ...payload,
    lat,
    lon,
    homeLat: lat,
    homeLon: lon,
  };
}
 else {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: requested } = await Notifications.requestPermissionsAsync();
        if (requested !== 'granted') return;
      }

      const pushToken = (await Notifications.getExpoPushTokenAsync()).data;

      const allZones = await getAllZonesFromAPI();
      let zoneMatch = findUserZone(lat, lon, allZones);
      let zoneName = zoneMatch?.zone;

      if (!zoneMatch) {
        const cityRes = await fetch(`${GET_USER_LOCATION_API}?email=${email}`);
        const userData = await cityRes.json();
        const userCity = userData.city;

        if (userCity) {
          const fallbackMatch = allZones.find(z =>
            z.name?.includes(userCity) || z.zone?.includes(userCity)
          );
          if (fallbackMatch) {
            zoneMatch = fallbackMatch;
            zoneName = fallbackMatch.zone;
            console.log(`⚠️ Fallback match by city: ${userCity} → ${zoneName}`);
          }
        }
      }

      if (!zoneName || !zoneMatch) {
        console.warn(`❌ No matching alert zone found for coordinates: (${lat}, ${lon})`);
        return;
      }

      payload = {
        ...payload,
        lat,
        lon,
        zone: zoneMatch.zone,
        city: zoneMatch.name,
        pushToken,
      };
    }

    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

  } catch (err) {
    console.error('🔥 Error sending location:', err);
  }
};
