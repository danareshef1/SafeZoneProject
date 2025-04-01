import React from 'react';
import { Marker } from 'react-native-maps';
import { Shelter } from '../../../types/Shelter';

type CustomMarkerProps = {
  shelter: Shelter;
  onPress?: () => void;
};

const getColorByStatus = (status: string) => {
  switch (status) {
    case 'גבוה':
      return '#FF3B30'; // Red
    case 'בינוני':
      return '#FFCC00'; // Yellow/Orange
    case 'נמוך':
      return '#34C759'; // Green
    default:
      return '#34C759'; // Default to Green
  }
};


const CustomMarker: React.FC<CustomMarkerProps> = ({ shelter, onPress }) => {
  const pinColor = getColorByStatus(shelter.status);

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
