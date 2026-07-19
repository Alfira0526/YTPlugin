"""STT 백엔드 인터페이스.

모든 STT 백엔드는 오디오 파일 경로를 받아 중국어 Segment 리스트를 반환한다.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from ..segment import Segment


class STTBackend(ABC):
    """음성 → (중국어) 타임스탬프 세그먼트."""

    name: str = "base"

    @abstractmethod
    def transcribe(self, audio_path: str, language: str = "zh") -> list[Segment]:
        """오디오 파일을 전사하여 세그먼트 리스트로 반환."""
        raise NotImplementedError
