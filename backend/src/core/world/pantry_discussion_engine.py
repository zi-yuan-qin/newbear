from __future__ import annotations

import json
import re
from typing import Any

from src.core.llm.ark_client import ArkClientError, ark_chat
from src.core.world.runtime_state import WorldRuntimeState
from src.core.world.seed_loader import load_world_seed


def run_pantry_tick(world: WorldRuntimeState) -> list[dict[str, str]]:
    pantry = world.active_pantry
    if pantry is None or pantry.phase != "live":
        return []

    participants = [
        actor_id
        for actor_id in pantry.participants
        if actor_id in world.actors
    ]

    if not participants:
        return []

    seed = load_world_seed()
    character_by_id = {
        item["actor_id"]: item
        for item in seed["characters"]
    }

    actors_payload = []
    for actor_id in participants:
        runtime_actor = world.actors[actor_id]
        character = character_by_id.get(actor_id, {})

        actors_payload.append(
            {
                "actor_id": actor_id,
                "display_name": runtime_actor.display_name,
                "job_role": character.get("job_profile", {}).get("role_name", ""),
                "personality": character.get("character_profile", {}).get("personality", {}),
                "last_speech": runtime_actor.last_speech,
            }
        )

    messages = _build_pantry_tick_messages(
        pantry={
            "title": pantry.title,
            "content": pantry.content,
            "clock": pantry.clock,
        },
        actors=actors_payload,
        transcript=pantry.transcript[-16:],
    )

    try:
        raw_reply = ark_chat(messages=messages, max_tokens=500)
        parsed = _parse_json_object(raw_reply)
        lines = _normalize_lines(parsed.get("lines", []), participants)
    except (ArkClientError, ValueError):
        lines = _fallback_lines(world, participants)

    if not lines:
        lines = _fallback_lines(world, participants)

    for line in lines:
        actor_id = line["actor_id"]
        actor = world.actors.get(actor_id)
        if actor is None:
            continue

        actor.last_speech = line["content"]
        actor.current_task = f"茶水间闲谈：{pantry.title}"

        pantry.transcript.append(
            {
                "speaker": actor.display_name,
                "actor_id": actor_id,
                "kind": "actor",
                "content": line["content"],
            }
        )

    pantry.transcript = pantry.transcript[-80:]
    return lines


def finish_pantry(world: WorldRuntimeState) -> dict[str, str] | None:
    pantry = world.active_pantry
    if pantry is None:
        return None

    if pantry.phase == "resolved" and pantry.result:
        return {
            "title": str(pantry.result.get("title", "")),
            "thought": str(pantry.result.get("thought", "")),
        }

    result = _generate_pantry_result(world)
    pantry.result = result
    pantry.phase = "resolved"

    return result


def _build_pantry_tick_messages(
    *,
    pantry: dict[str, Any],
    actors: list[dict[str, Any]],
    transcript: list[dict[str, str]],
) -> list[dict[str, str]]:
    system_prompt = "\n".join(
        [
            "你是茶水间闲谈模拟器。",
            "这不是会议，不要总结，不要拍板，不要形成正式方案。",
            "大家是在下班前的茶水间轻松聊天，允许吐槽、犹豫、试探、开玩笑。",
            "产品经理如果刚刚说话，大家要自然听见并回应，但不要奉承。",
            "每轮生成 1 到 2 句发言即可，不需要所有人都说。",
            "发言要短、自然、像真实同事顺嘴说出来的话。",
            "只输出 JSON，不要 Markdown，不要解释。",
            'JSON 格式：{"lines":[{"actor_id":"角色ID","content":"一句发言"}]}',
        ]
    )

    user_prompt = "\n".join(
        [
            "茶水间主题：",
            json.dumps(pantry, ensure_ascii=False),
            "在场角色：",
            json.dumps(actors, ensure_ascii=False),
            "最近闲谈记录：",
            json.dumps(transcript, ensure_ascii=False),
            "请生成下一小轮自然闲谈。",
        ]
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _generate_pantry_result(world: WorldRuntimeState) -> dict[str, str]:
    pantry = world.active_pantry
    if pantry is None:
        return {"title": "茶水间余味", "thought": "这段闲谈结束了。"}

    transcript_text = "\n".join(
        f"{line.get('speaker') or line.get('actor_id')}: {line.get('content') or line.get('speech') or ''}"
        for line in pantry.transcript[-60:]
    )

    messages = [
        {
            "role": "system",
            "content": "\n".join(
                [
                    "你要生成茶水间闲谈结束后留下的一点真实想法。",
                    "这不是会议结论，不是报告，不是正式方案。",
                    "它应该像一个团队成员在产品经理离开后，心里默默记下的观察。",
                    "只输出 JSON，不要 Markdown，不要解释。",
                    'JSON 格式：{"title":"短标题","thought":"一小段真实想法"}',
                ]
            ),
        },
        {
            "role": "user",
            "content": "\n".join(
                [
                    f"闲谈标题：{pantry.title}",
                    f"闲谈内容：{pantry.content}",
                    "完整闲谈记录：",
                    transcript_text,
                ]
            ),
        },
    ]

    try:
        raw_reply = ark_chat(messages=messages, max_tokens=500)
        parsed = _parse_json_object(raw_reply)
        title = str(parsed.get("title", "") or "茶水间余味").strip()
        thought = str(parsed.get("thought", "") or "").strip()
        if thought:
            return {"title": title[:60], "thought": thought[:400]}
    except (ArkClientError, ValueError):
        pass

    return {
        "title": "茶水间余味",
        "thought": f"围绕“{pantry.title}”，大家没有形成正式结论，但说出了比会议桌上更松、更真实的担心和判断。",
    }


def _normalize_lines(raw_lines: Any, participants: list[str]) -> list[dict[str, str]]:
    if not isinstance(raw_lines, list):
        return []

    allowed = set(participants)
    lines: list[dict[str, str]] = []

    for item in raw_lines:
        if not isinstance(item, dict):
            continue

        actor_id = str(item.get("actor_id", "") or "").strip()
        content = str(item.get("content", "") or item.get("speech", "") or "").strip()

        if actor_id not in allowed or not content:
            continue

        lines.append(
            {
                "actor_id": actor_id,
                "content": content[:80],
            }
        )

    return lines[:2]


def _fallback_lines(world: WorldRuntimeState, participants: list[str]) -> list[dict[str, str]]:
    pantry = world.active_pantry
    if pantry is None:
        return []

    fallback_by_actor_id = {
        "xionglaoban": "茶水间不用拍板，先把心里那点别扭说出来。",
        "xiongshichang": "我就觉得今天大家都太绷了，像是怕先说错话。",
        "xiongxingzheng": "说轻松点吧，但钱和人这两件事真不能装没看见。",
        "xiongjishu": "我白天没说，其实有些技术债再拖就会反咬我们。",
    }

    start = len(pantry.transcript) % max(1, len(participants))
    picked = [
        participants[start % len(participants)],
        participants[(start + 1) % len(participants)],
    ]

    return [
        {
            "actor_id": actor_id,
            "content": fallback_by_actor_id.get(actor_id, "这事先别急着定性，聊开一点反而更清楚。"),
        }
        for actor_id in picked
    ]


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
