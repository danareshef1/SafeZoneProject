// ✅ חובה להיות בראש הקובץ – לפני הכל
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { MaterialIcons } from '@expo/vector-icons';
import { forgotPassword } from '@/utils/auth';

const poolData = {
  UserPoolId: 'us-east-1_TgQIZsQBQ',
  ClientId: '5tthevvlvskttb7ec21j5u1gtj',
};


const EmailSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required.'),
});

const ForgotPasswordScreen: React.FC = () => {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      setFormKey((prev) => prev + 1);
    }, [])
  );


  const handleRequestReset = async (values: { email: string }, resetForm: () => void) => {
  try {
    await forgotPassword(values.email);
    Alert.alert('Check your email', 'A verification code has been sent.');
    resetForm();
    router.push({ pathname: '/newPassword', params: { email: values.email } });
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Reset Your Password</Text>
        <View style={styles.card}>
          <Formik
            key={formKey}
            initialValues={{ email: '' }}
            validationSchema={EmailSchema}
            onSubmit={(values, { resetForm }) => handleRequestReset(values, resetForm)}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
              <>
                <TextInput
                  placeholder="Email"
                  placeholderTextColor="#888"
                  style={styles.input}
                  onChangeText={handleChange('email')}
                  onBlur={handleBlur('email')}
                  value={values.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {errors.email && touched.email && (
                  <Text style={styles.error}>{errors.email}</Text>
                )}
                <TouchableOpacity style={styles.button} onPress={() => handleSubmit()}>
                  <Text style={styles.buttonText}>Send Code</Text>
                </TouchableOpacity>
              </>
            )}
          </Formik>
        </View>
      </View>
    </ImageBackground>
  );
};

export default ForgotPasswordScreen;

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
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#11998e',
    marginBottom: 24,
    textAlign: 'center',
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
    height: 55,
    backgroundColor: '#f9f9f9',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 18,
    color: '#333',
    marginBottom: 12,
  },
  error: {
    color: '#ff4d4d',
    fontSize: 14,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#11998e',
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',    
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    padding: 10,
  },
});
