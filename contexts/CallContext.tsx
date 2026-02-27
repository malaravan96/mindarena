import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { CallUiState } from '@/lib/types';

export type ActiveCallState = {
  conversationId: string;
  peerId: string;
  peerName: string;
  peerAvatarUrl: string | null;
  callState: CallUiState;
  callMode: 'audio' | 'video';
  callMuted: boolean;
  remoteStreamUrl: string | null;
  localStreamUrl: string | null;
  isInPiPMode: boolean;
};

type CallContextValue = {
  activeCall: ActiveCallState | null;
  publishCallState: (state: ActiveCallState) => void;
  clearCallState: () => void;
  registerEndCallFn: (fn: (() => void) | null) => void;
  endCallFromPiP: () => void;
  registerToggleMuteFn: (fn: (() => void) | null) => void;
  toggleMuteFromPiP: () => void;
  setIsInPiPMode: (val: boolean) => void;
};

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const endCallFnRef = useRef<(() => void) | null>(null);
  const toggleMuteFnRef = useRef<(() => void) | null>(null);

  const publishCallState = useCallback((state: ActiveCallState) => {
    setActiveCall(state);
  }, []);

  const clearCallState = useCallback(() => {
    setActiveCall(null);
  }, []);

  const registerEndCallFn = useCallback((fn: (() => void) | null) => {
    endCallFnRef.current = fn;
  }, []);

  const endCallFromPiP = useCallback(() => {
    endCallFnRef.current?.();
    setActiveCall(null);
  }, []);

  const registerToggleMuteFn = useCallback((fn: (() => void) | null) => {
    toggleMuteFnRef.current = fn;
  }, []);

  const toggleMuteFromPiP = useCallback(() => {
    toggleMuteFnRef.current?.();
  }, []);

  const setIsInPiPMode = useCallback((val: boolean) => {
    setActiveCall((prev) => (prev ? { ...prev, isInPiPMode: val } : null));
  }, []);

  return (
    <CallContext.Provider
      value={{
        activeCall,
        publishCallState,
        clearCallState,
        registerEndCallFn,
        endCallFromPiP,
        registerToggleMuteFn,
        toggleMuteFromPiP,
        setIsInPiPMode,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within a CallProvider');
  return ctx;
}
