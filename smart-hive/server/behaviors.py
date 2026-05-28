"""
Hive Behavior Profiles.

Defines distinct sensor parameter sets for different hive states:
  - normal:       Healthy colony, steady honey production
  - swarm:        Colony preparing to swarm (high temp, weight drop)
  - queen_absent: Queenless colony (erratic temp, declining weight)

Each profile contains min/max/noise ranges for temperature, humidity,
and weight, plus weight trend direction.
"""

from dataclasses import dataclass, field
from typing import Dict


@dataclass
class SensorProfile:
    """Range and noise parameters for a single sensor."""
    min: float
    max: float
    noise_std: float
    unit: str
    trend: float = 0.0  # per-tick drift direction


@dataclass
class BehaviorProfile:
    """Complete sensor profile set for a hive behavior."""
    name: str
    display_name: str
    description: str
    temperature: SensorProfile
    humidity: SensorProfile
    weight: SensorProfile
    sound_file: str  # filename in /sounds directory
    alert_level: str = "normal"  # normal, warning, critical


# ─── Normal Behavior ──────────────────────────────────────
# Healthy colony: stable 34-36°C brood nest, 50-65% humidity,
# slow weight gain from honey production.
NORMAL = BehaviorProfile(
    name="normal",
    display_name="Normal",
    description="Healthy colony with steady honey production",
    temperature=SensorProfile(
        min=33.5, max=36.0, noise_std=0.2, unit="°C", trend=0.0,
    ),
    humidity=SensorProfile(
        min=50.0, max=65.0, noise_std=1.0, unit="%", trend=0.0,
    ),
    weight=SensorProfile(
        min=25.0, max=45.0, noise_std=0.1, unit="kg", trend=0.03,
    ),
    sound_file="normal.wav",
    alert_level="normal",
)

# ─── Swarm Behavior ──────────────────────────────────────
# Pre-swarm: temperature rises as bees cluster and fan,
# humidity spikes, weight drops suddenly as half the colony leaves.
SWARM = BehaviorProfile(
    name="swarm",
    display_name="Swarm",
    description="Colony preparing to swarm — sudden weight drop, high temperature",
    temperature=SensorProfile(
        min=37.0, max=42.0, noise_std=0.5, unit="°C", trend=0.15,
    ),
    humidity=SensorProfile(
        min=70.0, max=90.0, noise_std=2.5, unit="%", trend=0.3,
    ),
    weight=SensorProfile(
        min=15.0, max=45.0, noise_std=0.3, unit="kg", trend=-0.4,
    ),
    sound_file="swarm.wav",
    alert_level="critical",
)

# ─── Queen Absent Behavior ────────────────────────────────
# Queenless: temperature regulation breaks down (erratic),
# humidity becomes irregular, weight slowly declines as colony weakens.
QUEEN_ABSENT = BehaviorProfile(
    name="queen_absent",
    display_name="Queen Absent",
    description="Queenless colony — erratic temperature, declining population",
    temperature=SensorProfile(
        min=28.0, max=38.0, noise_std=1.2, unit="°C", trend=-0.05,
    ),
    humidity=SensorProfile(
        min=40.0, max=80.0, noise_std=3.0, unit="%", trend=0.1,
    ),
    weight=SensorProfile(
        min=18.0, max=40.0, noise_std=0.2, unit="kg", trend=-0.08,
    ),
    sound_file="queen_absent.wav",
    alert_level="warning",
)


# ─── Registry ─────────────────────────────────────────────

BEHAVIOR_REGISTRY: Dict[str, BehaviorProfile] = {
    "normal": NORMAL,
    "swarm": SWARM,
    "queen_absent": QUEEN_ABSENT,
}

DEFAULT_BEHAVIOR = "normal"


def get_behavior(name: str) -> BehaviorProfile:
    """Look up a behavior profile by name.

    Args:
        name: One of ``'normal'``, ``'swarm'``, ``'queen_absent'``.

    Returns:
        The matching :class:`BehaviorProfile`.

    Raises:
        ValueError: If *name* is not recognised.
    """
    if name not in BEHAVIOR_REGISTRY:
        raise ValueError(
            f"Unknown behavior '{name}'. "
            f"Available: {list(BEHAVIOR_REGISTRY.keys())}"
        )
    return BEHAVIOR_REGISTRY[name]
