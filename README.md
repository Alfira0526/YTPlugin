# YTPlugin — 유튜브 무자막 중국어→한국어 자막 오버레이 플러그인

유튜브 자동자막이 제공되지 않는 **중국어(방언 포함) 영상** — 특히 웨이보(微博) 라이브 녹화를 재업로드한 VOD — 에
**한국어 번역 자막을 오버레이**하는 Chrome 확장 프로그램 프로젝트.

- **타겟**: 중국어를 모르는 20~30대 중국 배우/아이돌 팬층
- **파이프라인**: 오디오 → **STT**(음성인식) → **MT**(번역) → **오버레이** 렌더링, + 자막 **캐싱**

> 근거 문서 원본은 Google Drive에 있으며, 이 리포의 [`docs/`](docs/)에 미러링되어 있습니다.

---

## 현재 단계: P0 (파일럿 · 핵심결정)

이 프로젝트는 **게이트 기반**으로 진행됩니다. 지금은 **P0**이며, 아래 핵심 결정 전까지 **P1(설계·개발) 진입이 금지**되어 있습니다.

| 결정 항목 | 상태 |
|---|---|
| STT 1차 = Qwen3-ASR / 대안 = SenseVoice | ✅ 확정 |
| MT 1차 = DeepL Free / 대안 = Papago | ✅ 확정 |
| 자막 캐싱 전략 (video ID 기준) | ✅ 확정 |
| **오디오 확보 방식 (a) tabCapture 실시간 vs (b) 서버 배치** | ⛔ **미확정 — P0 최우선. 확정 전 P1 진입 금지** |

**카운슬 판정 "첫 번째로 할 일"**: 웨이보 녹화 영상 1개로 Qwen3-ASR 전사 품질 → DeepL 번역 품질을 육안 검증하는 **반나절 파일럿**.
이 리포의 `pilot/` 하네스가 바로 그 파일럿을 실행하기 위한 것입니다.

상세 의사결정 이력은 [`docs/DECISIONS.md`](docs/DECISIONS.md) 참조.

---

## 리포 구조 (P0 범위)

```
YTPlugin/
├── docs/            # 근거 문서 미러 + 의사결정 로그
├── pilot/           # ★ P0 파일럿 하네스 (STT→MT 품질 검증)
│   ├── stt/         #   STT 백엔드 (qwen3-asr / sensevoice / stub)
│   ├── mt/          #   MT 백엔드 (deepl / papago / stub)
│   ├── pipeline.py  #   재사용 코어 (방식 a/b 양쪽이 공유)
│   ├── run_pilot.py #   단일 명령 실행기: 오디오 → STT → MT → SRT + 메모
│   └── templates/   #   파일럿 메모 / Kill Criteria 템플릿
├── cache/           # 자막 캐시 스텁 (video ID → 자막 KV) — 설계만
└── scripts/         # 환경 부트스트랩
```

> 확장 프로그램(`extension/`)과 백엔드 서버(`backend/`)는 **의도적으로 아직 없습니다**.
> 오디오 확보 방식 (a)/(b)가 아키텍처를 좌우하므로, 그 결정 전까지 만들지 않습니다.

---

## 빠른 시작

```bash
# 1) 환경 부트스트랩 (venv + 경량 의존성)
bash scripts/setup.sh

# 2) 환경변수 준비
cp .env.example .env      # 필요 시 DeepL 키 등 입력

# 3) 오프라인 스모크 테스트 — 모델/키 없이 파이프라인 플러밍 검증
python -m pilot.run_pilot --smoke

# 4) 실제 파일럿 (모델·키 준비 후, GPU 권장)
python -m pilot.run_pilot \
    --audio pilot/samples/sample1.wav \
    --stt qwen3-asr --mt deepl \
    --video-id rQk3C3bUKxs
```

산출물: `pilot/outputs/<video-id>.srt` (한국어 자막) + `pilot/outputs/<video-id>_memo.md` (파일럿 메모).

---

## ⚠️ 이 실행 환경(웹 샌드박스)의 제약

이 리포가 구축된 Claude Code 웹 샌드박스는 **네트워크가 패키지 레지스트리(PyPI/npm 등)로 제한**되어 있습니다.

| 항목 | 상태 | 영향 |
|---|---|---|
| PyPI 패키지 설치 | ✅ 가능 | 의존성 설치 OK |
| **HuggingFace / ModelScope** | ⛔ **정책상 차단(403)** | **Qwen3-ASR·SenseVoice 가중치 다운로드 불가** |
| DeepL / Papago API 호스트 | ⛔ 미허용 + 키 없음 | 실제 번역 호출 불가 |
| GPU | ⛔ 없음 (CPU only) | 대형 모델 실시간 처리 부적합 |

따라서 **이 샌드박스에서는 실제 모델을 이용한 end-to-end 파일럿을 완주할 수 없습니다.**
대신 `--smoke` 모드(오프라인 스텁 백엔드)로 **하네스 로직 자체를 검증**했습니다.

**실제 파일럿을 돌리려면** 다음 중 하나가 필요합니다:
1. **로컬/GPU 머신에서 실행** (HuggingFace 접근 가능 + GPU) — 코드는 그대로 사용 가능
2. 환경의 **네트워크 정책에 HuggingFace/ModelScope 허용** 추가
3. DeepL/Papago **API 키 발급** + 해당 호스트 허용 (MT 경로 한정)

자세한 내용은 [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) 참조.

---

## 라이선스 / 저작권 유의

- 오버레이 도구 자체는 원본 콘텐츠를 **재배포하지 않습니다**.
- 원본 콘텐츠(웨이보 재업로드)의 저작권 리스크는 **업로더 책임**이며, 법률자문은 **파일럿 통과 후** 진행합니다 (개발계획서 v1.1 §3-5).
- 파일럿 단계의 오디오 확보는 **로컬 테스트 목적 한정**입니다 (배포용 아님).
