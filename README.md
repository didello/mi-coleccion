# Mi Colección

Web app para seguir el valor de una colección de cartas (Pokémon, Dragon Ball, fútbol), productos sellados, videojuegos, VHS y láminas. Se instala en el móvil como una app y revisa los precios cada día.

- **Colección:** valor total, ganancia sobre lo invertido, ficha de cada pieza con la carta en 3D, slab de gradeo, historial y precios de mercado (raw, PSA 9 y PSA 10).
- **Evolución:** gráfica del valor de la colección, reparto por categoría y lo que más se ha movido.
- **Objetivos:** lista de lo que buscas, con precio objetivo.
- **Topps:** álbum de las cartas Topps × Pokémon (1999–2004) para marcar las que tienes.

## Cómo está montado

| Pieza | Herramienta |
|---|---|
| Web (HTML, CSS y JavaScript, sin framework) | [Vite](https://vite.dev) + PWA (instalable, funciona sin conexión) |
| Datos, fotos y cuentas | [Supabase](https://supabase.com) (Postgres con RLS, Storage y Auth) |
| Publicación | GitHub Pages, con cada `push` a `main` |
| Revisión diaria de precios | GitHub Actions, todos los días a las 12:00 UTC |

```
index.html                  estructura de la página
src/app.js                  arranque: sesión, datos e importación
src/main.js                 la app (colección, evolución, objetivos, Topps, ficha 3D)
src/store.js                documentos en Supabase con cambios en tiempo real
src/photos.js               fotos privadas de tus copias
src/auth.js                 entrar, crear cuenta y recuperar contraseña
src/importer.js             importación de la versión anterior
scripts/update-prices.mjs   revisión diaria de precios
scripts/lib/pricecharting.mjs  lectura de PriceCharting / SportsCardsPro
supabase/schema.sql         tablas, permisos y almacenamiento
```

### Datos

Todo se guarda en la tabla `documents` como documentos JSON agrupados por colección:

- `items`: cada pieza (nombre, tipo, nota, cantidad, pagado, valor, fuente, historial…).
- `media`: imagen oficial, precios de mercado y población PSA de cada pieza.
- `wishlist`: objetivos.
- `topps`: cartas Topps marcadas con ★.
- `meta`: resumen diario (`summary`), ajustes (`settings`) y catálogo Topps (`topps`).

Cada fila tiene `user_id`, y las políticas RLS hacen que cada cuenta solo vea lo suyo.

### Precios

La revisión diaria (`.github/workflows/precios.yml`):

1. Actualiza las piezas con fuente **Guía** que tienen enlace de PriceCharting o SportsCardsPro, usando la columna que corresponde a su nota (raw, PSA 9, PSA 10 o sellado).
2. Deja igual las de **eBay**, **sin comparables** o con **valor puesto a mano**.
3. Añade el punto del día al historial de todas. Si faltan días, los rellena con el último valor.
4. Guarda el total del día en el resumen.

Se puede lanzar a mano desde **Actions → Revisión diaria de precios → Run workflow**, con la opción de simulación para ver qué cambiaría sin guardar nada.

> Una pieza nueva con enlace de PriceCharting o SportsCardsPro y sin valor pasa a **Guía** en la siguiente revisión. Si escribes un valor a mano en su ficha, la revisión deja de tocarla.
>
> El enlace es el de la carta, no el de una nota concreta: la revisión elige la columna (raw, PSA 9, PSA 10…) según la nota de la pieza. Si esa columna está vacía, guarda los precios que sí haya y avisa en la ficha para usar **ventas de eBay**: se marca la casilla, se abren las ventas cerradas con «Ver ventas en eBay» y se escribe el precio en «Valor manual».

## Puesta en marcha

1. **Supabase:** abre el SQL Editor del proyecto, pega `supabase/schema.sql` y ejecútalo.
2. **Supabase → Authentication → URL Configuration:** en *Site URL* pon la dirección de la web (`https://<usuario>.github.io/mi-coleccion/`) y añádela también en *Redirect URLs*.
3. **GitHub → Settings → Pages:** en *Source* elige **GitHub Actions**.
4. **GitHub → Settings → Secrets and variables → Actions:** crea el secreto `SUPABASE_SECRET_KEY` con la clave **secret** de Supabase (Project Settings → API Keys). Esta clave no va nunca en el código.
5. Entra en la web, crea tu cuenta y usa **«Elegir la carpeta migracion»** para traer los datos de la versión anterior. Solo hace falta una vez.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
npm run icons      # regenera los iconos desde public/favicon.svg
```

Para probar la revisión de precios en local sin guardar nada:

```bash
SUPABASE_URL=https://krxebauuphwraepjmvyt.supabase.co SUPABASE_SECRET_KEY=... DRY_RUN=1 npm run precios
```

La clave pública (`sb_publishable_…`) está en `src/supabase.js` porque está pensada para ir en la web: lo que protege los datos son las políticas RLS.

Los precios de mercado no incluyen sales tax, envío ni comisiones.
