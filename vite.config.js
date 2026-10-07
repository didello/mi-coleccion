import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// En GitHub Pages la web vive en https://<usuario>.github.io/mi-coleccion/
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Mi Colección",
        short_name: "Colección",
        description: "Valor y evolución de mi colección de cartas, sellados y coleccionables.",
        lang: "es",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#070B14",
        theme_color: "#070B14",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // Imágenes del catálogo (álbum Topps, imágenes oficiales): cambian poco.
            urlPattern: ({ url }) => url.pathname.includes("/storage/v1/object/public/catalogo/"),
            handler: "CacheFirst",
            options: { cacheName: "catalogo", expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "fuentes" },
          },
        ],
      },
    }),
  ],
});
