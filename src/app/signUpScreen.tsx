import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { AuthContext } from './AuthContext';
import { useRouter } from 'expo-router';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons'; 

const SignUpSchema = Yup.object().shape({
  username: Yup.string().required('Username is required.'),
  password: Yup.string().required('Password is required.'),
  email: Yup.string().email('Invalid email').required('Email is required.'),
  phone: Yup.string()
    .required('Phone number is required.')
    .matches(/^\+?[0-9]{10,14}$/, 'Invalid phone number'),
});

const SignUpScreen: React.FC = () => {
  const { signUp } = useContext(AuthContext);
  const router = useRouter();

  const handleSignUp = async (values: { username: string; password: string; email: string; phone: string }) => {
    try {
      await signUp(values.username, values.password, values.email, values.phone);
      Alert.alert('Registration Successful', 'Please check your email for the verification code.');
      router.push(`/verifySignUpScreen?username=${values.username}`);
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'An error occurred during registration.');
    }
  };

  return (
    <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.gradient}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Create Account</Text>
        <View style={styles.card}>
          <Formik
            initialValues={{ username: '', password: '', email: '', phone: '' }}
            validationSchema={SignUpSchema}
            onSubmit={async (values, { resetForm }) => {
              await handleSignUp(values);
              resetForm();
            }}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
              <View>
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
                <TextInput
                  placeholder="Phone Number"
                  placeholderTextColor="#888"
                  style={styles.input}
                  onChangeText={handleChange('phone')}
                  onBlur={handleBlur('phone')}
                  value={values.phone}
                />
                {errors.phone && touched.phone && (
                  <Text style={styles.error}>{errors.phone}</Text>
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
                  <Text style={styles.buttonText}>Sign Up</Text>
                </TouchableOpacity>
              </View>
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
  backButton: {
    position: 'absolute',
    left: 20,
    top: 40,
    zIndex: 1,
  },
});

export default SignUpScreen;
