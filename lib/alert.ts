import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert that works on both native and web.
 */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Cross-platform confirm dialog. Returns true if user confirmed.
 */
export function showConfirm(
  title: string,
  message?: string,
  confirmText = 'OK',
): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(window.confirm(message ? `${title}\n\n${message}` : title));
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
      ]);
    }
  });
}
