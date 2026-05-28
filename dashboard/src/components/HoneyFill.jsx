import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * HoneyFill — Animated honey liquid inside the hive.
 */
export default function HoneyFill({
  fillLevel = 0.65,
  innerRadius = 1.13,
  maxHeight = 2.85,
  baseY = -1.44,
  temperature = 35,
}) {
  const bodyRef = useRef();
  const surfaceRef = useRef();
  const animLevel = useRef(fillLevel);

  const honeyHeight = fillLevel * maxHeight;

  const honeyColor = useMemo(() => {
    const t = Math.max(0, Math.min(1, (temperature - 20) / 25));
    const cool = new THREE.Color('#FFD54F');
    const warm = new THREE.Color('#FF8F00');
    const hot = new THREE.Color('#E65100');
    return t < 0.5
      ? cool.clone().lerp(warm, t * 2)
      : warm.clone().lerp(hot, (t - 0.5) * 2);
  }, [temperature]);

  const emissiveColor = useMemo(() => {
    return new THREE.Color('#CC7700').multiplyScalar(0.5 + fillLevel * 0.5);
  }, [fillLevel]);

  const bodyGeo = useMemo(
    () => new THREE.CylinderGeometry(innerRadius - 0.01, innerRadius - 0.01, 1, 6, 1, false),
    [innerRadius],
  );
  const surfaceGeo = useMemo(() => {
    return new THREE.CylinderGeometry(innerRadius - 0.015, innerRadius - 0.015, 0.03, 6, 4, false);
  }, [innerRadius]);

  useFrame(({ clock }) => {
    animLevel.current += (fillLevel - animLevel.current) * 0.04;
    const h = Math.max(0.001, animLevel.current * maxHeight);

    if (bodyRef.current) {
      bodyRef.current.scale.y = h;
      bodyRef.current.position.y = baseY + h / 2;
    }

    if (surfaceRef.current) {
      const t = clock.elapsedTime;
      surfaceRef.current.position.y = baseY + h;
      surfaceRef.current.position.x = Math.sin(t * 1.1) * 0.006;
      surfaceRef.current.position.z = Math.cos(t * 0.85) * 0.006;
    }
  });

  if (fillLevel <= 0.001) return null;

  return (
    <group>
      <mesh ref={bodyRef} geometry={bodyGeo}>
        <meshStandardMaterial
          color={honeyColor}
          emissive={emissiveColor}
          emissiveIntensity={0.4}
          metalness={0.05}
          roughness={0.25}
          transparent
          opacity={0.88}
        />
      </mesh>

      <mesh ref={surfaceRef} geometry={surfaceGeo}>
        <meshStandardMaterial
          color={honeyColor}
          emissive="#FFB300"
          emissiveIntensity={0.6}
          metalness={0.1}
          roughness={0.2}
          transparent
          opacity={0.92}
        />
      </mesh>
    </group>
  );
}
