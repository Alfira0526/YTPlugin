"""SRT 직렬화 유틸 (third-party 의존성 없이 순수 파이썬).

외부 라이브러리에 의존하지 않으므로, 모델/키가 없는 스모크 테스트에서도 동작한다.
"""
from __future__ import annotations

from typing import Iterable

from .segment import Segment


def _format_timestamp(seconds: float) -> str:
    """초(float) → 'HH:MM:SS,mmm' (SRT 표준)."""
    if seconds < 0:
        seconds = 0.0
    millis_total = int(round(seconds * 1000))
    hours, millis_total = divmod(millis_total, 3_600_000)
    minutes, millis_total = divmod(millis_total, 60_000)
    secs, millis = divmod(millis_total, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def to_srt(segments: Iterable[Segment]) -> str:
    """세그먼트 리스트 → SRT 문자열."""
    blocks: list[str] = []
    for idx, seg in enumerate(segments, start=1):
        start = _format_timestamp(seg.start)
        end = _format_timestamp(seg.end)
        text = (seg.text or "").strip()
        blocks.append(f"{idx}\n{start} --> {end}\n{text}\n")
    return "\n".join(blocks)


def write_srt(segments: Iterable[Segment], path: str) -> str:
    """SRT 파일로 저장하고 경로를 반환."""
    content = to_srt(segments)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    return path
