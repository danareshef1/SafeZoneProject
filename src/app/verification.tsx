// app/verification.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
    // Here, you could add additional format checks.
    // Then navigate to the new password screen, passing email and the entered code.
    router.push({
      pathname: '/newPassword',
      params: { email, verificationCode: values.verificationCode },
    });
  };

  return (
    <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.gradient}>
      <View style={styles.container}>
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
    </LinearGradient>
  );
};

export default VerificationScreen;

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
  input: { height: 50, borderColor: '#ddd', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginBottom: 12, fontSize: 16, color: '#333' },
  error: { color: '#ff4d4d', marginBottom: 8, fontSize: 14 },
  button: { backgroundColor: '#11998e', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});