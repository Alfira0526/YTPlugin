/*
 * SubtitleTrack — 정렬된 cue 목록에서 특정 시각의 활성 자막을 찾는 순수 코어.
 * 재생 위치(video.currentTime)마다 호출되므로 이진 탐색 + 직전 인덱스 캐시로 최적화.
 * 오디오 확보 방식 (a)/(b)와 무관.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.YTP = Object.assign(root.YTP || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  class SubtitleTrack {
    constructor(cues) {
      this.cues = (cues || []).slice().sort((a, b) => a.start - b.start);
      this._lastIdx = -1;
    }

    get length() {
      return this.cues.length;
    }

    // 시각 t(초)에 활성인 cue를 반환(없으면 null). start <= t < end.
    activeAt(t) {
      const cues = this.cues;
      if (cues.length === 0) return null;

      // 순차 재생 빠른 경로: 직전 활성 cue가 여전히 유효하면 즉시 반환
      if (this._lastIdx >= 0 && this._lastIdx < cues.length) {
        const c = cues[this._lastIdx];
        if (t >= c.start && t < c.end) return c;
      }

      // start <= t 인 마지막 cue를 이진 탐색
      let lo = 0;
      let hi = cues.length - 1;
      let cand = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (cues[mid].start <= t) {
          cand = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (cand >= 0 && t < cues[cand].end) {
        this._lastIdx = cand;
        return cues[cand];
      }
      this._lastIdx = -1;
      return null;
    }

    reset() {
      this._lastIdx = -1;
    }
  }

  return { SubtitleTrack };
});
