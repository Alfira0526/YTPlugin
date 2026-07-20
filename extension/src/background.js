/*
 * background.js (서비스 워커) — (a) tabCapture 실시간 캡처 조정.
 *
 * 흐름:
 *   popup(사용자 제스처) ─'realtime:start'─▶ background
 *     background: tabCapture.getMediaStreamId(targetTab) → offscreen 문서 보장
 *              → offscreen에 streamId 전달, content에 실시간 모드 ON 통지
 *   offscreen ─'realtime:audioChunk'─▶ background ─relay─▶ content(해당 탭)
 *
 * ⚠️ 스켈레톤: 캡처·메시지 배선까지 구현. 실제 STT는 온디바이스/서버(Q-4) 결정 후
 *    offscreen(온디바이스) 또는 서버 클라이언트로 교체. 수동 로드 검증 대상.
 */
"use strict";

const OFFSCREEN_PATH = "src/offscreen.html";
let offscreenReady = false;
const activeTabs = new Set(); // 실시간 캡처 중인 탭

async function ensureOffscreen() {
  if (offscreenReady) return;
  const has = await chrome.offscreen.hasDocument?.();
  if (!has) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ["USER_MEDIA"],
      justification: "탭 오디오를 캡처하여 실시간 자막을 생성합니다.",
    });
  }
  offscreenReady = true;
}

async function startRealtime(tabId) {
  // 사용자 제스처(popup 클릭 또는 단축키 commands)에서 호출되어야 함.
  // 단축키(commands)는 확장 툴바가 없는 PWA 앱 창에서도 유효한 호출 경로.
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  await ensureOffscreen();
  chrome.runtime.sendMessage({ target: "offscreen", type: "offscreen:start", streamId, tabId });
  chrome.tabs.sendMessage(tabId, { type: "realtime:on" });
  activeTabs.add(tabId);
}

async function stopRealtime(tabId) {
  chrome.runtime.sendMessage({ target: "offscreen", type: "offscreen:stop" });
  if (tabId != null) {
    chrome.tabs.sendMessage(tabId, { type: "realtime:off" });
    activeTabs.delete(tabId);
  }
  try {
    if (await chrome.offscreen.hasDocument?.()) await chrome.offscreen.closeDocument();
  } catch (_e) {
    /* 무시 */
  }
  offscreenReady = false;
}

// 키보드 단축키 — 탭과 PWA 앱 창 모두에서 실시간 토글(PWA는 팝업이 없으므로 필수 경로)
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-realtime") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return;
  if (activeTabs.has(tab.id)) await stopRealtime(tab.id);
  else await startRealtime(tab.id).catch((e) => console.error("[YTPlugin] 시작 실패:", e));
});

// 탭이 닫히면 정리
chrome.tabs.onRemoved.addListener((tabId) => activeTabs.delete(tabId));

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === "realtime:start") {
    startRealtime(msg.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
    return true; // async
  }
  if (msg.type === "realtime:stop") {
    stopRealtime(msg.tabId).then(() => sendResponse({ ok: true }));
    return true;
  }
  // offscreen → content 릴레이 (오디오 청크 신호)
  if (msg.type === "realtime:audioChunk" && msg.tabId != null) {
    chrome.tabs.sendMessage(msg.tabId, { type: "realtime:audioChunk", ts: msg.ts });
  }
});
