"""고유명사 용어집 (개발계획서 요구사항 4 / 결정대기 Q-2).

파일럿 ②에서 드러난 고유명사·지명 오류(미란→밀라노, 커모호→코모 호수 등)를
번역 후처리로 교정한다. 현재는 **opt-in**(기본 비활성) — MVP 편입 여부는 사용자 결정 대기.

적용 방식(MVP): 번역된 한국어 텍스트에 대해 사전 치환(긴 항목 우선 매칭).
향후: 번역 전 고유명사 보호(플레이스홀더)로 고도화 가능.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

SEED_PATH = Path(__file__).resolve().parent / "seed.json"


class Glossary:
    def __init__(self, entries: list[dict] | None = None) -> None:
        # {from: to} 매핑. 긴 from 우선(부분 겹침 방지)으로 정렬 보관.
        self._pairs: list[tuple[str, str]] = []
        for e in entries or []:
            src = str(e.get("from", "")).strip()
            dst = str(e.get("to", "")).strip()
            if src and dst:
                self._pairs.append((src, dst))
        self._pairs.sort(key=lambda p: len(p[0]), reverse=True)
        self._map = dict(self._pairs)
        # 긴 항목 우선 대안(alternation)으로 단일 패스 치환 → 교체 결과 재매칭 방지
        self._regex = (
            re.compile("|".join(re.escape(src) for src, _ in self._pairs))
            if self._pairs
            else None
        )

    @classmethod
    def from_json(cls, path: str | Path | None = None) -> "Glossary":
        p = Path(path) if path else SEED_PATH
        data = json.loads(Path(p).read_text(encoding="utf-8"))
        return cls(data.get("entries", []))

    @property
    def size(self) -> int:
        return len(self._pairs)

    def apply(self, text: str) -> str:
        """텍스트에 용어집을 적용해 교정된 텍스트를 반환.

        단일 정규식 패스로 치환하여, 교체 결과 텍스트가 다른 항목에 재매칭되는
        문제를 방지한다(예: 'AD라디오'→'AD 잡지' 이후 'AD'가 재치환되지 않음).
        """
        if not text or self._regex is None:
            return text
        return self._regex.sub(lambda m: self._map[m.group(0)], text)
