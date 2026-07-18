"""Blender headless render helpers for Canvas 2D battle art.

Default mode preserves the original one-model 8-direction scene renderer:

    Blender --background <file.blend> --python scripts/render-8dir-atlas.py -- \
        --out /abs/dir --size 256

Pack mode imports each existing Abyssal Command GLB in isolation and converts it
to Canvas-ready transparent PNGs. Action atlases have eight yaw columns and four
source-frame rows (1, 10, 20, 30); terrain gets one static plate. Framing uses
the evaluated clip silhouette with a stable transparent safety margin:

    Blender --background --python scripts/render-8dir-atlas.py -- \
        --pack --project-root /abs/Abyssal-Surge --size 128 \
        --skip-media-manifest
"""

import argparse
import array
import hashlib
import json
import math
import os
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector


GENERATION_VERSION = "glb-raster-pack-v1"
FRAME_SAMPLES = (1, 10, 20, 30)
YAW_DEGREES = tuple(range(0, 360, 45))
CELL_PADDING_FRACTION = 0.1
ALPHA_THRESHOLD = 1.0 / 255.0


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="/tmp/atlas")
    parser.add_argument("--size", type=int, default=256)
    parser.add_argument("--pack", action="store_true")
    parser.add_argument(
        "--asset-id",
        action="append",
        default=[],
        help="Render one declared asset per invocation; repeatable for bounded chunks.",
    )
    parser.add_argument(
        "--publish",
        action="store_true",
        help="Atomically publish the final manifest/media inventory from completed chunks.",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify the published bridge manifest, source/output hashes, dimensions, directions, and actions.",
    )
    parser.add_argument(
        "--skip-media-manifest",
        action="store_true",
        help="Publish bridge PNG/manifest only; use when another lane owns assets/media-manifest.json.",
    )
    parser.add_argument(
        "--project-root",
        default=str(Path(__file__).resolve().parents[1]),
        help="Repository root; defaults to the parent of scripts/.",
    )
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def configure_render(scene, size):
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 16
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.045, 0.05, 0.07)


def look_at(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat(
        "-Z", "Y"
    ).to_euler()


def add_deterministic_lights(scene, target, scale):
    """Use explicit lights so embedded PBR textures read under transparent film."""
    target = Vector(target)
    distance = max(scale * 2.5, 4.0)
    lights = (
        ("atlas_key", "AREA", (distance, -distance, distance * 1.5), 1100.0, 5.0),
        ("atlas_fill", "AREA", (-distance, -distance * 0.25, distance), 450.0, 4.0),
        ("atlas_rim", "AREA", (0.0, distance, distance * 1.2), 800.0, 3.0),
        ("atlas_sun", "SUN", (distance, -distance, distance * 2.0), 8.0, None),
    )
    for name, light_type, offset, energy, size in lights:
        data = bpy.data.lights.new(name, light_type)
        data.energy = energy
        if light_type == "AREA":
            data.shape = "DISK"
            data.size = size
        light = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(light)
        light.location = target + Vector(offset)
        look_at(light, target)


def fresh_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.materials, bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
        for item in tuple(block):
            if item.users == 0:
                block.remove(item)


def import_glb(path):
    fresh_scene()
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = tuple(bpy.context.scene.objects)
    if not imported:
        raise RuntimeError(f"GLB import produced no objects: {path}")
    return imported


def find_root(asset_id, imported):
    expected = f"{asset_id}-root"
    root = bpy.data.objects.get(expected)
    if root is None or root not in imported:
        available = ", ".join(sorted(obj.name for obj in imported if obj.parent is None))
        raise RuntimeError(f"Expected root {expected!r}; top-level objects: {available}")
    return root


def find_declared_action(action_name):
    action = bpy.data.actions.get(action_name)
    if action is None:
        available = ", ".join(sorted(action.name for action in bpy.data.actions))
        raise RuntimeError(f"Expected imported action {action_name!r}; actions: {available}")
    return action


def select_clip(imported, root, action_name):
    """Activate the imported NLA export for every animated object.

    Blender's glTF importer may expose a clip as an NLA track or directly as an
    action depending on which channels the GLB contains.  Prefer the named track,
    while assigning the declared action to the named asset root as the reliable
    fallback for root-only clips.
    """
    action = find_declared_action(action_name)
    matching_track = False
    for obj in imported:
        animation = obj.animation_data
        if animation is None:
            continue
        for track in animation.nla_tracks:
            track.mute = True
            if track.name == action_name or any(
                strip.action and strip.action.name == action_name for strip in track.strips
            ):
                track.mute = False
                matching_track = True
        if animation.action is not None:
            animation.action = None
    if not matching_track:
        root.animation_data_create()
        root.animation_data.action = action
    return action


def mesh_bounds(imported, root):
    """Return conservative local bounds, excluding animated root translation."""
    dependency_graph = bpy.context.evaluated_depsgraph_get()
    root_position = root.matrix_world.translation.copy()
    points = []
    for obj in imported:
        if obj.type != "MESH" or obj.hide_render:
            continue
        evaluated = obj.evaluated_get(dependency_graph)
        for corner in evaluated.bound_box:
            points.append(evaluated.matrix_world @ Vector(corner) - root_position)
    if not points:
        raise RuntimeError(f"No visible meshes found for {root.name}")
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


def framing_for_clip(imported, root, frames):
    """Fit every sampled silhouette and center it without losing the ground pivot.

    The eight pooled yaw views make horizontal centering stable. A fixed target
    height derived from the pooled vertical bounds keeps action frames from
    bobbing while placing the visible silhouette inside a 10% transparent moat.
    """
    minimum_x = float("inf")
    maximum_x = float("-inf")
    minimum_y = float("inf")
    maximum_y = float("-inf")
    elevation = math.radians(30.0)
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        low, high = mesh_bounds(imported, root)
        corners = tuple(
            Vector((x, y, z))
            for x in (low.x, high.x)
            for y in (low.y, high.y)
            for z in (low.z, high.z)
        )
        for yaw_degrees in YAW_DEGREES:
            yaw = math.radians(yaw_degrees)
            view = Vector(
                (-math.sin(yaw) * math.cos(elevation), math.cos(yaw) * math.cos(elevation), -math.sin(elevation))
            )
            right = view.cross(Vector((0.0, 0.0, 1.0))).normalized()
            up = right.cross(view).normalized()
            for corner in corners:
                projected_x = corner.dot(right)
                projected_y = corner.dot(up)
                minimum_x = min(minimum_x, projected_x)
                maximum_x = max(maximum_x, projected_x)
                minimum_y = min(minimum_y, projected_y)
                maximum_y = max(maximum_y, projected_y)
    width = maximum_x - minimum_x
    height = maximum_y - minimum_y
    scale = max(width, height, 1.0) / (1.0 - 2.0 * CELL_PADDING_FRACTION)
    target_height = ((minimum_y + maximum_y) * 0.5) / math.cos(elevation)
    return {
        "orthoScale": scale,
        "targetHeight": target_height,
        "projectedBounds": {
            "minX": minimum_x,
            "maxX": maximum_x,
            "minY": minimum_y,
            "maxY": maximum_y,
        },
    }


def render_pixels(scene, camera, root, yaw_degrees, frame, size, distance, target_height, sample_path):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    root_position = root.matrix_world.translation.copy()
    target = root_position + Vector((0.0, 0.0, target_height))
    yaw = math.radians(yaw_degrees)
    elevation = math.radians(30.0)
    horizontal = distance * math.cos(elevation)
    camera.location = target + Vector(
        (math.sin(yaw) * horizontal, -math.cos(yaw) * horizontal, distance * math.sin(elevation))
    )
    look_at(camera, target)
    scene.render.filepath = str(sample_path)
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(str(sample_path), check_existing=False)
    try:
        if tuple(image.size) != (size, size):
            raise RuntimeError(f"Unexpected render size {tuple(image.size)} for {sample_path}")
        pixels = array.array("f", [0.0]) * (size * size * 4)
        image.pixels.foreach_get(pixels)
        return pixels
    finally:
        bpy.data.images.remove(image, do_unlink=True)
        sample_path.unlink(missing_ok=True)


def alpha_diagnostics(pixels, size):
    minimum_x = size
    minimum_y = size
    maximum_x = -1
    maximum_y = -1
    opaque = 0
    for y in range(size):
        for x in range(size):
            if pixels[(y * size + x) * 4 + 3] <= ALPHA_THRESHOLD:
                continue
            opaque += 1
            minimum_x = min(minimum_x, x)
            minimum_y = min(minimum_y, y)
            maximum_x = max(maximum_x, x)
            maximum_y = max(maximum_y, y)
    if opaque == 0:
        raise RuntimeError("Rendered atlas cell is fully transparent")
    edge_padding = min(minimum_x, minimum_y, size - 1 - maximum_x, size - 1 - maximum_y)
    if edge_padding < 1:
        raise RuntimeError(
            f"Rendered atlas cell touches its boundary: bounds "
            f"{minimum_x},{minimum_y}..{maximum_x},{maximum_y} in {size}px"
        )
    return {
        "bounds": [minimum_x, minimum_y, maximum_x, maximum_y],
        "edgePaddingPx": edge_padding,
        "coverageRatio": opaque / (size * size),
        "signature": hashlib.sha256(pixels.tobytes()).hexdigest(),
    }


def pack_atlas(scene, camera, root, samples, size, output_path, is_terrain, framing):
    columns = 1 if is_terrain else len(YAW_DEGREES)
    rows = 1 if is_terrain else len(samples)
    width, height = size * columns, size * rows
    packed = array.array("f", [0.0]) * (width * height * 4)
    source_frames = (1,) if is_terrain else samples
    source_yaws = (0,) if is_terrain else YAW_DEGREES
    distance = camera.data.ortho_scale * 2.5
    sample_path = output_path.with_name(f".{output_path.stem}.sample.png")
    cell_metrics = []
    for row, frame in enumerate(source_frames):
        for column, yaw in enumerate(source_yaws):
            pixels = render_pixels(
                scene, camera, root, yaw, frame, size, distance, framing["targetHeight"], sample_path
            )
            metrics = alpha_diagnostics(pixels, size)
            metrics.update({"row": row, "column": column, "frame": frame, "yawDegrees": yaw})
            cell_metrics.append(metrics)
            # Blender pixel arrays are bottom-up; row 0 is the top atlas row.
            destination_y = (rows - row - 1) * size
            for pixel_row in range(size):
                source_start = pixel_row * size * 4
                destination_start = ((destination_y + pixel_row) * width + column * size) * 4
                packed[destination_start:destination_start + size * 4] = pixels[source_start:source_start + size * 4]
    image = bpy.data.images.new(f"atlas_{output_path.stem}", width=width, height=height, alpha=True)
    image.pixels.foreach_set(packed)
    image.filepath_raw = str(output_path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)
    signatures_by_column = [
        {metric["signature"] for metric in cell_metrics if metric["column"] == column}
        for column in range(columns)
    ]
    diagnostics = {
        "nonEmptyCells": len(cell_metrics),
        "minimumEdgePaddingPx": min(metric["edgePaddingPx"] for metric in cell_metrics),
        "maximumCoverageRatio": round(max(metric["coverageRatio"] for metric in cell_metrics), 6),
        "distinctDirectionColumns": len(
            {metric["signature"] for metric in cell_metrics if metric["row"] == 0}
        ),
        "animatedDirectionColumns": sum(len(signatures) > 1 for signatures in signatures_by_column),
    }
    return width, height, diagnostics


def camera_metadata(framing):
    return {
        "projection": "orthographic",
        "elevationDegrees": 30,
        "yawColumnsDegrees": list(YAW_DEGREES),
        "rootTracking": "camera target follows evaluated <asset-id>-root translation plus fixed clip targetHeight",
        "orthoScale": round(framing["orthoScale"], 6),
        "targetHeight": round(framing["targetHeight"], 6),
        "cellPaddingFraction": CELL_PADDING_FRACTION,
    }


def output_record(
    asset,
    source_path,
    source_hash,
    staged_path,
    output_path,
    width,
    height,
    diagnostics,
    clip=None,
):
    root = f"{asset['id']}-root"
    record = {
        "assetId": asset["id"],
        "category": asset["category"],
        "kind": "terrainPlate" if clip is None else "actionAtlas",
        "source": {
            "path": source_path,
            "sha256": source_hash,
            "root": root,
        },
        "output": {
            "path": output_path,
            "sha256": sha256(staged_path),
            "bytes": os.path.getsize(staged_path),
            "width": width,
            "height": height,
            "mimeType": "image/png",
        },
        "visualValidation": diagnostics,
        "_stagedPath": str(staged_path),
    }
    if clip is None:
        record["frameSamples"] = [1]
        record["layout"] = {"columns": 1, "rows": 1, "cellWidth": width, "cellHeight": height}
        record["camera"] = {
            "projection": "orthographic",
            "elevationDegrees": 30,
            "yawColumnsDegrees": [0],
            "rootTracking": "static terrain root at source frame 1",
            "cellPaddingFraction": CELL_PADDING_FRACTION,
        }
    else:
        record["clip"] = clip
        record["action"] = f"{asset['id']}__{clip}"
        record["frameSamples"] = list(FRAME_SAMPLES)
        record["layout"] = {"columns": 8, "rows": len(FRAME_SAMPLES), "cellWidth": width // 8, "cellHeight": height // len(FRAME_SAMPLES)}
    return record


def sync_media_manifest(project_root, records):
    path = project_root / "assets/media-manifest.json"
    payload = json.loads(path.read_text())
    assets = payload["assets"]
    generated_prefix = "assets/images/battle/glb/"
    assets[:] = [entry for entry in assets if not entry["filename"].startswith(generated_prefix)]
    for record in records:
        source = record["source"]["path"]
        output = record["output"]
        description = (
            f"Canvas 2D raster derived by importing {source} with its embedded GLB "
            f"materials/textures and rendering static terrain at frame 1."
            if record["kind"] == "terrainPlate"
            else f"Canvas 2D {record['clip']} atlas derived by importing {source} with its "
            f"embedded GLB materials/textures; 8 yaw columns × {len(record['frameSamples'])} "
            f"source frame(s) {record['frameSamples']}, with camera target tracking "
            f"{record['source']['root']} translation."
        )
        assets.append(
            {
                "filename": output["path"],
                "media_type": "image/png",
                "bytes": output["bytes"],
                "generated_by": f"scripts/render-8dir-atlas.py ({GENERATION_VERSION}; Blender {bpy.app.version_string})",
                "source_key_art": [],
                "source_assets": [source],
                "derivation": description,
                "sha256": output["sha256"],
            }
        )
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, indent=2) + "\n")
    temporary.replace(path)

def write_chunk_records(output_dir, asset_id, records):
    parts_dir = output_dir / ".parts"
    parts_dir.mkdir(exist_ok=True)
    temporary = parts_dir / f"{asset_id}.json.tmp"
    final = parts_dir / f"{asset_id}.json"
    temporary.write_text(json.dumps(records, indent=2) + "\n")
    temporary.replace(final)


def completed_records(project_root, model_manifest, output_dir):
    records = []
    expected_asset_ids = {asset["id"] for asset in model_manifest["assets"]}
    for part in sorted((output_dir / ".parts").glob("*.json")):
        part_records = json.loads(part.read_text())
        if not part_records or any(record["assetId"] != part.stem for record in part_records):
            raise RuntimeError(f"Malformed chunk record file: {part}")
        records.extend(part_records)
    actual_asset_ids = {record["assetId"] for record in records}
    if actual_asset_ids != expected_asset_ids:
        raise RuntimeError(f"Chunk coverage mismatch: expected {sorted(expected_asset_ids)}, got {sorted(actual_asset_ids)}")
    expected_actions = {
        (asset["id"], clip)
        for asset in model_manifest["assets"]
        for clip in asset["actionClips"]
    }
    actual_actions = {
        (record["assetId"], record["clip"])
        for record in records
        if record["kind"] == "actionAtlas"
    }
    terrains = {asset["id"] for asset in model_manifest["assets"] if asset["category"] == "terrain"}
    actual_terrains = {record["assetId"] for record in records if record["kind"] == "terrainPlate"}
    if actual_actions != expected_actions or actual_terrains != terrains:
        raise RuntimeError(
            f"Chunk record coverage mismatch: actions {len(actual_actions)}/{len(expected_actions)}, "
            f"terrain {len(actual_terrains)}/{len(terrains)}"
        )
    for record in records:
        staged = Path(record.get("_stagedPath", ""))
        output = project_root / record["output"]["path"]
        source = project_root / record["source"]["path"]
        candidate = staged if staged.is_file() else output
        if not candidate.is_file() or not source.is_file():
            raise RuntimeError(f"Missing staged/published source artifact for {record['assetId']}")
        if sha256(candidate) != record["output"]["sha256"] or sha256(source) != record["source"]["sha256"]:
            raise RuntimeError(f"Hash mismatch in chunk record for {record['assetId']}")
    return sorted(records, key=lambda record: (record["assetId"], record["kind"], record.get("clip", "")))
def png_dimensions(path):
    with open(path, "rb") as source:
        header = source.read(24)
    if header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise RuntimeError(f"Invalid PNG header: {path}")
    return struct.unpack(">II", header[16:24])


def verify_pack(project_root):
    model_manifest_path = project_root / "assets/models/abyssal-command/manifest.json"
    bridge_manifest_path = project_root / "assets/images/battle/glb/manifest.json"
    model_manifest = json.loads(model_manifest_path.read_text())
    bridge_manifest = json.loads(bridge_manifest_path.read_text())
    layout = bridge_manifest.get("atlasLayout", {})
    expected_direction_index = [
        {"column": column, "yawDegrees": yaw}
        for column, yaw in enumerate(YAW_DEGREES)
    ]
    if (
        bridge_manifest.get("generationVersion") != GENERATION_VERSION
        or layout.get("actionColumns") != len(YAW_DEGREES)
        or layout.get("actionRows") != len(FRAME_SAMPLES)
        or layout.get("frameSamples") != list(FRAME_SAMPLES)
        or layout.get("directionIndex") != expected_direction_index
        or layout.get("cellPaddingFraction") != CELL_PADDING_FRACTION
        or layout.get("transparentBackground") is not True
    ):
        raise RuntimeError("Published bridge layout contract mismatch")
    expected_actions = {
        (asset["id"], clip, action)
        for asset in model_manifest["assets"]
        for clip, action in zip(asset["actionClips"], asset["actions"])
    }
    expected_terrains = {
        asset["id"]
        for asset in model_manifest["assets"]
        if asset["category"] == "terrain"
    }
    records = bridge_manifest.get("records", [])
    actual_actions = {
        (record["assetId"], record.get("clip"), record.get("action"))
        for record in records
        if record.get("kind") == "actionAtlas"
    }
    actual_terrains = {
        record["assetId"]
        for record in records
        if record.get("kind") == "terrainPlate"
    }
    if actual_actions != expected_actions or actual_terrains != expected_terrains:
        raise RuntimeError(
            f"Published coverage mismatch: actions {len(actual_actions)}/{len(expected_actions)}, "
            f"terrain {len(actual_terrains)}/{len(expected_terrains)}"
        )
    minimum_padding = float("inf")
    minimum_animated_directions = len(YAW_DEGREES)
    output_root = (project_root / "assets/images/battle/glb").resolve()
    for record in records:
        source = project_root / record["source"]["path"]
        output = project_root / record["output"]["path"]
        if not output.resolve().is_relative_to(output_root):
            raise RuntimeError(f"Bridge output escapes runtime asset root: {output}")
        if not source.is_file() or not output.is_file():
            raise RuntimeError(f"Missing published bridge artifact: {record['assetId']}")
        if sha256(source) != record["source"]["sha256"] or sha256(output) != record["output"]["sha256"]:
            raise RuntimeError(f"Published hash mismatch: {record['assetId']}")
        columns = record["layout"]["columns"]
        rows = record["layout"]["rows"]
        cell_width = record["layout"]["cellWidth"]
        cell_height = record["layout"]["cellHeight"]
        dimensions = (columns * cell_width, rows * cell_height)
        if png_dimensions(output) != dimensions or dimensions != (
            record["output"]["width"],
            record["output"]["height"],
        ):
            raise RuntimeError(f"Published dimension mismatch: {record['assetId']}")
        validation = record.get("visualValidation", {})
        if (
            validation.get("nonEmptyCells") != columns * rows
            or validation.get("minimumEdgePaddingPx", 0) < 1
        ):
            raise RuntimeError(f"Published alpha/padding validation mismatch: {record['assetId']}")
        minimum_padding = min(minimum_padding, validation["minimumEdgePaddingPx"])
        if record["kind"] == "actionAtlas":
            if validation.get("distinctDirectionColumns") != len(YAW_DEGREES):
                raise RuntimeError(f"Published direction coverage mismatch: {record['assetId']}")
            minimum_animated_directions = min(
                minimum_animated_directions,
                validation.get("animatedDirectionColumns", 0),
            )
    print(
        f"GLB_RASTER_VERIFY records={len(records)} action_atlases={len(actual_actions)} "
        f"terrain_plates={len(actual_terrains)} missing_actions=0 "
        f"minimum_edge_padding_px={int(minimum_padding)} "
        f"minimum_animated_direction_columns={minimum_animated_directions} "
        f"manifest_sha256={sha256(bridge_manifest_path)}"
    )





def render_pack(project_root, size, asset_ids=(), publish=False, skip_media_manifest=False):
    model_manifest_path = project_root / "assets/models/abyssal-command/manifest.json"
    model_manifest = json.loads(model_manifest_path.read_text())
    output_dir = project_root / "assets/images/battle/glb"
    output_dir.mkdir(parents=True, exist_ok=True)
    declared_assets = model_manifest["assets"]
    declared_by_id = {asset["id"]: asset for asset in declared_assets}
    unknown = sorted(set(asset_ids) - set(declared_by_id))
    if unknown:
        raise RuntimeError(f"Unknown declared asset IDs: {', '.join(unknown)}")
    assets_to_render = (
        [declared_by_id[asset_id] for asset_id in asset_ids]
        if asset_ids
        else ([] if publish else declared_assets)
    )
    scene = bpy.context.scene
    configure_render(scene, size)
    records = []
    for asset in assets_to_render:
        asset_records = []
        source_rel = f"assets/models/abyssal-command/{asset['path']}"
        source_path = project_root / source_rel
        source_hash = sha256(source_path)
        imported = import_glb(source_path)
        root = find_root(asset["id"], imported)
        if asset["category"] == "terrain":
            bpy.context.scene.frame_set(1)
            bpy.context.view_layer.update()
            framing = framing_for_clip(imported, root, (1,))
            camera_data = bpy.data.cameras.new("atlas_camera")
            camera_data.type = "ORTHO"
            camera_data.ortho_scale = framing["orthoScale"]
            camera = bpy.data.objects.new("atlas_camera", camera_data)
            bpy.context.collection.objects.link(camera)
            scene.camera = camera
            add_deterministic_lights(scene, root.matrix_world.translation, camera_data.ortho_scale)
            output_rel = f"assets/images/battle/glb/{asset['id']}.png"
            staged_path = output_dir / ".staging" / f"{asset['id']}.png"
            staged_path.parent.mkdir(exist_ok=True)
            width, height, diagnostics = pack_atlas(
                scene, camera, root, (1,), size, staged_path, True, framing
            )
            record = output_record(
                asset, source_rel, source_hash, staged_path, output_rel, width, height, diagnostics
            )
            records.append(record)
            asset_records.append(record)
            write_chunk_records(output_dir, asset["id"], asset_records)
            continue
        if len(asset["actions"]) != len(asset["actionClips"]):
            raise RuntimeError(f"Action declaration mismatch for {asset['id']}")
        for action_name, clip in zip(asset["actions"], asset["actionClips"]):
            select_clip(imported, root, action_name)
            framing = framing_for_clip(imported, root, FRAME_SAMPLES)
            camera_data = bpy.data.cameras.new("atlas_camera")
            camera_data.type = "ORTHO"
            camera_data.ortho_scale = framing["orthoScale"]
            camera = bpy.data.objects.new("atlas_camera", camera_data)
            bpy.context.collection.objects.link(camera)
            scene.camera = camera
            add_deterministic_lights(scene, root.matrix_world.translation, framing["orthoScale"])
            output_rel = f"assets/images/battle/glb/{asset['id']}__{clip}.png"
            staged_path = output_dir / ".staging" / f"{asset['id']}__{clip}.png"
            staged_path.parent.mkdir(exist_ok=True)
            width, height, diagnostics = pack_atlas(
                scene, camera, root, FRAME_SAMPLES, size, staged_path, False, framing
            )
            record = output_record(
                asset, source_rel, source_hash, staged_path, output_rel, width, height, diagnostics, clip
            )
            record["camera"] = camera_metadata(framing)
            records.append(record)
            asset_records.append(record)
            bpy.data.objects.remove(camera, do_unlink=True)
            for light in tuple(obj for obj in scene.objects if obj.name.startswith("atlas_") and obj.type == "LIGHT"):
                bpy.data.objects.remove(light, do_unlink=True)
        write_chunk_records(output_dir, asset["id"], asset_records)
    records.sort(key=lambda record: (record["assetId"], record["kind"], record.get("clip", "")))
    if not publish:
        print(
            f"GLB_RASTER_CHUNK assets={len(assets_to_render)} "
            f"action_atlases={sum(record['kind'] == 'actionAtlas' for record in records)} "
            f"terrain_plates={sum(record['kind'] == 'terrainPlate' for record in records)}"
        )
        return
    records = completed_records(project_root, model_manifest, output_dir)
    for record in records:
        staged = Path(record.pop("_stagedPath"))
        destination = project_root / record["output"]["path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        if staged.is_file():
            staged.replace(destination)
    raster_manifest = {
        "generationVersion": GENERATION_VERSION,
        "generator": "scripts/render-8dir-atlas.py",
        "blenderVersion": bpy.app.version_string,
        "sourceManifest": "assets/models/abyssal-command/manifest.json",
        "atlasLayout": {
            "actionColumns": 8,
            "actionRows": len(FRAME_SAMPLES),
            "frameSamples": list(FRAME_SAMPLES),
            "yawColumnsDegrees": list(YAW_DEGREES),
            "directionIndex": [
                {"column": column, "yawDegrees": yaw}
                for column, yaw in enumerate(YAW_DEGREES)
            ],
            "cellPaddingFraction": CELL_PADDING_FRACTION,
            "transparentBackground": True,
        },
        "records": records,
    }
    if not skip_media_manifest:
        sync_media_manifest(project_root, records)
    manifest_path = output_dir / "manifest.json"
    temporary = manifest_path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(raster_manifest, indent=2) + "\n")
    temporary.replace(manifest_path)
    print(
        f"GLB_RASTER_PACK assets={len(model_manifest['assets'])} "
        f"action_atlases={sum(record['kind'] == 'actionAtlas' for record in records)} "
        f"terrain_plates={sum(record['kind'] == 'terrainPlate' for record in records)} "
        f"outputs={len(records)} manifest={manifest_path} "
        f"media_manifest={'skipped' if skip_media_manifest else 'updated'}"
    )


def render_scene_directions(out_dir, size):
    """Original one-model scene mode, retained for direct .blend rendering."""
    scene = bpy.context.scene
    configure_render(scene, size)
    pivot = bpy.data.objects.new("atlas_pivot", None)
    bpy.context.collection.objects.link(pivot)
    max_dim = 4.0
    for obj in bpy.context.collection.objects:
        if obj.type == "MESH":
            max_dim = max(max_dim, max(obj.dimensions))
    camera_data = bpy.data.cameras.new("atlas_cam")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max_dim * 1.6
    camera = bpy.data.objects.new("atlas_cam", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.parent = pivot
    distance = max_dim * 4
    pitch = math.radians(60)
    camera.location = (0, -distance * math.sin(pitch), distance * math.cos(pitch))
    camera.rotation_euler = (pitch, 0, 0)
    scene.camera = camera
    for direction in range(8):
        pivot.rotation_euler = (0, 0, math.radians(45 * direction))
        scene.render.filepath = f"{out_dir}/dir{direction}.png"
        bpy.ops.render.render(write_still=True)
    print(f"ATLAS_RESULT dirs=8 size={size} out={out_dir} ortho_scale={camera_data.ortho_scale:.2f}")


args = parse_args()
project_root = Path(args.project_root).resolve()
if args.verify:
    verify_pack(project_root)
elif args.pack:
    render_pack(
        project_root,
        args.size,
        args.asset_id,
        args.publish,
        args.skip_media_manifest,
    )
else:
    render_scene_directions(args.out, args.size)
