"""Anonymous per-install accounts and simple abuse protection.

The extension calls POST /auth/register once, stores the returned API key in
browser storage and sends it as `Authorization: Bearer <key>` on every request.
Only a SHA-256 hash of the key is stored, so a database leak does not reveal keys.
"""
import hashlib
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

KEY_PREFIX = 'af_'


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode('utf-8')).hexdigest()


def create_user(db: Session) -> str:
    key = KEY_PREFIX + secrets.token_urlsafe(32)
    db.add(User(id=secrets.token_hex(16), key_hash=hash_key(key)))
    db.commit()
    return key


def _key_from(request: Request) -> str:
    header = request.headers.get('authorization', '')
    if header.lower().startswith('bearer '):
        return header[7:].strip()
    return request.headers.get('x-api-key', '').strip()


def current_user(request: Request, db: Session = Depends(get_db)) -> str:
    key = _key_from(request)
    if not key.startswith(KEY_PREFIX):
        raise HTTPException(401, 'Missing or invalid API key.', headers={'WWW-Authenticate': 'Bearer'})
    user = db.query(User).filter(User.key_hash == hash_key(key)).first()
    if user is None:
        raise HTTPException(401, 'Unknown API key.', headers={'WWW-Authenticate': 'Bearer'})
    now = datetime.utcnow()
    if not user.last_seen_at or now - user.last_seen_at > timedelta(hours=1):
        user.last_seen_at = now
        db.commit()
    # Scope every later query in this request's session to this user (database.py).
    db.info['user_id'] = user.id
    return user.id


class RateLimiter:
    """Sliding-window limiter kept in memory. Good enough for one free-tier instance."""

    def __init__(self):
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, bucket: str, limit: int, window_seconds: int = 3600):
        if limit <= 0:
            return
        now = time.monotonic()
        with self._lock:
            hits = self._hits[bucket]
            while hits and now - hits[0] > window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                retry = int(window_seconds - (now - hits[0])) + 1
                raise HTTPException(429, f'Rate limit reached. Try again in about {max(1, retry // 60)} minute(s).',
                                    headers={'Retry-After': str(retry)})
            hits.append(now)
            if len(self._hits) > 50_000:  # keep memory bounded
                for key in [k for k, v in self._hits.items() if not v or now - v[-1] > window_seconds]:
                    del self._hits[key]

    def reset(self):
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    # uvicorn runs with --proxy-headers on hosts like Render, so request.client is the real client.
    return request.client.host if request.client else 'unknown'
