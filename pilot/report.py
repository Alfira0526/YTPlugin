"""파일럿 메모 생성 — PipelineResult를 템플릿에 채워 마크다운으로 출력."""
from __future__ import annotations

from pathlib import Path

from .pipeline import PipelineResult

_TEMPLATE_PATH = Path(__file__).resolve().parent / "templates" / "pilot_memo_template.md"


def _sample_pairs(result: PipelineResult, limit: int = 6) -> str:
    lines: list[str] = []
    for src, ko in zip(result.source_segments[:limit], result.segments[:limit]):
        ts = f"[{src.start:6.1f}s → {src.end:6.1f}s]"
        lines.append(f"- {ts}\n    - 中: {src.text}\n    - 韓: {ko.text}")
    return "\n".join(lines) if lines else "(세그먼트 없음)"


def render_memo(result: PipelineResult, video_id: str, audio_path: str, date: str) -> str:
    template = _TEMPLATE_PATH.read_text(encoding="utf-8")
    return template.format(
        video_id=video_id,
        date=date,
        audio_path=audio_path,
        stt_backend=result.stt_backend,
        mt_backend=result.mt_backend,
        n_segments=len(result.segments),
        stt_seconds=result.stt_seconds,
        mt_seconds=result.mt_seconds,
        total_seconds=result.total_seconds,
        mt_source_chars=result.mt_usage.source_chars,
        mt_calls=result.mt_usage.calls,
        sample_pairs=_sample_pairs(result),
    )
