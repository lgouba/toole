import React from 'react';
import { PackageSize } from '@/types';
import { BagHeroSVG } from './BagHeroSVG';

/**
 * Héros sac Toolé. Utilise le rendu 3D (expo-gl/three) si disponible, sinon
 * repli AUTOMATIQUE sur le SVG (OTA-safe : sur un binaire sans expo-gl natif,
 * le rendu 3D lève une erreur captée par l'error boundary → SVG).
 *
 * Le 3D ne s'active donc qu'après un build natif incluant expo-gl ; les installs
 * actuelles (OTA) continuent d'afficher le SVG, sans crash.
 */
let BagHero3D: React.ComponentType<{ size: PackageSize; spinning?: boolean; onError?: () => void }> | null =
  null;
try {
  // require paresseux : si la résolution du module 3D échoue, on garde le SVG.
  BagHero3D = require('./BagHero3D').BagHero3D;
} catch {
  BagHero3D = null;
}

class GLBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* silencieux : on bascule sur le SVG */
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function BagHero({ size, spinning = true }: { size: PackageSize; spinning?: boolean }) {
  const [failed, setFailed] = React.useState(false);
  const svg = <BagHeroSVG size={size} spinning={spinning} />;

  if (!BagHero3D || failed) return svg;

  const Bag3D = BagHero3D;
  return (
    <GLBoundary fallback={svg}>
      <Bag3D size={size} spinning={spinning} onError={() => setFailed(true)} />
    </GLBoundary>
  );
}
