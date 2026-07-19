# P0 파일럿 하네스

개발계획서 v1.1 §7 WBS의 **P0 파일럿·핵심결정** 단계를 실행하기 위한 도구.
카운슬이 정의한 "첫 번째로 할 일"(웨이보 녹화 영상 1개로 전사→번역 품질 육안 검증)을
단일 명령으로 수행한다.

## 파이프라인

```
오디오 파일 ──▶ STT(중국어 전사) ──▶ MT(한국어 번역) ──▶ SRT + 파일럿 메모
              qwen3-asr/sensevoice    deepl/papago
```

- 재사용 코어: `pipeline.py` — 방식 (a) tabCapture / (b) 서버 배치가 **공유**한다.
  P0에서는 배치 경로만 구현(오디오 파일 → 전체 처리). 스트리밍(a) 어댑터는 방식 결정 후 추가.

## 실행

### 1) 오프라인 스모크 (모델·키·네트워크 불필요)
```bash
python -m pilot.run_pilot --smoke
```
stub STT/MT로 배관(세그먼트 → 번역 → SRT 직렬화 → 메모)만 검증. 순수 파이썬으로 동작.

### 2) 실제 파일럿 (로컬/GPU + 모델·키 준비 후)
```bash
# 의존성 (필요한 백엔드만)
pip install -r pilot/requirements.txt
# (SenseVoice) pip install funasr torch torchaudio
# (Qwen3-ASR) pip install transformers torch torchaudio accelerate

# 키 준비
cp ../.env.example ../.env    # DEEPL_API_KEY 등 입력

# 오디오 확보 (로컬 테스트 목적 한정) → pilot/samples/sample1.wav
# 실행
python -m pilot.run_pilot --audio pilot/samples/sample1.wav \
    --stt qwen3-asr --mt deepl --video-id rQk3C3bUKxs
```

산출물:
- `pilot/outputs/<video-id>.srt` — 한국어 자막
- `pilot/outputs/<video-id>_memo.md` — 파일럿 메모(자동 측정치 + 육안 평가 뼈대)

## 백엔드

| 종류 | 값 | 설명 |
|---|---|---|
| STT | `stub` | 합성 세그먼트(배관 검증용) |
| STT | `qwen3-asr` | 1차 채택. transformers 로컬 추론 골격(모델 ID·포맷은 파일럿 실측 확정) |
| STT | `sensevoice` | 대안. FunASR AutoModel + VAD 세그먼트 |
| MT | `stub` | 사전 기반 치환(배관 검증용) |
| MT | `deepl` | 1차 채택. DEEPL_API_KEY 필요 |
| MT | `papago` | 대안. PAPAGO_CLIENT_ID/SECRET 필요 |

## 파일럿 절차 (인수인계문서 §5)

1. 샘플 영상 육안 확인(중국어 발화 + 자동자막 미제공)
2. 오디오 확보(로컬 테스트용)
3. `run_pilot`으로 전사·번역 → SRT·메모 생성
4. `outputs/*_memo.md`의 **육안 평가** 항목 작성 + `templates/kill_criteria_checklist.md` 대조
5. 판정: 통과 → 파일럿 ②③ / 저촉 → 대안 재시도 또는 중단

> ⚠️ 이 리포가 구축된 웹 샌드박스는 HF/ModelScope가 차단되어 실모델 파일럿을 완주할 수 없다.
> 상세·대안은 `docs/ENVIRONMENT.md` 참조.
