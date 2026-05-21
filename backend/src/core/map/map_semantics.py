from __future__ import annotations


MOVABLE_LOCATIONS: dict[str, dict[str, object]] = {
    "open_office": {
        "name": "开放办公区",
        "function": "日常办公、技术开发、协作沟通",
        "can_move_to": True,
        "aliases": ["开放办公区"],
        "contains": ["工位", "电脑", "白板"],
    },
    "meeting_room": {
        "name": "会议室",
        "function": "正式讨论、复盘、方案评审、会议",
        "can_move_to": True,
        "aliases": ["会议室", "老板办公室"],
        "contains": ["会议桌", "投影"],
    },
    "reception_area": {
        "name": "会客区",
        "function": "接待外部人员、客户沟通、商务交流",
        "can_move_to": True,
        "aliases": ["会客区"],
        "contains": ["沙发", "茶几"],
    },
    "rest_area": {
        "name": "休闲区",
        "function": "短暂休息、非正式聊天、情绪缓冲",
        "can_move_to": True,
        "aliases": ["休闲区", "吊椅", "坐垫", "水池", "豆袋沙发", "沙发和熊"],
        "contains": ["吊椅", "坐垫", "水池", "豆袋沙发", "沙发和熊"],
    },
    "activity_area": {
        "name": "活动区",
        "function": "临时活动、团队互动、轻量讨论",
        "can_move_to": True,
        "aliases": ["活动区", "树底活动区", "树底座"],
        "contains": ["树底座", "活动空间"],
    },
}


DECORATIVE_OBJECTS: dict[str, dict[str, object]] = {
    "lamp": {
        "name": "灯",
        "kind": "decor",
        "can_move_to": False,
    },
    "bear": {
        "name": "熊",
        "kind": "decor",
        "can_move_to": False,
    },
}


def build_map_semantics() -> dict[str, object]:
    locations = []

    for location_id, item in MOVABLE_LOCATIONS.items():
        locations.append(
            {
                "location_id": location_id,
                "name": item["name"],
                "function": item["function"],
                "can_move_to": item["can_move_to"],
                "aliases": item["aliases"],
                "contains": item["contains"],
            }
        )

    objects = []

    for object_id, item in DECORATIVE_OBJECTS.items():
        objects.append(
            {
                "object_id": object_id,
                "name": item["name"],
                "kind": item["kind"],
                "can_move_to": item["can_move_to"],
            }
        )

    return {
        "locations": locations,
        "objects": objects,
    }


def normalize_location_name(raw_name: str) -> str:
    clean_name = str(raw_name or "").strip()

    for item in MOVABLE_LOCATIONS.values():
        aliases = [str(alias) for alias in item.get("aliases", [])]
        if clean_name == item["name"] or clean_name in aliases:
            return str(item["name"])

    return clean_name or "开放办公区"


def build_map_context_text() -> str:
    lines = ["公司空间："]

    for item in MOVABLE_LOCATIONS.values():
        contains = "、".join(str(value) for value in item.get("contains", []))
        lines.append(
            f"- {item['name']}：{item['function']}；包含：{contains}"
        )

    return "\n".join(lines)
