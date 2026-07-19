#!/usr/bin/env bash
# 개발환경 부트스트랩 — venv 생성 + 경량 의존성 설치 + 스모크 안내
# 사용: bash scripts/setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
echo "== YTPlugin 개발환경 부트스트랩 =="
echo "리포: $ROOT"

# 1) venv
if [ ! -d ".venv" ]; then
  echo "-- .venv 생성"
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --quiet --upgrade pip

# 2) 경량 의존성 (스모크/실 MT용). STT 무거운 의존성은 주석 참고 후 별도 설치.
echo "-- 경량 의존성 설치 (deepl, requests)"
python -m pip install --quiet deepl requests || {
  echo "경고: 일부 패키지 설치 실패(네트워크 정책 확인). 스모크 경로는 순수 파이썬이라 계속 가능."
}

# 3) .env
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "-- .env 생성(.env.example 복사) — 키 입력 필요 시 편집"
fi

# 4) 스모크 안내
cat <<'EOF'

부트스트랩 완료.

다음 단계:
  source .venv/bin/activate
  python -m pilot.run_pilot --smoke        # 오프라인 배관 검증

실제 파일럿(로컬/GPU):
  pip install -r pilot/requirements.txt
  # STT: pip install funasr torch torchaudio  (또는 transformers 계열)
  # .env에 DEEPL_API_KEY 등 입력 후
  python -m pilot.run_pilot --audio pilot/samples/sample1.wav --stt qwen3-asr --mt deepl --video-id <ID>

주의: 이 리포가 만들어진 웹 샌드박스는 HF/ModelScope가 차단되어 실모델 실행 불가.
      상세는 docs/ENVIRONMENT.md 참조.
EOF
