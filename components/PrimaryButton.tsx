import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';

export function PrimaryButton({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        disabled ? styles.btnDisabled : null,
        pressed && !disabled ? styles.btnPressed : null,
        style,
      ]}
    >
      <Text style={styles.txt}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  txt: { color: 'white', fontSize: 16, fontWeight: '700' },
});
