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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Formik } from 'formik';
import * as Yup from 'yup';

const VerificationSchema = Yup.object().shape({
  verificationCode: Yup.string().required('Verification code is required.'),
});

const VerificationScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;
  const [formKey, setFormKey] = useState(0);

  const handleVerification = (values: { verificationCode: string }) => {
    router.push({
      pathname: '/newPassword',
      params: { email, verificationCode: values.verificationCode },
    });
  };

  return (
    <ImageBackground
      source={require('../../assets/images/newLogo-removebg-preview.png')}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Enter Verification Code</Text>
          <View style={styles.card}>
            <Formik
              key={formKey}
              initialValues={{ verificationCode: '' }}
              validationSchema={VerificationSchema}
              onSubmit={handleVerification}
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
                  <TouchableOpacity style={styles.button} onPress={() => handleSubmit()}>
                    <Text style={styles.buttonText}>Continue</Text>
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

export default VerificationScreen;

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
});
