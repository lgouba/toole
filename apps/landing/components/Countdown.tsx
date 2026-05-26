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
    { value: minutes, label: 'Minutes' },
    { value: secs, label: 'Secondes' },
  ];
}

export function Countdown({ target }: { target: Date }) {
  // SSR-safe : on initialise sur le target (statique), puis on update au mount
  const [slots, setSlots] = useState<Slot[]>(() => compute(target));

  useEffect(() => {
    setSlots(compute(target));
    const id = setInterval(() => setSlots(compute(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="grid grid-cols-4 gap-3 md:gap-4">
      {slots.map((s) => (
        <div
          key={s.label}
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl px-2 py-5 md:px-4 md:py-8 transition hover:border-white/20"
        >
          {/* Subtle inner highlight */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="text-center">
            <div className="font-display text-4xl font-extrabold tabular-nums tracking-tight text-white md:text-6xl lg:text-7xl">
              {pad(s.value)}
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 md:text-xs">
              {s.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
