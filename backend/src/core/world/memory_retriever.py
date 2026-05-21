from __future__ import annotations

from src.core.world.runtime_state import ActorRuntimeState, MemoryRecord


def retrieve_relevant_memories(
    actor: ActorRuntimeState,
    *,
    query: str,
    limit: int = 6,
) -> list[str]:
    query_terms = _extract_terms(query)
    scored: list[tuple[float, MemoryRecord]] = []

    total = len(actor.memory_stream)

    for index, memory in enumerate(actor.memory_stream):
        recency_score = index / max(1, total)
        importance_score = memory.importance / 10
        relevance_score = _keyword_score(memory.text, query_terms)

        score = recency_score * 0.25 + importance_score * 0.35 + relevance_score * 0.4
        scored.append((score, memory))

    scored.sort(key=lambda item: item[0], reverse=True)

    return [memory.text for _, memory in scored[:limit]]


def _extract_terms(query: str) -> list[str]:
    source = str(query or "").strip()
    if not source:
        return []

    important_terms = [
        "现金",
        "客户",
        "竞对",
        "挖走",
        "离职",
        "预算",
        "延期",
        "Demo",
        "传播",
        "技术",
        "会议",
        "成本",
        "需求",
    ]

    return [term for term in important_terms if term in source]


def _keyword_score(text: str, terms: list[str]) -> float:
    if not terms:
        return 0.0

    hit_count = sum(1 for term in terms if term in text)
    return min(1.0, hit_count / max(1, len(terms)))
