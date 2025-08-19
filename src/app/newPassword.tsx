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
import { MaterialIcons } from '@expo/vector-icons';
import { confirmForgotPassword } from '@/utils/auth';

const poolData = {
  UserPoolId: 'us-east-1_TgQIZsQBQ',
  ClientId: '5tthevvlvskttb7ec21j5u1gtj',
};


const ResetSchema = Yup.object().shape({
  verificationCode: Yup.string().required('Verification code is required.'),
  newPassword: Yup.string().required('New password is required.'),
  confirmNewPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Please confirm your new password.'),
});

const NewPasswordScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;

const handleNewPassword = async (
  values: { verificationCode: string; newPassword: string },
  resetForm: () => void
) => {
  try {
    await confirmForgotPassword(email, values.verificationCode, values.newPassword);
    Alert.alert('Success', 'Your password has been reset. You can now log in.');
    resetForm();
    router.replace('/login');
  } catch (err: any) {
    Alert.alert('Error', err.message || 'Something went wrong.');
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={30} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Reset Your Password</Text>
          <View style={styles.card}>
            <Formik
              initialValues={{
                verificationCode: '',
                newPassword: '',
                confirmNewPassword: '',
              }}
              validationSchema={ResetSchema}
              onSubmit={(values, { resetForm }) => handleNewPassword(values, resetForm)}
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                <>
                  <TextInput
                    placeholder="Verification Code"
                    placeholderTextColor="#888"
                    style={styles.input}
                    onChangeText={handleChange('verificationCode')}
                    onBlur={handleBlur('verificationCode')}
                    value={values.verificationCode}
                  />
                  {errors.verificationCode && touched.verificationCode && (
                    <Text style={styles.error}>{errors.verificationCode}</Text>
                  )}

                  <TextInput
                    placeholder="New Password"
                    placeholderTextColor="#888"
                    style={styles.input}
                    secureTextEntry
                    onChangeText={handleChange('newPassword')}
                    onBlur={handleBlur('newPassword')}
                    value={values.newPassword}
                  />
                  {errors.newPassword && touched.newPassword && (
                    <Text style={styles.error}>{errors.newPassword}</Text>
                  )}

                  <TextInput
                    placeholder="Confirm New Password"
                    placeholderTextColor="#888"
                    style={styles.input}
                    secureTextEntry
                    onChangeText={handleChange('confirmNewPassword')}
                    onBlur={handleBlur('confirmNewPassword')}
                    value={values.confirmNewPassword}
                  />
                  {errors.confirmNewPassword && touched.confirmNewPassword && (
                    <Text style={styles.error}>{errors.confirmNewPassword}</Text>
                  )}

                  <TouchableOpacity style={styles.button} onPress={() => handleSubmit()}>
                    <Text style={styles.buttonText}>Reset Password</Text>
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

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  backgroundImage: {
    resizeMode: 'contain',
    transform: [{ scale: 1.2 }],
    alignSelf: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(176, 255, 247, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#11998e',
    marginBottom: 20,
  },
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
  error: {
    color: '#ff4d4d',
    fontSize: 14,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#11998e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 40,
    padding: 10,
  },
});

export default NewPasswordScreen;
