/* DeepL 헬퍼 + cue 직렬화 + DeepLMtClient 유닛 테스트 — node --test */
const test = require("node:test");
const assert = require("node:assert");

const { buildDeepLRequest, parseDeepLResponse, deeplEndpoint } = require("../src/realtime/deepl.js");
const { serializeCues, parseSRT } = require("../src/core/srt.js");
const { DeepLMtClient } = require("../src/realtime/mt-client.js");

test("deeplEndpoint: 무료(:fx) vs 유료", () => {
  assert.ok(deeplEndpoint("abcd:fx").includes("api-free.deepl.com"));
  assert.ok(deeplEndpoint("abcd").includes("api.deepl.com"));
});

test("buildDeepLRequest: 본문·헤더", () => {
  const req = buildDeepLRequest("你好", { apiKey: "k:fx", source: "zh", target: "ko" });
  assert.strictEqual(req.method, "POST");
  assert.strictEqual(req.headers.Authorization, "DeepL-Auth-Key k:fx");
  assert.ok(req.body.includes("text=%E4%BD%A0%E5%A5%BD")); // 你好 URL 인코딩
  assert.ok(req.body.includes("source_lang=ZH"));
  assert.ok(req.body.includes("target_lang=KO"));
});

test("parseDeepLResponse: translations 추출/방어", () => {
  assert.deepStrictEqual(
    parseDeepLResponse({ translations: [{ text: "안녕" }, { text: "반가워" }] }),
    ["안녕", "반가워"]
  );
  assert.deepStrictEqual(parseDeepLResponse({}), []);
  assert.deepStrictEqual(parseDeepLResponse(null), []);
});

test("serializeCues → parseSRT 왕복", () => {
  const cues = [
    { start: 0, end: 2.5, text: "여러분 안녕하세요" },
    { start: 2.5, end: 5, text: "반가워요" },
    { start: 5, end: 6, text: "   " }, // 빈 텍스트는 제외
  ];
  const srt = serializeCues(cues);
  const parsed = parseSRT(srt);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].text, "여러분 안녕하세요");
  assert.strictEqual(parsed[0].start, 0);
  assert.strictEqual(parsed[0].end, 2.5);
  assert.strictEqual(parsed[1].text, "반가워요");
});

test("DeepLMtClient: 위임 성공/실패 폴백", async () => {
  const okClient = new DeepLMtClient(async () => ({ text: "안녕하세요" }));
  assert.strictEqual(await okClient.translate("你好"), "안녕하세요");

  const failClient = new DeepLMtClient(async () => {
    throw new Error("no key");
  });
  assert.strictEqual(await failClient.translate("你好"), "你好"); // 원문 폴백
  assert.strictEqual(await okClient.translate("   "), ""); // 공백
});
