#!/usr/bin/env python3
"""Validate the beat contract and the locally rendered delivery profile."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
BEATS = HERE / "beats.json"
VIDEO = REPO / "assets/video/resource-refinement/abyssal-forge-vox.mp4"
SAMPLES = HERE / "frame-samples"
VALID_MOVES = {"static", "push_in", "pull_out", "pan", "tilt", "parallax", "element"}

beats = json.loads(BEATS.read_text(encoding="utf-8"))
assert beats["topic"] == "How Abyssal Surge turns 3D source assets into a playable dark-fantasy battlefield"
assert beats["arc"] == "hook_payoff"
assert beats["aspect"] == "16:9"
assert beats["title_en"] == "FROM ASSET TO ABYSS"
assert beats["title_ko"] == "에셋에서 심연으로"
assert len(beats["beats"]) == 4
assert [beat["role"] for beat in beats["beats"]] == ["hook", "context", "build", "payoff"]
assert all(beat["title_en"] and beat["title_ko"] for beat in beats["beats"])
assert all(len(beat["shots"]) == 2 for beat in beats["beats"])
shots = [shot for beat in beats["beats"] for shot in beat["shots"]]
assert all(3 <= shot["dur"] <= 6 for shot in shots)
assert all(shot["camera_move"] in VALID_MOVES for shot in shots)
moves = [shot["camera_move"] for shot in shots]
assert all(left != right for left, right in zip(moves, moves[1:])), moves
assert moves[-1] == "static"
planned_duration = sum(shot["dur"] for shot in shots)
assert 18 <= planned_duration <= 24

probe = subprocess.run(
    [
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
        "-of", "json", str(VIDEO),
    ],
    check=True,
    capture_output=True,
    text=True,
)
media = json.loads(probe.stdout)
video_stream = next(stream for stream in media["streams"] if stream["codec_type"] == "video")
assert video_stream["codec_name"] == "h264"
assert (video_stream["width"], video_stream["height"]) == (960, 540)
assert video_stream["r_frame_rate"] == "24/1"
assert video_stream["pix_fmt"] == "yuv420p"
rendered_duration = float(media["format"]["duration"])
assert 18 <= rendered_duration <= 24
blob = VIDEO.read_bytes()
moov, mdat = blob.find(b"moov"), blob.find(b"mdat")
assert 0 <= moov < mdat
sample_count = len(list(SAMPLES.glob("sample-*.jpg")))
assert sample_count == 4

print(
    "PASS: beats=4 shots=8 planned=24.000s moves=" + "→".join(moves)
    + f"; video=h264 960x540 24/1 yuv420p duration={rendered_duration:.3f}s"
    + f"; faststart=moov({moov})<mdat({mdat}); samples={sample_count}"
)
