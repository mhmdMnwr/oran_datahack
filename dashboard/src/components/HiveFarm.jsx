import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import SingleHive from './SingleHive';
import { isProblematic } from '../data/hives';

const COL_SPACING = 3.6;
const ROW_SPACING = 4.2;

/**
 * HiveFarm — Renders hives in a 3D grid.
 * `hives` is now passed as a prop (fetched from API).
 */
export default function HiveFarm({ hives = [], selectedId, onSelect, onNavigate, showProblemsOnly = false }) {
  const positions = useMemo(() => {
    return hives.map((hive, i) => {
      const cols = Math.min(hives.length, 5);
      const row = Math.floor(i / 5);
      const col = i % 5;
      const x = (col - (cols - 1) / 2) * COL_SPACING + (row % 2 === 1 ? COL_SPACING * 0.5 : 0);
      const z = row * ROW_SPACING;
      return { ...hive, x, z };
    });
  }, [hives]);

  const getStatus = (fill) => {
    if (fill >= 0.85) return { label: 'FULL', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400' };
    if (fill >= 0.5) return { label: 'GOOD', bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400' };
    if (fill >= 0.25) return { label: 'LOW', bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400' };
    return { label: 'CRITICAL', bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400' };
  };

  return (
    <group>
      {positions.map((hive) => {
        const fill = hive.fill ?? 0;
        const temp = hive.temp ?? 0;
        // Scale population to a reasonable 3D bee count (1-30 range for performance)
        const population = hive.population ?? 0;
        const beeCount = Math.max(1, Math.min(30, Math.round(population / 300)));
        const pct = Math.round(fill * 100);
        const status = getStatus(fill);
        const isSelected = selectedId === hive.id;
        const hasProblem = isProblematic(hive);

        // Hide healthy hives when filter is active
        if (showProblemsOnly && !hasProblem) return null;

        return (
          <group key={hive.id} position={[hive.x, 0, hive.z]}>

            {/* Click target */}
            <mesh position={[0, 0.5, 0]}
              onClick={(e) => {
                e.stopPropagation();
                if (e.detail === 2) { onNavigate?.(hive.id); } // double-click navigates
                else { onSelect?.(hive.id); } // single-click selects
              }}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
              <boxGeometry args={[2.8, 3.8, 2.8]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>

            <SingleHive fillLevel={fill} temperature={temp} selected={isSelected}
              hasProblem={hasProblem} beeCount={beeCount} />

            {/* Percentage label */}
            <Html position={[0, 2.2, 0]} center distanceFactor={12}
              style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div className="flex flex-col items-center gap-1">
                <div className={`text-[11px] font-bold tabular-nums px-2.5 py-1 rounded-lg border backdrop-blur-md
                  ${status.bg} ${status.border} ${status.text}`}>
                  🐝 {population.toLocaleString()}
                </div>
                <div className="text-[9px] font-semibold tracking-wider text-amber-300/60 uppercase">
                  {hive.name}
                </div>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
