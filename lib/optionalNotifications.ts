type ExpoNotificationsModule = typeof import('expo-notifications');

let notificationsModulePromise: Promise<ExpoNotificationsModule | null> | null = null;
let warningLogged = false;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function loadNotificationsModule(): Promise<ExpoNotificationsModule | null> {
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').catch((error) => {
      if (!warningLogged) {
        warningLogged = true;
        console.warn(
          `[Notifications] expo-notifications unavailable. Push features are disabled until the native app is rebuilt. ${getErrorMessage(error)}`,
        );
      }
      return null;
    });
  }

  return notificationsModulePromise;
}
