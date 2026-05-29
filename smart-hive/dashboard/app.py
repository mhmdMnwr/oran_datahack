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

from flask import Flask, jsonify, request, render_template

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
app = Flask(__name__, template_folder="templates")

# ── Constants ─────────────────────────────────────────────
HIVE_IDS = [
    "00:1A:7D:DA:71:13",
    "00:1A:7D:DA:71:14",
    "00:1A:7D:DA:71:15",
    "00:1A:7D:DA:71:16",
    "00:1A:7D:DA:71:17",
    "00:1A:7D:DA:71:18",
    "00:1A:7D:DA:71:19",
    "00:1A:7D:DA:71:1A",
]
PUBLISH_INTERVAL = 2
MAX_CHART_POINTS = 30
MAX_ALERTS = 50

# ── Per-Hive State ────────────────────────────────────────
hive_scenarios = {}      # hive_id -> scenario name
hive_sim_values = {}     # hive_id -> {temperature, humidity, weight, population}
hive_latest_data = {}    # hive_id -> formatted data dict
hive_chart_history = {}  # hive_id -> {labels, temperature, humidity}
alerts = []
sim_running = True

# MQTT Client
mqtt_client = BrokerClient(client_id_suffix="dashboard-app")
mqtt_connected = False


def _init_hives():
    """Initialise state for every hive."""
    for hive_id in HIVE_IDS:
        hive_scenarios[hive_id] = "normal"
        behavior = get_behavior("normal")
        hive_sim_values[hive_id] = {
            "temperature": random.uniform(behavior.temperature.min, behavior.temperature.max),
            "humidity": random.uniform(behavior.humidity.min, behavior.humidity.max),
            "weight": random.uniform(25, 40),
            "population": random.uniform(behavior.population.min, behavior.population.max),
        }
        hive_latest_data[hive_id] = {}
        hive_chart_history[hive_id] = {"labels": [], "temperature": [], "humidity": []}

_init_hives()


# ── Simulation Logic ─────────────────────────────────────

def simulate_tick():
    """Generate one tick of simulated sensor data for ALL hives."""
    ts = datetime.now().strftime("%H:%M:%S")

    for hive_id in HIVE_IDS:
        scenario_name = hive_scenarios[hive_id]
        behavior = get_behavior(scenario_name)
        sv = hive_sim_values[hive_id]

        # Update each sensor
        for sensor in ["temperature", "humidity", "weight", "population"]:
            profile = getattr(behavior, sensor)
            sv[sensor] += profile.trend
            sv[sensor] += random.gauss(0, profile.noise_std)
            sv[sensor] = max(profile.min, min(profile.max, sv[sensor]))

        hive_latest_data[hive_id] = {
            "temperature": {"value": round(sv["temperature"], 1), "unit": "°C", "timestamp": ts},
            "humidity":    {"value": round(sv["humidity"], 1),    "unit": "%",  "timestamp": ts},
            "weight":      {"value": round(sv["weight"], 2),     "unit": "kg", "timestamp": ts},
            "population":  {"value": int(sv["population"]),      "unit": "bees", "timestamp": ts},
            "scenario": scenario_name,
            "scenario_display": behavior.display_name,
            "alert_level": behavior.alert_level,
        }

        # Chart history
        ch = hive_chart_history[hive_id]
        ch["labels"].append(ts)
        ch["temperature"].append(round(sv["temperature"], 1))
        ch["humidity"].append(round(sv["humidity"], 1))
        while len(ch["labels"]) > MAX_CHART_POINTS:
            ch["labels"].pop(0); ch["temperature"].pop(0); ch["humidity"].pop(0)

        # Alerts
        _check_alerts(hive_id, behavior, sv)

        # Publish to MQTT
        if mqtt_connected:
            try:
                mqtt_client.publish(f"temperatureData/{hive_id}", {"value": round(sv["temperature"], 1)})
                mqtt_client.publish(f"humidityData/{hive_id}",    {"value": round(sv["humidity"], 1)})
                mqtt_client.publish(f"weightData/{hive_id}",      {"value": round(sv["weight"], 2)})
                mqtt_client.publish(f"populationData/{hive_id}",  {"value": int(sv["population"])})
            except Exception as e:
                logger.error("MQTT publish error for %s: %s", hive_id, e)


def _check_alerts(hive_id, behavior, sv):
    """Generate alerts based on current sensor values and scenario."""
    short_id = hive_id[-5:]
    if behavior.alert_level == "critical" and random.random() < 0.08:
        _add_alert("alert", f"[{short_id}] CRITICAL — {behavior.description}")
    elif behavior.alert_level == "warning" and random.random() < 0.06:
        _add_alert("warning", f"[{short_id}] WARNING — {behavior.description}")
    if sv["temperature"] > 40:
        _add_alert("alert", f"[{short_id}] Temp {sv['temperature']:.1f}°C exceeds 40°C")
    if sv["humidity"] > 85:
        _add_alert("warning", f"[{short_id}] Humidity {sv['humidity']:.1f}% exceeds 85%")


def _add_alert(level, msg):
    alerts.insert(0, {"level": level, "message": msg, "timestamp": datetime.now().strftime("%H:%M:%S")})
    while len(alerts) > MAX_ALERTS:
        alerts.pop()


def simulation_loop():
    logger.info("🚀 Simulation loop started (%d hives, interval=%ds)", len(HIVE_IDS), PUBLISH_INTERVAL)
    while True:
        if sim_running:
            simulate_tick()
        time.sleep(PUBLISH_INTERVAL)


# ── Routes ────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the dashboard HTML."""
    return render_template("index.html")


@app.route("/api/hives")
def get_hives():
    """Return list of all hive IDs."""
    return jsonify(HIVE_IDS)


@app.route("/api/data")
def get_data():
    """Return latest sensor data for a specific hive (or first hive by default)."""
    hive_id = request.args.get("hive", HIVE_IDS[0])
    if hive_id not in hive_latest_data:
        return jsonify({"error": f"Unknown hive: {hive_id}"}), 404
    data = hive_latest_data.get(hive_id, {})
    return jsonify({
        **data,
        "hive_id": hive_id,
        "chart": hive_chart_history.get(hive_id, {"labels": [], "temperature": [], "humidity": []}),
        "alerts": alerts[:20],
        "mqtt_connected": mqtt_connected,
    })


@app.route("/api/scenario", methods=["POST"])
def set_scenario():
    """Switch the scenario for a specific hive (or all hives)."""
    data = request.json
    name = data.get("scenario", "normal")
    hive_id = data.get("hive_id")  # optional — if not given, apply to all

    if name not in BEHAVIOR_REGISTRY:
        return jsonify({"error": f"Unknown scenario: {name}"}), 400

    behavior = get_behavior(name)
    targets = [hive_id] if hive_id and hive_id in hive_scenarios else HIVE_IDS

    for hid in targets:
        hive_scenarios[hid] = name
        sv = hive_sim_values[hid]
        sv["temperature"] = (behavior.temperature.min + behavior.temperature.max) / 2
        sv["humidity"]    = (behavior.humidity.min + behavior.humidity.max) / 2
        sv["weight"]      = (behavior.weight.min + behavior.weight.max) / 2
        sv["population"]  = (behavior.population.min + behavior.population.max) / 2

    scope = hive_id[-5:] if hive_id else "ALL"
    _add_alert("warning", f"[{scope}] Scenario → {behavior.display_name}")
    logger.info("🔄 Scenario → %s for %s", behavior.display_name, scope)

    return jsonify({
        "status": "ok", "scenario": name,
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


@app.route("/api/sounds")
def list_sounds():
    """Return list of available sound files in the sounds directory."""
    import wave as _wave
    sounds_dir = Path(SERVER_DIR) / "sounds"
    files = []
    for f in sorted(sounds_dir.glob("*.wav")):
        size_kb = f.stat().st_size / 1024
        # Get audio info
        try:
            with _wave.open(str(f), "rb") as wf:
                duration = wf.getnframes() / wf.getframerate()
                sample_rate = wf.getframerate()
        except Exception:
            duration = 0
            sample_rate = 0
        files.append({
            "filename": f.name,
            "size_kb": round(size_kb, 1),
            "duration_s": round(duration, 1),
            "sample_rate": sample_rate,
        })
    return jsonify(files)


@app.route("/api/send-audio", methods=["POST"])
def send_audio():
    """Send a sound file as raw audio bytes to a specified MQTT topic."""
    import wave as _wave
    import numpy as _np

    data = request.json
    filename = data.get("filename", "")
    topic = data.get("topic", "")

    if not filename or not topic:
        return jsonify({"error": "Both 'filename' and 'topic' are required"}), 400

    sounds_dir = Path(SERVER_DIR) / "sounds"
    filepath = sounds_dir / filename

    if not filepath.exists() or not filepath.is_file():
        return jsonify({"error": f"Sound file '{filename}' not found"}), 404

    try:
        with _wave.open(str(filepath), "rb") as wf:
            frames = wf.readframes(wf.getnframes())
            audio_array = _np.frombuffer(frames, dtype=_np.int16)
            payload = audio_array.tobytes()

        # Publish raw bytes to the specified MQTT topic
        if mqtt_connected:
            mqtt_client._client.publish(topic, payload, qos=0)
            _add_alert("warning", f"📤 Sent {len(payload):,} bytes of {filename} → {topic}")
            logger.info("📤 Sent %d bytes of %s → %s", len(payload), filename, topic)
            return jsonify({"status": "ok", "filename": filename, "topic": topic, "bytes_sent": len(payload)})
        else:
            return jsonify({"error": "MQTT not connected"}), 503
    except Exception as e:
        logger.error("Failed to send audio: %s", e)
        return jsonify({"error": str(e)}), 500


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
