"""MT 백엔드 팩토리."""
from __future__ import annotations

from ..config import Config
from .base import MTBackend, MTUsage


def get_mt_backend(name: str, config: Config | None = None) -> MTBackend:
    name = (name or "stub").lower()
    cfg = config or Config.from_env()
    if name == "stub":
        from .stub import StubMT
        return StubMT()
    if name == "deepl":
        from .deepl_mt import DeepLMT
        return DeepLMT(api_key=cfg.deepl_api_key)
    if name == "papago":
        from .papago_mt import PapagoMT
        return PapagoMT(cfg.papago_client_id, cfg.papago_client_secret)
    raise ValueError(f"알 수 없는 MT 백엔드: {name!r} (stub|deepl|papago)")


__all__ = ["MTBackend", "MTUsage", "get_mt_backend"]
