import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';

// Components
import Sun from './components/Sun';
import Planet from './components/Planet';
import AsteroidBelt from './components/AsteroidBelt';
import CustomStars from './components/CustomStars';
import MilkyWay from './components/MilkyWay';
import CameraController from './components/CameraController';
import SlidingSidebar from './components/SlidingSidebar';
import HolographicCard from './components/HolographicCard';
import RightDetailSidebar from './components/RightDetailSidebar';
import WelcomeHint from './components/WelcomeHint';
import MobileProjectCard from './components/MobileProjectCard';
import NavigationGuide from './components/NavigationGuide';

// Data
import projectsData from './data/projectsData';

// Textures Imports
import MercuryImg from './assets/1k_mercury.webp';
import VenusImg from './assets/1k_venus_surface.webp';
import EarthImg from './assets/2k_earth_daymap.webp';
import MarsImg from './assets/1k_mars.webp';
import CeresImg from './assets/1k_ceres.webp';
import JupiterImg from './assets/2k_jupiter.webp';
import SaturnImg from './assets/2k_saturn.webp';
import UranusImg from './assets/2k_uranus.webp';
import NeptuneImg from './assets/2k_neptune.webp';
import MakemakeImg from './assets/1k_makemake.webp';
import HaumeaImg from './assets/1k_haumea.webp';

// Pixels of accumulated wheel delta needed to trigger a planet jump
const SCROLL_JUMP_THRESHOLD = 40;
// Wheel events closer together than this belong to the same gesture (incl. trackpad inertia)
const SCROLL_GESTURE_GAP_MS = 220;
// Small deltas keep adding up toward a jump unless the wheel rests this long
const SCROLL_ACCUMULATE_RESET_MS = 800;

function App() {
  // ── Core State ──────────────────────────────────────────
  const [activePlanet, setActivePlanet] = useState(null);
  const [planetPosition, setPlanetPosition] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showHologram, setShowHologram] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCardExiting, setIsCardExiting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectionSource, setSelectionSource] = useState('canvas');
  const orbitControlsRef = useRef(null);
  const canvasElRef = useRef(null);
  const [maxDpr, setMaxDpr] = useState(1.5);

  // ── Mobile Detection ───────────────────────────────────
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ── Planet Configuration ────────────────────────────────
  const planetsData = [
    { name: "Mercury", distance: 20, size: 0.6, speed: 0.6, texture: MercuryImg, color: '#8c8680' },
    { name: "Venus", distance: 30, size: 0.9, speed: 0.5, texture: VenusImg, color: '#c9a66b', atmosphere: { color: '#ffd9a0', intensity: 0.9 } },
    { name: "Earth", distance: 40, size: 1.0, speed: 0.4, texture: EarthImg, color: '#3a6ea5', atmosphere: { color: '#5aa8ff', intensity: 1.3 } },
    { name: "Mars", distance: 50, size: 0.7, speed: 0.35, texture: MarsImg, color: '#b5532a', atmosphere: { color: '#ff9a6a', intensity: 0.45 } },
    { name: "Ceres", distance: 65, size: 0.4, speed: 0.28, texture: CeresImg, color: '#7d766c' },
    { name: "Jupiter", distance: 85, size: 2.5, speed: 0.2, texture: JupiterImg, color: '#c8a57e', atmosphere: { color: '#ffdcb0', intensity: 0.5 } },
    { name: "Saturn", distance: 110, size: 2.2, speed: 0.15, texture: SaturnImg, color: '#d4bb8a', atmosphere: { color: '#ffe7b8', intensity: 0.45 } },
    { name: "Uranus", distance: 135, size: 1.8, speed: 0.1, texture: UranusImg, color: '#9fd8dc', atmosphere: { color: '#a8f0ff', intensity: 0.9 } },
    { name: "Neptune", distance: 155, size: 1.8, speed: 0.08, texture: NeptuneImg, color: '#4767c9', atmosphere: { color: '#6f8cff', intensity: 1.0 } },
    { name: "Makemake", distance: 175, size: 0.6, speed: 0.06, texture: MakemakeImg, color: '#b08a74' },
    { name: "Haumea", distance: 190, size: 0.5, speed: 0.05, texture: HaumeaImg, color: '#9a9a9a' },
  ];

  const referenceSpeed = 0.5;
  const referenceDistance = 20;

  const calculateSpeed = (distance) => {
    return referenceSpeed * Math.sqrt(referenceDistance / distance) * 0.25;
  };

  // ── Sidebar Handlers ───────────────────────────────────
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  /**
   * Called when the user selects a project from the SIDEBAR.
   * Sets selectionSource to 'sidebar' for two-phase cinematic transit.
   */
  const handleSelectFromSidebar = useCallback((planetName) => {
    if (activePlanet === planetName) {
      setIsSidebarOpen(false);
      return;
    }

    // Close both sidebars
    setIsSidebarOpen(false);
    setIsDetailOpen(false);
    setShowHologram(false);

    // Mark this as a sidebar selection
    setSelectionSource('sidebar');

    if (planetName === 'Sun') {
      setActivePlanet('Sun');
      setPlanetPosition([0, 0, 0]);
      setIsAnimating(true);
      return;
    }

    setActivePlanet(planetName);
    setPlanetPosition(null);
    setIsAnimating(true);
  }, [activePlanet]);

  /**
   * Called when the user clicks a planet/Sun directly on the canvas.
   * Sets selectionSource to 'canvas' for single-phase fluid transit.
   */
  const handleSelectFromCanvas = useCallback((planetName) => {
    if (activePlanet === planetName) return;

    // Close both sidebars
    setIsSidebarOpen(false);
    setIsDetailOpen(false);
    setShowHologram(false);

    // Mark this as a canvas click
    setSelectionSource('canvas');

    if (planetName === 'Sun') {
      setActivePlanet('Sun');
      setPlanetPosition([0, 0, 0]);
      setIsAnimating(true);
      return;
    }

    setActivePlanet(planetName);
    setPlanetPosition(null);
    setIsAnimating(true);
  }, [activePlanet]);

  // ── Planet Position Reporting ───────────────────────────
  const handlePositionUpdate = useCallback((pos) => {
    setPlanetPosition(pos);
  }, []);

  // ── Camera Animation Complete ──────────────────────────
  const handleAnimationComplete = useCallback(() => {
    setIsAnimating(false);

    // Sync OrbitControls target
    if (orbitControlsRef.current) {
      if (activePlanet && planetPosition) {
        orbitControlsRef.current.target.set(...planetPosition);
      } else {
        orbitControlsRef.current.target.set(0, 0, 0);
      }
      orbitControlsRef.current.update();
    }

    // Show hologram card AFTER camera settles (only if a node is active)
    if (activePlanet) {
      setShowHologram(true);
    }
  }, [activePlanet, planetPosition]);

  // ── Back to Overview ───────────────────────────────────
  const handleBackToOverview = useCallback(() => {
    setActivePlanet(null);
    setPlanetPosition(null);
    setIsAnimating(true);
    setShowHologram(false);
    setIsSidebarOpen(false);
    setIsDetailOpen(false);
  }, []);

  // ── Scroll Navigation ──────────────────────────────────
  // Overview → Sun → planets outward; scrolling up past the Sun returns to overview.
  const scrollOrder = ['Sun', ...planetsData.map(p => p.name)];

  const handleScrollNavigate = (direction) => {
    const index = activePlanet ? scrollOrder.indexOf(activePlanet) : -1;
    const nextIndex = index + direction;
    if (nextIndex < -1 || nextIndex >= scrollOrder.length) return;

    setSelectionSource('scroll');
    setIsSidebarOpen(false);
    setIsDetailOpen(false);
    setShowHologram(false);
    setIsAnimating(true);

    if (nextIndex === -1) {
      setActivePlanet(null);
      setPlanetPosition(null);
      return;
    }

    const planetName = scrollOrder[nextIndex];
    setActivePlanet(planetName);
    setPlanetPosition(planetName === 'Sun' ? [0, 0, 0] : null);
  };

  const scrollNavRef = useRef(null);
  useLayoutEffect(() => {
    scrollNavRef.current = { navigate: handleScrollNavigate, isAnimating };
  });

  useEffect(() => {
    let accumulated = 0;
    let lastWheelTime = 0;
    let cooldownUntil = 0;

    const onWheel = (e) => {
      // Pinch / Ctrl+scroll still zooms via OrbitControls
      if (e.ctrlKey) return;
      // A plain scroll never zooms; it either scrolls text or jumps planets
      e.stopPropagation();
      // Cursor over a panel, card or any other UI: let the text scroll natively
      if (e.target !== canvasElRef.current) return;
      e.preventDefault();

      const now = performance.now();
      const sinceLast = now - lastWheelTime;
      lastWheelTime = now;

      // Swallow the rest of the gesture (incl. trackpad inertia) until it pauses
      if (scrollNavRef.current.isAnimating || now < cooldownUntil) {
        accumulated = 0;
        cooldownUntil = now + SCROLL_GESTURE_GAP_MS;
        return;
      }
      if (sinceLast > SCROLL_ACCUMULATE_RESET_MS) accumulated = 0;

      accumulated += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (Math.abs(accumulated) < SCROLL_JUMP_THRESHOLD) return;

      const direction = accumulated > 0 ? 1 : -1;
      accumulated = 0;
      cooldownUntil = now + SCROLL_GESTURE_GAP_MS;
      scrollNavRef.current.navigate(direction);
    };

    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => window.removeEventListener('wheel', onWheel, { capture: true });
  }, []);

  // ── Right Detail Sidebar ───────────────────────────────
  const handleOpenDetail = useCallback(() => {
    // 1. Trigger the card exit animation
    setIsCardExiting(true);
    // 2. Open the detail panel simultaneously
    setIsDetailOpen(true);
    // 3. After exit animation completes, unmount the card
    setTimeout(() => {
      setShowHologram(false);
      setIsCardExiting(false);
    }, 400);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
    // Restore the holographic card if a planet is still active
    if (activePlanet) {
      setShowHologram(true);
    }
  }, [activePlanet]);

  // ── Derived Data ───────────────────────────────────────
  const activePlanetData = planetsData.find(p => p.name === activePlanet);
  // For the Sun, use a virtual size for camera zoom (Sun radius is 16)
  const activePlanetSize = activePlanet === 'Sun' ? 16 : (activePlanetData ? activePlanetData.size : 1);
  const activeProjectData = projectsData.find(p => p.planetName === activePlanet);

  return (
    <>
      {/* Welcome Hint — first-visit discovery overlay */}
      <WelcomeHint />

      {/* Back to Overview Button */}
      {activePlanet && (
        <button
          className="back-button"
          onClick={handleBackToOverview}
          aria-label="Return to solar system overview"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
      )}

      {/* Sliding Sidebar — left side (HTML overlay, outside Canvas) */}
      <SlidingSidebar
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
        projects={projectsData}
        activePlanet={activePlanet}
        onSelectProject={handleSelectFromSidebar}
      />

      {/* Right Detail Sidebar (HTML overlay, outside Canvas) */}
      <RightDetailSidebar
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        projectData={activeProjectData}
      />

      {/* Mobile Project Card — bottom sheet outside Canvas */}
      {isMobile && (
        <MobileProjectCard
          projectData={activeProjectData}
          visible={showHologram && !isAnimating}
          isExiting={isCardExiting}
          onMoreInfo={handleOpenDetail}
        />
      )}

      {/* Navigation Guide — floating help icon */}
      {!showHologram && !isDetailOpen && <NavigationGuide />}

      {/* 3D Canvas */}
      <Canvas
        dpr={[1, maxDpr]}
        gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
        camera={{ position: [0, 200, 0], fov: 100, near: 0.1, far: 3000 }}
        onCreated={({ gl }) => { canvasElRef.current = gl.domElement; }}
      >
        {/* Drop to native-ish resolution on devices that can't hold the frame rate */}
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setMaxDpr(1)}
          onIncline={() => setMaxDpr(1.5)}
          onFallback={() => setMaxDpr(1)}
        />
        <CameraController
          activePlanet={activePlanet}
          planetPosition={planetPosition}
          activePlanetSize={activePlanetSize}
          onAnimationComplete={handleAnimationComplete}
          selectionSource={selectionSource}
        />

        <OrbitControls
          ref={orbitControlsRef}
          enableZoom={!isAnimating}
          enablePan={!isAnimating}
          enableRotate={!isAnimating}
        />

        <Suspense fallback={null}>
          <MilkyWay radius={900} />
        </Suspense>
        <CustomStars radius={800} count={7000} />
        <ambientLight intensity={0.22} />

        {/* Sun — now clickable and selectable */}
        <Sun
          isActive={activePlanet === 'Sun'}
          onSelect={handleSelectFromCanvas}
        />

        {/* Sun's Holographic Card — desktop only, rendered in 3D space */}
        {!isMobile && activePlanet === 'Sun' && (
          <HolographicCard
            projectData={activeProjectData}
            planetPosition={planetPosition}
            planetSize={16}
            visible={showHologram && !isAnimating}
            isExiting={isCardExiting}
            onMoreInfo={handleOpenDetail}
          />
        )}

        {planetsData.map((planet, index) => (
          <React.Fragment key={index}>
            {/* Orbital ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[planet.distance - 0.2, planet.distance + 0.2, 256]} />
              <meshBasicMaterial
                color="#ffffff"
                opacity={0.15}
                transparent
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Planet — clickable to zoom, or select via sidebar */}
            <Planet
              name={planet.name}
              distance={planet.distance}
              size={planet.size}
              speed={calculateSpeed(planet.distance)}
              textureFile={planet.texture}
              isActive={activePlanet === planet.name}
              onSelect={handleSelectFromCanvas}
              onPositionUpdate={handlePositionUpdate}
              hasRings={planet.name === "Saturn"}
              color={planet.color}
              atmosphere={planet.atmosphere}
            />

            {/* Holographic Card — desktop only, rendered in 3D space near frozen planet */}
            {!isMobile && activePlanet === planet.name && (
              <HolographicCard
                projectData={activeProjectData}
                planetPosition={planetPosition}
                planetSize={planet.size}
                visible={showHologram && !isAnimating}
                isExiting={isCardExiting}
                onMoreInfo={handleOpenDetail}
              />
            )}
          </React.Fragment>
        ))}

        <AsteroidBelt />
      </Canvas>
    </>
  );
}

export default App;