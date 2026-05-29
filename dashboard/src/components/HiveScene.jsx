import React, { useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import HiveFarm from './HiveFarm';

/** Grass-like ground with procedural color variation */
function GroundPlane() {
  const grassMat = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#4A6B35',
      metalness: 0.0,
      roughness: 0.95,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        `varying vec2 vWorldXZ;
         void main() {
           vec4 wp = modelMatrix * vec4(position, 1.0);
           vWorldXZ = wp.xz;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `varying vec2 vWorldXZ;
         float hash(vec2 p) {
           return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
         }
         void main() {`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float n = hash(floor(vWorldXZ * 3.0));
         float n2 = hash(floor(vWorldXZ * 12.0));
         vec3 grass1 = vec3(0.28, 0.42, 0.20);
         vec3 grass2 = vec3(0.35, 0.50, 0.25);
         vec3 grass3 = vec3(0.22, 0.36, 0.16);
         vec3 gc = mix(grass1, grass2, n);
         gc = mix(gc, grass3, n2 * 0.3);
         float dist = length(vWorldXZ) / 20.0;
         gc = mix(gc, gc * 0.7, smoothstep(0.4, 1.0, dist));
         diffuseColor.rgb = gc;`
      );
    };
    return mat;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.62, 2]} receiveShadow material={grassMat}>
      <planeGeometry args={[60, 40, 1, 1]} />
    </mesh>
  );
}

/** Small decorative stones scattered around */
function GroundDetails() {
  const stones = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 28;
      const z = Math.random() * 12 - 2;
      // Avoid placing right under hives
      const nearHive = Math.abs(x) < 10 && z > -1 && z < 6;
      if (nearHive && Math.random() > 0.3) continue;
      arr.push({
        pos: [x, -1.58, z],
        scale: [0.08 + Math.random() * 0.15, 0.04 + Math.random() * 0.06, 0.08 + Math.random() * 0.15],
        rot: Math.random() * Math.PI,
        color: Math.random() > 0.5 ? '#8A7E6B' : '#6B6355',
      });
    }
    return arr;
  }, []);

  const flowers = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 25; i++) {
      const x = (Math.random() - 0.5) * 30;
      const z = Math.random() * 14 - 3;
      const nearHive = Math.abs(x) < 9 && z > -1 && z < 6;
      if (nearHive) continue;
      arr.push({
        pos: [x, -1.52, z],
        color: ['#FFD54F', '#FF8A65', '#CE93D8', '#81C784', '#FFF176'][Math.floor(Math.random() * 5)],
        scale: 0.04 + Math.random() * 0.05,
      });
    }
    return arr;
  }, []);

  return (
    <group>
      {stones.map((s, i) => (
        <mesh key={`s${i}`} position={s.pos} scale={s.scale} rotation={[0, s.rot, 0]} receiveShadow>
          <sphereGeometry args={[1, 5, 4]} />
          <meshStandardMaterial color={s.color} roughness={0.9} metalness={0.0} />
        </mesh>
      ))}
      {flowers.map((f, i) => (
        <mesh key={`f${i}`} position={f.pos}>
          <sphereGeometry args={[f.scale, 6, 6]} />
          <meshStandardMaterial color={f.color} emissive={f.color} emissiveIntensity={0.15}
            roughness={0.6} metalness={0.0} />
        </mesh>
      ))}
    </group>
  );
}

/** Dirt path / walkway between the hive rows */
function DirtPath() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.615, 2.1]} receiveShadow>
      <planeGeometry args={[20, 1.8]} />
      <meshStandardMaterial color="#6B5D4A" roughness={0.95} metalness={0.0} />
    </mesh>
  );
}

export default function HiveScene({ hives, selectedId, onSelect, onNavigate, showProblemsOnly }) {
  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: false, toneMapping: 3 }}
      dpr={[1, 2]}
    >
      {/* Warm sky gradient background */}
      <color attach="background" args={['#2E4A3A']} />

      {/* Environment for reflections */}
      <Environment preset="sunset" environmentIntensity={0.3} />

      <PerspectiveCamera makeDefault fov={50} position={[0, 8, 16]} near={0.1} far={200} />
      <OrbitControls
        enableDamping dampingFactor={0.06}
        minDistance={4} maxDistance={50}
        maxPolarAngle={Math.PI * 0.85} minPolarAngle={Math.PI * 0.05}
        target={[0, 0.5, 2]}
      />

      {/* Bright warm ambient */}
      <ambientLight intensity={0.6} color="#FFF3E0" />

      {/* Key light */}
      <directionalLight position={[10, 14, 8]} intensity={2.2} color="#FFE4B5"
        castShadow shadow-mapSize={2048}
        shadow-camera-left={-20} shadow-camera-right={20}
        shadow-camera-top={20} shadow-camera-bottom={-20}
        shadow-camera-near={0.1} shadow-camera-far={80} />

      {/* Fill light */}
      <directionalLight position={[-8, 8, -4]} intensity={1.0} color="#FFD5A0" />

      {/* Uplighting */}
      <pointLight position={[0, -1, 4]} intensity={0.8} color="#FFE0B2" />
      <pointLight position={[0, 6, -4]} intensity={0.5} color="#FFECD2" />

      {/* Spot highlights */}
      <spotLight position={[-5, 8, 3]} angle={0.6} penumbra={0.9}
        intensity={1.2} color="#FFF3E0" castShadow />
      <spotLight position={[5, 8, 3]} angle={0.6} penumbra={0.9}
        intensity={1.2} color="#FFF3E0" castShadow />

      {/* Farm */}
      <HiveFarm hives={hives} selectedId={selectedId} onSelect={onSelect} onNavigate={onNavigate}
        showProblemsOnly={showProblemsOnly} />

      {/* Ground */}
      <GroundPlane />
      <DirtPath />
      <GroundDetails />

      {/* Post-processing */}
      <EffectComposer>
        <Bloom intensity={0.25} luminanceThreshold={0.7} luminanceSmoothing={0.5} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
