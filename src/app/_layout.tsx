import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { MaterialIcons } from '@expo/vector-icons'; // For home icon

// Create Stack for the Home screen
const HomeStack = () => {
  return (
    <Stack >
      <Stack.Screen
        name="index"
        options={({ navigation }) => ({
          headerShown: true, // Show header with home icon
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.navigate('Home')}>
              <MaterialIcons name="home" size={30} color="#000" style={{ marginLeft: 15 }} />
            </TouchableOpacity>
          ),
        })}
      />
    </Stack>
  );
};

const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Drawer Navigator */}
      <Drawer
        initialRouteName="login" // The drawer will start with HomeStack
        screenOptions={{
          drawerPosition: 'left', // Drawer on the left
        }}
      >
        <Drawer.Screen
          name="login"
          options={{
            title: 'Home', // Title in the header
            drawerLabel: 'Home', // This will show "Home" in the drawer
          }}
        /> 
      </Drawer>
    </GestureHandlerRootView>
  );
};

export default App;