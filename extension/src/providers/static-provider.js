/*
 * 자막 공급원(SubtitleProvider) — 오디오 확보 방식 (a)/(b)를 추상화하는 지점.
 *
 *   SubtitleProvider.getTrack(videoId) -> Promise<SubtitleTrack | null>
 *
 * 현재는 StaticProvider(사전 생성 SRT를 video_id로 조회)만 구현.
 * 캐싱 설계(§3-4: video_id → 자막)와 정합. 실시간 공급원은 (a)/(b) 결정 후 추가:
 *   - RealtimeProviderA (tabCapture 스트리밍)
 *   - BatchProviderB (서버 사전처리)
 * 어느 쪽이든 이 인터페이스만 구현하면 오버레이/싱크/설정은 그대로 재사용된다.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.YTP = Object.assign(root.YTP || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // Node/브라우저 양쪽에서 코어 확보
  const core =
    typeof require !== "undefined"
      ? Object.assign({}, require("../core/srt.js"), require("../core/track.js"))
      : root.YTP;

  class SubtitleProvider {
    // 하위 클래스가 구현
    async getTrack(_videoId) {
      throw new Error("not implemented");
    }
  }

  class StaticProvider extends SubtitleProvider {
    /**
     * @param {(videoId:string)=>Promise<string|null>} loadSrtText
     *        video_id로 저장된 SRT 텍스트를 돌려주는 함수(주입). 없으면 null.
     */
    constructor(loadSrtText) {
      super();
      this._loadSrtText = loadSrtText;
    }

    async getTrack(videoId) {
      if (!videoId) return null;
      const srt = await this._loadSrtText(videoId);
      if (!srt) return null;
      const cues = core.parseSRT(srt);
      if (cues.length === 0) return null;
      return new core.SubtitleTrack(cues);
    }
  }

  return { SubtitleProvider, StaticProvider };
});
