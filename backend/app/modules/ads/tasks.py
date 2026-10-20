import logging

import httpx
from sqlalchemy import case, or_, update

from app import collectors
from app.config import get_settings
from app.db import get_sessionmaker
from app.events import objects_changed
from app.models import AdPost
from app.models.enums import AnalysisStatus, CaptureStatus, LlmStatus
from app.modules.ads import recheck, service
from app.modules.ads.capture import USER_AGENT, capture_ad
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

# A capture is bounded by the browser timeouts; the limits stop a hung browser from holding the worker.
CAPTURE_SOFT_LIMIT_S = 150
CAPTURE_HARD_LIMIT_S = 180

# The collectors that are switched on in `.env` are registered when the worker loads its tasks.
collectors.register_enabled(get_settings(), collectors.default_client())


@celery_app.task(name="archive.capture", soft_time_limit=CAPTURE_SOFT_LIMIT_S, time_limit=CAPTURE_HARD_LIMIT_S)
def capture(ad_post_id: int, requested_by: int | None = None) -> None:
    try:
        with get_sessionmaker()() as session:
            capture_ad(session, ad_post_id, requested_by)
    except Exception:
        logger.exception("archive.capture: task failed for ad_post %s", ad_post_id)
        try:
            with get_sessionmaker()() as failure_session:
                failure_session.execute(
                    update(AdPost)
                    .where(
                        AdPost.id == ad_post_id,
                        or_(AdPost.capture_status.is_(None), AdPost.capture_status != CaptureStatus.done),
                    )
                    .values(
                        capture_status=CaptureStatus.failed,
                        capture_error="Не удалось завершить фиксацию",
                    )
                )
                failure_session.execute(
                    update(AdPost)
                    .where(AdPost.id == ad_post_id, AdPost.analysis_status == AnalysisStatus.pending)
                    .values(
                        analysis_status=AnalysisStatus.failed,
                        llm_status=case(
                            (AdPost.llm_status == LlmStatus.pending, LlmStatus.failed),
                            else_=AdPost.llm_status,
                        ),
                    )
                )
                failure_session.commit()
        except Exception:
            logger.exception("archive.capture: failed to persist failure state for ad_post %s", ad_post_id)
        raise


@celery_app.task(name="ads.recheck_due")
def recheck_due() -> None:
    with (
        get_sessionmaker()() as session,
        httpx.Client(timeout=recheck.CHECK_TIMEOUT_S, headers={"User-Agent": USER_AGENT}) as client,
    ):
        removed_objects = recheck.recheck_due(session, client)
        # The ad window slides with time: claims that fell out of it no longer count.
        refreshed_objects = service.refresh_all_claimed_readiness(session)
        session.commit()
    objects_changed([*removed_objects, *refreshed_objects])


# The pipeline of every new post is queued by the collection itself, right after the post is saved.
@celery_app.task(name="collect.run_all")
def run_all() -> None:
    with get_sessionmaker()() as session:
        service.run_collectors(session)


@celery_app.task(name="collect.source")
def collect_source(source_id: int) -> None:
    with get_sessionmaker()() as session:
        service.collect_source(session, source_id)
