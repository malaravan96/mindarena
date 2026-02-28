import { useCallback, useEffect, useState } from 'react';

export function formatCooldown(secondsLeft: number) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useResendCooldown(defaultSeconds = 30) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft]);

  const startCooldown = useCallback(
    (seconds?: number) => {
      setSecondsLeft(seconds ?? defaultSeconds);
    },
    [defaultSeconds],
  );

  return {
    secondsLeft,
    canResend: secondsLeft === 0,
    startCooldown,
  };
}
