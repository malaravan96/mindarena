import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { getActiveConversationId, getActiveGroupId } from '@/lib/notificationState';

// Set at module level so it is registered before any cold-start notification routing.
// Suppress the banner when the user is already viewing the relevant chat.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Record<string, unknown> | undefined;

    if (data) {
      // Suppress DM notification if user is viewing that conversation
      if (data.type === 'dm' && typeof data.conversation_id === 'string') {
        if (data.conversation_id === getActiveConversationId()) {
          return { shouldPlaySound: false, shouldSetBadge: true, shouldShowBanner: false, shouldShowList: false };
        }
      }
      // Suppress group notification if user is viewing that group
      if (data.type === 'group' && typeof data.group_id === 'string') {
        if (data.group_id === getActiveGroupId()) {
          return { shouldPlaySound: false, shouldSetBadge: true, shouldShowBanner: false, shouldShowList: false };
        }
      }
    }

    return { shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true };
  },
});

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
