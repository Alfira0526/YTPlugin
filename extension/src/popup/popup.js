/* 팝업 — 설정 조정 + 현재 영상에 SRT 로드. Chrome API 사용. */
(function () {
  "use strict";

  const DEFAULTS = { enabled: true, fontScale: 1.0, verticalPosition: 88, bgOpacity: 0.55 };
  const SETTINGS_KEY = "settings";
  const $ = (id) => document.getElementById(id);
  const controls = ["enabled", "fontScale", "verticalPosition", "bgOpacity"];

  let currentVideoId = null;
  let currentTabId = null;
  let realtimeOn = false;

  function readSettingsFromUI() {
    return {
      enabled: $("enabled").checked,
      fontScale: parseFloat($("fontScale").value),
      verticalPosition: parseInt($("verticalPosition").value, 10),
      bgOpacity: parseFloat($("bgOpacity").value),
    };
  }

  function applySettingsToUI(s) {
    $("enabled").checked = s.enabled;
    $("fontScale").value = s.fontScale;
    $("verticalPosition").value = s.verticalPosition;
    $("bgOpacity").value = s.bgOpacity;
    $("fontScaleVal").textContent = Number(s.fontScale).toFixed(1);
    $("verticalPositionVal").textContent = String(s.verticalPosition);
    $("bgOpacityVal").textContent = Number(s.bgOpacity).toFixed(2);
  }

  function saveSettings() {
    const s = readSettingsFromUI();
    applySettingsToUI(s);
    chrome.storage.local.set({ [SETTINGS_KEY]: s });
  }

  function queryActiveTab() {
    return new Promise((resolve) =>
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] || null))
    );
  }
  function sendToTab(tabId, msg) {
    return new Promise((resolve) => {
      try {
        chrome.tabs.sendMessage(tabId, msg, (resp) => {
          void chrome.runtime.lastError; // 콘텐츠 스크립트 없으면 무시
          resolve(resp || null);
        });
      } catch (_e) {
        resolve(null);
      }
    });
  }

  async function refreshStatus() {
    const tab = await queryActiveTab();
    currentTabId = tab ? tab.id : null;
    if (!currentTabId) {
      $("status").textContent = "활성 탭을 찾을 수 없습니다.";
      return;
    }
    const st = await sendToTab(currentTabId, { type: "getStatus" });
    if (!st) {
      $("status").textContent = "유튜브 영상 페이지에서 열어 주세요.";
      $("vidLabel").textContent = "-";
      return;
    }
    currentVideoId = st.videoId;
    $("vidLabel").textContent = st.videoId || "-";
    $("status").textContent = st.hasTrack
      ? `자막 적용됨 · ${st.cueCount}줄`
      : "이 영상에 불러온 자막이 없습니다.";
    realtimeOn = !!st.realtime;
    updateRealtimeBtn();
  }

  function updateRealtimeBtn() {
    const btn = $("realtimeBtn");
    if (!btn) return;
    btn.textContent = realtimeOn ? "실시간 자막 정지" : "실시간 자막 시작";
    btn.style.background = realtimeOn ? "#b4392a" : "#3a5bd9";
    btn.style.borderColor = btn.style.background;
  }

  async function onRealtimeToggle() {
    const tab = await queryActiveTab();
    if (!tab) return;
    const type = realtimeOn ? "realtime:stop" : "realtime:start";
    chrome.runtime.sendMessage({ type, tabId: tab.id }, (resp) => {
      void chrome.runtime.lastError;
      if (resp && resp.ok === false) {
        $("status").textContent = "실시간 시작 실패: " + (resp.error || "권한/탭 확인");
        return;
      }
      realtimeOn = !realtimeOn;
      updateRealtimeBtn();
    });
  }

  async function onSrtSelected(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    if (!currentVideoId) {
      $("status").textContent = "먼저 유튜브 영상 페이지를 여세요.";
      return;
    }
    const text = await file.text();
    await chrome.storage.local.set({ [`srt:${currentVideoId}`]: text });
    if (currentTabId) await sendToTab(currentTabId, { type: "srtUpdated" });
    await refreshStatus();
  }

  function renderSttTest(t) {
    const el = $("sttStatus");
    if (!el || !t) return;
    if (t.status === "progress") {
      el.textContent = "⏳ " + (t.stage || "진행 중…");
    } else if (t.status === "done" && t.ok) {
      const rt = parseFloat(t.ratio);
      const verdict = rt <= 1 ? "🟢 실시간 가능성 있음" : rt <= 2 ? "🟡 준실시간(약간 느림)" : "🔴 실시간엔 느림";
      el.innerHTML =
        `<b>인식 결과:</b> ${t.text ? t.text : "(빈 결과)"}<br>` +
        `모델로딩 ${t.loadMs}ms · 인식 ${t.inferMs}ms (${t.seconds}초 오디오) · 배속 ${t.ratio}<br>` +
        `<b>${verdict}</b> (배속 1 이하면 실시간 따라감)`;
    } else if (t.status === "done") {
      el.textContent = "❌ 실패: " + (t.error || "알 수 없음");
    }
  }

  async function onSttTest() {
    const tab = await queryActiveTab();
    if (!tab) return;
    $("sttStatus").textContent = "⏳ 시작… (영상이 재생 중인지 확인하세요)";
    chrome.runtime.sendMessage({ type: "stt:test", tabId: tab.id, seconds: 6 }, (resp) => {
      void chrome.runtime.lastError;
      if (resp && resp.ok === false) $("sttStatus").textContent = "❌ " + (resp.error || "시작 실패");
    });
  }

  async function init() {
    const res = await new Promise((r) => chrome.storage.local.get(SETTINGS_KEY, r));
    applySettingsToUI(Object.assign({}, DEFAULTS, res[SETTINGS_KEY] || {}));
    controls.forEach((id) => {
      $(id).addEventListener("input", saveSettings);
      $(id).addEventListener("change", saveSettings);
    });
    $("srtFile").addEventListener("change", onSrtSelected);
    $("realtimeBtn").addEventListener("click", onRealtimeToggle);
    $("sttTestBtn").addEventListener("click", onSttTest);
    // 음성인식 테스트 결과 표시(진행 중 팝업 닫혀도 storage로 복원)
    const stt0 = await new Promise((r) => chrome.storage.local.get("sttTest", r));
    renderSttTest(stt0.sttTest);
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === "local" && ch.sttTest) renderSttTest(ch.sttTest.newValue);
    });
    // DeepL 키 로드·저장
    const keyRes = await new Promise((r) => chrome.storage.local.get("deeplApiKey", r));
    $("deeplKey").value = keyRes.deeplApiKey || "";
    $("deeplKey").addEventListener("change", () => {
      chrome.storage.local.set({ deeplApiKey: $("deeplKey").value.trim() });
    });
    await refreshStatus();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
