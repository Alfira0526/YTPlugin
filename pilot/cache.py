"""자막 캐시 (개발계획서 §3-4 / 결정 D-8).

video_id → 자막 데이터(타임스탬프 + 한국어 텍스트) 로컬 KV 저장소.
팬덤 특성상 동일 영상을 다수가 반복 시청 → STT·MT 비용이 '영상 수'에만 비례하고
'시청 수'에는 비례하지 않게 만드는 핵심 비용 절감 장치.

오디오 확보 방식 (a)/(b)와 무관(video_id 키). 현재는 로컬 JSON 백엔드이며,
(b) 채택 시 동일 인터페이스로 서버/오브젝트 스토리지 백엔드로 교체 가능.
"""
from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Optional

from .config import CACHE_DIR
from .segment import Segment

SCHEMA_VERSION = 1


class SubtitleCache:
    def __init__(self, cache_dir: Path | str | None = None) -> None:
        self.cache_dir = Path(cache_dir) if cache_dir else CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, video_id: str) -> Path:
        # video_id는 파일명에 안전한 문자만 통과(경로 조작 방지)
        safe = "".join(c for c in str(video_id) if c.isalnum() or c in ("-", "_"))
        if not safe:
            raise ValueError(f"유효하지 않은 video_id: {video_id!r}")
        return self.cache_dir / f"{safe}.json"

    def has(self, video_id: str) -> bool:
        try:
            return self._path(video_id).exists()
        except ValueError:
            return False

    def get(self, video_id: str) -> Optional[list[Segment]]:
        """캐시된 한국어 자막 세그먼트를 반환(없으면 None)."""
        try:
            path = self._path(video_id)
        except ValueError:
            return None
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        segs = data.get("segments", [])
        return [
            Segment(
                start=float(s["start"]),
                end=float(s["end"]),
                text=s.get("text", ""),
                source_text=s.get("source_text", ""),
            )
            for s in segs
        ]

    def put(self, video_id: str, segments: list[Segment], meta: dict | None = None) -> Path:
        """한국어 자막 세그먼트를 캐시에 저장하고 경로를 반환."""
        path = self._path(video_id)
        payload = {
            "schema": SCHEMA_VERSION,
            "video_id": video_id,
            "meta": meta or {},
            "segments": [asdict(s) for s in segments],
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def keys(self) -> list[str]:
        return [p.stem for p in self.cache_dir.glob("*.json")]
