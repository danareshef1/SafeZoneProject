// components/ui/Map/ShelterListItem.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, Button, ActivityIndicator } from 'react-native';
import { Shelter } from '../../../types/Shelter';

type ShelterListItemProps = {
  shelter: Shelter;
  containerStyle: ViewStyle;
  showReportButton?: boolean;
  onReport?: () => void;
  distance?: number | null;  
};

const ShelterListItem: React.FC<ShelterListItemProps> = ({
  shelter,
  containerStyle = {},
  showReportButton = false,
  onReport,
  distance,
}) => {
  const [isImageLoading, setIsImageLoading] = useState(false);
  const statusColor = '#34C759'; // תמיד ירוק ✅

  return (
    <View style={[styles.card, containerStyle]}>
      {shelter.image && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: shelter.image }}
            style={styles.image}
            onLoadStart={() => setIsImageLoading(true)}
            onLoadEnd={() => setIsImageLoading(false)}
            blurRadius={isImageLoading ? 5 : 0}
          />
          {isImageLoading && (
            <ActivityIndicator
              size="small"
              color="#0000ff"
              style={styles.imageLoaderOverlay}
            />
          )}
        </View>
      )}
<View style={styles.rightContainer}>
  <Text style={styles.title}>{shelter.name}</Text>
  
  {distance != null && (
    <Text style={styles.distanceText}>
      {distance < 1000
        ? `${distance} מטרים ממך`
        : `${(distance / 1000).toFixed(2)} ק״מ ממך`}
    </Text>
  )}
  
  {showReportButton && <Button title="Report Shelter" onPress={onReport} />}
</View>

    </View>
  );
};


const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 10,
    marginVertical: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  imageContainer: {
    width: 100,
    height: 100,
    margin: 10,
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageLoaderOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -10,
    marginTop: -10,
  },
  rightContainer: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#333',
    marginBottom: 5,
  },
  distanceText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  
});

export default ShelterListItem;
