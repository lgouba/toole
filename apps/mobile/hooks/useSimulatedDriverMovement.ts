import { useState, useEffect, useRef } from 'react';
import { LatLng } from '@/types';
import { interpolatePosition } from '@/utils/geo';

interface UseSimulatedDriverMovementOptions {
  from: LatLng;
  to: LatLng;
  durationMs?: number;
  intervalMs?: number;
  enabled?: boolean;
}

export function useSimulatedDriverMovement({
  from,
  to,
  durationMs = 30000,
  intervalMs = 2000,
  enabled = true,
}: UseSimulatedDriverMovementOptions) {
  const [currentPosition, setCurrentPosition] = useState(from);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    startTimeRef.current = Date.now();
    setIsComplete(false);
    setProgress(0);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min(1, elapsed / durationMs);

      setProgress(p);
      setCurrentPosition(interpolatePosition(from, to, p));

      if (p >= 1) {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [from.latitude, from.longitude, to.latitude, to.longitude, durationMs, intervalMs, enabled]);

  return { currentPosition, progress, isComplete };
}
