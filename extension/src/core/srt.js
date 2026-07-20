/*
 * SRT 파싱 코어 (순수 함수, Chrome API 의존 없음).
 * Node(require)와 콘텐츠 스크립트(전역 YTP) 양쪽에서 동작하는 UMD 패턴.
 * 오디오 확보 방식 (a)/(b)와 무관 — 자막 데이터 표현만 담당.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.YTP = Object.assign(root.YTP || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // "HH:MM:SS,mmm" 또는 "MM:SS.mmm" → 초(float)
  function parseTimestamp(ts) {
    const m = String(ts).trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/);
    if (!m) return null;
    const hours = m[1] ? parseInt(m[1], 10) : 0;
    const minutes = parseInt(m[2], 10);
    const seconds = parseInt(m[3], 10);
    const millis = parseInt(m[4].padEnd(3, "0"), 10);
    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
  }

  // SRT/VTT 유사 텍스트 → [{index, start, end, text}] (start 오름차순 정렬)
  function parseSRT(text) {
    if (!text) return [];
    const normalized = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    // WEBVTT 헤더 제거
    const body = normalized.replace(/^﻿?WEBVTT[^\n]*\n/, "");
    const blocks = body.split(/\n{2,}/);
    const cues = [];
    for (const block of blocks) {
      const lines = block.split("\n").filter((l) => l.trim() !== "");
      if (lines.length === 0) continue;
      // 첫 줄이 숫자 인덱스면 건너뜀
      let i = 0;
      if (/^\d+$/.test(lines[0].trim()) && lines[1] && lines[1].includes("-->")) i = 1;
      const timeLine = lines[i];
      if (!timeLine || !timeLine.includes("-->")) continue;
      const [rawStart, rawEnd] = timeLine.split("-->");
      const start = parseTimestamp(rawStart);
      const end = parseTimestamp(rawEnd);
      if (start === null || end === null) continue;
      const textLines = lines.slice(i + 1);
      const cueText = textLines.join("\n").trim();
      if (!cueText) continue;
      cues.push({ index: cues.length + 1, start, end, text: cueText });
    }
    cues.sort((a, b) => a.start - b.start);
    return cues;
  }

  function formatTimestamp(seconds) {
    const s = Math.max(0, seconds);
    const total = Math.round(s * 1000);
    const hh = Math.floor(total / 3600000);
    const mm = Math.floor((total % 3600000) / 60000);
    const ss = Math.floor((total % 60000) / 1000);
    const ms = total % 1000;
    const pad = (n, w = 2) => String(n).padStart(w, "0");
    return `${pad(hh)}:${pad(mm)}:${pad(ss)},${pad(ms, 3)}`;
  }

  // cue 배열([{start,end,text}]) → SRT 문자열 (실시간 결과를 캐시 저장할 때 사용)
  function serializeCues(cues) {
    const list = (cues || []).filter((c) => c && (c.text || "").trim() !== "");
    return list
      .map((c, i) => {
        const start = formatTimestamp(c.start);
        const end = formatTimestamp(c.end);
        return `${i + 1}\n${start} --> ${end}\n${String(c.text).trim()}\n`;
      })
      .join("\n");
  }

  return { parseTimestamp, parseSRT, formatTimestamp, serializeCues };
});
