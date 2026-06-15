import React from 'react';
import Svg, { Polygon, Rect, G } from 'react-native-svg';
import { step1 as S } from '@/theme/recapTokens';

/**
 * Carton kraft 2.5D (react-native-svg). Taille fixe — le redimensionnement
 * "Petit/Moyen/Grand" est géré par un scale animé dans SizeStage.
 */
export function ParcelBox({ size = 120 }: { size?: number }) {
  const P = S.parcel;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 112">
      <G>
        {/* Face droite (la plus sombre) */}
        <Polygon points="80,48 104,33 104,84 80,99" fill={P.side} />
        {/* Face avant */}
        <Polygon points="24,48 80,48 80,99 24,99" fill={P.front} />
        {/* Face dessus (la plus claire) */}
        <Polygon points="24,48 48,33 104,33 80,48" fill={P.top} />

        {/* Ruban — dessus */}
        <Polygon points="46,48 58,48 82,33 70,33" fill={P.tapeTop} />
        {/* Ruban — avant */}
        <Rect x="46" y="48" width="12" height="51" fill={P.tape} />

        {/* Étiquette blanche sur la face avant */}
        <Rect x="30" y="64" width="13" height="11" rx="2" fill="#FFFFFF" opacity={0.92} />
      </G>
    </Svg>
  );
}
