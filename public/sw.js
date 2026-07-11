// Service worker de Guardia Tracker.
// Estrategia: red primero para la navegación (con caché de respaldo para
// funcionar sin conexión) y caché primero para los recursos estáticos.
const VERSION = 'guardia-tracker-v1';
const PRECACHE = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase y otros orígenes: siempre red

  // Navegación: red primero, respaldo en caché para modo offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copia));
          return respuesta;
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match('/')))
    );
    return;
  }

  // Estáticos (JS/CSS/imágenes con hash): caché primero, luego red.
  event.respondWith(
    caches.match(request).then(
      (encontrado) =>
        encontrado ??
        fetch(request).then((respuesta) => {
          if (respuesta.ok && (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/'))) {
            const copia = respuesta.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copia));
          }
          return respuesta;
        })
    )
  );
});
