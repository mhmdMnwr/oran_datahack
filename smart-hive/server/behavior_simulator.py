"""
Behavior-aware sensor simulator for the Smart Hive system.

Unlike the original :class:`SensorSimulator` which uses fixed ranges,
this simulator adapts its output based on the active behavior profile
(normal, swarm, queen_absent).  Switching behavior resets the internal
state to the new profile's baseline so transitions are immediate and
visible.
"""

import random
from datetime import datetime, timezone
from typing import Any, Optional

from behaviors import BehaviorProfile, get_behavior, DEFAULT_BEHAVIOR
from config import GPS_BASE_LAT, GPS_BASE_LON, GPS_DRIFT_RANGE


class BehaviorSimulator:
    """Generates sensor telemetry driven by a switchable behavior profile.

    Call :meth:`set_behavior` to change the active profile at any time.
    Each call to :meth:`generate_all` returns a snapshot of all sensors.
    """

    def __init__(self) -> None:
        """Initialise with the default (normal) behavior."""
        self._behavior: Optional[BehaviorProfile] = None

        # GPS state (independent of behavior)
        self._gps_lat: float = GPS_BASE_LAT
        self._gps_lon: float = GPS_BASE_LON

        # Sensor trend accumulators
        self._temp_value: float = 0.0
        self._humidity_value: float = 0.0
        self._weight_value: float = 0.0

        self.set_behavior(DEFAULT_BEHAVIOR)

    # ── public API ─────────────────────────────────────────────

    @property
    def current_behavior(self) -> str:
        """Name of the currently active behavior."""
        return self._behavior.name if self._behavior else DEFAULT_BEHAVIOR

    def set_behavior(self, name: str) -> dict[str, Any]:
        """Switch to a new behavior profile.

        Resets sensor values to the midpoint of the new profile's range
        so the change is immediately visible.

        Args:
            name: One of ``'normal'``, ``'swarm'``, ``'queen_absent'``.

        Returns:
            Metadata about the new behavior.
        """
        profile = get_behavior(name)
        self._behavior = profile

        # Reset to profile midpoints
        t = profile.temperature
        self._temp_value = (t.min + t.max) / 2

        h = profile.humidity
        self._humidity_value = (h.min + h.max) / 2

        w = profile.weight
        self._weight_value = (w.min + w.max) / 2 + random.uniform(-2, 2)

        return {
            "behavior": profile.name,
            "display_name": profile.display_name,
            "description": profile.description,
            "alert_level": profile.alert_level,
            "sound_file": profile.sound_file,
        }

    def generate_all(self) -> dict[str, Any]:
        """Generate a full sensor snapshot for the current behavior.

        Returns:
            Dictionary with ``behavior``, ``temperature``, ``humidity``,
            ``weight``, ``gps``, and ``timestamp`` fields.
        """
        p = self._behavior
        now = self._iso_now()

        # Temperature
        t = p.temperature
        self._temp_value += t.trend + random.gauss(0, 0.08)
        self._temp_value = max(t.min, min(t.max, self._temp_value))
        temp_reading = round(
            self._temp_value + random.gauss(0, t.noise_std), 2
        )

        # Humidity
        h = p.humidity
        self._humidity_value += h.trend + random.gauss(0, 0.3)
        self._humidity_value = max(h.min, min(h.max, self._humidity_value))
        humidity_reading = round(
            self._humidity_value + random.gauss(0, h.noise_std), 2
        )

        # Weight
        w = p.weight
        self._weight_value += w.trend + random.gauss(0, 0.02)
        self._weight_value = max(w.min, min(w.max, self._weight_value))
        weight_reading = round(
            self._weight_value + random.gauss(0, w.noise_std), 2
        )

        # GPS (behavior-independent)
        self._gps_lat += random.uniform(-GPS_DRIFT_RANGE, GPS_DRIFT_RANGE)
        self._gps_lon += random.uniform(-GPS_DRIFT_RANGE, GPS_DRIFT_RANGE)

        return {
            "behavior": p.name,
            "alert_level": p.alert_level,
            "temperature": {
                "value": temp_reading,
                "unit": t.unit,
            },
            "humidity": {
                "value": humidity_reading,
                "unit": h.unit,
            },
            "weight": {
                "value": weight_reading,
                "unit": w.unit,
            },
            "gps": {
                "lat": round(self._gps_lat, 6),
                "lon": round(self._gps_lon, 6),
            },
            "timestamp": now,
        }

    # ── helpers ────────────────────────────────────────────────

    @staticmethod
    def _iso_now() -> str:
        """Return the current UTC time in ISO-8601 format."""
        return datetime.now(timezone.utc).isoformat()
