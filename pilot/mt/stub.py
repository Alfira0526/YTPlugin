"""오프라인 스텁 MT — 결정론적 사전 기반 zh→ko 치환.

실제 번역 품질을 대표하지 않는다. 파이프라인 배관(번역 단계 → SRT)이
정상 동작하는지만 검증하기 위한 것. 사전에 없는 문자는 그대로 통과시킨다.
"""
from __future__ import annotations

from .base import MTBackend

# 스텁 STT의 합성 대사에 대응하는 최소 사전 (검증 목적)
_DICT = {
    "大家好，欢迎来到我的直播间。": "여러분 안녕하세요, 제 라이브 방송에 오신 걸 환영해요.",
    "今天天气很好，我很开心见到你们。": "오늘 날씨가 좋네요, 여러분을 만나서 정말 기뻐요.",
    "谢谢你们一直以来的支持。": "그동안 보내주신 성원에 감사드려요.",
    "我们下次再见，拜拜。": "다음에 또 만나요, 안녕.",
}


class StubMT(MTBackend):
    name = "stub"

    def translate(self, texts: list[str], source: str = "zh", target: str = "ko") -> list[str]:
        out: list[str] = []
        for t in texts:
            self.usage.source_chars += len(t)
            self.usage.calls += 1
            out.append(_DICT.get(t.strip(), f"[미번역] {t}"))
        return out
