// Service worker mínimo: permite instalar a página como aplicativo.
// Não guarda nada em cache: dados e arquivos sempre vêm da rede (nada de versão velha).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
