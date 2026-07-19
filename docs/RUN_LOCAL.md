# 로컬/GPU 파일럿 실행 가이드

이 리포는 웹 샌드박스(HF/ModelScope 차단·GPU 없음)에서 구축되었으나, **하네스는 완성·검증**되어
로컬/GPU 머신에서 코드 수정 없이 실제 파일럿을 돌릴 수 있습니다. (결정 D-13)

목표: 카운슬이 정의한 **"첫 번째로 할 일"** — 웨이보 녹화 영상 1개로 **전사(STT) 품질 → 번역(MT) 품질**을 육안 검증.

---

## 0. 사전 준비물

| 항목 | 권장 | 비고 |
|---|---|---|
| OS | Linux / macOS / WSL2 | |
| Python | 3.10~3.11 | |
| GPU | NVIDIA (CUDA 12.x) 권장 | 없어도 CPU로 동작(느림) — SenseVoice가 CPU에 유리 |
| ffmpeg | 필수 | 오디오 추출·변환 |
| DeepL 키 | MT 1차 | https://www.deepl.com/pro-api (Free) |
| Papago 키 | MT 대안(선택) | Naver Cloud Platform |

---

## 1. 클론 & 부트스트랩

```bash
git clone <이 리포 URL>
cd YTPlugin
git checkout claude/dev-environment-setup-0zoxsg

bash scripts/setup.sh          # .venv + 경량 의존성(deepl, requests) + .env 생성
source .venv/bin/activate
```

### 스모크로 하네스 먼저 확인 (모델·키 불필요)
```bash
python -m pilot.run_pilot --smoke
# → pilot/outputs/smoke.srt , smoke_memo.md 생성되면 배관 정상
```

---

## 2. STT 모델 의존성 설치 (택1 또는 둘 다 비교)

### (권장 우선 검증) SenseVoice — CPU에서도 빠름
```bash
pip install funasr torch torchaudio
```
최초 실행 시 `iic/SenseVoiceSmall` 가중치를 자동 다운로드(HF/ModelScope 접근 필요).

### Qwen3-ASR — 1차 채택 모델
```bash
pip install transformers torch torchaudio accelerate
```
> ⚠️ `pilot/stt/qwen3_asr.py`의 `_MODEL_ID = "Qwen/Qwen3-ASR"`는 **플레이스홀더**입니다.
> 실행 전 [모델 카드](https://huggingface.co/Qwen)에서 실제 배포 ID·로딩 방식(transformers `pipeline`
> 지원 여부 또는 전용 로더)을 확인해 `qwen3_asr.py`를 맞춰 주세요. 파일럿 ①의 첫 확인 항목입니다.
> DashScope API 경로를 쓸 경우 해당 백엔드를 추가하면 됩니다(구조는 동일).

CUDA GPU 사용 시 `device="cuda"`로 백엔드를 생성하도록 `run_pilot`에 옵션을 추가하거나,
`pilot/stt/*` 생성자에 `device` 인자를 전달하세요(기본 `"cpu"`).

---

## 3. MT 키 설정

```bash
# .env 편집
DEEPL_API_KEY=여기에_키
# (선택) Papago
PAPAGO_CLIENT_ID=...
PAPAGO_CLIENT_SECRET=...
```

---

## 4. 샘플 오디오 확보 (로컬 테스트 목적 한정)

> 개발계획서 v1.1 §3-0 / 인수인계 §5-1: **파일럿 단계의 오디오 확보는 로컬 테스트 목적 한정**(배포용 아님).
> 방식 (b) 서버 다운로드의 ToS 저촉 여부는 법률자문 대상이며, 이는 개인 로컬 검증과 별개입니다.

1. 샘플 #1 후보 영상을 **육안 확인**: 중국어 발화 + 유튜브 자동자막 미제공 여부
   (인수인계 §4의 `rQk3C3bUKxs`는 메타데이터 미검증 — 부적합 시 대체 샘플 선정)
2. 오디오를 16kHz mono WAV로 준비하여 `pilot/samples/sample1.wav`에 저장
   ```bash
   # 예: 이미 받은 로컬 영상 파일에서 오디오 추출
   ffmpeg -i input.mp4 -ac 1 -ar 16000 pilot/samples/sample1.wav
   ```

---

## 5. 파일럿 실행

```bash
# SenseVoice로 먼저(빠름)
python -m pilot.run_pilot --audio pilot/samples/sample1.wav \
    --stt sensevoice --mt deepl --video-id rQk3C3bUKxs

# Qwen3-ASR로 비교(모델 ID 확정 후)
python -m pilot.run_pilot --audio pilot/samples/sample1.wav \
    --stt qwen3-asr --mt deepl --video-id rQk3C3bUKxs
```

산출물:
- `pilot/outputs/<video-id>.srt` — 한국어 자막(영상에 올려 육안 확인)
- `pilot/outputs/<video-id>_memo.md` — 자동 측정치(세그먼트 수·소요시간·글자수·호출수) + 육안 평가 뼈대

---

## 6. 판정 (Kill Criteria)

`pilot/outputs/<video-id>_memo.md`의 **육안 평가** 항목을 채우고
`pilot/templates/kill_criteria_checklist.md`와 대조:

- **K1 전사 정확도** / **K2 번역 품질** / **K3 처리 원가**(1시간 환산) / **K4 지연**(방식 a 검증 시)
- 하나라도 저촉 → 대안 백엔드 재시도 또는 중단·재검토
- 통과 → **파일럿 ②③**(샘플 3~5건 확대, 방언 비중·WER 실측, DeepL vs Papago 원가 비교) → **오디오 확보 방식 (a)/(b) 결정** → P1 진입

---

## 7. 트러블슈팅

| 증상 | 원인·조치 |
|---|---|
| `funasr/transformers 필요` RuntimeError | 해당 STT 의존성 미설치 — §2 설치 |
| `DEEPL_API_KEY가 필요` RuntimeError | `.env`에 키 입력 후 재실행 |
| 가중치 다운로드 실패/타임아웃 | 방화벽·프록시가 HF/ModelScope 차단 여부 확인(이 프로젝트 샌드박스와 동일 이슈) |
| 타임스탬프 이상/세그먼트 1개 | 모델 출력 포맷 차이 — `_parse_funasr_result`/`_parse_hf_chunks` 파일럿에서 실측 조정 |
| CPU라 너무 느림 | 짧은 클립(1~2분)으로 먼저 검증, 이후 GPU 또는 온디맨드 GPU 사용 |
