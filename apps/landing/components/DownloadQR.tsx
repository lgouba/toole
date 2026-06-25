'use client';

import { QRCodeSVG } from 'qrcode.react';

interface DownloadQRProps {
  baseUrl?: string; // utile pour SSR / preview, sinon window.location.origin
}

/**
 * Bloc QR codes iOS + Android.
 * Les codes pointent vers /bientot-disponible?platform=... qui affiche une
 * page interstitielle (l'app n'est pas encore live).
 */
export function DownloadQR({ baseUrl }: DownloadQRProps) {
  const origin =
    baseUrl ??
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'https://lancement-toole.qalitylabs.fr');

  const iosUrl = `${origin}/bientot-disponible?platform=ios`;
  const androidUrl = `${origin}/bientot-disponible?platform=android`;

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 md:gap-5">
      <QRCard label="App Store" platform="ios" url={iosUrl} />
      <QRCard label="Google Play" platform="android" url={androidUrl} />
    </div>
  );
}

function QRCard({
  label,
  platform,
  url,
}: {
  label: string;
  platform: 'ios' | 'android';
  url: string;
}) {
  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20">
      <div className="grid place-items-center rounded-xl bg-white p-2">
        <QRCodeSVG
          value={url}
          size={88}
          fgColor="#16132E"
          bgColor="#FFFFFF"
          level="M"
          marginSize={0}
        />
      </div>
      <div className="pr-3 text-left">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">
          Scanner pour
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-base font-bold text-white">
          {platform === 'ios' ? (
            <svg viewBox="0 0 384 512" className="h-5 w-5 fill-current" aria-hidden>
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                fill="currentColor"
                d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.6 3 21.09 3 20.5M16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12M20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.53 12.9 20.18 13.18L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81M6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z"
              />
            </svg>
          )}
          {label}
        </div>
        <div className="text-[10px] text-white/40 tracking-wide">Bientôt disponible</div>
      </div>
    </div>
  );
}
