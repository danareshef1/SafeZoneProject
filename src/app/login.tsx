// app/login.tsx
import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { AuthContext } from './AuthContext';
import { useRouter } from 'expo-router';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { LinearGradient } from 'expo-linear-gradient';

const LoginSchema = Yup.object().shape({
  username: Yup.string().required('Username is required.'),
  password: Yup.string().required('Password is required.'),
});

const LoginScreen: React.FC = () => {
  const { login } = useContext(AuthContext);
  const router = useRouter();

  const handleLogin = async (values: { username: string; password: string }) => {
    try {
      await login(values.username, values.password);
      router.replace('/');
    } catch (error: any) {
      if (error.code === 'UserNotConfirmedException') {
        Alert.alert('Account Not Verified', 'Please verify your account before signing in.');
        router.push(`/verifySignUpScreen?username=${values.username}`);
      } else {
        Alert.alert('Login Failed', error.message || 'Invalid username or password.');
      }
    }
  };

  return (
    <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.gradient}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome Back!</Text>
        <View style={styles.card}>
          <Formik
            initialValues={{ username: '', password: '' }}
            validationSchema={LoginSchema}
            onSubmit={handleLogin}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
              <>
                <TextInput
                  placeholder="Username"
                  placeholderTextColor="#888"
                  style={styles.input}
                  onChangeText={handleChange('username')}
                  onBlur={handleBlur('username')}
                  value={values.username}
                />
                {errors.username && touched.username && (
                  <Text style={styles.error}>{errors.username}</Text>
                )}
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#888"
                  style={styles.input}
                  secureTextEntry
                  onChangeText={handleChange('password')}
                  onBlur={handleBlur('password')}
                  value={values.password}
                />
                {errors.password && touched.password && (
                  <Text style={styles.error}>{errors.password}</Text>
                )}

                <TouchableOpacity style={styles.button} onPress={() => handleSubmit()}>
                  <Text style={styles.buttonText}>Sign In</Text>
                </TouchableOpacity>

                {/* FORGOT PASSWORD LINK */}
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => router.push('/forgotPassword')}
                >
                  <Text style={styles.linkText}>Forgot your password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => router.push('/signUpScreen')}
                >
                  <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
                </TouchableOpacity>
              </>
            )}
          </Formik>
        </View>
      </View>
    </LinearGradient>
  );
};

export default LoginScreen;

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
    textAlign: 'center',
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
    backgroundColor: '#11998e',
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
  linkButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  linkText: {
    color: '#11998e',
    fontSize: 16,
  },
});


