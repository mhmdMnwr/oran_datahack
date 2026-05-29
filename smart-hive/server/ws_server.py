"""
WebSocket + HTTP server for the Smart Hive dashboard.

Runs a FastAPI application that:
  - Streams real-time sensor telemetry over WebSocket (``/ws``)
  - Accepts behavior-change commands via the same WebSocket
  - Serves sound files from ``/sounds/<filename>``
  - Provides a REST endpoint to list available behaviors (``/behaviors``)

Keeps the MQTT pipeline untouched — this is a parallel interface for
the browser dashboard.
"""

import asyncio
import json
import logging
import os
import wave
import numpy as np
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from behavior_simulator import BehaviorSimulator
from behaviors import BEHAVIOR_REGISTRY
from broker import BrokerClient

MAC_ADDRESS = "00:1A:7D:DA:71:13"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
SOUNDS_DIR = BASE_DIR / "sounds"

# ─── FastAPI App ──────────────────────────────────────────
app = FastAPI(title="Smart Hive WebSocket Server", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global simulator & MQTT ──────────────────────────────
simulator = BehaviorSimulator()
PUBLISH_INTERVAL = 2  # seconds between telemetry pushes
mqtt_client = BrokerClient(client_id_suffix="behavior-publisher")


@app.on_event("startup")
async def startup_event():
    """Start the global MQTT publishing loop."""
    import asyncio
    
    if not mqtt_client.connected:
        mqtt_client.connect()

    async def _publish_loop():
        while True:
            try:
                data = simulator.generate_all()
                # MQTT Push
                mqtt_client.publish(f"temperatureData/{MAC_ADDRESS}", {"value": data["temperature"]["value"]})
                mqtt_client.publish(f"humidityData/{MAC_ADDRESS}", {"value": data["humidity"]["value"]})
                mqtt_client.publish(f"weightData/{MAC_ADDRESS}", {"value": data["weight"]["value"]})
                mqtt_client.publish(f"populationData/{MAC_ADDRESS}", {"value": data["population"]["value"]})

                # Read a snippet of audio to send
                sound_file = SOUNDS_DIR / simulator._behavior.sound_file
                if sound_file.exists():
                    with wave.open(str(sound_file), 'rb') as wf:
                        frames = wf.readframes(1000)
                        audio_array = np.frombuffer(frames, dtype=np.int16)
                        audio_floats = (audio_array / 32768.0).tolist()
                        mqtt_client.publish(f"audioSensorData/{MAC_ADDRESS}", {"value": audio_floats})
                        
            except Exception as e:
                logger.error(f"MQTT publish error: {e}")
                
            await asyncio.sleep(PUBLISH_INTERVAL)

    asyncio.create_task(_publish_loop())


# ─── REST Endpoints ──────────────────────────────────────

@app.get("/")
async def root():
    """Health-check endpoint."""
    return {"status": "ok", "service": "Smart Hive WS Server"}


@app.get("/behaviors")
async def list_behaviors():
    """Return metadata for all available behavior profiles."""
    result = []
    for key, profile in BEHAVIOR_REGISTRY.items():
        result.append({
            "name": profile.name,
            "display_name": profile.display_name,
            "description": profile.description,
            "alert_level": profile.alert_level,
            "sound_file": profile.sound_file,
        })
    return JSONResponse(content=result)


class BehaviorUpdate(BaseModel):
    hiveId: str
    behavior: str


@app.post("/behavior")
async def set_behavior(update: BehaviorUpdate):
    """Set the behavior of the simulator."""
    try:
        meta = simulator.set_behavior(update.behavior)
        logger.info("🔄 Behavior changed via HTTP → %s (hive: %s)", update.behavior, update.hiveId)
        return JSONResponse(content={"status": "success", "hiveId": update.hiveId, **meta})
    except ValueError as ve:
        return JSONResponse(status_code=400, content={"error": str(ve)})


class AudioInjectRequest(BaseModel):
    behavior: str
    topic: str

@app.post("/inject-audio")
async def inject_audio(req: AudioInjectRequest):
    """Send raw audio bytes to a specified MQTT topic."""
    profile = BEHAVIOR_REGISTRY.get(req.behavior)
    if not profile:
        return JSONResponse(status_code=400, content={"error": "Unknown behavior"})
    
    sound_file = SOUNDS_DIR / profile.sound_file
    if not sound_file.exists():
        return JSONResponse(status_code=404, content={"error": "Sound file not found"})
    
    try:
        with wave.open(str(sound_file), 'rb') as wf:
            frames = wf.readframes(wf.getnframes())
            audio_array = np.frombuffer(frames, dtype=np.int16)
            payload = audio_array.tobytes()
            
            # Send raw bytes using the underlying paho client
            mqtt_client._client.publish(req.topic, payload, qos=0)
            
        logger.info(f"📤 Injected {len(payload)} raw bytes of {profile.sound_file} to {req.topic}")
        return {"status": "success", "topic": req.topic, "bytes_sent": len(payload)}
    except Exception as e:
        logger.error(f"Failed to inject audio: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/sounds/{filename}")
async def serve_sound(filename: str):
    """Serve a sound file from the sounds directory."""
    filepath = SOUNDS_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        return JSONResponse(
            status_code=404,
            content={"error": f"Sound file '{filename}' not found"},
        )
    return FileResponse(
        path=str(filepath),
        media_type="audio/wav",
        filename=filename,
    )


# ─── WebSocket Endpoint ──────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """Bi-directional WebSocket for telemetry + behavior commands.

    **Downstream (server → client):**
        Sends JSON telemetry snapshots every ``PUBLISH_INTERVAL`` seconds.

    **Upstream (client → server):**
        Accepts JSON commands:
        ``{"action": "set_behavior", "behavior": "swarm"}``
    """
    await ws.accept()
    logger.info("🌐 Dashboard WebSocket connected")

    # Send initial behavior info
    initial = {
        "type": "behavior_changed",
        "behavior": simulator.current_behavior,
        **_behavior_meta(simulator.current_behavior),
    }
    await ws.send_json(initial)

    async def _send_telemetry():
        """Push telemetry to WS at fixed intervals."""
        while True:
            try:
                data = simulator.generate_all()
                data["type"] = "telemetry"
                await ws.send_json(data)
            except WebSocketDisconnect:
                break
            except Exception as exc:
                logger.error("Telemetry send failed: %s", exc)
                break
            await asyncio.sleep(PUBLISH_INTERVAL)

    async def _receive_commands():
        """Listen for behavior-change commands from the dashboard."""
        while True:
            try:
                raw = await ws.receive_text()
                msg = json.loads(raw)
                action = msg.get("action")

                if action == "set_behavior":
                    behavior_name = msg.get("behavior", "normal")
                    try:
                        meta = simulator.set_behavior(behavior_name)
                        response = {
                            "type": "behavior_changed",
                            **meta,
                        }
                        await ws.send_json(response)
                        logger.info(
                            "🔄 Behavior changed → %s", behavior_name
                        )
                    except ValueError as ve:
                        await ws.send_json({
                            "type": "error",
                            "message": str(ve),
                        })
                else:
                    await ws.send_json({
                        "type": "error",
                        "message": f"Unknown action: {action}",
                    })

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await ws.send_json({
                    "type": "error",
                    "message": "Invalid JSON",
                })
            except Exception:
                break

    # Run both tasks concurrently
    telemetry_task = asyncio.create_task(_send_telemetry())
    command_task = asyncio.create_task(_receive_commands())

    try:
        # Wait until either task completes (i.e. disconnection)
        done, pending = await asyncio.wait(
            [telemetry_task, command_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    except Exception:
        pass

    logger.info("🔌 Dashboard WebSocket disconnected")


def _behavior_meta(name: str) -> dict:
    """Return display metadata for a behavior name."""
    profile = BEHAVIOR_REGISTRY.get(name)
    if not profile:
        return {}
    return {
        "display_name": profile.display_name,
        "description": profile.description,
        "alert_level": profile.alert_level,
        "sound_file": profile.sound_file,
    }


# ─── Entry point ──────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    # Ensure sounds directory exists
    SOUNDS_DIR.mkdir(exist_ok=True)

    logger.info("🐝 Smart Hive WebSocket Server starting …")
    logger.info("   Sounds dir: %s", SOUNDS_DIR)
    logger.info("   Available behaviors: %s", list(BEHAVIOR_REGISTRY.keys()))

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info",
    )
