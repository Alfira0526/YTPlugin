/*
 * content.js — 유튜브 watch 페이지에서 오버레이를 붙이고 재생 시각에 자막을 동기화하는 어댑터.
 * Chrome API는 여기서만 사용. 코어(파싱·트랙·오버레이)는 순수 모듈 재사용.
 * 오디오 확보 방식 (a)/(b)와 무관 — 자막 공급원만 교체하면 됨.
 */
(function () {
  "use strict";

  const { StaticProvider, Overlay, DEFAULT_STYLE } = self.YTP;
  const SETTINGS_KEY = "settings";
  const srtKey = (videoId) => `srt:${videoId}`;

  const state = {
    videoId: null,
    track: null,
    overlay: null,
    videoEl: null,
    rafId: null,
    lastText: null,
    // 실시간 모드 ((a) tabCapture)
    realtime: null, // RealtimeProvider 인스턴스
    realtimeMode: false,
    liveTimer: null,
  };

  // 실시간 데모 구성(목 STT/MT) — 실구현(온디바이스/서버)은 Q-4 결정 후 교체
  const DEMO_ZH = [
    { text: "大家好，欢迎来到直播间", dur: 3 },
    { text: "今天在米兰参加设计周", dur: 3 },
    { text: "谢谢你们的支持", dur: 3 },
    { text: "我们下次再见", dur: 3 },
  ];
  const DEMO_DICT = {
    "大家好，欢迎来到直播间": "여러분 안녕하세요, 방송에 오신 걸 환영해요",
    "今天在米兰参加设计周": "오늘 미란에서 디자인 위크에 참가하고 있어요",
    "谢谢你们的支持": "여러분의 성원에 감사해요",
    "我们下次再见": "다음에 또 만나요",
  };
  const DEMO_GLOSSARY = [{ from: "미란", to: "밀라노" }];

  // --- storage 헬퍼 (chrome.storage.local) ---
  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (res) => resolve(res || {}));
      } catch (_e) {
        resolve({});
      }
    });
  }

  async function loadSettings() {
    const res = await storageGet(SETTINGS_KEY);
    return Object.assign({}, DEFAULT_STYLE, res[SETTINGS_KEY] || {});
  }

  // 정적 공급원: video_id → 저장된 SRT 텍스트
  const provider = new StaticProvider(async (videoId) => {
    const res = await storageGet(srtKey(videoId));
    return res[srtKey(videoId)] || null;
  });

  // --- DOM 탐색 ---
  function getVideoIdFromUrl() {
    try {
      return new URLSearchParams(location.search).get("v");
    } catch (_e) {
      return null;
    }
  }
  function findVideo() {
    return document.querySelector("video.html5-main-video") || document.querySelector("video");
  }
  function findPlayerContainer() {
    return (
      document.querySelector("#movie_player") ||
      document.querySelector(".html5-video-player") ||
      (findVideo() && findVideo().parentElement)
    );
  }

  // --- 동기화 루프 ---
  function tick() {
    state.rafId = requestAnimationFrame(tick);
    if (state.realtimeMode) return; // 실시간 모드는 push로 표시(정적 track과 충돌 방지)
    const v = state.videoEl;
    const track = state.track;
    const overlay = state.overlay;
    if (!v || !track || !overlay) return;
    const cue = track.activeAt(v.currentTime);
    const text = cue ? cue.text : "";
    if (text !== state.lastText) {
      overlay.setText(text);
      state.lastText = text;
    }
  }
  function startLoop() {
    if (state.rafId == null) state.rafId = requestAnimationFrame(tick);
  }
  function stopLoop() {
    if (state.rafId != null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  // --- 초기화/재초기화 ---
  async function ensureOverlay() {
    if (!state.overlay) state.overlay = new Overlay(document);
    const container = findPlayerContainer();
    if (container) {
      const cs = getComputedStyle(container);
      if (cs.position === "static") container.style.position = "relative";
      state.overlay.attach(container);
    }
    const settings = await loadSettings();
    state.overlay.applyStyle(settings);
  }

  async function loadTrackForCurrentVideo() {
    state.videoId = getVideoIdFromUrl();
    state.lastText = null;
    if (state.overlay) state.overlay.setText("");
    state.track = state.videoId ? await provider.getTrack(state.videoId) : null;
    if (state.track) state.track.reset();
  }

  async function init() {
    state.videoEl = findVideo();
    if (!state.videoEl) return false;
    await ensureOverlay();
    await loadTrackForCurrentVideo();
    startLoop();
    return true;
  }

  // 요소가 늦게 뜨는 경우 재시도
  function initWithRetry(retries = 20) {
    init().then((ok) => {
      if (!ok && retries > 0) setTimeout(() => initWithRetry(retries - 1), 500);
    });
  }

  // --- SPA 내비게이션 대응 ---
  function onNavigate() {
    const newId = getVideoIdFromUrl();
    if (newId !== state.videoId) {
      state.videoEl = findVideo();
      ensureOverlay().then(loadTrackForCurrentVideo);
    }
  }
  window.addEventListener("yt-navigate-finish", onNavigate);

  // --- 설정/자막 변경 반영 ---
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[SETTINGS_KEY] && state.overlay) {
        state.overlay.applyStyle(
          Object.assign({}, DEFAULT_STYLE, changes[SETTINGS_KEY].newValue || {})
        );
      }
      if (state.videoId && changes[srtKey(state.videoId)]) {
        loadTrackForCurrentVideo();
      }
    });
  } catch (_e) {
    /* storage 미가용 환경(테스트) 무시 */
  }

  // --- 실시간 모드 ((a) tabCapture) ---
  function showLiveCue(cue) {
    if (!state.overlay || !cue) return;
    state.overlay.setText(cue.text);
    if (state.liveTimer) clearTimeout(state.liveTimer);
    const holdMs = Math.max(2500, (cue.end - cue.start) * 1000);
    state.liveTimer = setTimeout(() => {
      if (state.realtimeMode && state.overlay) state.overlay.setText("");
    }, holdMs);
  }

  function sendToBackground(msg) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(msg, (resp) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          resolve(resp);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async function enterRealtime() {
    if (state.realtimeMode) return;
    state.realtimeMode = true; // 재진입 가드
    const { RealtimeProvider, MockSttClient, MockMtClient, DeepLMtClient, Glossary } = self.YTP;
    const clock = () => (state.videoEl ? state.videoEl.currentTime : 0);
    // DeepL 키가 있으면 실제 번역(백그라운드 위임), 없으면 데모 목
    const res = await storageGet("deeplApiKey");
    const mtClient = res.deeplApiKey
      ? new DeepLMtClient((m) => sendToBackground(m))
      : new MockMtClient(DEMO_DICT);
    const provider = new RealtimeProvider({
      sttClient: new MockSttClient(DEMO_ZH, clock),
      mtClient,
      glossary: new Glossary(DEMO_GLOSSARY),
    });
    provider.onCue((cue) => showLiveCue(cue));
    provider.start();
    state.realtime = provider;
    if (state.overlay) state.overlay.setText("");
  }

  // 실시간으로 만든 자막을 캐시에 저장 → 재시청 시 정적으로 즉시 표시(§3-4)
  function saveRealtimeToCache(cues) {
    if (!state.videoId || !cues || !cues.length) return;
    try {
      const srt = self.YTP.serializeCues(cues);
      if (srt) chrome.storage.local.set({ [srtKey(state.videoId)]: srt });
    } catch (_e) {
      /* 무시 */
    }
  }

  function exitRealtime() {
    state.realtimeMode = false;
    const cues = state.realtime ? state.realtime.getCues() : [];
    if (state.realtime) state.realtime.stop();
    state.realtime = null;
    if (state.liveTimer) {
      clearTimeout(state.liveTimer);
      state.liveTimer = null;
    }
    if (state.overlay) state.overlay.setText("");
    state.lastText = null;
    saveRealtimeToCache(cues);
  }

  // --- 팝업/백그라운드 메시지 ---
  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || !msg.type) return;
      if (msg.type === "getStatus") {
        sendResponse({
          videoId: state.videoId,
          hasTrack: !!state.track,
          cueCount: state.track ? state.track.length : 0,
          realtime: state.realtimeMode,
        });
      } else if (msg.type === "srtUpdated") {
        loadTrackForCurrentVideo().then(() => sendResponse({ ok: true }));
        return true; // async
      } else if (msg.type === "realtime:on") {
        enterRealtime();
      } else if (msg.type === "realtime:off") {
        exitRealtime();
      } else if (msg.type === "realtime:audioChunk") {
        // 오디오 윈도우 신호 → STT 구동(스켈레톤: 목이 다음 세그먼트 방출)
        if (state.realtime) state.realtime.pushAudio(null);
      }
    });
  } catch (_e) {
    /* 무시 */
  }

  // 페이지가 이미 watch면 시작
  if (location.pathname === "/watch") initWithRetry();

  // 테스트 훅(브라우저 실사용엔 영향 없음)
  self.__YTP_CONTENT__ = { state, init, loadTrackForCurrentVideo };
})();
