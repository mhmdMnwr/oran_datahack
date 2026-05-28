# 🐝 Smart Hive Monitoring System

A full-stack IoT beehive monitoring system with simulated telemetry, an MQTT broker pipeline, and a live browser dashboard.

## Architecture

```
┌──────────────┐     MQTT      ┌──────────────────┐     MQTT/WS     ┌─────────────┐
│  Simulator   │──────────────▶│  HiveMQ Broker   │◀───────────────▶│  Dashboard  │
│  (Python)    │  publish      │  (Public Cloud)  │   subscribe     │  (Browser)  │
└──────────────┘               └──────────────────┘                 └─────────────┘
```

## MQTT Topics

| Sensor      | Topic                      | Payload Example                        |
|-------------|----------------------------|----------------------------------------|
| Temperature | `hive/sensors/temperature` | `{"sensor":"temperature","value":35.4,"unit":"°C","timestamp":"..."}` |
| Humidity    | `hive/sensors/humidity`    | `{"sensor":"humidity","value":65.2,"unit":"%","timestamp":"..."}` |
| Weight      | `hive/sensors/weight`      | `{"sensor":"weight","value":32.1,"unit":"kg","timestamp":"..."}` |
| GPS         | `hive/sensors/gps`         | `{"sensor":"gps","lat":36.7538,"lon":3.0588,"timestamp":"..."}` |

## Quick Start

### 1. Install Python dependencies

```bash
cd smart-hive
pip install -r requirements.txt
```

### 2. Run the server

```bash
cd server
python main.py
```

This will:
- Connect to the public HiveMQ broker (`broker.hivemq.com:1883`)
- Start publishing simulated sensor data every 2 seconds
- Subscribe and display incoming data with colour-coded output

### 3. Open the dashboard

Simply open `dashboard/index.html` in any modern browser. No build step or Node.js required.

The dashboard connects to the same public HiveMQ broker via WebSocket (`ws://broker.hivemq.com:8000/mqtt`) and displays live sensor data.

> **Note:** The dashboard works independently of the Python server. It can publish its own simulated data directly from the browser using the control panel buttons.

## Alert Thresholds

| Condition              | Level   | Trigger                     |
|------------------------|---------|-----------------------------|
| Temperature > 40°C     | 🔴 ALERT   | Overheating risk         |
| Humidity > 85%         | 🟡 WARNING | Excess moisture          |
| Weight drop > 5kg      | 🔴 SWARM   | Possible swarm departure |

## Broker Info

This project uses **broker.hivemq.com**, a free public MQTT broker. No authentication is required. For production use, switch to a private broker and update `server/config.py`.

## Project Structure

```
smart-hive/
├── dashboard/
│   └── index.html          # Browser dashboard (standalone)
├── server/
│   ├── main.py             # Entry point
│   ├── broker.py           # MQTT client wrapper
│   ├── simulator.py        # Sensor data generation
│   ├── publisher.py        # Periodic telemetry publishing
│   ├── subscriber.py       # Message receiving & logging
│   └── config.py           # Constants & configuration
├── requirements.txt
└── README.md
```
