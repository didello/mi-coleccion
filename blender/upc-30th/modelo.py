"""Modelo 3D de la Ultra-Premium Collection 30th Celebration (Umbreon / Night).

Se ejecuta dentro del contenedor de Blender (ver blender/README.md):
    docker run --rm -v "${PWD}:/work" mi-coleccion-blender -P blender/upc-30th/modelo.py

Genera:
    blender/upc-30th/upc-30th.blend   escena editable con texturas empaquetadas
    public/modelos/upc-30th.glb       modelo para la app
    blender/upc-30th/vista-*.png      renders de comprobación
"""
import os

import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
TEX = os.path.join(AQUI, "texturas")

# Caja de pie con la tapa al frente (metros).
ANCHO, FONDO, ALTO = 0.400, 0.082, 0.232
w, d = ANCHO / 2, FONDO / 2
BISEL = 0.0025  # cantos ligeramente redondeados

bpy.ops.wm.read_factory_settings(use_empty=True)
escena = bpy.context.scene


def material(nombre, fichero):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(TEX, fichero))
    tex.extension = "EXTEND"
    tex.location = (-400, 200)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.45
    # Retractilado: capa brillante por encima del cartón (KHR_materials_clearcoat en el glTF).
    for nombre_in, valor in (("Coat Weight", 0.3), ("Coat Roughness", 0.12)):
        if nombre_in in bsdf.inputs:
            bsdf.inputs[nombre_in].default_value = valor
    return m


CARAS = ["frente", "trasera", "arriba", "abajo", "lado-izq", "lado-der"]
M = {c: material(c.capitalize(), c + ".jpg") for c in CARAS}

UV = [(0, 0), (1, 0), (1, 1), (0, 1)]
caras = [
    ([(-w, -d, 0), (w, -d, 0), (w, -d, ALTO), (-w, -d, ALTO)], "frente"),
    ([(w, d, 0), (-w, d, 0), (-w, d, ALTO), (w, d, ALTO)], "trasera"),
    ([(-w, -d, ALTO), (w, -d, ALTO), (w, d, ALTO), (-w, d, ALTO)], "arriba"),
    ([(-w, d, 0), (w, d, 0), (w, -d, 0), (-w, -d, 0)], "abajo"),
    ([(-w, d, 0), (-w, -d, 0), (-w, -d, ALTO), (-w, d, ALTO)], "lado-izq"),
    ([(w, -d, 0), (w, d, 0), (w, d, ALTO), (w, -d, ALTO)], "lado-der"),
]

# Cubo con vértices compartidos (para poder biselar) y UV por cara.
import bmesh  # noqa: E402

bm = bmesh.new()
cache = {}


def vert(p):
    k = tuple(round(c, 6) for c in p)
    if k not in cache:
        cache[k] = bm.verts.new(p)
    return cache[k]


uv_capa = bm.loops.layers.uv.new("UVMap")
for i, (vs, clave) in enumerate(caras):
    f = bm.faces.new([vert(p) for p in vs])
    f.material_index = CARAS.index(clave)
    for loop, uv in zip(f.loops, UV):
        loop[uv_capa].uv = uv
bm.normal_update()
me = bpy.data.meshes.new("UPC30")
bm.to_mesh(me)
bm.free()
for c in CARAS:
    me.materials.append(M[c])
caja = bpy.data.objects.new("UPC30thCelebration", me)
escena.collection.objects.link(caja)

mod = caja.modifiers.new("Bisel", "BEVEL")
mod.width = BISEL
mod.segments = 2
mod.harden_normals = False
for p in me.polygons:
    p.use_smooth = False

# --- glTF para la app ---
os.makedirs(os.path.join(RAIZ, "public", "modelos"), exist_ok=True)
glb = os.path.join(RAIZ, "public", "modelos", "upc-30th.glb")
bpy.ops.object.select_all(action="DESELECT")
caja.select_set(True)
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_yup=True,
                          export_apply=True, export_image_format="AUTO", export_materials="EXPORT")
print("GLB:", glb, os.path.getsize(glb), "bytes")

# --- Render de comprobación ---
mundo = bpy.data.worlds.new("Mundo")
escena.world = mundo
mundo.use_nodes = True
mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45


def luz(nombre, energia, pos, tam):
    l = bpy.data.lights.new(nombre, "AREA")
    l.energy = energia
    l.size = tam
    ob = bpy.data.objects.new(nombre, l)
    ob.location = pos
    escena.collection.objects.link(ob)
    ob.constraints.new("TRACK_TO").target = caja


luz("Principal", 14, (0.5, -0.7, 0.7), 0.8)
luz("Relleno", 6, (-0.8, -0.5, 0.4), 0.9)

objetivo = bpy.data.objects.new("Objetivo", None)
objetivo.location = (0, 0, ALTO * 0.5)
escena.collection.objects.link(objetivo)
cam = bpy.data.objects.new("Camara", bpy.data.cameras.new("Camara"))
cam.data.lens = 50
escena.collection.objects.link(cam)
cam.constraints.new("TRACK_TO").target = objetivo
escena.camera = cam

escena.render.engine = "CYCLES"
escena.cycles.device = "CPU"
escena.cycles.samples = 48
escena.cycles.use_denoising = True
escena.render.film_transparent = True
escena.render.resolution_x, escena.render.resolution_y = 1200, 800
escena.view_settings.view_transform = "Standard"

VISTAS = {
    "frente-izq": (-0.45, -0.85, 0.35),
    "frente-der": (0.45, -0.85, 0.35),
    "trasera": (0.35, 0.9, 0.45),
}
for nombre, pos in VISTAS.items():
    cam.location = pos
    escena.render.filepath = os.path.join(AQUI, f"vista-{nombre}.png")
    bpy.ops.render.render(write_still=True)
    print("Render:", escena.render.filepath)

cam.location = VISTAS["frente-izq"]
bpy.ops.file.pack_all()
blend = os.path.join(AQUI, "upc-30th.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend)
print("BLEND:", blend)
