import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  size?: number;
  backgroundColor?: string;
  iconColor?: string;
  active?: boolean;
  disabled?: boolean;
};

export function CallControlButton({
  icon,
  label,
  onPress,
  size = 56,
  backgroundColor = 'rgba(255,255,255,0.15)',
  iconColor = '#fff',
  active = false,
  disabled = false,
}: Props) {
  const btnSize = size;
  const iconSize = btnSize * 0.43;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.wrapper, { opacity: disabled ? 0.4 : 1 }]}
    >
      <View
        style={[
          styles.circle,
          {
            width: btnSize,
            height: btnSize,
            borderRadius: btnSize / 2,
            backgroundColor: active ? '#fff' : backgroundColor,
          },
        ]}
      >
        <Ionicons name={icon} size={iconSize} color={active ? '#333' : iconColor} />
      </View>
      <Text style={[styles.label, { color: '#fff' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 6,
    minWidth: 70,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});
