import { Shelter } from '../types/Shelter';
import React from 'react';
import { Marker } from 'react-native-maps';

type CustomMarkerProps = {
  shelter: Shelter;
  onPress?: () => void;
};

const CustomMarker: React.FC<CustomMarkerProps> = ({ shelter, onPress }) => {
  return (
    <Marker
      onPress={onPress}
      coordinate={{
        latitude: shelter.latitude,
        longitude: shelter.longitude,
      }}
      title={shelter.location}
      description="Shelter Location"
    />
  );
};

export default CustomMarker;
