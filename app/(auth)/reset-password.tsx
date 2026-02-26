import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { PasswordStrengthBar } from '@/components/PasswordStrengthBar';
import { AuthWaveLayout } from '@/components/auth/AuthWaveLayout';
import { AnimatedItem } from '@/components/auth/AnimatedItem';
import { AUTH_CORAL } from '@/constants/authColors';
import { spacing } from '@/constants/theme';
import { validatePassword } from '@/lib/validation';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  async function handleUpdatePassword() {
    const newErrors: typeof errors = {};

    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) throw updateError;

      showAlert('Password Updated!', 'Your password has been successfully updated.');
      router.replace('/(app)');
    } catch (e: any) {
      showAlert('Update Failed', e?.message || 'Could not update password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthWaveLayout
      heroTitle="New password"
      heroSubtitle="Choose a strong password you haven't used before"
      onBack={() => router.back()}
      scrollable
    >
      <AnimatedItem delay={0}>
        <Text style={styles.formHeading}>Set your new password</Text>
      </AnimatedItem>

      <AnimatedItem delay={70}>
        <Input
          label="New Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) setErrors({ ...errors, password: undefined });
          }}
          placeholder="Min 8 characters"
          secureTextEntry
          showPasswordToggle
          autoCapitalize="none"
          autoComplete="password-new"
          textContentType="newPassword"
          error={errors.password}
          editable={!loading}
          focusColor={AUTH_CORAL}
          style={styles.inputInner}
        />
        <PasswordStrengthBar password={password} />
      </AnimatedItem>

      <AnimatedItem delay={140}>
        <Input
          label="Confirm New Password"
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
          }}
          placeholder="Re-enter your new password"
          secureTextEntry
          showPasswordToggle
          autoCapitalize="none"
          autoComplete="password-new"
          textContentType="newPassword"
          error={errors.confirmPassword}
          editable={!loading}
          focusColor={AUTH_CORAL}
          style={styles.inputInner}
        />
      </AnimatedItem>

      <AnimatedItem delay={210}>
        <Button
          title={loading ? 'Updating...' : 'Update Password'}
          onPress={handleUpdatePassword}
          disabled={loading}
          loading={loading}
          variant="primary"
          fullWidth
          size="lg"
          style={styles.primaryBtn}
        />
      </AnimatedItem>
    </AuthWaveLayout>
  );
}

const styles = StyleSheet.create({
  formHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    marginBottom: 20,
  },
  inputInner: {
    backgroundColor: '#FAFAFA',
  },
  primaryBtn: {
    backgroundColor: AUTH_CORAL,
    borderRadius: 999,
    borderColor: AUTH_CORAL,
    marginTop: spacing.sm,
  },
});
