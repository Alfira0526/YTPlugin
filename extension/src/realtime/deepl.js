/*
 * DeepL 요청/응답 헬퍼 (순수, 테스트 가능).
 * 실제 fetch는 background(서비스 워커)에서 수행 — 키를 페이지 컨텍스트에 노출하지 않기 위함(보안).
 *
 * 무료/유료 엔드포인트: 키가 ':fx'로 끝나면 무료(api-free), 아니면 유료(api).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.YTP = Object.assign(root.YTP || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function deeplEndpoint(apiKey) {
    const free = typeof apiKey === "string" && apiKey.trim().endsWith(":fx");
    return free
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";
  }

  function buildDeepLRequest(text, opts) {
    opts = opts || {};
    const apiKey = opts.apiKey || "";
    const body = new URLSearchParams();
    const texts = Array.isArray(text) ? text : [text];
    for (const t of texts) body.append("text", t);
    body.append("source_lang", (opts.source || "ZH").toUpperCase());
    body.append("target_lang", (opts.target || "KO").toUpperCase());
    return {
      url: deeplEndpoint(apiKey),
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    };
  }

  function parseDeepLResponse(json) {
    // { translations: [{ text, detected_source_language }] }
    if (!json || !Array.isArray(json.translations)) return [];
    return json.translations.map((t) => (t && t.text != null ? t.text : ""));
  }

  return { deeplEndpoint, buildDeepLRequest, parseDeepLResponse };
});
