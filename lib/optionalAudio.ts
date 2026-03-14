import Constants from 'expo-constants';

type ExpoAVModule = typeof import('expo-av');

const isExpoGo = Constants.executionEnvironment === 'storeClient';

let audioModulePromise: Promise<ExpoAVModule | null> | null = null;

export async function loadAudioModule(): Promise<ExpoAVModule | null> {
  if (isExpoGo) return null;

  if (!audioModulePromise) {
    audioModulePromise = import('expo-av').catch((error) => {
      console.warn(
        `[Audio] expo-av unavailable. Voice recording is disabled. ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    });
  }

  return audioModulePromise;
}
