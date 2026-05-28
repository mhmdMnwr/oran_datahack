"""
MQTT broker connection wrapper for the Smart Hive system.

Provides a high-level `BrokerClient` that handles connection,
reconnection, publishing, and subscribing via ``paho-mqtt``.
"""

import json
import logging
import time
from typing import Any, Callable, Optional

import paho.mqtt.client as mqtt

from config import BROKER_HOST, BROKER_KEEPALIVE, BROKER_PORT, CLIENT_ID_PREFIX

logger = logging.getLogger(__name__)


class BrokerClient:
    """Thread-safe MQTT client with automatic reconnection.

    Wraps :class:`paho.mqtt.client.Client` and exposes simple
    ``connect``, ``disconnect``, ``publish``, and ``subscribe`` methods.
    """

    def __init__(self, client_id_suffix: str = "main") -> None:
        """Create a new broker client.

        Args:
            client_id_suffix: Appended to the base client-ID prefix
                so that multiple clients in the same process get unique IDs.
        """
        client_id = f"{CLIENT_ID_PREFIX}-{client_id_suffix}"
        self._client: mqtt.Client = mqtt.Client(
            client_id=client_id,
            protocol=mqtt.MQTTv311,
        )
        self._connected: bool = False
        self._reconnect_delay: float = 1.0
        self._max_reconnect_delay: float = 30.0

        # Internal callbacks
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._client.on_log = self._on_log

    # ── public API ─────────────────────────────────────────────

    @property
    def connected(self) -> bool:
        """Return ``True`` if the client is currently connected."""
        return self._connected

    def connect(self) -> None:
        """Connect to the MQTT broker and start the network loop.

        Retries with exponential back-off until the connection succeeds.
        """
        while not self._connected:
            try:
                logger.info(
                    "Connecting to %s:%d …", BROKER_HOST, BROKER_PORT
                )
                self._client.connect(
                    BROKER_HOST, BROKER_PORT, keepalive=BROKER_KEEPALIVE
                )
                self._client.loop_start()
                # Give time for the on_connect callback to fire
                for _ in range(50):
                    if self._connected:
                        break
                    time.sleep(0.1)
                if self._connected:
                    self._reconnect_delay = 1.0
                    break
            except (OSError, mqtt.WebsocketConnectionError) as exc:
                logger.warning(
                    "Connection failed (%s). Retrying in %.0fs …",
                    exc,
                    self._reconnect_delay,
                )
                time.sleep(self._reconnect_delay)
                self._reconnect_delay = min(
                    self._reconnect_delay * 2, self._max_reconnect_delay
                )

    def disconnect(self) -> None:
        """Gracefully disconnect from the broker."""
        logger.info("Disconnecting from broker …")
        self._client.loop_stop()
        self._client.disconnect()
        self._connected = False

    def publish(self, topic: str, payload: dict[str, Any]) -> None:
        """Publish a JSON-encoded message to *topic*.

        Args:
            topic: The MQTT topic string.
            payload: A JSON-serialisable dictionary.
        """
        message = json.dumps(payload)
        result = self._client.publish(topic, message, qos=1)
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            logger.error("Publish to %s failed (rc=%d)", topic, result.rc)
        else:
            logger.debug("Published to %s: %s", topic, message)

    def subscribe(
        self,
        topic: str,
        callback: Callable[[str, dict[str, Any]], None],
    ) -> None:
        """Subscribe to *topic* and register a message callback.

        Args:
            topic: Topic filter (wildcards allowed).
            callback: Called with ``(topic, payload_dict)`` on each message.
        """
        def _on_message(
            _client: mqtt.Client,
            _userdata: Optional[Any],
            msg: mqtt.MQTTMessage,
        ) -> None:
            try:
                data = json.loads(msg.payload.decode("utf-8"))
                callback(msg.topic, data)
            except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                logger.warning("Bad message on %s: %s", msg.topic, exc)

        self._client.subscribe(topic, qos=1)
        self._client.on_message = _on_message
        logger.info("Subscribed to %s", topic)

    # ── internal callbacks ─────────────────────────────────────

    def _on_connect(
        self,
        _client: mqtt.Client,
        _userdata: Optional[Any],
        _flags: dict[str, int],
        rc: int,
    ) -> None:
        """Handle successful broker connection."""
        if rc == 0:
            self._connected = True
            logger.info(
                "✅ Connected to %s:%d", BROKER_HOST, BROKER_PORT
            )
        else:
            logger.error("Connection refused (rc=%d)", rc)

    def _on_disconnect(
        self,
        _client: mqtt.Client,
        _userdata: Optional[Any],
        rc: int,
    ) -> None:
        """Handle unexpected disconnection."""
        self._connected = False
        if rc != 0:
            logger.warning(
                "⚠️  Unexpected disconnect (rc=%d). Will auto-reconnect.", rc
            )

    @staticmethod
    def _on_log(
        _client: mqtt.Client,
        _userdata: Optional[Any],
        level: int,
        buf: str,
    ) -> None:
        """Forward paho internal logs at DEBUG level."""
        if level == mqtt.MQTT_LOG_ERR:
            logger.error("[paho] %s", buf)
        else:
            logger.debug("[paho] %s", buf)
