import React, { useEffect, useRef } from 'react';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { PackageSize } from '@/types';

/**
 * Carton kraft en VRAI 3D (expo-gl + three), modèle §4 : cube kraft + ruban
 * adhésif vert (avant/dessus/arrière) + étiquette d'expédition (code-barres).
 * Tourne sur l'axe Y. AUCUNE ombre au sol.
 *
 * NÉCESSITE un build natif (expo-gl). Sur un binaire sans ce module, l'import
 * lève une erreur captée par BagHero (try/catch + error boundary) → repli SVG.
 */
const TAPE = 0x16a34a;
const STAGE_BG = 0xecf1e8;

const SCALE: Record<PackageSize, number> = { small: 0.82, medium: 1.0, large: 1.18 };

function flat(color: number, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}
function box(w: number, h: number, d: number, color: number) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(color));
}

function buildParcel(): THREE.Group {
  const g = new THREE.Group();

  // Corps kraft — matériaux par face : [px, nx, py, ny, pz, nz]
  const faceMats = [
    flat(0xc6995c), // droite
    flat(0xc6995c), // gauche
    flat(0xd7ac6e), // dessus (clair)
    flat(0xb0844a), // dessous (foncé)
    flat(0xc89b5e), // avant
    flat(0xbe9054), // arrière
  ];
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), faceMats));

  // Ruban adhésif vert (avant → dessus → arrière)
  const tFront = box(0.3, 1.42, 0.03, TAPE);
  tFront.position.set(0, 0, 0.715);
  g.add(tFront);
  const tBack = box(0.3, 1.42, 0.03, TAPE);
  tBack.position.set(0, 0, -0.715);
  g.add(tBack);
  const tTop = box(0.3, 0.03, 1.42, TAPE);
  tTop.position.set(0, 0.715, 0);
  g.add(tTop);

  // Étiquette d'expédition (avant, dégagée du ruban) + code-barres
  const label = box(0.46, 0.32, 0.012, 0xf6f1e6);
  label.position.set(0.34, -0.1, 0.706);
  g.add(label);
  const barcode = box(0.34, 0.05, 0.014, 0x3a332a);
  barcode.position.set(0.34, -0.18, 0.708);
  g.add(barcode);

  return g;
}

export function BagHero3D({
  size,
  spinning = true,
  onError,
}: {
  size: PackageSize;
  spinning?: boolean;
  onError?: () => void;
}) {
  const sizeRef = useRef(size);
  const spinRef = useRef(spinning);
  const rafRef = useRef<number>(0);
  const curScale = useRef(SCALE[size]);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  useEffect(() => {
    spinRef.current = spinning;
  }, [spinning]);
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    try {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const renderer: any = new Renderer({ gl });
      renderer.setSize(w, h);
      renderer.setClearColor(STAGE_BG, 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
      camera.position.set(0, 0, 5);

      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const d1 = new THREE.DirectionalLight(0xffffff, 0.6);
      d1.position.set(3, 5, 4);
      scene.add(d1);
      const d2 = new THREE.DirectionalLight(0xffffff, 0.22);
      d2.position.set(-3, 2, -2);
      scene.add(d2);

      const parcel = buildParcel();
      parcel.rotation.x = -0.16;
      scene.add(parcel);

      const animate = () => {
        rafRef.current = requestAnimationFrame(animate);
        if (spinRef.current) parcel.rotation.y += 0.012;
        const target = SCALE[sizeRef.current];
        curScale.current += (target - curScale.current) * 0.12;
        parcel.scale.setScalar(curScale.current);
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      animate();
    } catch {
      onError?.();
    }
  };

  return <GLView style={{ width: 122, height: 134 }} onContextCreate={onContextCreate} />;
}
