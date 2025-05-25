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
import { AuthContext } from './AuthContext';
import { useRouter } from 'expo-router';
import { Formik } from 'formik';
import * as Yup from 'yup';
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
  const handleSignUp = async (values: {
    username: string;
    password: string;
    email: string;
    phone: string;
  }) => {
    try {
      await signUp(values.username, values.password, values.email, values.phone);
      Alert.alert('Registration Successful', 'Please check your email for the verification code.');
      router.push(`/verifySignUpScreen?username=${values.username}`);
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'An error occurred during registration.');
      throw error; 
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
        <Text style={styles.title}>Create Account</Text>
        <View style={styles.card}>
          <Formik
            initialValues={{ username: '', password: '', email: '', phone: '' }}
            validationSchema={SignUpSchema}
            onSubmit={async (values, { resetForm }) => {
              try {
                await handleSignUp(values);
                resetForm(); 
              } catch (error) {
                console.error('Sign up failed:', error);
              }
            }}            
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
                  placeholder="Email"
                  placeholderTextColor="#888"
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
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
                  keyboardType="phone-pad"
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
              </>
            )}
          </Formik>
        </View>
      </View>
    </ImageBackground>
  );
};

export default SignUpScreen;
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
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#11998e',
    marginBottom: 20,
  },
  card: {
    width: '90%',
    maxWidth: 400,
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
    top: 40,
    left: 20,
    padding: 10,
  },
});
