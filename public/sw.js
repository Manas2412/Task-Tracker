/**
 * MYAS Task Tracker service worker.
 *
 * Deliberately conservative — the app is auth-gated and fully dynamic, so
 * nothing personalised is ever cached:
 *
 *   - Navigations: network only, with a branded offline fallback page.
 *   - Immutable build assets (/_next/static) + PWA imagery: cache-first.
 *   - Everything else (API routes, server actions, data): untouched.
 *
 * Bump VERSION whenever the precached assets change — activation clears
 * every older cache.
 */
const VERSION = 'v1';
const CACHE = `myas-pwa-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png'];
// Hashed chunk names change across deploys while VERSION stays put, so the
// runtime cache would otherwise grow forever. Insertion order approximates
// oldest-first; precached entries are never evicted.
const MAX_CACHE_ENTRIES = 150;

async function cacheWithTrim(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  const keys = await cache.keys();
  let excess = keys.length - MAX_CACHE_ENTRIES;
  if (excess <= 0) return;
  const precached = new Set(PRECACHE.map((path) => new URL(path, self.location.origin).href));
  for (const key of keys) {
    if (excess <= 0) break;
    if (precached.has(key.url)) continue;
    await cache.delete(key);
    excess -= 1;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page loads: always hit the network (session cookies, redirects, fresh
  // data). Only when the network itself fails, fall back to the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached || Response.error()),
      ),
    );
    return;
  }

  // Hash-fingerprinted build output and PWA imagery never change in place —
  // serve from cache, fill the cache on first fetch.
  const isImmutableAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/splash/');
  if (isImmutableAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            // Full 200s only — the Cache API rejects partial (206) responses.
            if (response.status === 200) {
              const copy = response.clone();
              cacheWithTrim(request, copy).catch(() => {});
            }
            return response;
          }),
      ),
    );
  }
  // All other GETs fall through to the browser's default handling.
});
