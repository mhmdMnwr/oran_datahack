"""
Configuration constants for the Smart Hive Monitoring System.

Contains MQTT broker settings, topic definitions, publish intervals,
sensor ranges, and alert thresholds used across all server modules.
"""

# ──────────────────────────────────────────────
# MQTT Broker Configuration
# ──────────────────────────────────────────────
BROKER_HOST: str = "localhost"
BROKER_PORT: int = 1883
BROKER_KEEPALIVE: int = 60
CLIENT_ID_PREFIX: str = "smart-hive"

# ──────────────────────────────────────────────
# Publish Interval (seconds)
# ──────────────────────────────────────────────
PUBLISH_INTERVAL: int = 2

# ──────────────────────────────────────────────
# MQTT Topics
# ──────────────────────────────────────────────
TOPIC_TEMPERATURE: str = "hive/sensors/temperature"
TOPIC_HUMIDITY: str = "hive/sensors/humidity"
TOPIC_GPS: str = "hive/sensors/gps"
TOPIC_WEIGHT: str = "hive/sensors/weight"
TOPIC_WILDCARD: str = "hive/sensors/#"

ALL_TOPICS: list[str] = [
    TOPIC_TEMPERATURE,
    TOPIC_HUMIDITY,
    TOPIC_GPS,
    TOPIC_WEIGHT,
]

# ──────────────────────────────────────────────
# Sensor Realistic Ranges
# ──────────────────────────────────────────────
SENSOR_RANGES: dict[str, dict] = {
    "temperature": {
        "min": 32.0,
        "max": 38.0,
        "unit": "°C",
        "noise_std": 0.3,
    },
    "humidity": {
        "min": 50.0,
        "max": 80.0,
        "unit": "%",
        "noise_std": 1.5,
    },
    "weight": {
        "min": 20.0,
        "max": 60.0,
        "unit": "kg",
        "noise_std": 0.2,
    },
}

# ──────────────────────────────────────────────
# GPS Configuration
# ──────────────────────────────────────────────
GPS_BASE_LAT: float = 36.7538
GPS_BASE_LON: float = 3.0588
GPS_DRIFT_RANGE: float = 0.0001  # ± degrees per cycle

# ──────────────────────────────────────────────
# Alert Thresholds
# ──────────────────────────────────────────────
ALERT_TEMP_HIGH: float = 40.0       # °C → ALERT
ALERT_HUMIDITY_HIGH: float = 85.0   # %  → WARNING
ALERT_WEIGHT_DROP: float = 5.0      # kg → SWARM ALERT

# ──────────────────────────────────────────────
# Subscriber Memory
# ──────────────────────────────────────────────
MAX_MESSAGES_IN_MEMORY: int = 100
