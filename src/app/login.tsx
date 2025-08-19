// src/app/loginScreen.tsx
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ImageBackground,
} from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { sendLocationToBackend } from '../../utils/api';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVE_TOKEN_API =
  'https://epgs59jgnd.execute-api.us-east-1.amazonaws.com/default/saveToken'; // ← החליפי אם צריך

const LoginSchema = Yup.object().shape({
  username: Yup.string().required('Username is required.'), // כאן זה אימייל בפועל
  password: Yup.string().required('Password is required.'),
});

// --- עזר: פענוח JWT כדי להוציא sub (לא שולח את ה-JWT לשרת)
function decodeJwt(token?: string | null): any {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// --- שליחת המכשיר ל-DeviceTokens Lambda
async function sendDeviceToken(expoToken: string) {
  try {
    const [idToken, email, phone] = await Promise.all([
      AsyncStorage.getItem('userToken'),
      AsyncStorage.getItem('userEmail'),
      AsyncStorage.getItem('userPhone'),
    ]);

    const claims = decodeJwt(idToken);
    const sub = claims?.sub || ''; // מזהה המשתמש ב-Cognito

    const res = await fetch(SAVE_TOKEN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // אם ה-API שלך דורש אימות, אפשר להוסיף:
      // Authorization: idToken || ''
      body: JSON.stringify({
        email: (email || '').trim().toLowerCase(),
        phoneNumber: phone || 'unknown',
        username: sub || 'unknown',
        expoPushToken: expoToken,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || 'Failed to save device token');
    }
    console.log('✅ Saved DeviceToken:', text);
  } catch (err) {
    console.error('❌ Failed sending device token:', err);
  }
}

const LoginScreen: React.FC = () => {
  const { login } = useContext(AuthContext);
  const router = useRouter();

  const handleLogin = async (values: { username: string; password: string }) => {
    try {
      console.log('🔐 Attempting login...');
      // פה username הוא למעשה אימייל
      await login(values.username, values.password);
      console.log('✅ Login successful');

      // בקשת הרשאת מיקום + שליחה לשרת שלך
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        console.log('📍 Got location:', location.coords);
        await sendLocationToBackend(location.coords.latitude, location.coords.longitude);
      } else {
        console.warn('⚠️ Location permission denied');
      }

      // הרשאות פוש + קבלת Expo Push Token
      const notificationStatus = await Notifications.requestPermissionsAsync();
      if (notificationStatus.status !== 'granted') {
        console.warn('❗ Push notification permissions not granted');
      } else {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });
        const expoPushToken = tokenData.data;
        console.log('📱 Expo push token:', expoPushToken);

        // 👇 שליחה ל-DeviceTokens Lambda
        await sendDeviceToken(expoPushToken);
      }

      router.replace('/home');
    } catch (error: any) {
      console.error('❌ Login failed:', error);
      if (error.code === 'UserNotConfirmedException') {
        Alert.alert('Account Not Verified', 'Please verify your account before signing in.');
        // נעדיף לעבור עם האימייל שקלטנו
        router.push(`/verifySignUpScreen?email=${encodeURIComponent(values.username)}`);
      } else {
        Alert.alert('Login Failed', error.message || 'Invalid username or password.');
      }
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/newLogo-removebg-preview.png')}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Welcome!</Text>
          <View style={styles.card}>
            <Formik initialValues={{ username: '', password: '' }} validationSchema={LoginSchema} onSubmit={handleLogin}>
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                <>
                  <TextInput
                    placeholder="Email"
                    placeholderTextColor="#888"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onChangeText={handleChange('username')}
                    onBlur={handleBlur('username')}
                    value={values.username}
                  />
                  {errors.username && touched.username && <Text style={styles.error}>{errors.username}</Text>}
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="#888"
                    style={styles.input}
                    secureTextEntry
                    onChangeText={handleChange('password')}
                    onBlur={handleBlur('password')}
                    value={values.password}
                  />
                  {errors.password && touched.password && <Text style={styles.error}>{errors.password}</Text>}
                  <TouchableOpacity style={styles.button} onPress={() => handleSubmit()}>
                    <Text style={styles.buttonText}>Sign In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/forgotPassword')}>
                    <Text style={styles.linkText}>Forgot your password?</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/signUpScreen')}>
                    <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
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

export default LoginScreen;

// --- styles נשארו כמו אצלך ---
const styles = StyleSheet.create({
  background: { flex: 1 },
  backgroundImage: { resizeMode: 'contain', transform: [{ scale: 1.2 }], alignSelf: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(176, 255, 247, 0.7)', justifyContent: 'center', alignItems: 'center' },
  formContainer: { width: '90%', alignItems: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: '600', color: '#11998e', marginBottom: 20 },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  input: {
    height: 45,
    backgroundColor: '#f9f9f9',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 12,
    fontSize: 16,
    color: '#333',
  },
  error: { color: '#ff4d4d', fontSize: 14, marginBottom: 8 },
  button: { backgroundColor: '#11998e', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { marginTop: 15, alignItems: 'center' },
  linkText: { color: '#11998e', fontSize: 16 },
});
