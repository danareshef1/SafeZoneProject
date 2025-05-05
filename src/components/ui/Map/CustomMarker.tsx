import React from 'react';
import { Marker } from 'react-native-maps';
import { Shelter } from '../../../types/Shelter';

type CustomMarkerProps = {
  shelter: Shelter;
  onPress?: () => void;
};

const CustomMarker: React.FC<CustomMarkerProps> = ({ shelter, onPress }) => {
  const pinColor = '#34C759'; // תמיד ירוק

  return (
    <Marker
      coordinate={{
        latitude: shelter.latitude,
        longitude: shelter.longitude,
      }}
      pinColor={pinColor}
      onPress={onPress}
    />
  );
};

export default CustomMarker;
