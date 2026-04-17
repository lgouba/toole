import { useState, useEffect, useRef, useCallback } from 'react';

export function useCountdown(initialSeconds: number, onComplete?: () => void) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    setRemaining(initialSeconds);
    setIsActive(true);
  }, [initialSeconds, clear]);

  const stop = useCallback(() => {
    clear();
    setIsActive(false);
  }, [clear]);

  const reset = useCallback(() => {
    clear();
    setRemaining(initialSeconds);
    setIsActive(false);
  }, [initialSeconds, clear]);

  useEffect(() => {
    if (!isActive) return;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clear();
          setIsActive(false);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clear;
  }, [isActive, clear, onComplete]);

  useEffect(() => {
    return clear;
  }, [clear]);

  return { remaining, isActive, start, stop, reset };
}
