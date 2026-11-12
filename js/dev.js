// Acesso ao minijogo enquanto está em desenvolvimento.
// O código não fica escrito aqui: guardamos só o SHA-256 dele e comparamos.
// (Isso só esconde a página da família; não é segurança de verdade.)
const DEV_HASH = "606eb7a41de66ceb75015e460a8fca6b2e7a66b948d49171335ac06ff5405b5f";
const DEV_KEY = "natal.dev";

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function checkDevCode(code) {
  const ok = (await sha256(code.trim().toLowerCase())) === DEV_HASH;
  if (ok) try { localStorage.setItem(DEV_KEY, DEV_HASH); } catch {}
  return ok;
}

export function isDev() {
  try { return localStorage.getItem(DEV_KEY) === DEV_HASH; } catch { return false; }
}
