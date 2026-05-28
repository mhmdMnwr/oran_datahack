import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import HiveScene from '../components/HiveScene';
import { HIVE_DATA, isProblematic } from '../data/hives';

export default function FarmPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(null);
  const [liveData, setLiveData] = useState({});
  const [showProblemsOnly, setShowProblemsOnly] = useState(false);

  useEffect(() => {
    const base = {};
    HIVE_DATA.forEach((h) => { base[h.id] = { fill: h.fill, temp: h.temp }; });
    setLiveData(base);

    const interval = setInterval(() => {
      setLiveData((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          const d = next[id];
          next[id] = {
            fill: Math.max(0, Math.min(1, d.fill + (Math.random() - 0.48) * 0.015)),
            temp: Math.max(20, Math.min(45, d.temp + (Math.random() - 0.5) * 0.4)),
          };
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const selected = selectedId ? { id: selectedId, ...HIVE_DATA.find((h) => h.id === selectedId), ...liveData[selectedId] } : null;
  const problemCount = Object.values(liveData).filter((d) => isProblematic(d.fill)).length;

  const handleSelect = useCallback((id) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1A1610] font-['Inter',sans-serif]">
      <div className="absolute inset-0">
        <HiveScene selectedId={selectedId} onSelect={handleSelect}
          overrides={liveData} showProblemsOnly={showProblemsOnly} />
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3 pointer-events-none">
          <span className="text-2xl">🐝</span>
          <div>
            <h1 className="text-base font-bold tracking-[0.18em] text-amber-100 uppercase leading-tight">
              Smart Hive Farm
            </h1>
            <p className="text-[10px] text-amber-500/40 tracking-wider mt-0.5">REAL-TIME HONEY MONITORING</p>
          </div>
          <span className="ml-3 flex items-center gap-1.5 text-[10px] font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowProblemsOnly(!showProblemsOnly)}
            className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full border backdrop-blur-md transition-all duration-200 cursor-pointer ${
              showProblemsOnly
                ? 'bg-red-500/20 border-red-500/40 text-red-300 shadow-[0_0_12px_rgba(255,60,60,0.15)]'
                : 'bg-amber-950/30 border-amber-700/20 text-amber-300/70 hover:bg-amber-900/30'
            }`}>
            <span>⚠️</span>
            {showProblemsOnly ? 'Showing Problems' : 'Show Problems Only'}
            {problemCount > 0 && (
              <span className="bg-red-500/30 text-red-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {problemCount}
              </span>
            )}
          </button>
          {showProblemsOnly && (
            <button onClick={() => setShowProblemsOnly(false)}
              className="text-[10px] text-amber-400/50 hover:text-amber-300 cursor-pointer">
              Show All
            </button>
          )}

          <button onClick={() => navigate('/map')}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full
              bg-amber-950/30 border border-amber-700/20 text-amber-300/70 backdrop-blur-md
              hover:bg-amber-900/30 cursor-pointer transition-all ml-2">
            🗺️ Map View
          </button>
        </div>
      </div>

      {/* Selected Hive Panel */}
      {selected && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-56 animate-fade-in">
          <div className="bg-amber-950/40 backdrop-blur-xl border border-amber-700/25 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-amber-100 tracking-wide">
                {HIVE_DATA.find((h) => h.id === selectedId)?.name}
              </h2>
              <button onClick={() => setSelectedId(null)}
                className="text-amber-500/40 hover:text-amber-300 text-lg cursor-pointer leading-none">×</button>
            </div>
            <div className="text-center mb-4">
              <span className="text-5xl font-bold text-amber-100 tabular-nums">{Math.round(selected.fill * 100)}</span>
              <span className="text-xl text-amber-400/60 ml-1">%</span>
              <div className="text-[9px] text-amber-500/40 tracking-widest uppercase mt-1">Honey Level</div>
            </div>
            <div className="relative h-2.5 bg-amber-950/40 rounded-full overflow-hidden mb-4">
              <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${selected.fill * 100}%`,
                  background: 'linear-gradient(90deg, #CC7700, #FFB300, #FFD54F)',
                  boxShadow: '0 0 10px rgba(255,179,0,0.4)' }} />
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-amber-500/60">🌡 Temp</span>
                <span className={`font-semibold tabular-nums ${selected.temp > 38 ? 'text-red-400' : 'text-amber-200'}`}>
                  {selected.temp.toFixed(1)}°C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-500/60">📊 Status</span>
                <span className={`font-semibold text-xs px-2 py-0.5 rounded-full border ${
                  selected.fill >= 0.85 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                  selected.fill >= 0.5 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                  selected.fill >= 0.25 ? 'text-orange-400 bg-orange-500/10 border-orange-500/30' :
                  'text-red-400 bg-red-500/10 border-red-500/30'
                }`}>
                  {selected.fill >= 0.85 ? 'Full' : selected.fill >= 0.5 ? 'Good' : selected.fill >= 0.25 ? 'Low' : 'Critical'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-500/60">⚖️ Est. Yield</span>
                <span className="font-semibold text-amber-200 tabular-nums">{(selected.fill * 42).toFixed(1)} kg</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-900/20 text-[9px] text-amber-600/30 text-center tracking-wider">
              HIVE #{selected.id} · CLICK TO DESELECT
            </div>
          </div>
        </div>
      )}

      {/* Bottom Legend */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="flex items-center gap-5 bg-amber-950/25 backdrop-blur-md border border-amber-700/15 rounded-full px-5 py-2">
          {[
            { color: 'bg-emerald-400', label: 'Full (>85%)' },
            { color: 'bg-amber-400', label: 'Good' },
            { color: 'bg-orange-400', label: 'Low' },
            { color: 'bg-red-400', label: 'Critical (<25%)' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${item.color}`} />
              <span className="text-[9px] text-amber-300/50">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-5 right-6 z-10 pointer-events-none">
        <p className="text-[9px] text-amber-400/40">Drag to orbit · Scroll to zoom · Click hive to inspect</p>
      </div>
    </div>
  );
}
