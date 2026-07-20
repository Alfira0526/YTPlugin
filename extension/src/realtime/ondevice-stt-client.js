/*
 * OnDeviceSttClient — 온디바이스(브라우저 내) 스트리밍 STT 스켈레톤.
 * SttClient 인터페이스 구현. Transformers.js(Whisper) WASM/WebGPU 사용.
 *
 * 결정: Q-4 = 온디바이스(사용자 선호 + 계획서 §3-3 우선). 오디오가 기기 밖으로
 * 나가지 않아 프라이버시·ToS에 유리.
 *
 * ⚠️ 검증 상태: 이 샌드박스는 HuggingFace 접근이 차단되어 모델 다운로드·실행 불가.
 *    → 실기기(로컬, 가급적 WebGPU)에서 검증. 아래는 실동작 코드의 골격이며,
 *    transformers.js를 확장에 vendored(번들)하고 모델 가중치를 확보해야 한다.
 *
 * 준비물(실기기):
 *   - extension/src/vendor/transformers.min.js  (npm: @huggingface/transformers 번들)
 *   - 모델: Xenova/whisper-tiny (또는 base) — 중국어 지원. WebGPU 가능 시 실시간 5~8배속.
 *   - 오디오: offscreen에서 16kHz mono Float32 PCM을 pushAudio로 투입.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.YTP = Object.assign(root.YTP || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULTS = {
    model: "Xenova/whisper-tiny",
    language: "zh",
    sampleRate: 16000,
    windowSec: 5, // 인식 윈도우(길수록 정확·지연↑)
  };

  // SttClient 인터페이스와 동일한 형태(별도 로드 순서 의존 없이 최소 정의)
  class OnDeviceSttClient {
    constructor(opts) {
      this.opts = Object.assign({}, DEFAULTS, opts || {});
      this._cb = null;
      this._asr = null;
      this._loading = null;
      this._buf = []; // Float32 청크 누적
      this._bufLen = 0;
      this._elapsed = 0; // 누적 시간(초) — 세그먼트 타임스탬프 기준
    }

    onSegment(cb) {
      this._cb = cb;
    }

    async _ensurePipeline() {
      if (this._asr) return this._asr;
      if (!this._loading) {
        this._loading = (async () => {
          // 실기기: vendored transformers.js에서 pipeline 로드
          const { pipeline, env } = await import("../vendor/transformers.min.js");
          // 확장 내 로컬 모델/캐시 경로 설정, 원격 허용 여부는 정책에 맞게
          env.allowLocalModels = true;
          this._asr = await pipeline("automatic-speech-recognition", this.opts.model, {
            // device: 'webgpu' 가능 시 자동/명시
          });
          return this._asr;
        })();
      }
      return this._loading;
    }

    // offscreen이 16kHz mono Float32 청크를 투입
    pushAudio(float32Chunk) {
      if (!float32Chunk || !float32Chunk.length) return;
      this._buf.push(float32Chunk);
      this._bufLen += float32Chunk.length;
      const need = this.opts.windowSec * this.opts.sampleRate;
      if (this._bufLen >= need) this._processWindow();
    }

    async _processWindow() {
      const audio = _concatFloat32(this._buf, this._bufLen);
      this._buf = [];
      this._bufLen = 0;
      const start = this._elapsed;
      const dur = audio.length / this.opts.sampleRate;
      this._elapsed += dur;
      try {
        const asr = await this._ensurePipeline();
        const out = await asr(audio, {
          language: this.opts.language,
          task: "transcribe",
          chunk_length_s: this.opts.windowSec,
        });
        const text = (out && out.text ? out.text : "").trim();
        if (text && this._cb) this._cb({ start, end: start + dur, text });
      } catch (e) {
        // 실기기 디버깅용
        // eslint-disable-next-line no-console
        console.error("[YTPlugin OnDeviceStt] 인식 실패:", e);
      }
    }

    reset() {
      this._buf = [];
      this._bufLen = 0;
      this._elapsed = 0;
    }
  }

  function _concatFloat32(chunks, total) {
    const out = new Float32Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }

  return { OnDeviceSttClient };
});
