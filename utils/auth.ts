// utils/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_SIGN_UP  = 'https://wo6785je4a.execute-api.us-east-1.amazonaws.com/sign-up';
const API_LOG_IN   = 'https://1kbva3i505.execute-api.us-east-1.amazonaws.com/log-in';
const API_CONFIRM_SIGN_UP         = 'https://znh8cmzyxi.execute-api.us-east-1.amazonaws.com/confirm-sign-up';
const API_FORGOT_PASSWORD         = 'https://gevzjt69c1.execute-api.us-east-1.amazonaws.com/forgot-password';
const API_CONFIRM_FORGOT_PASSWORD = 'https://aju1szb7v7.execute-api.us-east-1.amazonaws.com/confirm-forgot-password';

// עוזר קטן: נירמול אימייל/טלפון בצד הקליינט כדי למנוע דחייה מ-Cognito
const normalizeEmail = (email: string) => (email || '').trim().toLowerCase();
const normalizePhone = (phone: string) => {
  const raw = (phone || '').replace(/\s|-/g, '');
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  // ישראל: 05xxxxxxx -> +9725xxxxxxx
  return raw.startsWith('0') ? `+972${raw.slice(1)}` : raw;
};

async function toJsonOrText(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { message: text }; }
}

export const signUp = async (email: string, password: string, phone: string) => {
  const res = await fetch(API_SIGN_UP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password, phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Sign up failed');

  // נחזיר את תוכן השרת כולל username שנוצר
  return data; // data.username קיים כאן
};

export const confirmSignUp = async (usernameOrEmail: string, code: string) => {
  const res = await fetch(API_CONFIRM_SIGN_UP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: (usernameOrEmail || '').trim(), // 👈 שולחים username אם יש
      code: (code || '').trim()
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Confirm sign up failed');
  return data;
};



export const login = async (email: string, password: string) => {
  const res = await fetch(API_LOG_IN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizeEmail(email), password }),
  });

  const data = await toJsonOrText(res);
  if (!res.ok) {
    const msg = data?.error || data?.message || 'Login failed';
    throw new Error(msg);
  }

  const idToken = (data as any).idToken || (data as any).token;
  if (!idToken) throw new Error('No token returned from login');
  await AsyncStorage.setItem('userToken', idToken);
  return data;
};

export const forgotPassword = async (email: string) => {
  const res = await fetch(API_FORGOT_PASSWORD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizeEmail(email) }),
  });
  const data = await toJsonOrText(res);
  if (!res.ok) throw new Error(data.error || 'Forgot password failed');
  return data;
};

export const confirmForgotPassword = async (email: string, code: string, newPassword: string) => {
  const res = await fetch(API_CONFIRM_FORGOT_PASSWORD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: normalizeEmail(email),
      code: (code || '').trim(),
      newPassword,
    }),
  });
  const data = await toJsonOrText(res);
  if (!res.ok) throw new Error(data.error || 'Password reset failed');
  return data;
};

export const logout = async () => {
  await AsyncStorage.removeItem('userToken');
};
