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
      case 'High Load (Red)':
        return 'red';
      case 'Medium Load (Yellow)':
        return 'yellow';
      case 'Low Load (Green)':
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
