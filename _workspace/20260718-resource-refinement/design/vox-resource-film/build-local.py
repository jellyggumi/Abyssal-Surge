#!/usr/bin/env python3
"""Build the credential-free Abyssal Forge Vox fallback from repository-owned assets."""

from __future__ import annotations

import json
import math
import random
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
BEATS_PATH = HERE / "beats.json"
LOCAL = HERE / "local"
POSTERS = LOCAL / "posters"
CLIPS = LOCAL / "clips"
SOURCE_FRAMES = LOCAL / "source-frames"
SAMPLES = HERE / "frame-samples"
OUTPUT = REPO / "assets/video/resource-refinement/abyssal-forge-vox.mp4"
WIDTH, HEIGHT, FPS = 960, 540, 24
SHOT_SECONDS = 3.0
XFADE_SECONDS = 0.2
FONT = Path("/System/Library/Fonts/AppleSDGothicNeo.ttc")
PALETTES = [
    ((13, 12, 19), (122, 55, 205), (226, 216, 192), (211, 72, 50)),
    ((222, 211, 184), (52, 86, 111), (90, 45, 145), (210, 76, 43)),
    ((52, 24, 72), (140, 66, 211), (230, 214, 180), (230, 101, 39)),
    ((10, 28, 34), (115, 57, 197), (229, 217, 190), (230, 94, 40)),
]
SOURCE_MAP = {
    "gate": REPO / "assets/images/battle/glb/gate-sovereign__Idle.png",
    "citadel": REPO / "assets/images/battle/glb/veil-citadel.png",
    "atlas": REPO / "assets/images/battle/sovereign-atlas.png",
    "boss": REPO / "assets/images/ui/boss-gate-sovereign.png",
    "texture": REPO / "assets/models/abyssal-command/textures/source/violet-rift.png",
    "capture": REPO / "assets/images/ui/action-capture.png",
    "possess": REPO / "assets/images/ui/action-possess.png",
    "domain": REPO / "assets/images/ui/action-domain.png",
    "concept": REPO / "assets/images/ui/concept-tactical-surface.png",
    "storyboard": REPO / "assets/images/storyboard/scene_04_domain_shift_v01.jpg",
}
SHOT_ASSETS = {
    "1a": ["capture", "boss", "texture"],
    "1b": ["texture", "cinematic-02", "boss"],
    "2a": ["capture", "boss", "citadel"],
    "2b": ["capture", "boss", "cinematic-10"],
    "3a": ["capture", "possess", "domain"],
    "3b": ["capture", "concept", "cinematic-10"],
    "4a": ["storyboard", "cinematic-16", "boss"],
    "4b": ["cinematic-16", "storyboard", "capture"],
}
STEP_LABELS = {
    "1a": "RAW 3D SOURCE / 원본 3D 에셋",
    "1b": "BEAUTIFUL, NOT PLAYABLE / 아름답지만 아직 플레이 불가",
    "2a": "SILHOUETTE · ATLAS · ACTION · LANDMARK",
    "2b": "READABLE PIECES / 읽히는 조각",
    "3a": "CAPTURE → POSSESS → DOMAIN",
    "3b": "RULES BECOME CONSEQUENCES / 규칙이 결과가 된다",
    "4a": "PLAYER INPUT → VISIBLE BATTLEFIELD",
    "4b": "3D SOURCE → PLAYABLE ABYSS",
}


def run(args: list[str]) -> None:
    subprocess.run(args, check=True)


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT), size=size)


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start: int) -> ImageFont.FreeTypeFont:
    size = start
    while size > 14:
        candidate = font(size)
        if draw.textlength(text, font=candidate) <= max_width:
            return candidate
        size -= 2
    return font(size)


def add_paper_texture(image: Image.Image, seed: int) -> None:
    rng = random.Random(seed)
    draw = ImageDraw.Draw(image, "RGBA")
    for y in range(18, HEIGHT, 22):
        offset = rng.randint(-8, 8)
        for x in range(18 + offset, WIDTH, 24):
            draw.ellipse((x, y, x + 3, y + 3), fill=(245, 234, 205, 24))
    noise = Image.effect_noise((WIDTH, HEIGHT), 18).convert("L")
    grain = Image.new("RGBA", (WIDTH, HEIGHT), (255, 255, 255, 0))
    grain.putalpha(noise.point(lambda p: max(0, min(32, p // 7))))
    image.alpha_composite(grain)


def irregular_mask(size: tuple[int, int], seed: int) -> Image.Image:
    w, h = size
    rng = random.Random(seed)
    points: list[tuple[int, int]] = []
    for x in range(0, w + 1, 22):
        points.append((min(x, w), rng.randint(0, 7)))
    for y in range(22, h + 1, 22):
        points.append((w - rng.randint(0, 7), min(y, h)))
    for x in range(w - 22, -1, -22):
        points.append((max(x, 0), h - rng.randint(0, 7)))
    for y in range(h - 22, 0, -22):
        points.append((rng.randint(0, 7), y))
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(0.45))


def prepare_source(source: Path, seed: int) -> Image.Image:
    src = Image.open(source).convert("RGB")
    if "atlas" in source.stem:
        cell_w = max(1, src.width // 10)
        cell_h = max(1, src.height // 4)
        column = seed % 10
        row = (seed // 10) % 4
        src = src.crop((column * cell_w, row * cell_h, (column + 1) * cell_w, (row + 1) * cell_h))
    gray = src.convert("L")
    visible = gray.point(lambda value: 255 if value > 12 else 0)
    bbox = visible.getbbox()
    if bbox:
        left, top, right, bottom = bbox
        if (right - left) < src.width * 0.88 or (bottom - top) < src.height * 0.88:
            pad_x = max(6, (right - left) // 10)
            pad_y = max(6, (bottom - top) // 10)
            src = src.crop((
                max(0, left - pad_x),
                max(0, top - pad_y),
                min(src.width, right + pad_x),
                min(src.height, bottom + pad_y),
            ))
    luminance = src.convert("L").resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))
    src = ImageEnhance.Brightness(src).enhance(1.65 if luminance < 62 else 1.08)
    src = ImageEnhance.Contrast(src).enhance(1.24)
    return ImageEnhance.Color(src).enhance(0.82)


def paste_card(canvas: Image.Image, source: Path, box: tuple[int, int, int, int], seed: int, accent: tuple[int, int, int]) -> None:
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    src = prepare_source(source, seed)
    src = ImageOps.fit(src, (w, h), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5)).convert("RGBA")
    mask = irregular_mask((w, h), seed)
    border = Image.new("RGBA", (w + 16, h + 16), (*accent, 255))
    border_mask = irregular_mask((w + 16, h + 16), seed + 31)
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 145), (x0 + 13, y0 + 15, x1 + 13, y1 + 15), mask)
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(8)))
    canvas.paste(border, (x0 - 8, y0 - 8), border_mask)
    canvas.paste(src, (x0, y0), mask)
    tape = Image.new("RGBA", (54, 18), (235, 218, 171, 165))
    tape = tape.rotate(-7 if seed % 2 else 6, expand=True, resample=Image.Resampling.BICUBIC)
    canvas.alpha_composite(tape, (x0 + w // 2 - tape.width // 2, y0 - 10))


def draw_banner(canvas: Image.Image, title_en: str, title_ko: str, accent: tuple[int, int, int], paper: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(canvas, "RGBA")
    points = [(42, 34), (668, 27), (677, 108), (54, 119), (35, 93)]
    draw.polygon([(x + 8, y + 9) for x, y in points], fill=(0, 0, 0, 130))
    draw.polygon(points, fill=(*paper, 248))
    draw.polygon([(590, 27), (677, 27), (677, 108), (640, 111)], fill=(*accent, 245))
    en_font = fit_font(draw, title_en, 565, 48)
    ko_font = fit_font(draw, title_ko, 525, 24)
    paper_luminance = 0.2126 * paper[0] + 0.7152 * paper[1] + 0.0722 * paper[2]
    en_color = (246, 236, 211, 255) if paper_luminance < 128 else (18, 16, 22, 255)
    ko_color = (255, 247, 222, 255) if paper_luminance < 128 else (*accent, 255)
    draw.text((63, 38), title_en, font=en_font, fill=en_color, stroke_width=1)
    draw.text((64, 86), title_ko, font=ko_font, fill=ko_color)


def make_poster(shot_id: str, beat: dict, shot: dict, index: int) -> Path:
    bg, accent, paper, signal = PALETTES[(int(shot_id[0]) - 1) % len(PALETTES)]
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (*bg, 255))
    add_paper_texture(canvas, 100 + index)
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.polygon([(0, 420), (WIDTH, 320), (WIDTH, 540), (0, 540)], fill=(*accent, 74))
    draw.polygon([(740, 0), (WIDTH, 0), (WIDTH, 250), (860, 210)], fill=(*signal, 58))
    draw.line((18, 146, 942, 146), fill=(*paper, 90), width=2)

    source_names = SHOT_ASSETS[shot_id]
    sources = [SOURCE_MAP.get(name, SOURCE_FRAMES / f"{name}.png") for name in source_names]
    if shot_id in {"1a", "2a", "3a"}:
        boxes = [(52, 169, 342, 388), (365, 151, 657, 379), (684, 181, 910, 399)]
    elif shot_id == "4a":
        boxes = [(45, 162, 620, 424), (637, 185, 914, 394), (728, 303, 898, 462)]
    elif shot_id == "4b":
        boxes = [(48, 148, 912, 432), (690, 285, 906, 451), (58, 326, 301, 452)]
    else:
        boxes = [(49, 158, 500, 415), (525, 178, 907, 410), (680, 314, 899, 458)]
    for n, (source, box) in enumerate(zip(sources, boxes)):
        paste_card(canvas, source, box, 500 + index * 9 + n, accent if n != 2 else signal)

    if shot["title"]:
        draw_banner(canvas, beat["title_en"], beat["title_ko"], accent, paper)
    elif shot_id == "4b":
        draw_banner(canvas, "FROM ASSET TO ABYSS", "에셋에서 심연으로", accent, paper)
    else:
        label_font = fit_font(draw, STEP_LABELS[shot_id], 790, 25)
        draw.rounded_rectangle((44, 41, 874, 105), radius=4, fill=(*paper, 242))
        draw.text((62, 58), STEP_LABELS[shot_id], font=label_font, fill=(20, 17, 24, 255))

    small = font(15)
    draw.rectangle((0, 500, WIDTH, HEIGHT), fill=(7, 7, 11, 218))
    draw.text((30, 511), "ABYSSAL SURGE  /  RESOURCE REFINEMENT", font=small, fill=(*paper, 235))
    draw.text((800, 511), f"B{shot_id[0]} · {shot_id[1].upper()}", font=small, fill=(*signal, 255))
    draw.ellipse((898, 42, 936, 80), fill=(*signal, 240), outline=(*paper, 220), width=2)
    draw.text((909, 50), shot_id[0], font=font(17), fill=(20, 16, 22, 255))
    output = POSTERS / f"shot-{shot_id}.png"
    canvas.convert("RGB").save(output, quality=95)
    return output


def extract_source_frames() -> None:
    cinematic = REPO / "assets/video/abyssal-surge-cinematic.mp4"
    for second, name in [(2, "cinematic-02"), (10, "cinematic-10"), (16, "cinematic-16")]:
        target = SOURCE_FRAMES / f"{name}.png"
        run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(second), "-i", str(cinematic), "-frames:v", "1", str(target)])


def zoom_filter(move: str) -> str:
    common = f":d={int(SHOT_SECONDS * FPS)}:s={WIDTH}x{HEIGHT}:fps={FPS}"
    if move == "push_in":
        core = "z='min(zoom+0.0015,1.105)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    elif move == "pull_out":
        core = "z='if(eq(on,0),1.105,max(1.0,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    elif move == "pan":
        core = "z=1.08:x='(iw-iw/zoom)*on/71':y='ih/2-(ih/zoom/2)'"
    elif move == "tilt":
        core = "z=1.08:x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*on/71'"
    elif move == "parallax":
        core = "z='min(zoom+0.0008,1.06)':x='(iw-iw/zoom)*on/71':y='(ih-ih/zoom)*(71-on)/71'"
    elif move == "element":
        core = "z=1.02:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    else:
        core = "z=1.0:x=0:y=0"
    return f"zoompan={core}{common},format=yuv420p"


def make_clip(poster: Path, shot_id: str, move: str) -> Path:
    clip = CLIPS / f"shot-{shot_id}.mp4"
    run([
        "ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", str(poster),
        "-vf", zoom_filter(move), "-frames:v", str(int(SHOT_SECONDS * FPS)),
        "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-an", str(clip),
    ])
    return clip


def assemble_video(clips: list[Path]) -> tuple[Path, float]:
    assembled = LOCAL / "assembled-silent.mp4"
    command = ["ffmpeg", "-y", "-loglevel", "error"]
    for clip in clips:
        command.extend(["-i", str(clip)])
    transitions = ["fade", "slideleft", "wipeup", "fadeblack", "slideright", "wipedown", "fade"]
    chains: list[str] = []
    previous = "0:v"
    for i in range(1, len(clips)):
        out = f"v{i}"
        offset = i * (SHOT_SECONDS - XFADE_SECONDS)
        chains.append(
            f"[{previous}][{i}:v]xfade=transition={transitions[i - 1]}:duration={XFADE_SECONDS}:offset={offset:.3f}[{out}]"
        )
        previous = out
    duration = len(clips) * SHOT_SECONDS - (len(clips) - 1) * XFADE_SECONDS
    command.extend([
        "-filter_complex", ";".join(chains), "-map", f"[{previous}]", "-an",
        "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", str(assembled),
    ])
    run(command)
    return assembled, duration


def add_audio(assembled: Path, duration: float, narration: str) -> None:
    narration_file = LOCAL / "narration.aiff"
    run(["say", "-r", "170", "-o", str(narration_file), narration])
    probe = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(narration_file)
    ], check=True, capture_output=True, text=True)
    narration_duration = float(probe.stdout.strip())
    tempo = max(0.5, min(2.0, narration_duration / max(1.0, duration - 0.4)))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(assembled), "-i", str(narration_file),
        "-f", "lavfi", "-i", f"sine=frequency=55:duration={duration:.3f}:sample_rate=48000",
        "-f", "lavfi", "-i", f"sine=frequency=82.41:duration={duration:.3f}:sample_rate=48000",
        "-filter_complex",
        f"[1:a]atempo={tempo:.6f},volume=1.12,apad,atrim=0:{duration:.3f}[voice];"
        f"[2:a]volume=0.020[drone1];[3:a]volume=0.012[drone2];"
        "[voice][drone1][drone2]amix=inputs=3:duration=first:normalize=0[a]",
        "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
        "-ar", "48000", "-t", f"{duration:.3f}", "-movflags", "+faststart", str(OUTPUT),
    ])


def extract_samples() -> None:
    sample_times = [1.5, 7.0, 12.5, 20.5]
    for index, second in enumerate(sample_times, start=1):
        run([
            "ffmpeg", "-y", "-loglevel", "error", "-ss", str(second), "-i", str(OUTPUT),
            "-vf", "scale=640:-1,format=yuvj420p", "-frames:v", "1",
            str(SAMPLES / f"sample-{index:02d}-{second:04.1f}s.jpg"),
        ])


def verify() -> None:
    probe = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,format_name,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels",
        "-of", "json", str(OUTPUT),
    ], check=True, capture_output=True, text=True)
    data = json.loads(probe.stdout)
    blob = OUTPUT.read_bytes()
    moov = blob.find(b"moov")
    mdat = blob.find(b"mdat")
    verification = {
        "ffprobe": data,
        "faststart_atom_check": {
            "moov_offset": moov,
            "mdat_offset": mdat,
            "moov_precedes_mdat": 0 <= moov < mdat,
        },
        "frame_samples": sorted(str(path.relative_to(REPO)) for path in SAMPLES.glob("*.jpg")),
    }
    (HERE / "verification.json").write_text(json.dumps(verification, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    for directory in (LOCAL, POSTERS, CLIPS, SOURCE_FRAMES, SAMPLES):
        directory.mkdir(parents=True, exist_ok=True)
    for directory in (POSTERS, CLIPS, SOURCE_FRAMES, SAMPLES):
        for path in directory.iterdir():
            if path.is_file():
                path.unlink()
    beats = json.loads(BEATS_PATH.read_text(encoding="utf-8"))
    extract_source_frames()
    clips: list[Path] = []
    index = 0
    for beat in beats["beats"]:
        for shot in beat["shots"]:
            shot_id = f"{beat['id']}{shot['id']}"
            poster = make_poster(shot_id, beat, shot, index)
            clips.append(make_clip(poster, shot_id, shot["camera_move"]))
            index += 1
    assembled, duration = assemble_video(clips)
    narration = " ".join(beat["narration"] for beat in beats["beats"])
    add_audio(assembled, duration, narration)
    extract_samples()
    verify()
    print(OUTPUT.relative_to(REPO))


if __name__ == "__main__":
    main()
