"""Modelo 3D del Game Boy Jukebox (Game Music Collection, caja de Pokémon Rojo/Azul).

Se ejecuta dentro del contenedor de Blender (ver blender/README.md):
    docker run --rm -v "${PWD}:/work" mi-coleccion-blender -P blender/gameboy-jukebox/modelo.py

Genera:
    blender/gameboy-jukebox/gameboy-jukebox.blend  escena editable con texturas empaquetadas
    public/modelos/gameboy-jukebox.glb             modelo para la app (glTF binario)
    blender/gameboy-jukebox/vista-*.png            renders de comprobación
"""
import math
import os

import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
TEX = os.path.join(AQUI, "texturas")

# Medidas en metros (caja casi cúbica, ~19 cm).
ANCHO, FONDO, ALTO = 0.190, 0.190, 0.185
# Ventana en "L" (frontal + tapa). Debe coincidir con V en texturas.mjs.
VENTANA = {"u0": 0.139, "u1": 0.863, "alto": 0.609, "fondo": 0.365}

w, d = ANCHO / 2, FONDO / 2


# --- Escena limpia -----------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
escena = bpy.context.scene
escena.unit_settings.system = "METRIC"


# --- Materiales ----------------------------------------------------------------
def principled(nombre):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    return m, bsdf


def modo_alfa(m, modo):
    """modo: 'CLIP' (recorte) o 'BLEND' (transparente). Compatible con Blender 4.2+."""
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = "DITHERED" if modo == "CLIP" else "BLENDED"
    try:
        m.blend_method = modo
    except (TypeError, AttributeError):
        pass


def mat_imagen(nombre, fichero, alfa=False, rugosidad=0.42):
    m, bsdf = principled(nombre)
    nt = m.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(TEX, fichero))
    tex.location = (-400, 200)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rugosidad
    if alfa:
        # Alfa redondeado -> el exportador glTF lo guarda como alphaMode MASK.
        red = nt.nodes.new("ShaderNodeMath")
        red.operation = "ROUND"
        red.location = (-150, -100)
        nt.links.new(tex.outputs["Alpha"], red.inputs[0])
        nt.links.new(red.outputs[0], bsdf.inputs["Alpha"])
        modo_alfa(m, "CLIP")
    return m


def mat_color(nombre, rgb, rugosidad=0.5, alfa=1.0):
    m, bsdf = principled(nombre)
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rugosidad
    if alfa < 1.0:
        bsdf.inputs["Alpha"].default_value = alfa
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.15
        modo_alfa(m, "BLEND")
    m.diffuse_color = (*rgb, alfa)
    return m


M = {
    "frente": mat_imagen("Frente", "frente-alfa.png", alfa=True),
    "tapa": mat_imagen("Tapa", "tapa-alfa.png", alfa=True),
    "azul": mat_imagen("Lado azul", "lado-azul.jpg"),
    "rojo": mat_imagen("Lado rojo", "lado-rojo.jpg"),
    "trasera": mat_imagen("Trasera", "trasera.jpg"),
    "base": mat_imagen("Base", "base.jpg"),
    "interior": mat_imagen("Interior", "interior.jpg", rugosidad=0.3),
    "bandeja": mat_color("Bandeja plastico", (0.03, 0.03, 0.035), 0.75),
    "plastico": mat_color("Ventana plastico", (0.95, 0.97, 1.0), 0.04, alfa=0.07),
}


# --- Geometría -----------------------------------------------------------------
def malla(nombre, caras, materiales):
    """caras: lista de (vértices[4], uvs[4], clave_material)."""
    verts, polys, uvs, idx_mat = [], [], [], []
    claves = list(materiales)
    for vs, us, clave in caras:
        base = len(verts)
        verts.extend(vs)
        polys.append(tuple(range(base, base + len(vs))))
        uvs.extend(us)
        idx_mat.append(claves.index(clave))
    me = bpy.data.meshes.new(nombre)
    me.from_pydata(verts, [], polys)
    capa = me.uv_layers.new(name="UVMap")
    for i, uv in enumerate(uvs):
        capa.data[i].uv = uv
    for clave in claves:
        me.materials.append(M[clave])
    for p, mi in zip(me.polygons, idx_mat):
        p.material_index = mi
    me.validate()
    me.update()
    ob = bpy.data.objects.new(nombre, me)
    escena.collection.objects.link(ob)
    return ob


UV = [(0, 0), (1, 0), (1, 1), (0, 1)]

caja = malla("Caja", [
    ([(-w, -d, 0), (w, -d, 0), (w, -d, ALTO), (-w, -d, ALTO)], UV, "frente"),
    ([(w, -d, 0), (w, d, 0), (w, d, ALTO), (w, -d, ALTO)], UV, "azul"),
    ([(-w, d, 0), (-w, -d, 0), (-w, -d, ALTO), (-w, d, ALTO)], UV, "rojo"),
    ([(w, d, 0), (-w, d, 0), (-w, d, ALTO), (w, d, ALTO)], UV, "trasera"),
    ([(-w, -d, ALTO), (w, -d, ALTO), (w, d, ALTO), (-w, d, ALTO)], UV, "tapa"),
    ([(-w, d, 0), (w, d, 0), (w, -d, 0), (-w, -d, 0)], UV, "base"),
], ["frente", "azul", "rojo", "trasera", "tapa", "base"])

# Hueco interior detrás de la ventana: paredes de la bandeja y el contenido al fondo.
x0 = -w + VENTANA["u0"] * ANCHO
x1 = -w + VENTANA["u1"] * ANCHO
z0 = ALTO - VENTANA["alto"] * ALTO
yf = -d + VENTANA["fondo"] * FONDO
e = 0.0015  # separación para que no parpadeen las caras coincidentes
ALTO_INT = ALTO - e

hueco = malla("Interior", [
    # Fondo con la foto del contenido (Game Boy y cartuchos), mirando hacia el frente.
    ([(x0, yf, z0), (x1, yf, z0), (x1, yf, ALTO_INT), (x0, yf, ALTO_INT)], UV, "interior"),
    # Suelo, paredes laterales de la bandeja (normales hacia dentro).
    ([(x0, -d + e, z0), (x0, yf, z0), (x1, yf, z0), (x1, -d + e, z0)], UV, "bandeja"),
    ([(x0, yf, z0), (x0, -d + e, z0), (x0, -d + e, ALTO_INT), (x0, yf, ALTO_INT)], UV, "bandeja"),
    ([(x1, -d + e, z0), (x1, yf, z0), (x1, yf, ALTO_INT), (x1, -d + e, ALTO_INT)], UV, "bandeja"),
], ["interior", "bandeja"])

# Plástico transparente de la ventana (frontal y tapa), apenas por dentro del cartón.
p = 0.0006
ventana = malla("Ventana", [
    ([(x0, -d + p, z0), (x1, -d + p, z0), (x1, -d + p, ALTO - p), (x0, -d + p, ALTO - p)], UV, "plastico"),
    ([(x0, -d + p, ALTO - p), (x1, -d + p, ALTO - p), (x1, yf, ALTO - p), (x0, yf, ALTO - p)], UV, "plastico"),
], ["plastico"])

# Agrupar bajo un vacío con el origen en el centro de la base.
raiz = bpy.data.objects.new("GameBoyJukebox", None)
escena.collection.objects.link(raiz)
for ob in (caja, hueco, ventana):
    ob.parent = raiz
    for poly in ob.data.polygons:
        poly.use_smooth = False

# --- Exportar glTF para la app -------------------------------------------------
os.makedirs(os.path.join(RAIZ, "public", "modelos"), exist_ok=True)
glb = os.path.join(RAIZ, "public", "modelos", "gameboy-jukebox.glb")
bpy.ops.object.select_all(action="DESELECT")
for ob in (raiz, caja, hueco, ventana):
    ob.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=glb,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_image_format="AUTO",
    export_materials="EXPORT",
)
print("GLB:", glb, os.path.getsize(glb), "bytes")

# --- Luces, cámara y render de comprobación -------------------------------------
mundo = bpy.data.worlds.new("Mundo")
escena.world = mundo
mundo.use_nodes = True
mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45


def luz(nombre, tipo, energia, pos, tam=0.3):
    l = bpy.data.lights.new(nombre, tipo)
    l.energy = energia
    if tipo == "AREA":
        l.size = tam
    ob = bpy.data.objects.new(nombre, l)
    ob.location = pos
    escena.collection.objects.link(ob)
    c = ob.constraints.new("TRACK_TO")
    c.target = raiz
    return ob


luz("Principal", "AREA", 18, (0.35, -0.45, 0.55), 0.5)
luz("Relleno", "AREA", 6, (-0.5, -0.3, 0.3), 0.6)

objetivo = bpy.data.objects.new("Objetivo", None)
objetivo.location = (0, 0, ALTO * 0.45)
escena.collection.objects.link(objetivo)

cam_datos = bpy.data.cameras.new("Camara")
cam_datos.lens = 60
cam = bpy.data.objects.new("Camara", cam_datos)
escena.collection.objects.link(cam)
cam.constraints.new("TRACK_TO").target = objetivo
escena.camera = cam

escena.render.engine = "CYCLES"
escena.cycles.device = "CPU"
escena.cycles.samples = 48
escena.cycles.use_denoising = True
escena.render.film_transparent = True
escena.render.resolution_x = escena.render.resolution_y = 900
escena.view_settings.view_transform = "Standard"

VISTAS = {
    "azul": (0.36, -0.52, 0.33),   # frente + lado azul, como la foto 1
    "roja": (-0.36, -0.52, 0.33),  # frente + lado rojo, como la foto 2
    "frente": (0.0, -0.62, 0.12),  # de frente, como la foto 3
}
for nombre, pos in VISTAS.items():
    cam.location = pos
    escena.render.filepath = os.path.join(AQUI, f"vista-{nombre}.png")
    bpy.ops.render.render(write_still=True)
    print("Render:", escena.render.filepath)

# Dejar la cámara en la vista azul y guardar el .blend con las texturas dentro.
cam.location = VISTAS["azul"]
bpy.ops.file.pack_all()
blend = os.path.join(AQUI, "gameboy-jukebox.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend)
print("BLEND:", blend)
