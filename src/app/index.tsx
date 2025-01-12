import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const HomeScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>This is the Home Screen</Text>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '50%',
  },
  loadingContainer: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '90%', // Adjusted for the button space
  },
  text: {
    fontSize: 20,
    marginBottom: 20,
  },
});

export default HomeScreen;