"""Qwen3-ASR STT 백엔드 (1차 채택 모델, 개발계획서 v1.1 §3-1).

중국어 방언 22개 포함 52개 언어 지원. 경량(0.6B~1.7B)이라 저비용 인프라에 유리.

실행 경로는 파일럿에서 아래 두 가지 중 하나로 확정한다(§확인필요):
  (1) 로컬 추론: transformers/modelscope로 가중치 로드 후 오프라인 추론
  (2) API 추론: DashScope의 qwen3-asr 엔드포인트 호출(키 필요)

이 파일은 로컬 추론(1)을 기본 골격으로 둔다. 무거운 import는 지연 로드하며,
정확한 모델 ID·전처리·타임스탬프 산출은 로컬/GPU 실행 시 실측 검증할 것.

⚠️ 네트워크 정책상 HF/ModelScope 접근이 허용된 환경에서만 실행 가능.
"""
from __future__ import annotations

from ..segment import Segment
from .base import STTBackend

# 파일럿에서 실제 배포 ID로 확정할 것 (Qwen3-ASR 계열).
_MODEL_ID = "Qwen/Qwen3-ASR"


class Qwen3ASRSTT(STTBackend):
    name = "qwen3-asr"

    def __init__(self, device: str = "cpu", model_id: str | None = None) -> None:
        self._model_id = model_id or _MODEL_ID
        self._device = device
        self._loaded = False
        self._pipe = None

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        try:
            # 실제 로딩 방식은 모델 카드에 맞춰 파일럿에서 확정.
            from transformers import pipeline  # type: ignore
        except ImportError as exc:  # pragma: no cover - 환경 의존
            raise RuntimeError(
                "Qwen3-ASR(로컬) 백엔드에는 transformers/torch가 필요합니다: "
                "pip install transformers torch torchaudio"
            ) from exc
        # NOTE: 파일럿에서 task/청킹/타임스탬프 반환 옵션을 모델 카드 기준으로 확정.
        self._pipe = pipeline(
            task="automatic-speech-recognition",
            model=self._model_id,
            device=self._device,
            return_timestamps=True,
        )
        self._loaded = True

    def transcribe(self, audio_path: str, language: str = "zh") -> list[Segment]:
        self._ensure_loaded()
        assert self._pipe is not None
        result = self._pipe(
            audio_path,
            generate_kwargs={"language": "zh"} if language.startswith("zh") else {},
        )
        return _parse_hf_chunks(result)


def _parse_hf_chunks(result) -> list[Segment]:
    """transformers ASR pipeline 결과(chunks[{timestamp:(s,e), text}]) → Segment."""
    segments: list[Segment] = []
    chunks = result.get("chunks") if isinstance(result, dict) else None
    if chunks:
        for ch in chunks:
            ts = ch.get("timestamp") or (0.0, 0.0)
            start = float(ts[0] or 0.0)
            end = float(ts[1] or start)
            text = str(ch.get("text", "")).strip()
            if text:
                segments.append(Segment(start=start, end=end, text=text))
    elif isinstance(result, dict) and result.get("text"):
        segments.append(Segment(start=0.0, end=0.0, text=str(result["text"]).strip()))
    return segments
