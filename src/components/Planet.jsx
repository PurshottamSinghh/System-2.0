import React, { useRef, useEffect, useState, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import SaturnRings from './SaturnRings';
import Atmosphere from './Atmosphere';

const HOVER_EMISSIVE = new THREE.Color(0.6, 0.7, 1.0);

function TexturedSphere({ radius, textureFile, meshRef, materialRef }) {
  const gl = useThree((state) => state.gl);
  const texture = useTexture(textureFile, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshStandardMaterial
        ref={materialRef}
        map={texture}
        roughness={0.9}
        emissive={HOVER_EMISSIVE}
        emissiveIntensity={0}
      />
    </mesh>
  );
}

// Shown instantly while the texture streams in, so the scene never waits on downloads
function PlaceholderSphere({ radius, color, meshRef, materialRef }) {
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial
        ref={materialRef}
        color={color}
        roughness={0.9}
        emissive={HOVER_EMISSIVE}
        emissiveIntensity={0}
      />
    </mesh>
  );
}

function Planet({
  distance = 10,
  speed = 0.1,
  size = 0.5,
  textureFile,
  name,
  isActive,
  onSelect,
  onPositionUpdate,
  hasRings = false,
  color = '#888888',
  atmosphere,
}) {
  const meshRef = useRef();
  const planetMeshRef = useRef();
  const bodyRef = useRef();
  const materialRef = useRef();
  const ringMaterialRef = useRef();
  const frozenPositionRef = useRef(null);
  const wasActiveRef = useRef(false);

  // Hover state
  const [hovered, setHovered] = useState(false);

  // Smoothed values for animation (refs to avoid re-renders)
  const scaleRef = useRef(1);
  const emissiveRef = useRef(0);

  // Use a ref to track the accumulated angle. 
  // Initialize with a random start angle so planets aren't all aligned.
  const angleRef = useRef(Math.random() * Math.PI * 2);

  const { camera } = useThree();

  useEffect(() => {
    if (isActive && !wasActiveRef.current && meshRef.current) {
      // Planet just became active - freeze position
      const currentPos = meshRef.current.position;
      const frozen = [currentPos.x, currentPos.y, currentPos.z];
      frozenPositionRef.current = frozen;

      // Notify parent
      if (onPositionUpdate) {
        onPositionUpdate(frozen);
      }
    } else if (!isActive && wasActiveRef.current) {
      // Planet just became inactive
      frozenPositionRef.current = null;
    }
    wasActiveRef.current = isActive;
  }, [isActive, onPositionUpdate]);

  useFrame((state, delta) => {
    if (isActive && frozenPositionRef.current) {
      // Keep frozen at the stored position
      if (meshRef.current) {
        meshRef.current.position.set(
          frozenPositionRef.current[0],
          frozenPositionRef.current[1],
          frozenPositionRef.current[2]
        );
      }
    } else {
      // Orbit: Update angle based on speed and delta time
      angleRef.current += speed * delta;

      const x = Math.sin(angleRef.current) * distance;
      const z = Math.cos(angleRef.current) * distance;

      if (meshRef.current) {
        meshRef.current.position.set(x, 0, z);
      }
    }

    // Rotate the planet itself (only when not active)
    if (planetMeshRef.current && !isActive) {
      planetMeshRef.current.rotation.y += 0.005;
    }

    // ── Smooth hover animation ──────────────────────────────
    const targetScale = hovered ? 1.15 : 1.0;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, 6 * delta);

    const targetEmissive = hovered ? 0.35 : 0;
    emissiveRef.current = THREE.MathUtils.lerp(emissiveRef.current, targetEmissive, 6 * delta);

    if (bodyRef.current) {
      const s = scaleRef.current;
      bodyRef.current.scale.set(s, s, s);
    }

    if (materialRef.current) {
      materialRef.current.emissiveIntensity = emissiveRef.current;
    }

    // ── Pulsing interaction ring ─────────────────────────────
    if (ringMaterialRef.current && !isActive) {
      const pulse = Math.sin(state.clock.elapsedTime * 1.8) * 0.5 + 0.5; // 0→1
      const baseOpacity = hovered ? 0.3 : 0.1;
      const pulseAmount = hovered ? 0.2 : 0.1;
      ringMaterialRef.current.opacity = baseOpacity + pulse * pulseAmount;
    } else if (ringMaterialRef.current && isActive) {
      // Hide ring when planet is selected
      ringMaterialRef.current.opacity = 0;
    }
  });

  const ringInner = size * 2 + 0.4;
  const ringOuter = size * 2 + 0.7;

  return (
    <group
      ref={meshRef}
      onClick={(e) => {
        e.stopPropagation();
        if (!isActive && onSelect) {
          onSelect(name);
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
      {/* The rotating planet mesh */}
      <group ref={bodyRef}>
        <Suspense
          fallback={
            <PlaceholderSphere radius={size * 2} color={color} meshRef={planetMeshRef} materialRef={materialRef} />
          }
        >
          <TexturedSphere radius={size * 2} textureFile={textureFile} meshRef={planetMeshRef} materialRef={materialRef} />
        </Suspense>

        {atmosphere && <Atmosphere radius={size * 2} color={atmosphere.color} intensity={atmosphere.intensity} />}
      </group>

      {/* Pulsing interaction ring — signals clickability */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringInner, ringOuter, 96]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color="#ffffff"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Saturn's Rings (only if hasRings is true) */}
      {hasRings && <SaturnRings planetSize={size} />}
    </group>
  );
}

export default Planet;