/*
 * 실시간 파이프라인 → 오버레이 브라우저 통합 검증.
 * 목 STT/MT + 용어집으로 RealtimeProvider를 실제 Chromium DOM에서 구동,
 * pushAudio에 따라 오버레이에 번역·교정된 라이브 자막이 뜨는지 확인.
 * 실행: node extension/test/realtime.dom.test.cjs
 */
const { chromium } = require("playwright");
const path = require("path");
const assert = require("node:assert");
const fs = require("fs");

const EXECUTABLE = process.env.YTP_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

(async () => {
  const launchOpts = { headless: true };
  if (fs.existsSync(EXECUTABLE)) launchOpts.executablePath = EXECUTABLE;
  const browser = await chromium.launch(launchOpts);
  try {
    const page = await browser.newPage();
    await page.setContent(
      `<!doctype html><html><body>
        <div id="movie_player" style="width:640px;height:360px;position:relative">
          <video class="html5-main-video"></video>
        </div>
      </body></html>`
    );
    for (const f of [
      "src/core/srt.js",
      "src/core/track.js",
      "src/core/glossary.js",
      "src/realtime/stt-client.js",
      "src/realtime/mt-client.js",
      "src/realtime/realtime-provider.js",
      "src/overlay.js",
    ]) {
      await page.addScriptTag({ path: path.join(__dirname, "..", f) });
    }
    await page.addStyleTag({ path: path.join(__dirname, "..", "styles", "overlay.css") });

    const r = await page.evaluate(async () => {
      const { RealtimeProvider, MockSttClient, MockMtClient, Glossary, Overlay } = window.YTP;
      let clock = 0;
      const stt = new MockSttClient(
        [{ text: "你好", dur: 2 }, { text: "在米兰", dur: 2 }],
        () => clock
      );
      const mt = new MockMtClient({ 你好: "안녕하세요", 在米兰: "미란에 있어요" });
      const glossary = new Glossary([{ from: "미란", to: "밀라노" }]);
      const provider = new RealtimeProvider({ sttClient: stt, mtClient: mt, glossary });

      const overlay = new Overlay(document);
      overlay.attach(document.querySelector("#movie_player"));
      provider.onCue((cue) => overlay.setText(cue.text));
      provider.start();

      const txt = () => document.querySelector(".ytp-cc-overlay__text").textContent;
      const out = {};
      clock = 5; provider.pushAudio(null); await provider.drain();
      out.first = txt();
      clock = 8; provider.pushAudio(null); await provider.drain();
      out.second = txt();
      out.visible = document.querySelector(".ytp-cc-overlay").classList.contains("is-visible");
      out.cueCount = provider.getCues().length;
      return out;
    });

    assert.strictEqual(r.first, "안녕하세요", "첫 라이브 자막(번역)");
    assert.strictEqual(r.second, "밀라노에 있어요", "둘째 자막(용어집 교정: 미란→밀라노)");
    assert.strictEqual(r.visible, true, "자막 표시 상태");
    assert.strictEqual(r.cueCount, 2, "누적 cue 2개");

    console.log("✅ 실시간→오버레이 DOM 통합 검증 통과 (4 assertions)");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error("❌ 실시간 DOM 테스트 실패:", e && e.message ? e.message : e);
  process.exit(1);
});
