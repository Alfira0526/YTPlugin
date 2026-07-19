/* 코어 유닛 테스트 (Chrome 불필요) — node --test 로 실행 */
const test = require("node:test");
const assert = require("node:assert");

const { parseSRT, parseTimestamp, formatTimestamp } = require("../src/core/srt.js");
const { SubtitleTrack } = require("../src/core/track.js");
const { StaticProvider } = require("../src/providers/static-provider.js");

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

test("parseTimestamp: 다양한 포맷", () => {
  assert.strictEqual(parseTimestamp("00:01:02,500"), 62.5);
  assert.strictEqual(parseTimestamp("01:02.250"), 62.25);
  assert.strictEqual(parseTimestamp("00:00:00,000"), 0);
  assert.strictEqual(parseTimestamp("nope"), null);
});

test("formatTimestamp: 왕복", () => {
  assert.strictEqual(formatTimestamp(62.5), "00:01:02,500");
  assert.strictEqual(formatTimestamp(0), "00:00:00,000");
});

test("parseSRT: 큐 개수·시간·텍스트", () => {
  const cues = parseSRT(SAMPLE);
  assert.strictEqual(cues.length, 3);
  assert.strictEqual(cues[0].start, 0);
  assert.strictEqual(cues[0].end, 2.5);
  assert.strictEqual(cues[0].text, "여러분 안녕하세요");
  assert.strictEqual(cues[2].text, "다음에 또 만나요");
});

test("parseSRT: 빈 입력·CRLF", () => {
  assert.deepStrictEqual(parseSRT(""), []);
  const cues = parseSRT("1\r\n00:00:01,000 --> 00:00:02,000\r\n안녕\r\n");
  assert.strictEqual(cues.length, 1);
  assert.strictEqual(cues[0].text, "안녕");
});

test("SubtitleTrack.activeAt: 경계·간격", () => {
  const track = new SubtitleTrack(parseSRT(SAMPLE));
  assert.strictEqual(track.length, 3);
  assert.strictEqual(track.activeAt(0).text, "여러분 안녕하세요"); // start 포함
  assert.strictEqual(track.activeAt(1.2).text, "여러분 안녕하세요");
  assert.strictEqual(track.activeAt(2.5).text, "오늘 날씨가 좋네요"); // 다음 cue start
  assert.strictEqual(track.activeAt(5.5), null); // 5.0~6.0 간격
  assert.strictEqual(track.activeAt(7.0).text, "다음에 또 만나요");
  assert.strictEqual(track.activeAt(100), null); // 끝 이후
});

test("SubtitleTrack: 순차 재생 빠른 경로도 정확", () => {
  const track = new SubtitleTrack(parseSRT(SAMPLE));
  const seq = [0, 0.5, 1, 2, 2.5, 3, 4, 6, 7, 8, 9];
  const expected = [
    "여러분 안녕하세요", "여러분 안녕하세요", "여러분 안녕하세요",
    "여러분 안녕하세요", "오늘 날씨가 좋네요", "오늘 날씨가 좋네요",
    "오늘 날씨가 좋네요", "다음에 또 만나요", "다음에 또 만나요", null, null,
  ];
  seq.forEach((t, i) => {
    const cue = track.activeAt(t);
    assert.strictEqual(cue ? cue.text : null, expected[i], `t=${t}`);
  });
});

test("StaticProvider.getTrack: 로더 주입", async () => {
  const store = { abc123: SAMPLE };
  const provider = new StaticProvider(async (id) => store[id] || null);
  const track = await provider.getTrack("abc123");
  assert.ok(track);
  assert.strictEqual(track.length, 3);
  assert.strictEqual(await provider.getTrack("missing"), null);
  assert.strictEqual(await provider.getTrack(""), null);
});
