const CACHE_NAME = "abyssal-surge-v3";

// DET7-SW: the five core closure files are served NETWORK-FIRST (deploys
// propagate on the next load) with cache fallback (offline keeps working).
// Everything else — audio/images/video — stays cache-first: immutable media.
const CORE_SUFFIXES = ["/index.html", "/app.js", "/game-core.js", "/styles.css"];

const ASSETS = [
  "./",
  "./index.html",
  "./privacy.html",
  "./app.js",
  "./game-core.js",
  "./styles.css",
  "./manifest.json",
  "./icon.svg",
  "./assets/audio/strike.mp3",
  "./assets/audio/brace.mp3",
  "./assets/audio/disrupt.mp3",
  "./assets/audio/recover.mp3",
  "./assets/audio/victory.mp3",
  "./assets/audio/defeat.mp3",
  "./assets/audio/bgm.mp3",
  "./assets/audio/click.mp3",
  "./assets/audio/narr_intro_1.mp3",
  "./assets/audio/narr_intro_2.mp3",
  "./assets/audio/narr_intro_3.mp3",
  "./assets/audio/narr_intro_4.mp3",
  "./assets/audio/narr_intro_5.mp3",
  "./assets/audio/narr_victory.mp3",
  "./assets/audio/narr_defeat.mp3",
  "./assets/images/lobby.png",
  "./assets/images/victory.png",
  "./assets/images/defeat.png",
  "./assets/images/knight.png",
  "./assets/images/void_eye.png",
  "./assets/images/stage1.png",
  "./assets/images/stage2.png",
  "./assets/images/stage3.png",
  "./assets/images/stage4.png",
  "./assets/images/stage5.png",
  "./assets/images/unit_strike.png",
  "./assets/images/unit_brace.png",
  "./assets/images/unit_disrupt.png",
  "./assets/images/unit_voidspawn.png",
  "./assets/video/stage_intro_1.mp4",
  "./assets/video/stage_intro_2.mp4",
  "./assets/video/stage_intro_3.mp4",
  "./assets/video/stage_intro_4.mp4",
  "./assets/video/stage_intro_5.mp4"
];

// Same-origin GET requests for the core closure: "./" (any trailing-slash
// navigation inside scope), or a pathname ending in one of the core suffixes.
function isCoreRequest(request) {
  if (request.method !== "GET") return false;
  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return false;
  }
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.endsWith("/")) return true;
  return CORE_SUFFIXES.some((suffix) => url.pathname.endsWith(suffix));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Allow fallback if some files are locally missing during dev
        return Promise.allSettled(
          ASSETS.map((asset) =>
            cache.add(asset).catch((err) => {
              console.warn(`Failed to cache ${asset}:`, err);
            })
          )
        );
      })
      // DET7-SW: the new worker takes over without a second manual reload.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            // Cache Storage is ORIGIN-wide (shared by every project page on
            // this github.io origin). Only clean up caches this app owns.
            if (key.startsWith("abyssal-surge-") && key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (isCoreRequest(request)) {
    // NETWORK-FIRST: fresh deploys win; on success refresh the cached copy.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            if (request.mode === "navigate") return caches.match("./index.html");
            return Response.error();
          })
        )
    );
    return;
  }

  // Cache-first for immutable media (audio/images/video) and everything else.
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request);
    })
  );
});
