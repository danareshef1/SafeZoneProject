// src/lib/awsAuth.ts
import {
    CognitoIdentityProviderClient,
    SignUpCommand,
    ConfirmSignUpCommand,
    InitiateAuthCommand,
    ForgotPasswordCommand,
    ConfirmForgotPasswordCommand,
  } from '@aws-sdk/client-cognito-identity-provider';
  import CryptoJS from 'crypto-js';
  
  const REGION = 'us-east-1';
  const USER_POOL_ID = 'us-east-1_TgQIZsQBQ';
  const CLIENT_ID = '5tthevvlvskttb7ec21j5u1gtj';
  
  // אם ל-App Client יש Client secret – שימי אותו כאן. אם אין (מומלץ למובייל) השאירי ריק:
  const CLIENT_SECRET = '';
  
  const cip = new CognitoIdentityProviderClient({ region: REGION });
  
  function computeSecretHash(username: string) {
    if (!CLIENT_SECRET) return undefined;
    const msg = username + CLIENT_ID;
    const hmac = CryptoJS.HmacSHA256(msg, CLIENT_SECRET);
    return CryptoJS.enc.Base64.stringify(hmac);
  }
  
  function normalizePhoneIL(phone: string) {
    const p = phone.trim();
    if (p.startsWith('+')) return p;
    return `+972${p.replace(/^0/, '')}`;
  }
  
  export async function sdkSignUp(username: string, password: string, email: string, phone: string) {
    const SecretHash = computeSecretHash(username);
    return cip.send(new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: username,
      Password: password,
      ...(SecretHash ? { SecretHash } : {}),
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'phone_number', Value: normalizePhoneIL(phone) },
      ],
    }));
  }
  
  export async function sdkConfirmSignUp(username: string, code: string) {
    const SecretHash = computeSecretHash(username);
    return cip.send(new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: username,
      ConfirmationCode: code,
      ...(SecretHash ? { SecretHash } : {}),
    }));
  }
  
  export async function sdkLogin(username: string, password: string) {
    const SecretHash = computeSecretHash(username);
    return cip.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        ...(SecretHash ? { SECRET_HASH: SecretHash } : {}),
      },
    }));
  }
  
  export async function sdkForgotPassword(username: string) {
    const SecretHash = computeSecretHash(username);
    return cip.send(new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: username,
      ...(SecretHash ? { SecretHash } : {}),
    }));
  }
  
  export async function sdkConfirmForgotPassword(username: string, code: string, newPassword: string) {
    const SecretHash = computeSecretHash(username);
    return cip.send(new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: username,
      ConfirmationCode: code,
      Password: newPassword,
      ...(SecretHash ? { SecretHash } : {}),
    }));
  }
  