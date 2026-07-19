# 자막 캐시 (설계 스텁)

개발계획서 v1.1 **§3-4 자막 캐싱 전략** — 카운슬 피어리뷰가 "비용 구조를 바꾸는 핵심"으로 지적한 항목.

## 원리

- 키: **video ID** (예: `rQk3C3bUKxs`)
- 값: 자막 데이터(타임스탬프 + 한국어 텍스트, SRT 또는 JSON)
- 팬덤 특성상 **동일 영상을 다수가 반복 시청** → STT·MT 비용이 "영상 수"에만 비례하고 "시청 수"에는 비례하지 않게 됨
- 조회 우선: 캐시 히트 시 즉시 반환, 미스일 때만 STT→MT 파이프라인 실행

## 현재 상태

**파일럿 파이프라인에 로컬 JSON 백엔드로 구현 완료** (`pilot/cache.py`, 결정 D-8).
video_id 키라 오디오 확보 방식 (a)/(b)와 무관하며, (b) 채택 시 동일 인터페이스로
서버/오브젝트 스토리지 백엔드로 교체한다.

- 파이프라인 통합: `run_pipeline(..., video_id, cache)` — **캐시 우선 조회 → 미스 시에만 STT·MT 실행 후 저장**
- CLI: `python -m pilot.run_pilot ... --video-id <ID>` (기본 캐시 사용, `--no-cache`로 비활성)
- 확장(클라이언트): `extension/src/providers/static-provider.js`가 video_id로 저장된 자막을 조회(동일 개념의 클라이언트 캐시)

방식별 향후 연결:
- 방식 (a): 클라이언트/엣지 캐시 우선 조회 → 미스 시 스트리밍 처리
- 방식 (b): 서버 캐시 우선 조회 → 미스 시 배치 처리

## 인터페이스 (`pilot/cache.py`)

```python
SubtitleCache(cache_dir)
  .has(video_id) -> bool
  .get(video_id) -> Optional[list[Segment]]   # 캐시 조회(한국어+원문 복원)
  .put(video_id, segments, meta) -> Path       # 처리 결과 저장
  .keys() -> list[str]
```

- video_id는 파일명 안전 문자만 통과(경로 조작 방지). 테스트: `python -m pilot.tests.test_cache`.

> 런타임 캐시 파일(`cache/*.json`)은 `.gitignore`로 커밋 제외.
