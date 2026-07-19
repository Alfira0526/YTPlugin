"""파일럿 실행기 (CLI).

사용 예:
  # 오프라인 스모크 (모델/키/네트워크 불필요) — 하네스 배관 검증
  python -m pilot.run_pilot --smoke

  # 실제 파일럿 (로컬/GPU + 모델·키 준비 후)
  python -m pilot.run_pilot --audio pilot/samples/sample1.wav \
      --stt qwen3-asr --mt deepl --video-id rQk3C3bUKxs

산출물: <out-dir>/<video-id>.srt , <out-dir>/<video-id>_memo.md
"""
from __future__ import annotations

import argparse
import datetime as _dt
import sys
from pathlib import Path

from .config import OUTPUT_DIR, Config
from .pipeline import run_pipeline
from .report import render_memo
from .srt import write_srt


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="pilot", description="P0 파일럿: 오디오 → STT → MT → SRT + 메모")
    p.add_argument("--audio", help="입력 오디오/영상 파일 경로")
    p.add_argument("--stt", help="STT 백엔드 (stub|sensevoice|qwen3-asr)")
    p.add_argument("--mt", help="MT 백엔드 (stub|deepl|papago)")
    p.add_argument("--video-id", default="pilot", help="출력 파일명·캐시 키로 쓰일 video ID")
    p.add_argument("--out-dir", default=str(OUTPUT_DIR), help="산출물 디렉터리")
    p.add_argument(
        "--smoke",
        action="store_true",
        help="오프라인 스모크 모드: stub 백엔드로 배관만 검증(모델·키 불필요)",
    )
    p.add_argument(
        "--no-cache",
        action="store_true",
        help="자막 캐시를 사용하지 않음(§3-4). 기본은 video_id 기준 캐시 사용",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    cfg = Config.from_env()

    if args.smoke:
        stt_backend, mt_backend = "stub", "stub"
        audio_path = args.audio or "(smoke: 합성 오디오 — 실제 파일 없음)"
        video_id = "smoke"
    else:
        stt_backend = args.stt or cfg.stt_backend
        mt_backend = args.mt or cfg.mt_backend
        audio_path = args.audio
        video_id = args.video_id
        if not audio_path:
            print("오류: --audio 가 필요합니다 (또는 --smoke 사용).", file=sys.stderr)
            return 2
        if not Path(audio_path).exists():
            print(f"오류: 오디오 파일을 찾을 수 없습니다: {audio_path}", file=sys.stderr)
            return 2

    # 캐시: 스모크 모드가 아니고 --no-cache가 아니면 사용
    cache = None
    if not args.smoke and not args.no_cache:
        from .cache import SubtitleCache
        cache = SubtitleCache()

    print(f"[파일럿] STT={stt_backend} MT={mt_backend} video_id={video_id}"
          f"{' (cache on)' if cache else ''}")
    result = run_pipeline(
        audio_path=audio_path,
        stt_backend=stt_backend,
        mt_backend=mt_backend,
        source_lang=cfg.source_lang,
        target_lang=cfg.target_lang,
        video_id=video_id,
        cache=cache,
    )

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    srt_path = out_dir / f"{video_id}.srt"
    write_srt(result.segments, str(srt_path))

    date = _dt.date.today().isoformat()
    memo = render_memo(result, video_id=video_id, audio_path=str(audio_path), date=date)
    memo_path = out_dir / f"{video_id}_memo.md"
    memo_path.write_text(memo, encoding="utf-8")

    if result.cache_hit:
        print(f"  ✓ 캐시 히트 — STT·MT 재처리 생략 (video_id={video_id})")
    print(f"  세그먼트 {len(result.segments)}개 | STT {result.stt_seconds:.2f}s "
          f"| MT {result.mt_seconds:.2f}s | 원문 {result.mt_usage.source_chars}자")
    print(f"  ▶ SRT : {srt_path}")
    print(f"  ▶ 메모: {memo_path}")
    if stt_backend == "stub" or mt_backend == "stub":
        print("  ⚠️ 스텁 백엔드 사용 — 배관 검증용이며 실제 품질을 대표하지 않습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
