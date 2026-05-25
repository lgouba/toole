import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://tolle.bf'),
  title: 'Tollé — Livraison rapide au Burkina Faso',
  description:
    'Faites livrer vos colis en quelques minutes à Ouagadougou et Bobo-Dioulasso. Application de livraison sécurisée, livreurs vérifiés, paiement mobile money.',
  keywords: [
    'livraison',
    'Burkina Faso',
    'Ouagadougou',
    'Bobo-Dioulasso',
    'colis',
    'mobile money',
    'livreur',
    'coursier',
  ],
  openGraph: {
    type: 'website',
    locale: 'fr_BF',
    url: 'https://tolle.bf',
    siteName: 'Tollé',
    title: 'Tollé — Livraison rapide au Burkina Faso',
    description:
      'Faites livrer vos colis en quelques minutes. Livreurs vérifiés, suivi temps réel, paiement mobile money.',
  },
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="scroll-smooth">
      <body className="min-h-screen bg-sand-50 antialiased">{children}</body>
    </html>
  );
}
