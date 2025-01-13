import React, { useContext, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { Stack } from 'expo-router';
import { TouchableOpacity, StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthContext, AuthProvider } from './AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackActions, DrawerActions, NavigationProp } from '@react-navigation/native';
import HospitalsScreen from './HospitalScreen'; // Import the HospitalsScreen

type RootDrawerParamList = {
  index: undefined; // Corresponds to app/index.tsx
  other: undefined; // Corresponds to app/other.tsx
  login: undefined; // Corresponds to app/login.tsx
  hospitals: undefined; // New Hospitals Screen
};

const Drawer = createDrawerNavigator<RootDrawerParamList>();

const CustomDrawerContent = (props: any) => {
  const { logout } = useContext(AuthContext);
  const navigation = useNavigation<NavigationProp<RootDrawerParamList>>();

  const handleLogout = () => {
    logout();
    navigation.dispatch(DrawerActions.closeDrawer());
    navigation.dispatch(StackActions.replace('login'));
  };

  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <MaterialIcons name="logout" size={24} color="#000" />
        <View style={styles.logoutTextContainer}>
          <Text style={styles.logoutText}>Logout</Text>
        </View>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
};

const HomeStack = () => (
  <Stack>
    <Stack.Screen
      name="index"
      options={{
        title: 'Safe Zone',
        headerRight: () => <HomeButton />,
        headerLeft: () => <MenuButton />,
      }}
    />
  </Stack>
);

const OtherStack = () => (
  <Stack>
    <Stack.Screen
      name="otherScreen"
      options={{
        title: 'Q&A',
        headerRight: () => <HomeButton />,
        headerLeft: () => <MenuButton />,
      }}
    />
  </Stack>
);

const HospitalsStack = () => (
  <Stack>
    <Stack.Screen
      name="HospitalScreen"
      options={{
        title: 'Hospitals & Emergency',
        headerRight: () => <HomeButton />,
        headerLeft: () => <MenuButton />,
      }}
    />
  </Stack>
);

const LoginStack = () => (
  <Stack>
    <Stack.Screen
      name="login"
      options={{
        title: 'Login',
        headerLeft: () => null,
      }}
    />
  </Stack>
);

const MenuButton = () => {
  const navigation = useNavigation();
  return (
    <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}>
      <MaterialIcons name="menu" size={30} color="#000" style={{ marginLeft: 15 }} />
    </TouchableOpacity>
  );
};

const HomeButton = () => {
  const navigation = useNavigation<NavigationProp<RootDrawerParamList>>();
  return (
    <TouchableOpacity
      onPress={() => navigation.dispatch(DrawerActions.jumpTo('index'))}
      style={styles.homeButton}
    >
      <MaterialIcons name="home" size={24} color="#000" />
    </TouchableOpacity>
  );
};

const RootNavigator = () => {
  const { isLoggedIn, loading } = useContext(AuthContext);
  const navigation = useNavigation();

  useEffect(() => {
    if (!loading) {
      if (isLoggedIn) {
        navigation.dispatch(StackActions.replace('index'));
      } else {
        navigation.dispatch(StackActions.replace('login'));
      }
    }
  }, [isLoggedIn, loading, navigation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      {isLoggedIn ? (
        <>
          <Drawer.Screen name="index" component={HomeStack} options={{ title: 'Home' }} />
          <Drawer.Screen name="other" component={OtherStack} options={{ title: 'Q&A' }} />
          <Drawer.Screen name="hospitals" component={HospitalsStack} options={{ title: 'Hospitals & Emergency' }}/>
        </>
      ) : (
        <Drawer.Screen
          name="login"
          component={LoginStack}
          options={{
            swipeEnabled: false,
          }}
        />
      )}
    </Drawer.Navigator>
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
  homeButton: {
    padding: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  logoutTextContainer: {
    marginLeft: 10,
  },
  logoutText: {
    fontSize: 16,
    color: '#000',
  },
});