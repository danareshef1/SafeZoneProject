// src/app/_layout.tsx

import React, { useContext, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { TouchableOpacity, StyleSheet, View, ActivityIndicator, Text, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthContext, AuthProvider } from './AuthContext';
import { useRouter, useSegments } from 'expo-router';

const CustomDrawerContent = () => {
  const { logout } = useContext(AuthContext);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const navigateTo = (path: string) => {
    router.push(path as any);
  };

  return (
    <ScrollView contentContainerStyle={styles.drawerContainer}>
      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('/')}>
        <MaterialIcons name="home" size={24} color="#000" />
        <Text style={styles.drawerItemText}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('/QnAScreen')}>
        <MaterialIcons name="question-answer" size={24} color="#000" />
        <Text style={styles.drawerItemText}>Q&A</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('/HospitalScreen')}>
        <MaterialIcons name="local-hospital" size={24} color="#000" />
        <Text style={styles.drawerItemText}>Hospitals & Emergency</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('/AlarmHistoryScreen')}>
        <MaterialIcons name="history" size={24} color="#000" />
        <Text style={styles.drawerItemText}>Alarm History</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('/mainScreen')}>
        <MaterialIcons name="dashboard" size={24} color="#000" />
        <Text style={styles.drawerItemText}>Main Screen</Text>
      </TouchableOpacity>
      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={24} color="#000" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const RootNavigator = () => {
  const { isLoggedIn, loading } = useContext(AuthContext);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!loading) {
      if (isLoggedIn) {
        // If user is logged in and tries to access login screen, redirect to home
        if (segments[0] === 'login') {
          router.replace('/');
        }
      } else {
        // If user is not logged in and tries to access protected screens, redirect to login
        if (segments[0] !== 'login') {
          router.replace('/login');
        }
      }
    }
  }, [isLoggedIn, loading, router, segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <Drawer
      drawerContent={() => (isLoggedIn ? <CustomDrawerContent /> : undefined)}
      screenOptions={{
        headerShown: true,
      }}
    >
      {isLoggedIn ? (
        <>
          <Drawer.Screen name="/" options={{ title: 'Safe Zone' }} />
          <Drawer.Screen name="/QnAScreen" options={{ title: 'Q&A' }} />
          <Drawer.Screen name="/HospitalScreen" options={{ title: 'Hospitals & Emergency' }} />
          <Drawer.Screen name="/AlarmHistoryScreen" options={{ title: 'Alarm History' }} />
          <Drawer.Screen name="/mainScreen" options={{ title: 'Main Screen' }} />
        </>
      ) : (
        <Drawer.Screen
          name="/login"
          options={{
            title: 'Login',
            headerLeft: () => null, // Hide the back button on login screen
          }}
        />
      )}
    </Drawer>
  );
};

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerContainer: {
    flexGrow: 1,
    paddingTop: 50,
    paddingHorizontal: 10,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  drawerItemText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#000',
  },
  logoutSection: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    paddingVertical: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#000',
  },
});
