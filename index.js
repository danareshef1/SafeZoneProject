// index.js (root)
import './src/polyfills';                // נטען ראשון!
process.env.EXPO_ROUTER_APP_ROOT = 'src/app';
import 'expo-router/entry';
