/* (a) 실시간 코어 + JS 용어집 유닛 테스트 — node --test */
const test = require("node:test");
const assert = require("node:assert");

const { Glossary } = require("../src/core/glossary.js");
const { MockSttClient } = require("../src/realtime/stt-client.js");
const { MockMtClient } = require("../src/realtime/mt-client.js");
const { RealtimeProvider } = require("../src/realtime/realtime-provider.js");

test("JS Glossary: 기본 치환 + 긴 항목 우선(재매칭 방지)", () => {
  const g = new Glossary([
    { from: "미란", to: "밀라노" },
    { from: "AD", to: "에이디" },
    { from: "AD라디오", to: "AD 잡지" },
  ]);
  assert.strictEqual(g.apply("저는 미란에 있어요"), "저는 밀라노에 있어요");
  assert.strictEqual(g.apply("AD라디오와 함께"), "AD 잡지와 함께"); // AD 재치환 안 됨
  assert.strictEqual(g.apply("변경 없음"), "변경 없음");
  assert.strictEqual(g.size, 3);
});

test("MockSttClient: 스크립트 세그먼트를 clock 타임스탬프로 방출", () => {
  let t = 0;
  const stt = new MockSttClient(
    [{ text: "你好", dur: 2 }, { text: "谢谢", dur: 1.5 }],
    () => t
  );
  const got = [];
  stt.onSegment((s) => got.push(s));
  t = 10; stt.pushAudio(null);
  t = 12; stt.pushAudio(null);
  stt.pushAudio(null); // 스크립트 소진 → 방출 없음
  assert.strictEqual(got.length, 2);
  assert.deepStrictEqual(got[0], { start: 10, end: 12, text: "你好" });
  assert.deepStrictEqual(got[1], { start: 12, end: 13.5, text: "谢谢" });
});

test("RealtimeProvider: 캡처→STT→MT→(용어집)→cue 전체 흐름", async () => {
  let t = 0;
  const stt = new MockSttClient(
    [{ text: "你好", dur: 2 }, { text: "在米兰", dur: 2 }],
    () => t
  );
  const mt = new MockMtClient({ 你好: "안녕하세요", 在米兰: "미란에 있어요" });
  const glossary = new Glossary([{ from: "미란", to: "밀라노" }]);
  const provider = new RealtimeProvider({ sttClient: stt, mtClient: mt, glossary });

  const cues = [];
  provider.onCue((c) => cues.push(c));
  provider.start();

  t = 5; provider.pushAudio(null);
  t = 7; provider.pushAudio(null);
  await provider.drain();

  assert.strictEqual(cues.length, 2);
  assert.strictEqual(cues[0].text, "안녕하세요");
  assert.strictEqual(cues[0].source_text, "你好");
  assert.strictEqual(cues[0].start, 5);
  // 용어집 적용: 미란→밀라노
  assert.strictEqual(cues[1].text, "밀라노에 있어요");
  assert.strictEqual(cues[1].source_text, "在米兰");
  assert.strictEqual(provider.getCues().length, 2);
});

test("RealtimeProvider: stop 후 pushAudio 무시", async () => {
  const stt = new MockSttClient([{ text: "你好" }], () => 0);
  const mt = new MockMtClient({});
  const provider = new RealtimeProvider({ sttClient: stt, mtClient: mt });
  const cues = [];
  provider.onCue((c) => cues.push(c));
  provider.start();
  provider.stop();
  provider.pushAudio(null);
  await provider.drain();
  assert.strictEqual(cues.length, 0);
});
