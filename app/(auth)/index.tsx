import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { PrimaryButton } from '@/components/PrimaryButton';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendMagicLink() {
    const v = email.trim();
    if (!v.includes('@')) {
      Alert.alert('Enter a valid email');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: v,
        options: {
          emailRedirectTo: 'mindarena://',
        },
      });
      if (error) throw error;
      Alert.alert('Check your email', 'We sent a magic link. Open it on your phone to sign in.');
    } catch (e: any) {
      Alert.alert('Sign-in failed', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>MindArena</Text>
      <Text style={styles.sub}>Daily brain puzzles + leaderboard</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <PrimaryButton title={loading ? 'Sending...' : 'Send Magic Link'} onPress={sendMagicLink} disabled={loading} />

      <Text style={styles.help}>
        Tip: Enable Email provider in Supabase Auth settings.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '900', marginBottom: 6 },
  sub: { fontSize: 16, opacity: 0.75, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  help: { marginTop: 12, opacity: 0.7, fontSize: 12 },
});
