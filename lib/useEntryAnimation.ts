import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

export function useEntryAnimation(duration = 500, delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();

    Animated.timing(translateY, {
      toValue: 0,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return { opacity, transform: [{ translateY }] };
}
