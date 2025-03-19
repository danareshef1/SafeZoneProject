import React, { useContext, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import {
  TouchableOpacity,
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthContext, AuthProvider } from './AuthContext';
import { useRouter, useSegments } from 'expo-router';

// A simple HomeButton to navigate to the home screen.
const HomeButton = () => {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.push('/')} style={styles.homeButton}>
      <MaterialIcons name="home" size={24} color="#000" />
    </TouchableOpacity>
  );
};

// Custom drawer content with several navigation options and logout.
const CustomDrawerContent = () => {
  const { logout } = useContext(AuthContext);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const navigateTo = (path: string) => {
    router.push(path);
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

// The RootNavigator handles redirection based on authentication status.
const RootNavigator = () => {
  const { isLoggedIn, loading } = useContext(AuthContext);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!loading) {
      if (isLoggedIn) {
        // Redirect away from auth screens if logged in.
        if (
          segments[0] === 'login' ||
          segments[0] === 'signUpScreen' ||
          segments[0] === 'verifySignUpScreen'
        ) {
          router.replace('/');
        }
      } else {
        // If not logged in, only allow access to auth screens.
        if (
          segments[0] !== 'login' &&
          segments[0] !== 'signUpScreen' &&
          segments[0] !== 'verifySignUpScreen'
        ) {
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
        headerRight: () => <HomeButton />,
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
        <>
          <Drawer.Screen name="/login" options={{ title: 'Login', headerLeft: () => null }} />
          <Drawer.Screen name="/signUpScreen" options={{ title: 'Sign Up' }} />
          <Drawer.Screen name="/verifySignUpScreen" options={{ title: 'Verify Sign Up' }} />
        </>
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
  homeButton: {
    marginRight: 15,
  },
});
