// Almacén de documentos sobre Supabase.
// Ofrece la misma forma de trabajar que la primera versión de la app:
//   db.collection("items").onSnapshot(cb) · db.collection("items").add(doc)
//   db.doc("items/abc").update(patch) · .set(data) · .delete() · .onSnapshot(cb)
// Mantiene una copia en memoria, la actualiza al escribir y con los cambios en tiempo real.

import { supabase } from "./supabase.js";

const newId = () => {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
};

export function createStore(userId) {
  const cache = new Map(); // collection -> Map(id -> data)
  const loaded = new Map(); // collection -> Promise
  const listeners = new Map(); // collection -> Set(fn)

  const col = (c) => {
    if (!cache.has(c)) cache.set(c, new Map());
    return cache.get(c);
  };

  function emit(c) {
    for (const fn of listeners.get(c) || []) fn();
  }

  function load(c) {
    if (!loaded.has(c)) {
      loaded.set(
        c,
        (async () => {
          const { data, error } = await supabase
            .from("documents")
            .select("id,data")
            .eq("collection", c)
            .limit(5000);
          if (error) {
            loaded.delete(c);
            throw error;
          }
          const m = col(c);
          m.clear();
          for (const row of data) m.set(row.id, row.data || {});
        })(),
      );
    }
    return loaded.get(c);
  }

  function listen(c, fn, onError) {
    if (!listeners.has(c)) listeners.set(c, new Set());
    listeners.get(c).add(fn);
    load(c).then(fn, (e) => onError && onError(e));
    return () => listeners.get(c).delete(fn);
  }

  const channel = supabase
    .channel("documents-" + userId)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "documents", filter: `user_id=eq.${userId}` },
      (p) => {
        const row = p.eventType === "DELETE" ? p.old : p.new;
        if (!row || !row.collection) {
          // Los borrados solo traen la clave primaria si la tabla no tiene REPLICA IDENTITY FULL:
          // recargamos todo lo que se esté mostrando.
          for (const c of listeners.keys()) {
            loaded.delete(c);
            load(c).then(() => emit(c));
          }
          return;
        }
        if (p.eventType === "DELETE") col(row.collection).delete(row.id);
        else col(row.collection).set(row.id, row.data || {});
        emit(row.collection);
      },
    )
    .subscribe();

  // Al volver a la app (por ejemplo en el móvil) se recargan los datos.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    for (const c of listeners.keys()) {
      loaded.delete(c);
      load(c).then(() => emit(c)).catch(() => {});
    }
  });

  const fail = (error) => {
    const e = new Error(error.message || "Error de base de datos");
    e.code = error.code;
    throw e;
  };

  function docRef(path) {
    const i = path.indexOf("/");
    const c = path.slice(0, i),
      id = path.slice(i + 1);
    return {
      id,
      async set(data) {
        const { error } = await supabase
          .from("documents")
          .upsert({ user_id: userId, collection: c, id, data }, { onConflict: "user_id,collection,id" });
        if (error) fail(error);
        col(c).set(id, data);
        emit(c);
      },
      async update(patch) {
        const { error } = await supabase.rpc("doc_merge", { p_collection: c, p_id: id, p_patch: patch });
        if (error) fail(error);
        col(c).set(id, { ...(col(c).get(id) || {}), ...patch });
        emit(c);
      },
      async delete() {
        const { error } = await supabase.from("documents").delete().eq("collection", c).eq("id", id);
        if (error) fail(error);
        col(c).delete(id);
        emit(c);
      },
      onSnapshot(cb, onError) {
        return listen(
          c,
          () => {
            const d = col(c).get(id);
            cb({ exists: d !== undefined, data: () => d });
          },
          onError,
        );
      },
    };
  }

  return {
    doc: docRef,
    collection(c) {
      return {
        async add(data) {
          const id = newId();
          await docRef(c + "/" + id).set(data);
          return { id };
        },
        onSnapshot(cb, onError) {
          return listen(
            c,
            () => cb({ docs: [...col(c)].map(([id, d]) => ({ id, data: () => d })) }),
            onError,
          );
        },
      };
    },
    close() {
      supabase.removeChannel(channel);
    },
  };
}
