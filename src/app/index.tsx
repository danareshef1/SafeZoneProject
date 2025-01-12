import React, { useContext } from 'react';
import { View, StyleSheet, Button } from 'react-native';
import { AuthContext } from './AuthContext';
import { useNavigation } from '@react-navigation/native';
import MapView from 'react-native-maps';

const HomeScreen: React.FC = () => {
  const { logout } = useContext(AuthContext);
  const navigation = useNavigation();

  const handleLogout = async () => {
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' as never }], // Navigate to Login
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 32.066157,
          longitude: 34.769723,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      />
      <View style={styles.buttonContainer}>
        <Button title="Log Out" onPress={handleLogout} />
      </View>
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
    height: '90%', // Adjusted for the button space
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 20, // Positioned at the bottom
    alignSelf: 'center', // Center horizontally
    width: '40%', // Smaller width
  },
});
