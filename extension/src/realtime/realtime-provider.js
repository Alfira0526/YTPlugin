/*
 * RealtimeProvider — (a) tabCapture 실시간 파이프라인 오케스트레이터.
 *
 *   캡처 오디오 ─pushAudio─▶ SttClient ─(중국어 세그먼트)─▶ MtClient ─(한국어)─▶ [용어집] ─▶ onCue
 *
 * 오버레이는 onCue로 즉시 갱신(라이브 자막). 누적 cue는 캐시(§3-4) 저장에 사용 가능.
 * STT/MT는 인터페이스라 온디바이스/서버(Q-4) 어느 구현이든 교체 가능.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.YTP = Object.assign(root.YTP || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  class RealtimeProvider {
    constructor(opts) {
      opts = opts || {};
      this.stt = opts.sttClient;
      this.mt = opts.mtClient;
      this.glossary = opts.glossary || null; // {apply(text)} 또는 null
      this._cueCb = null;
      this._cues = [];
      this._pending = [];
      this._running = false;
    }

    onCue(cb) {
      this._cueCb = cb;
    }

    start() {
      this._running = true;
      this._cues = [];
      this._pending = [];
      this.stt.onSegment((seg) => {
        this._pending.push(this._handleSegment(seg));
      });
    }

    pushAudio(chunk) {
      if (this._running) this.stt.pushAudio(chunk);
    }

    async _handleSegment(seg) {
      if (!seg || !seg.text) return;
      let ko = await this.mt.translate(seg.text);
      if (this.glossary && typeof this.glossary.apply === "function") {
        ko = this.glossary.apply(ko);
      }
      const cue = {
        start: seg.start,
        end: seg.end,
        text: ko,
        source_text: seg.text,
      };
      this._cues.push(cue);
      if (this._cueCb) this._cueCb(cue);
    }

    // 대기 중인 세그먼트 처리 완료까지 대기(테스트/플러시용)
    async drain() {
      await Promise.all(this._pending);
    }

    getCues() {
      return this._cues.slice();
    }

    stop() {
      this._running = false;
    }
  }

  return { RealtimeProvider };
});
