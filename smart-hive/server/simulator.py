"""
Sensor data simulation engine for the Smart Hive system.

Generates realistic telemetry readings for temperature, humidity,
weight, and GPS sensors with Gaussian noise and gradual drift.
"""

import random
from datetime import datetime, timezone
from typing import Any

from config import (
    GPS_BASE_LAT,
    GPS_BASE_LON,
    GPS_DRIFT_RANGE,
    SENSOR_RANGES,
)


class SensorSimulator:
    """Generates realistic simulated sensor data for a beehive.

    Each call to `generate()` produces a JSON-serializable dict with
    sensor name, value(s), unit, and ISO-8601 timestamp.  GPS readings
    include cumulative drift so the hive location "wanders" naturally.
    Weight accumulates slowly to simulate honey production.
    """

    def __init__(self) -> None:
        """Initialise the simulator with base GPS position and weight."""
        self._gps_lat: float = GPS_BASE_LAT
        self._gps_lon: float = GPS_BASE_LON
        self._current_weight: float = random.uniform(
            SENSOR_RANGES["weight"]["min"],
            SENSOR_RANGES["weight"]["min"] + 10.0,
        )
        # Slow trend trackers for realistic time-series behaviour
        self._temp_trend: float = random.uniform(
            SENSOR_RANGES["temperature"]["min"],
            SENSOR_RANGES["temperature"]["max"],
        )
        self._humidity_trend: float = random.uniform(
            SENSOR_RANGES["humidity"]["min"],
            SENSOR_RANGES["humidity"]["max"],
        )

    # ── public API ─────────────────────────────────────────────

    def generate(self, sensor_name: str) -> dict[str, Any]:
        """Generate a single telemetry reading for *sensor_name*.

        Args:
            sensor_name: One of ``'temperature'``, ``'humidity'``,
                         ``'weight'``, or ``'gps'``.

        Returns:
            A dictionary suitable for JSON serialisation.

        Raises:
            ValueError: If *sensor_name* is not recognised.
        """
        if sensor_name == "gps":
            return self._generate_gps()

        if sensor_name not in SENSOR_RANGES:
            raise ValueError(f"Unknown sensor: {sensor_name}")

        generator_map = {
            "temperature": self._generate_temperature,
            "humidity": self._generate_humidity,
            "weight": self._generate_weight,
        }
        return generator_map[sensor_name]()

    # ── private generators ─────────────────────────────────────

    def _generate_temperature(self) -> dict[str, Any]:
        """Simulate internal hive temperature with Gaussian noise."""
        cfg = SENSOR_RANGES["temperature"]
        # Random-walk the trend
        self._temp_trend += random.gauss(0, 0.1)
        self._temp_trend = max(cfg["min"], min(cfg["max"], self._temp_trend))
        value = round(self._temp_trend + random.gauss(0, cfg["noise_std"]), 2)
        value = max(cfg["min"] - 1.0, min(cfg["max"] + 1.0, value))
        return {
            "sensor": "temperature",
            "value": value,
            "unit": cfg["unit"],
            "timestamp": self._iso_now(),
        }

    def _generate_humidity(self) -> dict[str, Any]:
        """Simulate relative humidity inside the hive."""
        cfg = SENSOR_RANGES["humidity"]
        self._humidity_trend += random.gauss(0, 0.5)
        self._humidity_trend = max(cfg["min"], min(cfg["max"], self._humidity_trend))
        value = round(self._humidity_trend + random.gauss(0, cfg["noise_std"]), 2)
        value = max(cfg["min"] - 5.0, min(cfg["max"] + 5.0, value))
        return {
            "sensor": "humidity",
            "value": value,
            "unit": cfg["unit"],
            "timestamp": self._iso_now(),
        }

    def _generate_weight(self) -> dict[str, Any]:
        """Simulate hive weight with slow honey accumulation."""
        cfg = SENSOR_RANGES["weight"]
        # Honey accumulates slowly: +0.01–0.05 kg per reading
        self._current_weight += random.uniform(0.01, 0.05)
        self._current_weight = min(cfg["max"], self._current_weight)
        value = round(
            self._current_weight + random.gauss(0, cfg["noise_std"]), 2
        )
        return {
            "sensor": "weight",
            "value": value,
            "unit": cfg["unit"],
            "timestamp": self._iso_now(),
        }

    def _generate_gps(self) -> dict[str, Any]:
        """Simulate GPS with minor drift each cycle."""
        self._gps_lat += random.uniform(-GPS_DRIFT_RANGE, GPS_DRIFT_RANGE)
        self._gps_lon += random.uniform(-GPS_DRIFT_RANGE, GPS_DRIFT_RANGE)
        return {
            "sensor": "gps",
            "lat": round(self._gps_lat, 6),
            "lon": round(self._gps_lon, 6),
            "timestamp": self._iso_now(),
        }

    # ── helpers ────────────────────────────────────────────────

    @staticmethod
    def _iso_now() -> str:
        """Return the current UTC time in ISO-8601 format."""
        return datetime.now(timezone.utc).isoformat()
