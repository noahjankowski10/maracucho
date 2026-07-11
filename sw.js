/* Maracucho trainer — service worker (hosted version only)
   Caches the app so it opens instantly and works with no connection at all.
   Serve from cache first, refresh in the background, so updates land on the
   next launch. Files are cached individually: if one URL is missing (like a
   bare directory URL that 404s), the rest still cache and offline still works. */

const CACHE = "maracucho-v2";
const ASSETS = ["./", "./index.html", "./sw.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // allSettled, not addAll: one 404 must not abort the whole install
      Promise.allSettled(ASSETS.map((u) => c.add(u)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // never touch external calls

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => {
          if (cached) return cached;
          // Offline and this exact URL isn't cached: fall back to the app shell
          if (e.request.mode === "navigate") {
            return caches.match("./index.html").then((r) => r || Response.error());
          }
          return Response.error();
        });
      return cached || fresh;
    })
  );
});
