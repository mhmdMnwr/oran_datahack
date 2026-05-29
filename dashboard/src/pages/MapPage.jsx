import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchAllHives } from '../api/hiveApi';
import 'leaflet/dist/leaflet.css';

/* ── View Modes ── */
const VIEW_MODES = [
  { key: 'honey', label: 'Honey Level', icon: '🍯', unit: '%' },
  { key: 'population', label: 'Bee Population', icon: '🐝', unit: 'bees' },
  { key: 'temperature', label: 'Temperature', icon: '🌡️', unit: '°C' },
  { key: 'humidity', label: 'Humidity', icon: '💧', unit: '%' },
  { key: 'alerts', label: 'Alert Status', icon: '⚠️', unit: '' },
];

/* ── Color helpers ── */
function getHoneyColor(fill) {
  if (fill >= 0.85) return '#10B981';
  if (fill >= 0.5) return '#F59E0B';
  if (fill >= 0.25) return '#F97316';
  return '#EF4444';
}

function getPopulationColor(pop) {
  if (pop >= 8000) return '#10B981';
  if (pop >= 5000) return '#3B82F6';
  if (pop >= 2000) return '#F59E0B';
  return '#EF4444';
}

function getTempColor(temp) {
  if (temp >= 38) return '#EF4444';
  if (temp >= 33) return '#F97316';
  if (temp >= 25) return '#10B981';
  return '#3B82F6';
}

function getHumidColor(humid) {
  if (humid > 75) return '#EF4444';
  if (humid > 60) return '#F59E0B';
  if (humid >= 40) return '#10B981';
  return '#3B82F6';
}

function getAlertColor(hasAlerts) {
  return hasAlerts ? '#EF4444' : '#10B981';
}

function getColorForMode(hive, mode) {
  switch (mode) {
    case 'honey': return getHoneyColor(hive.fill);
    case 'population': return getPopulationColor(hive.population);
    case 'temperature': return getTempColor(hive.temp);
    case 'humidity': return getHumidColor(hive.humid);
    case 'alerts': return getAlertColor(hive.hasAlerts);
    default: return '#F59E0B';
  }
}

function getValueForMode(hive, mode) {
  switch (mode) {
    case 'honey': return `${Math.round(hive.fill * 100)}%`;
    case 'population': return hive.population.toLocaleString();
    case 'temperature': return `${hive.temp.toFixed(1)}°C`;
    case 'humidity': return `${hive.humid.toFixed(0)}%`;
    case 'alerts': return hive.hasAlerts ? 'ALERT' : 'OK';
    default: return '';
  }
}

/* ── Custom Marker Icon ── */
function createHiveIcon(hive, mode) {
  const color = getColorForMode(hive, mode);
  const value = getValueForMode(hive, mode);
  const modeConfig = VIEW_MODES.find(m => m.key === mode);
  const beeCount = hive.population;

  // Scale bees visual (1-5 bee emojis based on population)
  const beeVisual = mode === 'population'
    ? '🐝'.repeat(Math.min(5, Math.max(1, Math.ceil(beeCount / 2000))))
    : '';

  const svgSize = 52;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize + 18}" viewBox="0 0 ${svgSize} ${svgSize + 18}">
      <defs>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${color}" flood-opacity="0.4"/>
        </filter>
      </defs>
      <circle cx="${svgSize / 2}" cy="${svgSize / 2}" r="${svgSize / 2 - 3}" fill="${color}22" stroke="${color}" stroke-width="2.5" filter="url(#shadow)"/>
      <circle cx="${svgSize / 2}" cy="${svgSize / 2}" r="${svgSize / 2 - 8}" fill="${color}44"/>
      <text x="${svgSize / 2}" y="${svgSize / 2 + 1}" text-anchor="middle" dominant-baseline="middle" font-size="16" font-weight="800" fill="white" font-family="Inter, sans-serif">${mode === 'population' ? '🐝' : modeConfig?.icon || '🐝'}</text>
      <rect x="4" y="${svgSize + 2}" width="${svgSize - 8}" height="14" rx="4" fill="${color}" opacity="0.9"/>
      <text x="${svgSize / 2}" y="${svgSize + 12}" text-anchor="middle" font-size="9" font-weight="700" fill="white" font-family="Inter, sans-serif">${value}</text>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: 'custom-hive-marker',
    iconSize: [svgSize, svgSize + 18],
    iconAnchor: [svgSize / 2, svgSize / 2],
    popupAnchor: [0, -(svgSize / 2 + 4)],
  });
}

/* ── Fit bounds when hives load ── */
function FitBounds({ hives }) {
  const map = useMap();
  useEffect(() => {
    const validHives = hives.filter(h => h.lat && h.lng);
    if (validHives.length > 0) {
      const bounds = L.latLngBounds(validHives.map(h => [h.lat, h.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
    }
  }, [hives, map]);
  return null;
}

/* ── Focus on a specific hive from query param ── */
function FocusOnHive({ hives, hiveId }) {
  const map = useMap();
  const done = useRef(false);

  useEffect(() => {
    if (!hiveId || done.current) return;
    const target = hives.find(h => h.id === hiveId);
    if (target && target.lat && target.lng) {
      map.flyTo([target.lat, target.lng], 15, { duration: 1.5 });
      done.current = true;
    }
  }, [hives, hiveId, map]);

  return null;
}

/* ── Population bar for popup ── */
function PopulationBar({ population, max = 10000 }) {
  const pct = Math.min(100, (population / max) * 100);
  const beeEmojis = Math.min(10, Math.max(1, Math.ceil(population / 1000)));
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 10, color: '#A08C70', marginBottom: 3, letterSpacing: 1 }}>
        BEE POPULATION
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          flex: 1, height: 8, background: '#2A2520', borderRadius: 4, overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 4,
            background: `linear-gradient(90deg, ${getPopulationColor(population)}, ${getPopulationColor(population)}cc)`,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: getPopulationColor(population) }}>
          {population.toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 12, marginTop: 4, letterSpacing: 1 }}>
        {'🐝'.repeat(beeEmojis)}
      </div>
    </div>
  );
}

/* ── Main MapPage ── */
export default function MapPage() {
  const navigate = useNavigate();
  const [hives, setHives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('honey');
  const [searchParams] = useSearchParams();
  const focusHiveId = searchParams.get('hive');

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
    const interval = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const validHives = hives.filter(h => h.lat && h.lng && (h.lat !== 0 || h.lng !== 0));
  const modeConfig = VIEW_MODES.find(m => m.key === viewMode);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1A1610] font-['Inter',sans-serif]">
      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center bg-[#1A1610]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-amber-400/60">Loading hive map...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[999] bg-red-500/15 border border-red-500/30 rounded-xl px-5 py-3 backdrop-blur-md">
          <p className="text-xs text-red-400">⚠️ {error}</p>
          <p className="text-[10px] text-red-400/50 mt-1">Retrying every 10 seconds...</p>
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={[39.5, -74.5]}
        zoom={7}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds hives={validHives} />
        {focusHiveId && <FocusOnHive hives={validHives} hiveId={focusHiveId} />}

        {validHives.map(hive => (
          <Marker
            key={hive.id}
            position={[hive.lat, hive.lng]}
            icon={createHiveIcon(hive, viewMode)}
          >
            <Popup>
              <div style={{
                background: '#1A1610',
                color: '#F5F0E8',
                padding: 16,
                borderRadius: 14,
                minWidth: 240,
                fontFamily: 'Inter, sans-serif',
                border: '1px solid rgba(180,140,60,0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 22 }}>🐝</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#FDE68A' }}>{hive.name}</div>
                    <div style={{ fontSize: 9, color: '#A08C70', letterSpacing: 2 }}>
                      {hive.queenStatus === 'present' ? '👑 QUEEN PRESENT' : '⚠️ QUEEN ABSENT'}
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8,
                }}>
                  <div style={{ background: '#2A2520', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: '#A08C70', letterSpacing: 1 }}>🌡 TEMP</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: getTempColor(hive.temp) }}>
                      {hive.temp.toFixed(1)}°C
                    </div>
                  </div>
                  <div style={{ background: '#2A2520', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: '#A08C70', letterSpacing: 1 }}>💧 HUMID</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: getHumidColor(hive.humid) }}>
                      {hive.humid.toFixed(0)}%
                    </div>
                  </div>
                  <div style={{ background: '#2A2520', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: '#A08C70', letterSpacing: 1 }}>🍯 HONEY</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: getHoneyColor(hive.fill) }}>
                      {Math.round(hive.fill * 100)}%
                    </div>
                  </div>
                  <div style={{ background: '#2A2520', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: '#A08C70', letterSpacing: 1 }}>⚖️ WEIGHT</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#F5F0E8' }}>
                      {hive.weight.toFixed(1)}kg
                    </div>
                  </div>
                </div>

                {/* Bee population bar */}
                <PopulationBar population={hive.population} />

                {/* Alert badge */}
                {hive.hasAlerts && (
                  <div style={{
                    marginTop: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8, padding: '6px 10px', fontSize: 10, color: '#FCA5A5',
                    fontWeight: 700, textAlign: 'center',
                  }}>
                    ⚠️ ACTIVE ALERTS
                  </div>
                )}

                {/* Open Details */}
                <button
                  onClick={() => navigate(`/hive/${hive.id}`)}
                  style={{
                    width: '100%', marginTop: 10, padding: '8px 0', borderRadius: 8,
                    background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                    color: '#FDE68A', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onMouseOver={(e) => { e.target.style.background = 'rgba(245,158,11,0.25)'; }}
                  onMouseOut={(e) => { e.target.style.background = 'rgba(245,158,11,0.15)'; }}
                >
                  📊 Open Hive Details
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* ── Top Bar ── */}
      <div className="absolute top-0 left-0 right-0 z-[999] flex items-center justify-between px-6 py-4 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={() => navigate('/')}
            className="text-amber-400/60 hover:text-amber-300 cursor-pointer text-sm bg-amber-950/50 backdrop-blur-md border border-amber-700/20 px-3 py-1.5 rounded-lg transition-all"
          >
            ← 3D Farm
          </button>
          <div className="w-px h-6 bg-amber-800/20" />
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🗺️</span>
            <div>
              <h1 className="text-base font-bold tracking-[0.18em] text-amber-100 uppercase leading-tight">
                Hive Map
              </h1>
              <p className="text-[10px] text-amber-500/40 tracking-wider mt-0.5">
                GEOGRAPHIC OVERVIEW · {validHives.length} HIVES
              </p>
            </div>
          </div>
          <span className="ml-3 flex items-center gap-1.5 text-[10px] font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        </div>
      </div>

      {/* ── View Mode Switcher ── */}
      <div className="absolute top-4 right-6 z-[999] pointer-events-auto">
        <div className="bg-amber-950/60 backdrop-blur-xl border border-amber-700/25 rounded-2xl p-3">
          <p className="text-[9px] font-bold tracking-[0.2em] text-amber-500/50 uppercase mb-2 px-1">
            View Mode
          </p>
          <div className="flex flex-col gap-1">
            {VIEW_MODES.map(mode => (
              <button
                key={mode.key}
                onClick={() => setViewMode(mode.key)}
                className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                  viewMode === mode.key
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                    : 'bg-transparent border-transparent text-amber-500/50 hover:bg-amber-900/30 hover:text-amber-400'
                }`}
              >
                <span>{mode.icon}</span>
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="absolute bottom-6 left-6 z-[999] pointer-events-none">
        <div className="bg-amber-950/60 backdrop-blur-xl border border-amber-700/25 rounded-2xl p-4 min-w-[200px]">
          <p className="text-[9px] font-bold tracking-[0.2em] text-amber-500/50 uppercase mb-3">
            {modeConfig?.icon} {modeConfig?.label} Legend
          </p>
          {viewMode === 'honey' && (
            <div className="space-y-1.5">
              {[
                { color: '#10B981', label: 'Full (85%+)' },
                { color: '#F59E0B', label: 'Good (50-84%)' },
                { color: '#F97316', label: 'Low (25-49%)' },
                { color: '#EF4444', label: 'Critical (<25%)' },
              ].map(i => (
                <div key={i.label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: i.color }} />
                  <span className="text-[10px] text-amber-300/60">{i.label}</span>
                </div>
              ))}
            </div>
          )}
          {viewMode === 'population' && (
            <div className="space-y-1.5">
              {[
                { color: '#10B981', label: 'Thriving (8000+)' },
                { color: '#3B82F6', label: 'Healthy (5000-7999)' },
                { color: '#F59E0B', label: 'Low (2000-4999)' },
                { color: '#EF4444', label: 'Critical (<2000)' },
              ].map(i => (
                <div key={i.label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: i.color }} />
                  <span className="text-[10px] text-amber-300/60">{i.label}</span>
                </div>
              ))}
            </div>
          )}
          {viewMode === 'temperature' && (
            <div className="space-y-1.5">
              {[
                { color: '#EF4444', label: 'Hot (38°C+)' },
                { color: '#F97316', label: 'Warm (33-37°C)' },
                { color: '#10B981', label: 'Optimal (25-32°C)' },
                { color: '#3B82F6', label: 'Cool (<25°C)' },
              ].map(i => (
                <div key={i.label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: i.color }} />
                  <span className="text-[10px] text-amber-300/60">{i.label}</span>
                </div>
              ))}
            </div>
          )}
          {viewMode === 'humidity' && (
            <div className="space-y-1.5">
              {[
                { color: '#EF4444', label: 'Too High (75%+)' },
                { color: '#F59E0B', label: 'High (60-74%)' },
                { color: '#10B981', label: 'Optimal (40-59%)' },
                { color: '#3B82F6', label: 'Too Low (<40%)' },
              ].map(i => (
                <div key={i.label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: i.color }} />
                  <span className="text-[10px] text-amber-300/60">{i.label}</span>
                </div>
              ))}
            </div>
          )}
          {viewMode === 'alerts' && (
            <div className="space-y-1.5">
              {[
                { color: '#EF4444', label: 'Active Alerts' },
                { color: '#10B981', label: 'All Clear' },
              ].map(i => (
                <div key={i.label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: i.color }} />
                  <span className="text-[10px] text-amber-300/60">{i.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats Summary ── */}
      <div className="absolute bottom-6 right-6 z-[999] pointer-events-none">
        <div className="bg-amber-950/60 backdrop-blur-xl border border-amber-700/25 rounded-2xl p-4">
          <p className="text-[9px] font-bold tracking-[0.2em] text-amber-500/50 uppercase mb-3">
            Farm Summary
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-amber-100">{hives.length}</div>
              <div className="text-[9px] text-amber-500/50">TOTAL HIVES</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-emerald-400">
                {hives.reduce((sum, h) => sum + h.population, 0).toLocaleString()}
              </div>
              <div className="text-[9px] text-amber-500/50">TOTAL BEES</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-amber-300">
                {hives.length > 0 ? Math.round(hives.reduce((s, h) => s + h.fill, 0) / hives.length * 100) : 0}%
              </div>
              <div className="text-[9px] text-amber-500/50">AVG HONEY</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold" style={{ color: hives.filter(h => h.hasAlerts).length > 0 ? '#EF4444' : '#10B981' }}>
                {hives.filter(h => h.hasAlerts).length}
              </div>
              <div className="text-[9px] text-amber-500/50">ALERTS</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
