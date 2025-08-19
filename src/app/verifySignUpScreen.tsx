// src/app/verifySignUpScreen.tsx
// ✅ חובה להיות בראש הקובץ – לפני הכל
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Formik } from 'formik';
import * as Yup from 'yup';
// אם אין לך alias של "@/utils/auth", החליפי ל: '../../utils/auth'
import { confirmSignUp } from '@/utils/auth';
import { resendConfirmationCode } from '@/utils/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ...

const { username, email } = useLocalSearchParams() as { username?: string; email?: string };

// (אופציונלי) שליחת פרטי המשתמש ללמבדה אחרי אימות
const saveUserDataToLambda = async (email: string, phoneNumber: string) => {
  try {
    const res = await fetch(
      'https://epgs59jgnd.execute-api.us-east-1.amazonaws.com/default/saveToken',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phoneNumber }),
      }
    );
    if (!res.ok) throw new Error('Failed to save to Lambda');
    console.log('✅ User data saved to Lambda');
  } catch (e) {
    console.warn('❌ Failed to save user info to Lambda:', e);
  }
};

const VerifySchema = Yup.object().shape({
  code: Yup.string()
    .trim()
    .matches(/^\d{6}$/, 'Enter the 6-digit code.')
    .required('Verification code is required.'),
});

const VerifySignUpScreen: React.FC = () => {
  const router = useRouter();
const { username, email, phone } = useLocalSearchParams() as {
  username?: string; email?: string; phone?: string;
};

const handleVerify = async ({ code }: { code: string }) => {
  try {
    const u = (username || '').trim(); // 👈 נעדיף username
    const e = (email || '').trim().toLowerCase();
    if (!u && !e) {
      Alert.alert('Missing data', 'Please go back to sign up.');
      return;
    }

    // העדפה: username; אם אין – email (ה־Lambda שלנו תומכת בשניהם)
    await confirmSignUp(u || e, code.trim());

    Alert.alert('Verification Successful', 'You can now sign in.');
    router.replace(`/login?email=${encodeURIComponent(e)}&phone=${encodeURIComponent(String(phone || ''))}`);
  } catch (err: any) {
    Alert.alert('Verification Failed', err?.message || 'Error verifying code.');
  }
};

const handleResend = async () => {
  try {
    // נעדיף את ה-username שנוצר בהרשמה; אם אין, ננסה מה-AsyncStorage; ואם גם אין – אימייל
    const fallbackUsername = (await AsyncStorage.getItem('lastSignupUsername')) || '';
    const fallbackEmail    = (await AsyncStorage.getItem('lastSignupEmail')) || '';
    const who = (username || fallbackUsername || email || fallbackEmail || '').trim();
    if (!who) {
      Alert.alert('חסר פרטים', 'חזרי להרשמה, ואז נסי שוב.');
      return;
    }
    await resendConfirmationCode(who);
    Alert.alert('נשלח', 'קוד חדש נשלח אלייך.');
  } catch (e: any) {
    Alert.alert('שגיאה', e?.message || 'Resend failed');
  }
};

// ב-JSX:
<TouchableOpacity style={[styles.button, { backgroundColor: '#777' }]} onPress={handleResend}>
  <Text style={styles.buttonText}>שלחי שוב קוד</Text>
</TouchableOpacity>

  return (
    <ImageBackground
      source={require('../../assets/images/newLogo-removebg-preview.png')}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Verify Your Account</Text>
          <View style={styles.card}>
            <Formik initialValues={{ code: '' }} validationSchema={VerifySchema} onSubmit={handleVerify}>
              {({ handleChange, handleSubmit, values, errors, touched }) => (
                <>
                  <TextInput
                    placeholder="Verification Code"
                    placeholderTextColor="#888"
                    style={styles.input}
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={handleChange('code')}
                    value={values.code}
                  />
                  {!!errors.code && touched.code && <Text style={styles.error}>{errors.code}</Text>}

                  <TouchableOpacity style={styles.button} onPress={() => handleSubmit()}>
                    <Text style={styles.buttonText}>Verify</Text>
                  </TouchableOpacity>
                </>
              )}
            </Formik>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
};

export default VerifySignUpScreen;

const styles = StyleSheet.create({
  background: { flex: 1 },
  backgroundImage: { resizeMode: 'contain', transform: [{ scale: 1.2 }], alignSelf: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(176, 255, 247, 0.7)', justifyContent: 'center', alignItems: 'center' },
  formContainer: { width: '90%', alignItems: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: '600', color: '#11998e', marginBottom: 20 },
  card: { width: '100%', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  input: { height: 45, backgroundColor: '#f9f9f9', borderColor: '#ddd', borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, marginBottom: 12, fontSize: 16, color: '#333' },
  error: { color: '#ff4d4d', fontSize: 14, marginBottom: 8 },
  button: { backgroundColor: '#11998e', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
