//app/AuthContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';

// Replace with your own Cognito User Pool details.
const poolData = {
  UserPoolId: 'us-east-1_D2gEiWghw',
  ClientId: '3ari019pia44dhfpb0okane3ir',
};

const userPool = new CognitoUserPool(poolData);

interface AuthContextProps {
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, email: string) => Promise<any>;
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
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        setIsLoggedIn(!!token);
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsLoggedIn(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const signUp = (username: string, password: string, email: string) => {
    return new Promise((resolve, reject) => {
      const attributeList = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: email,
        }),
      ];

      userPool.signUp(username, password, attributeList, [], (err, result) => {
        if (err) {
          console.error('Cognito sign up failed', err);
          reject(err);
        } else {
          console.log('Sign Up Success:', result);
          resolve(result);
        }
      });
    });
  };

  const login = async (username: string, password: string) => {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({ Username: username, Pool: userPool });
      const authDetails = new AuthenticationDetails({ Username: username, Password: password });

      user.authenticateUser(authDetails, {
        onSuccess: async (result) => {
          await AsyncStorage.setItem('userToken', result.getIdToken().getJwtToken());
          setIsLoggedIn(true);
          resolve(result);
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
