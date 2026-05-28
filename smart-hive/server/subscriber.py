"""
Telemetry subscriber for the Smart Hive system.

Subscribes to the hive/sensors/# wildcard topic, pretty-prints
incoming messages with colour coding, and retains the last N messages
in an in-memory ring buffer.
"""

import collections
import logging
from datetime import datetime
from typing import Any

from colorama import Fore, Style, init as colorama_init

from broker import BrokerClient
from config import (
    ALERT_HUMIDITY_HIGH,
    ALERT_TEMP_HIGH,
    ALERT_WEIGHT_DROP,
    MAX_MESSAGES_IN_MEMORY,
    TOPIC_WILDCARD,
)

logger = logging.getLogger(__name__)
colorama_init(autoreset=True)

_SENSOR_COLOURS: dict[str, str] = {
    "temperature": Fore.RED,
    "humidity": Fore.CYAN,
    "weight": Fore.YELLOW,
    "gps": Fore.GREEN,
}


class TelemetrySubscriber:
    """Receives MQTT telemetry, logs it with colour, and stores history."""

    def __init__(self, broker: BrokerClient) -> None:
        self._broker: BrokerClient = broker
        self._history: collections.deque[dict[str, Any]] = collections.deque(
            maxlen=MAX_MESSAGES_IN_MEMORY
        )
        self._last_weight: float | None = None
        self._message_count: int = 0

    @property
    def history(self) -> list[dict[str, Any]]:
        return list(self._history)

    @property
    def message_count(self) -> int:
        return self._message_count

    def start(self) -> None:
        self._broker.subscribe(TOPIC_WILDCARD, self._on_message)
        logger.info("Subscriber listening on %s", TOPIC_WILDCARD)

    def _on_message(self, topic: str, data: dict[str, Any]) -> None:
        self._message_count += 1
        self._history.append({"topic": topic, **data})
        sensor = data.get("sensor", "unknown")
        colour = _SENSOR_COLOURS.get(sensor, Fore.WHITE)
        ts = data.get("timestamp", "N/A")
        if sensor == "gps":
            val = f"lat={data.get('lat')}, lon={data.get('lon')}"
        else:
            val = f"{data.get('value', '?')} {data.get('unit', '')}"
        alert = self._check_alerts(sensor, data)
        short_t = _parse_time(ts)
        print(
            f"  {colour}▌ {Style.BRIGHT}{sensor.upper():>12}{Style.RESET_ALL}"
            f"  {colour}{val:<20}{Style.RESET_ALL}"
            f"  {Fore.LIGHTBLACK_EX}{short_t}{Style.RESET_ALL}"
            f"  {alert}"
        )

    def _check_alerts(self, sensor: str, data: dict[str, Any]) -> str:
        alerts: list[str] = []
        if sensor == "temperature":
            v = data.get("value", 0)
            if v > ALERT_TEMP_HIGH:
                alerts.append(f"{Fore.RED}{Style.BRIGHT}🔴 ALERT: Temp {v}°C{Style.RESET_ALL}")
        elif sensor == "humidity":
            v = data.get("value", 0)
            if v > ALERT_HUMIDITY_HIGH:
                alerts.append(f"{Fore.YELLOW}{Style.BRIGHT}🟡 WARNING: Humidity {v}%{Style.RESET_ALL}")
        elif sensor == "weight":
            v = data.get("value", 0)
            if self._last_weight is not None:
                drop = self._last_weight - v
                if drop > ALERT_WEIGHT_DROP:
                    alerts.append(f"{Fore.RED}{Style.BRIGHT}🔴 SWARM ALERT: Weight dropped {drop:.1f}kg{Style.RESET_ALL}")
            self._last_weight = v
        return " ".join(alerts)


def _parse_time(iso_str: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_str)
        return dt.strftime("%H:%M:%S")
    except (ValueError, TypeError):
        return iso_str[:19] if len(iso_str) >= 19 else iso_str
