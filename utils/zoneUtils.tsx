import { point } from '@turf/helpers';
import distance from '@turf/distance';

export type AlertZone = {
  id: number;
  zone: string;
  lat: number;
  lng: number;  // שם נכון לפי הנתונים
  name?: string; // שם יישוב
  city?: string; // נניח שיש גם city מה-DynamoDB
};

export function findUserZone(
  lat: number,
  lon: number,
  zones: AlertZone[],
  userCity?: string // נוסיף fallback לפי שם העיר אם נשלח
): AlertZone | null {
  const userPoint = point([lon, lat]);
  const radiusInKm = 3; // עדכן ל-5 ק"מ לקבלת תוצאה רלוונטית

  for (const zone of zones) {
    if (zone.lat == null || zone.lng == null) continue;

    const zonePoint = point([zone.lng, zone.lat]);
    const dist = distance(userPoint, zonePoint, { units: 'kilometers' });

    if (dist < radiusInKm) {
      return zone;
    }
  }

  // fallback לפי שם העיר
  if (userCity) {
    const matchByCity = zones.find(
      (z) =>
        z.name?.trim() === userCity.trim() ||
        z.city?.trim() === userCity.trim()
    );
    if (matchByCity) {
      console.warn(`⚠️ Fallback match by city: ${userCity} → ${matchByCity.zone}`);
      return matchByCity;
    }
  }

  return null;
}
