from __future__ import annotations

from copy import deepcopy
from typing import Any

from src.core.config.character_profiles import (
    CHARACTER_ORDER,
    CHARACTER_PROFILES,
    RELATIONSHIP_NOTES,
)
from src.core.config.company_profile import COMPANY_PROFILE
from src.core.config.job_profiles import JOB_PROFILES


def load_world_seed() -> dict[str, Any]:
    """把公司表、岗位表、人物表装配成一个统一的世界初始对象。"""

    company = deepcopy(COMPANY_PROFILE)

    characters: list[dict[str, Any]] = []

    for actor_id in CHARACTER_ORDER:
        character_profile = deepcopy(CHARACTER_PROFILES[actor_id])

        job_key = str(character_profile.get("job_key", "general")).strip() or "general"
        job_profile = deepcopy(JOB_PROFILES.get(job_key, JOB_PROFILES["general"]))

        relationships = deepcopy(RELATIONSHIP_NOTES.get(actor_id, {}))

        characters.append(
            {
                "actor_id": actor_id,
                "display_name": character_profile.get("display_name", actor_id),
                "job_key": job_key,
                "character_profile": character_profile,
                "job_profile": job_profile,
                "relationships": relationships,
            }
        )

    return {
        "company": company,
        "characters": characters,
    }
