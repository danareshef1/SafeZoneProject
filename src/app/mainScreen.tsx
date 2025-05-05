//app.mainScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import * as Location from 'expo-location';
import Svg, { Circle } from 'react-native-svg';
import { getAuthUserEmail } from '../../utils/auth';
import proj4 from 'proj4';

proj4.defs(
  'EPSG:2039',
  '+proj=tmerc +lat_0=31.7343938888889 +lon_0=35.2045169444444 '
  + '+k=1.0000067 +x_0=219529.584 +y_0=626907.39 '
  + '+ellps=GRS80 +units=m +no_defs'
);

const sampleE = 179254.9219000004; 
const sampleN = 665111.2525999993;  
const targetLat = 32.0785788989309; 
const targetLon = 34.7786417155005;

const [invE, invN] = proj4(
  'EPSG:4326',
  'EPSG:2039',
  [ targetLon, targetLat ]   
);

const deltaE = invE - sampleE;
const deltaN = invN - sampleN;

function convertITMtoWGS84(easting: number, northing: number) {
  const correctedE = easting + deltaE;
  const correctedN = northing + deltaN;

  const [lon, lat] = proj4('EPSG:2039', 'EPSG:4326', [correctedE, correctedN]);
  return { latitude: lat, longitude: lon };
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}


const ShelterInfoScreen = () => {
  const [minutes, setMinutes] = useState(10);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(1);
  const [shelterLocation, setShelterLocation] = useState('תל אביב');
  const [zoneInfo, setZoneInfo] = useState<any>(null);
  const [nearestShelter, setNearestShelter] = useState<any>(null);

  useEffect(() => {
    const totalSeconds = 10 * 60;
    const updateProgress = (remainingSeconds: number) => {
      setProgress(remainingSeconds / totalSeconds);
    };

    const timer = setInterval(() => {
      setSeconds((prevSeconds) => {
        if (prevSeconds === 0) {
          if (minutes === 0) {
            clearInterval(timer);
            return 0;
          }
          setMinutes((prevMinutes) => prevMinutes - 1);
          updateProgress((minutes - 1) * 60 + 59);
          return 59;
        }
        const remainingSeconds = minutes * 60 + prevSeconds - 1;
        updateProgress(remainingSeconds);
        return prevSeconds - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [minutes]);

  useEffect(() => {
    const findNearestShelter = async () => {
      try {
        const sheltersRes = await fetch('https://ud6fou77q6.execute-api.us-east-1.amazonaws.com/prod/get-il-shelters');
        const data = await sheltersRes.json();
        const allShelters: any[] = data.items;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.error('❌ הרשאת מיקום נדחתה');
          return;
        }
        const location = await Location.getCurrentPositionAsync({});
        const userLat = location.coords.latitude;
        const userLon = location.coords.longitude;
  
        let minDistance = Infinity;
        let closestShelter = null;
  
        allShelters.forEach((shelter) => {
          const x = shelter.longitude;
          const y = shelter.latitude;
  
          const { latitude, longitude } = convertITMtoWGS84(x, y);
          
          if (isNaN(latitude) || isNaN(longitude)) return;
  
          const distance = getDistanceFromLatLonInKm(userLat, userLon, latitude, longitude);
          if (distance < minDistance) {
            minDistance = distance;
            closestShelter = { ...shelter, latitude, longitude, distance };
          }
        });
  
        if (closestShelter) {
          setNearestShelter(closestShelter);
        }
      } catch (err) {
        console.error('❌ שגיאה במציאת המקלט הקרוב:', err);
      }
    };
  
    findNearestShelter();
  }, []);
  
  const circleRadius = 45;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference * (1 - progress);

  const handleUpdate = () => {
    Alert.alert('עדכון', 'המידע עודכן בהצלחה');
  };

  const handleChat = () => {
    Alert.alert('צ\'אט', 'הצ\'אט נפתח');
  };

  const handleReport = () => {
    Alert.alert('דיווח', 'הדיווח בוצע בהצלחה');
  };

  useEffect(() => {
    const fetchCityFromServer = async () => {
      try {
        const email = await getAuthUserEmail();
        if (!email) return;

        const res = await fetch(`https://3xzztnl8bf.execute-api.us-east-1.amazonaws.com/get-user-location?email=${email}`);
        const data = await res.json();

        if (data.city) {
          setShelterLocation(data.city);

          const zonesRes = await fetch('https://x5vsugson1.execute-api.us-east-1.amazonaws.com/getAllAlertZones');
          const zonesRaw = await zonesRes.json();
          const zones = Array.isArray(zonesRaw) ? zonesRaw : JSON.parse(zonesRaw.body ?? '[]');
          const matched = zones.find((z) => z.name === data.city);
          if (matched) setZoneInfo(matched);
        }
      } catch (err) {
        console.log('❌ שגיאה בשליפת עיר מהשרת:', err);
      }
    };

    fetchCityFromServer();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>מיקומך: {shelterLocation}</Text>
        <Text style={styles.infoText}>זמן כניסה למקלט: {zoneInfo?.countdown ? `${zoneInfo.countdown} שניות` : 'לא ידוע'}</Text>
        {zoneInfo && <Text style={styles.infoText}>אזור: {zoneInfo.zone}</Text>}
      </View>
      {nearestShelter && (
  <View style={{ marginTop: 10 }}>
    <Text style={styles.infoText}>המקלט הקרוב ביותר:</Text>
    <Text style={styles.infoText}>{nearestShelter.name ?? 'ללא שם'}</Text>
    <Text style={styles.infoText}>
      מרחק: {nearestShelter.distance.toFixed(2)} ק"מ
    </Text>
  </View>
)}
      <View style={styles.mapContainer}>
        <Image
          source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/4/47/OpenStreetMap_Project_logo.svg' }}
          style={styles.mapImage}
          resizeMode="cover"
        />
      </View>

      <View style={styles.bottomContainer}>
        <View style={styles.timerContainer}>
          <Svg width={100} height={100}>
            <Circle cx="50" cy="50" r={circleRadius} stroke="#e0e0e0" strokeWidth="10" fill="none" />
            <Circle
              cx="50"
              cy="50"
              r={circleRadius}
              stroke="#00b300"
              strokeWidth="10"
              strokeDasharray={circleCircumference}
              strokeDashoffset={strokeDashoffset}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.timerText}>
            {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity style={styles.button} onPress={handleUpdate}>
            <Text style={styles.buttonText}>עדכון</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleChat}>
            <Text style={styles.buttonText}>פתיחת צ'אט</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleReport}>
            <Text style={styles.buttonText}>דיווח</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ShelterInfoScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  infoText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  mapContainer: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  bottomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    position: 'absolute',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00b300',
  },
  buttonsContainer: {
    flex: 1,
    marginLeft: 20,
  },
  button: {
    backgroundColor: '#00b300',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});
