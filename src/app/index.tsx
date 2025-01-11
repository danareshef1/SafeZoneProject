import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView from 'react-native-maps';
import shelters from '../../assets/data/shelters.json';
import ShelterListItem from '../components/ShelterListItem';
import CustomMarker from '../components/CustomMarker';
import { Shelter } from '../types/Shelter';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';

const HomeScreen: React.FC = () => {
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [mapRegion] = useState({
    latitude: 32.0853, // Tel Aviv
    longitude: 34.7818,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  const snapPoints = useMemo(() => ['10%', '50%', '90%'], []);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={mapRegion}
      >
        {shelters.map((shelter) => (
          <CustomMarker
            key={shelter.id}
            shelter={shelter}
            onPress={() => setSelectedShelter(shelter)}
          />
        ))}
      </MapView>

      {selectedShelter && (
        <View style={styles.selectedShelter}>
          <ShelterListItem shelter={selectedShelter} containerStyle ={{}} />
        </View>
      )}

      <BottomSheet index={0} snapPoints={snapPoints}>
        <View style={styles.contentContainer}>
          <Text style={styles.listTitle}>Over {shelters.length} shelters</Text>
          <BottomSheetFlatList
            data={shelters}
            contentContainerStyle={{ gap: 10, padding: 10 }}
            renderItem={({ item }) => (
              <ShelterListItem shelter={item} containerStyle={{}} />
            )}
          />
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '50%',
  },
  selectedShelter: {
    position: 'absolute',
    bottom: 70,
    right: 10,
    left: 10,
  },
  contentContainer: {
    flex: 1,
  },
  listTitle: {
    textAlign: 'center',
    fontFamily: 'InterSemi',
    fontSize: 16,
    marginVertical: 5,
    marginBottom: 20,
  },
});

export default HomeScreen;
