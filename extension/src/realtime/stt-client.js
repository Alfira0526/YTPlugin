/*
 * SttClient — 스트리밍 음성인식 클라이언트 인터페이스 ((a) tabCapture 경로).
 *
 *   sttClient.onSegment(cb)   // 인식된 (중국어) 세그먼트 {start,end,text} 콜백 등록
 *   sttClient.pushAudio(chunk)// 캡처된 오디오 청크 투입
 *   sttClient.flush() / reset()
 *
 * 실제 구현은 Q-4 결정 후:
 *   - OnDeviceSttClient (브라우저 WASM, 온디바이스 — 계획서 §3-3 우선)
 *   - ServerSttClient   (WebSocket 스트리밍 서버)
 * 지금은 MockSttClient로 전체 실시간 흐름을 배선·검증한다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.YTP = Object.assign(root.YTP || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  class SttClient {
    constructor() {
      this._cb = null;
    }
    onSegment(cb) {
      this._cb = cb;
    }
    _emit(seg) {
      if (this._cb) this._cb(seg);
    }
    pushAudio(_chunk) {
      throw new Error("not implemented");
    }
    flush() {}
    reset() {}
  }

  /**
   * 목 STT — 스크립트된 중국어 세그먼트를 pushAudio 호출마다 하나씩 방출.
   * 타임스탬프는 주입된 clock()(초)로 생성 → 결정론적 테스트 가능.
   */
  class MockSttClient extends SttClient {
    constructor(script, clock) {
      super();
      this._script = (script || []).slice();
      this._i = 0;
      this._clock = clock || (() => 0);
    }
    pushAudio(_chunk) {
      if (this._i >= this._script.length) return;
      const item = this._script[this._i++];
      const start = this._clock();
      const dur = item.dur != null ? item.dur : 2.0;
      this._emit({ start, end: start + dur, text: item.text });
    }
    reset() {
      this._i = 0;
    }
  }

  return { SttClient, MockSttClient };
});
