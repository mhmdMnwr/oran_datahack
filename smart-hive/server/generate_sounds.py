"""
Generate realistic placeholder WAV sound files for hive behaviors.

Creates three distinct audio signatures:
  - normal.wav:       Gentle, low-frequency buzzing (peaceful hive)
  - swarm.wav:        Intense, high-frequency buzzing with modulation
  - queen_absent.wav: Irregular, distressed piping sounds

Run once: python generate_sounds.py
"""

import numpy as np
from scipy.io import wavfile
from pathlib import Path

SAMPLE_RATE = 44100
DURATION = 5  # seconds
SOUNDS_DIR = Path(__file__).resolve().parent / "sounds"


def _normalise(signal: np.ndarray) -> np.ndarray:
    """Normalise to 16-bit PCM range."""
    peak = np.max(np.abs(signal))
    if peak > 0:
        signal = signal / peak
    return (signal * 32000).astype(np.int16)


def generate_normal():
    """Gentle, steady hive buzz — ~200-300 Hz base with harmonics."""
    t = np.linspace(0, DURATION, SAMPLE_RATE * DURATION, endpoint=False)

    # Base buzz
    sig = 0.5 * np.sin(2 * np.pi * 220 * t)
    sig += 0.3 * np.sin(2 * np.pi * 330 * t)
    sig += 0.15 * np.sin(2 * np.pi * 440 * t)

    # Gentle amplitude modulation (wing beating rhythm)
    am = 0.85 + 0.15 * np.sin(2 * np.pi * 8 * t)
    sig *= am

    # Slow volume swell
    envelope = 0.6 + 0.4 * np.sin(2 * np.pi * 0.3 * t)
    sig *= envelope

    wavfile.write(str(SOUNDS_DIR / "normal.wav"), SAMPLE_RATE, _normalise(sig))
    print("✅ normal.wav generated")


def generate_swarm():
    """Intense, rising swarm buzz — higher frequencies, faster modulation."""
    t = np.linspace(0, DURATION, SAMPLE_RATE * DURATION, endpoint=False)

    # Rising frequency sweep (300→600 Hz)
    freq = 300 + 300 * (t / DURATION)
    phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE

    sig = 0.6 * np.sin(phase)
    sig += 0.4 * np.sin(phase * 1.5)  # dissonant harmonic
    sig += 0.25 * np.sin(phase * 2.3)

    # Fast, aggressive amplitude modulation
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 25 * t)
    sig *= am

    # Add some noise for chaos
    sig += 0.08 * np.random.randn(len(t))

    # Intensity builds over time
    envelope = 0.4 + 0.6 * (t / DURATION)
    sig *= envelope

    wavfile.write(str(SOUNDS_DIR / "swarm.wav"), SAMPLE_RATE, _normalise(sig))
    print("✅ swarm.wav generated")


def generate_queen_absent():
    """Queenless piping — irregular buzzing with distressed 'tooting' notes."""
    t = np.linspace(0, DURATION, SAMPLE_RATE * DURATION, endpoint=False)

    # Irregular base buzz (lower, less organized)
    sig = 0.4 * np.sin(2 * np.pi * 180 * t)
    sig += 0.2 * np.sin(2 * np.pi * 260 * t)

    # Queenless "piping" — periodic high-pitched bursts
    pipe_freq = 500
    pipe_signal = 0.5 * np.sin(2 * np.pi * pipe_freq * t)

    # Create intermittent piping pattern (on for 0.3s, off for 0.7s)
    pipe_envelope = np.zeros_like(t)
    for start in np.arange(0, DURATION, 1.0):
        mask = (t >= start) & (t < start + 0.35)
        pipe_envelope[mask] = 1.0
    pipe_envelope *= (0.5 + 0.5 * np.sin(2 * np.pi * 3 * t))  # vibrato
    sig += pipe_signal * pipe_envelope

    # Irregular amplitude — colony disorganization
    am = 0.5 + 0.3 * np.sin(2 * np.pi * 4.7 * t) + 0.2 * np.sin(2 * np.pi * 1.3 * t)
    sig *= am

    wavfile.write(str(SOUNDS_DIR / "queen_absent.wav"), SAMPLE_RATE, _normalise(sig))
    print("✅ queen_absent.wav generated")


if __name__ == "__main__":
    SOUNDS_DIR.mkdir(exist_ok=True)
    generate_normal()
    generate_swarm()
    generate_queen_absent()
    print(f"\n🔊 All sound files saved to {SOUNDS_DIR}")
