import sounddevice as sd
import numpy as np
import paho.mqtt.client as mqtt
import time

# =========================
# MQTT SETTINGS
# =========================
MQTT_BROKER = "localhost"   # change to your broker IP
MQTT_PORT = 1883
MQTT_TOPIC = "audioSensorData/00:1A:7D:DA:71:13"

# =========================
# AUDIO SETTINGS
# =========================
SAMPLE_RATE = 32000      # 32000 samples per second
DURATION = 1            # 1 second
CHANNELS = 1

# =========================
# MQTT CLIENT
# =========================
client = mqtt.Client()

print("Connecting to MQTT broker...")
client.connect(MQTT_BROKER, MQTT_PORT, 60)

print("Connected.")

# =========================
# MAIN LOOP
# =========================
while True:

    print("Recording 1 second...")

    # Record exactly 8000 samples
    audio = sd.rec(
        int(DURATION * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype='int16'
    )

    sd.wait()

    # Convert to 1D array
    audio = audio.flatten()

    # =========================
    # CONVERT TO RAW BYTES
    # =========================
    payload = audio.tobytes()

    # Payload size should be:
    # 8000 samples × 2 bytes = 16000 bytes

    print(f"Sending {len(payload)} bytes")

    # =========================
    # PUBLISH TO MQTT
    # =========================
    client.publish(MQTT_TOPIC, payload)

    print("Published to MQTT")

    time.sleep(1)