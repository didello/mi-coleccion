"""Carcasa de juego de PlayStation (PS1, NTSC U/C): caja de CD de 142 × 125 × 10,4 mm.

Es la misma para todos los juegos: la app pone la portada, la trasera y los dos lomos de cada uno al
abrir su ficha (src/caja3d.js). Los nombres de los materiales son los que busca la app: no cambiarlos.

    docker run --rm -v "${PWD}:/work" mi-coleccion-blender -P blender/juego-ps1/modelo.py

Coordenadas: X ancho (la bisagra a la izquierda), Z alto (base en z=0), Y grosor (la portada mira a -Y).
"""
import os

import bmesh
import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
mm = 0.001

ANCHO, ALTO, GROSOR = 142 * mm, 125 * mm, 10.4 * mm
w, g = ANCHO / 2, GROSOR / 2

bpy.ops.wm.read_factory_settings(use_empty=True)
escena = bpy.context.scene


def imagen(nombre, color, n=8):
    img = bpy.data.images.new(nombre, n, n, alpha=False)
    img.pixels[:] = list(color) * (n * n)
    img.pack()
    return img


def mat_plano(nombre, color):
    """Papel impreso (portada, trasera, lomos): sin iluminación para que se vea con sus colores."""
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    fondo = nt.nodes.new("ShaderNodeBackground")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = imagen(nombre + "-provisional", color)
    nt.links.new(tex.outputs["Color"], fondo.inputs["Color"])
    nt.links.new(fondo.outputs["Background"], nt.nodes["Material Output"].inputs["Surface"])
    return m


def mat_transparente(nombre, color, alfa, rugosidad, especular=None):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rugosidad
    b.inputs["Alpha"].default_value = alfa
    if especular is not None and "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = especular
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = "BLENDED"
    try:
        m.blend_method = "BLEND"
    except (TypeError, AttributeError):
        pass
    return m


def mat_bandeja():
    """La bandeja negra que se ve por la izquierda de la portada, con sus estrías."""
    m = bpy.data.materials.new("Bandeja")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    n = 64
    px = []
    for y in range(n):
        for x in range(n):
            v = 0.05 + (0.06 if (y // 4) % 2 else 0.0)
            px += [v, v, v * 1.05, 1.0]
    img = bpy.data.images.new("Estrias", n, n, alpha=False)
    img.pixels[:] = px
    img.pack()
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.35
    return m


M = {
    "Portada": mat_plano("Portada", (0.85, 0.85, 0.85, 1)),
    "Trasera": mat_plano("Trasera", (0.7, 0.7, 0.72, 1)),
    "Lomo": mat_plano("Lomo", (0.1, 0.1, 0.1, 1)),
    "LomoDerecho": mat_plano("LomoDerecho", (0.95, 0.95, 0.95, 1)),
    "Plastico": mat_transparente("Plastico", (0.92, 0.94, 0.96), 0.05, 0.05, especular=0.25),
    "Cantos": mat_transparente("Cantos", (0.85, 0.88, 0.9), 0.35, 0.15),
    "Bandeja": mat_bandeja(),
    "Interior": mat_transparente("Interior", (0.03, 0.03, 0.035), 1.0, 0.6),
}


def malla(nombre, vs, mat, uvs=((0, 0), (1, 0), (1, 1), (0, 1))):
    me = bpy.data.meshes.new(nombre)
    me.from_pydata(vs, [], [(0, 1, 2, 3)])
    capa = me.uv_layers.new(name="UVMap")
    for i, c in enumerate(uvs):
        capa.data[i].uv = c
    me.materials.append(M[mat])
    ob = bpy.data.objects.new(nombre, me)
    escena.collection.objects.link(ob)
    return ob


def caja(nombre, x0, x1, y0, y1, z0, z1, mat, bisel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 + (v.co.x + 0.5) * (x1 - x0)
        v.co.y = y0 + (v.co.y + 0.5) * (y1 - y0)
        v.co.z = z0 + (v.co.z + 0.5) * (z1 - z0)
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(M[mat])
    ob = bpy.data.objects.new(nombre, me)
    escena.collection.objects.link(ob)
    if bisel:
        mod = ob.modifiers.new("Bisel", "BEVEL")
        mod.width = bisel
        mod.segments = 2
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


# --- Plástico: tapa (delante), bandeja trasera y los cantos -----------------------------------------
piezas = []
piezas.append(caja("Tapa", -w, w, -g, -g + 1.2 * mm, 0, ALTO, "Plastico", bisel=0.6 * mm))
piezas.append(caja("Fondo", -w, w, g - 1.2 * mm, g, 0, ALTO, "Plastico", bisel=0.6 * mm))
# Cantos de arriba y abajo (los laterales los tapan los lomos impresos).
piezas.append(caja("CantoArriba", -w, w, -g, g, ALTO - 1.0 * mm, ALTO, "Cantos", bisel=0.4 * mm))
piezas.append(caja("CantoAbajo", -w, w, -g, g, 0, 1.0 * mm, "Cantos", bisel=0.4 * mm))
# Bisagra: el borde izquierdo de la tapa, más grueso.
piezas.append(caja("Bisagra", -w, -w + 2.5 * mm, -g, -g + 2.2 * mm, 0, ALTO, "Cantos", bisel=0.5 * mm))

# Portada de 120 × 120 mm, metida bajo la tapa y pegada al lado derecho.
px0, px1 = w - 1.5 * mm - 120 * mm, w - 1.5 * mm
pz0, pz1 = (ALTO - 120 * mm) / 2, (ALTO + 120 * mm) / 2

# --- Bandeja negra: ocupa el interior (así no se transparenta la trasera) y asoma con sus estrías ------
# a la izquierda de la portada, de la bisagra hasta el borde de la portada.
piezas.append(caja("Interior", -w + 2.5 * mm, w - 1.2 * mm, -g + 2.4 * mm, g - 2.4 * mm, 1.2 * mm, ALTO - 1.2 * mm, "Interior"))
piezas.append(malla("Bandeja", [(-w + 2.5 * mm, -g + 2.3 * mm, 1.2 * mm), (px0, -g + 2.3 * mm, 1.2 * mm),
                                (px0, -g + 2.3 * mm, ALTO - 1.2 * mm), (-w + 2.5 * mm, -g + 2.3 * mm, ALTO - 1.2 * mm)],
                    "Bandeja", uvs=((0, 0), (0.25, 0), (0.25, 2), (0, 2))))

# --- Papel impreso ----------------------------------------------------------------------------------
piezas.append(malla("Portada", [(px0, -g + 1.5 * mm, pz0), (px1, -g + 1.5 * mm, pz0),
                                (px1, -g + 1.5 * mm, pz1), (px0, -g + 1.5 * mm, pz1)], "Portada"))
# Trasera de 138 × 118 mm, vista desde atrás (u crece hacia -X).
tx0, tx1 = -w + 2 * mm, w - 2 * mm
tz0, tz1 = (ALTO - 118 * mm) / 2, (ALTO + 118 * mm) / 2
yt = g - 1.5 * mm
piezas.append(malla("Trasera", [(tx1, yt, tz0), (tx0, yt, tz0), (tx0, yt, tz1), (tx1, yt, tz1)], "Trasera"))
# Lomos: la trasera se dobla por los dos lados y se ve en los cantos (6,5 mm de ancho, 118 de largo).
# La textura es la tira vertical tal cual sale del escaneo de la trasera (visto desde atrás): el lomo
# de la bisagra es la tira de la derecha del escaneo y el del otro lado, la de la izquierda.
ly0, ly1 = -3.25 * mm, 3.25 * mm
xl = -w + 0.3 * mm  # visto desde fuera por la izquierda: a la izquierda queda la trasera (+Y)
piezas.append(malla("Lomo", [(xl, ly1, tz0), (xl, ly0, tz0), (xl, ly0, tz1), (xl, ly1, tz1)], "Lomo"))
xr = w - 0.3 * mm  # visto desde fuera por la derecha: a la derecha queda la trasera (+Y)
piezas.append(malla("LomoDerecho", [(xr, ly0, tz0), (xr, ly1, tz0), (xr, ly1, tz1), (xr, ly0, tz1)], "LomoDerecho"))

raiz = bpy.data.objects.new("CajaPS1", None)
escena.collection.objects.link(raiz)
for ob in piezas:
    ob.parent = raiz
    for p in ob.data.polygons:
        p.use_smooth = False

os.makedirs(os.path.join(RAIZ, "public", "modelos"), exist_ok=True)
glb = os.path.join(RAIZ, "public", "modelos", "caja-ps1.glb")
bpy.ops.object.select_all(action="DESELECT")
for ob in [raiz] + piezas:
    ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_yup=True,
                          export_apply=True, export_image_format="AUTO", export_materials="EXPORT")
print("GLB:", glb, os.path.getsize(glb), "bytes")
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(AQUI, "caja-ps1.blend"))
print("BLEND ok")
