import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { PrimaryButton } from '@/components/PrimaryButton';

export default function Profile() {
  const [email, setEmail] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      setEmail(userData.user?.email ?? '');
      const uid = userData.user?.id;
      if (!uid) return;

      const { data } = await supabase.from('profiles').select('display_name').eq('id', uid).maybeSingle<{ display_name: string | null }>();
      setDisplayName(data?.display_name ?? '');
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Not signed in');

      const { error } = await supabase.from('profiles').upsert({
        id: uid,
        display_name: displayName.trim() || null,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      Alert.alert('Saved', 'Profile updated');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Profile</Text>
      <Text style={styles.h2}>{email}</Text>

      <Text style={styles.label}>Display name</Text>
      <TextInput value={displayName} onChangeText={setDisplayName} placeholder="e.g., Malaravan" style={styles.input} />

      <PrimaryButton title={saving ? 'Saving...' : 'Save'} onPress={save} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: 'white' },
  h1: { fontSize: 28, fontWeight: '900' },
  h2: { fontSize: 13, opacity: 0.65, marginTop: 2, marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 16 },
});
