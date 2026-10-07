// Pantalla de acceso: correo y contraseña de Supabase.
// Cada cuenta tiene su propia colección.

import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const MSG = {
  "Invalid login credentials": "Correo o contraseña incorrectos.",
  "Email not confirmed": "Tienes que confirmar tu correo: revisa tu bandeja de entrada (y el spam).",
  "User already registered": "Ya hay una cuenta con ese correo. Entra con tu contraseña.",
};
const tr = (e) => MSG[e?.message] || (/password/i.test(e?.message || "") ? "La contraseña debe tener al menos 8 caracteres." : e?.message || "Algo ha fallado. Inténtalo otra vez.");

export function initAuth({ onSignIn, onSignOut }) {
  const box = $("auth"),
    form = $("authForm"),
    msg = $("authMsg");
  let mode = "in"; // in | up | reset
  let current = null;

  function setMode(m) {
    mode = m;
    $("authTitle").textContent = m === "up" ? "Crear cuenta" : m === "reset" ? "Recuperar contraseña" : "Entrar";
    $("authPass").hidden = m === "reset";
    $("authPass").required = m !== "reset";
    $("authPass").autocomplete = m === "up" ? "new-password" : "current-password";
    $("authGo").textContent = m === "up" ? "Crear cuenta" : m === "reset" ? "Enviar enlace" : "Entrar";
    $("authToUp").hidden = m !== "in";
    $("authToIn").hidden = m === "in";
    $("authToReset").hidden = m !== "in";
    msg.textContent = "";
  }

  $("authToUp").addEventListener("click", () => setMode("up"));
  $("authToIn").addEventListener("click", () => setMode("in"));
  $("authToReset").addEventListener("click", () => setMode("reset"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("authEmail").value.trim(),
      password = $("authPass").value;
    const btn = $("authGo");
    btn.disabled = true;
    msg.className = "msg";
    msg.textContent = "Un momento…";
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        msg.textContent = "";
      } else if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin + location.pathname },
        });
        if (error) throw error;
        if (!data.session) msg.textContent = "Te he enviado un correo para confirmar la cuenta. Ábrelo y vuelve aquí para entrar.";
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) throw error;
        msg.textContent = "Si existe una cuenta con ese correo, te llegará un enlace para poner una contraseña nueva.";
      }
    } catch (err) {
      msg.className = "msg warnmsg";
      msg.textContent = tr(err);
    } finally {
      btn.disabled = false;
    }
  });

  $("btnOut").addEventListener("click", async () => {
    await supabase.auth.signOut();
  });

  $("newPassForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: $("newPass").value });
    $("newPassMsg").textContent = error ? tr(error) : "Contraseña cambiada.";
    if (!error) setTimeout(() => ($("newPassBox").hidden = true), 1200);
  });

  function apply(session) {
    const user = session?.user || null;
    if (user?.id === current?.id) return;
    current = user;
    box.hidden = !!user;
    $("btnOut").hidden = !user;
    if (user) onSignIn(user);
    else {
      setMode("in");
      onSignOut();
    }
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") $("newPassBox").hidden = false;
    // Se difiere para no llamar a Supabase dentro de su propio aviso.
    setTimeout(() => apply(session), 0);
  });
  supabase.auth.getSession().then(({ data }) => apply(data.session));
  setMode("in");
}
