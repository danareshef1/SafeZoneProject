import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';
import { LinearGradient } from 'expo-linear-gradient';

const poolData = {
  UserPoolId: 'us-east-1_D2gEiWghw', // Your User Pool ID
  ClientId: '3ari019pia44dhfpb0okane3ir', // Your Client ID
};

const userPool = new CognitoUserPool(poolData);

const VerifySchema = Yup.object().shape({
  code: Yup.string().required('Verification code is required.'),
});

const VerifySignUpScreen: React.FC = () => {
  const router = useRouter();
  const { username } = useLocalSearchParams() as { username: string };

  const handleVerify = (values: { code: string }) => {
    const user = new CognitoUser({ Username: username, Pool: userPool });
    user.confirmRegistration(values.code, true, (err, result) => {
      if (err) {
        Alert.alert('Verification Failed', err.message || 'Error verifying code.');
      } else {
        Alert.alert('Verification Successful', 'You can now sign in.');
        router.replace('/login');
      }
    });
  };

  return (
    <LinearGradient colors={['#ff9a9e', '#fad0c4']} style={styles.gradient}>
      <View style={styles.container}>
        <Text style={styles.title}>Verify Your Account</Text>
        <View style={styles.card}>
          <Formik initialValues={{ code: '' }} validationSchema={VerifySchema} onSubmit={handleVerify}>
            {({ handleChange, handleSubmit, values, errors, touched }) => (
              <>
                <TextInput
                  placeholder="Verification Code"
                  placeholderTextColor="#888"
                  style={styles.input}
                  onChangeText={handleChange('code')}
                  value={values.code}
                />
                {errors.code && touched.code && <Text style={styles.error}>{errors.code}</Text>}
                <TouchableOpacity style={styles.button} onPress={() => handleSubmit()}>
                  <Text style={styles.buttonText}>Verify</Text>
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
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 16,
    color: '#333',
  },
  error: {
    color: '#ff4d4d',
    marginBottom: 8,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#ff6f61',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default VerifySignUpScreen;
