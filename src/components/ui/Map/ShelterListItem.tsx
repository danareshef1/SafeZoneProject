import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, Button, ActivityIndicator } from 'react-native';
import { Shelter } from '../../../types/Shelter';

type ShelterListItemProps = {
  shelter: Shelter;
  containerStyle: ViewStyle;
  statusColor: string;
  showReportButton?: boolean;
  onReport?: () => void;
};

const ShelterListItem: React.FC<ShelterListItemProps> = ({
  shelter,
  containerStyle = {},
  statusColor,
  showReportButton = false,
  onReport,
}) => {
  const [isImageLoading, setIsImageLoading] = useState(false);

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
        <View style={styles.statusContainer}>
          <View
            style={[styles.statusCircle, { backgroundColor: statusColor }]}
          />
          <Text style={styles.status}>{shelter.status}</Text>
        </View>
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
  },
  status: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#666',
  },
});

export default ShelterListItem;
