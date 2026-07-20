"""Build the low-poly Abyssal Command source-model pack with Blender.

Run from the repository root:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build_abyssal_command_assets.py
"""

from __future__ import annotations

import json
import hashlib
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

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
scene["version"] = 2


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


def panel(collection, label, location, dimensions, mat, *, rotation=(0.0, 0.0, 0.0), taper=0.5, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    tx, ty = taper if isinstance(taper, tuple) else (taper, taper)
    for v in bm.verts:
        if v.co.z > 0.0:
            v.co.x *= tx
            v.co.y *= ty
    bm.to_mesh(mesh)
    bm.free()
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
    # 2 idle + 2 movement + 3 combat + 2 skill + terminal Defeat. Bosses are
    # stationary (exposure/HP threat, never roam per the campaign design) so
    # they get no movement clips, but otherwise mirror the same 2/3/2 shape
    # under Attack-family names to match the existing Strike/Attack split.
    "unit": ("Idle", "IdleAlert", "Move", "Dash", "Strike", "StrikeHeavy", "Counter", "Special", "Cast", "Defeat"),
    "boss": ("Idle", "IdleAlert", "Attack", "AttackHeavy", "Counter", "Special", "Cast", "Defeat"),
    "prop": ("Idle", "Activate"),
    "terrain": (),
}


def mesh_bounds(collection: bpy.types.Collection) -> tuple[Vector, Vector]:
    """Return evaluated world-space bounds for the collection's mesh pieces."""
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in collection.objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    if not points:
        return Vector((0.0, 0.0, 0.0)), Vector((0.0, 0.0, 0.0))
    return (
        Vector(tuple(min(point[index] for point in points) for index in range(3))),
        Vector(tuple(max(point[index] for point in points) for index in range(3))),
    )


def ground_collection(collection: bpy.types.Collection) -> float:
    """Put the lowest evaluated vertex on Z=0 while retaining the authored XY origin."""
    bpy.context.view_layer.update()
    minimum, _ = mesh_bounds(collection)
    offset = -minimum.z
    if abs(offset) > 1e-6:
        for piece in collection.objects:
            if piece.type == "MESH":
                piece.location.z += offset
        bpy.context.view_layer.update()
    collection["ground_offset_applied"] = round(offset, 6)
    return offset


def evaluated_mesh_counts(mesh_objects: list[bpy.types.Object]) -> tuple[int, int]:
    """Count the exported geometry after non-destructive modifiers are evaluated."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    vertices = 0
    triangles = 0
    for obj in mesh_objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            vertices += len(mesh.vertices)
            triangles += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    return vertices, triangles


def collection_measurements(collection: bpy.types.Collection) -> dict[str, object]:
    minimum, maximum = mesh_bounds(collection)
    dimensions = maximum - minimum
    mesh_objects = [obj for obj in collection.objects if obj.type == "MESH"]
    vertices, triangles = evaluated_mesh_counts(mesh_objects)
    return {
        "boundsMin": [round(value, 4) for value in minimum],
        "boundsMax": [round(value, 4) for value in maximum],
        "dimensions": [round(value, 4) for value in dimensions],
        "meshPieces": len(mesh_objects),
        "vertices": vertices,
        "triangles": triangles,
    }


def clip_keyframes(category: str, clip_name: str) -> dict[str, tuple[tuple[int, tuple[float, float, float]], ...]]:
    """Return compact 30 fps root motion; locomotion stays in-place for runtime ownership."""
    identity_location = (0.0, 0.0, 0.0)
    identity_rotation = (0.0, 0.0, 0.0)
    identity_scale = (1.0, 1.0, 1.0)
    if clip_name == "Idle":
        return {
            "location": ((1, identity_location), (15, (0.0, 0.0, 0.025)), (30, identity_location)),
            "rotation_euler": ((1, identity_rotation), (15, (0.0, 0.0, math.radians(2))), (30, identity_rotation)),
            "scale": ((1, identity_scale), (15, (1.01, 1.01, 1.01)), (30, identity_scale)),
        }
    if clip_name == "IdleAlert":
        return {
            "location": ((1, identity_location), (10, (0.0, -0.015, 0.015)), (20, (0.0, -0.015, 0.03)), (30, identity_location)),
            "rotation_euler": ((1, identity_rotation), (10, (math.radians(4), 0.0, 0.0)), (20, (math.radians(4), 0.0, math.radians(-2))), (30, identity_rotation)),
            "scale": ((1, identity_scale), (15, (1.015, 1.015, 0.995)), (30, identity_scale)),
        }
    if clip_name == "Move":
        return {
            "rotation_euler": ((1, identity_rotation), (8, (0.0, 0.0, math.radians(-3))), (22, (0.0, 0.0, math.radians(3))), (30, identity_rotation)),
            "scale": ((1, identity_scale), (8, (1.01, 1.0, 0.985)), (22, (0.99, 1.0, 1.015)), (30, identity_scale)),
        }
    if clip_name == "Dash":
        # A second locomotion clip: no root "location" channel (same
        # runtime-owned in-place rule as Move) -- lean/squash only, exported
        # via rotation_euler and scale.
        return {
            "rotation_euler": ((1, identity_rotation), (10, (math.radians(10), 0.0, math.radians(-6))), (20, (math.radians(10), 0.0, math.radians(6))), (30, identity_rotation)),
            "scale": ((1, identity_scale), (10, (0.96, 1.0, 1.05)), (20, (1.04, 1.0, 0.95)), (30, identity_scale)),
        }
    if clip_name in {"Strike", "Attack"}:
        return {
            "location": ((1, identity_location), (12, (0.0, 0.04, 0.0)), (24, identity_location)),
            "rotation_euler": ((1, identity_rotation), (8, (0.0, 0.0, math.radians(-12))), (16, (0.0, 0.0, math.radians(16))), (24, identity_rotation)),
            "scale": ((1, identity_scale), (12, (1.035, 1.035, 1.035)), (24, identity_scale)),
        }
    if clip_name in {"StrikeHeavy", "AttackHeavy"}:
        return {
            "location": ((1, identity_location), (6, (0.0, -0.03, 0.02)), (16, (0.0, 0.07, -0.01)), (30, identity_location)),
            "rotation_euler": ((1, identity_rotation), (6, (0.0, 0.0, math.radians(-22))), (16, (0.0, 0.0, math.radians(30))), (30, identity_rotation)),
            "scale": ((1, identity_scale), (6, (0.97, 0.97, 0.97)), (16, (1.06, 1.06, 1.06)), (30, identity_scale)),
        }
    if clip_name == "Counter":
        return {
            "location": ((1, identity_location), (8, (0.0, -0.05, 0.0)), (18, (0.0, 0.05, 0.0)), (30, identity_location)),
            "rotation_euler": ((1, identity_rotation), (8, (0.0, 0.0, math.radians(14))), (18, (0.0, 0.0, math.radians(-20))), (30, identity_rotation)),
            "scale": ((1, identity_scale), (18, (1.025, 1.025, 1.025)), (30, identity_scale)),
        }
    if clip_name == "Special":
        return {
            "location": ((1, identity_location), (15, (0.0, 0.0, 0.08)), (30, identity_location)),
            "rotation_euler": ((1, identity_rotation), (15, (0.0, 0.0, math.tau)), (30, (0.0, 0.0, math.tau * 2))),
            "scale": ((1, identity_scale), (15, (1.1, 1.1, 1.1)), (30, identity_scale)),
        }
    if clip_name == "Cast":
        return {
            "location": ((1, identity_location), (15, (0.0, -0.02, 0.05)), (30, identity_location)),
            "rotation_euler": ((1, identity_rotation), (15, (math.radians(6), 0.0, math.radians(10))), (30, identity_rotation)),
            "scale": ((1, identity_scale), (15, (1.06, 1.06, 1.03)), (30, identity_scale)),
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


def control_keyframes(role: str, clip_name: str) -> dict[str, tuple[tuple[int, tuple[float, float, float]], ...]]:
    """Secondary rigid-control motion keeps the pack light while articulating body and gear."""
    location = (0.0, 0.0, 0.0)
    rotation = (0.0, 0.0, 0.0)
    scale = (1.0, 1.0, 1.0)
    if role == "body":
        if clip_name == "Idle":
            return {"location": ((1, location), (15, (0.0, 0.0, 0.018)), (30, location)), "scale": ((1, scale), (15, (1.0, 1.0, 1.012)), (30, scale))}
        if clip_name == "Move":
            return {"location": ((1, location), (8, (0.0, 0.0, 0.035)), (16, location), (24, (0.0, 0.0, 0.035)), (30, location)), "rotation_euler": ((1, rotation), (8, (math.radians(2), 0.0, math.radians(-2))), (24, (math.radians(2), 0.0, math.radians(2))), (30, rotation))}
        if clip_name == "Strike":
            return {"rotation_euler": ((1, rotation), (10, (math.radians(-7), 0.0, 0.0)), (17, (math.radians(9), 0.0, 0.0)), (24, rotation))}
        if clip_name == "Special":
            return {"scale": ((1, scale), (15, (1.045, 1.045, 1.07)), (30, scale))}
        if clip_name == "IdleAlert":
            return {"location": ((1, location), (10, (0.0, 0.0, 0.012)), (30, location)), "rotation_euler": ((1, rotation), (10, (math.radians(3), 0.0, 0.0)), (30, rotation))}
        if clip_name == "Dash":
            return {"location": ((1, location), (10, (0.0, 0.0, 0.05)), (20, location), (30, (0.0, 0.0, 0.05))), "rotation_euler": ((1, rotation), (10, (math.radians(6), 0.0, math.radians(-3))), (20, (math.radians(6), 0.0, math.radians(3))), (30, rotation))}
        if clip_name == "StrikeHeavy":
            return {"rotation_euler": ((1, rotation), (6, (math.radians(-10), 0.0, 0.0)), (16, (math.radians(14), 0.0, 0.0)), (30, rotation))}
        if clip_name == "Counter":
            return {"rotation_euler": ((1, rotation), (8, (math.radians(6), 0.0, 0.0)), (18, (math.radians(-9), 0.0, 0.0)), (30, rotation))}
        if clip_name == "Cast":
            return {"scale": ((1, scale), (15, (1.03, 1.03, 1.05)), (30, scale))}
        if clip_name == "Defeat":
            return {"rotation_euler": ((1, rotation), (30, (math.radians(9), 0.0, math.radians(-5))))}
    if clip_name == "Idle":
        return {"rotation_euler": ((1, rotation), (15, (0.0, math.radians(2), math.radians(-2))), (30, rotation))}
    if clip_name == "Move":
        return {"rotation_euler": ((1, rotation), (8, (math.radians(-4), 0.0, math.radians(4))), (22, (math.radians(4), 0.0, math.radians(-4))), (30, rotation))}
    if clip_name == "Strike":
        return {"rotation_euler": ((1, rotation), (8, (math.radians(-18), 0.0, math.radians(-10))), (16, (math.radians(26), 0.0, math.radians(12))), (24, rotation))}
    if clip_name == "Special":
        return {"rotation_euler": ((1, rotation), (15, (0.0, math.radians(12), math.radians(8))), (30, rotation)), "scale": ((1, scale), (15, (1.08, 1.08, 1.08)), (30, scale))}
    if clip_name == "IdleAlert":
        return {"rotation_euler": ((1, rotation), (10, (0.0, math.radians(3), math.radians(-3))), (30, rotation))}
    if clip_name == "Dash":
        return {"rotation_euler": ((1, rotation), (10, (math.radians(-6), 0.0, math.radians(6))), (20, (math.radians(6), 0.0, math.radians(-6))), (30, rotation))}
    if clip_name == "StrikeHeavy":
        return {"rotation_euler": ((1, rotation), (6, (math.radians(-24), 0.0, math.radians(-14))), (16, (math.radians(34), 0.0, math.radians(16))), (30, rotation))}
    if clip_name == "Counter":
        return {"rotation_euler": ((1, rotation), (8, (math.radians(16), 0.0, math.radians(8))), (18, (math.radians(-22), 0.0, math.radians(-12))), (30, rotation))}
    if clip_name == "Cast":
        return {"rotation_euler": ((1, rotation), (15, (0.0, math.radians(8), math.radians(6))), (30, rotation)), "scale": ((1, scale), (15, (1.05, 1.05, 1.05)), (30, scale))}
    if clip_name == "Defeat":
        return {"rotation_euler": ((1, rotation), (30, (math.radians(28), 0.0, math.radians(18))))}
    raise ValueError(f"Unsupported unit control clip: {clip_name}")


def create_transform_action(
    name: str,
    target: bpy.types.Object,
    clip_name: str,
    keyframes: dict[str, tuple[tuple[int, tuple[float, float, float]], ...]],
    layer_name: str,
) -> bpy.types.Action:
    """Create a Blender 5.1 layered action explicitly targeted at one object."""
    action = bpy.data.actions.new(name)
    action["clip_name"] = clip_name
    action["fps"] = 30
    layer = action.layers.new(layer_name)
    slot = action.slots.new("OBJECT", target.name)
    strip = layer.strips.new(type="KEYFRAME")
    bag = strip.channelbags.new(slot)
    for data_path, keys in keyframes.items():
        for index in range(3):
            curve = bag.fcurves.new(data_path, index=index)
            for frame, values in keys:
                keyframe = curve.keyframe_points.insert(frame, values[index])
                keyframe.interpolation = "BEZIER"
    return action


def create_layered_action(asset_id: str, root: bpy.types.Object, category: str, clip_name: str) -> bpy.types.Action:
    action = create_transform_action(
        f"{asset_id}__{clip_name}",
        root,
        clip_name,
        clip_keyframes(category, clip_name),
        "Root Transform",
    )
    action["asset_id"] = asset_id
    return action


def reparent_preserve_world(obj: bpy.types.Object, parent: bpy.types.Object) -> None:
    world_matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    obj.matrix_world = world_matrix


def create_asset_root(asset_id: str, category: str, collection: bpy.types.Collection) -> bpy.types.Object:
    """Place an Empty at the authored XY origin and measured ground plane."""
    root = bpy.data.objects.new(f"{asset_id}-root", None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.35
    root.rotation_mode = "XYZ"
    root["asset_id"] = asset_id
    root["category"] = category
    root["pivot"] = "ground-center"
    collection.objects.link(root)
    for piece in list(collection.objects):
        if piece is not root and piece.type == "MESH":
            reparent_preserve_world(piece, root)
    return root


EQUIPMENT_TOKENS = ("blade", "spear", "shield", "halberd", "maul", "crystal", "aura", "quiver", "banner", "chain")


def create_unit_controls(asset_id: str, collection: bpy.types.Collection, root: bpy.types.Object) -> list[bpy.types.Object]:
    controls = []
    for role in ("body", "equipment"):
        control = bpy.data.objects.new(f"{asset_id}-{role}-control", None)
        control.empty_display_type = "CIRCLE" if role == "body" else "ARROWS"
        control.empty_display_size = 0.26 if role == "body" else 0.2
        control.rotation_mode = "XYZ"
        control["rig_role"] = role
        control["rig_type"] = "rigid-control"
        collection.objects.link(control)
        reparent_preserve_world(control, root)
        controls.append(control)
    body_control, equipment_control = controls
    for piece in list(collection.objects):
        if piece.type != "MESH":
            continue
        target = equipment_control if any(token in piece.name for token in EQUIPMENT_TOKENS) else body_control
        reparent_preserve_world(piece, target)
        piece["rig_role"] = target["rig_role"]
    return controls


def attach_nla(target: bpy.types.Object, action: bpy.types.Action, track_name: str) -> None:
    animation_data = target.animation_data_create()
    track = animation_data.nla_tracks.new()
    track.name = track_name
    strip = track.strips.new(track_name, 1, action)
    strip.name = track_name
    strip.action_frame_start = 1
    strip.action_frame_end = 30


def create_asset_actions(
    asset_id: str,
    category: str,
    root: bpy.types.Object,
    controls: list[bpy.types.Object],
) -> list[bpy.types.Action]:
    actions = [
        create_layered_action(asset_id, root, category, clip_name)
        for clip_name in ACTION_CLIPS_BY_CATEGORY[category]
    ]
    if not actions:
        return actions
    root.animation_data_create().action = actions[0]
    for action in actions:
        attach_nla(root, action, action.name)
    for control in controls:
        role = str(control["rig_role"])
        for root_action in actions:
            clip_name = str(root_action["clip_name"])
            control_action = create_transform_action(
                f"{asset_id}__{role}__{clip_name}",
                control,
                clip_name,
                control_keyframes(role, clip_name),
                f"{role.title()} Control",
            )
            control.animation_data_create().action = control_action if clip_name == "Idle" else control.animation_data.action
            attach_nla(control, control_action, root_action.name)
    return actions


def register(
    asset_id: str,
    category: str,
    collection: bpy.types.Collection,
    relative_path: str,
    concept_sources: list[str] | None = None,
    structure_tags: list[str] | None = None,
):
    ground_offset = ground_collection(collection)
    measurements = collection_measurements(collection)
    root = create_asset_root(asset_id, category, collection)
    controls = create_unit_controls(asset_id, collection, root) if category == "unit" else []
    actions = create_asset_actions(asset_id, category, root, controls)
    ASSETS.append(
        {
            "id": asset_id,
            "category": category,
            "collection": collection,
            "root": root,
            "path": relative_path,
            "actions": actions,
            "controls": controls,
            "ground_offset": ground_offset,
            "measurements": measurements,
            "concept_sources": concept_sources or [],
            "structure_tags": structure_tags or [],
        }
    )


def model_shade():
    collection = make_collection("shade", "unit")
    # Tapered back and side cloak tails, a high collar, central torso/front cloak, faceted mask, hood, and curved steel blades.
    panel(collection, "shade-cloak-tails-back", (0, 0.2, 0.5), (0.35, 0.05, 0.9), MATS["ash"], rotation=(math.radians(12), 0, 0), taper=0.7)
    panel(collection, "shade-cloak-tails-left", (-0.2, 0.1, 0.5), (0.25, 0.05, 0.9), MATS["ash"], rotation=(math.radians(12), math.radians(15), 0), taper=0.7)
    panel(collection, "shade-cloak-tails-right", (0.2, 0.1, 0.5), (0.25, 0.05, 0.9), MATS["ash"], rotation=(math.radians(12), math.radians(-15), 0), taper=0.7)
    panel(collection, "shade-torso", (0, 0.05, 1.05), (0.32, 0.22, 0.72), MATS["ash"], taper=(0.8, 0.8))
    panel(collection, "shade-collar", (0, -0.02, 1.45), (0.45, 0.25, 0.18), MATS["obsidian"], taper=(0.8, 0.8))
    cube(collection, "shade-mask", (0, -0.1, 1.7), (0.2, 0.12, 0.24), MATS["void"])
    cube(collection, "shade-visor", (0, -0.17, 1.72), (0.16, 0.04, 0.06), MATS["cyan"])
    panel(collection, "shade-hood", (0, 0.05, 1.95), (0.42, 0.42, 0.5), MATS["obsidian"], taper=(0.1, 0.1), rotation=(math.radians(-10), 0, 0))
    for side, x in (("left", -0.39), ("right", 0.39)):
        angle = 34 if x < 0 else -34
        panel(collection, f"shade-{side}-shoulder", (x * 0.73, 0, 1.48), (0.2, 0.2, 0.35), MATS["obsidian"], taper=0.4, rotation=(0, math.radians(-62 if x < 0 else 62), 0))
        panel(collection, f"shade-{side}-blade", (x, -0.06, 1.13), (0.06, 0.03, 1.0), MATS["steel"], taper=(0.8, 0.8), rotation=(0, math.radians(angle), 0))
        panel(collection, f"shade-{side}-blade-tip", (x * 1.48, -0.06, 1.5), (0.09, 0.02, 0.32), MATS["cyan"], taper=(0.1, 0.1), rotation=(0, math.radians(angle), 0))
    register(
        "shade",
        "unit",
        collection,
        "units/shade.glb",
        concept_sources=["assets/images/ui/concept-tactical-surface.png"],
        structure_tags=["cloak", "mask", "hood", "sickles"]
    )


def model_possessed():
    collection = make_collection("possessed", "unit")
    # Face rift, layered back/side cloak panels, high collar, and gothic cathedral back spires.
    panel(collection, "possessed-collar", (0, -0.02, 1.48), (0.52, 0.32, 0.15), MATS["void"], taper=(1.2, 1.2))
    panel(collection, "possessed-cathedral-spire-left", (-0.32, 0.18, 1.8), (0.1, 0.1, 0.75), MATS["obsidian"], taper=(0.1, 0.1), rotation=(math.radians(-5), math.radians(-10), 0))
    panel(collection, "possessed-cathedral-spire-right", (0.32, 0.18, 1.8), (0.1, 0.1, 0.75), MATS["obsidian"], taper=(0.1, 0.1), rotation=(math.radians(-5), math.radians(10), 0))
    panel(collection, "possessed-cathedral-spire-back", (0.0, 0.24, 1.95), (0.12, 0.12, 0.9), MATS["obsidian"], taper=(0.1, 0.1), rotation=(math.radians(-10), 0, 0))
    cube(collection, "possessed-mask", (0, -0.1, 1.7), (0.24, 0.24, 0.26), MATS["void"])
    cube(collection, "possessed-face-rift", (0, -0.21, 1.7), (0.05, 0.04, 0.28), MATS["cyan"])
    panel(collection, "possessed-hood", (0, 0.03, 2.04), (0.42, 0.42, 0.43), MATS["obsidian"], taper=(0.1, 0.1))
    torus(collection, "possessed-aura", (0, 0.17, 1.42), 0.58, 0.035, MATS["violet"], rotation=(math.radians(90), 0, 0), major_segments=16)
    panel(collection, "possessed-cloak-left", (-0.25, 0.08, 0.65), (0.32, 0.06, 1.2), MATS["void"], taper=0.6, rotation=(0, math.radians(-8), 0))
    panel(collection, "possessed-cloak-right", (0.25, 0.08, 0.65), (0.32, 0.06, 1.2), MATS["void"], taper=0.6, rotation=(0, math.radians(8), 0))
    panel(collection, "possessed-cloak-back", (0, 0.2, 0.6), (0.42, 0.06, 1.2), MATS["void"], taper=0.6)
    for index, (x, y, z, radius) in enumerate(((-0.48, 0.04, 1.15, 0.13), (0.39, 0.0, 1.34, 0.2), (0.52, 0.12, 0.92, 0.11))):
        panel(collection, f"possessed-crystal-{index}", (x, y, z), (radius * 2, radius * 2, radius * 3.0), MATS["cyan"], taper=(0.0, 0.0), rotation=(0, math.radians(-18 if x < 0 else 18), 0))
    for index, x in enumerate((-0.24, 0.28)):
        cylinder(collection, f"possessed-chain-{index}", (x, 0.24, 0.55), 0.025, 0.82, MATS["gold"], vertices=6, rotation=(math.radians(13), math.radians(-8 if x < 0 else 10), 0))
    register(
        "possessed",
        "unit",
        collection,
        "units/possessed.glb",
        concept_sources=["assets/images/characters/dusk-legion-source.png"],
        structure_tags=["cloak", "mask", "rift", "crystals", "halo", "chains"]
    )


def model_scout():
    collection = make_collection("scout", "unit")
    # Low silhouette, forward visor, crest, and triple-panel back cape with a single spear.
    panel(collection, "scout-body", (0, 0.02, 0.88), (0.42, 0.32, 0.75), MATS["steel"], taper=(0.7, 0.7))
    ico(collection, "scout-head", (0, -0.02, 1.5), 0.2, MATS["void"])
    cube(collection, "scout-visor", (0, -0.18, 1.52), (0.24, 0.03, 0.08), MATS["ember"])
    panel(collection, "scout-crest", (0, 0.02, 1.76), (0.08, 0.25, 0.32), MATS["ember"], taper=(0.2, 0.2), rotation=(math.radians(-15), 0, 0))
    panel(collection, "scout-cape-back", (0.0, 0.22, 0.95), (0.4, 0.04, 0.9), MATS["ash"], taper=0.7, rotation=(math.radians(20), 0, 0))
    panel(collection, "scout-cape-left", (-0.18, 0.18, 0.95), (0.24, 0.04, 0.82), MATS["ash"], taper=0.7, rotation=(math.radians(20), math.radians(12), 0))
    panel(collection, "scout-cape-right", (0.18, 0.18, 0.95), (0.24, 0.04, 0.82), MATS["ash"], taper=0.7, rotation=(math.radians(20), math.radians(-12), 0))
    for index, x in enumerate((-0.18, 0.18)):
        cylinder(collection, f"scout-leg-{index}", (x, 0, 0.35), 0.05, 0.7, MATS["steel"], vertices=6, rotation=(0, math.radians(-10 if x < 0 else 10), 0))
    cylinder(collection, "scout-spear", (0.46, -0.04, 1.08), 0.03, 1.58, MATS["steel"], vertices=6, rotation=(0, math.radians(-18), 0))
    panel(collection, "scout-spear-tip", (0.71, -0.04, 1.82), (0.12, 0.04, 0.42), MATS["ember"], taper=(0.0, 0.0), rotation=(0, math.radians(-18), 0))
    cylinder(collection, "scout-quiver", (-0.23, 0.2, 1.12), 0.08, 0.68, MATS["ash"], vertices=6, rotation=(math.radians(8), math.radians(-12), 0))
    register(
        "scout",
        "unit",
        collection,
        "units/scout.glb",
        concept_sources=["assets/images/ui/concept-tactical-surface.png"],
        structure_tags=["visor", "crest", "spear", "quiver", "cape"]
    )


def model_guard():
    collection = make_collection("guard", "unit")
    # Plated sentinel, octagonal tower shield, halberd, gold chest chevron, simple planted legs/boots, and side tassets.
    cube(collection, "guard-body", (0, 0.02, 1.05), (0.64, 0.38, 0.9), MATS["steel"], bevel=0.04)
    panel(collection, "guard-chest-chevron", (0.0, -0.21, 1.12), (0.28, 0.05, 0.22), MATS["gold"], taper=(1.2, 0.8), rotation=(math.radians(10), 0, 0))
    panel(collection, "guard-tasset-left", (-0.38, 0.05, 0.56), (0.25, 0.12, 0.52), MATS["steel"], taper=(0.7, 0.7), rotation=(0, math.radians(-15), 0))
    panel(collection, "guard-tasset-right", (0.38, 0.05, 0.56), (0.25, 0.12, 0.52), MATS["steel"], taper=(0.7, 0.7), rotation=(0, math.radians(15), 0))
    for side, x in (("left", -0.42), ("right", 0.42)):
        panel(collection, f"guard-{side}-pauldron", (x, 0.02, 1.42), (0.24, 0.24, 0.26), MATS["gold"], taper=(0.8, 0.8))
    for index, x in enumerate((-0.18, 0.18)):
        cylinder(collection, f"guard-leg-{index}", (x, 0, 0.32), 0.08, 0.64, MATS["steel"], vertices=6)
        cube(collection, f"guard-boot-{index}", (x, -0.06, 0.08), (0.22, 0.35, 0.16), MATS["obsidian"])
    cube(collection, "guard-helm", (0, -0.02, 1.68), (0.26, 0.26, 0.26), MATS["obsidian"], bevel=0.03)
    cube(collection, "guard-faceplate", (0, -0.16, 1.68), (0.28, 0.04, 0.16), MATS["steel"])
    panel(collection, "guard-helm-crest", (0, 0.02, 1.95), (0.06, 0.22, 0.32), MATS["gold"], taper=(0.2, 0.2))
    panel(collection, "guard-shield", (-0.56, -0.15, 1.0), (0.68, 0.08, 1.15), MATS["obsidian"], taper=(0.95, 0.95))
    panel(collection, "guard-shield-rim", (-0.56, -0.2, 1.0), (0.74, 0.04, 1.2), MATS["gold"], taper=(0.95, 0.95))
    cube(collection, "guard-shield-boss", (-0.56, -0.24, 1.0), (0.18, 0.06, 0.18), MATS["cyan"])
    cylinder(collection, "guard-halberd", (0.54, 0.02, 1.14), 0.04, 1.72, MATS["steel"], vertices=8, rotation=(0, math.radians(-8), 0))
    panel(collection, "guard-halberd-blade", (0.68, 0.02, 1.95), (0.24, 0.03, 0.46), MATS["gold"], taper=(0.1, 0.1), rotation=(0, math.radians(-8), 0))
    register(
        "guard",
        "unit",
        collection,
        "units/guard.glb",
        concept_sources=[
            "assets/images/ui/boss-cinder-warden.png",
            "assets/images/resource-refinement/gti/abyssal-surge-resource-forging-hero-frame.png"
        ],
        structure_tags=["shield", "halberd", "chevron", "tassets", "pauldron"]
    )


def model_reinforce():
    collection = make_collection("reinforce", "unit")
    # Humanoid armored brute with helm, chest rift, massive shoulders, side tassets, and lateral maul.
    cube(collection, "reinforce-helm", (0, -0.02, 2.05), (0.34, 0.34, 0.34), MATS["obsidian"], bevel=0.04)
    panel(collection, "reinforce-horn-0", (-0.22, 0.02, 2.38), (0.11, 0.11, 0.62), MATS["bone"], taper=(0.0, 0.0), rotation=(0, math.radians(-25), 0))
    panel(collection, "reinforce-horn-1", (0.22, 0.02, 2.38), (0.11, 0.11, 0.62), MATS["bone"], taper=(0.0, 0.0), rotation=(0, math.radians(25), 0))
    cube(collection, "reinforce-chest-rift", (0.0, -0.29, 1.48), (0.1, 0.05, 0.42), MATS["ember"])
    panel(collection, "reinforce-tasset-left", (-0.42, 0.05, 0.88), (0.32, 0.15, 0.58), MATS["steel"], taper=(0.7, 0.7), rotation=(0, math.radians(-12), 0))
    panel(collection, "reinforce-tasset-right", (0.42, 0.05, 0.88), (0.32, 0.15, 0.58), MATS["steel"], taper=(0.7, 0.7), rotation=(0, math.radians(12), 0))
    panel(collection, "reinforce-torso-upper", (0, 0.02, 1.52), (0.76, 0.48, 0.64), MATS["steel"], taper=(0.85, 0.85))
    panel(collection, "reinforce-torso-lower", (0, 0.02, 1.05), (0.64, 0.42, 0.45), MATS["steel"], taper=(1.1, 1.1))
    cube(collection, "reinforce-belt", (0, 0.01, 0.82), (0.78, 0.46, 0.12), MATS["gold"], bevel=0.02)
    cylinder(collection, "reinforce-upper-leg-left", (-0.28, 0.02, 0.62), 0.13, 0.42, MATS["obsidian"], vertices=6, rotation=(0, math.radians(-8), 0))
    cylinder(collection, "reinforce-upper-leg-right", (0.28, 0.02, 0.62), 0.13, 0.42, MATS["obsidian"], vertices=6, rotation=(0, math.radians(8), 0))
    cylinder(collection, "reinforce-lower-leg-left", (-0.32, -0.02, 0.32), 0.11, 0.42, MATS["steel"], vertices=6)
    cylinder(collection, "reinforce-lower-leg-right", (0.32, -0.02, 0.32), 0.11, 0.42, MATS["steel"], vertices=6)
    cube(collection, "reinforce-boot-left", (-0.35, -0.1, 0.11), (0.28, 0.48, 0.22), MATS["steel"], bevel=0.03)
    cube(collection, "reinforce-boot-right", (0.35, -0.1, 0.11), (0.28, 0.48, 0.22), MATS["steel"], bevel=0.03)
    for side, x in (("left", -0.52), ("right", 0.52)):
        panel(collection, f"reinforce-{side}-shoulder", (x, 0.02, 1.68), (0.34, 0.34, 0.34), MATS["steel"], taper=(0.7, 0.7))
    cylinder(collection, "reinforce-maul-shaft", (0.58, -0.06, 1.05), 0.05, 1.92, MATS["steel"], vertices=8, rotation=(0, math.radians(-15), 0))
    panel(collection, "reinforce-maul-head", (0.86, -0.08, 1.82), (0.42, 0.42, 0.64), MATS["ember"], taper=(0.8, 0.8), rotation=(0, math.radians(-15), 0))
    register(
        "reinforce",
        "unit",
        collection,
        "units/reinforce.glb",
        concept_sources=[
            "assets/images/ui/boss-cinder-warden.png",
            "assets/images/resource-refinement/gti/abyssal-surge-resource-forging-hero-frame.png"
        ],
        structure_tags=["helm", "rift", "maul", "tassets", "brute"]
    )


def model_cinder_warden():
    collection = make_collection("cinder-warden", "boss")
    # Plated volcanic knight with helm, chest rift, wrapping mantle plates, and gold staff.
    cube(collection, "warden-helm", (0, -0.02, 2.38), (0.38, 0.38, 0.42), MATS["obsidian"], bevel=0.05)
    panel(collection, "warden-helm-crest", (0, 0.05, 2.72), (0.08, 0.32, 0.38), MATS["ember"], taper=(0.2, 0.2))
    cube(collection, "warden-chest-rift", (0.0, -0.32, 1.65), (0.12, 0.06, 0.52), MATS["ember"])
    panel(collection, "warden-mantle-left", (-0.55, 0.02, 2.05), (0.38, 0.38, 0.35), MATS["obsidian"], taper=(0.6, 0.6), rotation=(0, math.radians(-15), 0))
    panel(collection, "warden-mantle-right", (0.55, 0.02, 2.05), (0.38, 0.38, 0.35), MATS["obsidian"], taper=(0.6, 0.6), rotation=(0, math.radians(15), 0))
    panel(collection, "warden-mantle-back", (0.0, 0.28, 2.08), (0.75, 0.25, 0.45), MATS["obsidian"], taper=(0.8, 0.8))
    panel(collection, "warden-torso-upper", (0, 0.02, 1.65), (0.82, 0.52, 0.68), MATS["steel"], taper=(0.8, 0.8))
    panel(collection, "warden-robe-left", (-0.38, 0.1, 0.88), (0.42, 0.15, 1.55), MATS["ember"], taper=0.6, rotation=(0, math.radians(-10), 0))
    panel(collection, "warden-robe-right", (0.38, 0.1, 0.88), (0.42, 0.15, 1.55), MATS["ember"], taper=0.6, rotation=(0, math.radians(10), 0))
    panel(collection, "warden-robe-back", (0, 0.25, 0.85), (0.58, 0.15, 1.55), MATS["ember"], taper=0.6)
    torus(collection, "warden-fire-ring", (0, 0.22, 1.45), 0.93, 0.05, MATS["ember"], rotation=(math.radians(90), 0, 0), major_segments=16)
    cylinder(collection, "warden-staff", (0.88, 0, 1.35), 0.06, 2.55, MATS["gold"], rotation=(0, math.radians(-15), 0))
    panel(collection, "warden-staff-head", (1.28, 0, 2.45), (0.35, 0.12, 0.55), MATS["ember"], taper=(0.1, 0.1), rotation=(0, math.radians(-15), 0))
    register(
        "cinder-warden",
        "boss",
        collection,
        "bosses/cinder-warden.glb",
        concept_sources=["assets/images/ui/boss-cinder-warden.png"],
        structure_tags=["helm", "rift", "mantle", "staff", "robe"]
    )


def model_veil_tactician():
    collection = make_collection("veil-tactician", "boss")
    # Hooded faceted-mask caster with mask runes, scepter, and magic sigil rings.
    cube(collection, "tactician-mask", (0, -0.16, 2.15), (0.32, 0.15, 0.42), MATS["gold"], bevel=0.04)
    cube(collection, "tactician-mask-rune-center", (0.0, -0.24, 2.15), (0.045, 0.03, 0.26), MATS["cyan"])
    cube(collection, "tactician-mask-rune-left", (-0.075, -0.24, 2.2), (0.04, 0.03, 0.12), MATS["cyan"], rotation=(0, 0, math.radians(-18)))
    cube(collection, "tactician-mask-rune-right", (0.075, -0.24, 2.2), (0.04, 0.03, 0.12), MATS["cyan"], rotation=(0, 0, math.radians(18)))
    panel(collection, "tactician-hood", (0, 0.05, 2.45), (0.56, 0.52, 0.58), MATS["void"], taper=(0.2, 0.2), rotation=(math.radians(-8), 0, 0))
    panel(collection, "tactician-collar", (0, -0.02, 1.88), (0.64, 0.38, 0.18), MATS["void"], taper=(1.1, 1.1))
    panel(collection, "tactician-robe-left", (-0.35, 0.08, 0.95), (0.45, 0.15, 1.7), MATS["violet"], taper=0.5, rotation=(0, math.radians(-12), 0))
    panel(collection, "tactician-robe-right", (0.35, 0.08, 0.95), (0.45, 0.15, 1.7), MATS["violet"], taper=0.5, rotation=(0, math.radians(12), 0))
    panel(collection, "tactician-robe-back", (0, 0.22, 0.9), (0.6, 0.15, 1.7), MATS["violet"], taper=0.5)
    torus(collection, "tactician-sigil-0", (0, 0.18, 1.4), 0.85, 0.03, MATS["cyan"], rotation=(math.radians(90), 0, 0), major_segments=12)
    torus(collection, "tactician-sigil-1", (0, 0.18, 1.75), 0.7, 0.03, MATS["cyan"], rotation=(math.radians(90), 0, 0), major_segments=12)
    cylinder(collection, "tactician-scepter", (-0.88, 0, 1.38), 0.055, 2.65, MATS["steel"], rotation=(0, math.radians(15), 0))
    panel(collection, "tactician-scepter-head", (-1.22, 0, 2.48), (0.28, 0.28, 0.42), MATS["gold"], taper=(0.2, 0.2), rotation=(0, math.radians(15), 0))
    ico(collection, "tactician-scepter-core", (-1.22, 0, 2.68), 0.15, MATS["cyan"])
    register(
        "veil-tactician",
        "boss",
        collection,
        "bosses/veil-tactician.glb",
        concept_sources=["assets/images/ui/boss-veil-tactician.png"],
        structure_tags=["mask", "runes", "hood", "scepter", "sigils"]
    )


def model_gate_sovereign():
    collection = make_collection("gate-sovereign", "boss")
    # Cathedral-gate headdress, face/face-rift, pointed cathedral arch peak/spires with tall restrained ember vertical rift, and crown.
    cube(collection, "sovereign-face", (0, -0.15, 2.32), (0.35, 0.15, 0.45), MATS["gold"], bevel=0.03)
    cube(collection, "sovereign-face-rift", (0.0, -0.23, 2.32), (0.08, 0.03, 0.24), MATS["violet"])
    panel(collection, "sovereign-gate-arch-left", (-0.46, 0.1, 1.95), (0.18, 0.18, 1.5), MATS["obsidian"], taper=(0.85, 0.85))
    panel(collection, "sovereign-gate-arch-right", (0.46, 0.1, 1.95), (0.18, 0.18, 1.5), MATS["obsidian"], taper=(0.85, 0.85))
    panel(collection, "sovereign-gate-arch-top-left", (-0.24, 0.1, 2.92), (0.18, 0.18, 0.64), MATS["obsidian"], taper=(0.5, 0.5), rotation=(0, math.radians(-35), 0))
    panel(collection, "sovereign-gate-arch-top-right", (0.24, 0.1, 2.92), (0.18, 0.18, 0.64), MATS["obsidian"], taper=(0.5, 0.5), rotation=(0, math.radians(35), 0))
    panel(collection, "sovereign-gate-arch-spire", (0.0, 0.1, 3.25), (0.12, 0.12, 0.52), MATS["obsidian"], taper=(0.1, 0.1))
    cube(collection, "sovereign-gate-rift", (0.0, 0.05, 2.05), (0.28, 0.04, 1.35), MATS["ember"])
    panel(collection, "sovereign-crown-center", (0.0, -0.05, 2.68), (0.15, 0.15, 0.45), MATS["gold"], taper=(0.1, 0.1))
    panel(collection, "sovereign-crown-left", (-0.22, -0.05, 2.62), (0.1, 0.1, 0.38), MATS["gold"], taper=(0.1, 0.1), rotation=(0, math.radians(-15), 0))
    panel(collection, "sovereign-crown-right", (0.22, -0.05, 2.62), (0.1, 0.1, 0.38), MATS["gold"], taper=(0.1, 0.1), rotation=(0, math.radians(15), 0))
    cube(collection, "sovereign-torso", (0, 0.02, 1.25), (1.1, 0.64, 1.35), MATS["obsidian"], bevel=0.08)
    panel(collection, "sovereign-robe-back", (0.0, 0.25, 0.55), (0.68, 0.1, 1.1), MATS["obsidian"], taper=0.6)
    panel(collection, "sovereign-robe-left", (-0.32, 0.12, 0.55), (0.42, 0.1, 1.1), MATS["obsidian"], taper=0.6, rotation=(0, math.radians(-10), 0))
    panel(collection, "sovereign-robe-right", (0.32, 0.12, 0.55), (0.42, 0.1, 1.1), MATS["obsidian"], taper=0.6, rotation=(0, math.radians(10), 0))
    panel(collection, "sovereign-wing-left", (-1.1, 0.08, 1.82), (0.75, 0.12, 1.45), MATS["void"], taper=0.6, rotation=(0, math.radians(-25), 0))
    panel(collection, "sovereign-wing-right", (1.1, 0.08, 1.82), (0.75, 0.12, 1.45), MATS["void"], taper=0.6, rotation=(0, math.radians(25), 0))
    torus(collection, "sovereign-wing-rift-left", (-1.1, 0.0, 1.95), 0.36, 0.04, MATS["violet"], rotation=(math.radians(90), 0, 0))
    torus(collection, "sovereign-wing-rift-right", (1.1, 0.0, 1.95), 0.36, 0.04, MATS["violet"], rotation=(math.radians(90), 0, 0))
    cube(collection, "sovereign-blade", (1.15, 0, 1.22), (0.15, 0.12, 2.45), MATS["steel"], rotation=(0, math.radians(-15), 0))
    register(
        "gate-sovereign",
        "boss",
        collection,
        "bosses/gate-sovereign.glb",
        concept_sources=["assets/images/ui/boss-gate-sovereign.png"],
        structure_tags=["face", "gate-arch", "gate-rift", "crown", "wings"]
    )

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
    # Runtime terrain is normalized to a 22-unit horizontal span. Author these
    # slabs directly in that frame so they coincide with the Stage 3 grid:
    # base floor, x=11–12 ascent, then x=13–15 throne platform.
    slab_depth = 0.002
    cube(
        collection,
        "throne-low-floor",
        (0, 0, slab_depth / 2),
        (22.0, 8.0, slab_depth),
        MATS["obsidian"],
        bevel=0.0,
    )
    cube(
        collection,
        "throne-first-platform",
        (4.0, 0, 0.42 - slab_depth / 2),
        (2.0, 4.0, slab_depth),
        MATS["obsidian"],
        bevel=0.0,
    )
    cube(
        collection,
        "throne-dais",
        (6.5, 0, 0.84 - slab_depth / 2),
        (3.0, 4.0, slab_depth),
        MATS["gold"],
        bevel=0.0,
    )
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


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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

bpy.context.preferences.filepaths.save_version = 0
source_blend = OUTPUT / "abyssal-command-resource-pack.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(source_blend))

manifest = {
    "version": 2,
    "pack": "abyssal-command-low-poly",
    "source": source_blend.name,
    "sourceSha256": sha256_file(source_blend),
    "coordinateSystem": "Blender Z-up; ground-center pivots; authored forward is -Y",
    "rendering": "Flat-shaded PBR GLB resources with embedded albedo and tangent-space normal textures; no external texture URLs",
    "build": {
        "cycle": "20260719-concept-silhouette-polish",
        "generator": "scripts/build_abyssal_command_assets.py",
        "method": "Headless Blender procedural low-poly assembly aligned with concept source silhouettes and readable negative space",
        "recipe": "Generate concept-derived UV0 primitives (including tapered panels for armor/capes/arches); construct unique layered silhouettes for units and bosses; restrain emissive accents; parent unit pieces to body/equipment controls; export collections as GLB with NLA tracks, tangents, and embedded textures.",
        "blenderFps": 30,
    },
    "textures": {
        "embeddedInGlb": True,
        "uvSet": "UV0",
        "normalMapSpace": "tangent",
        "resources": [
            {
                "family": family,
                "albedo": str(resources["albedo"].relative_to(OUTPUT)),
                "albedoSha256": sha256_file(resources["albedo"]),
                "normal": str(resources["normal"].relative_to(OUTPUT)),
                "normalSha256": sha256_file(resources["normal"]),
            }
            for family, resources in TEXTURE_RESOURCES.items()
        ],
    },
    "assets": [
        {
            "id": asset["id"],
            "category": asset["category"],
            "path": asset["path"],
            "sha256": sha256_file(OUTPUT / asset["path"]),
            "pivot": "ground-center",
            "groundOffsetApplied": round(asset["ground_offset"], 6),
            "measurements": asset["measurements"],
            "textureFamilies": texture_families_for(asset["collection"]),
            "conceptSources": asset["concept_sources"],
            "structureTags": asset["structure_tags"],
            "actions": [action.name for action in asset["actions"]],
            "actionClips": [action["clip_name"] for action in asset["actions"]],
            "rig": {
                "type": "rigid-control" if asset["controls"] else "root-transform",
                "controls": [control.name for control in asset["controls"]],
                "animation": "root plus secondary body/equipment transforms" if asset["controls"] else "root transform",
            },
        }
        for asset in ASSETS
    ],
}
(OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(f"ABYSSAL_COMMAND_RESOURCE_PACK_READY assets={len(ASSETS)} output={OUTPUT}")
