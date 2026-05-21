from __future__ import annotations

from src.core.config.incidents import SCRIPTED_INCIDENTS
from src.core.world.runtime_state import IncidentRecord, WorldRuntimeState


def trigger_incident_for_clock(world: WorldRuntimeState, clock: str) -> IncidentRecord | None:
    normalized_clock = str(clock or "").strip()

    for index, item in enumerate(SCRIPTED_INCIDENTS, start=1):
        incident_id = f"incident-{index}"
        incident_time = str(item.get("time", "")).strip()

        if incident_id in world.triggered_incident_ids:
            continue

        if incident_time != normalized_clock:
            continue

        incident = IncidentRecord(
            incident_id=incident_id,
            time=incident_time,
            title=str(item.get("title", "")).strip(),
            content=str(item.get("content", "")).strip(),
            day=world.company.day,
            step=world.company.step,
            clock=normalized_clock,
        )

        world.pending_incident = incident
        world.incidents.append(incident)
        world.triggered_incident_ids.add(incident_id)

        return incident

    return None
