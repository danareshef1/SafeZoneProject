// utils/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import jwt_decode from 'jwt-decode'; 

type CognitoIdTokenPayload = {
  email: string;
  [key: string]: any;
};

export const getAuthUserEmail = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) return null;

    const decoded = jwt_decode<CognitoIdTokenPayload>(token);
    return decoded.email;
  } catch (error) {
    console.error('Failed to get user email from token:', error);
    return null;
  }
};
