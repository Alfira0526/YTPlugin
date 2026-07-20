# YTPlugin Chrome 확장 (오버레이 레이어)

유튜브 영상 위에 **한국어 자막을 오버레이**하는 Chrome 확장(MV3).
개발계획서 §1의 차별점("시청 흐름을 끊지 않는 오버레이 자막")을 구현하는 부분이며,
**오디오 확보 방식 (a) tabCapture / (b) 서버 배치 결정과 무관하게 공유되는 레이어**다.

## 왜 이걸 먼저 만들었나 (게이트 준수)

인수인계서상 (a)/(b) 미결 시 P1 진입 금지. 하지만 **자막을 받아 영상 위에 그리는 렌더링·싱크·설정 UI는 (a)/(b) 어느 쪽이든 동일하게 필요**하다.
그래서 자막 공급원(`SubtitleProvider`)만 인터페이스로 추상화하고, 그 뒤(실시간 a/b)는 결정 후 꽂도록 했다. 자세한 협의는 `../docs/개발로그.md`.

## 구조

```
manifest.json                 # MV3, 권한: storage + tabCapture + offscreen, youtube.com host
src/
  core/
    srt.js                    # SRT/VTT 파싱 (순수, 테스트 가능)
    track.js                  # SubtitleTrack: 재생 시각→활성 자막 (이진탐색+캐시)
    glossary.js               # 고유명사 용어집 (JS, pilot 대응)
  providers/
    static-provider.js        # StaticProvider(video_id→SRT) — 사전 생성 자막
  realtime/                   # ★ (a) tabCapture 실시간 경로
    stt-client.js             #   SttClient 인터페이스 + MockSttClient
    ondevice-stt-client.js    #   온디바이스 Whisper(Transformers.js) 스켈레톤 (Q-4)
    mt-client.js              #   MtClient 인터페이스 + MockMtClient + DeepLMtClient
    deepl.js                  #   DeepL 요청/응답 순수 헬퍼(테스트 가능)
    realtime-provider.js      #   캡처→STT→MT→용어집→onCue 오케스트레이터
  overlay.js                  # 오버레이 DOM 생성·스타일 적용
  content.js                  # video 싱크·SPA·정적/실시간 모드 (Chrome API 어댑터)
  background.js               # 서비스 워커: tabCapture 조정, offscreen 관리
  offscreen.html/.js          # 탭 오디오 캡처(화면 없는 문서)
  popup/                      # 설정 + SRT 로드 + 실시간 시작/정지
styles/overlay.css            # 오버레이 스타일 (CSS 변수로 크기·배경 조절)
test/
  core.test.cjs               # SRT·트랙·정적공급원 유닛 (node --test)
  realtime.test.cjs           # 용어집·STT목·RealtimeProvider 유닛 (node --test)
  overlay.dom.test.cjs        # 실제 Chromium DOM 통합 검증 (Playwright)
```

## (a) 실시간 자막 흐름 (결정 D-7)

```
popup '실시간 시작'(사용자 제스처)
  → background: tabCapture.getMediaStreamId → offscreen 생성 → content 실시간 ON
  → offscreen: 탭 오디오 캡처(AudioContext) → 오디오 윈도우마다 audioChunk 신호
  → content: RealtimeProvider.pushAudio → SttClient(중국어) → MtClient(한국어) → 용어집 → 오버레이 라이브 표시
```

- **STT/MT는 인터페이스** — 데모는 Mock, 실구현은 인터페이스 뒤로:
  - STT: `OnDeviceSttClient`(온디바이스 Whisper, Q-4 확정) — 실기기/WebGPU 검증 대상
  - MT: `DeepLMtClient` — **키 노출 방지 위해 background에 위임**(content는 메시지만). 팝업에 DeepL 키 입력 시 실제 번역, 없으면 데모 목.
- **누적 cue → 캐시(§3-4) 저장 연결됨**: 실시간 종료 시 자막을 `serializeCues`로 SRT화하여
  `srt:<video_id>`에 저장 → **재시청 시 정적 모드로 즉시 표시**(재처리 없음).

### 수동 테스트 (실제 유튜브 필요, 헤드리스 불가)
1. 확장 로드 → 유튜브 영상 재생 → 팝업 **실시간 자막 시작**
2. 탭 오디오 캡처 시작 → 약 3초 간격으로 **데모 한국어 자막**이 오버레이로 표시(목 STT/MT)
   - 데모에 '미란→밀라노' 용어집 교정이 라이브로 적용됨(차별점 실증)
3. **정지**로 종료(offscreen 닫힘)

> 데모는 목이라 실제 발화와 무관한 스크립트 자막이 뜹니다. 실제 인식·번역 연결이 다음 단계.

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
- `tabCapture`: (a) 실시간 캡처 — **사용자가 '실시간 시작'을 누를 때만** 캡처 개시
- `offscreen`: 캡처를 화면 없는 문서로 격리
- `host_permissions: api(-free).deepl.com`: DeepL 번역 호출(background에서만, 키 미노출)
- 캡처 오디오는 **처리용으로만 사용**(저장·불필요 전송 없음). 온디바이스 STT 채택 시 오디오가 문서 밖으로 나가지 않음. 개인정보처리방침 명시 필요(§6).
