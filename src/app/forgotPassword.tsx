// app/forgotPassword.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';
import { LinearGradient } from 'expo-linear-gradient';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useFocusEffect } from '@react-navigation/native';

const poolData = {
  UserPoolId: 'us-east-1_D2gEiWghw',
  ClientId: '3ari019pia44dhfpb0okane3ir',
};

const userPool = new CognitoUserPool(poolData);

const EmailSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required.'),
});

const ForgotPasswordScreen: React.FC = () => {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);

  // Reset formKey each time the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      setFormKey((prev) => prev + 1);
    }, [])
  );

  const handleRequestReset = (values: { email: string }) => {
    const { email } = values;
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    cognitoUser.forgotPassword({
      onSuccess: () => {
        Alert.alert('Check your email', 'A verification code has been sent.');
        router.push({ pathname: '/newPassword', params: { email } });
      },
      onFailure: (err) => {
        Alert.alert('Error', err.message || 'Something went wrong.');
      },
    });
  };

  return (
    <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.gradient}>
      <View style={styles.container}>
        <Text style={styles.title}>Reset Your Password</Text>
        <View style={styles.card}>
          <Formik
            key={formKey}  // Formik remounts when key changes
            initialValues={{ email: '' }}
            validationSchema={EmailSchema}
            onSubmit={handleRequestReset}
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
    </LinearGradient>
  );
};

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 5 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
  input: { height: 50, borderColor: '#ddd', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginBottom: 12, fontSize: 16, color: '#333' },
  error: { color: '#ff4d4d', marginBottom: 8, fontSize: 14 },
  button: { backgroundColor: '#11998e', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
