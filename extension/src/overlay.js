/*
 * Overlay — 유튜브 플레이어 위에 자막 DOM을 그리고 스타일을 적용하는 어댑터.
 * 렌더링만 담당(오디오 방식 무관). 설정: 위치·크기·배경 투명도(계획서 §4).
 */
(function (root) {
  "use strict";

  const DEFAULT_STYLE = {
    enabled: true,
    fontScale: 1.0, // 0.6 ~ 2.0
    verticalPosition: 88, // 플레이어 높이 대비 % (하단 기준)
    bgOpacity: 0.55, // 0 ~ 1
  };

  class Overlay {
    constructor(doc) {
      this.doc = doc || document;
      this.el = this.doc.createElement("div");
      this.el.className = "ytp-cc-overlay";
      this.el.setAttribute("aria-live", "polite");
      this.inner = this.doc.createElement("span");
      this.inner.className = "ytp-cc-overlay__text";
      this.el.appendChild(this.inner);
      this.style = Object.assign({}, DEFAULT_STYLE);
      this._applyStyleToDom();
    }

    attach(parent) {
      if (parent && this.el.parentNode !== parent) parent.appendChild(this.el);
    }

    detach() {
      if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    }

    setText(text) {
      const t = (text || "").trim();
      if (!t) {
        this.inner.textContent = "";
        this.el.classList.remove("is-visible");
        return;
      }
      // 안전: textContent만 사용(HTML 주입 방지)
      this.inner.textContent = t;
      this.el.classList.add("is-visible");
    }

    applyStyle(patch) {
      this.style = Object.assign({}, this.style, patch || {});
      this._applyStyleToDom();
    }

    _applyStyleToDom() {
      const s = this.style;
      this.el.style.display = s.enabled ? "" : "none";
      this.el.style.setProperty("--ytp-cc-font-scale", String(s.fontScale));
      this.el.style.setProperty("--ytp-cc-bg-opacity", String(s.bgOpacity));
      // verticalPosition: 상단 기준 %가 아니라 '하단에서 얼마나 위'인지로 직관화
      const bottomPct = Math.max(0, Math.min(100, 100 - s.verticalPosition));
      this.el.style.bottom = bottomPct + "%";
    }

    destroy() {
      this.detach();
      this.el = null;
      this.inner = null;
    }
  }

  root.YTP = Object.assign(root.YTP || {}, { Overlay, DEFAULT_STYLE });
})(typeof globalThis !== "undefined" ? globalThis : this);
