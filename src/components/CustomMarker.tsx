import React from 'react';
import { Marker } from 'react-native-maps';
import { Shelter } from '../types/Shelter';

type CustomMarkerProps = {
  shelter: Shelter;
  onPress?: () => void;
};

const CustomMarker: React.FC<CustomMarkerProps> = ({ shelter, onPress }) => {
  const getPinColor = () => {
    switch (shelter.status) {
      case 'red':
        return 'red';
      case 'yellow':
        return 'yellow';
      case 'green':
      default:
        return 'green';
    }
  };

  return (
    <Marker
      coordinate={{
        latitude: shelter.latitude,
        longitude: shelter.longitude,
      }}
      title={shelter.location}
      pinColor={getPinColor()} // Dynamically set pin color
      onPress={onPress}
    />
  );
};

export default CustomMarker;
