"""재사용 파이프라인 코어: 오디오 → STT → MT → (한국어) 세그먼트.

방식 (a) tabCapture(스트리밍)든 (b) 서버 배치든 이 코어를 공유한다.
(a)에서는 오디오 청크를 잘라 transcribe를 반복 호출하는 어댑터가 이 코어를 감싸고,
(b)에서는 전체 파일을 한 번에 넘긴다. P0에서는 배치 경로만 구현한다.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from .mt import get_mt_backend
from .mt.base import MTUsage
from .segment import Segment
from .stt import get_stt_backend


@dataclass
class PipelineResult:
    segments: list[Segment]          # 한국어(번역) 세그먼트
    source_segments: list[Segment]   # 중국어(원문) 세그먼트
    stt_seconds: float = 0.0
    mt_seconds: float = 0.0
    mt_usage: MTUsage = field(default_factory=MTUsage)
    stt_backend: str = ""
    mt_backend: str = ""
    cache_hit: bool = False          # 캐시에서 가져왔는지(§3-4)

    @property
    def total_seconds(self) -> float:
        return self.stt_seconds + self.mt_seconds


def run_pipeline(
    audio_path: str,
    stt_backend: str = "stub",
    mt_backend: str = "stub",
    source_lang: str = "zh",
    target_lang: str = "ko",
    video_id: str | None = None,
    cache=None,
) -> PipelineResult:
    """오디오 한 개를 전사·번역하여 결과를 반환.

    cache(SubtitleCache)와 video_id가 주어지면 캐시 우선 조회 → 미스 시에만
    STT·MT를 실행하고 결과를 저장한다(§3-4 비용 절감).
    """
    # 캐시 우선 조회
    if cache is not None and video_id and cache.has(video_id):
        ko_segments = cache.get(video_id) or []
        src_segments = [
            Segment(start=s.start, end=s.end, text=(s.source_text or s.text))
            for s in ko_segments
        ]
        return PipelineResult(
            segments=ko_segments,
            source_segments=src_segments,
            stt_backend="cache",
            mt_backend="cache",
            cache_hit=True,
        )

    stt = get_stt_backend(stt_backend)
    mt = get_mt_backend(mt_backend)

    t0 = time.perf_counter()
    source_segments = stt.transcribe(audio_path, language=source_lang)
    t1 = time.perf_counter()

    texts = [s.text for s in source_segments]
    translated = mt.translate(texts, source=source_lang, target=target_lang) if texts else []
    t2 = time.perf_counter()

    ko_segments = [
        seg.with_text(ko) for seg, ko in zip(source_segments, translated)
    ]

    # 캐시에 저장(다음 시청부터 재처리 생략)
    if cache is not None and video_id:
        cache.put(
            video_id,
            ko_segments,
            meta={"stt": stt.name, "mt": mt.name, "source_chars": getattr(mt, "usage", MTUsage()).source_chars},
        )

    return PipelineResult(
        segments=ko_segments,
        source_segments=source_segments,
        stt_seconds=t1 - t0,
        mt_seconds=t2 - t1,
        mt_usage=getattr(mt, "usage", MTUsage()),
        stt_backend=stt.name,
        mt_backend=mt.name,
        cache_hit=False,
    )
