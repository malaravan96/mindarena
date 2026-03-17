import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { PiPModule } = NativeModules;
const pipWarnings = new Set<string>();

let emitter: NativeEventEmitter | null = null;

function warnMissingMethod(methodName: string) {
  const key = `missing:${methodName}`;
  if (pipWarnings.has(key)) return;
  pipWarnings.add(key);
  console.warn(`[PiP] Native method "${methodName}" is unavailable. PiP features are disabled.`);
}

function getNativeMethod<T extends (...args: any[]) => any>(methodName: string): T | null {
  if (!PiPModule) return null;
  const candidate = (PiPModule as Record<string, unknown>)[methodName];
  if (typeof candidate !== 'function') {
    warnMissingMethod(methodName);
    return null;
  }
  return candidate as T;
}

function getEmitter(): NativeEventEmitter | null {
  if (!PiPModule) return null;
  if (emitter) return emitter;

  try {
    emitter = new NativeEventEmitter(PiPModule);
  } catch (error) {
    console.warn(
      `[PiP] NativeEventEmitter unavailable. PiP event subscription is disabled. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    emitter = null;
  }

  return emitter;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type PiPEvent =
  | { type: 'pipModeChanged'; isInPiP: boolean }
  | { type: 'pipAction'; action: 'toggleMute' | 'hangUp' }
  | { type: 'callKitAction'; action: 'mute'; isMuted: boolean }
  | { type: 'callKitAction'; action: 'hangUp' };

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Enter system Picture-in-Picture mode.
 * On Android: Shrinks the activity into a PiP window.
 * On iOS: No-op (CallKit handles background audio).
 * Returns true if PiP was entered successfully.
 */
export async function enterPiP(): Promise<boolean> {
  const enter = getNativeMethod<() => Promise<boolean>>('enterPiP');
  if (!enter) return false;
  try {
    return await enter();
  } catch {
    return false;
  }
}

/**
 * Exit PiP mode and return to full-screen.
 */
export async function exitPiP(): Promise<boolean> {
  const exit = getNativeMethod<() => Promise<boolean>>('exitPiP');
  if (!exit) return false;
  try {
    return await exit();
  } catch {
    return false;
  }
}

/**
 * Check if the device supports true system PiP (Android 8.0+).
 * On iOS this returns false — CallKit background audio is used instead.
 */
export async function isPiPSupported(): Promise<boolean> {
  const checkSupported = getNativeMethod<() => Promise<boolean>>('isPiPSupported');
  if (!checkSupported) return false;
  try {
    return await checkSupported();
  } catch {
    return false;
  }
}

/**
 * Notify the native module that a call is active/inactive.
 * - Android: Enables auto-PiP on Home press + starts foreground service.
 * - iOS: Reports the call to CallKit for background audio persistence.
 */
export function setCallActive(
  active: boolean,
  options?: { peerName?: string; hasVideo?: boolean; isMuted?: boolean },
): void {
  const setActive = getNativeMethod<(...args: any[]) => void>('setCallActive');
  if (!setActive) return;

  if (Platform.OS === 'android') {
    setActive(active);
  } else if (Platform.OS === 'ios') {
    setActive(
      active,
      options?.peerName ?? 'Call',
      options?.hasVideo ?? false,
    );
  }
}

/**
 * Update PiP action icons (e.g., toggle mute icon in PiP window).
 * Android only — updates the RemoteAction icons in the PiP window.
 */
export function updatePiPActions(isMuted: boolean): void {
  const updateActions = getNativeMethod<(muted: boolean) => void>('updatePiPActions');
  if (!updateActions) return;
  updateActions(isMuted);
}

/**
 * Start the foreground service to keep the call alive in background.
 * Android only — iOS uses CallKit instead.
 */
export function startForegroundService(peerName: string): void {
  if (Platform.OS !== 'android') return;
  const startService = getNativeMethod<(nextPeerName: string) => void>('startForegroundService');
  if (!startService) return;
  startService(peerName);
}

/**
 * Stop the foreground service when the call ends.
 */
export function stopForegroundService(): void {
  if (Platform.OS !== 'android') return;
  const stopService = getNativeMethod<() => void>('stopForegroundService');
  if (!stopService) return;
  stopService();
}

/**
 * Get current PiP mode state synchronously (async bridge).
 */
export async function getIsInPiPMode(): Promise<boolean> {
  const getMode = getNativeMethod<() => Promise<boolean>>('getIsInPiPMode');
  if (!getMode) return false;
  try {
    return await getMode();
  } catch {
    return false;
  }
}

/**
 * Subscribe to PiP-related events from the native module.
 * Events:
 * - `pipModeChanged` — Android PiP mode entered/exited
 * - `pipAction` — User tapped a PiP/notification action (toggleMute, hangUp)
 * - `callKitAction` — iOS CallKit action (mute from system UI)
 *
 * Returns an unsubscribe function.
 */
export function addPiPListener(callback: (event: PiPEvent) => void): () => void {
  const eventEmitter = getEmitter();
  if (!eventEmitter) return () => {};

  const subs = [
    eventEmitter.addListener('onPiPModeChanged', (data: { isInPiP: boolean }) => {
      callback({ type: 'pipModeChanged', isInPiP: data.isInPiP });
    }),
    eventEmitter.addListener('onPiPAction', (data: { action: string }) => {
      if (data.action === 'toggleMute' || data.action === 'hangUp') {
        callback({ type: 'pipAction', action: data.action });
      }
    }),
    eventEmitter.addListener('onCallKitAction', (data: { action: string; isMuted?: boolean }) => {
      if (data.action === 'mute') {
        callback({ type: 'callKitAction', action: 'mute', isMuted: data.isMuted ?? false });
      } else if (data.action === 'hangUp') {
        callback({ type: 'callKitAction', action: 'hangUp' } as PiPEvent);
      }
    }),
  ];

  return () => {
    subs.forEach((s) => s.remove());
  };
}
