import { Platform } from 'react-native';

let SecureStore: typeof import('expo-secure-store') | null = null;

if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch {
    // SecureStore not available – fall through to localStorage
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  if (SecureStore) {
    return SecureStore.getItemAsync(key);
  }
  return null;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch {
      // quota exceeded or private browsing
    }
    return;
  }
  if (SecureStore) {
    await SecureStore.setItemAsync(key, value);
  }
}
