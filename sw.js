const CACHE_NAME = "abyssal-surge-v1";
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
  "./assets/audio/narr_defeat.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Allow fallback if some files are locally missing during dev
      return Promise.allSettled(
        ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`Failed to cache ${asset}:`, err);
          })
        )
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
