/**
 * Placeholder visuel pour les screenshots de l'app à venir.
 * Affiche un cadre style iPhone avec un message explicite.
 * Remplacer par <img src="/screens/<filename>.png" /> quand tu fournis les captures.
 */
export function ScreenshotPlaceholder({
  label,
  filename,
  className,
}: {
  label: string;
  filename: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ''}`}>
      {/* Halo derrière */}
      <div className="pointer-events-none absolute -inset-6 rounded-[48px] bg-gradient-to-br from-kola-600/30 via-terra-600/20 to-transparent blur-2xl" />

      {/* Cadre iPhone */}
      <div className="relative mx-auto h-[600px] w-[300px] rounded-[44px] border-[10px] border-ink-900 bg-ink-900 shadow-2xl">
        <div className="absolute left-1/2 top-0 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-ink-900" />
        <div className="relative flex h-full w-full flex-col items-center justify-center rounded-[32px] bg-gradient-to-br from-sand-100 to-sand-200 px-6 text-center">
          <div className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink-500">
            Capture à venir
          </div>
          <div className="mt-4 text-sm font-bold text-ink-900">{label}</div>
          <div className="mt-2 font-mono text-[10px] text-ink-500">
            /screens/{filename}
          </div>
        </div>
      </div>
    </div>
  );
}
