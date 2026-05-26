'use client';

import { useEffect, useState } from 'react';

type Slot = { value: number; label: string };

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function compute(target: Date): Slot[] {
  const now = Date.now();
  const diff = Math.max(0, target.getTime() - now);
  const seconds = Math.floor(diff / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [
    { value: days, label: 'Jours' },
    { value: hours, label: 'Heures' },
    { value: minutes, label: 'Min' },
    { value: secs, label: 'Sec' },
  ];
}

export function Countdown({ target }: { target: Date }) {
  const [slots, setSlots] = useState<Slot[]>(() => compute(target));

  useEffect(() => {
    setSlots(compute(target));
    const id = setInterval(() => setSlots(compute(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="flex items-baseline gap-x-4 gap-y-2 md:gap-x-8">
      {slots.map((s, i) => (
        <div key={s.label} className="flex items-baseline gap-1.5">
          <div className="font-display text-6xl leading-none tabular-nums tracking-tight text-ink-900 md:text-7xl">
            {pad(s.value)}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500 md:text-xs">
            {s.label}
          </div>
          {i < slots.length - 1 && (
            <span className="ml-2 text-ink-300 md:ml-4">·</span>
          )}
        </div>
      ))}
    </div>
  );
}
