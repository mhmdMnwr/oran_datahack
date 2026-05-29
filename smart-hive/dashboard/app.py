"""
Smart Hive Dashboard — Flask Application.

Serves the HTML dashboard and runs a background simulation loop
that generates sensor telemetry based on the active behavior scenario.
Publishes data to the local MQTT broker and exposes REST API endpoints
for the frontend to poll data and switch scenarios.

Usage:
    python3 app.py
    → Dashboard at http://localhost:5555
"""

import sys
import os
import json
import time
import random
import threading
import logging
from pathlib import Path
from datetime import datetime

from flask import Flask, jsonify, request, send_from_directory

# ── Add server directory to path for imports ──────────────
SERVER_DIR = str(Path(__file__).resolve().parent.parent / "server")
sys.path.insert(0, SERVER_DIR)

from behaviors import BEHAVIOR_REGISTRY, get_behavior
from broker import BrokerClient

# ── Logging ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Flask App ─────────────────────────────────────────────
app = Flask(__name__, static_folder=".", template_folder=".")

# ── Constants ─────────────────────────────────────────────
MAC_ADDRESS = "00:1A:7D:DA:71:13"
PUBLISH_INTERVAL = 2        # seconds between simulation ticks
MAX_CHART_POINTS = 30
MAX_ALERTS = 50

# ── Global State ──────────────────────────────────────────
current_scenario = "normal"
sim_running = True

# Live sensor values (floating state for smooth simulation)
sim_values = {
    "temperature": 35.0,
    "humidity": 60.0,
    "weight": 30.0,
    "population": 50000.0,
}

# Latest formatted data for the API
latest_data = {}

# Chart history
chart_history = {
    "labels": [],
    "temperature": [],
    "humidity": [],
}

# Alert log
alerts = []

# MQTT Client
mqtt_client = BrokerClient(client_id_suffix="dashboard-app")
mqtt_connected = False


# ── Simulation Logic ─────────────────────────────────────

def simulate_tick():
    """Generate one tick of simulated sensor data based on the active scenario."""
    global latest_data

    behavior = get_behavior(current_scenario)

    # Update each sensor value with trend + noise + clamping
    for sensor_name in ["temperature", "humidity", "weight", "population"]:
        profile = getattr(behavior, sensor_name)
        sim_values[sensor_name] += profile.trend
        sim_values[sensor_name] += random.gauss(0, profile.noise_std)
        sim_values[sensor_name] = max(profile.min, min(profile.max, sim_values[sensor_name]))

    ts = datetime.now().strftime("%H:%M:%S")

    latest_data = {
        "temperature": {"value": round(sim_values["temperature"], 1), "unit": "°C", "timestamp": ts},
        "humidity":    {"value": round(sim_values["humidity"], 1),    "unit": "%",  "timestamp": ts},
        "weight":      {"value": round(sim_values["weight"], 2),     "unit": "kg", "timestamp": ts},
        "population":  {"value": int(sim_values["population"]),      "unit": "bees", "timestamp": ts},
        "scenario": current_scenario,
        "scenario_display": behavior.display_name,
        "alert_level": behavior.alert_level,
    }

    # Update chart history
    chart_history["labels"].append(ts)
    chart_history["temperature"].append(round(sim_values["temperature"], 1))
    chart_history["humidity"].append(round(sim_values["humidity"], 1))

    while len(chart_history["labels"]) > MAX_CHART_POINTS:
        chart_history["labels"].pop(0)
        chart_history["temperature"].pop(0)
        chart_history["humidity"].pop(0)

    # Check for alert conditions
    _check_alerts(behavior)

    # Publish to MQTT
    if mqtt_connected:
        try:
            mqtt_client.publish(f"temperatureData/{MAC_ADDRESS}", {"value": latest_data["temperature"]["value"]})
            mqtt_client.publish(f"humidityData/{MAC_ADDRESS}",    {"value": latest_data["humidity"]["value"]})
            mqtt_client.publish(f"weightData/{MAC_ADDRESS}",      {"value": latest_data["weight"]["value"]})
            mqtt_client.publish(f"populationData/{MAC_ADDRESS}",  {"value": latest_data["population"]["value"]})
        except Exception as e:
            logger.error(f"MQTT publish error: {e}")


def _check_alerts(behavior):
    """Generate alerts based on current sensor values and scenario."""
    temp = sim_values["temperature"]
    humid = sim_values["humidity"]

    if behavior.alert_level == "critical" and random.random() < 0.15:
        _add_alert("alert", f"CRITICAL — {behavior.description}")
    elif behavior.alert_level == "warning" and random.random() < 0.1:
        _add_alert("warning", f"WARNING — {behavior.description}")

    if temp > 40:
        _add_alert("alert", f"Temperature {temp:.1f}°C exceeds safe threshold (40°C)")
    if humid > 85:
        _add_alert("warning", f"Humidity {humid:.1f}% exceeds safe threshold (85%)")


def _add_alert(level, msg):
    """Add an alert entry to the log."""
    alerts.insert(0, {
        "level": level,
        "message": msg,
        "timestamp": datetime.now().strftime("%H:%M:%S"),
    })
    while len(alerts) > MAX_ALERTS:
        alerts.pop()


def simulation_loop():
    """Background thread that runs the simulation continuously."""
    logger.info("🚀 Simulation loop started (interval=%ds)", PUBLISH_INTERVAL)
    while True:
        if sim_running:
            simulate_tick()
        time.sleep(PUBLISH_INTERVAL)


# ── Routes ────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the dashboard HTML."""
    return send_from_directory(".", "index.html")


@app.route("/api/data")
def get_data():
    """Return latest sensor data, chart history, and alerts."""
    return jsonify({
        **latest_data,
        "chart": chart_history,
        "alerts": alerts[:20],
        "mqtt_connected": mqtt_connected,
    })


@app.route("/api/scenario", methods=["POST"])
def set_scenario():
    """Switch the active simulation scenario."""
    global current_scenario

    data = request.json
    name = data.get("scenario", "normal")

    if name not in BEHAVIOR_REGISTRY:
        return jsonify({"error": f"Unknown scenario: {name}"}), 400

    behavior = get_behavior(name)
    current_scenario = name

    # Reset sensor values to the new behavior's midpoint
    sim_values["temperature"] = (behavior.temperature.min + behavior.temperature.max) / 2
    sim_values["humidity"]    = (behavior.humidity.min + behavior.humidity.max) / 2
    sim_values["weight"]      = (behavior.weight.min + behavior.weight.max) / 2
    sim_values["population"]  = (behavior.population.min + behavior.population.max) / 2

    _add_alert("warning", f"Scenario changed → {behavior.display_name}")
    logger.info("🔄 Scenario changed → %s", behavior.display_name)

    return jsonify({
        "status": "ok",
        "scenario": name,
        "display_name": behavior.display_name,
        "description": behavior.description,
        "alert_level": behavior.alert_level,
    })


@app.route("/api/scenarios")
def list_scenarios():
    """Return metadata for all available scenarios."""
    result = []
    for key, profile in BEHAVIOR_REGISTRY.items():
        result.append({
            "name": profile.name,
            "display_name": profile.display_name,
            "description": profile.description,
            "alert_level": profile.alert_level,
            "sound_file": profile.sound_file,
        })
    return jsonify(result)


# ── Entry Point ───────────────────────────────────────────

if __name__ == "__main__":
    print("""
    ╔═══════════════════════════════════════╗
    ║  🐝 SMART HIVE DASHBOARD  v2.0       ║
    ║  Python Flask + MQTT Telemetry       ║
    ╚═══════════════════════════════════════╝
    """)

    # Connect to MQTT broker
    try:
        mqtt_client.connect()
        mqtt_connected = True
        logger.info("✅ MQTT connected")
    except Exception as e:
        logger.warning("⚠️  MQTT connection failed: %s — running without MQTT", e)
        mqtt_connected = False

    # Start simulation thread
    sim_thread = threading.Thread(target=simulation_loop, daemon=True)
    sim_thread.start()

    logger.info("🌐 Dashboard → http://localhost:5555")
    app.run(host="0.0.0.0", port=5555, debug=False)
