import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: string;
  showPasswordToggle?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  icon,
  showPasswordToggle,
  style,
  secureTextEntry,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const isSecure = showPasswordToggle ? !passwordVisible : secureTextEntry;

  return (
    <View style={styles.container}>
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: colors.text,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              marginBottom: spacing.xs,
            },
          ]}
        >
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : isFocused ? colors.primary : colors.border,
            borderRadius: borderRadius.md,
          },
        ]}
      >
        {icon && (
          <Text style={[styles.icon, { color: colors.textTertiary }]}>{icon}</Text>
        )}
        <TextInput
          {...props}
          secureTextEntry={isSecure}
          style={[
            styles.input,
            {
              color: colors.text,
              fontSize: fontSize.base,
              paddingLeft: icon ? 0 : spacing.md,
              paddingRight: showPasswordToggle ? 0 : spacing.md,
            },
            style,
          ]}
          placeholderTextColor={colors.textTertiary}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
        />
        {showPasswordToggle && (
          <Pressable
            onPress={() => setPasswordVisible((v) => !v)}
            style={styles.toggleBtn}
            hitSlop={8}
          >
            <Text style={[styles.toggleIcon, { color: colors.textTertiary }]}>
              {passwordVisible ? '\u{1F441}' : '\u{1F441}\u{200D}\u{1F5E8}'}
            </Text>
          </Pressable>
        )}
      </View>
      {error && (
        <Text
          style={[
            styles.helperText,
            {
              color: colors.error,
              fontSize: fontSize.xs,
              marginTop: spacing.xs,
            },
          ]}
        >
          {error}
        </Text>
      )}
      {!error && helperText && (
        <Text
          style={[
            styles.helperText,
            {
              color: colors.textSecondary,
              fontSize: fontSize.xs,
              marginTop: spacing.xs,
            },
          ]}
        >
          {helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
  },
  icon: {
    fontSize: 18,
    paddingLeft: spacing.md,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
  },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleIcon: {
    fontSize: 18,
  },
  helperText: {},
});
