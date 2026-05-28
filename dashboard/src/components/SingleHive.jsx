import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import HoneyFill from './HoneyFill';

const RADIUS = 1.2;
const HEIGHT = 3.0;
const WALL = 0.07;
const INNER_R = RADIUS - WALL;

/**
 * SingleHive — One hexagonal hive (no cap).
 * When hasProblem=true, the hive pulses red like a warning light.
 */
export default function SingleHive({ fillLevel = 0.65, temperature = 35, selected = false, hasProblem = false }) {
  const glowRef = useRef();
  const alertRef = useRef();
  const shellRef = useRef();
  const edgeRef = useRef();
  const rimTopRef = useRef();
  const rimBotRef = useRef();
  const rimMidRef = useRef();

  const shellGeo = useMemo(() => new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, 6, 1, true), []);
  const rimGeo = useMemo(() => new THREE.TorusGeometry(RADIUS * 0.96, 0.035, 8, 6), []);
  const baseGeo = useMemo(() => new THREE.CylinderGeometry(RADIUS * 1.08, RADIUS * 1.12, 0.12, 6), []);
  const bottomGeo = useMemo(() => new THREE.CylinderGeometry(INNER_R, INNER_R, 0.05, 6), []);
  const edgesGeo = useMemo(() => {
    const c = new THREE.CylinderGeometry(RADIUS + 0.003, RADIUS + 0.003, HEIGHT, 6);
    return new THREE.EdgesGeometry(c);
  }, []);

  // Normal golden shell material
  const shellMat = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#DDA020'),
      transparent: true, opacity: 0.45,
      metalness: 0.35, roughness: 0.3,
      side: THREE.DoubleSide, depthWrite: false,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        `varying vec3 vWPos;\n void main() {\n vWPos = (modelMatrix * vec4(position, 1.0)).xyz;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `varying vec3 vWPos;
         float hexDist(vec2 p) { p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.732))), p.x); }
         void main() {`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float angle = atan(vWPos.x, vWPos.z);
         float h = vWPos.y;
         vec2 hUV = vec2(angle * 2.5, h * 3.5);
         vec2 s = vec2(1.0, 1.732); vec2 hh = s * 0.5;
         vec2 a = mod(hUV, s) - hh;
         vec2 b = mod(hUV + hh, s) - hh;
         vec2 cell = (dot(a,a) < dot(b,b)) ? a : b;
         float d = hexDist(cell);
         float border = smoothstep(0.36, 0.44, d);
         float shade = 1.0 - smoothstep(0.0, 0.33, d) * 0.15;
         diffuseColor.rgb *= shade;
         diffuseColor.rgb += vec3(1.0, 0.8, 0.35) * border * 0.5;
         diffuseColor.a = mix(0.3, 0.55, border);`
      );
    };
    return mat;
  }, []);

  // Colors
  const normalGold = useMemo(() => new THREE.Color('#FFCC66'), []);
  const alertRed = useMemo(() => new THREE.Color('#FF2222'), []);
  const normalRimColor = useMemo(() => new THREE.Color('#CDA434'), []);
  const alertRimColor = useMemo(() => new THREE.Color('#CC2222'), []);
  const normalShellColor = useMemo(() => new THREE.Color('#DDA020'), []);
  const alertShellColor = useMemo(() => new THREE.Color('#DD3333'), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // Normal inner glow
    if (glowRef.current) {
      const pulse = 0.5 + Math.sin(t * 1.5) * 0.15;
      glowRef.current.intensity = (0.4 + fillLevel * 1.4) * pulse;
    }

    // Alert pulsing — flash the hive red
    if (hasProblem) {
      const flash = 0.5 + Math.sin(t * 4) * 0.5; // fast pulse 0..1

      // Pulse shell color between gold and red
      if (shellRef.current) {
        shellRef.current.material.color.copy(normalShellColor).lerp(alertShellColor, flash);
        shellRef.current.material.emissive = shellRef.current.material.emissive || new THREE.Color();
        shellRef.current.material.emissive.set('#FF0000');
        shellRef.current.material.emissiveIntensity = flash * 0.4;
      }

      // Pulse edges
      if (edgeRef.current) {
        edgeRef.current.material.color.copy(normalGold).lerp(alertRed, flash);
        edgeRef.current.material.opacity = 0.5 + flash * 0.5;
      }

      // Pulse rims
      [rimTopRef, rimBotRef, rimMidRef].forEach((ref) => {
        if (ref.current) {
          ref.current.material.color.copy(normalRimColor).lerp(alertRimColor, flash);
          ref.current.material.emissive = ref.current.material.emissive || new THREE.Color();
          ref.current.material.emissive.set('#FF0000');
          ref.current.material.emissiveIntensity = flash * 0.5;
        }
      });

      // Alert point light
      if (alertRef.current) {
        alertRef.current.intensity = flash * 3.5;
      }
    } else {
      // Reset to normal when not a problem
      if (shellRef.current && shellRef.current.material.emissiveIntensity > 0) {
        shellRef.current.material.color.copy(normalShellColor);
        shellRef.current.material.emissiveIntensity = 0;
      }
      if (edgeRef.current) {
        edgeRef.current.material.color.copy(selected ? new THREE.Color('#FFD700') : normalGold);
        edgeRef.current.material.opacity = selected ? 0.9 : 0.55;
      }
      [rimTopRef, rimBotRef, rimMidRef].forEach((ref) => {
        if (ref.current && ref.current.material.emissiveIntensity > 0) {
          ref.current.material.color.copy(normalRimColor);
          ref.current.material.emissiveIntensity = 0;
        }
      });
    }
  });

  return (
    <group>
      {/* Shell */}
      <mesh ref={shellRef} geometry={shellGeo} material={shellMat} castShadow />

      {/* Bottom floor */}
      <mesh geometry={bottomGeo} position={[0, -HEIGHT / 2 + 0.03, 0]}>
        <meshStandardMaterial color="#B08828" metalness={0.2} roughness={0.6} />
      </mesh>

      {/* Edges */}
      <lineSegments ref={edgeRef} geometry={edgesGeo}>
        <lineBasicMaterial color={selected ? '#FFD700' : '#FFCC66'} transparent opacity={selected ? 0.9 : 0.55} />
      </lineSegments>

      {/* Top rim */}
      <mesh ref={rimTopRef} geometry={rimGeo} position={[0, HEIGHT / 2 - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#CDA434" metalness={0.6} roughness={0.2} />
      </mesh>

      {/* Bottom rim */}
      <mesh ref={rimBotRef} geometry={rimGeo} position={[0, -HEIGHT / 2 + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#CDA434" metalness={0.6} roughness={0.2} />
      </mesh>

      {/* Mid band */}
      <mesh ref={rimMidRef} geometry={rimGeo} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#B8922E" metalness={0.55} roughness={0.25} />
      </mesh>

      {/* Base plate */}
      <mesh geometry={baseGeo} position={[0, -HEIGHT / 2 - 0.06, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#7A5C2E" metalness={0.15} roughness={0.7} />
      </mesh>

      {/* Selection ring */}
      {selected && (
        <mesh position={[0, -HEIGHT / 2 - 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[RADIUS * 1.15, RADIUS * 1.3, 6]} />
          <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.6}
            transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Honey */}
      <HoneyFill fillLevel={fillLevel} innerRadius={INNER_R}
        maxHeight={HEIGHT - 0.15} baseY={-HEIGHT / 2 + 0.06} temperature={temperature} />

      {/* Normal inner glow */}
      <pointLight ref={glowRef} position={[0, fillLevel * HEIGHT - HEIGHT / 2, 0]}
        color="#FFAA22" intensity={1} distance={3.5} decay={2} />

      {/* Alert red pulsing light */}
      {hasProblem && (
        <pointLight ref={alertRef} position={[0, 0.5, 0]}
          color="#FF0000" intensity={0} distance={5} decay={2} />
      )}
    </group>
  );
}
