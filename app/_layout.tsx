import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const { colors, colorScheme } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onVerifyEmail = (segments as string[])[1] === 'verify-email';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)');
    } else if (session && inAuthGroup && !onVerifyEmail) {
      // Don't redirect away from verify-email — let the user finish verification
      router.replace('/(app)');
    }
  }, [session, ready, segments]);

  if (!ready) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
