import { createClient } from "@supabase/supabase-js";

// Datos públicos del proyecto: la clave "publishable" está pensada para ir en la web.
// La seguridad la ponen las políticas RLS de supabase/schema.sql.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://krxebauuphwraepjmvyt.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "sb_publishable_rZOnslZfdz5-cV8AEsfnGA_MGDD0QRK";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const catalogUrl = (file) =>
  file ? `${SUPABASE_URL}/storage/v1/object/public/catalogo/${encodeURIComponent(file)}` : "";
