const CACHE_NAME = "abyssal-surge-static-v38";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./battle-field-command-overlay.js",
  "./campaign-sync.js",
  "./stage-navigation.js",
  "./battle-visualizer.js",
  "./battle-presentation.js",
  "./battle-realtime-three.js",
  "./iso-math.js",
  "./tilemap-renderer.js",
  "./campaign-state.js",
  "./i18n.js",
  "./liquid-ether.js",
  "./vendor/three.module.min.js",
  "./vendor/loaders/GLTFLoader.js",
  "./vendor/utils/BufferGeometryUtils.js",
  "./styles.css",
  "./battle-field-command-overlay.css",
  "./sw.js",
  "./manifest.json",
  "./icon.svg",
  "./favicon.ico",
];

const GLB_BRIDGE_MANIFEST = "./assets/images/battle/glb/manifest.json";
const GLB_BRIDGE_PATH_PREFIX = new URL("./assets/images/battle/glb/", self.location.href).pathname;
const LAZY_SOURCE_BATTLE_PATHS = Object.freeze([
  "/assets/models/abyssal-command/terrain/cinder-span.glb",
  "/assets/models/abyssal-command/terrain/veil-citadel.glb",
  "/assets/models/abyssal-command/terrain/echo-throne-steps.glb",
  "/assets/models/abyssal-command/units/shade.glb",
  "/assets/models/abyssal-command/units/scout.glb",
  "/assets/models/abyssal-command/bosses/cinder-warden.glb",
  "/assets/models/abyssal-command/bosses/veil-tactician.glb",
  "/assets/models/abyssal-command/bosses/gate-sovereign.glb",
]);
function normalizeGlbBridgeManifestAsset(path) {
  if (typeof path !== "string") return null;
  const rawPath = path.split(/[?#]/, 1)[0];
  if (/(?:^|[\\/])(?:\.|%2e){1,2}(?=[\\/]|$)|%2f|%5c|\\/i.test(rawPath)) return null;
  try {
    const url = new URL(path, self.location.href);
    return url.origin === self.location.origin && url.pathname.startsWith(GLB_BRIDGE_PATH_PREFIX)
      ? url
      : null;
  } catch {
    return null;
  }
}


async function cacheGlbBattleBridge(cache) {
  const response = await fetch(GLB_BRIDGE_MANIFEST, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Bridge manifest pre-cache failed: ${GLB_BRIDGE_MANIFEST}`);
  }
  await cache.put(GLB_BRIDGE_MANIFEST, response.clone());
  const manifest = await response.json();
  const bridgeAssets = Array.isArray(manifest?.records)
    ? manifest.records
      .map((record) => normalizeGlbBridgeManifestAsset(record?.output?.path))
      .filter(Boolean)
    : [];
  await Promise.all(bridgeAssets.map(async (url) => {
    const assetResponse = await fetch(url, { cache: "no-store" });
    if (!assetResponse.ok) {
      throw new Error(`Bridge pre-cache failed: ${url}`);
    }
    await cache.put(url, assetResponse);
  }));
}

const OPTIONAL_MEDIA = [
  "./assets/images/cinder-span.png",
  "./assets/images/veil-citadel.png",
  "./assets/images/echo-throne.png",
  "./assets/images/sunken-bastion.png",
  "./assets/images/howling-sprawl.png",
  "./assets/images/glass-necropolis.png",
  "./assets/images/starless-canal.png",
  "./assets/images/shattered-causeway.png",
  "./assets/images/abyss-chancel.png",
  "./assets/images/gate-zenith.png",
  "./assets/images/ui/boss-tide-warden.png",
  "./assets/images/ui/boss-pack-herald.png",
  "./assets/images/ui/boss-requiem-choir.png",
  "./assets/images/ui/boss-lantern-tyrant.png",
  "./assets/images/ui/boss-bridge-colossus.png",
  "./assets/images/ui/boss-veiled-concordat.png",
  "./assets/images/ui/boss-abyss-regent.png",
  "./assets/images/storyboard/scene_00_opening_gate_v01.jpg",
  "./assets/images/storyboard/scene_01_soul_pool_v01.jpg",
  "./assets/images/storyboard/scene_03_possession_action_v01.jpg",
  "./assets/images/storyboard/scene_04_domain_shift_v01.jpg",
  "./assets/images/storyboard/scene_07_return_ui_v01.jpg",
  "./assets/images/ui/action-hunt.png",
  "./assets/images/ui/action-extract.png",
  "./assets/images/ui/action-materialize.png",
  "./assets/images/ui/action-capture.png",
  "./assets/images/ui/action-possess.png",
  "./assets/images/ui/action-domain.png",
  "./assets/images/ui/action-assault.png",
  "./assets/images/ui/reward-ember-cohort.png",
  "./assets/images/ui/reward-rift-lens.png",
  "./assets/images/ui/reward-veil-vanguard.png",
  "./assets/images/ui/reward-anchor-shard.png",
  "./assets/images/ui/reward-throne-echo.png",
  "./assets/images/ui/reward-dawnless-crown.png",
  "./assets/images/ui/boss-cinder-warden.png",
  "./assets/images/characters/dusk-legion-atlas.png",
  "./assets/images/ui/concept-tactical-surface.webp",
  "./assets/images/ui/boss-veil-tactician.png",
  "./assets/images/ui/boss-gate-sovereign.png",
  "./assets/images/ui/narration-atlases/boss-cinder-warden-atlas.png",
  "./assets/images/ui/narration-atlases/boss-veil-tactician-atlas.png",
  "./assets/images/ui/narration-atlases/boss-gate-sovereign-atlas.png",
  "./assets/images/ui/emblem-gate-sovereign.jpg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/audio/hunt.mp3",
  "./assets/audio/extract.mp3",
  "./assets/audio/materialize.mp3",
  "./assets/audio/capture.mp3",
  "./assets/audio/possess.mp3",
  "./assets/audio/domain.mp3",
  "./assets/audio/assault.mp3",
  "./assets/audio/reward.mp3",
  "./assets/audio/ambient.mp3",
  "./assets/audio/breach-alert.mp3",
  "./assets/audio/wave-spawn.mp3",
  "./assets/audio/battle-bgm.mp3",
  "./assets/audio/narr-intro.mp3",
  "./assets/audio/narr-stage1.mp3",
  "./assets/audio/narr-stage2.mp3",
  "./assets/audio/narr-stage3.mp3",
  "./assets/audio/narr-victory.mp3",
  "./assets/audio/narr-defeat.mp3",
  "./assets/audio/bgm-theme.mp3",
  "./assets/video/cinder-span.mp4",
  "./assets/video/veil-citadel.mp4",
  "./assets/video/echo-throne.mp4",
  "./assets/video/abyssal-surge-cinematic.mp4",
  "./assets/video/abyssal-surge-cinematic.ko.vtt"
];

function isSameOriginGet(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

function isCoreRequest(request) {
  if (!isSameOriginGet(request)) return false;
  const path = new URL(request.url).pathname;
  return path.endsWith("/") || ["/index.html", "/app.js", "/battle-field-command-overlay.js", "/campaign-sync.js", "/stage-navigation.js", "/battle-visualizer.js", "/battle-realtime-three.js", "/battle-presentation.js", "/iso-math.js", "/tilemap-renderer.js", "/campaign-state.js", "/i18n.js", "/liquid-ether.js", "/vendor/three.module.min.js", "/vendor/loaders/GLTFLoader.js", "/vendor/utils/BufferGeometryUtils.js", "/styles.css", "/battle-field-command-overlay.css", "/sw.js"].some((suffix) => path.endsWith(suffix));
}

function isGlbBridgeRequest(request) {
  return request.method === "GET" && normalizeGlbBridgeManifestAsset(request.url) !== null;
}

function isLazySourceBattleRequest(request) {
  if (!isSameOriginGet(request)) return false;
  const path = new URL(request.url).pathname;
  return LAZY_SOURCE_BATTLE_PATHS.some((suffix) => path.endsWith(suffix));
}

function isExpectedSourceGlbResponse(response) {
  const mediaType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  return response.status === 200 && mediaType === "model/gltf-binary";
}

async function networkFirstLazySourceBattle(request, event) {
  let resolveCache;
  const cacheLifetime = new Promise((resolve) => {
    resolveCache = resolve;
  });
  event.waitUntil(cacheLifetime);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (!response.ok) {
      resolveCache();
      const cached = await caches.match(request);
      return cached || response;
    }
    if (!isExpectedSourceGlbResponse(response)) {
      resolveCache();
      return response;
    }
    const bytes = await response.arrayBuffer();
    const responseInit = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    };
    const cachedResponse = new Response(bytes.slice(0), responseInit);
    caches.open(CACHE_NAME)
      .then((cache) => cache.put(request, cachedResponse))
      .catch(() => undefined)
      .then(resolveCache, resolveCache);
    return new Response(bytes, responseInit);
  } catch {
    resolveCache();
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

async function networkFirstGlbBridge(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (!response.ok) {
      const cached = await caches.match(request);
      return cached || response;
    }
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    } catch {
      // A live bridge response remains usable if cache storage is unavailable.
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        // Explicit no-store bypass: addAll()'s implicit fetch mode can still
        // serve heuristically-cached HTTP responses for changed core JS, so
        // every core asset is fetched fresh before being cached under the
        // bumped CACHE_NAME.
        await Promise.all(CORE_ASSETS.map(async (asset) => {
          const response = await fetch(asset, { cache: "no-store" });
          if (!response.ok) throw new Error(`Core asset ${asset} responded ${response.status}`);
          await cache.put(asset, response);
        }));
        await Promise.allSettled(OPTIONAL_MEDIA.map((asset) => cache.add(asset)));
        await cacheGlbBattleBridge(cache).catch(() => undefined);
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

  if (isLazySourceBattleRequest(request)) {
    event.respondWith(networkFirstLazySourceBattle(request, event));
    return;
  }

  if (isGlbBridgeRequest(request)) {
    event.respondWith(networkFirstGlbBridge(request));
    return;
  }
  if (isCoreRequest(request)) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
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
