# Oran Data Hack - Smart Hive Monitoring

## Project idea
This project demonstrates a smart beehive monitoring system that streams hive telemetry
(temperature, humidity, weight, honey fill, and GPS) to live dashboards. The goal is
to help beekeepers track hive health, spot risks early, and manage multiple hives from
both a farm view and a map view.

## Components
- [smart-hive/server/main.py](smart-hive/server/main.py): Python simulator and MQTT
  publisher/subscriber pipeline that generates synthetic hive telemetry.
- [smart-hive/dashboard/index.html](smart-hive/dashboard/index.html): Static dashboard
  that connects to the public MQTT broker over WebSocket.
- [dashboard/src/App.jsx](dashboard/src/App.jsx): React/Vite dashboard with a 3D farm
  scene and a map view (currently uses locally simulated data).

## Conceptual data flow
Sensors or simulator -> MQTT broker -> web dashboards.

## Setup references
- [smart-hive/README.md](smart-hive/README.md) for the Python pipeline and static
  dashboard.
- [dashboard/README.md](dashboard/README.md) for the React app.
# oran_datahack
