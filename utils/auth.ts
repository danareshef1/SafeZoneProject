// utils/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import jwt_decode from 'jwt-decode';
import { CognitoUserPool } from 'amazon-cognito-identity-js';

type IdTokenClaims = {
  email?: string;
  phone_number?: string;
  sub?: string;
  [k: string]: any;
};

const poolData = {
  UserPoolId: 'us-east-1_TgQIZsQBQ',
  ClientId: '5tthevvlvskttb7ec21j5u1gtj',
};
const userPool = new CognitoUserPool(poolData);

export const normalizeToE164IL = (raw?: string | null): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (raw.trim().startsWith('+')) return raw.trim();
  if (digits.startsWith('0') && digits.length >= 9) return `+972${digits.slice(1)}`;
  if (digits.startsWith('972')) return `+${digits}`;
  return `+${digits}`;
};

export const getAuthUserEmail = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) return null;
    const decoded = jwt_decode<IdTokenClaims>(token);
    return decoded.email ?? null;
  } catch (e) {
    console.error('Failed to get user email from token:', e);
    return null;
  }
};

export const getAuthUserSub = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) return null;
    const decoded = jwt_decode<IdTokenClaims>(token);
    return decoded.sub ?? null;
  } catch {
    return null;
  }
};

/**
 * מחזיר את phone_number של המשתמש:
 * 1) מנסה מה-ID Token (גם אם לא מאומת — לפעמים קיים).
 * 2) אם אין — שולף ישירות מ-Cognito דרך SDK (לא תלוי אימות SMS).
 */
export const getAuthUserPhone = async (): Promise<string | null> => {
  try {
    // ניסיון 1: מהטוקן
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      const decoded = jwt_decode<IdTokenClaims>(token);
      const fromToken = decoded.phone_number;
      if (fromToken) return normalizeToE164IL(fromToken);
    }
  } catch (e) {
    console.log('decode token failed (non-fatal)', e);
  }

  // ניסיון 2: מה-Cognito SDK (לא דורש אימות טלפון)
  try {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) return null;

    return await new Promise<string | null>((resolve) => {
      currentUser.getSession(() => {
        currentUser.getUserAttributes((err, attrs) => {
          if (err || !attrs) return resolve(null);
          const phone = attrs.find(a => a.getName() === 'phone_number')?.getValue();
          resolve(normalizeToE164IL(phone || null));
        });
      });
    });
  } catch (e) {
    console.error('Failed to read phone from Cognito SDK:', e);
    return null;
  }
};
