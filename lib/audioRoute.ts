import { Platform } from 'react-native';

export type CallAudioMode = 'audio' | 'video';

type InCallManagerModule = {
  start?: (options?: Record<string, unknown>) => void;
  stop?: () => void;
  setForceSpeakerphoneOn?: (enabled: boolean | null) => void;
  setSpeakerphoneOn?: (enabled: boolean) => void;
};

let managerCache: InCallManagerModule | null | undefined;

function getInCallManager(): InCallManagerModule | null {
  if (Platform.OS === 'web') return null;
  if (managerCache !== undefined) return managerCache;
  try {
    const mod = require('react-native-incall-manager');
    managerCache = (mod?.default ?? mod) as InCallManagerModule;
  } catch {
    managerCache = null;
  }
  return managerCache;
}

export async function startCallAudio(mode: CallAudioMode) {
  const manager = getInCallManager();
  if (!manager) return false;
  try {
    manager.start?.({
      media: mode === 'video' ? 'video' : 'audio',
      auto: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function setSpeaker(enabled: boolean) {
  const manager = getInCallManager();
  if (!manager) return false;
  try {
    manager.setForceSpeakerphoneOn?.(enabled);
    manager.setSpeakerphoneOn?.(enabled);
    return true;
  } catch {
    return false;
  }
}

export async function stopCallAudio() {
  const manager = getInCallManager();
  if (!manager) return false;
  try {
    manager.setForceSpeakerphoneOn?.(null);
    manager.setSpeakerphoneOn?.(false);
    manager.stop?.();
    return true;
  } catch {
    return false;
  }
}
