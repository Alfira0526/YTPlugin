# 개발환경 실측 및 제약 (Environment Findings)

작성일: 2026-07-19
대상: Claude Code 웹 샌드박스 (원격 실행 환경)

파일럿 하네스가 구축된 이 실행 환경의 실측 결과와, 그로 인한 실행 제약을 기록합니다.

---

## 1. 실측 결과

| 항목 | 상태 | 비고 |
|---|---|---|
| Python | ✅ 3.11 | |
| Node.js / npm | ✅ 22 / 10 | (향후 확장 개발용) |
| 디스크 | ✅ ~30G 여유 | 경량 모델 저장 가능 수준 |
| GPU | ⛔ 없음 (CPU only) | 대형 STT 실시간 처리 부적합 |
| PyPI / npm 레지스트리 | ✅ 허용 | 의존성 설치 정상 |
| **HuggingFace (huggingface.co)** | ⛔ **정책상 차단 (프록시 403)** | **모델 가중치 다운로드 불가** |
| **ModelScope (modelscope.cn)** | ⛔ **정책상 차단 (프록시 403)** | Qwen 계열 다운로드 불가 |
| DeepL / Papago API 호스트 | ⛔ 미허용 + 키 없음 | 실제 번역 호출 불가 |
| ffmpeg / yt-dlp | 미설치 (설치 시도 가능하나 apt 미러 접근 불확실) | 오디오 추출 도구 |

프록시 허용 목록(noProxy)은 패키지 레지스트리(pypi.org, files.pythonhosted.org, registry.npmjs.org, jsr.io, crates.io, proxy.golang.org)와 내부망으로 한정됨.

---

## 2. 결론: 이 샌드박스에서 가능/불가

**가능한 것**
- 파일럿 하네스 + 리포 골격 **구축**
- PyPI 경량 의존성(`srt`, `deepl` 클라이언트, `requests`) **설치**
- 오프라인 **스텁 백엔드**로 파이프라인 플러밍(오디오 세그먼트 → STT → MT → SRT + 메모) **end-to-end 검증**

**불가능한 것 (이 환경 한정)**
- Qwen3-ASR / SenseVoice **가중치 다운로드 및 실추론** (HF/ModelScope 차단)
- DeepL / Papago **실제 번역 호출** (호스트 미허용 + 키 없음)
- 따라서 **실모델 기반 파일럿 완주 불가** → 카운슬이 정의한 "전사/번역 품질 육안 검증"은 이 환경에서 수행 불가

---

## 3. 실제 파일럿을 돌리기 위한 옵션 (택1)

| 옵션 | 방법 | 장점 | 유의 |
|---|---|---|---|
| **A. 로컬/GPU 머신** | 이 리포를 클론 → `bash scripts/setup.sh` → 모델·키 준비 후 `python -m pilot.run_pilot ...` | 코드 그대로 사용, HF 접근·GPU 확보 용이 | 로컬 파이썬/GPU 환경 필요 |
| **B. 환경 네트워크 정책 허용** | 실행 환경 생성 시 HuggingFace/ModelScope 아웃바운드 허용 | 샌드박스에서 그대로 실행 | 정책 변경 권한 필요, CPU라 여전히 느림 |
| **C. MT 경로만 실검증** | DeepL/Papago 키 발급 + 해당 호스트 허용 | 번역 품질만이라도 육안 검증 | STT는 별도 필요 |

> 권장: **A(로컬/GPU)**. 카운슬의 "반나절 파일럿"은 GPU 로컬 환경을 전제로 설계되었고, 이 리포의 하네스는 그 환경에서 즉시 실행되도록 작성됨.

---

## 4. 스모크 테스트 (이 환경에서 검증 완료)

모델·키·네트워크 없이 하네스 로직만 검증:

```bash
python -m pilot.run_pilot --smoke
```

- STT_BACKEND=stub: 합성 중국어 세그먼트(타임스탬프 포함) 생성
- MT_BACKEND=stub: 결정론적 사전 기반 zh→ko 치환
- 출력: `pilot/outputs/smoke.srt` + `pilot/outputs/smoke_memo.md`

이는 실제 번역 품질을 검증하는 것이 **아니라**, 파이프라인 배관(세그먼트 → 번역 → SRT 직렬화 → 메모 생성)이 정상 동작함을 검증합니다.
