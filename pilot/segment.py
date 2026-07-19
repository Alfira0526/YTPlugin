"""자막 세그먼트 데이터 모델.

STT는 중국어 세그먼트 리스트를 만들고, MT는 각 세그먼트의 text를 한국어로 치환한다.
방식 (a) tabCapture(스트리밍)든 (b) 서버 배치든 이 자료형을 공유한다.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace


@dataclass
class Segment:
    """시간 구간을 가진 자막 한 줄.

    start, end: 초 단위(float)
    text: 발화/번역 텍스트
    """
    start: float
    end: float
    text: str
    # 원문(중국어)을 보존해 두면 파일럿 메모에서 대조 검토가 쉽다.
    source_text: str = field(default="")

    def with_text(self, text: str) -> "Segment":
        """번역 결과로 text만 바꾼 새 세그먼트를 반환(원문은 source_text로 이동)."""
        return replace(self, text=text, source_text=self.source_text or self.text)

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)
