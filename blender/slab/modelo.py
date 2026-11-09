"""Slab de PSA genérico: funda de plástico transparente con la etiqueta arriba y la carta dentro.

La app cambia las texturas de cada pieza al abrir su ficha (src/slab3d.js), así que aquí solo van
imágenes provisionales. Los nombres de los materiales son los que busca la app: no cambiarlos.

    docker run --rm -v "${PWD}:/work" mi-coleccion-blender -P blender/slab/modelo.py

Medidas de un slab estándar de PSA: 80,8 × 136,5 × 6,35 mm. Etiqueta de 64 × 19 mm a 5,5 mm del borde
de arriba y carta de 63 × 88 mm a 11 mm del borde de abajo (proporciones sacadas de fotos del slab).

Cómo es un slab de verdad (y cómo se imita aquí):
- Bloque de plástico muy transparente y grueso: material con transmisión, IOR 1,5 y volumen, con un
  ligerísimo tinte verdoso que se nota en los cantos.
- En las dos caras, dos ventanas rebajadas con los bordes biselados (una para la etiqueta y otra
  para la carta): son las líneas brillantes que se ven alrededor de la etiqueta y de la carta.
- Dentro, una funda interior algo esmerilada alrededor de la carta, con sus carriles arriba y abajo.
"""
import os

import bmesh
import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
mm = 0.001

ANCHO, ALTO, GROSOR = 80.8 * mm, 136.5 * mm, 6.35 * mm
ETQ_W, ETQ_H, ETQ_TOP = 64 * mm, 19 * mm, 5.5 * mm
CARTA_W, CARTA_H, CARTA_BOTTOM = 63 * mm, 88 * mm, 11 * mm

bpy.ops.wm.read_factory_settings(use_empty=True)
escena = bpy.context.scene


# --- Materiales -----------------------------------------------------------------------------------
def imagen(nombre, color):
    img = bpy.data.images.new(nombre, 8, 8, alpha=False)
    img.pixels[:] = list(color) * 64
    img.pack()
    return img


def mat_textura(nombre, color, rugosidad=0.5):
    """Etiquetas y carta: sin iluminación (KHR_materials_unlit), para que se vean con sus colores reales
    y no las lave el reflejo de las luces. El brillo lo pone el plástico que tienen delante."""
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


def mat_transparente(nombre, color, alfa, rugosidad, metal=0.0, especular=None):
    """Plástico con transparencia por alfa (se ve bien en el navegador; la transmisión real sale negra)."""
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rugosidad
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Alpha"].default_value = alfa
    if especular is not None and "Specular IOR Level" in bsdf.inputs:
        # Menos reflejo especular (se exporta como KHR_materials_specular).
        bsdf.inputs["Specular IOR Level"].default_value = especular
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = "BLENDED"
    try:
        m.blend_method = "BLEND"
    except (TypeError, AttributeError):
        pass
    return m


def grano(nombre, n=256, fuerza=2.2, semilla=7):
    """Mapa de normales de grano fino (el acabado esmerilado, como chorreado con arena, de los cantos)."""
    import random
    rnd = random.Random(semilla)
    alto = [[rnd.random() for _ in range(n)] for _ in range(n)]
    # Un pase de suavizado para que el grano no sea ruido de un solo píxel.
    suave = [[(alto[y][x] * 4 + alto[y][(x + 1) % n] + alto[y][x - 1] + alto[(y + 1) % n][x] + alto[y - 1][x]) / 8
              for x in range(n)] for y in range(n)]
    px = []
    for y in range(n):
        for x in range(n):
            dx = (suave[y][(x + 1) % n] - suave[y][x - 1]) * fuerza
            dy = (suave[(y + 1) % n][x] - suave[y - 1][x]) * fuerza
            l = (dx * dx + dy * dy + 1) ** 0.5
            px += [(-dx / l) * 0.5 + 0.5, (-dy / l) * 0.5 + 0.5, (1 / l) * 0.5 + 0.5, 1.0]
    img = bpy.data.images.new(nombre, n, n, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels[:] = px
    img.pack()
    return img


def mat_esmerilado(nombre, color, alfa, rugosidad, metal):
    """Cantos del slab: gris plata satinado con grano (normal map), casi opaco."""
    m = mat_transparente(nombre, color, alfa, rugosidad, metal)
    nt = m.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = grano("Grano")
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.7
    nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])
    return m


M = {
    "Etiqueta": mat_textura("Etiqueta", (0.96, 0.96, 0.94, 1), 0.45),
    "EtiquetaTrasera": mat_textura("EtiquetaTrasera", (0.22, 0.22, 0.27, 1), 0.45),
    "Carta": mat_textura("Carta", (0.6, 0.6, 0.62, 1), 0.3),
    "CartaTrasera": mat_textura("CartaTrasera", (0.15, 0.2, 0.45, 1), 0.35),
    # Caras planas del slab: casi invisibles, solo dejan un reflejo suave.
    # Muy poca opacidad y poco reflejo: encima de la etiqueta y de la carta no debe haber velo.
    "Plastico": mat_transparente("Plastico", (0.9, 0.92, 0.94), 0.035, 0.08, especular=0.2),
    # Cantos (contorno, escalones y paredes de las ventanas): gris plata satinado y esmerilado, como en
    # las fotos de cerca del slab.
    "Cantos": mat_esmerilado("Cantos", (0.6, 0.61, 0.64), 0.9, 0.5, 0.2),
    # Funda interior: esmerilada y blanquecina (el gris claro que rodea la carta en las fotos).
    "Funda": mat_transparente("Funda", (0.84, 0.86, 0.89), 0.58, 0.4),
}


# --- Utilidades de malla -------------------------------------------------------------------------
def caja(nombre, ancho, alto, fondo, cx=0.0, cz=0.0, cy=0.0, radio=0.0, bisel=0.0, mat=None, coleccion=True):
    """Caja con las esquinas del rectángulo frontal redondeadas (radio) y los cantos biselados (bisel)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = v.co.x * ancho + cx
        v.co.y = v.co.y * fondo + cy
        v.co.z = v.co.z * alto + cz
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nombre, me)
    if coleccion:
        escena.collection.objects.link(ob)
    if mat:
        me.materials.append(M[mat])
    if radio:
        # Redondea solo las 4 aristas paralelas al grosor (Y): esquinas del rectángulo.
        bm = bmesh.new()
        bm.from_mesh(me)
        aristas = [e for e in bm.edges if abs(e.verts[0].co.y - e.verts[1].co.y) > 1e-6]
        bmesh.ops.bevel(bm, geom=aristas, offset=radio, segments=8, profile=0.5, affect="EDGES")
        bm.to_mesh(me)
        bm.free()
    if bisel:
        mod = ob.modifiers.new("Bisel", "BEVEL")
        mod.width = bisel
        mod.segments = 3
        mod.limit_method = "ANGLE"
        mod.angle_limit = 0.6
    return ob


def aplicar(ob):
    bpy.context.view_layer.objects.active = ob
    for mod in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def restar(ob, cortador):
    mod = ob.modifiers.new("Hueco", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cortador
    aplicar(ob)


def plano(nombre, mat, x0, x1, z0, z1, y, mirando_atras=False):
    """Rectángulo vertical (plano XZ) en profundidad y. UV 0..1 legibles desde el lado al que mira."""
    vs = [(x1, y, z0), (x0, y, z0), (x0, y, z1), (x1, y, z1)] if mirando_atras else [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
    me = bpy.data.meshes.new(nombre)
    me.from_pydata(vs, [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name="UVMap")
    for i, c in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[i].uv = c
    me.materials.append(M[mat])
    ob = bpy.data.objects.new(nombre, me)
    escena.collection.objects.link(ob)
    return ob


# Coordenadas: X ancho, Z alto (el slab de pie, base en z=0), Y grosor (el frente mira a -Y).
ez1 = ALTO - ETQ_TOP
ez0 = ez1 - ETQ_H
etq_cz = (ez0 + ez1) / 2
cz0 = CARTA_BOTTOM
cz1 = cz0 + CARTA_H
carta_cz = (cz0 + cz1) / 2
yf, yb = -GROSOR / 2, GROSOR / 2

# --- Cuerpo del slab con las ventanas rebajadas en las dos caras ---------------------------------
cuerpo = caja("Slab", ANCHO, ALTO, GROSOR, cz=ALTO / 2, radio=3.2 * mm, mat="Plastico")
REBAJE = 0.7 * mm
# Rebajes en las dos caras, de fuera a dentro: (ancho, alto, centro z, radio, profundidad).
#  1) Toda la cara salvo un reborde exterior de 2,4 mm: el labio que rodea el slab.
#  2) Un escalón ancho alrededor de cada ventana y 3) la ventana: dan las líneas dobles de las fotos.
REBAJES = [
    (ANCHO - 4.8 * mm, ALTO - 4.8 * mm, ALTO / 2, 2.0 * mm, 0.3 * mm),
    (ETQ_W + 7.0 * mm, ETQ_H + 6.5 * mm, etq_cz, 2.2 * mm, 0.5 * mm),
    (CARTA_W + 9.0 * mm, CARTA_H + 11.5 * mm, carta_cz, 3.0 * mm, 0.5 * mm),
    (ETQ_W + 4.5 * mm, ETQ_H + 4.0 * mm, etq_cz, 1.6 * mm, REBAJE),
    (CARTA_W + 6.5 * mm, CARTA_H + 9.0 * mm, carta_cz, 2.6 * mm, REBAJE),
]
for i, (w_, h_, cz_, r_, p_) in enumerate(REBAJES):
    for lado, y_ in (("f", yf), ("b", yb)):
        cort = caja(f"Corte{i}{lado}", w_, h_, p_ * 2, cz=cz_, cy=y_, radio=r_, coleccion=False)
        escena.collection.objects.link(cort)
        restar(cuerpo, cort)
        bpy.data.objects.remove(cort)
# Cantos biselados: atrapan la luz como los del slab de verdad.
mod = cuerpo.modifiers.new("Bisel", "BEVEL")
mod.width = 0.45 * mm
mod.segments = 3
mod.limit_method = "ANGLE"
mod.angle_limit = 0.5
mod.harden_normals = True
aplicar(cuerpo)
# Las caras que no miran de frente ni de espaldas son cantos: material plateado.
cuerpo.data.materials.append(M["Cantos"])
for p in cuerpo.data.polygons:
    p.use_smooth = True
    p.material_index = 0 if abs(p.normal.y) > 0.97 else 1
# En las fotos todo el marco es plata esmerilada: solo es transparente el fondo de las dos ventanas
# (lo que queda encima de la etiqueta y de la carta).
def en_ventana(c):
    for w_, h_, cz_ in ((ETQ_W + 4.5 * mm, ETQ_H + 4.0 * mm, etq_cz), (CARTA_W + 6.5 * mm, CARTA_H + 9.0 * mm, carta_cz)):
        if abs(c.x) < w_ / 2 - 0.2 * mm and abs(c.z - cz_) < h_ / 2 - 0.2 * mm:
            return True
    return False


for p in cuerpo.data.polygons:
    if p.material_index == 0 and not en_ventana(p.center):
        p.material_index = 1
# UV por proyección de caja (para el grano): repite cada 12 mm.
bm = bmesh.new()
bm.from_mesh(cuerpo.data)
uv = bm.loops.layers.uv.verify()
for f in bm.faces:
    n = f.normal
    for lp in f.loops:
        co = lp.vert.co
        if abs(n.y) >= max(abs(n.x), abs(n.z)):
            lp[uv].uv = (co.x / (12 * mm), co.z / (12 * mm))
        elif abs(n.x) >= abs(n.z):
            lp[uv].uv = (co.y / (12 * mm), co.z / (12 * mm))
        else:
            lp[uv].uv = (co.x / (12 * mm), co.y / (12 * mm))
bm.to_mesh(cuerpo.data)
bm.free()

# --- Funda interior alrededor de la carta (marco esmerilado) y sus carriles -----------------------
FUNDA_W, FUNDA_H, FUNDA_G = CARTA_W + 5.0 * mm, CARTA_H + 7.0 * mm, 1.6 * mm
funda = caja("FundaInterior", FUNDA_W, FUNDA_H, FUNDA_G, cz=carta_cz, radio=1.8 * mm, mat="Funda")
hueco = caja("HuecoCarta", CARTA_W + 0.4 * mm, CARTA_H + 0.4 * mm, FUNDA_G * 3, cz=carta_cz, radio=1.0 * mm, coleccion=False)
escena.collection.objects.link(hueco)
restar(funda, hueco)
bpy.data.objects.remove(hueco)
piezas_funda = [funda]
# Carriles: las líneas claras que se ven justo encima y debajo de la carta, en las dos caras.
for z_ in (cz1 + 1.6 * mm, cz0 - 1.6 * mm):
    for y_ in (-(FUNDA_G / 2 + 0.35 * mm), FUNDA_G / 2 + 0.35 * mm):
        piezas_funda.append(caja("Carril", CARTA_W - 4 * mm, 0.9 * mm, 0.7 * mm, cz=z_, cy=y_, radio=0.3 * mm, mat="Funda"))
# Guías laterales finas a los lados de la carta.
for x_ in (-(CARTA_W / 2 + 1.4 * mm), CARTA_W / 2 + 1.4 * mm):
    piezas_funda.append(caja("Guia", 0.8 * mm, CARTA_H - 10 * mm, FUNDA_G + 0.6 * mm, cx=x_, cz=carta_cz, radio=0.3 * mm, mat="Funda"))
for ob in piezas_funda:
    for p in ob.data.polygons:
        p.use_smooth = True

# --- Etiquetas y carta (las texturas las pone la app) ---------------------------------------------
fondo_ventana = REBAJE + 0.35 * mm  # justo por dentro del fondo del rebaje
piezas = [
    plano("Etiqueta", "Etiqueta", -ETQ_W / 2, ETQ_W / 2, ez0, ez1, yf + fondo_ventana + 0.6 * mm),
    plano("EtiquetaTrasera", "EtiquetaTrasera", -ETQ_W / 2, ETQ_W / 2, ez0, ez1, yb - fondo_ventana - 0.6 * mm, mirando_atras=True),
    plano("Carta", "Carta", -CARTA_W / 2, CARTA_W / 2, cz0, cz1, -0.2 * mm),
    plano("CartaTrasera", "CartaTrasera", -CARTA_W / 2, CARTA_W / 2, cz0, cz1, 0.2 * mm, mirando_atras=True),
]

raiz = bpy.data.objects.new("SlabPSA", None)
escena.collection.objects.link(raiz)
todas = piezas + piezas_funda + [cuerpo]
for ob in todas:
    ob.parent = raiz

os.makedirs(os.path.join(RAIZ, "public", "modelos"), exist_ok=True)
glb = os.path.join(RAIZ, "public", "modelos", "slab.glb")
bpy.ops.object.select_all(action="DESELECT")
for ob in [raiz] + todas:
    ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_yup=True,
                          export_apply=True, export_image_format="AUTO", export_materials="EXPORT")
print("GLB:", glb, os.path.getsize(glb), "bytes")

blend = os.path.join(AQUI, "slab.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend)
print("BLEND:", blend)
