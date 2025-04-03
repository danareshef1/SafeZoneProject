// app/_layout.tsx
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
import ContactsButton from './contactsButton';
import { ShelterProvider } from './contexts/ShelterContext';
import * as Notifications from 'expo-notifications';

const HomeButton = () => {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.push('/')} style={styles.homeButton}>
      <MaterialIcons name="home" size={24} color="#fff" />
    </TouchableOpacity>
  );
};

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
        <MaterialIcons name="home" size={24} color="#333" />
        <Text style={styles.drawerItemText}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('/QnAScreen')}>
        <MaterialIcons name="question-answer" size={24} color="#333" />
        <Text style={styles.drawerItemText}>Q&A</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('/HospitalScreen')}>
        <MaterialIcons name="local-hospital" size={24} color="#333" />
        <Text style={styles.drawerItemText}>Hospitals & Emergency</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('/AlarmHistoryScreen')}>
        <MaterialIcons name="history" size={24} color="#333" />
        <Text style={styles.drawerItemText}>Alarm History</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('/MyReportsScreen')}>
   <MaterialIcons name="assignment" size={24} color="#333" />
       <Text style={styles.drawerItemText}>My Reports</Text>
        </TouchableOpacity>

      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={24} color="#333" />
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
  
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const screen = notification.request.content.data?.screen;
      console.log('📥 פוש ב־Foreground:', screen);
  
      if (screen === 'ShelterInfo') {
        router.push('/mainScreen');
      }
    });
  
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      console.log('📥 פוש בלחיצה:', screen);
  
      if (screen === 'ShelterInfo') {
        router.push('/mainScreen');
      }
    });
  
    return () => {
      Notifications.removeNotificationSubscription(receivedSubscription);
      Notifications.removeNotificationSubscription(responseSubscription);
    };
  }, []);
  

  useEffect(() => {
    
    if (!loading) {
      if (isLoggedIn) {
        // Redirect away from auth screens if logged in
        if (
          segments[0] === 'login' ||
          segments[0] === 'signUpScreen' ||
          segments[0] === 'verifySignUpScreen' ||
          segments[0] === 'forgotPassword' ||
          segments[0] === 'verification' ||
          segments[0] === 'newPassword'
        ) {
          router.replace('/');
        }
      } else {
        // If not logged in, only allow access to auth screens
        if (
          segments[0] !== 'login' &&
          segments[0] !== 'signUpScreen' &&
          segments[0] !== 'verifySignUpScreen' &&
          segments[0] !== 'forgotPassword' &&
          segments[0] !== 'verification' &&
          segments[0] !== 'newPassword'
        ) {
          router.replace('/login');
        }
      }
    }
  }, [isLoggedIn, loading, router, segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#11998e" />
      </View>
    );
  }
  return (
    <Drawer
      drawerContent={() => (isLoggedIn ? <CustomDrawerContent /> : undefined)}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#11998e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        headerTitle: 'Safe Zone',
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ContactsButton />
            <HomeButton />
          </View>
        ),
      }}
    >
      {isLoggedIn ? (
        <>
          <Drawer.Screen name="/" options={{ title: 'Safe Zone' }} />
          <Drawer.Screen name="/QnAScreen" options={{ title: 'Safe Zone' }} />
          <Drawer.Screen name="/HospitalScreen" options={{ title: 'Safe Zone' }} />
          <Drawer.Screen name="/AlarmHistoryScreen" options={{ title: 'Safe Zone' }} />
          <Drawer.Screen name="/MyReportsScreen" options={{ title: 'Safe Zone' }} />
        </>
      ) : (
        <>
          <Drawer.Screen name="/login" options={{ title: 'Safe Zone', headerLeft: () => null }} />
          <Drawer.Screen name="/signUpScreen" options={{ title: 'Safe Zone' }} />
          <Drawer.Screen name="/verifySignUpScreen" options={{ title: 'Safe Zone' }} />
          <Drawer.Screen name="/forgotPassword" options={{ title: 'Safe Zone' }} />
          <Drawer.Screen name="/verification" options={{ title: 'Safe Zone' }} />
          <Drawer.Screen name="/newPassword" options={{ title: 'Safe Zone' }} />
        </>
      )}
    </Drawer>
  );
};

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
      <ShelterProvider>
        <RootNavigator />
        </ShelterProvider>
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
    color: '#333',
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
    color: '#333',
  },
  homeButton: {
    marginRight: 15,
  },
});
