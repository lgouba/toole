import type { Metadata } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://lancement-toole.qalitylabs.fr'),
  title: 'Toolé — Lancement à Ouagadougou',
  description:
    "L'application de livraison rapide qui arrive à Ouagadougou. Vos colis livrés en moins de 30 minutes, livreurs vérifiés, paiement Mobile Money.",
  keywords: [
    'livraison',
    'Burkina Faso',
    'Ouagadougou',
    'colis',
    'mobile money',
    'livreur',
    'Toolé',
  ],
  openGraph: {
    type: 'website',
    locale: 'fr_BF',
    url: 'https://lancement-toole.qalitylabs.fr',
    siteName: 'Toolé',
    title: 'Toolé — Lancement à Ouagadougou',
    description:
      "L'application de livraison rapide qui arrive à Ouagadougou.",
  },
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`scroll-smooth ${inter.variable} ${display.variable}`}>
      <body className="min-h-screen bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
