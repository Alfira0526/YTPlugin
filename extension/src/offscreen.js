/*
 * offscreen.js (module) — 탭 오디오 캡처 + 온디바이스 음성인식(Transformers.js/Whisper).
 * background가 조정. 화면 없는 문서.
 *
 * 두 기능:
 *  1) 실시간 데모: 주기적 audioChunk 신호(목 STT 구동) — 기존 유지
 *  2) 음성인식 테스트: N초 탭 오디오를 캡처해 Whisper로 1회 전사, 정확도/시간 측정(§3-0)
 *
 * ⚠️ 온디바이스라 오디오는 기기 밖으로 나가지 않음(모델 가중치만 최초 1회 다운로드).
 *    전용 GPU 없는 PC에선 느릴 수 있음 — 그래서 '측정' 먼저.
 */
import { pipeline, env } from "./vendor/transformers.web.min.js";

// 원격 모델 허용(HuggingFace), 로컬 캐시 사용
env.allowRemoteModels = true;
// 단일 스레드 WASM — SharedArrayBuffer(교차출처 격리) 미가용 환경에서도 동작하도록
try {
  if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
  }
} catch (_e) {}

let audioCtx = null;
let stream = null;
let source = null;
let timer = null;
let currentTabId = null;

const CHUNK_MS = 2000;
let asr = null;
let asrModelId = null;

function bg(msg) {
  try { chrome.runtime.sendMessage(Object.assign({ target: "bg" }, msg)); } catch (_e) {}
}

// ---- 실시간 데모(기존) ----
async function startDemo(streamId, tabId) {
  await stopCapture();
  currentTabId = tabId;
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
  });
  audioCtx = new AudioContext();
  source = audioCtx.createMediaStreamSource(stream);
  source.connect(audioCtx.destination);
  timer = setInterval(() => {
    chrome.runtime.sendMessage({ type: "realtime:audioChunk", tabId: currentTabId });
  }, CHUNK_MS);
}

async function stopCapture() {
  if (timer) { clearInterval(timer); timer = null; }
  if (source) { try { source.disconnect(); } catch (_e) {} source = null; }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  if (audioCtx) { try { await audioCtx.close(); } catch (_e) {} audioCtx = null; }
  currentTabId = null;
}

// ---- 음성인식 테스트(신규) ----
async function ensureAsr(modelId) {
  if (asr && asrModelId === modelId) return asr;
  bg({ type: "stt:test:progress", stage: "모델 로딩(최초 1회 다운로드, 수십 MB)…" });
  let device = "webgpu";
  try {
    asr = await pipeline("automatic-speech-recognition", modelId, { device: "webgpu" });
  } catch (_e) {
    device = "wasm";
    asr = await pipeline("automatic-speech-recognition", modelId); // wasm 폴백
  }
  asrModelId = modelId;
  bg({ type: "stt:test:progress", stage: `모델 준비됨 (device=${device})` });
  return asr;
}

// N초 동안 탭 오디오를 16kHz mono Float32로 수집
function captureSeconds(streamId, seconds) {
  return new Promise(async (resolve, reject) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
      });
      const ctx = new AudioContext({ sampleRate: 16000 });
      const src = ctx.createMediaStreamSource(s);
      src.connect(ctx.destination); // 사용자에게 소리 유지
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const chunks = [];
      let total = 0;
      proc.onaudioprocess = (e) => {
        const d = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(d));
        total += d.length;
      };
      src.connect(proc);
      proc.connect(ctx.destination);
      setTimeout(async () => {
        proc.disconnect();
        src.disconnect();
        s.getTracks().forEach((t) => t.stop());
        const rate = ctx.sampleRate;
        await ctx.close();
        const out = new Float32Array(total);
        let off = 0;
        for (const c of chunks) { out.set(c, off); off += c.length; }
        resolve({ audio: out, sampleRate: rate });
      }, seconds * 1000);
    } catch (e) {
      reject(e);
    }
  });
}

async function sttTest(streamId, seconds, modelId) {
  const t0 = performance.now();
  const model = await ensureAsr(modelId);
  const loadMs = Math.round(performance.now() - t0);
  bg({ type: "stt:test:progress", stage: `${seconds}초 오디오 캡처 중…` });
  const { audio, sampleRate } = await captureSeconds(streamId, seconds);
  bg({ type: "stt:test:progress", stage: "인식 중…" });
  const t1 = performance.now();
  const out = await model(audio, { language: "zh", task: "transcribe", sampling_rate: sampleRate });
  const inferMs = Math.round(performance.now() - t1);
  const text = out && out.text ? out.text.trim() : "";
  bg({
    type: "stt:test:result",
    ok: true,
    text,
    inferMs,
    loadMs,
    seconds,
    ratio: (inferMs / 1000 / seconds).toFixed(2), // 1보다 작으면 실시간 가능성
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== "offscreen") return;
  if (msg.type === "offscreen:start") {
    startDemo(msg.streamId, msg.tabId).catch((e) => console.error("[YTPlugin offscreen] 캡처 실패:", e));
  } else if (msg.type === "offscreen:stop") {
    stopCapture();
  } else if (msg.type === "offscreen:sttTest") {
    sttTest(msg.streamId, msg.seconds || 6, msg.model || "Xenova/whisper-base").catch((e) =>
      bg({ type: "stt:test:result", ok: false, error: String(e && e.message ? e.message : e) })
    );
  }
});
