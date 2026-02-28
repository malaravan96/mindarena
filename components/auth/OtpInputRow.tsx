import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';

interface OtpInputRowProps {
  otp: string[];
  error?: string;
  loading?: boolean;
  inputRefs: React.MutableRefObject<(TextInput | null)[]>;
  onChange: (text: string, index: number) => void;
  onKeyPress: (key: string, index: number) => void;
  autoFocusFirst?: boolean;
  activeColor?: string;
}

export function OtpInputRow({
  otp,
  error,
  loading,
  inputRefs,
  onChange,
  onKeyPress,
  autoFocusFirst = false,
  activeColor,
}: OtpInputRowProps) {
  const { colors } = useTheme();
  const otpLength = otp.length;
  const filledColor = activeColor ?? colors.primary;

  return (
    <View style={styles.otpContainer}>
      {otp.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            inputRefs.current[index] = ref;
          }}
          style={[
            styles.otpBox,
            {
              borderColor: digit ? filledColor : error ? colors.error : colors.border,
              backgroundColor: colors.surface,
              color: colors.text,
            },
          ]}
          value={digit}
          onChangeText={(text) => onChange(text, index)}
          onKeyPress={({ nativeEvent }) => onKeyPress(nativeEvent.key, index)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          importantForAutofill="yes"
          inputMode="numeric"
          maxLength={index === 0 ? otpLength : 1}
          selectTextOnFocus
          editable={!loading}
          autoFocus={autoFocusFirst && index === 0}
          accessibilityLabel={`Verification code digit ${index + 1} of ${otpLength}`}
          accessibilityHint={index === 0 ? 'You can paste the full code here' : undefined}
          accessibilityState={{ disabled: !!loading }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    textAlign: 'center',
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
});
