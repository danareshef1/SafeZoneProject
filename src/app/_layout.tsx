import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './homeScreen'; // Import HomeScreen component
import Login from './login'; // Import Login screen
import { TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons'; // For home icon

// Create navigators
const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

// Create Stack for the Home screen
const HomeStack = () => {
  return (
    <Stack.Navigator initialRouteName="HomeScreen">
      <Stack.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={({ navigation }) => ({
          headerShown: true, // Show header with home icon
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.navigate('Home')}>
              <Icon name="home" size={30} color="#000" style={{ marginLeft: 15 }} />
            </TouchableOpacity>
          ),
        })}
      />
    </Stack.Navigator>
  );
};

const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Drawer Navigator */}
      <Drawer.Navigator
        initialRouteName="Home" // The drawer will start with HomeStack
        screenOptions={{
          drawerPosition: 'left', // Drawer on the left
        }}
      >
        <Drawer.Screen
          name="Home"
          component={HomeStack} // This gives access to HomeScreen through the StackNavigator
          options={{
            title: 'Home', // Title in the header
            drawerLabel: 'Home', // This will show "Home" in the drawer
          }}
        />
        <Drawer.Screen
          name="Login"
          component={Login}
          options={{
            drawerLabel: 'Login',
            title: 'Login',
          }}
        />
      </Drawer.Navigator>
    </GestureHandlerRootView>
  );
};

export default App;