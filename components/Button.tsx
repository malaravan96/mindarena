import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'gradient';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: ViewStyle;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  style,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors: themeColors } = useTheme();

  const sizeStyles = {
    sm: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      fontSize: fontSize.sm,
    },
    md: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      fontSize: fontSize.base,
    },
    lg: {
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      fontSize: fontSize.lg,
    },
  };

  const variantStyles = {
    primary: {
      backgroundColor: themeColors.primary,
      borderColor: themeColors.primary,
      textColor: '#ffffff',
    },
    secondary: {
      backgroundColor: themeColors.secondary,
      borderColor: themeColors.secondary,
      textColor: '#ffffff',
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: themeColors.border,
      textColor: themeColors.text,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      textColor: themeColors.primary,
    },
    gradient: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      textColor: '#ffffff',
    },
  };

  const currentSize = sizeStyles[size];
  const currentVariant = variantStyles[variant];
  const isGradient = variant === 'gradient';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          paddingVertical: currentSize.paddingVertical,
          paddingHorizontal: currentSize.paddingHorizontal,
          minHeight: 44,
          backgroundColor: isGradient ? undefined : currentVariant.backgroundColor,
          borderColor: currentVariant.borderColor,
          borderRadius: borderRadius.md,
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: disabled || loading ? 0.5 : pressed ? 0.8 : 1,
          width: fullWidth ? '100%' : 'auto',
          overflow: 'hidden' as const,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      hitSlop={6}
      testID={testID}
    >
      {isGradient && (
        <>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: themeColors.gradientStart },
            ]}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: themeColors.gradientEnd,
                opacity: 0.6,
                left: '50%',
              },
            ]}
          />
        </>
      )}
      {loading ? (
        <ActivityIndicator color={currentVariant.textColor} />
      ) : (
        <Text
          style={[
            styles.text,
            {
              color: currentVariant.textColor,
              fontSize: currentSize.fontSize,
              fontWeight: fontWeight.bold,
            },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    textAlign: 'center',
  },
});
