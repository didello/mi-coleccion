# Modelos 3D (Blender en Docker)

Blender se ejecuta en un contenedor y no hace falta instalarlo en Windows.

## Requisitos (una sola vez)

1. En una terminal **de administrador**: `wsl --install` y reinicia el PC.
2. Instala Docker Desktop: `winget install -e --id Docker.DockerDesktop --source winget`, ábrelo y acepta sus condiciones.
3. Desde la raíz del proyecto, construye la imagen (descarga Blender 4.2 LTS, unos 350 MB):

```powershell
docker build -t mi-coleccion-blender blender
```

## Game Boy Jukebox

```powershell
npm run modelo3d:texturas     # solo si cambian las fotos o los recortes
docker run --rm -v "${PWD}:/work" mi-coleccion-blender -P blender/gameboy-jukebox/modelo.py
```

Salida:

- `public/modelos/gameboy-jukebox.glb`: el modelo para la app (glTF binario, texturas incluidas)
- `blender/gameboy-jukebox/gameboy-jukebox.blend`: la escena para abrir y retocar en Blender
- `blender/gameboy-jukebox/vista-azul.png`, `vista-roja.png` y `vista-frente.png`: renders de comprobación

Cómo está hecho: `texturas.mjs` endereza cada cara de la caja a partir de las fotos de `fotos/`
y recorta la ventana en "L" del frontal y la tapa con transparencia. `modelo.py` monta la caja
(19 × 19 × 18,5 cm) con esas texturas, el hueco interior con el Game Boy y los cartuchos al fondo
y el plástico de la ventana, y exporta el resultado.

## UPC 30th Celebration

```powershell
node blender/upc-30th/texturas.mjs
docker run --rm -v "${PWD}:/work" mi-coleccion-blender -P blender/upc-30th/modelo.py
```

## Slab de las cartas gradeadas

Un único modelo para todas (`public/modelos/slab.glb`, 80,8 × 136,5 × 6,35 mm). La app dibuja la etiqueta
de delante y la de detrás de cada carta (set, nombre, número, nota, certificado, código de barras y QR
a la página del certificado en PSA) y le pone la imagen de la carta al abrir su ficha (`src/slab3d.js`).
El dorso de las cartas de Pokémon sale de una foto (`node blender/slab/dorso.mjs`).

```powershell
docker run --rm -v "${PWD}:/work" mi-coleccion-blender -P blender/slab/modelo.py
```

Al regenerar cualquier `.glb`, sube `MODELS_V` en `src/main.js` para que la app no siga usando el de la caché.
