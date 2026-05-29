/**
 * useMqttSensors — React hook that receives real-time temperature
 * and humidity data via SSE from the Vite MQTT bridge (which subscribes
 * to Mosquitto over TCP on port 1883).
 *
 * The Vite plugin subscribes to:
 *   temperatureData/{hiveId}
 *   humidityData/{hiveId}
 *
 * Weight comes from the REST API, not MQTT.
 */
import { useState, useEffect, useRef } from 'react';

export default function useMqttSensors(hiveId) {
  const [liveTemp, setLiveTemp] = useState(null);
  const [liveHumid, setLiveHumid] = useState(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    if (!hiveId) return;

    const es = new EventSource('/api/mqtt-stream');
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const { hiveId: msgHiveId, sensor, value } = JSON.parse(event.data);

        // Only process messages for our hive
        if (msgHiveId !== hiveId) return;

        if (sensor === 'temperatureData') {
          setLiveTemp(value);
        } else if (sensor === 'humidityData') {
          setLiveHumid(value);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [hiveId]);

  return { liveTemp, liveHumid, connected };
}
