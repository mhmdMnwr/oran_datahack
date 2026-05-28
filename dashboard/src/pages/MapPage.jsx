import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { HIVE_DATA, isProblematic } from '../data/hives';

/* Custom hive marker icon */
function hiveIcon(fill) {
  const problem = isProblematic(fill);
  const pct = Math.round(fill * 100);
  const color = problem ? '#EF4444' : fill >= 0.85 ? '#10B981' : fill >= 0.5 ? '#F59E0B' : '#F97316';
  const glow = problem ? 'box-shadow: 0 0 12px rgba(239,68,68,0.6);' : '';

  return L.divIcon({
    className: '',
    iconSize: [44, 56],
    iconAnchor: [22, 56],
    popupAnchor: [0, -60],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:40px;height:40px;border-radius:10px;
          background:${color};border:2px solid rgba(255,255,255,0.9);
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-weight:800;color:#fff;
          font-family:Inter,sans-serif;
          ${glow}
          ${problem ? 'animation:pulse-red 1.2s infinite;' : ''}
        ">${pct}%</div>
        <div style="
          width:0;height:0;
          border-left:8px solid transparent;
          border-right:8px solid transparent;
          border-top:10px solid ${color};
          margin-top:-1px;
        "></div>
      </div>`,
  });
}

/* Fit map to all hive markers */
function FitBounds() {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(HIVE_DATA.map((h) => [h.lat, h.lng]));
    map.fitBounds(bounds.pad(0.3));
  }, [map]);
  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const [liveData, setLiveData] = useState(() => {
    const d = {};
    HIVE_DATA.forEach((h) => { d[h.id] = { fill: h.fill, temp: h.temp }; });
    return d;
  });

  // Simulate live drift
  useEffect(() => {
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

  const center = [35.702, -0.630];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1A1610] font-['Inter',sans-serif]">
      {/* Map */}
      <MapContainer center={center} zoom={16} className="absolute inset-0 z-0"
        style={{ background: '#1A1610' }} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds />

        {HIVE_DATA.map((hive) => {
          const data = liveData[hive.id] || {};
          const fill = data.fill ?? hive.fill;
          const temp = data.temp ?? hive.temp;
          const pct = Math.round(fill * 100);
          const problem = isProblematic(fill);

          return (
            <Marker key={hive.id} position={[hive.lat, hive.lng]} icon={hiveIcon(fill)}>
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#1a1a1a' }}>
                    🐝 {hive.name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#666' }}>Honey Level</span>
                    <span style={{ fontWeight: 700, color: problem ? '#EF4444' : '#D97706' }}>{pct}%</span>
                  </div>
                  <div style={{
                    height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 6
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 3, width: `${pct}%`,
                      background: problem ? '#EF4444' : 'linear-gradient(90deg, #F59E0B, #D97706)',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#666' }}>Temperature</span>
                    <span style={{ fontWeight: 600, color: temp > 38 ? '#EF4444' : '#1a1a1a' }}>{temp.toFixed(1)}°C</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Status</span>
                    <span style={{
                      fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 8,
                      background: problem ? '#FEE2E2' : fill >= 0.85 ? '#D1FAE5' : '#FEF3C7',
                      color: problem ? '#DC2626' : fill >= 0.85 ? '#059669' : '#D97706',
                    }}>
                      {fill >= 0.85 ? 'Full' : fill >= 0.5 ? 'Good' : fill >= 0.25 ? 'Low' : 'Critical'}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#aaa', marginTop: 6, textAlign: 'center' }}>
                    {hive.lat.toFixed(4)}°N, {Math.abs(hive.lng).toFixed(4)}°W
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🗺️</span>
          <div>
            <h1 className="text-base font-bold tracking-[0.18em] text-amber-100 uppercase">Hive Map</h1>
            <p className="text-[10px] text-amber-500/40 tracking-wider mt-0.5">GPS LOCATIONS · ORAN, ALGERIA</p>
          </div>
          <span className="ml-3 flex items-center gap-1.5 text-[10px] font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        </div>

        <button onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full
            bg-amber-950/30 border border-amber-700/20 text-amber-300/70 backdrop-blur-md
            hover:bg-amber-900/30 cursor-pointer transition-all">
          🏠 3D Farm View
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
        <div className="flex items-center gap-5 bg-black/50 backdrop-blur-md border border-amber-700/15 rounded-full px-5 py-2">
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
    </div>
  );
}
