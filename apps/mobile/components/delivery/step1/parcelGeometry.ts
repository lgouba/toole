import { PackageSize } from '@/types';

/**
 * Géométrie du carton kraft — projection isométrique CALCULÉE (pas d'illustration).
 * Isolée et testable : `project` + `buildParcel` ne dépendent que de nombres.
 *
 * ⚠️ Les dimensions physiques des cartons (w×h×d, cx) sont des VALEURS DE MAQUETTE
 * (visuelles, non affichées à l'utilisateur). À remplacer par les vraies dimensions
 * si elles existent — cf. compte rendu. Les libellés/poids, eux, viennent de
 * `theme.recapTokens.step1.sizes` (déjà en prod, non modifiés).
 */

export const SC = 1.24; // échelle px par unité
export const GROUND = 220; // ligne de sol (px dans le viewBox)
const C = 0.8660254; // cos(30°)
// viewBox recadré sur la zone utile (cartons + sol) : on coupe le grand vide
// au-dessus. Les cartons gardent leur taille ; la scène est juste plus courte.
// Origine y=96, hauteur 160 -> fenêtre visible y ∈ [96, 256].
export const SCENE_VB_X = 0;
export const SCENE_VB_Y = 96;
export const SCENE_VB_W = 350;
export const SCENE_VB_H = 150;
export const SCENE_VIEWBOX = `${SCENE_VB_X} ${SCENE_VB_Y} ${SCENE_VB_W} ${SCENE_VB_H}`;

export interface BoxSpec {
  key: PackageSize;
  w: number;
  h: number;
  d: number;
  cx: number;
}

/** Dimensions de maquette (à remplacer par les vraies si fournies). */
export const BOXES: readonly BoxSpec[] = [
  { key: 'small', w: 30, h: 22, d: 24, cx: 72 },
  { key: 'medium', w: 44, h: 31, d: 34, cx: 175 },
  { key: 'large', w: 58, h: 41, d: 44, cx: 280 },
] as const;

/** cy recalculé par boîte -> aligne les cartons sur la même ligne de sol. */
export function cyFor(w: number, d: number): number {
  const hw = w / 2;
  const hd = d / 2;
  return GROUND - (hw + hd) * 0.5 * SC;
}

/** Projette un point 3D (repère base centrée) en 2D écran. */
export function project(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
): [number, number] {
  return [cx + (x - z) * C * SC, cy + (x + z) * 0.5 * SC - y * SC];
}

const f2 = (n: number) => n.toFixed(2);

export interface ParcelGeometry {
  top: string;
  left: string;
  right: string;
  seam: string; // polyline "x1,y1 x2,y2"
  tapeTop: string;
  tapeRight: string;
  tapeReflet: string;
  base: string; // empreinte au sol
  edgeLightA: string; // arête haute arrière (gauche)
  edgeLightB: string; // arête haute arrière (droite)
  edgeDark: string; // arête verticale avant
  label: {
    cx: number;
    cy: number;
    w: number;
    h: number;
    rotate: number; // degrés
  };
  ambient: { cx: number; cy: number; rx: number; ry: number };
}

/** Calcule tous les tracés d'un carton. */
export function buildParcel(box: BoxSpec): ParcelGeometry {
  const { w, h, d, cx } = box;
  const hw = w / 2;
  const hd = d / 2;
  const cy = cyFor(w, d);
  const P = (x: number, y: number, z: number) => project(x, y, z, cx, cy);
  const poly = (list: [number, number, number][]) =>
    list.map((p) => { const q = P(...p); return `${f2(q[0])},${f2(q[1])}`; }).join(' ');
  const line = (a: [number, number, number], b: [number, number, number]) => {
    const qa = P(...a); const qb = P(...b);
    return `${f2(qa[0])},${f2(qa[1])} ${f2(qb[0])},${f2(qb[1])}`;
  };

  const tw = Math.max(1.7, w * 0.052);

  // Étiquette sur la face gauche (plan z=+hd). Base-x -> écran = (C*SC, .5*SC)
  // (longueur SC), base-y -> (0,-SC). L'inclinaison est celle de l'axe x projeté.
  const lc = P(-0.02 * w, 0.5 * h, hd);
  const rotate = (Math.atan2(0.5 * SC, C * SC) * 180) / Math.PI;

  return {
    top: poly([
      [-hw, h, -hd], [hw, h, -hd], [hw, h, hd], [-hw, h, hd],
    ]),
    left: poly([
      [-hw, h, hd], [hw, h, hd], [hw, 0, hd], [-hw, 0, hd],
    ]),
    right: poly([
      [hw, h, -hd], [hw, h, hd], [hw, 0, hd], [hw, 0, -hd],
    ]),
    seam: line([-hw, h, 0], [hw, h, 0]),
    tapeTop: poly([
      [-hw, h, -tw], [hw, h, -tw], [hw, h, tw], [-hw, h, tw],
    ]),
    tapeRight: poly([
      [hw, h, -tw], [hw, h, tw], [hw, 0, tw], [hw, 0, -tw],
    ]),
    tapeReflet: line([-hw, h, -0.55 * tw], [hw, h, -0.55 * tw]),
    base: poly([
      [-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd],
    ]),
    edgeLightA: line([-hw, h, -hd], [hw, h, -hd]),
    edgeLightB: line([-hw, h, -hd], [-hw, h, hd]),
    edgeDark: line([hw, 0, hd], [hw, h, hd]),
    label: {
      cx: lc[0],
      cy: lc[1],
      w: 0.44 * w * SC,
      h: 0.42 * h * SC,
      rotate,
    },
    ambient: {
      cx,
      cy: GROUND + 7,
      rx: 0.52 * (w + d) * SC,
      ry: 0.16 * (w + d) * SC,
    },
  };
}
