// src/app/index.tsx
import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/home');
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);
  
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/newLogo-removebg-preview.png')} 
        style={styles.logo}
      />
    </View>
    
  );
}

const { width, height } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6FAF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.99,  
    height: height * 0.99, 
    resizeMode: 'contain',
  },
});
