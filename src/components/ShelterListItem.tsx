import { Shelter } from '../types/Shelter';
import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle } from 'react-native';


type ShelterListItemProps = {
  shelter: Shelter;
  containerStyle :  ViewStyle;
};

const ShelterListItem: React.FC<ShelterListItemProps> =
 ({ shelter , containerStyle = {}}) => {
  return (
    <View style={[styles.card,containerStyle]}>
      <Image source={{ uri: shelter.image }} style={styles.image} />
      <View style={styles.rightContainer}>
        <Text style={styles.title}>{shelter.location}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    flexDirection: 'row',
    borderRadius:20,
    overflow: 'hidden',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: 'black',
  },
  image: {
    width: 150,
    aspectRatio: 1,
    borderRadius: 8,
  },
  rightContainer: {
    padding: 10,
  },
});

export default ShelterListItem;
