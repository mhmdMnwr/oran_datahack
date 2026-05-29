/**
 * Hive API service — wraps all backend endpoints from backendDocs.md
 */
import { API_BASE } from './config';

const MAX_HONEY_KG = 25;      // 25 kg of honey = 100% fill
const HIVE_WOOD_KG = 7;       // weight of the hive structure
const BEE_WEIGHT_KG = 1e-4;   // weight of one bee in kg (0.1 g)

/** Derive honey weight from total weight on the scale. */
export function getHoneyWeight(totalWeight, population) {
  return Math.max(0, (totalWeight ?? 0) - (population ?? 0) * BEE_WEIGHT_KG - HIVE_WOOD_KG);
}

/**
 * GET /hives — Fetch all hives with latest sensor data
 * Returns normalized hive objects for the dashboard.
 */
export async function fetchAllHives() {
  const res = await fetch(`${API_BASE}/hives`);
  if (!res.ok) throw new Error(`Failed to fetch hives: ${res.status}`);
  const data = await res.json();

  return data.map((hive) => {
    const totalWeight = hive.latestSensorData?.weight ?? 0;
    const population = hive.latestSensorData?.population ?? 0;
    const honeyWeight = getHoneyWeight(totalWeight, population);

    return {
      id: hive.id,
      name: hive.name,
      queenStatus: hive.queenStatus,
      lat: hive.location?.latitude,
      lng: hive.location?.longitude,
      temp: hive.latestSensorData?.temperature ?? 0,
      humid: hive.latestSensorData?.humidity ?? 0,
      weight: totalWeight,
      honeyWeight,
      population,
      fill: Math.min(1, honeyWeight / MAX_HONEY_KG),
      hasAlerts: hive.hasAlerts ?? false,
      createdAt: hive.createdAt,
      updatedAt: hive.updatedAt,
    };
  });
}

/**
 * GET /hives/:id — Fetch a single hive with sensor history + alerts
 */
export async function fetchHiveDetail(id) {
  const res = await fetch(`${API_BASE}/hives/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch hive ${id}: ${res.status}`);
  const hive = await res.json();

  // Normalize sensor history
  const sensorsData = hive.sensorsData || {};

  const temperatureHistory = (sensorsData.temperature || []).map((d) => ({
    value: d.value,
    label: d.hour,
  }));

  const humidityHistory = (sensorsData.humidity || []).map((d) => ({
    value: d.value,
    label: d.hour,
  }));

  const weightHistory = (sensorsData.weight || []).map((d) => ({
    value: d.value,
    label: d.date,
  }));

  const populationHistory = (sensorsData.population || []).map((d) => ({
    value: d.value,
    label: d.date,
  }));

  // Normalize alerts
  const alerts = (hive.alerts || []).map((a) => ({
    id: a._id,
    severity: a.severity,
    type: a.type,
    message: a.message,
    resolved: a.resolved,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }));

  return {
    id: hive.id,
    name: hive.name,
    queenStatus: hive.queenStatus,
    lat: hive.location?.latitude,
    lng: hive.location?.longitude,
    createdAt: hive.createdAt,
    updatedAt: hive.updatedAt,
    history: {
      temperature: temperatureHistory,
      humidity: humidityHistory,
      weight: weightHistory,
      population: populationHistory,
    },
    alerts,
  };
}

/**
 * POST /alerts/:alertID/resolve — Mark an alert as resolved
 */
export async function resolveAlert(alertId) {
  const res = await fetch(`${API_BASE}/alerts/${encodeURIComponent(alertId)}/resolve`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to resolve alert ${alertId}: ${res.status}`);
  return res.json();
}

export { MAX_HONEY_KG };
