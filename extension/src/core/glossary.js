/*
 * 고유명사 용어집 (JS) — pilot/glossary/glossary.py 의 브라우저 대응.
 * 번역된 한국어 텍스트의 고유명사·지명 오류를 단일 정규식 패스로 교정.
 * (예: '미란'→'밀라노'). Node/콘텐츠 스크립트 양쪽 동작(UMD).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.YTP = Object.assign(root.YTP || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  class Glossary {
    constructor(entries) {
      this._pairs = [];
      for (const e of entries || []) {
        const from = String((e && e.from) || "").trim();
        const to = String((e && e.to) || "").trim();
        if (from && to) this._pairs.push([from, to]);
      }
      // 긴 항목 우선(부분 겹침 방지)
      this._pairs.sort((a, b) => b[0].length - a[0].length);
      this._map = new Map(this._pairs);
      this._regex = this._pairs.length
        ? new RegExp(this._pairs.map(([f]) => escapeRegex(f)).join("|"), "g")
        : null;
    }

    get size() {
      return this._pairs.length;
    }

    apply(text) {
      if (!text || !this._regex) return text;
      return text.replace(this._regex, (m) => this._map.get(m) || m);
    }
  }

  return { Glossary };
});
