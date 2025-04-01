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
      return 'red';
    case 'בינוני':
      return 'orange';
    case 'נמוך':
      return 'green';
    default:
      return 'green';
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
