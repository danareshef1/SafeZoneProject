import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';
import { LinearGradient } from 'expo-linear-gradient';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { MaterialIcons } from '@expo/vector-icons'; 

const poolData = {
  UserPoolId: 'us-east-1_TgQIZsQBQ',
  ClientId: '5tthevvlvskttb7ec21j5u1gtj',
};

const userPool = new CognitoUserPool(poolData);

const ResetSchema = Yup.object().shape({
  verificationCode: Yup.string().required('Verification code is required.'),
  newPassword: Yup.string().required('New password is required.'),
  confirmNewPassword: Yup.string()
    .oneOf([Yup.ref('newPassword'), undefined], 'Passwords must match')
    .required('Please confirm your new password.'),
});

const NewPasswordScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;

  const handleNewPassword = (values: { verificationCode: string; newPassword: string }, resetForm: () => void) => {
    const { verificationCode, newPassword } = values;
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    cognitoUser.confirmPassword(verificationCode, newPassword, {
      onSuccess: () => {
        Alert.alert('Success', 'Your password has been reset. You can now log in.');
        resetForm(); 
        router.replace('/login');
      },
      onFailure: (err) => {
        Alert.alert('Error', err.message || 'Something went wrong.');
      },
    });
  };

  return (
    <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.gradient}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={30} color="#fff" /> 
        </TouchableOpacity>
        <Text style={styles.title}>Reset Your Password</Text>
        <View style={styles.card}>
          <Formik
            initialValues={{ verificationCode: '', newPassword: '', confirmNewPassword: '' }}
            validationSchema={ResetSchema}
            onSubmit={(values, { resetForm }) => handleNewPassword(values, resetForm)}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched, resetForm }) => (
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
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 5 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
  input: { height: 50, borderColor: '#ddd', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginBottom: 12, fontSize: 16, color: '#333' },
  error: { color: '#ff4d4d', marginBottom: 8, fontSize: 14 },
  button: { backgroundColor: '#11998e', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  backButton: {
    position: 'absolute', 
    left: 20,
    top: 40,
    zIndex: 1, 
  },
});

export default NewPasswordScreen;
