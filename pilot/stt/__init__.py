"""STT 백엔드 팩토리.

무거운 백엔드(torch/funasr 등)는 선택된 경우에만 지연 import 한다.
"""
from __future__ import annotations

from .base import STTBackend


def get_stt_backend(name: str, **kwargs) -> STTBackend:
    name = (name or "stub").lower()
    if name == "stub":
        from .stub import StubSTT
        return StubSTT()
    if name == "sensevoice":
        from .sensevoice import SenseVoiceSTT
        return SenseVoiceSTT(**kwargs)
    if name in ("qwen3-asr", "qwen3", "qwen"):
        from .qwen3_asr import Qwen3ASRSTT
        return Qwen3ASRSTT(**kwargs)
    raise ValueError(f"알 수 없는 STT 백엔드: {name!r} (stub|sensevoice|qwen3-asr)")


__all__ = ["STTBackend", "get_stt_backend"]
