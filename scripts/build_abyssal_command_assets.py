"""Build the low-poly Abyssal Command source-model pack with Blender.

Run from the repository root:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build_abyssal_command_assets.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "models" / "abyssal-command"
UNITS = OUTPUT / "units"
BOSSES = OUTPUT / "bosses"
PROPS = OUTPUT / "props"
TERRAIN = OUTPUT / "terrain"
TEXTURES = OUTPUT / "textures"

for directory in (OUTPUT, UNITS, BOSSES, PROPS, TERRAIN):
    directory.mkdir(parents=True, exist_ok=True)

PALETTE = {
    "void": (0.045, 0.025, 0.105, 1.0),
    "obsidian": (0.095, 0.075, 0.145, 1.0),
    "steel": (0.17, 0.19, 0.28, 1.0),
    "ash": (0.34, 0.31, 0.38, 1.0),
    "violet": (0.25, 0.055, 0.55, 1.0),
    "cyan": (0.025, 0.42, 0.67, 1.0),
    "ember": (0.9, 0.1, 0.025, 1.0),
    "gold": (0.75, 0.34, 0.05, 1.0),
    "bone": (0.54, 0.48, 0.37, 1.0),
}

# Every existing material entry keeps its own PBR settings while sharing the
# authored texture family appropriate to its palette role.
MATERIAL_TEXTURE_FAMILIES = {
    "void": "void-obsidian",
    "obsidian": "void-obsidian",
    "steel": "cold-steel",
    "ash": "ash-cloth",
    "violet": "violet-rift",
    "cyan": "violet-rift",
    "ember": "cinder-ember",
    "gold": "gate-gold",
    "bone": "old-bone",
}
TEXTURE_RESOURCES = {
    family: {
        "albedo": TEXTURES / f"{family}-albedo.png",
        "normal": TEXTURES / f"{family}-normal.png",
    }
    for family in sorted(set(MATERIAL_TEXTURE_FAMILIES.values()))
}


# New output scene only; this script never opens or modifies an existing artist .blend.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for collection in list(bpy.data.collections):
    bpy.data.collections.remove(collection)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.fps = 30
scene["asset_pack"] = "Abyssal Command low-poly dark-fantasy resources"
scene["version"] = 1


def texture_image(family: str, role: str) -> bpy.types.Image:
    path = TEXTURE_RESOURCES[family][role]
    if not path.is_file():
        raise FileNotFoundError(f"Required {role} texture is missing: {path}")
    image = bpy.data.images.load(str(path), check_existing=True)
    image.name = f"Abyssal Command {family} {role}"
    image.colorspace_settings.name = "sRGB" if role == "albedo" else "Non-Color"
    return image


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    texture_family: str,
    metallic: float = 0.0,
    roughness: float = 0.72,
    emission: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = color
    mat["texture_family"] = texture_family
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "Material Output"
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.name = "Principled BSDF"
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if emission:
        emission_input = principled.inputs.get("Emission Color") or principled.inputs.get("Emission")
        if emission_input:
            emission_input.default_value = color
        strength_input = principled.inputs.get("Emission Strength")
        if strength_input:
            strength_input.default_value = emission

    uv_map = nodes.new("ShaderNodeUVMap")
    uv_map.name = "UV0"
    uv_map.uv_map = "UV0"
    albedo = nodes.new("ShaderNodeTexImage")
    albedo.name = "Albedo"
    albedo.label = f"{texture_family} albedo"
    albedo.image = texture_image(texture_family, "albedo")
    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.name = "Normal Texture"
    normal_texture.label = f"{texture_family} tangent-space normal"
    normal_texture.image = texture_image(texture_family, "normal")
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.name = "Normal Map"
    normal_map.space = "TANGENT"

    links.new(uv_map.outputs["UV"], albedo.inputs["Vector"])
    links.new(uv_map.outputs["UV"], normal_texture.inputs["Vector"])
    links.new(albedo.outputs["Color"], principled.inputs["Base Color"])
    links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    return mat


MATS = {
    "void": material("Void Obsidian", PALETTE["void"], texture_family=MATERIAL_TEXTURE_FAMILIES["void"], metallic=0.32, roughness=0.32),
    "obsidian": material("Obsidian", PALETTE["obsidian"], texture_family=MATERIAL_TEXTURE_FAMILIES["obsidian"], metallic=0.48, roughness=0.26),
    "steel": material("Cold Steel", PALETTE["steel"], texture_family=MATERIAL_TEXTURE_FAMILIES["steel"], metallic=0.72, roughness=0.32),
    "ash": material("Ash Cloth", PALETTE["ash"], texture_family=MATERIAL_TEXTURE_FAMILIES["ash"], roughness=0.94),
    "violet": material("Violet Ether", PALETTE["violet"], texture_family=MATERIAL_TEXTURE_FAMILIES["violet"], metallic=0.12, roughness=0.26, emission=2.0),
    "cyan": material("Cyan Rift", PALETTE["cyan"], texture_family=MATERIAL_TEXTURE_FAMILIES["cyan"], metallic=0.1, roughness=0.2, emission=2.5),
    "ember": material("Cinder Ember", PALETTE["ember"], texture_family=MATERIAL_TEXTURE_FAMILIES["ember"], metallic=0.05, roughness=0.28, emission=2.6),
    "gold": material("Gate Gold", PALETTE["gold"], texture_family=MATERIAL_TEXTURE_FAMILIES["gold"], metallic=0.78, roughness=0.25),
    "bone": material("Old Bone", PALETTE["bone"], texture_family=MATERIAL_TEXTURE_FAMILIES["bone"], roughness=0.7),
}


ASSET_ROOT = bpy.data.collections.new("Abyssal Command Resource Pack")
scene.collection.children.link(ASSET_ROOT)
ASSETS: list[dict[str, object]] = []


def make_collection(name: str, category: str) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    collection["asset_id"] = name
    collection["category"] = category
    collection["pivot"] = "ground-center"
    ASSET_ROOT.children.link(collection)
    return collection


def ensure_uv0(obj: bpy.types.Object) -> None:
    """Ensure primitive mesh data exports its texture coordinates as UV0."""
    mesh = obj.data
    uv_layer = mesh.uv_layers.get("UV0")
    if uv_layer is None:
        uv_layer = mesh.uv_layers.active
        if uv_layer is not None:
            uv_layer.name = "UV0"
        else:
            uv_layer = mesh.uv_layers.new(name="UV0")
            coordinates = [vertex.co for vertex in mesh.vertices]
            if coordinates:
                minimum = tuple(min(co[index] for co in coordinates) for index in range(3))
                span = tuple(
                    max(max(co[index] for co in coordinates) - minimum[index], 0.000001)
                    for index in range(3)
                )
                for polygon in mesh.polygons:
                    normal = polygon.normal
                    if abs(normal.z) >= abs(normal.x) and abs(normal.z) >= abs(normal.y):
                        axes = (0, 1)
                    elif abs(normal.x) >= abs(normal.y):
                        axes = (1, 2)
                    else:
                        axes = (0, 2)
                    for loop_index in polygon.loop_indices:
                        coordinate = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                        uv_layer.data[loop_index].uv = (
                            (coordinate[axes[0]] - minimum[axes[0]]) / span[axes[0]],
                            (coordinate[axes[1]] - minimum[axes[1]]) / span[axes[1]],
                        )
    mesh.uv_layers.active_index = list(mesh.uv_layers).index(uv_layer)
    uv_layer.active_render = True

def triangulate_mesh(obj: bpy.types.Object) -> None:
    """Triangulate asset geometry so tangent-space normal maps export reliably."""
    mesh = obj.data
    mesh_data = bmesh.new()
    mesh_data.from_mesh(mesh)
    bmesh.ops.triangulate(mesh_data, faces=mesh_data.faces[:])
    mesh_data.to_mesh(mesh)
    mesh_data.free()
    mesh.update()


def add_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection, label: str):
    obj.name = label
    for old_collection in list(obj.users_collection):
        old_collection.objects.unlink(obj)
    collection.objects.link(obj)
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = False
        triangulate_mesh(obj)
        ensure_uv0(obj)
    return obj


def apply_material(obj: bpy.types.Object, mat: bpy.types.Material):
    if obj.type == "MESH":
        obj.data.materials.append(mat)
    return obj


def cube(collection, label, location, dimensions, mat, *, rotation=(0.0, 0.0, 0.0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("edge bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
    return apply_material(add_to_collection(obj, collection, label), mat)


def cone(collection, label, location, radius1, radius2, depth, mat, *, vertices=8, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    return apply_material(add_to_collection(bpy.context.object, collection, label), mat)


def cylinder(collection, label, location, radius, depth, mat, *, vertices=8, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    return apply_material(add_to_collection(bpy.context.object, collection, label), mat)


def ico(collection, label, location, radius, mat, *, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=location)
    return apply_material(add_to_collection(bpy.context.object, collection, label), mat)


def torus(collection, label, location, major_radius, minor_radius, mat, *, rotation=(0.0, 0.0, 0.0), major_segments=12, minor_segments=6):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=location,
        rotation=rotation,
    )
    return apply_material(add_to_collection(bpy.context.object, collection, label), mat)


ACTION_CLIPS_BY_CATEGORY = {
    "unit": ("Idle", "Move", "Strike", "Special", "Defeat"),
    "boss": ("Idle", "Attack", "Defeat"),
    "prop": ("Idle", "Activate"),
    "terrain": (),
}


def clip_keyframes(category: str, clip_name: str) -> dict[str, tuple[tuple[int, tuple[float, float, float]], ...]]:
    """Return compact 30 fps root-transform keyframes for a reusable clip."""
    identity_location = (0.0, 0.0, 0.0)
    identity_rotation = (0.0, 0.0, 0.0)
    identity_scale = (1.0, 1.0, 1.0)
    if clip_name == "Idle":
        return {
            "location": ((1, identity_location), (15, (0.0, 0.0, 0.035)), (30, identity_location)),
            "rotation_euler": ((1, identity_rotation), (15, (0.0, 0.0, math.radians(3))), (30, identity_rotation)),
            "scale": ((1, identity_scale), (15, (1.015, 1.015, 1.015)), (30, identity_scale)),
        }
    if clip_name == "Move":
        return {
            "location": ((1, identity_location), (15, (0.0, 0.28, 0.02)), (30, (0.0, 0.56, 0.0))),
            "rotation_euler": ((1, identity_rotation), (15, (0.0, 0.0, math.radians(-4))), (30, identity_rotation)),
            "scale": ((1, identity_scale), (15, (1.0, 1.0, 0.97)), (30, identity_scale)),
        }
    if clip_name in {"Strike", "Attack"}:
        return {
            "location": ((1, identity_location), (12, (0.0, 0.04, 0.0)), (24, identity_location)),
            "rotation_euler": ((1, identity_rotation), (8, (0.0, 0.0, math.radians(-18))), (16, (0.0, 0.0, math.radians(24))), (24, identity_rotation)),
            "scale": ((1, identity_scale), (12, (1.05, 1.05, 1.05)), (24, identity_scale)),
        }
    if clip_name == "Special":
        return {
            "location": ((1, identity_location), (15, (0.0, 0.0, 0.12)), (30, identity_location)),
            "rotation_euler": ((1, identity_rotation), (15, (0.0, 0.0, math.tau)), (30, (0.0, 0.0, math.tau * 2))),
            "scale": ((1, identity_scale), (15, (1.16, 1.16, 1.16)), (30, identity_scale)),
        }
    if clip_name == "Activate":
        return {
            "location": ((1, identity_location), (15, (0.0, 0.0, 0.05)), (30, identity_location)),
            "rotation_euler": ((1, identity_rotation), (30, (0.0, 0.0, math.tau))),
            "scale": ((1, identity_scale), (15, (1.08, 1.08, 1.08)), (30, identity_scale)),
        }
    if clip_name == "Defeat":
        return {
            "location": ((1, identity_location), (30, (0.0, 0.1, 0.0))),
            "rotation_euler": ((1, identity_rotation), (30, (math.radians(84), 0.0, 0.0))),
            "scale": ((1, identity_scale), (30, identity_scale)),
        }
    raise ValueError(f"Unsupported {category} clip: {clip_name}")


def create_layered_action(
    asset_id: str,
    root: bpy.types.Object,
    category: str,
    clip_name: str,
) -> bpy.types.Action:
    """Create a Blender 5.1 layered action explicitly targeted at this root."""
    action = bpy.data.actions.new(f"{asset_id}__{clip_name}")
    action["asset_id"] = asset_id
    action["clip_name"] = clip_name
    action["fps"] = 30
    layer = action.layers.new("Root Transform")
    slot = action.slots.new("OBJECT", root.name)
    strip = layer.strips.new(type="KEYFRAME")
    bag = strip.channelbags.new(slot)
    for data_path, keys in clip_keyframes(category, clip_name).items():
        for index in range(3):
            curve = bag.fcurves.new(data_path, index=index)
            for frame, values in keys:
                keyframe = curve.keyframe_points.insert(frame, values[index])
                keyframe.interpolation = "BEZIER"
    return action


def create_asset_root(asset_id: str, category: str, collection: bpy.types.Collection) -> bpy.types.Object:
    """Place an Empty at ground center and make it the transform owner for meshes."""
    root = bpy.data.objects.new(f"{asset_id}-root", None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.35
    root.rotation_mode = "XYZ"
    root["asset_id"] = asset_id
    root["category"] = category
    root["pivot"] = "ground-center"
    collection.objects.link(root)

    for piece in list(collection.objects):
        if piece is root or piece.type != "MESH":
            continue
        world_matrix = piece.matrix_world.copy()
        piece.parent = root
        piece.matrix_parent_inverse = root.matrix_world.inverted()
        piece.matrix_world = world_matrix
    return root


def create_asset_actions(asset_id: str, category: str, root: bpy.types.Object) -> list[bpy.types.Action]:
    actions = [
        create_layered_action(asset_id, root, category, clip_name)
        for clip_name in ACTION_CLIPS_BY_CATEGORY[category]
    ]
    if not actions:
        return actions

    animation_data = root.animation_data_create()
    animation_data.action = actions[0]
    for action in actions:
        track = animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, 1, action)
        strip.name = action.name
        strip.action_frame_start = 1
        strip.action_frame_end = 30
    return actions


def register(asset_id: str, category: str, collection: bpy.types.Collection, relative_path: str):
    root = create_asset_root(asset_id, category, collection)
    actions = create_asset_actions(asset_id, category, root)
    ASSETS.append(
        {
            "id": asset_id,
            "category": category,
            "collection": collection,
            "root": root,
            "path": relative_path,
            "actions": actions,
        }
    )


def model_shade():
    collection = make_collection("shade", "unit")
    cone(collection, "shade-cloak", (0, 0, 0.86), 0.45, 0.18, 1.55, MATS["ash"])
    ico(collection, "shade-mask", (0, 0, 1.72), 0.26, MATS["void"])
    cone(collection, "shade-hood", (0, 0, 1.97), 0.31, 0.0, 0.42, MATS["obsidian"])
    cylinder(collection, "shade-left-blade", (-0.36, 0, 1.12), 0.045, 0.78, MATS["steel"], rotation=(0, math.radians(30), 0))
    cylinder(collection, "shade-right-blade", (0.36, 0, 1.12), 0.045, 0.78, MATS["steel"], rotation=(0, math.radians(-30), 0))
    register("shade", "unit", collection, "units/shade.glb")


def model_possessed():
    collection = make_collection("possessed", "unit")
    cone(collection, "possessed-cloak", (0, 0, 0.86), 0.46, 0.16, 1.55, MATS["void"])
    ico(collection, "possessed-mask", (0, 0, 1.72), 0.26, MATS["violet"])
    cone(collection, "possessed-hood", (0, 0, 1.97), 0.31, 0.0, 0.42, MATS["obsidian"])
    torus(collection, "possessed-aura", (0, 0, 1.15), 0.52, 0.04, MATS["violet"], rotation=(math.radians(90), 0, 0))
    for index, x in enumerate((-0.34, 0.34)):
        ico(collection, f"possessed-crystal-{index}", (x, 0.03, 1.2), 0.13, MATS["cyan"])
    register("possessed", "unit", collection, "units/possessed.glb")


def model_scout():
    collection = make_collection("scout", "unit")
    cone(collection, "scout-body", (0, 0, 0.72), 0.34, 0.2, 1.25, MATS["steel"])
    ico(collection, "scout-head", (0, 0, 1.43), 0.22, MATS["void"])
    cone(collection, "scout-crest", (0, -0.03, 1.72), 0.21, 0.0, 0.36, MATS["ember"], rotation=(math.radians(-12), 0, 0))
    for index, x in enumerate((-0.24, 0.24)):
        cylinder(collection, f"scout-leg-{index}", (x, 0, 0.3), 0.065, 0.58, MATS["steel"], rotation=(0, math.radians(-18 if x < 0 else 18), 0))
    cone(collection, "scout-spear", (0.42, 0, 1.08), 0.045, 0.02, 1.35, MATS["ember"], vertices=6, rotation=(0, math.radians(-22), 0))
    register("scout", "unit", collection, "units/scout.glb")


def model_guard():
    collection = make_collection("guard", "unit")
    cube(collection, "guard-body", (0, 0, 0.8), (0.72, 0.42, 1.25), MATS["steel"], bevel=0.06)
    ico(collection, "guard-helm", (0, 0, 1.62), 0.31, MATS["obsidian"])
    cone(collection, "guard-helm-crest", (0, 0, 1.96), 0.18, 0.0, 0.38, MATS["gold"])
    cylinder(collection, "guard-shield", (-0.52, 0, 1.0), 0.36, 0.11, MATS["obsidian"], vertices=8, rotation=(math.radians(90), 0, 0))
    cylinder(collection, "guard-halberd", (0.48, 0, 1.1), 0.045, 1.52, MATS["steel"], rotation=(0, math.radians(-20), 0))
    register("guard", "unit", collection, "units/guard.glb")


def model_reinforce():
    collection = make_collection("reinforce", "unit")
    cone(collection, "reinforce-torso", (0, 0, 0.92), 0.58, 0.34, 1.55, MATS["obsidian"])
    ico(collection, "reinforce-head", (0, 0, 1.86), 0.34, MATS["ember"])
    for index, x in enumerate((-0.43, 0.43)):
        ico(collection, f"reinforce-shoulder-{index}", (x, 0, 1.38), 0.28, MATS["steel"])
    for index, x in enumerate((-0.18, 0.18)):
        cone(collection, f"reinforce-horn-{index}", (x, 0, 2.22), 0.11, 0.0, 0.66, MATS["bone"], rotation=(0, math.radians(-18 if x < 0 else 18), 0))
    cube(collection, "reinforce-maul-head", (0.66, 0, 1.25), (0.22, 0.32, 0.48), MATS["ember"], rotation=(0, math.radians(-20), 0))
    cylinder(collection, "reinforce-maul-shaft", (0.4, 0, 0.89), 0.055, 1.28, MATS["steel"], rotation=(0, math.radians(-20), 0))
    register("reinforce", "unit", collection, "units/reinforce.glb")


def model_cinder_warden():
    collection = make_collection("cinder-warden", "boss")
    cone(collection, "warden-robe", (0, 0, 1.15), 0.8, 0.4, 2.05, MATS["ember"])
    ico(collection, "warden-skull", (0, 0, 2.35), 0.44, MATS["bone"], subdivisions=2)
    for index, x in enumerate((-0.36, 0.36)):
        cone(collection, f"warden-horn-{index}", (x, 0, 2.78), 0.16, 0.0, 0.88, MATS["obsidian"], rotation=(0, math.radians(-22 if x < 0 else 22), 0))
    torus(collection, "warden-fire-ring", (0, 0, 1.4), 0.93, 0.06, MATS["ember"], rotation=(math.radians(90), 0, 0), major_segments=16)
    cylinder(collection, "warden-staff", (0.88, 0, 1.35), 0.07, 2.55, MATS["gold"], rotation=(0, math.radians(-18), 0))
    register("cinder-warden", "boss", collection, "bosses/cinder-warden.glb")


def model_veil_tactician():
    collection = make_collection("veil-tactician", "boss")
    cone(collection, "tactician-robe", (0, 0, 1.08), 0.82, 0.25, 2.05, MATS["violet"])
    ico(collection, "tactician-mask", (0, 0, 2.25), 0.38, MATS["gold"], subdivisions=2)
    cone(collection, "tactician-hood", (0, 0, 2.62), 0.5, 0.0, 0.75, MATS["void"])
    for index, z in enumerate((1.3, 1.65, 1.98)):
        torus(collection, f"tactician-sigil-{index}", (0, 0, z), 0.87 - index * 0.12, 0.035, MATS["cyan"], rotation=(math.radians(90), 0, 0), major_segments=12)
    cylinder(collection, "tactician-scepter", (-0.88, 0, 1.38), 0.065, 2.65, MATS["steel"], rotation=(0, math.radians(18), 0))
    ico(collection, "tactician-scepter-core", (-1.27, 0, 2.5), 0.18, MATS["cyan"])
    register("veil-tactician", "boss", collection, "bosses/veil-tactician.glb")


def model_gate_sovereign():
    collection = make_collection("gate-sovereign", "boss")
    cube(collection, "sovereign-torso", (0, 0, 1.25), (1.25, 0.72, 1.65), MATS["obsidian"], bevel=0.1)
    ico(collection, "sovereign-head", (0, 0, 2.36), 0.5, MATS["gold"], subdivisions=2)
    for index, x in enumerate((-0.52, -0.2, 0.2, 0.52)):
        cone(collection, f"sovereign-crown-{index}", (x, 0, 2.92 + abs(x) * 0.16), 0.1, 0.0, 0.78, MATS["gold"], rotation=(0, math.radians(-12 if x < 0 else 12), 0))
    for index, x in enumerate((-1.07, 1.07)):
        cube(collection, f"sovereign-wing-{index}", (x, 0.05, 1.85), (0.82, 0.18, 1.5), MATS["void"], rotation=(0, math.radians(-20 if x < 0 else 20), 0), bevel=0.04)
        torus(collection, f"sovereign-wing-rift-{index}", (x * 1.05, 0.0, 1.95), 0.36, 0.04, MATS["violet"], rotation=(math.radians(90), 0, 0))
    cube(collection, "sovereign-blade", (1.15, 0, 1.22), (0.18, 0.16, 2.45), MATS["steel"], rotation=(0, math.radians(-15), 0))
    register("gate-sovereign", "boss", collection, "bosses/gate-sovereign.glb")


def prop_rift_portal():
    collection = make_collection("rift-portal", "prop")
    torus(collection, "portal-ring-outer", (0, 0, 1.45), 1.06, 0.12, MATS["obsidian"], rotation=(math.radians(90), 0, 0), major_segments=16)
    torus(collection, "portal-ring-inner", (0, 0, 1.45), 0.86, 0.045, MATS["violet"], rotation=(math.radians(90), 0, 0), major_segments=16)
    cube(collection, "portal-plinth", (0, 0, 0.17), (2.15, 0.9, 0.32), MATS["steel"], bevel=0.06)
    register("rift-portal", "prop", collection, "props/rift-portal.glb")


def prop_command_obelisk():
    collection = make_collection("command-obelisk", "prop")
    cube(collection, "obelisk-base", (0, 0, 0.18), (1.18, 1.18, 0.36), MATS["steel"], bevel=0.08)
    cone(collection, "obelisk-spire", (0, 0, 1.35), 0.46, 0.11, 2.5, MATS["obsidian"], vertices=4, rotation=(0, 0, math.radians(45)))
    ico(collection, "obelisk-core", (0, 0, 1.52), 0.24, MATS["cyan"])
    register("command-obelisk", "prop", collection, "props/command-obelisk.glb")


def prop_soul_extractor():
    collection = make_collection("soul-extractor", "prop")
    cylinder(collection, "extractor-base", (0, 0, 0.18), 0.95, 0.36, MATS["steel"], vertices=12)
    for index, angle in enumerate((0, math.tau / 3, math.tau * 2 / 3)):
        x = math.cos(angle) * 0.61
        y = math.sin(angle) * 0.61
        cone(collection, f"extractor-prong-{index}", (x, y, 0.86), 0.12, 0.03, 1.4, MATS["gold"], vertices=6, rotation=(math.radians(-22), 0, angle))
    ico(collection, "extractor-soul", (0, 0, 1.08), 0.36, MATS["cyan"], subdivisions=2)
    register("soul-extractor", "prop", collection, "props/soul-extractor.glb")


def prop_echo_throne():
    collection = make_collection("echo-throne", "prop")
    cube(collection, "throne-seat", (0, 0, 0.65), (1.45, 1.12, 0.42), MATS["obsidian"], bevel=0.08)
    cube(collection, "throne-back", (0, 0.45, 1.55), (1.45, 0.28, 1.65), MATS["void"], bevel=0.08)
    for index, x in enumerate((-0.55, 0.55)):
        cone(collection, f"throne-crown-spike-{index}", (x, 0.45, 2.48), 0.13, 0.0, 1.05, MATS["gold"])
    torus(collection, "throne-echo", (0, -0.12, 1.55), 0.55, 0.05, MATS["violet"], rotation=(math.radians(90), 0, 0))
    register("echo-throne", "prop", collection, "props/echo-throne.glb")


def terrain_cinder_span():
    collection = make_collection("cinder-span", "terrain")
    cube(collection, "cinder-left-cliff", (-1.65, 0, -0.18), (1.9, 2.7, 0.42), MATS["obsidian"], bevel=0.08)
    cube(collection, "cinder-right-cliff", (1.65, 0, -0.18), (1.9, 2.7, 0.42), MATS["obsidian"], bevel=0.08)
    cube(collection, "cinder-bridge", (0, 0, 0.08), (1.7, 0.86, 0.19), MATS["steel"], bevel=0.05)
    for index, x in enumerate((-0.52, 0.0, 0.52)):
        cube(collection, f"cinder-segment-{index}", (x, 0, 0.22), (0.42, 0.94, 0.08), MATS["ash"], bevel=0.02)
    register("cinder-span", "terrain", collection, "terrain/cinder-span.glb")


def terrain_veil_citadel():
    collection = make_collection("veil-citadel", "terrain")
    cube(collection, "citadel-floor", (0, 0, -0.13), (4.4, 3.4, 0.26), MATS["obsidian"], bevel=0.06)
    for index, x in enumerate((-1.18, 1.18)):
        cylinder(collection, f"citadel-plateau-{index}", (x, 0, 0.18), 0.94, 0.36, MATS["steel"], vertices=8)
        ico(collection, f"citadel-node-{index}", (x, 0, 0.62), 0.18, MATS["cyan"])
    cube(collection, "citadel-spine", (0, 0, 0.1), (1.62, 0.76, 0.22), MATS["ash"], bevel=0.04)
    register("veil-citadel", "terrain", collection, "terrain/veil-citadel.glb")


def terrain_echo_steps():
    collection = make_collection("echo-throne-steps", "terrain")
    for index in range(5):
        cube(
            collection,
            f"throne-step-{index}",
            (0, index * 0.36 - 0.72, index * 0.15 - 0.1),
            (3.2 - index * 0.24, 0.5, 0.3),
            MATS["obsidian"],
            bevel=0.05,
        )
    cube(collection, "throne-dais", (0, 1.25, 0.72), (2.1, 1.12, 0.42), MATS["gold"], bevel=0.08)
    register("echo-throne-steps", "terrain", collection, "terrain/echo-throne-steps.glb")


for builder in (
    model_shade,
    model_possessed,
    model_scout,
    model_guard,
    model_reinforce,
    model_cinder_warden,
    model_veil_tactician,
    model_gate_sovereign,
    prop_rift_portal,
    prop_command_obelisk,
    prop_soul_extractor,
    prop_echo_throne,
    terrain_cinder_span,
    terrain_veil_citadel,
    terrain_echo_steps,
):
    builder()


def recursive_objects(collection: bpy.types.Collection):
    objects = list(collection.objects)
    for child in collection.children:
        objects.extend(recursive_objects(child))
    return objects


def texture_families_for(collection: bpy.types.Collection) -> list[str]:
    return sorted(
        {
            str(material["texture_family"])
            for obj in recursive_objects(collection)
            if obj.type == "MESH"
            for material in obj.data.materials
            if material and "texture_family" in material
        }
    )


for asset in ASSETS:
    collection = asset["collection"]
    root = asset["root"]
    relative_path = asset["path"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in recursive_objects(collection):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT / relative_path),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
        export_tangents=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_cameras=False,
        export_lights=False,
        export_apply=True,
    )

manifest = {
    "version": 1,
    "pack": "abyssal-command-low-poly",
    "source": "abyssal-command-resource-pack.blend",
    "coordinateSystem": "Blender Z-up; ground-center pivots",
    "rendering": "Flat-shaded PBR GLB resources with embedded albedo and tangent-space normal textures; no external texture URLs",
    "textures": {
        "embeddedInGlb": True,
        "uvSet": "UV0",
        "normalMapSpace": "tangent",
        "resources": [
            {
                "family": family,
                "albedo": str(resources["albedo"].relative_to(OUTPUT)),
                "normal": str(resources["normal"].relative_to(OUTPUT)),
            }
            for family, resources in TEXTURE_RESOURCES.items()
        ],
    },
    "assets": [
        {
            "id": asset["id"],
            "category": asset["category"],
            "path": asset["path"],
            "pivot": "ground-center",
            "textureFamilies": texture_families_for(asset["collection"]),
            "actions": [action.name for action in asset["actions"]],
            "actionClips": [action["clip_name"] for action in asset["actions"]],
        }
        for asset in ASSETS
    ],
}
(OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / "abyssal-command-resource-pack.blend"))
print(f"ABYSSAL_COMMAND_RESOURCE_PACK_READY assets={len(ASSETS)} output={OUTPUT}")
