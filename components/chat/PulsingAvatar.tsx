import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

type Props = {
  avatarUrl: string | null;
  name: string;
  size?: number;
};

const RING_COUNT = 3;

export function PulsingAvatar({ avatarUrl, name, size = 120 }: Props) {
  const anims = useRef(
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 400),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [anims]);

  const ringSize = size + 40;

  return (
    <View style={[styles.container, { width: ringSize + 40, height: ringSize + 40 }]}>
      {anims.map((anim, i) => {
        const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6 + i * 0.15] });
        const opacity = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.35, 0.2, 0] });
        return (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                transform: [{ scale }],
                opacity,
              },
            ]}
          />
        );
      })}
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.initials, { fontSize: size * 0.35 }]}>
            {name.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatar: {
    position: 'absolute',
  },
  fallback: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
  },
});
