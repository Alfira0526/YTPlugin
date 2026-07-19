"""MT 백엔드 인터페이스.

모든 MT 백엔드는 중국어 텍스트 리스트를 받아 같은 길이의 한국어 텍스트 리스트를 반환한다.
글자수 카운트(비용 실측용)를 위해 usage 정보도 노출한다.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class MTUsage:
    """번역 소모량 — 비용/무료한도 실측(개발계획서 v1.1 §5)용."""
    source_chars: int = 0
    calls: int = 0
    extra: dict = field(default_factory=dict)


class MTBackend(ABC):
    name: str = "base"

    def __init__(self) -> None:
        self.usage = MTUsage()

    @abstractmethod
    def translate(self, texts: list[str], source: str = "zh", target: str = "ko") -> list[str]:
        """텍스트 리스트를 번역하여 같은 순서의 결과 리스트로 반환."""
        raise NotImplementedError
