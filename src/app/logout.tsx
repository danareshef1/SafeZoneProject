import React, { useContext } from 'react';
import { Button, Alert } from 'react-native';
import { AuthContext } from './AuthContext';

export default function LogoutScreen() {
  const { logout } = useContext(AuthContext);

  const handleLogout = async () => {
    try {
      await logout();
      Alert.alert('Success', 'You have logged out');
    } catch (error: any) {
      Alert.alert('Logout Failed', error.message || 'Something went wrong');
    }
  };

  return <Button title="Logout" onPress={handleLogout} />;
}
