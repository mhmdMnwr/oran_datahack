import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mqtt from 'mqtt'

/**
 * Vite plugin: MQTT → SSE bridge
 *
 * Subscribes to temperatureData/*, humidityData/*, weightData/*
 * on the local Mosquitto broker (TCP 1883) and streams updates
 * to the browser via Server-Sent Events at /api/mqtt-stream.
 */
function mqttBridge() {
  // Latest values per hive: { "hive-id": { temp, humid, weight } }
  const latestData = {};
  // SSE clients
  const sseClients = new Set();

  return {
    name: 'mqtt-bridge',
    configureServer(server) {
      // Connect to Mosquitto over TCP
      const client = mqtt.connect('mqtt://localhost:1883', {
        clientId: `vite-mqtt-bridge-${Date.now()}`,
        clean: true,
        reconnectPeriod: 3000,
      });

      client.on('connect', () => {
        console.log('  ✅ MQTT bridge connected to localhost:1883');
        client.subscribe('temperatureData/#');
        client.subscribe('humidityData/#');
      });

      client.on('message', (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          const value = data.value;
          if (typeof value !== 'number') return;

          // Parse topic: "temperatureData/HIVE_ID"
          const parts = topic.split('/');
          const sensorType = parts[0]; // temperatureData, humidityData, weightData
          const hiveId = parts.slice(1).join('/'); // everything after first /

          if (!latestData[hiveId]) {
            latestData[hiveId] = {};
          }

          if (sensorType === 'temperatureData') {
            latestData[hiveId].temp = value;
          } else if (sensorType === 'humidityData') {
            latestData[hiveId].humid = value;
          }

          // Push to all SSE clients
          const event = JSON.stringify({ hiveId, sensor: sensorType, value });
          for (const res of sseClients) {
            res.write(`data: ${event}\n\n`);
          }
        } catch {
          // ignore non-JSON
        }
      });

      client.on('error', (err) => {
        console.warn('  ⚠️  MQTT bridge error:', err.message);
      });

      // SSE endpoint: /api/mqtt-stream
      server.middlewares.use('/api/mqtt-stream', (req, res) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.write('\n');

        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
      });

      // REST endpoint: /api/mqtt-latest/:hiveId
      server.middlewares.use('/api/mqtt-latest', (req, res) => {
        const hiveId = decodeURIComponent(req.url.replace(/^\//, ''));
        const data = latestData[hiveId] || {};
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mqttBridge()],
})
