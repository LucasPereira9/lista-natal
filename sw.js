// Service worker: garante que cada abertura do site pegue a versão mais nova.
// O GitHub Pages manda o navegador guardar os arquivos por 10 min; aqui toda requisição
// do próprio site pergunta ao servidor se mudou (se não mudou, a resposta é rápida: 304).
// Sem internet, cai no cache normal do navegador.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req, { cache: "no-cache" }).catch(() => fetch(req)));
});
