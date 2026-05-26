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
      <div className="pointer-events-none absolute -inset-10">
        <div className="absolute right-0 top-10 h-60 w-60 rounded-full bg-kola-300 opacity-25 blur-3xl" />
        <div className="absolute left-0 bottom-0 h-56 w-56 rounded-full bg-terra-300 opacity-30 blur-3xl" />
      </div>

      <div className="relative mx-auto h-[620px] w-[300px] rounded-[44px] border-[10px] border-ink-900 bg-ink-900 shadow-2xl shadow-ink-900/20">
        <div className="absolute left-1/2 top-0 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-ink-900" />
        <div className="relative flex h-full w-full flex-col items-center justify-center rounded-[32px] bg-gradient-to-br from-paper to-paper-deep px-6 text-center">
          <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-ink-500">
            Capture à venir
          </div>
          <div className="mt-3 font-display text-2xl leading-tight tracking-tight text-ink-900">
            {label}
          </div>
          <div className="mt-6 font-mono text-[10px] text-ink-500">
            /screens/{filename}
          </div>
        </div>
      </div>
    </div>
  );
}
