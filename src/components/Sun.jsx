import React, { useLayoutEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import SunTexture from '../assets/2k_sun.webp';

const sunVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// Two drifting texture layers fake churning plasma; limb darkening gives the disc depth
const sunFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uBoost;
  uniform float uHasMap;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec3 base = vec3(1.0, 0.55, 0.15);
    // Horizontal-only drift with an integer scale so the wrapped map stays seamless
    vec3 a = mix(base, texture2D(uMap, vUv + vec2(uTime * 0.003, 0.0)).rgb, uHasMap);
    vec3 b = mix(base, texture2D(uMap, vUv * vec2(2.0, 1.0) + vec2(-uTime * 0.005, 0.0)).rgb, uHasMap);
    vec3 col = mix(a, a * b * 2.2, 0.4);
    float mu = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
    float limb = 0.45 + 0.55 * pow(mu, 0.45);
    col = col * limb * uBoost * 1.6 + vec3(1.0, 0.45, 0.1) * pow(1.0 - mu, 2.5) * 0.9;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function makeGlowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255, 240, 200, 1)');
  g.addColorStop(0.36, 'rgba(255, 190, 90, 0.85)');
  g.addColorStop(0.42, 'rgba(255, 150, 50, 0.35)');
  g.addColorStop(0.6, 'rgba(255, 110, 30, 0.12)');
  g.addColorStop(1.0, 'rgba(255, 80, 20, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function SunSurfaceMap({ sunRef }) {
  const texture = useTexture(SunTexture, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
  });
  useLayoutEffect(() => {
    const { uniforms } = sunRef.current.material;
    uniforms.uMap.value = texture;
    uniforms.uHasMap.value = 1;
  }, [sunRef, texture]);
  return null;
}

/**
 * Sun component
 * 
 * Props:
 *  - isActive: whether this Sun is currently selected
 *  - onSelect: callback when the Sun is clicked
 */
function Sun({ isActive, onSelect }) {
  const sunRef = useRef();
  const glowRef = useRef();
  const ringMaterialRef = useRef();
  const [hovered, setHovered] = useState(false);

  // Smoothed animation values
  const scaleRef = useRef(1);
  const boostRef = useRef(1);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: null },
          uTime: { value: 0 },
          uBoost: { value: 1 },
          uHasMap: { value: 0 },
        },
        vertexShader: sunVertex,
        fragmentShader: sunFragment,
      }),
    []
  );
  const glowTexture = useMemo(() => makeGlowTexture(), []);

  useFrame(({ clock }, delta) => {
    const { uniforms } = sunRef.current.material;
    // Slow rotation
    sunRef.current.rotation.y = clock.getElapsedTime() * 0.1;
    uniforms.uTime.value = clock.elapsedTime;

    // ── Smooth hover animation ──────────────────────────────
    const targetScale = hovered ? 1.08 : 1.0;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, 5 * delta);
    sunRef.current.scale.set(scaleRef.current, scaleRef.current, scaleRef.current);

    const targetBoost = hovered ? 1.3 : 1.0;
    boostRef.current = THREE.MathUtils.lerp(boostRef.current, targetBoost, 5 * delta);
    uniforms.uBoost.value = boostRef.current;

    if (glowRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 0.8) * 0.015;
      const s = 16 * 2 * 2.9 * scaleRef.current * pulse;
      glowRef.current.scale.set(s, s, 1);
      glowRef.current.material.opacity = 0.75 + (boostRef.current - 1) * 0.8;
    }

    // ── Pulsing interaction ring ─────────────────────────────
    if (ringMaterialRef.current && !isActive) {
      const pulse = Math.sin(clock.elapsedTime * 1.5) * 0.5 + 0.5;
      const baseOpacity = hovered ? 0.25 : 0.08;
      const pulseAmount = hovered ? 0.15 : 0.08;
      ringMaterialRef.current.opacity = baseOpacity + pulse * pulseAmount;
    } else if (ringMaterialRef.current && isActive) {
      ringMaterialRef.current.opacity = 0;
    }
  });

  return (
    <group>
      <mesh
        ref={sunRef}
        material={material}
        onClick={(e) => {
          e.stopPropagation();
          if (!isActive && onSelect) {
            onSelect('Sun');
          }
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[16, 64, 64]} />
      </mesh>

      <Suspense fallback={null}>
        <SunSurfaceMap sunRef={sunRef} />
      </Suspense>

      {/* Corona — camera-facing additive glow */}
      <sprite ref={glowRef} raycast={() => null}>
        <spriteMaterial
          map={glowTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

      <pointLight position={[0, 0, 0]} intensity={2.6} decay={0} color="#fff3e0" />

      {/* Pulsing interaction ring — warm tone for the Sun */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[18, 18.5, 96]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color="#ffcc66"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default Sun;
