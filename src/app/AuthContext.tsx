// src/app/AuthContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sdkLogin, sdkSignUp } from '../lib/awsAuth';

interface AuthContextProps {
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, email: string, phone: string) => Promise<any>;
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

interface AuthProviderProps { children: ReactNode; }

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        setIsLoggedIn(!!token);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signUp = async (username: string, password: string, email: string, phone: string) => {
    if (!phone) throw new Error('Phone number is missing');
    return sdkSignUp(username, password, email, phone);
  };

  const login = async (username: string, password: string): Promise<void> => {
    const resp = await sdkLogin(username, password);
    const tokens = resp.AuthenticationResult;
    if (!tokens?.IdToken) throw new Error('Missing IdToken');

    await AsyncStorage.setItem('userToken', tokens.IdToken);
    if (tokens.AccessToken) await AsyncStorage.setItem('accessToken', tokens.AccessToken);
    if (tokens.RefreshToken) await AsyncStorage.setItem('refreshToken', tokens.RefreshToken);

    setIsLoggedIn(true);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['userToken', 'accessToken', 'refreshToken']);
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, signUp, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
