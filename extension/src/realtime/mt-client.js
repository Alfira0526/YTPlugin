/*
 * MtClient — 번역 클라이언트 인터페이스 (중국어→한국어).
 *
 *   await mtClient.translate(text) -> koText
 *
 * 실제 구현은 DeepL(백그라운드 fetch로 CORS 우회, 키는 서버/프록시 경유 권장) 등.
 * 지금은 MockMtClient로 흐름 검증.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.YTP = Object.assign(root.YTP || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  class MtClient {
    async translate(text) {
      return text;
    }
  }

  // 목 MT — 사전 기반, 없으면 표시용 접두.
  class MockMtClient extends MtClient {
    constructor(dict) {
      super();
      this._dict = dict || {};
    }
    async translate(text) {
      const t = (text || "").trim();
      if (!t) return "";
      return Object.prototype.hasOwnProperty.call(this._dict, t) ? this._dict[t] : `[번역]${t}`;
    }
  }

  /*
   * DeepL MT — 실제 번역. 키 노출 방지를 위해 content가 직접 fetch하지 않고
   * background(서비스 워커)에 위임한다(주입된 send 함수). 실패 시 원문 반환(그레이스풀).
   *   send({type:'mt:translate', text}) -> Promise<{text} | {error}>
   */
  class DeepLMtClient extends MtClient {
    constructor(send) {
      super();
      this._send = send; // (msg) => Promise<resp>
    }
    async translate(text) {
      const t = (text || "").trim();
      if (!t) return "";
      try {
        const resp = await this._send({ type: "mt:translate", text: t });
        if (resp && typeof resp.text === "string") return resp.text;
      } catch (_e) {
        /* 아래로 폴백 */
      }
      return t; // 실패 시 원문 유지(자막이 사라지지 않게)
    }
  }

  return { MtClient, MockMtClient, DeepLMtClient };
});
