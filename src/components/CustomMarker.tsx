import React from 'react';
import { Marker } from 'react-native-maps';
import { Shelter } from '../types/Shelter';

type CustomMarkerProps = {
  shelter: Shelter;
  pinColor: string;
  onPress?: () => void;
};

const CustomMarker: React.FC<CustomMarkerProps> = ({ shelter, onPress ,pinColor}) => {
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
