import React, { useMemo } from 'react';
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// Rim light on the planet's sunlit side (the Sun sits at the world origin)
const rimFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(-vWorldPos);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float day = smoothstep(-0.3, 0.6, dot(N, L));
    gl_FragColor = vec4(uColor * rim * day * uIntensity, 1.0);
  }
`;

// Soft halo just outside the silhouette, rendered from the back faces of a larger shell
const haloFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(-vWorldPos);
    float f = clamp(-dot(N, V), 0.0, 1.0);
    float glow = pow(smoothstep(0.0, 0.55, f), 2.0);
    float day = smoothstep(-0.4, 0.5, dot(-N, L));
    gl_FragColor = vec4(uColor * glow * day * uIntensity, 1.0);
  }
`;

const noRaycast = () => null;

function Atmosphere({ radius, color, intensity = 1 }) {
  const [rim, halo] = useMemo(() => {
    const make = (fragmentShader, side, k) =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity * k } },
        vertexShader,
        fragmentShader,
        side,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    return [make(rimFragment, THREE.FrontSide, 1.2), make(haloFragment, THREE.BackSide, 0.55)];
  }, [color, intensity]);

  return (
    <>
      <mesh material={rim} raycast={noRaycast}>
        <sphereGeometry args={[radius * 1.01, 48, 48]} />
      </mesh>
      <mesh material={halo} raycast={noRaycast}>
        <sphereGeometry args={[radius * 1.12, 48, 48]} />
      </mesh>
    </>
  );
}

export default Atmosphere;
