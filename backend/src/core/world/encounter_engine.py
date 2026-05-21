from __future__ import annotations

from collections import defaultdict
from typing import TYPE_CHECKING

from src.core.world.runtime_state import EncounterRecord, WorldRuntimeState

if TYPE_CHECKING:
    from src.core.world.runtime_state import ActorRuntimeState


COMMUNICATIVE_INTENTS = {"communicate", "coordinate", "decide"}


def detect_encounters(world: WorldRuntimeState, affair: str = "") -> list[EncounterRecord]:
    actors_by_location: dict[str, list[ActorRuntimeState]] = defaultdict(list)

    for actor in world.actors.values():
        actors_by_location[actor.location].append(actor)

    encounters: list[EncounterRecord] = []

    for location, actors in actors_by_location.items():
        if len(actors) < 2:
            continue

        if not should_trigger_interaction(actors):
            continue

        actor_ids = [actor.actor_id for actor in actors]
        actor_names = [actor.display_name for actor in actors]
        summary = build_encounter_summary(
            location=location,
            actors=actors,
            affair=affair,
        )

        encounters.append(
            EncounterRecord(
                encounter_id=len(world.encounters) + len(encounters) + 1,
                location=location,
                actor_ids=actor_ids,
                actor_names=actor_names,
                summary=summary,
                day=world.company.day,
                step=world.company.step,
                clock=world.company.clock,
            )
        )

    return encounters


def should_trigger_interaction(actors: list[ActorRuntimeState]) -> bool:
    return any(normalize_intent(actor.intent) in COMMUNICATIVE_INTENTS for actor in actors)


def normalize_intent(intent: str) -> str:
    return str(intent or "").strip().lower()


def build_encounter_summary(
    *,
    location: str,
    actors: list[ActorRuntimeState],
    affair: str,
) -> str:
    actor_names = [actor.display_name for actor in actors]
    names_text = "、".join(actor_names)
    affair_text = str(affair or "").strip()
    lead_actor = find_lead_actor(actors)

    if affair_text:
        return (
            f"{names_text}在{location}碰面。"
            f"{lead_actor.display_name}主动把话题拉回“{affair_text}”，大家进行了简短同步。"
        )

    return (
        f"{names_text}在{location}碰面。"
        f"{lead_actor.display_name}主动发起沟通，大家简单同步了各自手头的工作。"
    )


def find_lead_actor(actors: list[ActorRuntimeState]) -> ActorRuntimeState:
    for actor in actors:
        if normalize_intent(actor.intent) in COMMUNICATIVE_INTENTS:
            return actor

    return actors[0]
def find_encounter_groups(world: WorldRuntimeState) -> list[dict[str, object]]:
    groups_by_location: dict[str, list[ActorRuntimeState]] = {}

    for actor in world.actors.values():
        groups_by_location.setdefault(actor.location, []).append(actor)

    encounter_groups: list[dict[str, object]] = []

    for location, actors in groups_by_location.items():
        if len(actors) < 2:
            continue

        if not any(actor.intent in COMMUNICATIVE_INTENTS for actor in actors):
            continue

        encounter_groups.append(
            {
                "location": location,
                "actor_ids": [actor.actor_id for actor in actors],
                "display_names": [actor.display_name for actor in actors],
                "intents": {actor.actor_id: actor.intent for actor in actors},
                "tasks": {actor.actor_id: actor.current_task for actor in actors},
                "speeches": {actor.actor_id: actor.last_speech for actor in actors},
            }
        )

    return encounter_groups
