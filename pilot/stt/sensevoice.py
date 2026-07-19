"""SenseVoice STT 백엔드 (대안 모델, 개발계획서 v1.1 §3-1).

FunASR의 AutoModel 인터페이스를 사용한다. CPU에서도 비교적 빠르게 동작해
GPU 미보유 환경의 파일럿 비교군으로 적합하다.

의존성: `pip install funasr torch torchaudio`
가중치: HuggingFace/ModelScope에서 최초 실행 시 자동 다운로드
        (⚠️ 네트워크 정책상 HF/ModelScope 접근이 허용된 환경에서만 실행 가능)

※ 이 백엔드는 HF 접근이 차단된 웹 샌드박스에서는 실행 불가하며,
  로컬/GPU 환경 실행 시점에 모델 ID·타임스탬프 포맷을 실측 검증할 것.
"""
from __future__ import annotations

from ..segment import Segment
from .base import STTBackend

_MODEL_ID = "iic/SenseVoiceSmall"


class SenseVoiceSTT(STTBackend):
    name = "sensevoice"

    def __init__(self, device: str = "cpu") -> None:
        # 무거운 import는 인스턴스 생성 시점까지 지연 (모듈 로드만으로 실패하지 않도록)
        try:
            from funasr import AutoModel  # type: ignore
        except ImportError as exc:  # pragma: no cover - 환경 의존
            raise RuntimeError(
                "SenseVoice 백엔드에는 funasr가 필요합니다: pip install funasr torch torchaudio"
            ) from exc

        # VAD를 붙여 문장 단위 타임스탬프 세그먼트를 얻는다.
        self._model = AutoModel(
            model=_MODEL_ID,
            vad_model="fsmn-vad",
            vad_kwargs={"max_single_segment_time": 30000},
            device=device,
        )

    def transcribe(self, audio_path: str, language: str = "zh") -> list[Segment]:
        results = self._model.generate(
            input=audio_path,
            language="zh" if language.startswith("zh") else language,
            use_itn=True,
            batch_size_s=60,
        )
        return _parse_funasr_result(results)


def _parse_funasr_result(results) -> list[Segment]:
    """FunASR generate() 결과 → Segment 리스트.

    FunASR는 sentence_info(문장별 start/end ms + text)를 제공한다.
    포맷이 버전에 따라 다를 수 있어 방어적으로 파싱한다(파일럿에서 실측 확정).
    """
    segments: list[Segment] = []
    if not results:
        return segments
    first = results[0]
    sentences = first.get("sentence_info") if isinstance(first, dict) else None
    if sentences:
        for s in sentences:
            start = float(s.get("start", 0)) / 1000.0
            end = float(s.get("end", 0)) / 1000.0
            text = str(s.get("text", "")).strip()
            if text:
                segments.append(Segment(start=start, end=end, text=text))
    else:
        # 타임스탬프가 없으면 전체를 한 세그먼트로 (파일럿 육안 검증엔 충분)
        text = str(first.get("text", "")).strip() if isinstance(first, dict) else str(first)
        if text:
            segments.append(Segment(start=0.0, end=0.0, text=text))
    return segments
