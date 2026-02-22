import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications() {
  if ((Platform as any).OS === 'web') return null;
  if (!Device.isDevice) return null;

  let finalStatus = (await Notifications.getPermissionsAsync()).status;
  if (finalStatus !== 'granted') {
    finalStatus = (await Notifications.requestPermissionsAsync()).status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
      sound: 'default',
    });
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  return token.data;
}

export async function upsertCurrentUserPushToken() {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return null;

  const token = await registerForPushNotifications();
  if (!token) return null;

  const { error } = await supabase.from('user_push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    },
    { onConflict: 'user_id,expo_push_token' },
  );

  if (error) {
    return null;
  }

  return token;
}

export async function notifyDmMessage(messageId: string) {
  if (!messageId) return;
  const { error } = await supabase.functions.invoke('notify-dm-message', {
    body: { message_id: messageId },
  });
  if (error) throw error;
}

export async function notifyIncomingMatchCall(matchId: string, calleeId: string, callerName: string) {
  if (!matchId || !calleeId || !callerName) return;
  await supabase.functions.invoke('notify-incoming-match-call', {
    body: {
      match_id: matchId,
      callee_id: calleeId,
      caller_name: callerName,
    },
  });
}
