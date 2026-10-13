import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend, useFrame } from '@react-three/fiber';

/**
 * SaturnRings — A scientifically-inspired ring system.
 *
 * Reproduces the major ring groups (D → C → B → Cassini Division → A → F → G)
 * with procedural radial opacity & color variations, plus subtle animated
 * sparkle to suggest billions of tumbling ice particles.
 *
 * All radii are expressed as multiples of the planet's visual radius
 * (planetRadius = size * 2).
 */

// ── Custom Shader Material ──────────────────────────────────────────────────

const SaturnRingMaterial = shaderMaterial(
  // Uniforms
  {
    uTime: 0,
    uInnerRadius: 1.0,
    uOuterRadius: 2.0,
    uColor1: new THREE.Color('#c4a96e'),  // warm tan (B ring)
    uColor2: new THREE.Color('#8c7851'),  // darker dusty gold (C ring)
    uColor3: new THREE.Color('#d6c9a8'),  // pale ivory (A ring)
  },

  // ── Vertex Shader ──
  /* glsl */ `
    varying vec2 vUv;
    varying vec2 vRingPos;

    void main() {
      vUv = uv;
      vRingPos = position.xy; // ring lies on XY before rotation
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  // ── Fragment Shader ──
  /* glsl */ `
    uniform float uTime;
    uniform float uInnerRadius;
    uniform float uOuterRadius;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;

    varying vec2 vUv;
    varying vec2 vRingPos;

    // Simple pseudo-random hash
    float hash(float n) {
      return fract(sin(n) * 43758.5453123);
    }

    // 1D noise for ring density variation
    float noise1D(float x) {
      float i = floor(x);
      float f = fract(x);
      f = f * f * (3.0 - 2.0 * f); // smoothstep
      return mix(hash(i), hash(i + 1.0), f);
    }

    void main() {
      // Radius is computed per-pixel so the ring needs only one radial segment
      float vRadius = length(vRingPos);
      // Normalised radial position: 0 = inner edge, 1 = outer edge
      float t = (vRadius - uInnerRadius) / (uOuterRadius - uInnerRadius);
      t = clamp(t, 0.0, 1.0);

      // ────────────────────────────────────────────────────────────
      // Ring band structure (approximate real proportions)
      //
      //  t range     |  Ring   |  Characteristics
      // ─────────────┼─────────┼───────────────────────────────
      //  0.00 – 0.06 |  D ring |  Very faint, dusty
      //  0.06 – 0.22 |  C ring |  Dim, translucent "Crepe ring"
      //  0.22 – 0.52 |  B ring |  Brightest, densest
      //  0.52 – 0.59 |  Cassini |  Major gap (~4700 km)
      //  0.59 – 0.82 |  A ring |  Bright but thinner than B
      //  0.82 – 0.84 |  Encke   |  Narrow gap in A ring
      //  0.84 – 0.90 |  A outer |  Continuation of A ring
      //  0.90 – 0.92 |  F ring |  Narrow, bright, braided
      //  0.92 – 1.00 |  G ring |  Extremely faint
      // ────────────────────────────────────────────────────────────

      float opacity = 0.0;
      vec3 color = uColor1;

      // D Ring — very faint
      if (t < 0.06) {
        opacity = 0.05 + 0.04 * smoothstep(0.0, 0.06, t);
        color = uColor2 * 0.6;
      }
      // C Ring (Crepe Ring) — dim, translucent
      else if (t < 0.22) {
        float localT = (t - 0.06) / 0.16;
        opacity = 0.12 + 0.15 * localT;
        color = mix(uColor2 * 0.7, uColor2, localT);
      }
      // B Ring — the brightest & densest
      else if (t < 0.52) {
        float localT = (t - 0.22) / 0.30;
        // Density peaks in the middle of B ring
        float peak = 1.0 - 2.0 * abs(localT - 0.5);
        opacity = 0.55 + 0.35 * peak;
        color = mix(uColor1, uColor1 * 1.15, peak);
      }
      // Cassini Division — the big gap
      else if (t < 0.59) {
        float localT = (t - 0.52) / 0.07;
        // Not perfectly empty — faint dust
        float edge = min(smoothstep(0.0, 0.15, localT), smoothstep(1.0, 0.85, localT));
        opacity = 0.02 + 0.03 * edge;
        color = uColor2 * 0.4;
      }
      // A Ring — bright but less dense than B
      else if (t < 0.82) {
        float localT = (t - 0.59) / 0.23;
        opacity = 0.4 + 0.2 * (1.0 - abs(localT - 0.5) * 2.0);
        color = mix(uColor3, uColor1, 0.3 + 0.4 * localT);
      }
      // Encke Gap — narrow gap in A ring
      else if (t < 0.84) {
        opacity = 0.03;
        color = uColor2 * 0.3;
      }
      // A Ring outer continuation
      else if (t < 0.90) {
        float localT = (t - 0.84) / 0.06;
        opacity = 0.35 * (1.0 - localT * 0.6);
        color = uColor3;
      }
      // F Ring — narrow, bright
      else if (t < 0.92) {
        float localT = (t - 0.90) / 0.02;
        float fPeak = 1.0 - 2.0 * abs(localT - 0.5);
        opacity = 0.25 + 0.45 * fPeak;
        color = uColor3 * 1.1;
      }
      // G Ring — extremely faint
      else {
        float localT = (t - 0.92) / 0.08;
        opacity = 0.04 * (1.0 - localT);
        color = uColor2 * 0.5;
      }

      // ── Fine structure noise ──────────────────────────────────
      // Simulates density ripples from resonance patterns
      float fineNoise = noise1D(t * 120.0) * 0.15;
      opacity += fineNoise * opacity; // modulate proportionally

      // ── Subtle sparkle (tumbling ice particles) ───────────────
      float sparkle = noise1D(t * 500.0 + uTime * 0.3) * 0.08;
      opacity += sparkle * step(0.06, opacity); // only on visible bands

      // ── Soft edge falloff ─────────────────────────────────────
      float edgeFade = smoothstep(0.0, 0.03, t) * smoothstep(1.0, 0.97, t);
      opacity *= edgeFade;

      // Clamp final opacity
      opacity = clamp(opacity, 0.0, 0.92);

      gl_FragColor = vec4(color, opacity);
    }
  `
);

// Register the material with R3F
extend({ SaturnRingMaterial });


// ── Component ─────────────────────────────────────────────────────────────────

function SaturnRings({ planetSize = 1 }) {
  const materialRef = useRef();
  const planetRadius = planetSize * 2;

  // Saturn's rings span ~1.2× to ~2.3× the planet's radius
  const innerRadius = planetRadius * 1.2;
  const outerRadius = planetRadius * 2.4;

  // Animate sparkle
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uTime = state.clock.elapsedTime;
    }
  });

  const ringGeometry = useMemo(() => {
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, 128, 1);
    return geo;
  }, [innerRadius, outerRadius]);

  return (
    <group rotation={[Math.PI / 6.5, 0, Math.PI / 30]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeometry}>
        <saturnRingMaterial
          ref={materialRef}
          key={SaturnRingMaterial.key}
          uInnerRadius={innerRadius}
          uOuterRadius={outerRadius}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default SaturnRings;
