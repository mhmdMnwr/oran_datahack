"""
Telemetry publisher for the Smart Hive system.

Periodically generates sensor readings via :class:`SensorSimulator`
and publishes them to the MQTT broker on a threaded timer.
"""

import logging
import threading
from typing import Optional

from broker import BrokerClient
from config import (
    PUBLISH_INTERVAL,
    TOPIC_GPS,
    TOPIC_HUMIDITY,
    TOPIC_TEMPERATURE,
    TOPIC_WEIGHT,
)
from simulator import SensorSimulator

logger = logging.getLogger(__name__)

# Map sensor names → MQTT topics
_SENSOR_TOPIC_MAP: dict[str, str] = {
    "temperature": TOPIC_TEMPERATURE,
    "humidity": TOPIC_HUMIDITY,
    "gps": TOPIC_GPS,
    "weight": TOPIC_WEIGHT,
}


class TelemetryPublisher:
    """Publishes all four sensor readings every ``PUBLISH_INTERVAL`` seconds.

    Uses :class:`threading.Timer` so the main thread remains free for
    other work (e.g. the subscriber).  Call :meth:`start` to begin and
    :meth:`stop` to cancel gracefully.
    """

    def __init__(self, broker: BrokerClient) -> None:
        """Create a publisher bound to *broker*.

        Args:
            broker: An already-connected :class:`BrokerClient`.
        """
        self._broker: BrokerClient = broker
        self._simulator: SensorSimulator = SensorSimulator()
        self._timer: Optional[threading.Timer] = None
        self._running: bool = False
        self._lock: threading.Lock = threading.Lock()
        self._publish_count: int = 0

    # ── public API ─────────────────────────────────────────────

    @property
    def running(self) -> bool:
        """Return ``True`` if the publisher loop is active."""
        return self._running

    @property
    def publish_count(self) -> int:
        """Total number of individual messages published so far."""
        return self._publish_count

    def start(self) -> None:
        """Begin the periodic publish loop."""
        with self._lock:
            if self._running:
                logger.warning("Publisher is already running.")
                return
            self._running = True
        logger.info(
            "🚀 Publisher started (interval=%ds)", PUBLISH_INTERVAL
        )
        self._schedule_next()

    def stop(self) -> None:
        """Cancel the publish loop."""
        with self._lock:
            self._running = False
            if self._timer is not None:
                self._timer.cancel()
                self._timer = None
        logger.info(
            "🛑 Publisher stopped after %d messages.", self._publish_count
        )

    def publish_all(self) -> None:
        """Generate and publish one reading for every sensor."""
        if not self._broker.connected:
            logger.warning("Broker not connected — skipping publish cycle.")
            return

        for sensor_name, topic in _SENSOR_TOPIC_MAP.items():
            try:
                payload = self._simulator.generate(sensor_name)
                self._broker.publish(topic, payload)
                self._publish_count += 1
                logger.info(
                    "📤 [%s] %s",
                    sensor_name.upper(),
                    _format_short(payload),
                )
            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "Failed to publish %s: %s", sensor_name, exc
                )

    # ── internals ──────────────────────────────────────────────

    def _schedule_next(self) -> None:
        """Schedule the next publish cycle if still running."""
        with self._lock:
            if not self._running:
                return
            self._timer = threading.Timer(
                PUBLISH_INTERVAL, self._tick
            )
            self._timer.daemon = True
            self._timer.start()

    def _tick(self) -> None:
        """Execute one publish cycle and reschedule."""
        self.publish_all()
        self._schedule_next()


def _format_short(payload: dict) -> str:
    """Return a human-friendly one-liner for a sensor payload."""
    sensor = payload.get("sensor", "?")
    if sensor == "gps":
        return f"lat={payload['lat']}, lon={payload['lon']}"
    return f"{payload.get('value', '?')} {payload.get('unit', '')}"
