import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Pure, deterministic pseudo-random function to keep component render pure
function pseudoRandom(seed, offset = 0) {
  const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
  return x - Math.floor(x); // value in [0, 1)
}

// Approximate stellar colours from hot (blue) to cool (orange)
const STAR_COLORS = ['#9bb0ff', '#aabfff', '#cad7ff', '#f8f7ff', '#fff4ea', '#ffe4c4', '#ffd2a1', '#ffbd6f'].map(
  (c) => new THREE.Color(c)
);

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aPhase;
  varying vec3 vColor;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float twinkle = 0.8 + 0.2 * sin(uTime * (0.5 + aPhase * 1.5) + aPhase * 40.0);
    vColor = color * twinkle;
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = exp(-d * d * 10.0);
    float halo = exp(-d * 3.5) * 0.35;
    gl_FragColor = vec4(vColor, core + halo);
  }
`;

/**
 * Skybox-style starfield: always centred on the camera so stars sit at
 * "infinity" and never get clipped or parallax while flying around.
 */
function CustomStars({ radius, count }) {
  const pointsRef = useRef();

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    // A tilted great circle that a share of the stars cluster around (Milky Way band)
    const bandNormal = new THREE.Vector3(0.35, 1, 0.2).normalize();
    const v = new THREE.Vector3();
    const bandCount = Math.floor(count * 0.45);

    for (let i = 0; i < count; i++) {
      const theta = pseudoRandom(i, 1) * Math.PI * 2;
      const phi = Math.acos(2 * pseudoRandom(i, 2) - 1);
      v.set(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi));

      if (i < bandCount) {
        // Pull the star towards the band plane (gaussian-ish falloff)
        const spread = (pseudoRandom(i, 4) + pseudoRandom(i, 5) + pseudoRandom(i, 6) - 1.5) * 0.18;
        const h = v.dot(bandNormal);
        v.addScaledVector(bandNormal, -h + spread).normalize();
      }

      positions[i * 3] = v.x * radius;
      positions[i * 3 + 1] = v.y * radius;
      positions[i * 3 + 2] = v.z * radius;

      // Many very dim stars, a few very bright ones
      const r = pseudoRandom(i, 8);
      const magnitude = Math.pow(r, 6);
      const brightness = (i < bandCount ? 0.25 : 0.35) + magnitude * 1.4;
      const color = STAR_COLORS[Math.floor(pseudoRandom(i, 9) * STAR_COLORS.length)];
      colors[i * 3] = color.r * brightness;
      colors[i * 3 + 1] = color.g * brightness;
      colors[i * 3 + 2] = color.b * brightness;

      sizes[i] = 1.5 + magnitude * 6.5 + pseudoRandom(i, 10) * 1.2;
      phases[i] = pseudoRandom(i, 11);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    return geo;
  }, [count, radius]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
        },
        vertexShader,
        fragmentShader,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useFrame(({ clock, camera }) => {
    if (!pointsRef.current) return;
    pointsRef.current.material.uniforms.uTime.value = clock.elapsedTime;
    pointsRef.current.position.copy(camera.position);
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={-1}
      raycast={() => null}
    />
  );
}

export default CustomStars;
