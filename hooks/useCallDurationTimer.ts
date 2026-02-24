import { useEffect, useRef, useState } from 'react';
import type { CallUiState } from '@/lib/types';

function formatDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hrs > 0 ? `${String(hrs).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function useCallDurationTimer(callState: CallUiState): string {
  const [elapsed, setElapsed] = useState(0);
  const startTsRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef(0);

  useEffect(() => {
    if (callState === 'live') {
      if (startTsRef.current === null) {
        startTsRef.current = Date.now();
      }
      const tick = () => {
        if (startTsRef.current === null) return;
        const delta = Math.floor((Date.now() - startTsRef.current) / 1000);
        setElapsed(pausedElapsedRef.current + delta);
      };
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }

    if (callState === 'reconnecting') {
      // Pause: freeze the accumulated elapsed time
      if (startTsRef.current !== null) {
        pausedElapsedRef.current += Math.floor((Date.now() - startTsRef.current) / 1000);
        startTsRef.current = null;
      }
      return;
    }

    // 'off' or 'connecting' — reset
    startTsRef.current = null;
    pausedElapsedRef.current = 0;
    setElapsed(0);
  }, [callState]);

  return formatDuration(elapsed);
}
