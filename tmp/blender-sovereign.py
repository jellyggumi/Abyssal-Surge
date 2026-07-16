
import bpy, math, random

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
random.seed(20260716)

# torso
bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=1.0, radius2=0.55, depth=2.6, location=(0, 0, 1.3))
torso = bpy.context.object
torso.name = "sovereign_torso"

# head
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.42, location=(0, 0, 2.95))

# crown spikes
for i in range(7):
    a = i / 7 * math.tau
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.09, radius2=0.0, depth=0.55 + 0.25 * (i % 2), location=(math.cos(a) * 0.38, math.sin(a) * 0.38, 3.35), rotation=(random.uniform(-0.12, 0.12), random.uniform(-0.12, 0.12), 0))

# pauldrons
for sx in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(sx * 0.95, 0, 2.25), rotation=(0, sx * 0.35, 0), scale=(0.55, 0.4, 0.9))

# cloak
bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=1.6, radius2=0.3, depth=3.2, location=(0, 0.35, 1.6))
bpy.context.object.scale = (1.0, 0.45, 1.0)

# gate ring
bpy.ops.mesh.primitive_torus_add(major_radius=2.3, minor_radius=0.16, location=(0, 1.4, 2.2), rotation=(math.radians(90), 0, 0))
gate = bpy.context.object
gate.name = "gate_ring"

# join body
bpy.ops.object.select_all(action='DESELECT')
for o in list(bpy.context.collection.objects):
    if o.name != "gate_ring" and o.type == 'MESH':
        o.select_set(True)
bpy.context.view_layer.objects.active = torso
bpy.ops.object.join()
sovereign = bpy.context.object
sovereign.name = "gate_sovereign"

mat = bpy.data.materials.new("VoidBody")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.02, 0.03, 0.06, 1)
bsdf.inputs["Roughness"].default_value = 0.35
bsdf.inputs["Metallic"].default_value = 0.6
sovereign.data.materials.append(mat)

gmat = bpy.data.materials.new("GateGlow")
gmat.use_nodes = True
gb = gmat.node_tree.nodes["Principled BSDF"]
gb.inputs["Base Color"].default_value = (0.28, 0.9, 0.82, 1)
try:
    gb.inputs["Emission Color"].default_value = (0.28, 0.9, 0.82, 1)
    gb.inputs["Emission Strength"].default_value = 6.0
except KeyError:
    pass
gate.data.materials.append(gmat)

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (0, -7.5, 2.4)
cam.rotation_euler = (math.radians(84), 0, 0)
scene.camera = cam

key_data = bpy.data.lights.new("key", type='AREA')
key_data.energy = 800
key_data.color = (0.5, 0.75, 1.0)
key = bpy.data.objects.new("key", key_data)
key.location = (-3.5, -4, 4.5)
key.rotation_euler = (math.radians(55), 0, math.radians(-35))
bpy.context.collection.objects.link(key)

rim_data = bpy.data.lights.new("rim", type='AREA')
rim_data.energy = 1200
rim_data.color = (0.67, 0.41, 1.0)
rim = bpy.data.objects.new("rim", rim_data)
rim.location = (3.2, 2.5, 3.8)
rim.rotation_euler = (math.radians(60), 0, math.radians(140))
bpy.context.collection.objects.link(rim)

world = bpy.data.worlds.new("void")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.004, 0.005, 0.012, 1)
scene.world = world

try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except Exception:
    scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.filepath = "/Users/jangyoung/orca/Abyssal-Surge/tmp/gate-sovereign-render.png"
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath="/Users/jangyoung/orca/Abyssal-Surge/tmp/gate-sovereign.blend")
polys = sum(len(o.data.polygons) for o in bpy.context.collection.objects if o.type == 'MESH')
print(f"BLENDER_RESULT polys={polys} objects={len(bpy.context.collection.objects)}")
