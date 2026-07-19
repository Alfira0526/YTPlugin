# YTPlugin Chrome 확장 (오버레이 레이어)

유튜브 영상 위에 **한국어 자막을 오버레이**하는 Chrome 확장(MV3).
개발계획서 §1의 차별점("시청 흐름을 끊지 않는 오버레이 자막")을 구현하는 부분이며,
**오디오 확보 방식 (a) tabCapture / (b) 서버 배치 결정과 무관하게 공유되는 레이어**다.

## 왜 이걸 먼저 만들었나 (게이트 준수)

인수인계서상 (a)/(b) 미결 시 P1 진입 금지. 하지만 **자막을 받아 영상 위에 그리는 렌더링·싱크·설정 UI는 (a)/(b) 어느 쪽이든 동일하게 필요**하다.
그래서 자막 공급원(`SubtitleProvider`)만 인터페이스로 추상화하고, 그 뒤(실시간 a/b)는 결정 후 꽂도록 했다. 자세한 협의는 `../docs/개발로그.md`.

## 구조

```
manifest.json                 # MV3, 최소 권한(storage + youtube.com host_permissions만)
src/
  core/
    srt.js                    # SRT/VTT 파싱 (순수, 테스트 가능)
    track.js                  # SubtitleTrack: 재생 시각→활성 자막 (이진탐색+캐시)
  providers/
    static-provider.js        # SubtitleProvider 인터페이스 + StaticProvider(video_id→SRT)
  overlay.js                  # 오버레이 DOM 생성·스타일 적용
  content.js                  # 유튜브 video 탐색·싱크 루프·SPA 대응 (Chrome API 어댑터)
  popup/                      # 설정(on·off/크기/위치/배경) + 이 영상에 SRT 로드
styles/overlay.css            # 오버레이 스타일 (CSS 변수로 크기·배경 조절)
test/
  core.test.cjs               # 코어 유닛 테스트 (node --test)
  overlay.dom.test.cjs        # 실제 Chromium DOM 통합 검증 (Playwright)
```

**자막 공급원 확장 지점** — (a)/(b) 결정 후 아래만 추가하면 나머지는 그대로 재사용:
- `RealtimeProviderA` (tabCapture 스트리밍) / `BatchProviderB` (서버 사전처리)

## 설치(개발자 로드)

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** → 이 `extension/` 폴더 선택
4. 유튜브 영상 페이지(`youtube.com/watch?v=...`)로 이동
5. 확장 아이콘 클릭 → **이 영상 자막(SRT) 불러오기**로 사전 생성 SRT 적용
   - 자막 위치·크기·배경 진하기 조절 가능, 켜기/끄기 토글

> 현재는 **사전 생성 SRT를 불러와 표시**하는 단계(정적 공급원). 실시간 자동 생성은 오디오 방식 결정 후.

## 테스트

```bash
cd extension
npm install          # playwright (브라우저는 환경에 프리설치)
npm test             # 코어 유닛 + DOM 통합
```
- DOM 테스트는 프리설치 Chromium 경로를 자동 사용(`YTP_CHROMIUM` 환경변수로 재지정 가능).

## 권한 (최소 원칙 — 보안담당자 페르소나 반영)

- `storage`: 설정·자막 캐시 저장
- `host_permissions: *.youtube.com`: 유튜브 페이지에서만 동작
- **tabCapture 등 오디오/광범위 권한은 포함하지 않음** — (a) 방식 채택 시에만 별도 추가. 웹스토어 심사 리스크(§6) 최소화.
