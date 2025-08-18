// ✅ חובה להיות בראש הקובץ
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExpoPushTokenAsync } from 'expo-notifications';
import { login as loginAPI, signUp as signUpAPI } from '../../utils/auth';

interface AuthContextProps {
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, phone: string) => Promise<any>;
  logout: () => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextProps>({
  isLoggedIn: false,
  login: async () => {},
  signUp: async () => {},
  logout: async () => {},
  loading: true,
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLogin = async () => {
      const token = await AsyncStorage.getItem('userToken');
      setIsLoggedIn(!!token);
      setLoading(false);
    };
    checkLogin();
  }, []);

  const login = async (email: string, password: string) => {
    await loginAPI(email, password);
    setIsLoggedIn(true);

    try {
      const expoToken = (await getExpoPushTokenAsync()).data;
      console.log('✅ Expo push token:', expoToken);
      // כאן אפשר לשלוח ל-Lambda אם תרצי לשמור device token
    } catch (err) {
      console.warn('❌ Failed to get push token:', err);
    }
  };

  const signUp = async (email: string, password: string, phone: string) => {
    return await signUpAPI(email, password, phone);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('userToken');
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, signUp, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
