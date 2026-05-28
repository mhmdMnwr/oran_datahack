"""
Smart Hive Monitoring System — Entry Point.

Starts the MQTT broker connection, telemetry publisher, and subscriber.
Handles graceful shutdown on Ctrl+C / SIGINT.
"""

import logging
import signal
import sys
import time

from broker import BrokerClient
from publisher import TelemetryPublisher
from subscriber import TelemetrySubscriber

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

BANNER = r"""
    ██╗  ██╗██╗██╗   ██╗███████╗
    ██║  ██║██║██║   ██║██╔════╝
    ███████║██║██║   ██║█████╗
    ██╔══██║██║╚██╗ ██╔╝██╔══╝
    ██║  ██║██║ ╚████╔╝ ███████╗
    ╚═╝  ╚═╝╚═╝  ╚═══╝  ╚══════╝
    ╔═══════════════════════════════╗
    ║  🐝 SMART HIVE MONITOR v1.0  ║
    ║  IoT Telemetry Pipeline      ║
    ╚═══════════════════════════════╝
"""


def main() -> None:
    """Boot all services and block until interrupted."""
    print(BANNER)

    # 1. Connect to MQTT broker
    logger.info("Initialising broker connections …")
    pub_broker = BrokerClient(client_id_suffix="publisher")
    sub_broker = BrokerClient(client_id_suffix="subscriber")
    pub_broker.connect()
    sub_broker.connect()

    # 2. Start subscriber (must be before publisher so we catch messages)
    subscriber = TelemetrySubscriber(sub_broker)
    subscriber.start()

    # 3. Start publisher
    publisher = TelemetryPublisher(pub_broker)
    publisher.start()

    # 4. Graceful shutdown handler
    shutdown_requested = False

    def _shutdown(signum: int, _frame: object) -> None:
        nonlocal shutdown_requested
        if shutdown_requested:
            return
        shutdown_requested = True
        print("\n")
        logger.info("Shutting down …")
        publisher.stop()
        pub_broker.disconnect()
        sub_broker.disconnect()
        logger.info(
            "📊 Stats: %d messages published, %d received.",
            publisher.publish_count,
            subscriber.message_count,
        )
        logger.info("Goodbye! 🐝")
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    logger.info("System running. Press Ctrl+C to stop.\n")

    # Keep main thread alive
    while True:
        time.sleep(1)


if __name__ == "__main__":
    main()
