from __future__ import annotations

from src.core.map.map_loader import load_world_map
from src.core.map.map_semantics import normalize_location_name
from src.core.world.runtime_state import (
    ActorRuntimeState,
    CompanyRuntimeState,
    WorldRuntimeState,
)
from src.core.world.seed_loader import load_world_seed


def create_initial_world_state() -> WorldRuntimeState:
    seed = load_world_seed()

    company = CompanyRuntimeState(
        name=seed["company"]["name"],
        cash=5000.0,
        day=1,
        step=0,
        clock="09:00",
    )

    actors = {}

    for character in seed["characters"]:
        work = character["character_profile"].get("work", {})
        actors[character["actor_id"]] = ActorRuntimeState(
            actor_id=character["actor_id"],
            display_name=character["display_name"],
            location=normalize_location_name(work.get("office", "开放办公区")),
            stress=30,
            energy=70,
            mood="normal",
            current_task="",
            last_speech="",
        )

    return WorldRuntimeState(
        company=company,
        actors=actors,
        map_data=load_world_map(),
    )
