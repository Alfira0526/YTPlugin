"""설정 로딩 — .env(있으면) + 환경변수 + CLI 인자.

third-party(dotenv) 없이 최소 .env 파서를 내장해 스모크 경로가 의존성 없이 돈다.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "pilot" / "outputs"
CACHE_DIR = REPO_ROOT / "cache"


def load_dotenv(path: Path | None = None) -> None:
    """아주 단순한 .env 로더(KEY=VALUE, # 주석). 이미 설정된 환경변수는 덮어쓰지 않음."""
    env_path = path or (REPO_ROOT / ".env")
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


@dataclass
class Config:
    stt_backend: str = "stub"
    mt_backend: str = "stub"
    source_lang: str = "zh"
    target_lang: str = "ko"
    deepl_api_key: str = ""
    papago_client_id: str = ""
    papago_client_secret: str = ""

    @classmethod
    def from_env(cls) -> "Config":
        load_dotenv()
        return cls(
            stt_backend=os.environ.get("STT_BACKEND", "stub"),
            mt_backend=os.environ.get("MT_BACKEND", "stub"),
            deepl_api_key=os.environ.get("DEEPL_API_KEY", ""),
            papago_client_id=os.environ.get("PAPAGO_CLIENT_ID", ""),
            papago_client_secret=os.environ.get("PAPAGO_CLIENT_SECRET", ""),
        )
