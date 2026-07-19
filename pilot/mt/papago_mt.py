"""Papago MT 백엔드 (대안, 개발계획서 v1.1 §3-2).

Naver Cloud Platform Papago Text Translation API.
키: PAPAGO_CLIENT_ID / PAPAGO_CLIENT_SECRET (.env)
무료한도: 확인필요 — 파일럿 ③에서 실측 (인수인계문서 §7-2)

⚠️ naveropenapi.apigw.ntruss.com 호스트 접근이 허용된 환경 + 유효 키 필요.
"""
from __future__ import annotations

from .base import MTBackend

_ENDPOINT = "https://naveropenapi.apigw.ntruss.com/nmt/v1/translation"


class PapagoMT(MTBackend):
    name = "papago"

    def __init__(self, client_id: str, client_secret: str) -> None:
        super().__init__()
        if not (client_id and client_secret):
            raise RuntimeError("Papago 백엔드에는 PAPAGO_CLIENT_ID/SECRET이 필요합니다(.env).")
        self._client_id = client_id
        self._client_secret = client_secret
        try:
            import requests  # type: ignore
        except ImportError as exc:  # pragma: no cover - 환경 의존
            raise RuntimeError("Papago 백엔드에는 requests가 필요합니다: pip install requests") from exc
        self._requests = requests

    def translate(self, texts: list[str], source: str = "zh", target: str = "ko") -> list[str]:
        headers = {
            "X-NCP-APIGW-API-KEY-ID": self._client_id,
            "X-NCP-APIGW-API-KEY": self._client_secret,
        }
        out: list[str] = []
        # Papago는 건별 호출 — 파일럿에서 호출 수·글자수로 원가 실측
        for t in texts:
            self.usage.source_chars += len(t)
            self.usage.calls += 1
            resp = self._requests.post(
                _ENDPOINT,
                headers=headers,
                data={"source": "zh-CN", "target": "ko", "text": t},
                timeout=30,
            )
            resp.raise_for_status()
            out.append(resp.json()["message"]["result"]["translatedText"])
        return out
