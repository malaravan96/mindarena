import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { PiPModule } = NativeModules;

const emitter = PiPModule ? new NativeEventEmitter(PiPModule) : null;

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
  if (!PiPModule) return false;
  try {
    return await PiPModule.enterPiP();
  } catch {
    return false;
  }
}

/**
 * Exit PiP mode and return to full-screen.
 */
export async function exitPiP(): Promise<boolean> {
  if (!PiPModule) return false;
  try {
    return await PiPModule.exitPiP();
  } catch {
    return false;
  }
}

/**
 * Check if the device supports true system PiP (Android 8.0+).
 * On iOS this returns false — CallKit background audio is used instead.
 */
export async function isPiPSupported(): Promise<boolean> {
  if (!PiPModule) return false;
  try {
    return await PiPModule.isPiPSupported();
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
  if (!PiPModule) return;

  if (Platform.OS === 'android') {
    PiPModule.setCallActive(active);
  } else if (Platform.OS === 'ios') {
    PiPModule.setCallActive(
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
  if (!PiPModule) return;
  PiPModule.updatePiPActions(isMuted);
}

/**
 * Start the foreground service to keep the call alive in background.
 * Android only — iOS uses CallKit instead.
 */
export function startForegroundService(peerName: string): void {
  if (!PiPModule || Platform.OS !== 'android') return;
  PiPModule.startForegroundService(peerName);
}

/**
 * Stop the foreground service when the call ends.
 */
export function stopForegroundService(): void {
  if (!PiPModule || Platform.OS !== 'android') return;
  PiPModule.stopForegroundService();
}

/**
 * Get current PiP mode state synchronously (async bridge).
 */
export async function getIsInPiPMode(): Promise<boolean> {
  if (!PiPModule) return false;
  try {
    return await PiPModule.getIsInPiPMode();
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
  if (!emitter) return () => {};

  const subs = [
    emitter.addListener('onPiPModeChanged', (data: { isInPiP: boolean }) => {
      callback({ type: 'pipModeChanged', isInPiP: data.isInPiP });
    }),
    emitter.addListener('onPiPAction', (data: { action: string }) => {
      if (data.action === 'toggleMute' || data.action === 'hangUp') {
        callback({ type: 'pipAction', action: data.action });
      }
    }),
    emitter.addListener('onCallKitAction', (data: { action: string; isMuted?: boolean }) => {
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
