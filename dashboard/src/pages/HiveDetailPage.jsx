import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { fetchHiveDetail, resolveAlert as apiResolveAlert } from '../api/hiveApi';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

/* ── SVG Gauge ── */
function Gauge({ value, min, max, unit, label, color, warningMin, warningMax }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = 70;
  const cx = 90, cy = 90;

  const inWarning = (warningMin != null && value < warningMin) || (warningMax != null && value > warningMax);

  const arcPath = (startA, endA) => {
    const s = (startA * Math.PI) / 180;
    const e = (endA * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const large = endA - startA > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="140" viewBox="0 0 180 140">
        {/* Track */}
        <path d={arcPath(-225, 45)} fill="none" stroke="#2A2520" strokeWidth="12" strokeLinecap="round" />
        {/* Filled arc */}
        <path d={arcPath(-225, -225 + pct * 270)} fill="none"
          stroke={inWarning ? '#EF4444' : color} strokeWidth="12" strokeLinecap="round"
          style={{ filter: inWarning ? 'drop-shadow(0 0 6px rgba(239,68,68,0.5))' : `drop-shadow(0 0 4px ${color}40)` }} />
        {/* Value */}
        <text x={cx} y={cy + 28} textAnchor="middle" fill="#F5F0E8" fontSize="22" fontWeight="800"
          fontFamily="Inter, sans-serif">{typeof value === 'number' ? value.toFixed(1) : value}</text>
        <text x={cx} y={cy + 42} textAnchor="middle" fill="#A08C70" fontSize="11"
          fontFamily="Inter, sans-serif">{unit}</text>
      </svg>
      <span className="text-[11px] font-semibold tracking-wider text-amber-400/60 uppercase -mt-1">{label}</span>
    </div>
  );
}

/* ── Analysis Chart ── */
function AnalysisChart({ data, labels, label, color, unit, timeLabel }) {
  const chartData = useMemo(() => ({
    labels,
    datasets: [{
      label,
      data,
      borderColor: color,
      backgroundColor: color + '20',
      borderWidth: 2,
      pointRadius: 2,
      pointBackgroundColor: '#1A1610',
      pointBorderColor: color,
      pointHoverRadius: 5,
      fill: true,
      tension: 0.4,
    }],
  }), [data, labels, label, color]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(26, 22, 16, 0.9)',
        borderColor: color + '50',
        borderWidth: 1,
        titleFont: { family: 'Inter', size: 12 },
        bodyFont: { family: 'Inter', size: 14, weight: 700 },
        padding: 10,
        callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(1)} ${unit}` },
      },
    },
    scales: {
      x: { 
        display: true,
        ticks: { color: '#8B7D6A', font: { size: 10, family: 'Inter' }, maxTicksLimit: 8 },
        grid: { color: '#2A251E', drawBorder: false },
      },
      y: {
        display: true,
        ticks: { color: '#8B7D6A', font: { size: 10, family: 'Inter' }, maxTicksLimit: 6 },
        grid: { color: '#2A251E', drawBorder: false },
      },
    },
  }), [color, unit]);

  return (
    <div className="bg-amber-950/20 border border-amber-800/15 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px] font-bold tracking-widest text-amber-400/70 uppercase">{label} — {timeLabel}</span>
        {data.length > 0 && (
          <span className="text-lg font-bold tabular-nums" style={{ color }}>
            {data[data.length - 1]?.toFixed(1)} {unit}
          </span>
        )}
      </div>
      <div style={{ height: 220 }}>
        {data.length > 0 ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="flex items-center justify-center h-full text-amber-500/30 text-sm">
            No data available
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Severity helpers ── */
const severityConfig = {
  high: { icon: '🔴', textColor: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/25' },
  medium: { icon: '🟠', textColor: 'text-orange-300', bg: 'bg-orange-500/8', border: 'border-orange-500/20' },
  low: { icon: '🟡', textColor: 'text-yellow-300', bg: 'bg-yellow-500/8', border: 'border-yellow-500/20' },
};

/* ── Alert Item ── */
function AlertItem({ alert, onResolve, resolving }) {
  const cfg = severityConfig[alert.severity] || severityConfig.low;

  // Format time
  const timeAgo = alert.createdAt
    ? new Date(alert.createdAt).toLocaleString()
    : 'Unknown';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
      <span className="text-lg mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className={`text-sm font-semibold ${cfg.textColor}`}>{alert.message}</p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/50 uppercase">
            {alert.type}
          </span>
        </div>
        <p className="text-[9px] text-amber-600/30 mt-1">{timeAgo}</p>
      </div>
      <button onClick={() => onResolve(alert.id)} disabled={resolving}
        className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-all shrink-0
          ${resolving
            ? 'bg-gray-500/10 border-gray-500/20 text-gray-400/50 cursor-wait'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/80 hover:bg-emerald-500/20 hover:text-emerald-300'
          }`}>
        {resolving ? '...' : 'Resolve'}
      </button>
    </div>
  );
}

/* ── Main Page ── */
export default function HiveDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [hive, setHive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);



  // Fetch hive detail from API
  const loadHive = async () => {
    try {
      const data = await fetchHiveDetail(id);
      setHive(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch hive detail:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHive();
  }, [id]);

  // Resolve alert via API, then re-fetch
  const handleResolve = async (alertId) => {
    setResolvingId(alertId);
    try {
      await apiResolveAlert(alertId);
      await loadHive(); // re-fetch to get updated alerts
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    } finally {
      setResolvingId(null);
    }
  };

  const handleResolveAll = async () => {
    const unresolvedAlerts = hive?.alerts.filter((a) => !a.resolved) || [];
    for (const alert of unresolvedAlerts) {
      try { await apiResolveAlert(alert.id); } catch (e) { console.error(e); }
    }
    await loadHive();
  };

  // Extract chart data
  const tempHistory = hive?.history?.temperature || [];
  const humidHistory = hive?.history?.humidity || [];
  const weightHistory = hive?.history?.weight || [];
  const popHistory = hive?.history?.population || [];

  // Latest values for gauges (from last data point in history or 0)
  const latestTemp = tempHistory.length > 0 ? tempHistory[tempHistory.length - 1].value : 0;
  const latestHumid = humidHistory.length > 0 ? humidHistory[humidHistory.length - 1].value : 0;
  const latestWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].value : 0;

  const unresolvedAlerts = hive?.alerts.filter((a) => !a.resolved) || [];

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#1A1610]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-amber-400/60">Loading hive data...</p>
        </div>
      </div>
    );
  }

  if (error || !hive) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#1A1610] text-amber-300">
        <div className="text-center">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-lg mb-2">Failed to load hive</p>
          <p className="text-sm text-amber-500/50 mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="text-amber-400 underline cursor-pointer">Back to farm</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-y-auto bg-[#1A1610] font-['Inter',sans-serif] text-white">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-20 bg-[#1A1610]/90 backdrop-blur-lg border-b border-amber-900/15">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')}
              className="text-amber-400/60 hover:text-amber-300 cursor-pointer text-sm">
              ← Back
            </button>
            <div className="w-px h-6 bg-amber-800/20" />
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🐝</span>
              <div>
                <h1 className="text-lg font-bold text-amber-100 tracking-wide">{hive.name}</h1>
                <p className="text-[10px] text-amber-500/40 tracking-wider">
                  HIVE {hive.id} · {hive.queenStatus === 'present' ? '👑 QUEEN PRESENT' : '⚠️ QUEEN ABSENT'}
                </p>
              </div>
            </div>
            {unresolvedAlerts.length > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 px-2.5 py-1 rounded-full animate-pulse">
                ⚠️ {unresolvedAlerts.length} ALERT{unresolvedAlerts.length > 1 ? 'S' : ''}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* ─── Gauges ─── */}
        <section>
          <h2 className="text-[10px] font-bold tracking-[0.2em] text-amber-500/50 uppercase mb-4">
            Live Sensors
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-amber-950/20 border border-amber-800/15 rounded-2xl p-5 flex justify-center">
              <Gauge value={latestTemp} min={15} max={50} unit="°C" label="Temperature"
                color="#F59E0B" warningMin={25} warningMax={38} />
            </div>
            <div className="bg-amber-950/20 border border-amber-800/15 rounded-2xl p-5 flex justify-center">
              <Gauge value={latestHumid} min={20} max={100} unit="%" label="Humidity"
                color="#3B82F6" warningMin={40} warningMax={75} />
            </div>
            <div className="bg-amber-950/20 border border-amber-800/15 rounded-2xl p-5 flex justify-center">
              <Gauge value={latestWeight} min={0} max={25} unit="kg" label="Weight"
                color="#10B981" warningMin={5} warningMax={null} />
            </div>
          </div>
        </section>

        {/* ─── Charts ─── */}
        <section>
          <h2 className="text-[10px] font-bold tracking-[0.2em] text-amber-500/50 uppercase mb-4">
            Analysis
          </h2>
          <div className="grid grid-cols-1 gap-6">
            <AnalysisChart
              data={tempHistory.map(d => d.value)}
              labels={tempHistory.map(d => d.label)}
              label="Temperature" color="#F59E0B" unit="°C" timeLabel="Hourly Avg (24h)" />
            <AnalysisChart
              data={humidHistory.map(d => d.value)}
              labels={humidHistory.map(d => d.label)}
              label="Humidity" color="#3B82F6" unit="%" timeLabel="Hourly Avg (24h)" />
            <AnalysisChart
              data={weightHistory.map(d => d.value)}
              labels={weightHistory.map(d => d.label)}
              label="Weight" color="#10B981" unit="kg" timeLabel="Daily Max (12d)" />
            <AnalysisChart
              data={popHistory.map(d => d.value)}
              labels={popHistory.map(d => d.label)}
              label="Population" color="#8B5CF6" unit="bees" timeLabel="Daily Max (12d)" />
          </div>
        </section>

        {/* ─── Alerts ─── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-bold tracking-[0.2em] text-amber-500/50 uppercase">
              Alerts & Problems
            </h2>
            {unresolvedAlerts.length > 1 && (
              <button onClick={handleResolveAll}
                className="text-[10px] font-semibold text-emerald-500/60 hover:text-emerald-400 cursor-pointer transition-colors">
                Resolve All
              </button>
            )}
          </div>
          <div className="space-y-3">
            {unresolvedAlerts.length === 0 ? (
              <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-4 text-center">
                <p className="text-sm text-emerald-400">✓ No active alerts</p>
                <p className="text-[10px] text-emerald-400/40 mt-1">All systems operating normally</p>
              </div>
            ) : (
              unresolvedAlerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} onResolve={handleResolve}
                  resolving={resolvingId === alert.id} />
              ))
            )}
          </div>
        </section>



        {/* Spacer */}
        <div className="h-8" />
      </main>
    </div>
  );
}
