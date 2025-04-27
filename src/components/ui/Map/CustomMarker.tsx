// component/ui/Map/CustomMarker.tsx
import React from 'react';
import { Marker } from 'react-native-maps';
import { Shelter } from '../../../types/Shelter';

type CustomMarkerProps = {
  shelter: Shelter;
  onPress?: () => void;
};

export const getColorByStatus = (status: string): string => {
  switch (status) {
    case 'גבוה':
      return '#FF3B30'; // red
    case 'בינוני':
      return '#FFCC00'; // yellow
    case 'נמוך':
      return '#34C759'; // green
    default:
      return '#ccc'; // fallback gray
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
