import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
// ESO/S. Brunier — CC BY 4.0 (https://www.eso.org/public/images/eso0932a/)
import MilkyWayImg from '../assets/2k_milky_way.webp';

function MilkyWay({ radius = 900 }) {
  const meshRef = useRef();
  const texture = useTexture(MilkyWayImg, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
  });

  useFrame(({ camera }) => {
    if (meshRef.current) meshRef.current.position.copy(camera.position);
  });

  return (
    <mesh ref={meshRef} rotation={[0, 0.6, Math.PI / 2]} renderOrder={-2} frustumCulled={false} raycast={() => null}>
      <sphereGeometry args={[radius, 48, 24]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        color={[0.34, 0.34, 0.4]}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export default MilkyWay;
