from __future__ import annotations

import json
import re
from typing import Any

from src.core.llm.ark_client import ArkClientError, ark_chat
from src.core.map.map_semantics import normalize_location_name
from src.core.world.prompt_context import build_actor_reaction_messages
from src.core.world.seed_loader import load_world_seed


def fallback_actor_reaction(actor_id: str, affair: str) -> dict[str, object]:
    clean_affair = str(affair or "").strip()

    if not clean_affair:
        return {
            "task": "推进自己的日常工作",
            "speech": "我先继续推进手头的事情。",
            "intent": "work",
            "move_to": "开放办公区",
            "stress_delta": 0,
            "energy_delta": -2,
            "provider": "fallback",
        }

    if actor_id == "xionglaoban":
        return {
            "task": f"拆解并拍板：{clean_affair}",
            "speech": f"我先把这件事拆成负责人、截止时间和交付标准：{clean_affair}",
            "intent": "decide",
            "move_to": "会议室",
            "stress_delta": 3,
            "energy_delta": -4,
            "provider": "fallback",
        }

    if actor_id == "xiongjishu":
        return {
            "task": f"评估实现代价：{clean_affair}",
            "speech": f"我先判断这件事的实现风险和最小可交付范围：{clean_affair}",
            "intent": "work",
            "move_to": "开放办公区",
            "stress_delta": 4,
            "energy_delta": -5,
            "provider": "fallback",
        }

    if actor_id == "xiongshichang":
        return {
            "task": f"判断外部反馈价值：{clean_affair}",
            "speech": f"我会先看这件事能不能形成对外可验证的反馈：{clean_affair}",
            "intent": "observe",
            "move_to": "会客区",
            "stress_delta": 3,
            "energy_delta": -4,
            "provider": "fallback",
        }

    if actor_id == "xiongxingzheng":
        return {
            "task": f"核算资源与成本：{clean_affair}",
            "speech": f"我先确认这件事会不会带来额外成本和资源挤压：{clean_affair}",
            "intent": "work",
            "move_to": "开放办公区",
            "stress_delta": 2,
            "energy_delta": -3,
            "provider": "fallback",
        }

    return {
        "task": f"处理事务：{clean_affair}",
        "speech": f"我会把这件事纳入当前判断：{clean_affair}",
        "intent": "work",
        "move_to": "开放办公区",
        "stress_delta": 2,
        "energy_delta": -3,
        "provider": "fallback",
    }


def build_actor_reaction(
    actor_id: str,
    affair: str,
    *,
    clock: str = "",
    memories: list[str] | None = None,
    incident: dict[str, Any] | None = None
) -> dict[str, object]:
    seed = load_world_seed()
    character_by_id = {item["actor_id"]: item for item in seed["characters"]}
    character = character_by_id.get(actor_id)
    if character is None:
        return fallback_actor_reaction(actor_id, affair)

    fallback = fallback_actor_reaction(actor_id, affair)
    messages = build_actor_reaction_messages(
        company=seed["company"],
        character=character,
        clock=clock,
        affair=affair,
        memories=memories,
        incident=incident,
    )

    try:
        raw_reply = ark_chat(messages=messages)
        parsed = _parse_json_object(raw_reply)
    except (ArkClientError, ValueError):
        return fallback

    task = str(parsed.get("task", "") or "").strip()
    speech = str(parsed.get("speech", "") or "").strip()
    intent = str(parsed.get("intent", "") or fallback["intent"]).strip()
    move_to = normalize_location_name(str(parsed.get("move_to", "") or fallback["move_to"]))

    if not task or not speech:
        return fallback

    return {
        "task": task[:120],
        "speech": speech[:160],
        "intent": intent[:40],
        "move_to": move_to,
        "stress_delta": fallback["stress_delta"],
        "energy_delta": fallback["energy_delta"],
        "provider": "ark",
    }


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
