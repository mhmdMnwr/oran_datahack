import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import HiveScene from '../components/HiveScene';
import { fetchAllHives } from '../api/hiveApi';
import { isProblematic } from '../data/hives';

export default function FarmPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(null);
  const [hives, setHives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showProblemsOnly, setShowProblemsOnly] = useState(false);
  const [queenFilter, setQueenFilter] = useState(null); // null | 'pending_acceptance' | 'absent'



  // Fetch hives from API and poll every 10 seconds
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchAllHives();
        if (!cancelled) {
          setHives(data);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to fetch hives:', err);
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    load();
    const interval = setInterval(load, 10000); // poll every 10s
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const selected = selectedId ? hives.find((h) => h.id === selectedId) : null;
  const problemCount = hives.filter(isProblematic).length;
  const pendingQueenCount = hives.filter((h) => h.queenStatus === 'pending_acceptance').length;
  const absentQueenCount = hives.filter((h) => h.queenStatus === 'absent').length;
  const queenIssueCount = pendingQueenCount + absentQueenCount;

  const handleSelect = useCallback((id) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1A1610] font-['Inter',sans-serif]">
      {/* 3D Scene */}
      <div className="absolute inset-0">
        <HiveScene hives={hives} selectedId={selectedId} onSelect={handleSelect}
          onNavigate={(id) => navigate(`/hive/${id}`)}
          showProblemsOnly={showProblemsOnly} queenFilter={queenFilter} />
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1A1610]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-amber-400/60">Loading hives...</p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && !loading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-red-500/15 border border-red-500/30 rounded-xl px-5 py-3 backdrop-blur-md">
          <p className="text-xs text-red-400">⚠️ {error}</p>
          <p className="text-[10px] text-red-400/50 mt-1">Retrying every 10 seconds...</p>
        </div>
      )}

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
          {!loading && (
            <span className="text-[10px] text-amber-500/30 ml-2">{hives.length} hives</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/map')}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full border backdrop-blur-md transition-all duration-200 cursor-pointer bg-amber-950/30 border-amber-700/20 text-amber-300/70 hover:bg-amber-900/30">
            <span>🗺️</span>
            Map View
          </button>
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
          <button onClick={() => {
              if (queenFilter === null) setQueenFilter('pending_acceptance');
              else if (queenFilter === 'pending_acceptance') setQueenFilter('absent');
              else setQueenFilter(null);
            }}
            className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full border backdrop-blur-md transition-all duration-200 cursor-pointer ${
              queenFilter
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                : 'bg-amber-950/30 border-amber-700/20 text-amber-300/70 hover:bg-amber-900/30'
            }`}>
            <span>👑</span>
            {queenFilter === 'pending_acceptance' ? 'Pending Queen' :
             queenFilter === 'absent' ? 'Queen Absent' : 'Queen Filter'}
            {queenIssueCount > 0 && !queenFilter && (
              <span className="bg-purple-500/30 text-purple-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {queenIssueCount}
              </span>
            )}
          </button>
          {(showProblemsOnly || queenFilter) && (
            <button onClick={() => { setShowProblemsOnly(false); setQueenFilter(null); }}
              className="text-[10px] text-amber-400/50 hover:text-amber-300 cursor-pointer">
              Show All
            </button>
          )}
        </div>
      </div>

      {/* Selected Hive Panel */}
      {selected && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-56 animate-fade-in">
          <div className="bg-amber-950/40 backdrop-blur-xl border border-amber-700/25 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-amber-100 tracking-wide">
                {selected.name}
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
                  {selected.temp?.toFixed(1)}°C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-500/60">💧 Humidity</span>
                <span className="font-semibold text-amber-200 tabular-nums">{selected.humid?.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-500/60">⚖️ Weight</span>
                <span className="font-semibold text-amber-200 tabular-nums">{selected.weight?.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-500/60">👑 Queen</span>
                <span className={`font-semibold text-xs px-2 py-0.5 rounded-full border ${
                  selected.queenStatus === 'present'
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                    : selected.queenStatus === 'pending_acceptance'
                    ? 'text-purple-400 bg-purple-500/10 border-purple-500/30'
                    : 'text-red-400 bg-red-500/10 border-red-500/30'
                }`}>
                  {selected.queenStatus === 'present' ? 'Present' :
                   selected.queenStatus === 'pending_acceptance' ? 'Pending' : 'Absent'}
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
            </div>
            <div className="mt-4 pt-3 border-t border-amber-900/20 space-y-2">
              <button onClick={() => navigate(`/hive/${selected.id}`)}
                className="w-full text-xs font-semibold py-2 rounded-lg bg-amber-500/15 border border-amber-500/25
                  text-amber-300 hover:bg-amber-500/25 cursor-pointer transition-all">
                📊 Open Details
              </button>
              <p className="text-[9px] text-amber-600/30 text-center tracking-wider">
                DOUBLE-CLICK FOR DETAILS
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Legend */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="flex items-center gap-5 bg-amber-950/25 backdrop-blur-md border border-amber-700/15 rounded-full px-5 py-2">
          {[
            { color: 'bg-emerald-400', label: 'Healthy Colony' },
            { color: 'bg-amber-400', label: 'Active Foraging' },
            { color: 'bg-orange-400', label: 'Low Activity' },
            { color: 'bg-red-400', label: 'Alert' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${item.color}`} />
              <span className="text-[9px] text-amber-300/50">{item.label}</span>
            </div>
          ))}
        </div>
      </div>



      <div className="absolute bottom-5 right-6 z-10 pointer-events-none">
        <p className="text-[9px] text-amber-400/40">Click to select · Double-click for details · Drag to orbit</p>
      </div>
    </div>
  );
}
