/*
 * offscreen.js — 탭 오디오 캡처 (화면 없는 문서). background가 조정.
 *
 * 받은 streamId로 탭 오디오 MediaStream을 얻고, AudioContext로 처리한다.
 * 현재(스켈레톤): 일정 주기로 'realtime:audioChunk' 신호를 보내 실시간 배선을 구동.
 *
 * ▶ 실제 STT 연결 지점(Q-4 결정 후):
 *   - 온디바이스: 여기(offscreen)에서 WASM STT에 PCM을 넣고, 인식된 (중국어) 세그먼트를
 *     content로 보낸다(오디오 원본은 문서 밖으로 나가지 않음 → 프라이버시/ToS 유리).
 *   - 서버: 여기서 PCM을 WebSocket으로 스트리밍 서버에 보내고 세그먼트를 수신.
 */
"use strict";

let audioCtx = null;
let stream = null;
let source = null;
let timer = null;
let currentTabId = null;

const CHUNK_MS = 2000; // 처리 윈도우(스켈레톤 신호 주기)

async function start(streamId, tabId) {
  await stop(); // 기존 정리
  currentTabId = tabId;
  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
  });

  audioCtx = new AudioContext();
  source = audioCtx.createMediaStreamSource(stream);
  // 캡처 중에도 사용자가 소리를 계속 듣도록 출력에 연결
  source.connect(audioCtx.destination);

  // 스켈레톤: 주기적으로 오디오 윈도우 경계 신호 → content의 RealtimeProvider.pushAudio 구동
  // (실구현에서는 이 자리에서 PCM을 STT로 넘겨 인식 세그먼트를 방출)
  timer = setInterval(() => {
    chrome.runtime.sendMessage({ type: "realtime:audioChunk", tabId: currentTabId });
  }, CHUNK_MS);
}

async function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (source) {
    try { source.disconnect(); } catch (_e) {}
    source = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (audioCtx) {
    try { await audioCtx.close(); } catch (_e) {}
    audioCtx = null;
  }
  currentTabId = null;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== "offscreen") return;
  if (msg.type === "offscreen:start") {
    start(msg.streamId, msg.tabId).catch((e) =>
      console.error("[YTPlugin offscreen] 캡처 시작 실패:", e)
    );
  } else if (msg.type === "offscreen:stop") {
    stop();
  }
});
