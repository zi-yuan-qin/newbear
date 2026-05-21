from __future__ import annotations

import json
import re
from typing import Any

from src.core.config.report_events import BIG_FIVE_LABELS, REPORT_TRIGGER_TIME
from src.core.llm.ark_client import ArkClientError, ark_chat
from src.core.world.runtime_state import ActiveReportState, WorldRuntimeState


def trigger_report_for_clock(world: WorldRuntimeState, clock: str) -> ActiveReportState | None:
    if world.report_generated or world.active_report is not None:
        return None

    if not _is_at_or_after(clock, REPORT_TRIGGER_TIME):
        return None

    evidence = collect_report_evidence(world)
    report = build_report(world, evidence=evidence, clock=clock)
    world.active_report = report
    world.report_generated = True
    world.company.logs.append(
        {
            "type": "report",
            "clock": clock,
            "day": world.company.day,
            "step": world.company.step,
            "title": report.title,
            "scores": report.scores,
        }
    )
    return report


def close_active_report(world: WorldRuntimeState) -> None:
    if world.active_report is not None:
        world.active_report.visible = False


def collect_report_evidence(world: WorldRuntimeState) -> list[str]:
    evidence: list[str] = []

    for record in world.user_inputs:
        text = str(record.raw_text or "").strip()
        if text:
            evidence.append(f"{record.clock} 产品经理说：{text}")

    for incident in world.incidents:
        evidence.append(f"{incident.clock} 固定事件：{incident.title}。{incident.content}")

    for meeting in world.meetings:
        evidence.append(f"{meeting.clock} 会议议题：{meeting.title}。{meeting.content}")

    if world.active_pantry is not None:
        for line in world.active_pantry.transcript:
            speaker = str(line.get("speaker") or line.get("actor_id") or "")
            speech = str(line.get("speech") or line.get("message") or "").strip()
            if speech:
                evidence.append(f"{world.active_pantry.clock} 茶水间发言：{speaker}：{speech}")

    for actor in world.actors.values():
        for memory in actor.memory_stream[-16:]:
            if memory.kind in {"user_input", "incident", "meeting", "reflection"}:
                evidence.append(memory.text)

    return _dedupe_keep_order(evidence)[-40:]


def build_report(
    world: WorldRuntimeState,
    *,
    evidence: list[str],
    clock: str,
) -> ActiveReportState:
    fallback = _fallback_report(world, evidence=evidence, clock=clock)

    if not evidence:
        return fallback

    messages = [
        {
            "role": "system",
            "content": (
                "你是熊起东方公司的同事，正在给产品经理写一封一天结束后的信。"
                "这封信要基于产品经理在模拟中的发言、选择、会议参与和关键事件反应，温和但不奉承地写出观察。"
                "只输出 JSON，不要 Markdown。"
            ),
        },
        {
            "role": "user",
            "content": "\n".join(
                [
                    "请输出格式：",
                    '{"scores":{"O":60,"C":60,"E":60,"A":60,"S":60},"trait_summary":"一句自然的人格观察","letter_title":"像信件标题一样的短标题","letter_body":"180字以内，像公司写给玩家的一封信，称呼你，不要像测评报告","evidence":["最多5条今天发生过的具体事"]}',
                    "分数范围 20-95。O=开放性，C=尽责性，E=外向性，A=宜人性，S=情绪稳定性。",
                    "不要出现“大模型、系统、测评、生成工具”等技术词。不要诊断疾病，只描述模拟内表现。",
                    "语气像：今天我们看见你如何在压力和选择之间做判断；既可以肯定，也可以提醒。",
                    "可用证据：",
                    "\n".join(f"- {item}" for item in evidence[-30:]),
                ]
            ),
        },
    ]

    try:
        raw_reply = ark_chat(messages=messages, temperature=0.4, max_tokens=700)
        parsed = _parse_json_object(raw_reply)
    except (ArkClientError, ValueError):
        return fallback

    scores = _normalize_scores(parsed.get("scores", fallback.scores))
    radar_items = _build_radar_items(scores)
    selected_evidence = parsed.get("evidence", evidence[-5:])
    if not isinstance(selected_evidence, list):
        selected_evidence = evidence[-5:]

    return ActiveReportState(
        report_id="daily_big_five",
        time=REPORT_TRIGGER_TIME,
        title="熊起东方写给你的信",
        trait_summary=str(parsed.get("trait_summary") or fallback.trait_summary)[:120],
        letter_title=str(parsed.get("letter_title") or fallback.letter_title)[:40],
        letter_body=str(parsed.get("letter_body") or fallback.letter_body)[:220],
        scores=scores,
        radar_items=radar_items,
        evidence=[str(item)[:140] for item in selected_evidence[:5]],
        day=world.company.day,
        step=world.company.step,
        clock=clock,
        provider="ark",
    )


def _fallback_report(
    world: WorldRuntimeState,
    *,
    evidence: list[str],
    clock: str,
) -> ActiveReportState:
    source = "\n".join(evidence)
    scores = {
        "O": _keyword_score(source, ["创意", "变化", "尝试", "方案", "探索", "新"]),
        "C": _keyword_score(source, ["计划", "细节", "标准", "清单", "截止", "成本", "风险", "确认"]),
        "E": _keyword_score(source, ["推进", "拍板", "争取", "客户", "资源", "目标", "说服"]),
        "A": _keyword_score(source, ["团队", "沟通", "感受", "帮", "一起", "对齐", "信任"]),
        "S": _keyword_score(source, ["冷静", "稳", "风险", "先别急", "缓", "判断", "控制"]),
    }

    strongest = max(scores, key=scores.get)
    trait_summary = f"今天我们最清楚地看见了你的{BIG_FIVE_LABELS[strongest]}：你会盯住关键约束，把混乱的局面先变成可以讨论的选择。"

    return ActiveReportState(
        report_id="daily_big_five",
        time=REPORT_TRIGGER_TIME,
        title="熊起东方写给你的信",
        trait_summary=trait_summary,
        letter_title="今天，我们看见你如何做决定",
        letter_body="今天的公司并不轻松：突发事件、现金压力、团队意见和产品节奏一起压过来。我们看见你没有急着给出漂亮答案，而是先把风险、成本和人放在同一张桌上。你更像一个愿意稳住局面的人，哪怕这会让决定慢一点，也不愿让团队在没看清代价时冲出去。",
        scores=scores,
        radar_items=_build_radar_items(scores),
        evidence=evidence[-5:],
        day=world.company.day,
        step=world.company.step,
        clock=clock,
        provider="fallback",
    )


def _keyword_score(source: str, keywords: list[str]) -> int:
    hit_count = sum(source.count(keyword) for keyword in keywords)
    return min(95, max(20, 45 + hit_count * 6))


def _normalize_scores(raw_scores: Any) -> dict[str, int]:
    result: dict[str, int] = {}
    source = raw_scores if isinstance(raw_scores, dict) else {}

    for code in BIG_FIVE_LABELS:
        try:
            value = int(float(source.get(code, 60)))
        except (TypeError, ValueError):
            value = 60
        result[code] = min(95, max(20, value))

    return result


def _build_radar_items(scores: dict[str, int]) -> list[dict[str, Any]]:
    return [
        {
            "code": code,
            "label": label,
            "value": scores.get(code, 60),
        }
        for code, label in BIG_FIVE_LABELS.items()
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


def _dedupe_keep_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []

    for item in items:
        normalized = str(item or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)

    return result


def _is_at_or_after(clock: str, trigger_clock: str) -> bool:
    return _to_minutes(clock) >= _to_minutes(trigger_clock)


def _to_minutes(clock: str) -> int:
    hour_text, minute_text = str(clock or "00:00").split(":")
    return int(hour_text) * 60 + int(minute_text)
