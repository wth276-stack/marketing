const CACHE_NAME = "jessi-workflow-cache-v20";

/** Paths relative to service worker scope (site / project root). */
const PRECACHE_PATHS = [
  "index.html",
  "jessi-beauty-marketing-workflow.html",
  "manifest.json",
  "assets/jessi-auth.css",
  "assets/jessi-auth-config.js",
  "assets/jessi-auth.js",
  "assets/jessi-index-redirect.js",
  "assets/jessi-workflow.css",
  "assets/jessi-workflow.js",
  "assets/jessi-beauty-academy-logo.svg",
  "beauty-salon-marketing-tracker.html",
  "reels-studio.html",
];

function scopeBase() {
  return self.registration?.scope || new URL("./", self.location.href).href;
}

function urlFromRoot(path) {
  return new URL(path, scopeBase()).href;
}

const PRECACHE_URLS = PRECACHE_PATHS.map(urlFromRoot);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          const fallback = PRECACHE_URLS.find((url) => event.request.url === url);
          if (fallback) return caches.match(fallback);
          if (event.request.mode === "navigate") {
            return caches.match(urlFromRoot("jessi-beauty-marketing-workflow.html"));
          }
          return undefined;
        });
    })
  );
});
