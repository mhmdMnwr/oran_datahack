import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * AnimatedBees — Procedural bees that fly in and out of the hive.
 *
 * Each bee has a randomised looping flight path:
 *   - Starts inside the hive (near center)
 *   - Flies outward in a curved arc
 *   - Loops back and re-enters
 *
 * Props:
 *   beeCount  — number of bees to render (will map to population later)
 *   hiveRadius — radius of the parent hive cylinder
 *   hiveHeight — height of the parent hive cylinder
 */

const BEE_BODY_COLOR = '#FFD54F';
const BEE_STRIPE_COLOR = '#3E2723';
const BEE_WING_COLOR = '#E0F7FA';

/** Create a single bee mesh (body + stripes + wings) */
function createBeeGeometry() {
  // We'll use InstancedMesh, so geometry is shared
  return {
    body: new THREE.SphereGeometry(1, 8, 6),
    wing: new THREE.PlaneGeometry(1, 0.6),
  };
}

/** Generate a random flight path config for one bee */
function randomFlight(index, total, hiveRadius) {
  const angle = (index / total) * Math.PI * 2 + Math.random() * 0.5;
  const speed = 0.4 + Math.random() * 0.6;           // orbit speed
  const orbitRadius = hiveRadius + 0.8 + Math.random() * 2.5; // how far out
  const heightBase = -0.5 + Math.random() * 2.0;     // vertical center
  const heightAmp = 0.3 + Math.random() * 0.8;       // vertical bob
  const phase = Math.random() * Math.PI * 2;          // phase offset
  const wobble = 0.2 + Math.random() * 0.3;           // side wobble

  return { angle, speed, orbitRadius, heightBase, heightAmp, phase, wobble };
}

export default function AnimatedBees({ beeCount = 12, hiveRadius = 1.2, hiveHeight = 3.0 }) {
  const groupRef = useRef();
  const beeRefs = useRef([]);

  // Pre-compute flight paths
  const flights = useMemo(() => {
    return Array.from({ length: beeCount }, (_, i) => randomFlight(i, beeCount, hiveRadius));
  }, [beeCount, hiveRadius]);

  // Bee scale
  const beeScale = 0.045;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    flights.forEach((f, i) => {
      const ref = beeRefs.current[i];
      if (!ref) return;

      // Parametric position along the flight path
      const theta = t * f.speed + f.phase;

      // Radial breathing: bee goes from inside hive to outside and back
      // Using a sin curve that maps [0,1] range for radius
      const radialT = (Math.sin(theta) + 1) / 2; // 0..1
      const currentRadius = radialT * f.orbitRadius;

      // Angular position (bee orbits around hive)
      const angularPos = f.angle + theta * 0.3;

      const x = Math.cos(angularPos) * currentRadius;
      const z = Math.sin(angularPos) * currentRadius;
      const y = f.heightBase + Math.sin(theta * 1.7 + f.phase) * f.heightAmp;

      ref.position.set(x, y, z);

      // Face direction of travel
      const nextTheta = theta + 0.05;
      const nextRadialT = (Math.sin(nextTheta) + 1) / 2;
      const nextRadius = nextRadialT * f.orbitRadius;
      const nextAng = f.angle + nextTheta * 0.3;
      const nx = Math.cos(nextAng) * nextRadius;
      const nz = Math.sin(nextAng) * nextRadius;
      const ny = f.heightBase + Math.sin(nextTheta * 1.7 + f.phase) * f.heightAmp;

      // Look in travel direction
      const dir = new THREE.Vector3(nx - x, ny - y, nz - z);
      if (dir.length() > 0.001) {
        dir.normalize();
        const lookTarget = new THREE.Vector3(x + dir.x, y + dir.y, z + dir.z);
        ref.lookAt(lookTarget);
      }

      // Wing flap via children scale
      const wingFlap = Math.sin(t * 35 + i * 2) * 0.4 + 0.6;
      if (ref.children[1]) ref.children[1].scale.y = wingFlap;
      if (ref.children[2]) ref.children[2].scale.y = wingFlap;
    });
  });

  return (
    <group ref={groupRef}>
      {flights.map((_, i) => (
        <group key={i} ref={(el) => { beeRefs.current[i] = el; }} scale={beeScale}>
          {/* Body — elongated sphere */}
          <mesh scale={[1, 0.7, 1.6]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color={BEE_BODY_COLOR} roughness={0.5} metalness={0.1} />
          </mesh>

          {/* Stripe bands */}
          <mesh scale={[1.01, 0.71, 0.25]} position={[0, 0, 0.4]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color={BEE_STRIPE_COLOR} roughness={0.7} />
          </mesh>
          <mesh scale={[1.01, 0.71, 0.25]} position={[0, 0, -0.3]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color={BEE_STRIPE_COLOR} roughness={0.7} />
          </mesh>

          {/* Left wing */}
          <mesh position={[0.7, 0.5, 0]} rotation={[0, 0, 0.3]}>
            <planeGeometry args={[1.4, 0.7]} />
            <meshStandardMaterial
              color={BEE_WING_COLOR}
              transparent
              opacity={0.45}
              side={THREE.DoubleSide}
              roughness={0.1}
              metalness={0.2}
            />
          </mesh>

          {/* Right wing */}
          <mesh position={[-0.7, 0.5, 0]} rotation={[0, 0, -0.3]}>
            <planeGeometry args={[1.4, 0.7]} />
            <meshStandardMaterial
              color={BEE_WING_COLOR}
              transparent
              opacity={0.45}
              side={THREE.DoubleSide}
              roughness={0.1}
              metalness={0.2}
            />
          </mesh>

          {/* Head */}
          <mesh position={[0, 0, 1.2]} scale={[0.55, 0.5, 0.5]}>
            <sphereGeometry args={[1, 6, 5]} />
            <meshStandardMaterial color="#5D4037" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
