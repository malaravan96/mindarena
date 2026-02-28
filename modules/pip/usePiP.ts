import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  addPiPListener,
  enterPiP as nativeEnterPiP,
  exitPiP as nativeExitPiP,
  isPiPSupported as nativeIsPiPSupported,
  type PiPEvent,
} from './index';

type PiPActionHandler = {
  onToggleMute?: () => void;
  onHangUp?: () => void;
  onCallKitMute?: (isMuted: boolean) => void;
};

/**
 * React hook that wraps the native PiP module.
 *
 * Provides:
 * - `isInPiP` — whether the app is currently in OS PiP mode (Android only)
 * - `supported` — whether true system PiP is available
 * - `enterPiP()` — request entering PiP
 * - `exitPiP()` — request exiting PiP
 *
 * Also subscribes to PiP action events (mute/hangup from PiP window or notification).
 */
export function usePiP(handlers?: PiPActionHandler) {
  const [isInPiP, setIsInPiP] = useState(false);
  const [supported, setSupported] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Check support on mount
  useEffect(() => {
    nativeIsPiPSupported().then(setSupported).catch(() => setSupported(false));
  }, []);

  // Subscribe to native PiP events
  useEffect(() => {
    const unsubscribe = addPiPListener((event: PiPEvent) => {
      switch (event.type) {
        case 'pipModeChanged':
          setIsInPiP(event.isInPiP);
          break;
        case 'pipAction':
          if (event.action === 'toggleMute') {
            handlersRef.current?.onToggleMute?.();
          } else if (event.action === 'hangUp') {
            handlersRef.current?.onHangUp?.();
          }
          break;
        case 'callKitAction':
          if (event.action === 'mute') {
            handlersRef.current?.onCallKitMute?.(event.isMuted);
          } else if (event.action === 'hangUp') {
            handlersRef.current?.onHangUp?.();
          }
          break;
      }
    });

    return unsubscribe;
  }, []);

  const enterPiP = useCallback(async () => {
    if (Platform.OS === 'android') {
      return await nativeEnterPiP();
    }
    return false;
  }, []);

  const exitPiP = useCallback(async () => {
    return await nativeExitPiP();
  }, []);

  return { isInPiP, supported, enterPiP, exitPiP };
}
