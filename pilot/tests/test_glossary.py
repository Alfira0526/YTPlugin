"""용어집(Glossary) + 파이프라인 opt-in 통합 검증.

실행: python -m pilot.tests.test_glossary
"""
from __future__ import annotations

import tempfile

from pilot.glossary.glossary import Glossary
from pilot.pipeline import run_pipeline
from pilot.cache import SubtitleCache


def test_apply_basic():
    g = Glossary([{"from": "미란", "to": "밀라노"}, {"from": "커모호", "to": "코모 호수"}])
    assert g.apply("저는 지금 미란에 있고 커모호를 봤어요") == "저는 지금 밀라노에 있고 코모 호수를 봤어요"
    assert g.apply("변경 없음") == "변경 없음"
    assert g.apply("") == ""


def test_longest_match_first():
    # 긴 항목이 먼저 적용되어 부분 겹침을 막아야 함
    g = Glossary([{"from": "AD", "to": "에이디"}, {"from": "AD라디오", "to": "AD 잡지"}])
    assert g.apply("AD라디오와 함께") == "AD 잡지와 함께"


def test_from_json_seed():
    g = Glossary.from_json()  # 시드
    assert g.size >= 1
    assert g.apply("미란") == "밀라노"


def test_pipeline_optin_off_by_default():
    # glossary 미지정 시 원문 그대로(교정 안 함)
    r = run_pipeline("x.wav", "stub", "stub")
    joined = " ".join(s.text for s in r.segments)
    assert "라이브 방송" in joined  # stub 원문 유지


def test_pipeline_with_glossary_applies():
    g = Glossary([{"from": "라이브 방송", "to": "생방송"}])
    with tempfile.TemporaryDirectory() as d:
        cache = SubtitleCache(d)
        r = run_pipeline("x.wav", "stub", "stub", video_id="vidG", cache=cache, glossary=g)
        joined = " ".join(s.text for s in r.segments)
        assert "생방송" in joined and "라이브 방송" not in joined
        # 캐시에도 교정본이 저장됨
        cached = cache.get("vidG")
        assert cached and any("생방송" in s.text for s in cached)


def main():
    tests = [
        test_apply_basic,
        test_longest_match_first,
        test_from_json_seed,
        test_pipeline_optin_off_by_default,
        test_pipeline_with_glossary_applies,
    ]
    for t in tests:
        t()
        print(f"ok - {t.__name__}")
    print(f"\n✅ 용어집 테스트 {len(tests)}건 전부 통과")


if __name__ == "__main__":
    main()
