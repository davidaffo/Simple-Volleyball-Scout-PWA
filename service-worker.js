importScripts("./js/app-version.js");
const CACHE_VERSION =
  (self.__APP_VERSION__ && self.__APP_VERSION__.cacheVersion) || "dev";
const CACHE_NAME = `volley-scout-cache-${CACHE_VERSION}`;
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./version.json",
  "./js/app-version.js",
  "./js/globals.js",
  "./js/shared/lineup-core.js",
  "./js/shared/auto-role.js",
  "./js/shared/roster-manager.js",
  "./js/match-settings.js",
  "./js/opponent-settings.js",
  "./js/roster-lineup.js",
  "./js/scout-ui.js",
  "./images/trajectory/attack_empty_near.png",
  "./images/trajectory/attack_empty_far.png",
  "./images/trajectory/attack_2_near.png",
  "./images/trajectory/attack_3_near.png",
  "./images/trajectory/attack_4_near.png",
  "./images/trajectory/attack_2_far.png",
  "./images/trajectory/attack_3_far.png",
  "./images/trajectory/attack_4_far.png",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-1024.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return null;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  // Per le navigazioni: prova rete prima (per avere l'ultima versione), poi cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then(match => {
            if (match) return match;
            return caches.match("./");
          })
        )
    );
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Statici: stale-while-revalidate per aggiornarsi senza perdere offline
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener("message", event => {
  if (!event.data || event.data.type !== "SKIP_WAITING") return;
  self.skipWaiting();
});
