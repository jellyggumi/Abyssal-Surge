"""Blender headless: build the 6 Abyssal Command battle-unit models as .blend files.

Dark-fantasy low-poly style (target 500-900 tris per unit), built entirely from
bpy primitives. Each unit is saved as its own .blend (default: tmp/units/) so it
can be rendered with scripts/render-8dir-atlas.py into an 8-direction dimetric
sprite strip.

Style contract (from the sprite-pipeline design):
- strong silhouette, deliberate asymmetry (weapon / cape / tail) so the 8
  camera yaws are visually distinguishable
- Principled BSDF everywhere; only palette accents use emission, all other
  albedo stays dark (0.02-0.08)
- per-unit lighting baked into the blend: cold blue-white key (upper 45 deg)
  + palette-colored rim from behind; render script adds camera + pivot only
- model faces -Y (toward the dir0 camera), bounding box recentered on the
  origin and normalized to a common max dimension so every unit fills the
  frame consistently

Usage:
  Blender --background --python scripts/build-unit-models.py -- \
      --out /abs/dir [--units shade,possessed,scout,guard,reinforce,sovereign]
"""

import math
import os
import sys

import bpy

# ---------------------------------------------------------------------------
# palette (game palette, used raw as linear emission color - stylized glow)
# ---------------------------------------------------------------------------
EMERALD = (0.439, 0.898, 0.816, 1.0)  # #70e5d0 - ally / gate energy
GOLD = (1.0, 0.941, 0.643, 1.0)       # #fff0a4 - possession
RED = (1.0, 0.498, 0.475, 1.0)        # #ff7f79 - enemy
VIOLET = (0.67, 0.41, 1.0, 1.0)       # sovereign rim (matches lobby art)

TARGET_MAX_DIM = 4.4  # normalized model size; render script frames max_dim*1.6


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def obj():
    return bpy.context.object


def dark_mat(name, base=(0.035, 0.04, 0.06), rough=0.55, metal=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    return mat


def glow_mat(name, color, strength=6.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Emission Color"].default_value = color
    bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def paint(o, mat):
    o.data.materials.append(mat)
    return o


def join_all(name):
    """Join every mesh into one object, apply transforms, recenter + normalize."""
    meshes = [o for o in bpy.context.collection.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    unit = bpy.context.object
    unit.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    verts = unit.data.vertices
    lo = [min(v.co[i] for v in verts) for i in range(3)]
    hi = [max(v.co[i] for v in verts) for i in range(3)]
    center = [(lo[i] + hi[i]) / 2 for i in range(3)]
    max_dim = max(hi[i] - lo[i] for i in range(3))
    s = TARGET_MAX_DIM / max_dim
    for v in verts:
        v.co = tuple((v.co[i] - center[i]) * s for i in range(3))
    return unit


def add_lights(rim_color):
    key_data = bpy.data.lights.new("key", type="AREA")
    key_data.energy = 1150
    key_data.size = 5
    key_data.color = (0.62, 0.76, 1.0)  # cold blue-white
    key = bpy.data.objects.new("key", key_data)
    key.location = (-3.4, -4.0, 5.4)  # upper 45 deg, front-left
    key.rotation_euler = (math.radians(48), 0, math.radians(-38))
    bpy.context.collection.objects.link(key)

    rim_data = bpy.data.lights.new("rim", type="AREA")
    rim_data.energy = 1500
    rim_data.size = 6
    rim_data.color = rim_color[:3]
    rim = bpy.data.objects.new("rim", rim_data)
    rim.location = (2.8, 3.6, 4.0)  # behind the unit (units face -Y)
    rim.rotation_euler = (math.radians(58), 0, math.radians(142))
    bpy.context.collection.objects.link(rim)

    fill_data = bpy.data.lights.new("fill", type="AREA")
    fill_data.energy = 260
    fill_data.size = 8
    fill_data.color = (0.8, 0.85, 1.0)
    fill = bpy.data.objects.new("fill", fill_data)
    fill.location = (0, -6.0, 2.2)
    fill.rotation_euler = (math.radians(80), 0, 0)
    bpy.context.collection.objects.link(fill)

    world = bpy.data.worlds.new("void")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.004, 0.005, 0.012, 1)
    bpy.context.scene.world = world

    # Stylized sprites: Standard view transform (AgX desaturates the palette
    # emission to white). Saved in the .blend, honored by the render script.
    bpy.context.scene.view_settings.view_transform = "Standard"


# ---------------------------------------------------------------------------
# unit builders (all face -Y = toward the dir0 camera)
# ---------------------------------------------------------------------------

def build_shade_family(possessed=False):
    """Hooded shadow soldier. possessed=True: bulkier + gold aura rings."""
    body = dark_mat("ShadeBody", (0.03, 0.035, 0.055), rough=0.7)
    cloth = dark_mat("ShadeCloth", (0.02, 0.025, 0.04), rough=0.85)
    steel = dark_mat("ShadeSteel", (0.07, 0.075, 0.09), rough=0.35, metal=0.8)
    void = dark_mat("FaceVoid", (0.005, 0.005, 0.01), rough=1.0)
    eye_color, eye_strength = (GOLD, 1.3) if possessed else (EMERALD, 1.3)
    eyes = glow_mat("EyeGlow", eye_color, eye_strength)

    w = 1.18 if possessed else 1.0  # possessed: broader build

    # robe (cone) - base of the silhouette
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.85 * w, radius2=0.34 * w,
                                    depth=2.4, location=(0, 0, 1.2))
    paint(obj(), cloth)
    # chest
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.52 * w,
                                          location=(0, -0.02, 2.35),
                                          scale=(1, 0.8, 0.9))
    paint(obj(), body)
    # hood (organic, denser)
    hood_sub = 2 if possessed else 3
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=hood_sub, radius=0.46 * w,
                                          location=(0, -0.04, 2.95),
                                          scale=(1, 1.05, 1.18))
    paint(obj(), cloth)
    # face void (dark inset so the eyes float)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.3 * w,
                                          location=(0, -0.3, 2.9))
    paint(obj(), void)
    # eyes
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=0.08 * w,
                                             location=(sx * 0.14 * w, -(0.3 + 0.28 * w), 2.92))
        paint(obj(), eyes)
    # short sword, right hand, angled forward (main asymmetry cue)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.72 * w, -0.42, 1.75),
                                    rotation=(math.radians(-38), 0, math.radians(8)),
                                    scale=(0.07, 0.07, 1.15))
    paint(obj(), steel)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.72 * w, -0.14, 1.42),
                                    rotation=(math.radians(-38), 0, 0),
                                    scale=(0.3, 0.09, 0.09))
    paint(obj(), steel)
    # cape spike over the left shoulder (counter-asymmetry)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.48 * w, radius2=0.08,
                                    depth=1.5, location=(-0.6 * w, 0.18, 2.1),
                                    rotation=(0, math.radians(18), 0),
                                    scale=(1, 0.55, 1))
    paint(obj(), cloth)

    if possessed:
        aura = glow_mat("AuraGold", GOLD, 1.3)
        # horizontal possession ring around the waist
        bpy.ops.mesh.primitive_torus_add(major_radius=0.95 * w, minor_radius=0.05,
                                         major_segments=20, minor_segments=6,
                                         location=(0, 0, 1.55))
        paint(obj(), aura)
        # halo behind the hood
        bpy.ops.mesh.primitive_torus_add(major_radius=0.5, minor_radius=0.04,
                                         major_segments=16, minor_segments=6,
                                         location=(0, 0.28, 3.15),
                                         rotation=(math.radians(90), 0, 0))
        paint(obj(), aura)

    return join_all("possessed" if possessed else "shade")


def build_scout():
    """Lean quadruped horror, low stance, red eyes."""
    hide = dark_mat("ScoutHide", (0.045, 0.03, 0.035), rough=0.75)
    bone = dark_mat("ScoutBone", (0.08, 0.07, 0.065), rough=0.5)
    eyes = glow_mat("EyeGlow", RED, 1.3)

    # long low body
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.8,
                                          location=(0, 0.1, 0.85),
                                          scale=(0.65, 1.5, 0.55))
    paint(obj(), hide)
    # shoulder blades jutting up (silhouette)
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.3,
                                              location=(sx * 0.35, -0.55, 1.25),
                                              scale=(0.6, 0.8, 1.1))
        paint(obj(), bone)
    # head: tapered snout pointing -Y
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.36, radius2=0.05,
                                    depth=1.0, location=(0, -1.45, 0.9),
                                    rotation=(math.radians(95), 0, 0))
    paint(obj(), hide)
    # ears
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.09, radius2=0.0,
                                        depth=0.4, location=(sx * 0.18, -0.95, 1.25),
                                        rotation=(math.radians(20), sx * 0.3, 0))
        paint(obj(), bone)
    # eyes
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=0.07,
                                             location=(sx * 0.19, -1.3, 1.08))
        paint(obj(), eyes)
    # legs (splayed, predatory)
    for sx in (-1, 1):
        for sy, z_rot in ((-0.75, 0.25), (0.85, -0.2)):
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.08, depth=0.95,
                                                location=(sx * 0.48, sy, 0.45),
                                                rotation=(0, sx * 0.28, z_rot))
            paint(obj(), hide)
    # spine ridge
    for i, sy in enumerate((-0.35, 0.15, 0.65)):
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.1, radius2=0.0,
                                        depth=0.35 + 0.08 * i,
                                        location=(0.04, sy, 1.35),
                                        rotation=(math.radians(15), 0, 0))
        paint(obj(), bone)
    # tail curving up-right (asymmetry cue)
    bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.12, radius2=0.01,
                                    depth=1.3, location=(0.25, 1.55, 1.15),
                                    rotation=(math.radians(52), math.radians(12), 0))
    paint(obj(), hide)
    return join_all("scout")


def build_guard():
    """Heavy bipedal warrior: shield left, mace right, dark iron plate."""
    iron = dark_mat("GuardIron", (0.04, 0.045, 0.06), rough=0.4, metal=0.9)
    plate = dark_mat("GuardPlate", (0.055, 0.06, 0.075), rough=0.35, metal=0.9)
    cloth = dark_mat("GuardCloth", (0.025, 0.028, 0.04), rough=0.9)
    eyes = glow_mat("EyeGlow", RED, 1.3)

    # torso + pelvis
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 2.25), scale=(1.5, 1.0, 1.75))
    paint(obj(), iron)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.3), scale=(1.15, 0.85, 0.6))
    paint(obj(), cloth)
    # skirt plates
    for sx in (-0.45, 0.45):
        for sy in (-0.35, 0.35):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(sx, sy, 0.95),
                                            scale=(0.35, 0.12, 0.55))
            paint(obj(), plate)
    # legs + knees
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.23, depth=1.25,
                                            location=(sx * 0.38, 0, 0.62))
        paint(obj(), iron)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.2,
                                              location=(sx * 0.38, -0.12, 0.85))
        paint(obj(), plate)
    # helmet + fore-aft crest + eye slit
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 3.45), scale=(0.85, 0.9, 0.85))
    paint(obj(), plate)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 3.95), scale=(0.12, 1.0, 0.5))
    paint(obj(), iron)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.52, 3.5), scale=(0.6, 0.1, 0.1))
    paint(obj(), eyes)
    # pauldrons
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.42,
                                              location=(sx * 0.88, 0, 3.05),
                                              scale=(1, 0.85, 0.7))
        paint(obj(), plate)
    # shield (left side, disc facing outward)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.78, depth=0.12,
                                        location=(-1.22, -0.15, 2.0),
                                        rotation=(0, math.radians(90), 0))
    paint(obj(), plate)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.17,
                                          location=(-1.32, -0.15, 2.0))
    paint(obj(), iron)
    # mace (right side, angled forward)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.06, depth=1.4,
                                        location=(1.05, -0.35, 2.3),
                                        rotation=(math.radians(-32), 0, 0))
    paint(obj(), iron)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(1.05, -0.75, 2.88),
                                    scale=(0.34, 0.34, 0.34))
    paint(obj(), plate)
    for i in range(4):
        a = i / 4 * math.tau
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.07, radius2=0.0, depth=0.3,
                                        location=(1.05 + math.cos(a) * 0.24, -0.75,
                                                  2.88 + math.sin(a) * 0.24),
                                        rotation=(0, a + math.radians(90), 0))
        paint(obj(), iron)
    return join_all("guard")


def build_reinforce():
    """Massive armored beast: carapace shell, back spikes, 2HP presence."""
    hide = dark_mat("ReinfHide", (0.04, 0.035, 0.05), rough=0.7)
    shell = dark_mat("ReinfShell", (0.05, 0.055, 0.07), rough=0.35, metal=0.7)
    eyes = glow_mat("EyeGlow", RED, 1.3)

    # bulky body
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.3,
                                          location=(0, 0.1, 1.25),
                                          scale=(1.05, 1.35, 0.8))
    paint(obj(), hide)
    # carapace shell (chunky low-poly dome)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.32,
                                          location=(0, 0.15, 1.55),
                                          scale=(1.12, 1.3, 0.72))
    paint(obj(), shell)
    # head + jaw (facing -Y)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -1.75, 1.0),
                                    scale=(0.9, 0.9, 0.75))
    paint(obj(), hide)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -2.0, 0.7),
                                    scale=(0.7, 0.6, 0.25))
    paint(obj(), shell)
    # eyes
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=0.09,
                                             location=(sx * 0.28, -2.2, 1.15))
        paint(obj(), eyes)
    # back spike row (biggest at rear -> readable facing)
    for i, sy in enumerate((-0.9, -0.45, 0.0, 0.45, 0.9, 1.3)):
        depth = 0.7 + 0.18 * i
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.2, radius2=0.0,
                                        depth=depth,
                                        location=(0.05 * (1 if i % 2 else -1), sy,
                                                  2.35 + depth / 2),
                                        rotation=(math.radians(8), 0, 0))
        paint(obj(), shell)
    # side spikes (right flank only - asymmetry)
    for sy in (-0.4, 0.5):
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.13, radius2=0.0, depth=0.7,
                                        location=(1.45, sy, 1.6),
                                        rotation=(0, math.radians(75), 0))
        paint(obj(), shell)
    # legs
    for sx in (-1, 1):
        for sy in (-0.85, 0.95):
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.3, depth=1.0,
                                                location=(sx * 0.75, sy, 0.5))
            paint(obj(), hide)
    # tail club
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.38,
                                          location=(-0.1, 2.0, 0.9))
    paint(obj(), shell)
    return join_all("reinforce")


def build_sovereign():
    """Gate Sovereign: throned monarch bust, crown, emerald gate ring behind."""
    body = dark_mat("VoidBody", (0.02, 0.03, 0.06), rough=0.35, metal=0.6)
    stone = dark_mat("ThroneStone", (0.03, 0.032, 0.045), rough=0.8)
    crown = glow_mat("CrownGold", GOLD, 1.2)
    gate = glow_mat("GateGlow", EMERALD, 1.4)
    eyes = glow_mat("EyeGlow", GOLD, 1.3)

    # throne: seat, tall back slab, armrests
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.2, 0.5), scale=(2.4, 1.8, 1.0))
    paint(obj(), stone)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 1.0, 2.3), scale=(3.0, 0.3, 4.0))
    paint(obj(), stone)
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(sx * 1.3, 0.1, 1.35),
                                        scale=(0.4, 1.6, 0.35))
        paint(obj(), stone)
    # torso
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=1.0, radius2=0.55, depth=2.6,
                                    location=(0, 0, 2.3))
    paint(obj(), body)
    # head
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.42,
                                          location=(0, 0, 3.95))
    paint(obj(), body)
    # eyes
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=0.08,
                                             location=(sx * 0.15, -0.42, 4.0))
        paint(obj(), eyes)
    # crown spikes (gold glow)
    for i in range(7):
        a = i / 7 * math.tau
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.09, radius2=0.0,
                                        depth=0.55 + 0.25 * (i % 2),
                                        location=(math.cos(a) * 0.36,
                                                  math.sin(a) * 0.36, 4.4))
        paint(obj(), crown)
    # pauldrons
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(sx * 0.95, 0, 3.25),
                                        rotation=(0, sx * 0.35, 0),
                                        scale=(0.55, 0.4, 0.9))
        paint(obj(), body)
    # cloak
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=1.6, radius2=0.3, depth=3.2,
                                    location=(0, 0.35, 2.6), scale=(1.0, 0.45, 1.0))
    paint(obj(), stone)
    # gate ring behind the throne
    bpy.ops.mesh.primitive_torus_add(major_radius=2.4, minor_radius=0.15,
                                     major_segments=24, minor_segments=8,
                                     location=(0, 1.5, 3.2),
                                     rotation=(math.radians(90), 0, 0))
    paint(obj(), gate)
    return join_all("sovereign")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

BUILDERS = {
    "shade": lambda: build_shade_family(possessed=False),
    "possessed": lambda: build_shade_family(possessed=True),
    "scout": build_scout,
    "guard": build_guard,
    "reinforce": build_reinforce,
    "sovereign": build_sovereign,
}

RIM_COLORS = {
    "shade": EMERALD,
    "possessed": GOLD,
    "scout": RED,
    "guard": RED,
    "reinforce": RED,
    "sovereign": VIOLET,
}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_dir = "tmp/units"
    units = list(BUILDERS)
    for i, arg in enumerate(argv):
        if arg == "--out" and i + 1 < len(argv):
            out_dir = argv[i + 1]
        if arg == "--units" and i + 1 < len(argv):
            units = [u.strip() for u in argv[i + 1].split(",") if u.strip()]
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)

    for unit in units:
        if unit not in BUILDERS:
            print(f"BUILD_SKIP unknown unit: {unit}")
            continue
        reset_scene()
        model = BUILDERS[unit]()
        add_lights(RIM_COLORS[unit])
        path = os.path.join(out_dir, f"{unit}.blend")
        bpy.ops.wm.save_as_mainfile(filepath=path)
        polys = len(model.data.polygons)
        tris = sum(len(p.vertices) - 2 for p in model.data.polygons)
        print(f"BUILD_RESULT unit={unit} faces={polys} tris={tris} blend={path}")


main()
