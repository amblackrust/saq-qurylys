"""Support for the tests that run the collection: its locks live in Redis."""

import os
from collections.abc import Iterator

import pytest
from redis import Redis

from app.config import get_settings

# Use one configurable URL for every test Redis client, including the collection locks.
TEST_REDIS_URL = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/15")


def lock_db() -> Redis:
    """The Redis database that holds the locks during the tests."""
    return Redis.from_url(TEST_REDIS_URL)


@pytest.fixture
def collect_locks(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(get_settings(), "redis_url", TEST_REDIS_URL)
    with lock_db() as client:
        client.flushdb()
        yield
        client.flushdb()
