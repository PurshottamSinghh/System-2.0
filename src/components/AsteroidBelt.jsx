import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Pure, deterministic pseudo-random function to keep component render pure
function pseudoRandom(seed, offset = 0) {
  const x = Math.sin(seed * 12.9898 + offset) * 43758.5453;
  return x - Math.floor(x); // value in [0, 1)
}

const vertexShader = /* glsl */ `
  uniform float uPixelRatio;
  attribute float aScale;
  varying vec3 vColor;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    // Phase lighting: rocks facing the camera on their sunward side look brighter
    vec3 toSun = normalize(-worldPos.xyz);
    vec3 toCam = normalize(cameraPosition - worldPos.xyz);
    float phase = 0.5 + 0.5 * dot(toSun, toCam);
    vColor = color * (0.35 + 0.75 * phase);

    gl_PointSize = max(1.2, aScale * uPixelRatio * 150.0 / -mvPosition.z);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    // Fake a lit, slightly irregular rock with a soft edge
    float shade = 1.0 - 0.45 * smoothstep(0.0, 1.0, length(c + vec2(0.18, 0.18)) * 1.6);
    gl_FragColor = vec4(vColor * shade, smoothstep(1.0, 0.7, d));
  }
`;

function AsteroidBelt() {
  const pointsRef = useRef();

  // Configuration
  const asteroidCount = 5000;
  const radius = 60;          // Distance from Sun (midway between Mars (50) and Ceres (70))
  const width = 5;            // How wide the belt is

  // Generate random positions for the asteroids ONCE
  const geometry = useMemo(() => {
    const positions = new Float32Array(asteroidCount * 3);
    const colors = new Float32Array(asteroidCount * 3);
    const scales = new Float32Array(asteroidCount);
    const rock = new THREE.Color();

    for (let i = 0; i < asteroidCount; i++) {
      // 1. Random Angle (0 to 360 degrees)
      const angle = (i / asteroidCount) * 2 * Math.PI;

      // 2. Random Distance (Radius +/- width jitter)
      const distance = radius + (pseudoRandom(i, 1) - 0.5) * width;

      // 3. Convert to X and Z coordinates, 4. random height so it's not a flat disc
      positions[i * 3] = Math.cos(angle) * distance;
      positions[i * 3 + 1] = (pseudoRandom(i, 2) - 0.5) * 3;
      positions[i * 3 + 2] = Math.sin(angle) * distance;

      // 5. Random Scale (Size of rock)
      scales[i] = 0.2 + pseudoRandom(i, 3) * 0.4;

      // Grey to dusty-brown rock tones
      rock.setHSL(0.07 + pseudoRandom(i, 4) * 0.04, 0.12 + pseudoRandom(i, 5) * 0.15, 0.32 + pseudoRandom(i, 6) * 0.25);
      colors[i * 3] = rock.r;
      colors[i * 3 + 1] = rock.g;
      colors[i * 3 + 2] = rock.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) } },
        vertexShader,
        fragmentShader,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
      }),
    []
  );

  // Animate: Slowly rotate the entire belt ring
  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} raycast={() => null} />;
}

export default AsteroidBelt;
