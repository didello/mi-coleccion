import "./styles.css";
import { startApp, stopApp } from "./main.js";
import { createStore } from "./store.js";
import { createPhotos } from "./photos.js";
import { initAuth } from "./auth.js";
import { initImporter } from "./importer.js";

let ctx = null;
let stopEmptyWatch = null;

initImporter(() => ctx);

if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo")) {
  import("./dev-demo.js").then((m) => m.startDemo(startApp));
} else initAuth({
  onSignIn(user) {
    const db = createStore(user.id);
    ctx = { userId: user.id, db };
    startApp(db, createPhotos(user.id));
    // Si la colección está vacía, ofrece importar la copia de la versión anterior.
    stopEmptyWatch = db.collection("items").onSnapshot((s) => {
      document.getElementById("importPanel").hidden = s.docs.length > 0;
    });
  },
  onSignOut() {
    if (stopEmptyWatch) stopEmptyWatch();
    stopEmptyWatch = null;
    ctx = null;
    document.getElementById("importPanel").hidden = true;
    stopApp();
  },
});
