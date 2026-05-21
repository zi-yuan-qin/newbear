from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.core.map.map_semantics import build_map_semantics


MAP_DIR = Path(__file__).resolve().parent
SCENARIO_PACKAGE_PATH = MAP_DIR / "scenario_package.json"


def load_scenario_package() -> dict[str, Any]:
    if not SCENARIO_PACKAGE_PATH.exists():
        return {}

    raw = SCENARIO_PACKAGE_PATH.read_text(encoding="utf-8")
    data = json.loads(raw)

    return data if isinstance(data, dict) else {}


def load_world_map() -> dict[str, Any]:
    package = load_scenario_package()
    semantics = build_map_semantics()
    attach_room_anchors(semantics, package)

    return {
        "package_id": package.get("package_id", ""),
        "package_version": package.get("package_version", ""),
        "world": package.get("world", {}),
        "navigation": package.get("navigation", {}),
        "semantics": semantics,
    }


def attach_room_anchors(semantics: dict[str, Any], package: dict[str, Any]) -> None:
    rooms = package.get("rooms", [])
    if not isinstance(rooms, list):
        return

    room_by_name = {
        str(room.get("name", "")): room
        for room in rooms
        if isinstance(room, dict)
    }

    for location in semantics.get("locations", []):
        if not isinstance(location, dict):
            continue

        matched_room = find_matching_room(location, room_by_name)
        if matched_room is None:
            continue

        location["anchor_x"] = float(matched_room.get("anchor_x", 0.0) or 0.0)
        location["anchor_y"] = float(matched_room.get("anchor_y", 0.0) or 0.0)


def find_matching_room(location: dict[str, Any], room_by_name: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    names = [str(location.get("name", ""))]
    names.extend(str(alias) for alias in location.get("aliases", []) or [])

    for name in names:
        if name in room_by_name:
            return room_by_name[name]

    return None
