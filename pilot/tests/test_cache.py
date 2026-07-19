"""자막 캐시 + 파이프라인 캐싱 동작 검증.

실행: python -m pilot.tests.test_cache   (리포 루트에서)
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from pilot.cache import SubtitleCache
from pilot.pipeline import run_pipeline
from pilot.segment import Segment


def test_cache_roundtrip():
    with tempfile.TemporaryDirectory() as d:
        cache = SubtitleCache(d)
        segs = [
            Segment(start=0.0, end=2.0, text="안녕하세요", source_text="你好"),
            Segment(start=2.0, end=4.0, text="반가워요", source_text="很高兴"),
        ]
        assert not cache.has("vidA")
        cache.put("vidA", segs, meta={"stt": "stub"})
        assert cache.has("vidA")
        got = cache.get("vidA")
        assert got is not None and len(got) == 2
        assert got[0].text == "안녕하세요" and got[0].source_text == "你好"
        assert got[1].start == 2.0 and got[1].end == 4.0
        assert cache.get("없는아이디") is None


def test_cache_video_id_sanitized():
    with tempfile.TemporaryDirectory() as d:
        cache = SubtitleCache(d)
        # 경로 조작 문자는 파일명에서 제거되어 캐시 디렉터리를 벗어나지 않음
        cache.put("../../evil", [Segment(0.0, 1.0, "x")], {})
        files = list(Path(d).glob("*.json"))
        assert len(files) == 1
        assert ".." not in files[0].name and "/" not in files[0].name


def test_pipeline_cache_hit_skips_processing():
    with tempfile.TemporaryDirectory() as d:
        cache = SubtitleCache(d)
        # 1차: 계산 후 저장 (stub 백엔드)
        r1 = run_pipeline("dummy.wav", "stub", "stub", video_id="vidX", cache=cache)
        assert r1.cache_hit is False
        assert r1.stt_backend == "stub" and r1.mt_backend == "stub"
        assert len(r1.segments) > 0
        # 2차: 캐시 히트 → STT·MT 생략
        r2 = run_pipeline("dummy.wav", "stub", "stub", video_id="vidX", cache=cache)
        assert r2.cache_hit is True
        assert r2.stt_backend == "cache" and r2.mt_backend == "cache"
        assert [s.text for s in r2.segments] == [s.text for s in r1.segments]
        # 원문(중국어)도 복원됨
        assert all(s.text for s in r2.source_segments)


def main():
    tests = [
        test_cache_roundtrip,
        test_cache_video_id_sanitized,
        test_pipeline_cache_hit_skips_processing,
    ]
    for t in tests:
        t()
        print(f"ok - {t.__name__}")
    print(f"\n✅ 캐시 테스트 {len(tests)}건 전부 통과")


if __name__ == "__main__":
    main()
