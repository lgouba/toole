import React from 'react';
import Svg, {
  G,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Polygon,
  Polyline,
  Ellipse,
  Rect,
} from 'react-native-svg';
import { BoxSpec, buildParcel } from './parcelGeometry';

/**
 * Un carton kraft isométrique CALCULÉ (une instance). Rendu comme un <G> pour
 * être composé dans la scène partagée (viewBox 0 0 350 288). Trois valeurs de
 * kraft (dessus/gauche/droite), ruban qui passe l'arête, étiquette dans le plan.
 * Le SVG est décoratif -> masqué au lecteur d'écran par le parent.
 */
export function IsoParcel({ box }: { box: BoxSpec }) {
  const g = buildParcel(box);
  const id = box.key; // suffixe d'id de gradient unique par carton

  return (
    <G>
      {/* Ombres au sol (sous le carton) */}
      <Ellipse cx={g.ambient.cx} cy={g.ambient.cy} rx={g.ambient.rx} ry={g.ambient.ry} fill={`url(#amb-${id})`} />
      <Polygon points={g.base} fill="#6B5B38" fillOpacity={0.22} />

      <Defs>
        <LinearGradient id={`top-${id}`} x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor="#EACB99" />
          <Stop offset="1" stopColor="#D6AE73" />
        </LinearGradient>
        <LinearGradient id={`left-${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#CFA267" />
          <Stop offset="1" stopColor="#B2854A" />
        </LinearGradient>
        <LinearGradient id={`right-${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B0824A" />
          <Stop offset="1" stopColor="#946A38" />
        </LinearGradient>
        <LinearGradient id={`tape-${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2AA55E" />
          <Stop offset="1" stopColor="#15803D" />
        </LinearGradient>
        <RadialGradient id={`amb-${id}`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#7A6A45" stopOpacity={0.3} />
          <Stop offset="1" stopColor="#7A6A45" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Faces (3 valeurs de kraft) */}
      <Polygon points={g.left} fill={`url(#left-${id})`} />
      <Polygon points={g.right} fill={`url(#right-${id})`} />
      <Polygon points={g.top} fill={`url(#top-${id})`} />

      {/* Étiquette d'expédition, DANS le plan de la face gauche */}
      <G transform={`rotate(${g.label.rotate} ${g.label.cx} ${g.label.cy})`}>
        <Rect
          x={g.label.cx - g.label.w / 2}
          y={g.label.cy - g.label.h / 2}
          width={g.label.w}
          height={g.label.h}
          rx={1.5}
          fill="#FAF6EC"
        />
        <Rect
          x={g.label.cx - g.label.w / 2 + g.label.w * 0.12}
          y={g.label.cy - g.label.h * 0.18}
          width={g.label.w * 0.76}
          height={Math.max(0.6, g.label.h * 0.07)}
          fill="#B9AE99"
        />
        <Rect
          x={g.label.cx - g.label.w / 2 + g.label.w * 0.12}
          y={g.label.cy - g.label.h * 0.02}
          width={g.label.w * 0.58}
          height={Math.max(0.6, g.label.h * 0.07)}
          fill="#CFC5B0"
        />
        <Rect
          x={g.label.cx - g.label.w / 2 + g.label.w * 0.12}
          y={g.label.cy + g.label.h * 0.14}
          width={g.label.w * 0.3}
          height={g.label.h * 0.22}
          rx={1}
          fill="#15803D"
          fillOpacity={0.85}
        />
      </G>

      {/* Couture des rabats sur le dessus */}
      <Polyline points={g.seam} stroke="#A97D45" strokeWidth={1} strokeOpacity={0.7} fill="none" />

      {/* Ruban adhésif : dessus -> passe l'arête -> face droite, + reflet */}
      <Polygon points={g.tapeTop} fill={`url(#tape-${id})`} />
      <Polygon points={g.tapeRight} fill="#137A3C" />
      <Polyline points={g.tapeReflet} stroke="#66D093" strokeWidth={1} strokeOpacity={0.55} fill="none" />

      {/* Arêtes : claires (arrière-haut), sombre (verticale avant) */}
      <Polyline points={g.edgeLightA} stroke="#F0DBB2" strokeWidth={1} strokeOpacity={0.75} fill="none" />
      <Polyline points={g.edgeLightB} stroke="#F0DBB2" strokeWidth={1} strokeOpacity={0.75} fill="none" />
      <Polyline points={g.edgeDark} stroke="#8A6534" strokeWidth={1} strokeOpacity={0.5} fill="none" />
    </G>
  );
}

/** Petit rendu autonome (debug/preview) d'un carton dans son propre Svg. */
export function IsoParcelStandalone({ box, size = 120 }: { box: BoxSpec; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 350 288">
      <IsoParcel box={box} />
    </Svg>
  );
}
