// utils/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_SIGN_UP  = 'https://svxds3ehfb.execute-api.us-east-1.amazonaws.com/sign-up';
const API_LOG_IN   = 'https://h82iu91w70.execute-api.us-east-1.amazonaws.com/log-in';
const API_CONFIRM_SIGN_UP         = 'https://d7h2yhrpmi.execute-api.us-east-1.amazonaws.com/confirm-sign-up';
const API_FORGOT_PASSWORD         = 'https://ohkcgrpygf.execute-api.us-east-1.amazonaws.com/forgot-password';
const API_CONFIRM_FORGOT_PASSWORD = 'https://3v43pn9b3e.execute-api.us-east-1.amazonaws.com/confirm-forgot-password';
const API_RESEND_CONFIRM_CODE     = 'https://wxl14c7af2.execute-api.us-east-1.amazonaws.com/resend-code';

const normalizeEmail = (email: string) => (email || '').trim().toLowerCase();
const normalizePhone = (phone: string) => {
  const raw = (phone || '').replace(/\s|-/g, '');
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  return raw.startsWith('0') ? `+972${raw.slice(1)}` : raw;
};
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, ms = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}
async function toJsonOrText(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { message: text }; }
}

export async function signUp(email: string, password: string, phone: string) {
  const res = await fetch(API_SIGN_UP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, phone }), // 👈 בלי username
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Sign up failed');

  // ה-username האמיתי הגיע מהשרת
  const generated = (data?.username || '').trim();

  // נשמור לגיבוי למסכי אימות/Resend
  await AsyncStorage.multiSet([
    ['lastSignupUsername', generated],
    ['lastSignupEmail', (email || '').toLowerCase()],
    ['lastSignupPhone', phone || ''],
    // לשימוש פנימי באפליקציה: "שם להצגה" (אם קיים) נשמור בנפרד – ראו סעיף 3
    ['userName', generated], // זה ה-username של Cognito (מהשרת)
  ]);

  return data; // כולל username
}


export const confirmSignUp = async (usernameOrEmail: string, code: string) => {
  const res = await fetch(API_CONFIRM_SIGN_UP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: (usernameOrEmail || '').trim(),
      code: (code || '').trim(),
    }),
  });
  const data = await toJsonOrText(res);
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
  await AsyncStorage.setItem('userEmail', normalizeEmail(email));
  // אם שמרנו טלפון בשלב ה-signup, נשאיר אותו; אחרת אין לנו כאן טלפון מהשרת
  const existingPhone = await AsyncStorage.getItem('userPhone');
  if (!existingPhone) {
    const lastPhone = await AsyncStorage.getItem('lastSignupPhone');
    if (lastPhone) await AsyncStorage.setItem('userPhone', lastPhone);
  }

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
export const logout = async () => {
  await AsyncStorage.removeItem('userToken');
};

// עזר קטן לשימוש במסכים אחרים
export const getUserEmail = async () => (await AsyncStorage.getItem('userEmail')) || '';
