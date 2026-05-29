/**
 * Shared hive helpers — used by 3D farm, map, and detail views.
 * The actual data now comes from the API (src/api/hiveApi.js).
 */

import { MAX_WEIGHT_KG } from '../api/hiveApi';

/** A hive is problematic if it has active alerts */
const isProblematic = (hive) => hive?.hasAlerts === true;

/** Calculate fill percentage from weight */
const getFillFromWeight = (weight) => Math.min(1, Math.max(0, (weight ?? 0) / MAX_WEIGHT_KG));

export { isProblematic, getFillFromWeight, MAX_WEIGHT_KG };
