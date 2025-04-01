// app/login.tsx
import React, { useContext } from 'react';
import { View, Text, StyleSheet, Button, TextInput, Alert } from 'react-native';
import { AuthContext } from './AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Formik } from 'formik';
import * as Yup from 'yup';

// Define the validation schema using Yup
const LoginSchema = Yup.object().shape({
  username: Yup.string().required('Username is required.'),
  password: Yup.string().required('Password is required.'),
});

const LoginScreen: React.FC = () => {
  const { login } = useContext(AuthContext);
  const navigation = useNavigation();

  // Handle form submission
  const handleLogin = async (values: { username: string; password: string }) => {
    // Replace with your actual login logic (e.g., API call)
    const { username, password } = values;

    // Example validation (replace with real authentication)
    if (username === 'A' && password === 'b') {
      await login(); // Update authentication state
      navigation.reset({
        index: 0,
        routes: [{ name: 'index' as never }],
      }); // Navigate to Home screen after successful login
    } else {
      Alert.alert('Login Failed', 'Invalid username or password.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Please Log In</Text>
      <Formik
        initialValues={{ username: '', password: '' }}
        validationSchema={LoginSchema}
        onSubmit={handleLogin}
      >
        {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
          <View style={styles.form}>
            {/* Username Input */}
            <TextInput
              placeholder="Username"
              style={styles.input}
              onChangeText={handleChange('username')}
              onBlur={handleBlur('username')}
              value={values.username}
            />
            {/* Display validation error for username */}
            {errors.username && touched.username ? (
              <Text style={styles.error}>{errors.username}</Text>
            ) : null}

            {/* Password Input */}
            <TextInput
              placeholder="Password"
              style={styles.input}
              secureTextEntry
              onChangeText={handleChange('password')}
              onBlur={handleBlur('password')}
              value={values.password}
            />
            {/* Display validation error for password */}
            {errors.password && touched.password ? (
              <Text style={styles.error}>{errors.password}</Text>
            ) : null}

            {/* Submit Button */}
            <Button title="Log In" onPress={() => handleSubmit()} />
          </View>
        )}
      </Formik>
    </View>
  );
};

export default LoginScreen;

// Define your styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f0f0f0', // Light gray background
  },
  title: {
    fontSize: 28,
    marginBottom: 30,
    fontWeight: 'bold',
    color: '#333', // Darker text
  },
  form: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc', // Light border
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    backgroundColor: '#fff', // White background for inputs
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
});
