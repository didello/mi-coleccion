// Fotos de tus copias: carpeta privada <user_id>/ en el bucket "fotos".
// La app las muestra con enlaces firmados que duran una semana y se guardan en memoria.

import { supabase } from "./supabase.js";

const TTL = 60 * 60 * 24 * 7;

export function createPhotos(userId) {
  const urls = new Map();

  const path = (file) => `${userId}/${file}`;

  return {
    url: (file) => (file && urls.get(file)) || "",

    // Pide los enlaces que falten, todos de una vez.
    async ensure(files) {
      const missing = [...new Set(files.filter((f) => f && !urls.has(f)))];
      if (!missing.length) return false;
      const { data, error } = await supabase.storage.from("fotos").createSignedUrls(missing.map(path), TTL);
      if (error) return false;
      for (const r of data) {
        if (r.signedUrl) urls.set(r.path.slice(userId.length + 1), r.signedUrl);
      }
      return true;
    },

    async upload(blob) {
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      const file = `${crypto.randomUUID().replace(/-/g, "")}.${ext}`;
      const { error } = await supabase.storage
        .from("fotos")
        .upload(path(file), blob, { contentType: blob.type || "image/jpeg", upsert: false });
      if (error) {
        const e = new Error(error.message);
        e.code = /exceeded|too large|size/i.test(error.message) ? "too_large" : /mime|type/i.test(error.message) ? "unsupported_type" : "upload";
        throw e;
      }
      return { id: file };
    },

    async remove(file) {
      urls.delete(file);
      await supabase.storage.from("fotos").remove([path(file)]);
    },

    async blob(file) {
      const { data, error } = await supabase.storage.from("fotos").download(path(file));
      if (error) throw error;
      return data;
    },
  };
}
