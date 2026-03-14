import Constants from 'expo-constants';

type ExpoNotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.executionEnvironment === 'storeClient';

let notificationsModulePromise: Promise<ExpoNotificationsModule | null> | null = null;

export async function loadNotificationsModule(): Promise<ExpoNotificationsModule | null> {
  if (isExpoGo) return null;

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').catch((error) => {
      console.warn(
        `[Notifications] expo-notifications unavailable. Push features disabled. ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    });
  }

  return notificationsModulePromise;
}
