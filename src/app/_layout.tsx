import React, { useContext, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { Stack } from 'expo-router';
import { TouchableOpacity, StyleSheet, View, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthContext, AuthProvider } from './AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackActions, DrawerActions } from '@react-navigation/native';

type RootDrawerParamList = {
  index: undefined; // Corresponds to app/index.tsx
  otherScreen: undefined; // Corresponds to app/other.tsx
  login: undefined; // Corresponds to app/login.tsx
};

const Drawer = createDrawerNavigator<RootDrawerParamList>();

const CustomDrawerContent = (props: any) => (
  <DrawerContentScrollView {...props}>
    <DrawerItemList {...props} />
  </DrawerContentScrollView>
);

const HomeStack = () => (
  <Stack>
    <Stack.Screen
      name="index" // Corresponds to app/index.tsx
      options={{
        title: 'Home',
        headerRight: () => <HomeButton />,
        headerLeft: () => <MenuButton />,
      }}
    />
  </Stack>
);

const OtherStack = () => (
  <Stack>
    <Stack.Screen
      name="otherScreen" // Corresponds to app/other.tsx
      options={{
        title: 'Q&A',
        headerRight: () => <HomeButton />,
        headerLeft: () => <MenuButton />,
      }}
    />
  </Stack>
);

const LoginStack = () => (
  <Stack>
    <Stack.Screen
      name="login" // Corresponds to app/login.tsx
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
  const navigation = useNavigation();
  return (
    <TouchableOpacity onPress={() => navigation.navigate('index')} style={styles.homeButton}>
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
        navigation.dispatch(StackActions.replace('index')); // Navigate to Home
      } else {
        navigation.dispatch(StackActions.replace('login')); // Navigate to Login
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
        headerShown: false, // Managed within Stack
      }}
    >
      {isLoggedIn ? (
        <>
          <Drawer.Screen name="index" component={HomeStack} options={{ title: 'Home' }} />
          <Drawer.Screen name="otherScreen" component={OtherStack} options={{ title: 'Q&A' }} />
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
});
