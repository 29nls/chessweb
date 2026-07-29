/* eslint-env serviceworker */
// ── ChessWeb Service Worker ──
// Enables offline play by caching the app shell, Stockfish WASM engine,
// and all static assets. Supabase API calls bypass the cache.

// Bump this version on each deploy to invalidate old cached content-hashed bundles.
const CACHE_NAME = 'chessweb-v2';

// Assets we can name explicitly (known paths in public/)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/stockfish/stockfish-18-lite-single.js',
  '/stockfish/stockfish-18-lite-single.wasm',
  '/sound/capture.ogg',
  '/sound/castle.ogg',
  '/sound/game-end.ogg',
  '/sound/move-check.ogg',
  '/sound/move-self.ogg',
  '/sound/notify.ogg',
  '/sound/promote.ogg',
  '/logo192.png',
  '/logo512.png',
  '/favicon.svg',
  '/favicon.ico',
];

// ── Install: pre-cache known assets ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Add each asset individually so one failure doesn't block others
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Failed to pre-cache:', url, err.message);
          })
        )
      );
    })
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ── Activate: purge old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ── Fetch: stale-while-revalidate for static, bypass for API ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Bypass Supabase API calls — always go to network
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
    return;
  }

  // Bypass Vercel analytics / speed-insights
  if (url.hostname.includes('vitals.vercel-insights.com') || url.hostname.includes('cdn.vercel-insights.com')) {
    return;
  }

  // Stale-while-revalidate for everything else
  event.respondWith(
    caches.match(request).then((cached) => {
      // Fire network fetch to refresh cache. waitUntil keeps the SW alive
      // until the cache write completes so the asset is available next time.
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed — if we have a cached response, the caller
          // already got it. If not, this request will fail.
        });

      event.waitUntil(fetchPromise);

      // Return cached immediately, or wait for network
      return cached || fetchPromise;
    })
  );
});
