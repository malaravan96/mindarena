import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode | keyof typeof Ionicons.glyphMap;
  showPasswordToggle?: boolean;
  focusColor?: string;
  clearable?: boolean;
  showCharacterCount?: boolean;
}

export const Input = React.forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    icon,
    showPasswordToggle,
    focusColor,
    clearable = false,
    showCharacterCount,
    style,
    secureTextEntry,
    ...props
  },
  ref,
) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const resolvedFocusColor = focusColor ?? colors.primary;
  const isSecure = showPasswordToggle ? !passwordVisible : secureTextEntry;
  const valueAsText =
    typeof props.value === 'string'
      ? props.value
      : typeof props.value === 'number'
        ? String(props.value)
        : '';
  const showCount = (showCharacterCount ?? Boolean(props.maxLength)) && !secureTextEntry;
  const hasMeta = !!error || !!helperText || showCount;
  const canClear =
    clearable &&
    !isSecure &&
    props.editable !== false &&
    valueAsText.length > 0 &&
    typeof props.onChangeText === 'function';
  const resolvedAccessibilityLabel = props.accessibilityLabel ?? label ?? props.placeholder ?? 'Input field';
  const resolvedAccessibilityHint = props.accessibilityHint ?? (error ? `Error: ${error}` : helperText);
  const iconNode =
    typeof icon === 'string' ? (
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.textTertiary} />
    ) : (
      icon
    );
  const trailingPadding = canClear || showPasswordToggle ? spacing.xs : spacing.md;

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
            borderColor: error ? colors.error : isFocused ? resolvedFocusColor : colors.border,
            borderRadius: borderRadius.md,
          },
        ]}
      >
        {iconNode && (
          <View style={styles.iconWrap}>{iconNode}</View>
        )}
        <TextInput
          ref={ref}
          {...props}
          secureTextEntry={isSecure}
          style={[
            styles.input,
            {
              color: colors.text,
              fontSize: fontSize.base,
              paddingLeft: iconNode ? 0 : spacing.md,
              paddingRight: trailingPadding,
            },
            style,
          ]}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={resolvedAccessibilityLabel}
          accessibilityHint={resolvedAccessibilityHint}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
        />
        {canClear && (
          <Pressable
            onPress={() => props.onChangeText?.('')}
            style={styles.toggleBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear text"
            accessibilityHint="Clears the current field value"
          >
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
        {showPasswordToggle && (
          <Pressable
            onPress={() => setPasswordVisible((v) => !v)}
            style={styles.toggleBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            accessibilityHint="Toggles password visibility"
            accessibilityState={{ disabled: props.editable === false }}
            disabled={props.editable === false}
          >
            <Ionicons
              name={passwordVisible ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textTertiary}
            />
          </Pressable>
        )}
      </View>
      {hasMeta && (
        <View style={styles.metaRow}>
          <View style={styles.metaMain}>
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
                accessibilityLiveRegion="polite"
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
                accessibilityLiveRegion="polite"
              >
                {helperText}
              </Text>
            )}
          </View>
          {showCount && (
            <Text
              style={[
                styles.countText,
                {
                  color: error ? colors.error : colors.textTertiary,
                  fontSize: fontSize.xs,
                },
              ]}
              accessibilityLabel={`Character count ${valueAsText.length}${props.maxLength ? ` of ${props.maxLength}` : ''}`}
            >
              {props.maxLength ? `${valueAsText.length}/${props.maxLength}` : valueAsText.length}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    minHeight: 48,
  },
  iconWrap: {
    paddingLeft: spacing.md,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
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
  helperText: {},
  metaRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaMain: {
    flex: 1,
    minWidth: 0,
  },
  countText: {
    marginTop: 0,
  },
});
