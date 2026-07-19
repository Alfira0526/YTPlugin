"""오프라인 스텁 STT — 모델/네트워크 없이 파이프라인 배관 검증용.

실제 음성인식을 하지 않는다. 합성 중국어 세그먼트(타임스탬프 포함)를 만들어
스모크 테스트에서 STT→MT→SRT 흐름이 정상 동작하는지만 확인한다.
"""
from __future__ import annotations

from ..segment import Segment
from .base import STTBackend

# 스모크용 합성 대사 (타깃 도메인: 배우/아이돌 라이브 인사말 느낌의 표준중국어)
_SYNTHETIC_LINES = [
    "大家好，欢迎来到我的直播间。",
    "今天天气很好，我很开心见到你们。",
    "谢谢你们一直以来的支持。",
    "我们下次再见，拜拜。",
]


class StubSTT(STTBackend):
    name = "stub"

    def transcribe(self, audio_path: str, language: str = "zh") -> list[Segment]:
        segments: list[Segment] = []
        cursor = 0.0
        for line in _SYNTHETIC_LINES:
            dur = 2.5
            segments.append(Segment(start=cursor, end=cursor + dur, text=line))
            cursor += dur
        return segments
