import React, { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

interface AnimatedItemProps {
  /** Delay in ms before this element animates in. Use multiples of ~60 for stagger. */
  delay?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fades + slides a child element up on mount.
 * Wrap each major form section (heading, input group, button, footer)
 * with an increasing `delay` to create a staggered entrance effect.
 */
export function AnimatedItem({ delay = 0, children, style }: AnimatedItemProps) {
  const translateY = useRef(new Animated.Value(18)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 380,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
