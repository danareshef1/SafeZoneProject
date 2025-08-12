// src/polyfills.ts
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { decode, encode } from 'base-64';
if (!(global as any).atob) (global as any).atob = decode as any;
if (!(global as any).btoa) (global as any).btoa = encode as any;

import { Buffer } from 'buffer';
if (!(global as any).Buffer) (global as any).Buffer = Buffer;

import 'fast-text-encoding';


// דיבאג קטן שכדאי להשאיר זמנית
console.log('polyfills loaded', !!(global as any).crypto, typeof (global as any).atob);
