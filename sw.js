const CACHE_NAME = "abyssal-command-defense-survivor-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./defense-viewport.js",
  "./defense-catalog.js",
  "./defense-run-simulation.js",
  "./campaign-state.js",
  "./defense-storage.js",
  "./battle-realtime-three.js",
  "./battle-visualizer.js",
  "./defense-audio.js",
  "./assets/images/battle/dusk-warden-frame-00.png",
  "./assets/images/battle/dusk-warden-frame-01.png",
  "./assets/images/battle/dusk-warden-frame-02.png",
  "./assets/images/battle/dusk-warden-frame-03.png",
  "./assets/images/battle/echo-rusher-frame-00.png",
  "./assets/images/battle/echo-rusher-frame-01.png",
  "./assets/images/battle/echo-rusher-frame-02.png",
  "./assets/images/battle/echo-rusher-frame-03.png",
  "./styles.css",
  "./react-game-ui.css",
  "./manifest.json",
  "./icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(
    names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
  )).then(() => self.clients.claim()));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) ?? caches.match("./index.html");
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/version.json")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached ?? networkFirst(event.request)));
});
