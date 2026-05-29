"""
Send a sound file from the sounds/ folder as raw audio bytes to an MQTT topic.

This is a standalone CLI tool — NOT part of the dashboard.

Usage:
    python3 send_sound.py <sound_file> <mqtt_topic>

Examples:
    python3 send_sound.py normal.wav audioSensorData/00:1A:7D:DA:71:13
    python3 send_sound.py swarm.wav hive/audio/swarm
    python3 send_sound.py queen_absent.wav custom/topic/audio

Available sound files are in the sounds/ directory.
"""

import os
import sys
import wave
import numpy as np
import paho.mqtt.client as mqtt
from pathlib import Path

# ── Configuration ─────────────────────────────
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
SOUNDS_DIR = Path(__file__).resolve().parent / "sounds"


def list_sounds():
    """List all available .wav files in the sounds directory."""
    files = sorted(SOUNDS_DIR.glob("*.wav"))
    if not files:
        print("  (no .wav files found)")
    for f in files:
        size_kb = f.stat().st_size / 1024
        print(f"  • {f.name}  ({size_kb:.1f} KB)")


def send_sound(filename: str, topic: str):
    """Read a .wav file and publish its raw bytes to an MQTT topic."""
    filepath = SOUNDS_DIR / filename

    if not filepath.exists():
        print(f"❌ File not found: {filepath}")
        print(f"\nAvailable sounds in {SOUNDS_DIR}:")
        list_sounds()
        sys.exit(1)

    # Read the .wav file
    print(f"📂 Reading {filepath.name} ...")
    with wave.open(str(filepath), "rb") as wf:
        n_channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        frames = wf.readframes(n_frames)

    audio_array = np.frombuffer(frames, dtype=np.int16)
    payload = audio_array.tobytes()

    print(f"   Channels: {n_channels}")
    print(f"   Sample rate: {framerate} Hz")
    print(f"   Frames: {n_frames}")
    print(f"   Payload size: {len(payload):,} bytes")

    # Connect to MQTT and publish
    print(f"\n📡 Connecting to {MQTT_BROKER}:{MQTT_PORT} ...")
    client = mqtt.Client()
    client.connect(MQTT_BROKER, MQTT_PORT, 60)

    print(f"📤 Publishing to topic: {topic}")
    result = client.publish(topic, payload, qos=0)
    result.wait_for_publish()

    client.disconnect()
    print(f"✅ Sent {len(payload):,} bytes of {filename} → {topic}")


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        print(f"Available sounds in {SOUNDS_DIR}:")
        list_sounds()
        sys.exit(0)

    filename = sys.argv[1]
    topic = sys.argv[2]
    send_sound(filename, topic)


if __name__ == "__main__":
    main()
