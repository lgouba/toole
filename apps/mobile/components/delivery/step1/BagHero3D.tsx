import React, { useEffect, useRef } from 'react';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer, TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { PackageSize } from '@/types';

/**
 * Sac Toolé en VRAI 3D (expo-gl + three), modèle §4. NÉCESSITE un build natif
 * (expo-gl) — sur un binaire sans ce module, le rendu de GLView lève une erreur
 * captée par l'error boundary de BagHero → repli automatique sur le SVG.
 *
 * AUCUNE ombre au sol, pas de plan de sol. Rotation idle continue (axe Y).
 */
const GREEN = 0x15803d;
const GREEN_DK = 0x0c5326;
const GREY = 0xc3ccc5;
const STAGE_BG = 0xecf1e8;

const SCALE: Record<PackageSize, number> = { small: 0.82, medium: 1.0, large: 1.18 };

function mat(color: number, roughness = 0.66) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}
function box(w: number, h: number, d: number, color: number) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
}

function buildBag(): THREE.Group {
  const g = new THREE.Group();

  // Corps
  g.add(box(1.5, 1.66, 1.1, GREEN));

  // Roll-top (cylindre horizontal)
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.5, 20), mat(GREEN));
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 0.9, 0.06);
  g.add(roll);

  // Poche avant (relief)
  const pocket = box(1.24, 1.32, 0.06, GREEN);
  pocket.position.set(0, -0.12, 0.56);
  g.add(pocket);

  // Passepoil vertical (réfléchissant gris)
  const pip1 = box(0.05, 1.66, 0.05, GREY);
  pip1.position.set(0.74, 0, 0.55);
  g.add(pip1);
  const pip2 = box(0.05, 1.66, 0.05, GREY);
  pip2.position.set(-0.74, 0, 0.55);
  g.add(pip2);

  // Poignée (demi-tore)
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 12, 24, Math.PI), mat(GREEN_DK));
  handle.position.set(0, 1.02, -0.16);
  g.add(handle);

  // Bretelles
  [-0.4, 0.4].forEach((x) => {
    const back = box(0.24, 1.46, 0.16, GREEN_DK);
    back.position.set(x, -0.04, -0.58);
    g.add(back);
    const top = box(0.24, 0.16, 0.6, GREEN_DK);
    top.position.set(x, 0.84, -0.3);
    g.add(top);
    const front = box(0.24, 0.42, 0.16, GREEN_DK);
    front.position.set(x, 0.66, -0.02);
    g.add(front);
  });

  return g;
}

async function addWordmark(bag: THREE.Group) {
  const asset = Asset.fromModule(require('@/assets/images/toole-wordmark.png'));
  await asset.downloadAsync();
  const tex = new TextureLoader().load(asset.localUri || asset.uri);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.36),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
  plane.position.set(0, -0.12, 0.605);
  bag.add(plane);
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
      // expo-three Renderer = THREE.WebGLRenderer au runtime (types incomplets).
      const renderer: any = new Renderer({ gl });
      renderer.setSize(w, h);
      renderer.setClearColor(STAGE_BG, 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
      camera.position.set(0, 0, 5.2);

      scene.add(new THREE.AmbientLight(0xffffff, 1.0));
      const dir = new THREE.DirectionalLight(0xffffff, 0.32);
      dir.position.set(2, 4, 4);
      scene.add(dir);

      const bag = buildBag();
      bag.rotation.x = -0.12;
      scene.add(bag);
      try {
        await addWordmark(bag);
      } catch {
        /* wordmark best-effort */
      }

      const animate = () => {
        rafRef.current = requestAnimationFrame(animate);
        if (spinRef.current) bag.rotation.y += 0.012;
        const target = SCALE[sizeRef.current];
        curScale.current += (target - curScale.current) * 0.12;
        bag.scale.setScalar(curScale.current);
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
