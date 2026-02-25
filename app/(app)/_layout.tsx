import React, { useEffect, useMemo, useRef } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Notifications from 'expo-notifications';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { upsertCurrentUserPushToken } from '@/lib/push';
import { trackPresence } from '@/lib/presence';
import { getCurrentUserId } from '@/lib/dm';
import { CallProvider } from '@/contexts/CallContext';
import { PiPCallWindow } from '@/components/chat/PiPCallWindow';

type TabRoute = 'index' | 'leaderboard' | 'pvp' | 'profile' | 'chat';

type NotificationPayload = {
  type?: unknown;
  conversation_id?: unknown;
  group_id?: unknown;
};

type TabConfig = {
  name: TabRoute;
  title: string;
  icon: {
    active: keyof typeof Ionicons.glyphMap;
    inactive: keyof typeof Ionicons.glyphMap;
  };
};

const TAB_CONFIG: TabConfig[] = [
  { name: 'index', title: 'Home', icon: { active: 'home', inactive: 'home-outline' } },
  {
    name: 'leaderboard',
    title: 'Rankings',
    icon: { active: 'trophy', inactive: 'trophy-outline' },
  },
  { name: 'pvp', title: 'Battle', icon: { active: 'flash', inactive: 'flash-outline' } },
  {
    name: 'profile',
    title: 'Profile',
    icon: { active: 'person', inactive: 'person-outline' },
  },
  {
    name: 'chat',
    title: 'Chat',
    icon: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
  },
];

export default function AppLayout() {
  const router = useRouter();
  const { colors, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const presenceCleanupRef = useRef<(() => void) | null>(null);

  const isIOS = Platform.OS === 'ios';
  const bottomInset = Math.max(insets.bottom, isIOS ? 14 : 10);

  useEffect(() => {
    upsertCurrentUserPushToken().catch(() => null);
  }, []);

  // Presence tracking
  useEffect(() => {
    let mounted = true;
    (async () => {
      const uid = await getCurrentUserId();
      if (!uid || !mounted) return;
      const cleanup = await trackPresence(uid);
      if (mounted) {
        presenceCleanupRef.current = cleanup;
      } else {
        cleanup();
      }
    })();
    return () => {
      mounted = false;
      presenceCleanupRef.current?.();
      presenceCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const routeFromPayload = (raw: unknown) => {
      const data = raw as NotificationPayload | null | undefined;
      if (data?.type === 'dm') {
        if (typeof data.conversation_id !== 'string') return;
        router.push({
          pathname: '/chat-thread',
          params: { conversationId: data.conversation_id },
        });
      } else if (data?.type === 'group') {
        const groupId = (data as any).group_id;
        if (typeof groupId !== 'string') return;
        router.push({
          pathname: '/group-chat',
          params: { groupId },
        });
      }
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!mounted || !response) return;
        routeFromPayload(response.notification.request.content.data);
      })
      .catch(() => null);

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFromPayload(response.notification.request.content.data);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [router]);

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textSecondary,
      tabBarHideOnKeyboard: true,
      tabBarStyle: {
        position: 'absolute' as const,
        left: 12,
        right: 12,
        bottom: 8,
        height: 62 + bottomInset,
        paddingBottom: bottomInset,
        paddingTop: 8,
        borderTopWidth: 0,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 22,
        backgroundColor: isIOS ? 'transparent' : colors.surface,
        elevation: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: colorScheme === 'dark' ? 0.28 : 0.08,
        shadowRadius: 20,
      },
      tabBarItemStyle: {
        paddingVertical: 2,
      },
      tabBarBackground: () =>
        isIOS ? (
          <BlurView
            tint={colorScheme === 'dark' ? 'dark' : 'light'}
            intensity={85}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
        ),
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600' as const,
        marginTop: 2,
      },
    }),
    [bottomInset, colorScheme, colors, isIOS],
  );

  return (
    <CallProvider>
      <View style={{ flex: 1 }}>
        <Tabs screenOptions={screenOptions}>
          {TAB_CONFIG.map((tab) => (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              options={{
                title: tab.title,
                tabBarIcon: ({ color, size, focused }) => (
                  <View
                    style={[
                      styles.iconContainer,
                      focused && {
                        backgroundColor:
                          colorScheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
                      },
                    ]}
                  >
                    <Ionicons
                      name={focused ? tab.icon.active : tab.icon.inactive}
                      size={size + 1}
                      color={color}
                    />
                  </View>
                ),
              }}
            />
          ))}
          <Tabs.Screen
            name="chat-thread"
            options={{
              href: null,
              tabBarStyle: { display: 'none' },
            }}
          />
          <Tabs.Screen name="rewards" options={{ href: null }} />
          <Tabs.Screen name="badges" options={{ href: null }} />
          <Tabs.Screen name="avatar-customization" options={{ href: null }} />
          <Tabs.Screen name="timed-challenge" options={{ href: null }} />
          <Tabs.Screen name="puzzle-streak" options={{ href: null }} />
          <Tabs.Screen name="category-mastery" options={{ href: null }} />
          <Tabs.Screen name="practice" options={{ href: null }} />
          <Tabs.Screen name="weekly-challenge" options={{ href: null }} />
          <Tabs.Screen name="tournaments" options={{ href: null }} />
          <Tabs.Screen name="tournament-detail" options={{ href: null }} />
          <Tabs.Screen name="tournament-results" options={{ href: null }} />
          <Tabs.Screen name="activity-feed" options={{ href: null }} />
          <Tabs.Screen name="player-search" options={{ href: null }} />
          <Tabs.Screen name="player-profile" options={{ href: null }} />
          <Tabs.Screen name="teams" options={{ href: null }} />
          <Tabs.Screen name="team-detail" options={{ href: null }} />
          <Tabs.Screen name="team-chat" options={{ href: null }} />
          <Tabs.Screen name="team-challenge" options={{ href: null }} />
          <Tabs.Screen name="team-leaderboard" options={{ href: null }} />
          <Tabs.Screen
            name="group-chat"
            options={{ href: null, tabBarStyle: { display: 'none' } }}
          />
          <Tabs.Screen
            name="create-group"
            options={{ href: null, tabBarStyle: { display: 'none' } }}
          />
          <Tabs.Screen
            name="image-viewer"
            options={{ href: null, tabBarStyle: { display: 'none' } }}
          />
        </Tabs>
        <PiPCallWindow />
      </View>
    </CallProvider>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
