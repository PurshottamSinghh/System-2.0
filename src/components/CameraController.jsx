import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { gsap } from 'gsap';
import * as THREE from 'three';

/**
 * CameraController
 *
 * Cinematic camera system with two modes:
 *
 *   1. DIRECT CLICK (canvas click / planet-to-planet):
 *      Single-phase fluid transit. Both position and lookAt target
 *      smoothly interpolate simultaneously — zero snapping.
 *
 *   2. SIDEBAR SELECTION (two-phase cinematic):
 *      Phase 1 — "The Search": Camera pans/rotates to visually locate
 *               and center the target planet in the viewport.
 *      Phase 2 — "The Approach": Camera travels toward the centered
 *               target, keeping it locked in frame.
 *
 * Props:
 *   - activePlanet:        string | null — name of selected planet
 *   - planetPosition:      [x,y,z] | null — frozen world position
 *   - activePlanetSize:    number — radius for zoom distance calc
 *   - onAnimationComplete: () => void — fires after camera fully stops
 *   - selectionSource:     'canvas' | 'sidebar' — how the selection was triggered
 */
function CameraController({
  activePlanet,
  planetPosition,
  activePlanetSize,
  onAnimationComplete,
  selectionSource,
}) {
  const { camera } = useThree();

  // ── Refs ──────────────────────────────────────────────
  const timelineRef = useRef(null);
  const prevPlanetRef = useRef(null);     // tracks last active planet name
  const prevPositionRef = useRef(null);   // tracks last planet position

  // The animated lookAt target — smoothly interpolated every frame
  const lookAtTarget = useRef(new THREE.Vector3(0, 0, 0));
  // Whether we should be actively driving lookAt from the ref
  const isControlling = useRef(false);

  // Constants
  const OVERVIEW_POS = new THREE.Vector3(0, 200, 0);
  const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);

  // ── Initialize ────────────────────────────────────────
  useEffect(() => {
    camera.position.copy(OVERVIEW_POS);
    camera.lookAt(OVERVIEW_TARGET);
    lookAtTarget.current.copy(OVERVIEW_TARGET);
  }, []);

  // ── Per-frame lookAt driver ───────────────────────────
  // This ensures the camera always looks at the animated target,
  // providing smooth, jitter-free tracking during any GSAP tween.
  useFrame(() => {
    if (isControlling.current) {
      camera.lookAt(lookAtTarget.current);
    }
  });

  // ── Compute final camera position for a target ────────
  const computeEndPosition = (targetPos, size) => {
    const distFromOrigin = Math.sqrt(
      targetPos[0] ** 2 + targetPos[1] ** 2 + targetPos[2] ** 2
    );
    const isSun = distFromOrigin < 1;

    if (isSun) {
      // Sun approach: fixed angle, well outside radius 16
      const d = 40;
      return [d * 0.7, d * 0.5, d * 0.7];
    }

    // Three-quarter "sunlit" view: mostly along the orbit, slightly sunward,
    // so the planet shows its lit hemisphere instead of the night side.
    const out = { x: targetPos[0] / distFromOrigin, z: targetPos[2] / distFromOrigin };
    const tangent = { x: -out.z, z: out.x };
    const zoomDist = (size || 1) * 7.0;
    const dirX = -out.x * 0.55 + tangent.x * 0.84;
    const dirZ = -out.z * 0.55 + tangent.z * 0.84;
    return [
      targetPos[0] + dirX * zoomDist,
      targetPos[1] + (size || 1) * 2,
      targetPos[2] + dirZ * zoomDist,
    ];
  };

  // ── Main effect — drives all camera transitions ───────
  useEffect(() => {
    // Kill any in-progress timeline
    if (timelineRef.current) {
      timelineRef.current.kill();
      timelineRef.current = null;
    }

    // ═══════════════════════════════════════════════════════
    //  SCENARIO A: Moving TO a planet/Sun
    // ═══════════════════════════════════════════════════════
    if (activePlanet && planetPosition) {
      isControlling.current = true;

      const isFromOverview = prevPlanetRef.current === null;
      const endPos = computeEndPosition(planetPosition, activePlanetSize);

      const targetVec = new THREE.Vector3(...planetPosition);

      // Determine source — canvas click is direct, sidebar is two-phase
      const source = selectionSource || 'canvas';
      const isPlanetToPlanet = !isFromOverview;
      const useTwoPhase = source === 'sidebar' && isPlanetToPlanet;

      const tl = gsap.timeline({
        onComplete: () => {
          isControlling.current = true; // keep controlling after
          prevPlanetRef.current = activePlanet;
          prevPositionRef.current = [...planetPosition];
          // Final precision lock
          camera.lookAt(targetVec);
          if (onAnimationComplete) onAnimationComplete();
        },
      });

      if (useTwoPhase) {
        // ─── TWO-PHASE CINEMATIC (Sidebar → planet-to-planet) ───

        // Phase 1: "The Search" — pan lookAt to target, camera stays put
        tl.to(lookAtTarget.current, {
          x: targetVec.x,
          y: targetVec.y,
          z: targetVec.z,
          duration: 0.5,
          ease: 'power2.inOut',
        });

        // Phase 2: "The Approach" — fly to end position, target locked
        tl.to(camera.position, {
          x: endPos[0],
          y: endPos[1],
          z: endPos[2],
          duration: 1.0,
          ease: 'power2.inOut',
        });

      } else {
        // ─── SINGLE-PHASE FLUID (Canvas click or from overview) ─────

        // Animate BOTH position and lookAt target simultaneously
        // so the camera smoothly sweeps to the new planet with zero snap.
        // Scroll-wheel jumps use a snappier transit.
        const duration = source === 'scroll' ? 0.9 : 1.3;

        tl.to(camera.position, {
          x: endPos[0],
          y: endPos[1],
          z: endPos[2],
          duration,
          ease: 'power2.inOut',
        }, 0); // start at t=0

        tl.to(lookAtTarget.current, {
          x: targetVec.x,
          y: targetVec.y,
          z: targetVec.z,
          duration,
          ease: 'power2.inOut',
        }, 0); // start at t=0 — simultaneous
      }

      timelineRef.current = tl;

    // ═══════════════════════════════════════════════════════
    //  SCENARIO B: Returning to Overview
    // ═══════════════════════════════════════════════════════
    } else if (!activePlanet && prevPlanetRef.current !== null) {
      isControlling.current = true;

      const tl = gsap.timeline({
        onComplete: () => {
          prevPlanetRef.current = null;
          prevPositionRef.current = null;
          camera.lookAt(OVERVIEW_TARGET);
          if (onAnimationComplete) onAnimationComplete();
        },
      });

      // Simultaneously fly up and pan lookAt back to origin
      const duration = selectionSource === 'scroll' ? 0.9 : 1.1;
      tl.to(camera.position, {
        x: OVERVIEW_POS.x,
        y: OVERVIEW_POS.y,
        z: OVERVIEW_POS.z,
        duration,
        ease: 'power2.inOut',
      }, 0);

      tl.to(lookAtTarget.current, {
        x: OVERVIEW_TARGET.x,
        y: OVERVIEW_TARGET.y,
        z: OVERVIEW_TARGET.z,
        duration,
        ease: 'power2.inOut',
      }, 0);

      timelineRef.current = tl;
    }

    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [activePlanet, planetPosition, camera, onAnimationComplete, activePlanetSize, selectionSource]);

  return null;
}

export default CameraController;
