// Solo en desarrollo (npm run dev, abriendo /?demo): arranca la app sin iniciar sesión,
// con los datos de migracion/importar.json en memoria. Nada se guarda.

export async function startDemo(startApp) {
  const plan = await (await fetch("/migracion/importar.json")).json();
  const data = new Map();
  for (const d of plan.docs) {
    if (!data.has(d.collection)) data.set(d.collection, new Map());
    data.get(d.collection).set(d.id, d.data);
  }
  const listeners = new Map();
  const col = (c) => data.get(c) || data.set(c, new Map()).get(c);
  const emit = (c) => (listeners.get(c) || []).forEach((fn) => fn());
  const listen = (c, fn) => {
    if (!listeners.has(c)) listeners.set(c, new Set());
    listeners.get(c).add(fn);
    setTimeout(fn, 0);
    return () => listeners.get(c).delete(fn);
  };
  const doc = (path) => {
    const [c, id] = path.split("/");
    return {
      async set(v) { col(c).set(id, v); emit(c); },
      async update(p) { col(c).set(id, { ...(col(c).get(id) || {}), ...p }); emit(c); },
      async delete() { col(c).delete(id); emit(c); },
      onSnapshot: (cb) => listen(c, () => cb({ exists: col(c).has(id), data: () => col(c).get(id) })),
    };
  };
  const db = {
    doc,
    collection: (c) => ({
      async add(v) { const id = Math.random().toString(36).slice(2); await doc(`${c}/${id}`).set(v); return { id }; },
      onSnapshot: (cb) => listen(c, () => cb({ docs: [...col(c)].map(([id, d]) => ({ id, data: () => d })) })),
    }),
  };
  const photos = {
    url: (f) => (f ? `/migracion/assets/${f}` : ""),
    ensure: async () => false,
    upload: async () => { throw new Error("demo"); },
    remove: async () => {},
  };
  document.getElementById("auth").hidden = true;
  startApp(db, photos);
}
