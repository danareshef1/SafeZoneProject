// src/contexts/AuthContext.tsx
// ✅ חובה להיות בראש הקובץ
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExpoPushTokenAsync } from 'expo-notifications';
import { jwtDecode } from 'jwt-decode'; 
import { login as loginAPI, signUp as signUpAPI } from '../../utils/auth';

interface JwtPayload { exp?: number; [k: string]: any }

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

interface AuthProviderProps { children: ReactNode }

function isTokenValid(token?: string | null) {
  if (!token) return false;
  try {
    const payload = jwtDecode<JwtPayload>(token);
    const now = Math.floor(Date.now() / 1000);
    // אם אין exp—נתייחס כתקף (יש טוקנים בלי exp)
    return typeof payload.exp === 'number' ? payload.exp > now : true;
  } catch {
    return false;
  }
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // בדיקת התחברות בטעינה + ניקוי טוקן שפג תוקפו
  useEffect(() => {
    const init = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!isTokenValid(token)) {
          await AsyncStorage.multiRemove(['userToken']);
          setIsLoggedIn(false);
        } else {
          setIsLoggedIn(true);
        }
      } catch {
        setIsLoggedIn(false);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email: string, password: string) => {
    await loginAPI(email, password);
    setIsLoggedIn(true);

    // אופציונלי: קבלת Expo Push Token ושליחה ל־Lambda שלך
    try {
      const expoToken = (await getExpoPushTokenAsync()).data;
      console.log('✅ Expo push token:', expoToken);
      // TODO: שליחה ל-Lambda אם צריך (email/phone/idToken כבר שמורים ב-AsyncStorage לפי utils/auth.ts)
    } catch (err) {
      console.warn('❌ Failed to get push token:', err);
    }
  };

  const signUp = async (email: string, password: string, phone: string) => {
    return signUpAPI(email, password, phone);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([
      'userToken',
      'userEmail',
      'userPhone',
      'lastSignupUsername',
      'lastSignupEmail',
      'lastSignupPhone',
    ]);
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, signUp, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
