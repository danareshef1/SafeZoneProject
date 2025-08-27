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

// ---------- SIGN UP ----------
export async function signUp(email: string, password: string, phone: string) {
  const payload = {
    email: normalizeEmail(email),                // FIX: נרמול תמידי
    password,
    phone: normalizePhone(phone || ''),
  };
  const res = await fetch(API_SIGN_UP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), // 👈 בלי username
  });
  const data = await toJsonOrText(res);         // FIX: להשתמש ב-toJsonOrText
  if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Sign up failed');

  // ה-server מחזיר username — במקרה Username=Email זה יהיה ה-email עצמו
  const generated = (data?.username || '').trim();

  await AsyncStorage.multiSet([
    ['lastSignupUsername', generated],
    ['lastSignupEmail', normalizeEmail(email)],
    ['lastSignupPhone', payload.phone || ''],
    ['userName', generated],
  ]);

  return data; // כולל username
}

// ---------- CONFIRM SIGN UP ----------
export const confirmSignUp = async (usernameOrEmail: string, code: string) => {
  // FIX: במצב Username=Email, עדיף תמיד לשלוח email
  const candidate = (usernameOrEmail || '').trim();
  const email =
    candidate.includes('@') ? normalizeEmail(candidate)
    : normalizeEmail(await AsyncStorage.getItem('lastSignupEmail') || candidate);

  const res = await fetch(API_CONFIRM_SIGN_UP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, code: (code || '').trim() }),
  });
  const data = await toJsonOrText(res);
  if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Confirm sign up failed');
  return data;
};

// ---------- LOGIN ----------
export const login = async (email: string, password: string) => {
  const res = await fetch(API_LOG_IN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // ה-API שלנו תומך ב-identifier או email; כאן נשלח email
    body: JSON.stringify({ email: normalizeEmail(email), password }),
  });

  const data = await toJsonOrText(res);
  if (!res.ok || data?.ok === false) {
    // אם הגיע Challenge (למשל MFA/NEW_PASSWORD_REQUIRED) נחזיר הודעה ברורה
    if (data?.challenge) {
      throw new Error(`Challenge: ${data.challenge}`);
    }
    const msg = data?.error || data?.message || 'Login failed';
    throw new Error(msg);
  }

  // FIX: הלמבדא מחזירה tokens במבנה AuthenticationResult של קוגניטו:
  // { tokens: { IdToken, AccessToken, RefreshToken, ExpiresIn, TokenType } }
  const idToken =
    data?.tokens?.IdToken ||
    data?.idToken ||
    data?.token ||
    null;

  if (!idToken) throw new Error('No token returned from login');

  await AsyncStorage.setItem('userToken', idToken);
  await AsyncStorage.setItem('userEmail', normalizeEmail(email));

  const existingPhone = await AsyncStorage.getItem('userPhone');
  if (!existingPhone) {
    const lastPhone = await AsyncStorage.getItem('lastSignupPhone');
    if (lastPhone) await AsyncStorage.setItem('userPhone', lastPhone);
  }

  return data;
};

// ---------- FORGOT PASSWORD ----------
export const forgotPassword = async (email: string) => {
  const res = await fetch(API_FORGOT_PASSWORD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // FIX: Username=Email ⇒ תמיד לשלוח email
    body: JSON.stringify({ email: normalizeEmail(email) }),
  });
  const data = await toJsonOrText(res);
  if (!res.ok || data?.ok === false) throw new Error(data.error || 'Forgot password failed');
  return data;
};

// ---------- CONFIRM FORGOT PASSWORD ----------
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
  if (!res.ok || data?.ok === false) throw new Error(data.error || 'Password reset failed');
  return data;
};

// ---------- RESEND CODE ----------
export const resendConfirmationCode = async (usernameOrEmail: string) => {
  // FIX: לשרת כתבנו endpoint שמקבל identifier/username/email — נשלח 'identifier' (מועדף)
  const candidate = (usernameOrEmail || '').trim();
  const identifier =
    candidate.includes('@') ? normalizeEmail(candidate) : candidate;

  const res = await fetchWithTimeout(API_RESEND_CONFIRM_CODE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }), // FIX: identifier במקום username
  });
  const data = await toJsonOrText(res);
  if (!res.ok || data?.ok === false) throw new Error((data as any).error || 'Resend code failed');
  return data;
};

export const logout = async () => {
  await AsyncStorage.removeItem('userToken');
};

export const getUserEmail = async () => (await AsyncStorage.getItem('userEmail')) || '';
