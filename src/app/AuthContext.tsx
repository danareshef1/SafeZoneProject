// AuthContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'us-east-1_TgQIZsQBQ',
  ClientId: '5tthevvlvskttb7ec21j5u1gtj',
};

const userPool = new CognitoUserPool(poolData);

// ✅ דגל דילוג בפיתוח בלבד (קורא ל-expo.extra.bypassAuth)
const BYPASS =
  __DEV__ && Boolean((Constants.expoConfig?.extra as any)?.bypassAuth);

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

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const init = async () => {
      try {
        // 🟢 דילוג בפיתוח: שומר טוקן דמי ומדלג על קוגניטו
        if (BYPASS) {
          await AsyncStorage.setItem('userToken', 'DEV_BYPASS_TOKEN');
          setIsLoggedIn(true);
          return;
        }

        // בדיקת סשן רגילה
        const token = await AsyncStorage.getItem('userToken');
        setIsLoggedIn(!!token);
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsLoggedIn(false);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const signUp = (username: string, password: string, email: string, phone: string) => {
    return new Promise((resolve, reject) => {
      if (!phone) {
        reject(new Error("Phone number is missing"));
        return;
      }
      const normalizedPhone = phone.startsWith('+')
        ? phone
        : `+972${phone.slice(1)}`;

      const attributeList = [
        new CognitoUserAttribute({ Name: 'email', Value: email }),
        new CognitoUserAttribute({ Name: 'phone_number', Value: normalizedPhone }),
      ];

      userPool.signUp(username, password, attributeList, [], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  const login = async (username: string, password: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const user = new CognitoUser({ Username: username, Pool: userPool });
      const authDetails = new AuthenticationDetails({ Username: username, Password: password });

      user.authenticateUser(authDetails, {
        onSuccess: async (result) => {
          await AsyncStorage.setItem('userToken', result.getIdToken().getJwtToken());
          setIsLoggedIn(true);
          resolve();
        },
        onFailure: (err) => {
          console.error('Cognito login failed', err);
          reject(err);
        },
      });
    });
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
