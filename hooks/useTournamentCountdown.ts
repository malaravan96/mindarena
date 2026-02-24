import { useState, useEffect, useRef } from 'react';

type CountdownResult = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  formatted: string;
};

export function useTournamentCountdown(targetDate: string | Date | null): CountdownResult {
  const [countdown, setCountdown] = useState<CountdownResult>(getInitial());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function getInitial(): CountdownResult {
    if (!targetDate) return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, formatted: '0:00:00' };
    return calculate(new Date(targetDate));
  }

  function calculate(target: Date): CountdownResult {
    const now = Date.now();
    const diff = target.getTime() - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, formatted: '0:00:00' };
    }

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    let formatted = '';
    if (days > 0) formatted = `${days}d ${hours}h`;
    else if (hours > 0) formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    else formatted = `${minutes}:${String(seconds).padStart(2, '0')}`;

    return { days, hours, minutes, seconds, isExpired: false, formatted };
  }

  useEffect(() => {
    if (!targetDate) return;

    const target = new Date(targetDate);
    setCountdown(calculate(target));

    intervalRef.current = setInterval(() => {
      const result = calculate(target);
      setCountdown(result);
      if (result.isExpired && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetDate]);

  return countdown;
}
