import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Alert,
  ActivityIndicator,
  TouchableWithoutFeedback,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import ShelterListItem from '../components/ui/Map/ShelterListItem';
import CustomMarker from '../components/ui/Map/CustomMarker';
import { Shelter } from '../types/Shelter';
import { useFocusEffect } from '@react-navigation/native';
import { getColorByStatus } from '../components/ui/Map/CustomMarker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { sendLocationToBackend } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import proj4 from 'proj4';


const API_URL = 'https://ud6fou77q6.execute-api.us-east-1.amazonaws.com/prod/get-il-shelters';

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


type Alarm = {
  id: string;
  date: string;
  time: string;
  descriptions: string[];
  expanded?: boolean;
};

const HomeScreen: React.FC = () => {
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [mapRegion, setMapRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const snapPoints = useMemo(() => ['8%', '50%', '90%'], []);
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alarm[]>([]);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('https://j5tn0rj9rc.execute-api.us-east-1.amazonaws.com/prod/alerts');
      const rawData = await response.json();
      const body = typeof rawData.body === 'string' ? JSON.parse(rawData.body) : rawData.body ?? rawData;

      if (!Array.isArray(body)) {
        console.error('❌ Alerts are not in array format:', body);
        return;
      }

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

        const [dateIL, timeIL] = formatter.format(timestamp).split(',').map(s => s.trim());
        const key = `${dateIL} ${timeIL}`;

        if (!grouped[key]) {
          grouped[key] = {
            id: index.toString(),
            date: dateIL,
            time: timeIL,
            descriptions: [],
            expanded: false,
          };
        }

        grouped[key].descriptions.push(`${item.city}`);
      });

      const groupedAlerts = Object.values(grouped).sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split('.');
        const [dayB, monthB, yearB] = b.date.split('.');

        const formatTime = (time: string) => {
          const [h, m] = time.split(':');
          return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        };

        const dateStrA = `${yearA}-${monthA}-${dayA}T${formatTime(a.time)}`;
        const dateStrB = `${yearB}-${monthB}-${dayB}T${formatTime(b.time)}`;

        return new Date(dateStrB).getTime() - new Date(dateStrA).getTime();
      });

      setAlerts(groupedAlerts);
    } catch (error) {
      console.error('שגיאה בקבלת התראות:', error);
    }
  };

  const fetchShelters = async () => {
    try {
      let allShelters: Shelter[] = [];
      let startKey: any = null;

      do {
        const url = startKey ? `${API_URL}?startKey=${encodeURIComponent(JSON.stringify(startKey))}` : API_URL;
        const response = await fetch(url);
        const data = await response.json();
        allShelters = [...allShelters, ...data.items];
        startKey = data.lastEvaluatedKey || null;
      } while (startKey);

      const convertedShelters = allShelters
  .map((shelter) => {
    // parse string values from DynamoDB before converting
    const x = shelter.longitude;
    const y = shelter.latitude;
    const { latitude, longitude } = convertITMtoWGS84(x, y);
    return { ...shelter, latitude, longitude } as Shelter;
  })
  .filter(s => !isNaN(s.latitude) && !isNaN(s.longitude));

      
      console.log("Shelters example:", convertedShelters.slice(0, 5));

      setShelters(convertedShelters);
      await AsyncStorage.setItem('shelters', JSON.stringify(convertedShelters));
    } catch (error) {
      console.error('Error fetching shelters:', error);
      Alert.alert('Error', 'Unable to fetch shelter data.');
    }
  };

  useEffect(() => {
    fetchShelters();
    fetchAlerts();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchShelters();
    }, [])
  );

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied.');
        setMapRegion({
          latitude: 32.0853,
          longitude: 34.7818,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      } else {
        const location = await Location.getCurrentPositionAsync({});
        setMapRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });

        await sendLocationToBackend(location.coords.latitude, location.coords.longitude);
      }
    })();
  }, []);

  const handleReport = () => {
    if (selectedShelter) {
      router.push({
        pathname: '/report-shelter/[id]',
        params: { id: selectedShelter.id },
      });
    }
  };

  const handleDeselectShelter = () => setSelectedShelter(null);

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
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });

      await sendLocationToBackend(location.coords.latitude, location.coords.longitude);

      Alert.alert('Success', 'Location refreshed!');
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location.');
    }
  };

  if (!mapRegion) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Fetching your location...</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={handleDeselectShelter}>
      <View style={styles.container}>
      <MapView style={styles.map} region={mapRegion}>
  {shelters.map((shelter) => (
    <Marker
      key={`${shelter.id}`}
      coordinate={{ latitude: shelter.latitude, longitude: shelter.longitude }}
      title={shelter.name}
      description={shelter.status}
    />
  ))}
</MapView>


        {alerts.length > 0 && (
          <View style={[styles.alertsContainer, { maxHeight: 250 }]}> 
            <Text style={styles.alertsTitle}>📢 התרעות אחרונות</Text>
            <ScrollView>
              {alerts.map((alert, idx) => {
                const isMultiple = alert.descriptions.length > 1;
                const Container = isMultiple ? TouchableOpacity : View;
                return (
                  <Container
                    key={alert.id}
                    style={styles.alertItem}
                    {...(isMultiple && {
                      onPress: () => setAlerts((prev) => prev.map((a, i) => ({
                        ...a,
                        expanded: i === idx ? !a.expanded : false,
                      })))
                    })}
                  >
                    <Text style={styles.alertIcon}>🚨</Text>
                    <View style={styles.alertTextContainer}>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        {isMultiple && alert.expanded ? (
                          alert.descriptions.map((desc, i) => (
                            <Text key={i} style={styles.alertDescription}>{desc}</Text>
                          ))
                        ) : (
                          <Text style={styles.alertDescription}>
                            {isMultiple ? `${alert.descriptions.length} איזורי התרעה` : alert.descriptions[0]}
                          </Text>
                        )}
                        <Text style={styles.alertTime}>{alert.date} - {alert.time}</Text>
                      </View>
                      {isMultiple && (
                        <Ionicons
                          name={alert.expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                          size={20}
                          color="#666"
                          style={{ marginRight: 10 }}
                        />
                      )}
                    </View>
                  </Container>
                );
              })}
            </ScrollView>
          </View>
        )}

        {selectedShelter && (
          <View style={styles.selectedShelter}>
            <ShelterListItem
              shelter={selectedShelter}
              containerStyle={{}}
              statusColor={getColorByStatus(selectedShelter?.status ?? '')}
            />
          </View>
        )}

        <BottomSheet index={0} snapPoints={snapPoints}>
          <View style={styles.contentContainer}>
            <Text style={styles.listTitle}>Over {shelters.length} shelters</Text>
            <BottomSheetFlatList
              data={shelters}
              contentContainerStyle={{ gap: 10, padding: 10 }}
              renderItem={({ item }) => (
                <ShelterListItem
                  shelter={item}
                  containerStyle={{}}
                  statusColor={getColorByStatus(item.status)}
                />
              )}
            />
          </View>
        </BottomSheet>

      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '50%' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  alertsContainer: { backgroundColor: '#f9f9f9', margin: 10, padding: 12, borderRadius: 12 },
  alertsTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 },
  alertItem: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 8 },
  alertIcon: { fontSize: 22, marginLeft: 10 },
  alertTextContainer: { flex: 1, alignItems: 'flex-end', flexDirection: 'row-reverse' },
  alertDescription: { fontSize: 15, fontWeight: '500', color: '#444' },
  alertTime: { fontSize: 13, color: '#888' },
  selectedShelter: { position: 'absolute', bottom: 120, right: 10, left: 10 },
  contentContainer: { flex: 1 },
  listTitle: { textAlign: 'center', fontSize: 16, marginVertical: 5 },
});

export default HomeScreen;
