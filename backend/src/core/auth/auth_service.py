from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass

from src.core.db.database import get_connection


@dataclass
class AuthUser:
    user_id: int
    username: str
    session_id: str


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    raw = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    ).hex()
    return f"{salt}${raw}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, expected_hash = password_hash.split("$", 1)
    except ValueError:
        return False

    actual_hash = hash_password(password, salt).split("$", 1)[1]
    return hmac.compare_digest(actual_hash, expected_hash)


def create_user(username: str, password: str) -> AuthUser:
    clean_username = username.strip()
    if not clean_username:
        raise ValueError("用户名不能为空")
    if not password:
        raise ValueError("密码不能为空")

    session_id = uuid.uuid4().hex
    password_hash = hash_password(password)

    with get_connection() as connection:
        try:
            cursor = connection.execute(
                """
                INSERT INTO users (username, password_hash)
                VALUES (?, ?)
                """,
                (clean_username, password_hash),
            )
        except Exception as exc:
            raise ValueError("用户名已存在") from exc

        user_id = int(cursor.lastrowid)
        connection.execute(
            """
            INSERT INTO sessions (id, user_id)
            VALUES (?, ?)
            """,
            (session_id, user_id),
        )

    return AuthUser(user_id=user_id, username=clean_username, session_id=session_id)


def login_user(username: str, password: str) -> AuthUser:
    clean_username = username.strip()

    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, username, password_hash
            FROM users
            WHERE username = ?
            """,
            (clean_username,),
        ).fetchone()

        if row is None or not verify_password(password, str(row["password_hash"])):
            raise ValueError("用户名或密码错误")

        session_id = uuid.uuid4().hex
        user_id = int(row["id"])
        connection.execute(
            """
            INSERT INTO sessions (id, user_id)
            VALUES (?, ?)
            """,
            (session_id, user_id),
        )

    return AuthUser(
        user_id=user_id,
        username=str(row["username"]),
        session_id=session_id,
    )


def get_user_by_session(session_id: str) -> AuthUser | None:
    if not session_id:
        return None

    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT users.id AS user_id, users.username AS username, sessions.id AS session_id
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.id = ?
              AND sessions.ended_at IS NULL
            """,
            (session_id,),
        ).fetchone()

    if row is None:
        return None

    return AuthUser(
        user_id=int(row["user_id"]),
        username=str(row["username"]),
        session_id=str(row["session_id"]),
    )


def logout_session(session_id: str) -> None:
    if not session_id:
        return

    with get_connection() as connection:
        connection.execute(
            """
            UPDATE sessions
            SET ended_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (session_id,),
        )
