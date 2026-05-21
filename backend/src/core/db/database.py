from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any


DB_PATH = Path(__file__).resolve().parents[3] / "data" / "newbear.db"


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ended_at TEXT,
                current_state_json TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS user_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_id TEXT NOT NULL,
                clock TEXT NOT NULL,
                scene TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(session_id) REFERENCES sessions(id)
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_id TEXT NOT NULL,
                clock TEXT NOT NULL,
                scores_json TEXT NOT NULL,
                report_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(session_id) REFERENCES sessions(id)
            )
            """
        )


def save_world_state(session_id: str, state: dict[str, Any]) -> None:
    raw = json.dumps(state, ensure_ascii=False)

    with get_connection() as connection:
        connection.execute(
            """
            UPDATE sessions
            SET current_state_json = ?
            WHERE id = ?
            """,
            (raw, session_id),
        )


def save_user_message(
    *,
    user_id: int,
    session_id: str,
    clock: str,
    scene: str,
    message: str,
) -> None:
    clean_message = str(message or "").strip()
    if not clean_message:
        return

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO user_messages (user_id, session_id, clock, scene, message)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, session_id, clock, scene, clean_message),
        )


def save_report(
    *,
    user_id: int,
    session_id: str,
    clock: str,
    scores: dict[str, Any],
    report: dict[str, Any],
) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO reports (user_id, session_id, clock, scores_json, report_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                user_id,
                session_id,
                clock,
                json.dumps(scores, ensure_ascii=False),
                json.dumps(report, ensure_ascii=False),
            ),
        )


def report_exists(session_id: str) -> bool:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id FROM reports
            WHERE session_id = ?
            LIMIT 1
            """,
            (session_id,),
        ).fetchone()

    return row is not None
