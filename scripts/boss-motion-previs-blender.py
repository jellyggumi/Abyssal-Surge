#!/usr/bin/env python3
"""
Blender motion-previs bootstrap for boss concept timing sheets.

Usage (outside Blender, dry-run for JSON derivation):
  python scripts/boss-motion-previs-blender.py --     --blend /path/to/abyssal-command-resource-pack.blend     --timeline _workspace/20260723-solo-warden-rpg-concept/production/boss-motion-previs-timing.json     --outdir _workspace/20260723-solo-warden-rpg-concept/production/     --fps 60

Usage (Blender runtime):
  blender --background --python scripts/boss-motion-previs-blender.py --     --blend ... --timeline ... --outdir ... --fps 60
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path


def _extract_script_args(argv=None):
    if argv is None:
        import sys
        argv = sys.argv[1:]
    if argv is None:
        return []
    if "--" in argv:
        return argv[argv.index("--") + 1 :]
    return argv


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Boss motion previs Blender bootstrap"
    )
    p.add_argument("--blend", required=True, help="Input .blend file path")
    p.add_argument("--timeline", required=True, help="Motion timing JSON path")
    p.add_argument("--outdir", required=True, help="Output directory")
    p.add_argument("--fps", type=int, default=60)
    p.add_argument("--make-proxies", action="store_true", default=False)
    p.add_argument("--no-make-proxies", action="store_true", default=False)
    p.add_argument("--dry-run", action="store_true", default=False, help="Emit timing artifacts without bpy")
    parsed = p.parse_args(_extract_script_args(argv))
    if parsed.make_proxies and parsed.no_make_proxies:
        p.error("--make-proxies and --no-make-proxies cannot both be set")
    return parsed


def _clamp_int(value, default):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _load_timeline(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    data.setdefault("schemaVersion", 2)
    data.setdefault("pipeline", "motion-previs-v2")
    data.setdefault("bossTimings", data.get("bosses", []))
    return data


def _flatten_actions_from_boss(boss):
    # New pipeline format: flat actions list with action/variant entries.
    actions = boss.get("actions") or []
    if actions:
        return actions

    # Back-compat fallback: derive one action-like segment per stage so legacy files still run.
    legacy_actions = []
    for idx, stage in enumerate(boss.get("stages", []), start=1):
        label = stage.get("label", f"legacy-stage-{idx}")
        legacy_actions.append(
            {
                "action": str(label),
                "variant": "v01",
                "startFrame": stage.get("startFrame", 1),
                "endFrame": stage.get("endFrame", max(1, stage.get("startFrame", 1))),
                "loop": True,
                "keyPoses": [
                    {
                        "timePct": 33.33,
                        "poseLabel": stage.get("keyPose", "anticipation"),
                        "speedHint": "legacy",
                    }
                ],
                "sourceImage": boss.get("source"),
                "sourceImageIndex": 0,
                "signaturePoses": [
                    stage.get("keyPose", "")
                ],
            }
        )
    return legacy_actions


def _build_markers(boss):
    markers = []
    clip_markers = []
    source = boss.get("source")
    # For stage-based legacy compatibility keep the same 5 stage markers.
    for idx, stage in enumerate(boss.get("stages", []), start=1):
        label = stage.get("label", f"stage-{idx}")
        s = _clamp_int(stage.get("startFrame", 1), 1)
        e = _clamp_int(stage.get("endFrame", 1), max(1, s))
        markers.append(
            {
                "label": label,
                "startFrame": s,
                "endFrame": e,
                "keyPose": stage.get("keyPose"),
            }
        )

    for action in _flatten_actions_from_boss(boss):
        action_name = action.get("action", "")
        variant = action.get("variant", "v01")
        start = _clamp_int(action.get("startFrame", 1), 1)
        end = _clamp_int(action.get("endFrame", 1), max(1, start))
        action_id = f"{action_name}::{variant}"
        clip_markers.append(
            {
                "marker": f"action::{action_id}::start",
                "frame": start,
                "sourceImage": action.get("sourceImage", source),
                "action": action_name,
                "variant": variant,
            }
        )
        clip_markers.append(
            {
                "marker": f"action::{action_id}::end",
                "frame": end,
                "sourceImage": action.get("sourceImage", source),
                "action": action_name,
                "variant": variant,
            }
        )
    return markers, clip_markers


def _build_sidecar_for_boss(boss, rig_name, scene_frame_end, fps, proxy_created, source_timeline):
    source_images = boss.get("sourceImages")
    if not isinstance(source_images, list) or not source_images:
        source_images = [boss.get("source")]
    markers, clip_markers = _build_markers(boss)

    actions_payload = []
    for action in _flatten_actions_from_boss(boss):
        source_image = action.get("sourceImage")
        if source_image is None and source_images:
            source_image = source_images[0]

        actions_payload.append(
            {
                "action": action.get("action"),
                "variant": action.get("variant"),
                "sourceImage": source_image,
                "startFrame": _clamp_int(action.get("startFrame", 1), 1),
                "endFrame": _clamp_int(action.get("endFrame", 1), 1),
                "loop": bool(action.get("loop", False)),
                "durationFrames": max(1, _clamp_int(action.get("endFrame", 1), 1) - _clamp_int(action.get("startFrame", 1), 1) + 1),
                "keyPoses": action.get("keyPoses", []),
                "sourceImageIndex": action.get("sourceImageIndex", 0),
                "signaturePoses": action.get("signaturePoses", []),
                "transition": action.get("transition", {}),
                "sourceFrameRate": action.get("sourceFrameRate", fps),
                "runtimeFps": action.get("runtimeFps", max(1, fps // 2)),
            }
        )

    return {
        "bossId": boss.get("id"),
        "bossName": boss.get("name", boss.get("id")),
        "source": boss.get("source"),
        "sourceImages": source_images,
        "durationFrames": int(_clamp_int(boss.get("durationFrames", scene_frame_end), max(1, scene_frame_end)),),
        "fps": fps,
        "schemaVersion": 2,
        "pipeline": "motion-previs-v2",
        "markers": markers,
        "actions": actions_payload,
        "clipMarkers": clip_markers,
        "sourceTimeline": str(source_timeline),
        "proxyCreated": proxy_created,
    }


def _derive_runtime_action_pose_data(action):
    # tiny deterministic pose drift to keep preview readable in generated rigless output
    action_name = str(action.get("action", "action"))
    source_key = hash(action_name) % 32
    return 0.02 * (source_key % 10), 0.01 * ((source_key // 10) % 10)


def _write_outputs(data, outdir, out_blend, blend_path, fps):
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    source_timeline = data.get("source", Path())
    if not isinstance(source_timeline, Path):
        source_timeline = Path(source_timeline) if source_timeline else Path()

    per_boss_timings = [
        _build_sidecar_for_boss(
            boss,
            boss.get("id"),
            max(1, int(boss.get("durationFrames", 120))),
            fps,
            False,
            source_timeline,
        )
        for boss in data.get("bosses", [])
    ]

    exported_timing_path = outdir / "boss_previs_timings.json"
    exported_timing = {
        "schemaVersion": 2,
        "pipeline": "motion-previs-v2",
        "sourceTimeline": str(data.get("__sourceTimeline", "")),
        "renderFps": int(fps),
        "baseFile": str(blend_path) if blend_path else None,
        "bossTimings": per_boss_timings,
    }
    exported_timing_path.write_text(
        json.dumps(exported_timing, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return {
        "timing_out": str(exported_timing_path),
        "bossTimings": per_boss_timings,
        "bossCount": len(per_boss_timings),
    }


def run_in_blender(blend_path, timeline_path, outdir, fps, make_proxies=True):
    import bpy
    from math import radians

    bpy.ops.wm.open_mainfile(filepath=str(blend_path))
    timeline = _load_timeline(Path(timeline_path))
    timeline["__sourceTimeline"] = str(timeline_path)

    scene = bpy.context.scene
    scene.render.fps = int(fps)
    scene.render.fps_base = 1.0

    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    per_boss_timings = []

    if not scene.camera:
        cam_data = bpy.data.cameras.new("PrevisCamera")
        cam = bpy.data.objects.new("PrevisCamera", cam_data)
        scene.collection.objects.link(cam)
        scene.camera = cam
    scene.render.engine = "BLENDER_EEVEE"
    scene.use_nodes = False

    def ensure_proxy_object(name):
        existing = bpy.data.objects.get(name)
        if existing is not None:
            return existing
        mesh = bpy.data.meshes.new(f"{name}_mesh")
        obj = bpy.data.objects.new(name, mesh)
        scene.collection.objects.link(obj)
        return obj

    for boss in timeline.get("bosses", []):
        boss_id = boss.get("id", "boss")
        boss_name = boss.get("name", boss_id)
        duration = int(_clamp_int(boss.get("durationFrames", 180), 180))

        rig = bpy.data.objects.get(boss_id)
        proxy_name = f"{boss_id}_proxy"
        if rig is None and make_proxies:
            rig = ensure_proxy_object(proxy_name)
        if rig is None:
            raise RuntimeError(f"Rig not found and proxies disabled: {boss_id}")

        action_obj = bpy.data.actions.get(f"{boss_id}_previs")
        if action_obj is None:
            action_obj = bpy.data.actions.new(name=f"{boss_id}_previs")

        rig.animation_data_create()
        rig.animation_data.action = action_obj

        # Keep simple deterministic keyframing from legacy stage blocks for quick visibility.
        for i, stage in enumerate(boss.get("stages", []), start=1):
            s = _clamp_int(stage.get("startFrame", 1), 1)
            e = _clamp_int(stage.get("endFrame", 1), max(1, s))
            loc_x = float(i) * 0.35
            rot_y = radians((i - 1) * 4)
            rig.location = (loc_x, 0.0, 0.0)
            rig.rotation_euler[1] = rot_y
            rig.keyframe_insert(data_path="location", frame=s)
            rig.keyframe_insert(data_path="rotation_euler", frame=s)
            rig.location = (loc_x + 0.05, 0.0, 0.0)
            rig.rotation_euler[1] = rot_y + radians(1.8)
            rig.keyframe_insert(data_path="location", frame=e)
            rig.keyframe_insert(data_path="rotation_euler", frame=e)

            # add one action-like marker per legacy block and keep in sidecar
            
        scene.frame_start = 1
        scene.frame_end = max(1, duration)

        for marker_def in _build_markers(boss)[0]:
            label = marker_def["label"]
            scene.timeline_markers.new(f"{boss_id}:{label}", frame=marker_def["startFrame"])
            scene.timeline_markers.new(f"{boss_id}:{label}-end", frame=marker_def["endFrame"])

        sidecar = _build_sidecar_for_boss(
            boss,
            boss_id,
            duration,
            fps,
            rig.name == proxy_name,
            timeline_path,
        )
        sidecar_path = outdir / f"{boss_id}.previs.json"
        sidecar_path.write_text(json.dumps(sidecar, ensure_ascii=False, indent=2), encoding="utf-8")
        per_boss_timings.append(sidecar)

    out_blend = outdir / "boss_previs_workfile.blend"
    bpy.ops.wm.save_mainfile(filepath=str(out_blend))

    exported = _write_outputs(timeline, outdir, out_blend, blend_path, fps)

    return {
        "status": "completed",
        "blend_out": str(out_blend),
        "timing_out": exported["timing_out"],
        "timeline": str(timeline_path),
        "fps": fps,
        "bosses": [b.get("id") for b in timeline.get("bosses", [])],
        "bossCount": exported["bossCount"],
    }


def run_dry_run(blend_path, timeline_path, outdir, fps):
    timeline = _load_timeline(Path(timeline_path))
    timeline["__sourceTimeline"] = str(timeline_path)

    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    per_boss_timings = []
    for boss in timeline.get("bosses", []):
        sidecar = _build_sidecar_for_boss(
            boss,
            boss.get("id"),
            max(1, _clamp_int(boss.get("durationFrames", 180), 180)),
            fps,
            False,
            Path(timeline_path),
        )
        sidecar_path = outdir / f"{boss.get('id')}.previs.json"
        sidecar_path.write_text(json.dumps(sidecar, ensure_ascii=False, indent=2), encoding="utf-8")
        per_boss_timings.append(sidecar)

    exported = _write_outputs(timeline, outdir, Path(blend_path), Path(blend_path), fps)

    return {
        "status": "dry-run-complete",
        "timing_out": exported["timing_out"],
        "timing": str(timeline_path),
        "fps": fps,
        "bosses": [b.get("id") for b in timeline.get("bosses", [])],
        "bossCount": exported["bossCount"],
        "timings": per_boss_timings,
    }


def main(argv=None):
    args = parse_args(argv)
    blend_path = Path(args.blend)
    timeline_path = Path(args.timeline)
    outdir = Path(args.outdir)
    should_make_proxies = True if args.make_proxies else not args.no_make_proxies

    if args.dry_run:
        result = run_dry_run(blend_path, timeline_path, outdir, args.fps)
        out_log = outdir / "boss-motion-previs-blender-run.json"
        out_log.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False))
        return

    # allow syntax check outside Blender
    try:
        import bpy  # noqa: F401
        result = run_in_blender(blend_path, timeline_path, outdir, args.fps, should_make_proxies)
        out_log = outdir / "boss-motion-previs-blender-run.json"
        out_log.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        # Non-Blender runtime path: emit how-to-only payload.
        fallback = {
            "status": "requires_blender_runtime",
            "error": str(e),
            "blend": str(blend_path),
            "timeline": str(timeline_path),
            "outdir": str(outdir),
            "command": "blender --background --python scripts/boss-motion-previs-blender.py -- --blend ... --timeline ... --outdir ...",
        }
        out_log = outdir / "boss-motion-previs-blender-run.json"
        out_log.write_text(json.dumps(fallback, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(fallback, ensure_ascii=False))


if __name__ == "__main__":
    main()
