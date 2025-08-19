// utils/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_SIGN_UP  = 'https://wo6785je4a.execute-api.us-east-1.amazonaws.com/sign-up';
const API_LOG_IN   = 'https://1kbva3i505.execute-api.us-east-1.amazonaws.com/log-in';
const API_CONFIRM_SIGN_UP         = 'https://znh8cmzyxi.execute-api.us-east-1.amazonaws.com/confirm-sign-up';
const API_FORGOT_PASSWORD         = 'https://gevzjt69c1.execute-api.us-east-1.amazonaws.com/forgot-password';
const API_CONFIRM_FORGOT_PASSWORD = 'https://aju1szb7v7.execute-api.us-east-1.amazonaws.com/confirm-forgot-password';
const API_RESEND_CONFIRM_CODE     = 'https://1mg4gcdkga.execute-api.us-east-1.amazonaws.com/default/resend-confirm-code';

const normalizeEmail = (email: string) => (email || '').trim().toLowerCase();
const normalizePhone = (phone: string) => {
  const raw = (phone || '').replace(/\s|-/g, '');
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  return raw.startsWith('0') ? `+972${raw.slice(1)}` : raw;
};

async function toJsonOrText(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { message: text }; }
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, ms = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export const signUp = async (email: string, password: string, phone: string) => {
  const payload = {
    email: normalizeEmail(email),
    password,
    phone: normalizePhone(phone),
  };

  const res = await fetchWithTimeout(API_SIGN_UP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await toJsonOrText(res);
  if (!res.ok) throw new Error((data as any).error || (data as any).message || 'Sign up failed');

  // 🆕 נשמור פרטים לשימוש בהמשך (DeviceTokens / אימות)
  if ((data as any)?.username) {
    await AsyncStorage.setItem('lastSignupUsername', String((data as any).username));
  }
  await AsyncStorage.setItem('lastSignupEmail', payload.email);
  if (payload.phone) {
    await AsyncStorage.setItem('lastSignupPhone', payload.phone);
    await AsyncStorage.setItem('userPhone', payload.phone); // ← 🆕 שמירה קבועה לשימוש באפליקציה
  }

  return data;
};

export const confirmSignUp = async (usernameOrEmail: string, code: string) => {
  const res = await fetchWithTimeout(API_CONFIRM_SIGN_UP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: (usernameOrEmail || '').trim(),
      code: (code || '').trim(),
    }),
  });
  const data = await toJsonOrText(res);
  if (!res.ok) throw new Error((data as any).error || 'Confirm sign up failed');
  return data;
};

export const resendConfirmationCode = async (usernameOrEmail: string) => {
  const res = await fetchWithTimeout(API_RESEND_CONFIRM_CODE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: (usernameOrEmail || '').trim() }),
  });
  const data = await toJsonOrText(res);
  if (!res.ok) throw new Error((data as any).error || 'Resend code failed');
  return data;
};

export const login = async (email: string, password: string) => {
  const res = await fetchWithTimeout(API_LOG_IN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizeEmail(email), password }),
  });

  const data = await toJsonOrText(res);
  if (!res.ok) {
    const msg = (data as any)?.error || (data as any)?.message || 'Login failed';
    throw new Error(msg);
  }

  const idToken = (data as any).idToken || (data as any).token;
  if (!idToken) throw new Error('No token returned from login');

  await AsyncStorage.setItem('userToken', idToken);
  await AsyncStorage.setItem('userEmail', normalizeEmail(email));
  // אם את מקבלת טלפון מהשרת בלוגאין, את יכולה לשמור כאן:
  // if ((data as any)?.phone) await AsyncStorage.setItem('userPhone', String((data as any).phone));
  return data;
};

export const forgotPassword = async (email: string) => {
  const res = await fetchWithTimeout(API_FORGOT_PASSWORD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizeEmail(email) }),
  });
  const data = await toJsonOrText(res);
  if (!res.ok) throw new Error((data as any).error || 'Forgot password failed');
  return data;
};

export const confirmForgotPassword = async (email: string, code: string, newPassword: string) => {
  const res = await fetchWithTimeout(API_CONFIRM_FORGOT_PASSWORD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: normalizeEmail(email),
      code: (code || '').trim(),
      newPassword,
    }),
  });
  const data = await toJsonOrText(res);
  if (!res.ok) throw new Error((data as any).error || 'Password reset failed');
  return data;
};

export const logout = async () => {
  await AsyncStorage.multiRemove([
    'userToken',
    'userEmail',
    'userPhone',          // ← 🆕
    'lastSignupUsername',
    'lastSignupEmail',
    'lastSignupPhone',
  ]);
};

// 🆕 Utilities
export const getUserEmail  = async () => (await AsyncStorage.getItem('userEmail'))  || (await AsyncStorage.getItem('lastSignupEmail')) || '';
export const getUserPhone  = async () => (await AsyncStorage.getItem('userPhone'))  || (await AsyncStorage.getItem('lastSignupPhone')) || '';
export const getIdToken    = async () => (await AsyncStorage.getItem('userToken')) || '';
