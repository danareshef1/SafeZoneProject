import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, Button } from 'react-native';
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
  return (
    <View style={[styles.card, containerStyle]}>
      <Image source={{ uri: shelter.image }} style={styles.image} />
      <View style={styles.rightContainer}>
        <Text style={styles.title}>{shelter.location}</Text>
        <View style={styles.statusContainer}>
          <View
            style={[styles.statusCircle, { backgroundColor: statusColor }]} // Dynamic color for the circle
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
  image: {
    width: 100,
    aspectRatio: 1,
    borderRadius: 10,
    margin: 10,
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
