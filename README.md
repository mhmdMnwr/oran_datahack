# 🐝 Oran Data Hack - Smart Hive Monitoring

<div align="center">
  <img src="figure1.jpg" alt="Smart hive dashboard overview" width="900" />
</div>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  <img alt="MQTT" src="https://img.shields.io/badge/MQTT-3C5280?style=for-the-badge&logo=mqtt&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
</p>

This project presents a smart beehive monitoring system designed to track hive health in real time. It combines simulated IoT telemetry, MQTT-based messaging, and interactive dashboards to help beekeepers monitor temperature, humidity, weight, honey fill, and GPS activity across multiple hives.

## 🌟 Project idea

The system models a modern precision-beekeeping solution where each hive sends live telemetry to the cloud and dashboards. The goal is to detect abnormal conditions early, reduce colony losses, and provide a clear operational picture from both a farm and geographic perspective.

## 🧩 Main components

- [smart-hive/server/main.py](smart-hive/server/main.py): Python simulator that generates synthetic hive telemetry and publishes it through the MQTT pipeline.
- [smart-hive/dashboard/index.html](smart-hive/dashboard/index.html): Standalone browser dashboard that connects to the public MQTT broker via WebSocket.
- [dashboard/src/App.jsx](dashboard/src/App.jsx): React dashboard with a 3D farm view and map-based hive tracking.

## 🔄 Conceptual data flow

Sensors or simulator → MQTT broker → web dashboards

## 📊 Project highlights

- Real-time hive monitoring for key environmental metrics
- Multi-hive farm overview and geographic map view
- Early warnings for overheating, excessive moisture, and swarm risk
- End-to-end data path from telemetry generation to live visualization

## 🖼️ Figures

<table>
  <tr>
    <td align="center"><img src="figure1.jpg" alt="Figure 1" width="420" /></td>
    <td align="center"><img src="figure2.jpg" alt="Figure 2" width="420" /></td>
  </tr>
  <tr>
    <td align="center"><img src="figure3.jpg" alt="Figure 3" width="420" /></td>
    <td align="center"><img src="figure4.jpg" alt="Figure 4" width="420" /></td>
  </tr>
</table>

## 🏗️ Architecture overview

```text
┌──────────────┐     MQTT      ┌──────────────────┐     MQTT/WS     ┌─────────────┐
│  Simulator   │──────────────▶│  HiveMQ Broker    │◀───────────────▶│  Dashboard  │
│  (Python)    │  publish      │  (Public Cloud)   │   subscribe     │  (Browser)  │
└──────────────┘               └──────────────────┘                 └─────────────┘
```

## 🚀 Setup references

- [smart-hive/README.md](smart-hive/README.md) for the Python pipeline and standalone dashboard
- [dashboard/README.md](dashboard/README.md) for the React app setup and usage

## 🐝 About the system

This repository demonstrates how Internet of Things data can be collected, transmitted, and displayed in a meaningful way for agricultural monitoring. It combines simulation, cloud messaging, and web-based visualization to create a complete smart-farming concept centered on hive health and decision support.
