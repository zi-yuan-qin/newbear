from __future__ import annotations

import json
import re
from typing import Any

from src.core.llm.ark_client import ArkClientError, ark_chat
from src.core.world.prompt_context import (
    build_dialogue_decision_messages,
    build_dialogue_generation_messages,
)


def decide_dialogues(
    *,
    clock: str,
    affair: str,
    encounter_groups: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not encounter_groups:
        return []

    messages = build_dialogue_decision_messages(
        clock=clock,
        affair=affair,
        encounter_groups=encounter_groups,
    )

    try:
        raw_reply = ark_chat(messages=messages, max_tokens=512)
        parsed = _parse_json_object(raw_reply)
    except (ArkClientError, ValueError):
        return _fallback_dialogue_decisions(encounter_groups)

    conversations = parsed.get("conversations", [])
    if not isinstance(conversations, list):
        return []

    return _normalize_dialogue_decisions(conversations, encounter_groups)


def generate_dialogues(
    *,
    clock: str,
    affair: str,
    conversations: list[dict[str, Any]],
    actors: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not conversations:
        return []

    messages = build_dialogue_generation_messages(
        clock=clock,
        affair=affair,
        conversations=conversations,
        actors=actors,
    )

    try:
        raw_reply = ark_chat(messages=messages, max_tokens=900)
        parsed = _parse_json_object(raw_reply)
    except (ArkClientError, ValueError):
        return _fallback_dialogues(conversations, actors)

    generated = parsed.get("conversations", [])
    if not isinstance(generated, list):
        return _fallback_dialogues(conversations, actors)

    normalized = _normalize_generated_dialogues(generated, conversations)
    return normalized or _fallback_dialogues(conversations, actors)


def _normalize_dialogue_decisions(
    conversations: list[Any],
    encounter_groups: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    allowed_by_location = {
        str(group.get("location", "")): set(str(actor_id) for actor_id in group.get("actor_ids", []))
        for group in encounter_groups
    }

    normalized: list[dict[str, Any]] = []

    for item in conversations:
        if not isinstance(item, dict):
            continue

        location = str(item.get("location", "")).strip()
        actor_ids_raw = item.get("actor_ids", [])

        if isinstance(actor_ids_raw, str):
            actor_ids_raw = [actor_ids_raw]

        actor_ids = [str(actor_id).strip() for actor_id in actor_ids_raw if str(actor_id).strip()]
        allowed = allowed_by_location.get(location, set())
        actor_ids = [actor_id for actor_id in actor_ids if actor_id in allowed]

        if len(actor_ids) < 2:
            continue

        normalized.append(
            {
                "location": location,
                "actor_ids": actor_ids,
                "topic": str(item.get("topic", "") or "").strip(),
            }
        )

    return normalized


def _normalize_generated_dialogues(
    generated: list[Any],
    fallback_conversations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    fallback_by_location = {
        str(item.get("location", "")): set(str(actor_id) for actor_id in item.get("actor_ids", []))
        for item in fallback_conversations
    }

    normalized: list[dict[str, Any]] = []

    for item in generated:
        if not isinstance(item, dict):
            continue

        location = str(item.get("location", "")).strip()
        allowed_actor_ids = fallback_by_location.get(location, set())
        lines_raw = item.get("lines", [])

        if isinstance(lines_raw, dict):
            lines_raw = [lines_raw]

        lines: list[dict[str, str]] = []

        for line in lines_raw if isinstance(lines_raw, list) else []:
            if not isinstance(line, dict):
                continue

            actor_id = str(line.get("actor_id", "")).strip()
            to_actor_id = str(line.get("to_actor_id", "") or "").strip()
            speech = str(line.get("speech", "") or "").strip()

            if actor_id not in allowed_actor_ids or not speech:
                continue

            if to_actor_id and to_actor_id not in allowed_actor_ids:
                to_actor_id = ""

            lines.append(
                {
                    "actor_id": actor_id,
                    "to_actor_id": to_actor_id,
                    "speech": speech[:160],
                    "via": "face_to_face",
                }
            )

        if lines:
            normalized.append(
                {
                    "location": location,
                    "actor_ids": list(allowed_actor_ids),
                    "lines": lines,
                }
            )

    return normalized


def _fallback_dialogue_decisions(encounter_groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    decisions: list[dict[str, Any]] = []

    for group in encounter_groups[:1]:
        actor_ids = [str(actor_id) for actor_id in group.get("actor_ids", [])]
        if len(actor_ids) < 2:
            continue

        decisions.append(
            {
                "location": str(group.get("location", "")),
                "actor_ids": actor_ids[:2],
                "topic": "同一地点需要同步当前事务",
            }
        )

    return decisions


def _fallback_dialogues(
    conversations: list[dict[str, Any]],
    actors: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    actor_name_by_id = {
        str(actor.get("actor_id")): str(actor.get("display_name", actor.get("actor_id")))
        for actor in actors
    }

    generated: list[dict[str, Any]] = []

    for conversation in conversations:
        actor_ids = [str(actor_id) for actor_id in conversation.get("actor_ids", [])]
        if len(actor_ids) < 2:
            continue

        first_actor_id = actor_ids[0]
        second_actor_id = actor_ids[1]
        topic = str(conversation.get("topic", "") or "当前事务")

        generated.append(
            {
                "location": str(conversation.get("location", "")),
                "actor_ids": actor_ids,
                "lines": [
                    {
                        "actor_id": first_actor_id,
                        "to_actor_id": second_actor_id,
                        "speech": f"我们先把{topic}这件事对齐一下。",
                        "via": "face_to_face",
                    },
                    {
                        "actor_id": second_actor_id,
                        "to_actor_id": first_actor_id,
                        "speech": f"可以，我先说我的判断。",
                        "via": "face_to_face",
                    },
                ],
            }
        )

    return generated


def _parse_json_object(text: str) -> dict[str, Any]:
    source = str(text or "").strip()
    if not source:
        raise ValueError("empty response")

    try:
        data = json.loads(source)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", source, re.S)
        if not match:
            raise ValueError("no json object")
        data = json.loads(match.group(0))

    if not isinstance(data, dict):
        raise ValueError("response is not an object")

    return data
