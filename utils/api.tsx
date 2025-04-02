import * as Notifications from 'expo-notifications';
import { getAuthUserEmail } from './auth';
import * as Location from 'expo-location';

const API_URL = 'https://ker0ncay9f.execute-api.us-east-1.amazonaws.com/prod/update-location';

const getCityFromCoordinates = async (lat: number, lon: number): Promise<string | null> => {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    return place?.city || null;
  };
  
  export const sendLocationToBackend = async (lat: number, lon: number) => {
    try {
      const email = await getAuthUserEmail();
      if (!email) return;
  
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: requested } = await Notifications.requestPermissionsAsync();
        if (requested !== 'granted') return;
      }
  
      const pushToken = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('📱 Push Token:', pushToken);
        
      const city = await getCityFromCoordinates(lat, lon);
      if (!city) {
        console.warn('Unable to determine user city from coordinates');
        return;
      }
      
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          lat,
          lon,
          city,
          pushToken,
        }),
      });
  
      console.log(`Sent user location: ${city}, ${lat}, ${lon}`);
    } catch (err) {
      console.error('Error sending location:', err);
    }
  };
