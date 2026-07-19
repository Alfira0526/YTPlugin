"""DeepL MT 백엔드 (1차 채택, 개발계획서 v1.1 §3-2).

의존성: `pip install deepl`
키: 환경변수 DEEPL_API_KEY (.env)
무료한도: 월 50만자 (개인용 규모 — §3-2 유의사항 참조)

⚠️ api-free.deepl.com 호스트 접근이 허용된 환경 + 유효 키가 있어야 실행 가능.
"""
from __future__ import annotations

from .base import MTBackend


class DeepLMT(MTBackend):
    name = "deepl"

    def __init__(self, api_key: str) -> None:
        super().__init__()
        if not api_key:
            raise RuntimeError("DeepL 백엔드에는 DEEPL_API_KEY가 필요합니다(.env).")
        try:
            import deepl  # type: ignore
        except ImportError as exc:  # pragma: no cover - 환경 의존
            raise RuntimeError("DeepL 백엔드에는 deepl 패키지가 필요합니다: pip install deepl") from exc
        self._translator = deepl.Translator(api_key)

    def translate(self, texts: list[str], source: str = "zh", target: str = "ko") -> list[str]:
        # DeepL 언어 코드: 중국어 source="ZH", 한국어 target="KO"
        results = self._translator.translate_text(
            texts, source_lang="ZH", target_lang="KO"
        )
        # 단건/리스트 모두 처리
        if not isinstance(results, list):
            results = [results]
        out: list[str] = []
        for src, res in zip(texts, results):
            self.usage.source_chars += len(src)
            self.usage.calls += 1
            out.append(res.text)
        return out
