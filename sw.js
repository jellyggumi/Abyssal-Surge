const CACHE_NAME = "abyssal-surge-static-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./campaign-state.js",
  "./styles.css",
  "./sw.js",
  "./manifest.json",
  "./icon.svg"
];
const OPTIONAL_MEDIA = [
  "./assets/images/cinder-span.png",
  "./assets/images/veil-citadel.png",
  "./assets/images/echo-throne.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/audio/extract.mp3",
  "./assets/audio/domain.mp3",
  "./assets/audio/ambient.mp3",
  "./assets/video/cinder-span.mp4",
  "./assets/video/veil-citadel.mp4",
  "./assets/video/echo-throne.mp4",
  "./assets/video/shadow-lord-cinematic.mp4"
];

function isSameOriginGet(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

function isCoreRequest(request) {
  if (!isSameOriginGet(request)) return false;
  const path = new URL(request.url).pathname;
  return path.endsWith("/") || ["/index.html", "/app.js", "/campaign-state.js", "/styles.css", "/sw.js"].some((suffix) => path.endsWith(suffix));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(CORE_ASSETS);
        await Promise.allSettled(OPTIONAL_MEDIA.map((asset) => cache.add(asset)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => key.startsWith("abyssal-surge-") && key !== CACHE_NAME ? caches.delete(key) : undefined)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!isSameOriginGet(request)) return;

  if (isCoreRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || (request.mode === "navigate" ? caches.match("./index.html") : Response.error())))
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
