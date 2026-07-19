/*
 * 브라우저 DOM 통합 검증 — 목업 유튜브 플레이어에 오버레이를 붙이고
 * 재생 시각에 따라 자막 텍스트·스타일이 정확히 반영되는지 실제 Chromium에서 확인.
 * 실행: node extension/test/overlay.dom.test.cjs
 */
const { chromium } = require("playwright");
const path = require("path");
const assert = require("node:assert");

const SAMPLE = `1
00:00:00,000 --> 00:00:02,500
여러분 안녕하세요

2
00:00:02,500 --> 00:00:05,000
오늘 날씨가 좋네요

3
00:00:06,000 --> 00:00:08,000
다음에 또 만나요
`;

// 프리설치 Chromium(버전 상이) 경로를 우선 사용, 없으면 기본 해석
const EXECUTABLE = process.env.YTP_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const fs = require("fs");

(async () => {
  const launchOpts = { headless: true };
  if (fs.existsSync(EXECUTABLE)) launchOpts.executablePath = EXECUTABLE;
  const browser = await chromium.launch(launchOpts);
  try {
    const page = await browser.newPage();
    await page.setContent(
      `<!doctype html><html><body>
        <div id="movie_player" style="width:640px;height:360px;position:relative;background:#000">
          <video class="html5-main-video"></video>
        </div>
      </body></html>`
    );
    for (const f of [
      "src/core/srt.js",
      "src/core/track.js",
      "src/providers/static-provider.js",
      "src/overlay.js",
    ]) {
      await page.addScriptTag({ path: path.join(__dirname, "..", f) });
    }
    await page.addStyleTag({ path: path.join(__dirname, "..", "styles", "overlay.css") });

    const r = await page.evaluate((SRT) => {
      const { parseSRT, SubtitleTrack, Overlay } = window.YTP;
      const track = new SubtitleTrack(parseSRT(SRT));
      const overlay = new Overlay(document);
      overlay.attach(document.querySelector("#movie_player"));
      const box = document.querySelector(".ytp-cc-overlay");
      const txt = document.querySelector(".ytp-cc-overlay__text");
      const show = (t) => {
        const c = track.activeAt(t);
        overlay.setText(c ? c.text : "");
      };
      const out = {};
      out.attached = !!document.querySelector("#movie_player .ytp-cc-overlay");
      show(1); out.t1 = txt.textContent; out.vis1 = box.classList.contains("is-visible");
      show(3); out.t3 = txt.textContent;
      show(5.5); out.gapText = txt.textContent; out.visGap = box.classList.contains("is-visible");
      show(7); out.t7 = txt.textContent;
      // 스타일 적용
      overlay.applyStyle({ fontScale: 1.5, bgOpacity: 0.8, verticalPosition: 80, enabled: true });
      out.fontVar = getComputedStyle(txt).getPropertyValue("--ytp-cc-font-scale").trim();
      out.bottom = box.style.bottom;
      overlay.applyStyle({ enabled: false });
      out.hiddenDisplay = box.style.display;
      return out;
    }, SAMPLE);

    assert.strictEqual(r.attached, true, "오버레이가 플레이어에 붙어야 함");
    assert.strictEqual(r.t1, "여러분 안녕하세요", "t=1 자막");
    assert.strictEqual(r.vis1, true, "자막 있을 때 is-visible");
    assert.strictEqual(r.t3, "오늘 날씨가 좋네요", "t=3 자막");
    assert.strictEqual(r.gapText, "", "간격에서 빈 자막");
    assert.strictEqual(r.visGap, false, "간격에서 숨김");
    assert.strictEqual(r.t7, "다음에 또 만나요", "t=7 자막");
    assert.strictEqual(r.fontVar, "1.5", "글자 크기 변수 반영");
    assert.strictEqual(r.bottom, "20%", "세로 위치(하단 20%) 반영");
    assert.strictEqual(r.hiddenDisplay, "none", "끄면 숨김");

    console.log("✅ DOM 통합 검증 통과 (10 assertions)");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error("❌ DOM 테스트 실패:", e && e.message ? e.message : e);
  process.exit(1);
});
