import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { RealtimeBattle } from "../battle-realtime-three.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";
import { ObjectFeedbackLayer } from "../object-feedback-layer.js";

function makeRoot(x = 0, z = 0) {
  return {
    removed: false,
    position: {
      x,
      y: 0,
      z,
      set(nextX, nextY, nextZ) {
        this.x = nextX;
        this.y = nextY;
        this.z = nextZ;
        return this;
      },
    },
    userData: {},
    removeFromParent() {
      this.removed = true;
    },
  };
}

function makeUnit({ x = 0, z = 0, hp = 2, hit = 0 } = {}) {
  return { root: makeRoot(x, z), hp, hit, cooldown: 0, defeated: false };
}

function makeRetirableMixer() {
  return {
    stopped: 0,
    uncachedRoots: [],
    stopAllAction() {
      this.stopped += 1;
    },
    uncacheRoot(root) {
      this.uncachedRoots.push(root);
    },
    uncacheAction() {},
  };
}
async function initializeRendererPresentation(stageNumber = 7, { deferBackground = false } = {}) {
  const source = await readFile(new URL("../battle-realtime-three.js", import.meta.url), "utf8");
  const definition = source.match(/  async init\(\) \{[\s\S]*?\n  \}(?=\n\n  attachEvents\(\))/);
  assert.ok(definition, "renderer module must expose its initialization behavior");

  class Vector3 {
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  }
  class Color {
    constructor(value) {
      this.value = value;
    }
    lerp(other, alpha) {
      this.lerped = { value: other.value, alpha };
      return this;
    }
  }
  class WebGLRenderer {
    constructor(options) {
      this.options = options;
      this.shadowMap = {};
    }
    setPixelRatio(value) { this.pixelRatio = value; }
    setClearColor(color, alpha) { this.clearColor = { color, alpha }; }
    dispose() {}
  }
  class Scene {
    constructor() { this.children = []; }
    add(...children) { this.children.push(...children); }
  }
  class FogExp2 {
    constructor(color, density) {
      this.color = color;
      this.density = density;
    }
  }
  class PerspectiveCamera {
    constructor(...parameters) { this.parameters = parameters; }
  }
  class HemisphereLight {
    constructor(...parameters) { this.parameters = parameters; }
  }
  class AmbientLight {
    constructor(...parameters) {
      this.parameters = parameters;
      this.isAmbientLight = true;
    }
  }
  class DirectionalLight {
    constructor(...parameters) {
      this.parameters = parameters;
      this.position = new Vector3();
      this.shadow = { mapSize: {}, camera: {} };
    }
  }
  class PlaneGeometry {
    constructor(...parameters) { this.parameters = parameters; }
  }
  class MeshStandardMaterial {
    constructor(parameters) { this.parameters = parameters; }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.rotation = {};
      this.userData = {};
    }
  }
  class RingGeometry {
    constructor(...parameters) { this.parameters = parameters; }
  }
  class ParticleField {
    dispose() {}
  }
  const backgroundLoads = [];
  const pendingBackgroundLoads = [];
  class TextureLoader {
    load(url, onLoad) {
      const texture = {
        url,
        image: { width: 1600, height: 900 },
        repeat: { set() {} },
        offset: { set() {} },
        disposeCalls: 0,
        dispose() { this.disposeCalls += 1; },
      };
      backgroundLoads.push(texture);
      if (deferBackground) pendingBackgroundLoads.push(() => onLoad?.(texture));
      else queueMicrotask(() => onLoad?.(texture));
      return texture;
    }
  }

  const THREE = {
    ACESFilmicToneMapping: Symbol("ACESFilmicToneMapping"),
    PCFSoftShadowMap: Symbol("PCFSoftShadowMap"),
    SRGBColorSpace: Symbol("SRGBColorSpace"),
    ClampToEdgeWrapping: Symbol("ClampToEdgeWrapping"),
    Color,
    TextureLoader,
    WebGLRenderer,
    Scene,
    FogExp2,
    PerspectiveCamera,
    HemisphereLight,
    AmbientLight,
    DirectionalLight,
    PlaneGeometry,
    MeshStandardMaterial,
    Mesh,
    RingGeometry,
  };
  const context = vm.createContext({
    THREE,
    ParticleField,
    cappedPixelRatio: (_width, devicePixelRatio) => devicePixelRatio,
    FILL_LIGHT_INTENSITY: 0.65,
    FOG_DENSITY: 0.015,
    RIM_LIGHT_INTENSITY: 0.85,
    SHADOW_BIAS: -0.0008,
    SHADOW_CAMERA_FAR: 40,
    SHADOW_CAMERA_NEAR: 0.5,
    SHADOW_CAMERA_SIZE: 18,
    SHADOW_MAP_SIZE: 1024,
    TONE_MAPPING_EXPOSURE: 1.05,
    Number,
    performance: { now: () => 100 },
    requestAnimationFrame: () => 1,
    window: { devicePixelRatio: 2 },
  });
  const executable = definition[0].replace(/^  async init\(\)/, "async function init()");
  vm.runInContext(`${executable}\nglobalThis.initialize = init;`, context, { filename: "battle-realtime-three.js" });

  const webgl2Context = {};
  const contextRequests = [];
  const canvas = {
    getContext(...args) {
      contextRequests.push(args);
      return args[0] === "webgl2" ? webgl2Context : null;
    },
    removeEventListener() {},
  };
  const battle = {
    canvas,
    stageNumber,
    presentation: {
      palette: { accent: "#f0a040", ally: "#70e5d0", background: "#101827" },
    },
    destroyed: false,
    authoritativeLegion: null,
    navigation: { bounds: { left: -12, right: 12, near: -6, far: 6 } },
    raycaster: {},
    backgroundResizeCalls: 0,
    attachEvents() {},
    updateCamera() {},
    resize() {},
    resizeBackground() { this.backgroundResizeCalls += 1; },
    async loadStageAssets() {},
    createBattleObjects() {},
    reconcileEncounterWave() {},
    syncBossExposure() {},
    publishRuntimeState() {},
    destroy: RealtimeBattle.prototype.destroy,
    clearHover() {},
    clearActionPreview() {},
    clearEncounterWave() {},
    retire() {},
    bound: {},
    emitSelectionChange() {},
    allies: [],
    selection: new Set(),
    allyPickRoots: [],
    commander: null,
    boss: null,
    mixers: [],
    staticBlockers: [],
    disposedResources: new Set(),
    templates: new Map(),
    nodes: [],
    frame() {},
  };
  await context.initialize.call(battle);
  return {
    battle,
    THREE,
    types: { AmbientLight, FogExp2, RingGeometry },
    canvas,
    contextRequests,
    webgl2Context,
    backgroundLoads,
    completeBackgroundLoad() {
      pendingBackgroundLoads.shift()?.();
    },
    pendingBackgroundLoads,
  };
}

test("RealtimeBattle initialization applies atmospheric rendering and configured tactical markers", async () => {
  const { battle, THREE, types, canvas, contextRequests, webgl2Context, backgroundLoads } = await initializeRendererPresentation();
  assert.equal(contextRequests.length, 1, "realtime initialization must make exactly one context request");
  const [contextType, contextAttributes] = contextRequests[0];
  assert.equal(contextType, "webgl2", "realtime initialization must require WebGL2");
  assert.deepEqual(
    Object.fromEntries(Object.entries(contextAttributes)),
    { antialias: true, alpha: false },
    "realtime initialization must request the hardened opaque antialiased context",
  );
  assert.equal(battle.renderer.options.canvas, canvas, "WebGLRenderer must receive the battle canvas");
  assert.equal(
    battle.renderer.options.context,
    webgl2Context,
    "WebGLRenderer must receive the exact context returned by the battle canvas",
  );
  assert.deepEqual(
    battle.renderer.clearColor,
    { color: "#101827", alpha: 1 },
    "installing a concept-art backdrop must preserve the opaque stage clear-color contract",
  );
  assert.equal(backgroundLoads.length, 3, "browser initialization must request the stage backdrop plus the shared void-obsidian ground albedo/normal pair");
  assert.equal(backgroundLoads[0].url, "./assets/images/starless-canal.png", "stage 7 must select its authored concept-art backdrop");
  assert.equal(battle.scene.background, backgroundLoads[0], "the loaded backdrop texture must become the scene background");
  assert.equal(backgroundLoads[0].colorSpace, THREE.SRGBColorSpace, "backdrop textures must use the renderer output color space");
  assert.equal(backgroundLoads[0].wrapS, THREE.ClampToEdgeWrapping, "backdrop textures must clamp horizontally");
  assert.equal(backgroundLoads[0].wrapT, THREE.ClampToEdgeWrapping, "backdrop textures must clamp vertically");
  assert.equal(backgroundLoads[1].url, "./assets/models/abyssal-command/textures/void-obsidian-albedo.png", "the deck ground must request the shared void-obsidian albedo map");
  assert.equal(backgroundLoads[1].colorSpace, THREE.SRGBColorSpace, "the ground albedo map must use the renderer output color space");
  assert.equal(backgroundLoads[2].url, "./assets/models/abyssal-command/textures/void-obsidian-normal.png", "the deck ground must request the matching void-obsidian normal map");
  assert.equal(backgroundLoads[2].colorSpace, undefined, "normal maps must stay in linear space, never sRGB");
  assert.equal(battle.backgroundResizeCalls, 1, "installing the backdrop must fit it to the canvas through the public resize seam");

  assert.equal(battle.renderer.toneMapping, THREE.ACESFilmicToneMapping, "realtime rendering must use ACES filmic tone mapping");
  assert.deepEqual(
    { enabled: battle.renderer.shadowMap.enabled, type: battle.renderer.shadowMap.type },
    { enabled: true, type: THREE.PCFSoftShadowMap },
    "realtime rendering must enable PCF soft shadows",
  );
  assert.equal(battle.scene.fog instanceof types.FogExp2, true, "realtime rendering must use exponential atmospheric fog");
  assert.equal(battle.scene.fog.color, "#101827", "fog must use the active stage background palette");
  assert.equal(battle.ambientLight instanceof types.AmbientLight, true, "browser initialization must install the optional readability fill light");
  assert.equal(battle.ground.receiveShadow, true, "the tactical ground must receive unit and marker shadows");

  const shadowCamera = battle.keyLight.shadow.camera;
  assert.ok(shadowCamera.near > 0 && shadowCamera.far > shadowCamera.near, "shadow camera must define a positive near/far depth range");
  assert.equal(shadowCamera.left, -shadowCamera.right, "shadow camera must cover equal left and right tactical extents");
  assert.equal(shadowCamera.bottom, -shadowCamera.top, "shadow camera must cover equal top and bottom tactical extents");
  assert.ok(
    battle.keyLight.shadow.mapSize.width > 0
      && battle.keyLight.shadow.mapSize.width === battle.keyLight.shadow.mapSize.height,
    "directional shadows must use a nonzero square map",
  );
  assert.equal(battle.ringGeometry instanceof types.RingGeometry, true, "tactical markers must use ring geometry");
  assert.deepEqual(
    battle.ringGeometry.parameters,
    [0.8, 1.1, 16],
    "marker rings must retain a visible annulus with enough segments to read as circular",
  );
});

test("RealtimeBattle rejects a deferred backdrop completion after destroy with idempotent texture disposal", async (t) => {
  const priorDocument = globalThis.document;
  globalThis.document = { removeEventListener() {} };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
  });

  const {
    battle,
    backgroundLoads,
    completeBackgroundLoad,
    pendingBackgroundLoads,
  } = await initializeRendererPresentation(7, { deferBackground: true });
  const [texture] = backgroundLoads;
  assert.equal(pendingBackgroundLoads.length, 3, "the fixture must hold the backdrop plus the shared void-obsidian ground albedo/normal completions past initialization");

  battle.raf = 0;
  battle.destroy();
  assert.equal(texture.disposeCalls, 1, "destroy must dispose the loader-returned backdrop texture");

  completeBackgroundLoad();

  assert.equal(battle.scene.background, null, "a backdrop completed after destroy must not reattach to the dead scene");
  assert.equal(texture.disposeCalls, 1, "destroy and the deferred completion must dispose the late texture exactly once");
  assert.equal(battle.backgroundResizeCalls, 0, "a rejected late backdrop must not resize a destroyed renderer");
});

test("RealtimeBattle resize reapplies DPR tiers without changing the canvas dimensions or skipping projection updates", () => {
  const canvasRect = { width: 960, height: 540 };
  const pixelRatios = [];
  const canvasSizes = [];
  const camera = {
    aspect: 0,
    projectionUpdates: 0,
    updateProjectionMatrix() {
      this.projectionUpdates += 1;
    },
  };
  const canvas = {
    getBoundingClientRect() {
      return canvasRect;
    },
  };
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const viewport = { devicePixelRatio: 3, innerWidth: 901 };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: viewport,
  });

  try {
    const battle = new RealtimeBattle(canvas, { stageNumber: 1 });
    battle.renderer = {
      setPixelRatio(value) {
        pixelRatios.push(value);
      },
      setSize(width, height, updateStyle) {
        canvasSizes.push([width, height, updateStyle]);
      },
    };
    battle.camera = camera;

    for (const innerWidth of [901, 900, 481, 480]) {
      viewport.innerWidth = innerWidth;
      battle.resize();
    }

    assert.deepEqual(
      pixelRatios,
      [2, 1.5, 1.5, 1.25],
      "crossing the desktop and mobile width boundaries must reapply the matching DPR cap",
    );
    assert.deepEqual(
      canvasSizes,
      [
        [960, 540, false],
        [960, 540, false],
        [960, 540, false],
        [960, 540, false],
      ],
      "DPR tier changes must preserve the measured canvas dimensions and CSS size",
    );
    assert.equal(camera.aspect, 16 / 9, "resize must preserve the canvas aspect ratio in the camera");
    assert.equal(
      camera.projectionUpdates,
      4,
      "every threshold-crossing resize must publish the updated camera projection",
    );
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
  }
});

async function makeCameraFramingScenario(t, { width, height }) {
  const THREE = await import("../vendor/three.module.min.js");
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const rect = { width, height };
  const canvas = {
    getBoundingClientRect() {
      return { left: 0, top: 0, width: rect.width, height: rect.height };
    },
  };

  const viewport = {
    devicePixelRatio: 2,
    innerWidth: width,
    matchMedia: () => ({ matches: true }),
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: viewport,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: { activeElement: canvas },
  });
  t.after(() => {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete globalThis.document;
  });

  const battle = new RealtimeBattle(canvas, { stageNumber: 1 });
  battle.renderer = {
    setPixelRatio() {},
    setSize() {},
  };
  battle.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
  battle.commanderPosition.copy(battle.boundsCenter);
  battle.resize();
  battle.updateCamera(1);
  battle.camera.updateMatrixWorld(true);

  const { left, right, near, far } = battle.navigation.bounds;
  const corners = [
    { name: "near-left", x: left, z: near },
    { name: "near-right", x: right, z: near },
    { name: "far-left", x: left, z: far },
    { name: "far-right", x: right, z: far },
  ].map(({ name, x, z }) => {
    const y = battle.navigationAt(x, z).elevation * 0.42;
    return {
      name,
      projected: new THREE.Vector3(x, y, z).project(battle.camera),
    };
  });

  return {
    battle,
    corners,
    setViewport(nextWidth, nextHeight) {
      rect.width = nextWidth;
      rect.height = nextHeight;
      viewport.innerWidth = nextWidth;
    },
  };
}

test("RealtimeBattle projection-aware framing keeps every battlefield corner inside its safe NDC limit", async (t) => {
  const viewports = [
    { name: "wide 16:9 canvas", width: 1280, height: 720 },
    { name: "tall mobile canvas", width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    await t.test(viewport.name, async (t) => {
      const { battle, corners } = await makeCameraFramingScenario(t, viewport);
      const finiteValues = [
        ...battle.camera.position,
        ...battle.cameraTarget,
        ...battle.lookTarget,
        ...battle.cameraOffset,
        battle.zoom,
        battle.minFitZoom,
        ...corners.flatMap(({ projected }) => [projected.x, projected.y, projected.z]),
      ];

      assert.ok(
        finiteValues.every(Number.isFinite),
        "fit, target, position, and projected-corner math must remain finite",
      );
      for (const { name, projected } of corners) {
        assert.ok(
          Math.abs(projected.x) <= 0.84 && Math.abs(projected.y) <= 0.84,
          `${name} must remain inside the documented ±0.84 safe NDC bounds; received (${projected.x}, ${projected.y}) at zoom ${battle.zoom} and aspect ${battle.camera.aspect}`,
        );
        assert.ok(
          projected.z >= -1 && projected.z <= 1,
          `${name} must remain inside the camera near/far clip volume; received depth ${projected.z}`,
        );
      }
    });
  }
});

test("RealtimeBattle resize clamps manual zoom to the projection fit minimum without discarding a larger user zoom", async (t) => {
  const { battle, setViewport } = await makeCameraFramingScenario(t, { width: 1280, height: 720 });
  const wideMinimumFit = battle.minFitZoom;

  battle.onWheel({ deltaY: 250, preventDefault() {} });
  const wideUserZoom = battle.zoom;
  assert.ok(wideUserZoom > wideMinimumFit, "the wheel input must establish a manual zoom above the wide fit minimum");

  setViewport(390, 844);
  battle.resize();
  assert.ok(
    battle.minFitZoom > wideUserZoom,
    "the tall viewport must require more distance than the user's prior wide-screen zoom",
  );
  assert.equal(
    battle.zoom,
    battle.minFitZoom,
    "resizing must clamp a previously manual zoom to the new projection-safe minimum",
  );

  battle.onWheel({ deltaY: 250, preventDefault() {} });
  const tallUserZoom = battle.zoom;
  battle.resize();
  assert.ok(tallUserZoom > battle.minFitZoom, "the wheel input must establish a manual zoom above the tall fit minimum");
  assert.equal(
    battle.zoom,
    tallUserZoom,
    "resizing must preserve a user's wider zoom when it already clears the projection-safe minimum",
  );
});

test("RealtimeBattle mobile orbit fit keeps every sampled map point safe and wheel zoom cannot undercut it", async (t) => {
  const THREE = await import("../vendor/three.module.min.js");
  const focusCases = [
    { name: "overview", cell: null },
    { name: "near-left focus", cell: { x: 0, y: 0 } },
    { name: "far-right focus", cell: { x: 23, y: 11 } },
  ];

  for (const focusCase of focusCases) {
    await t.test(focusCase.name, async (t) => {
      const { battle } = await makeCameraFramingScenario(t, { width: 390, height: 844 });
      battle.scene = new THREE.Scene();
      battle.orbitAzimuth = 0.8;
      battle.orbitElevation = 0.9;
      battle.focusTacticalCell(focusCase.cell);
      battle.updateCamera(1);
      battle.camera.updateMatrixWorld(true);

      const projectMapSamples = () => {
        const samples = [];
        for (let gridY = 0; gridY <= battle.navigation.height; gridY += 1) {
          for (let gridX = 0; gridX <= battle.navigation.width; gridX += 1) {
            const world = battle.navigation.gridToWorld(gridX, gridY);
            const elevation = battle.navigationAt(world.x, world.z).elevation * 0.42;
            samples.push({
              gridX,
              gridY,
              projected: new THREE.Vector3(world.x, elevation, world.z).project(battle.camera),
            });
          }
        }
        return samples;
      };
      const assertSafeProjection = (samples, phase) => {
        const finiteValues = [
          battle.zoom,
          battle.minFitZoom,
          ...battle.camera.position,
          ...battle.cameraTarget,
          ...battle.lookTarget,
          ...samples.flatMap(({ projected }) => [projected.x, projected.y, projected.z]),
        ];
        assert.ok(
          finiteValues.every(Number.isFinite),
          `${focusCase.name} ${phase} fit must not publish non-finite camera or projection values`,
        );
        for (const { gridX, gridY, projected } of samples) {
          assert.ok(
            Math.abs(projected.x) <= 0.84 && Math.abs(projected.y) <= 0.84,
            `${focusCase.name} ${phase} grid sample (${gridX}, ${gridY}) must remain inside ±0.84 NDC; received (${projected.x}, ${projected.y}) at zoom ${battle.zoom}`,
          );
        }
      };

      assertSafeProjection(projectMapSamples(), "automatic");
      const fittedMinimum = battle.minFitZoom;
      battle.onWheel({ deltaY: -1_000_000, preventDefault() {} });
      assert.equal(
        battle.zoom,
        fittedMinimum,
        `${focusCase.name} zoom-in input must clamp at the verified mobile fit minimum`,
      );
      battle.updateCamera(1);
      battle.camera.updateMatrixWorld(true);
      assert.ok(
        battle.zoom >= battle.minFitZoom,
        `${focusCase.name} manual zoom must never remain below a recomputed fit minimum`,
      );
      assertSafeProjection(projectMapSamples(), "wheel-clamped");
    });
  }
});

test("RealtimeBattle computeMinFitZoom rejects depth-clipped points in a dense mobile sample set", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const target = new THREE.Vector3(0, 0, 0);
  const lookTarget = target.clone();
  const elevation = 0.9;
  const azimuth = 0.8;
  const aspect = 390 / 844;
  const denseSamples = [];

  for (let gridY = 0; gridY <= battle.navigation.height; gridY += 1) {
    for (let gridX = 0; gridX <= battle.navigation.width; gridX += 1) {
      const world = battle.navigation.gridToWorld(gridX, gridY);
      const y = battle.navigationAt(world.x, world.z).elevation * 0.42;
      denseSamples.push(new THREE.Vector3(world.x, y, world.z));
    }
  }
  battle.fitSamplePoints = () => denseSamples;

  const lateralFit = battle.computeMinFitZoom(target, lookTarget, elevation, azimuth, aspect);
  const clippedDistance = lateralFit + 0.05;
  const clippedHorizontal = Math.cos(elevation) * clippedDistance;
  const depthClippedSample = new THREE.Vector3(
    target.x + Math.cos(azimuth) * clippedHorizontal,
    target.y + Math.sin(elevation) * clippedDistance,
    target.z + Math.sin(azimuth) * clippedHorizontal,
  );
  denseSamples.push(depthClippedSample);

  const cameraAtLateralFit = new THREE.PerspectiveCamera(48, aspect, 0.1, 1e9);
  const lateralHorizontal = Math.cos(elevation) * lateralFit;
  cameraAtLateralFit.position.set(
    target.x + Math.cos(azimuth) * lateralHorizontal,
    target.y + Math.sin(elevation) * lateralFit,
    target.z + Math.sin(azimuth) * lateralHorizontal,
  );
  cameraAtLateralFit.lookAt(lookTarget);
  cameraAtLateralFit.updateMatrixWorld(true);
  const clippedProjection = depthClippedSample.clone().project(cameraAtLateralFit);
  assert.ok(
    clippedProjection.z < -1 || clippedProjection.z > 1,
    `the axial regression sample must be outside the clip volume at the lateral-only fit; received z=${clippedProjection.z}`,
  );
  assert.ok(
    Math.abs(clippedProjection.x) <= 0.84 && Math.abs(clippedProjection.y) <= 0.84,
    "the regression sample must isolate depth rejection rather than fail the existing lateral bounds",
  );

  const depthSafeFit = battle.computeMinFitZoom(target, lookTarget, elevation, azimuth, aspect);
  assert.ok(
    depthSafeFit > lateralFit,
    `a depth-clipped sample must expand the mobile fit beyond ${lateralFit}; received ${depthSafeFit}`,
  );

  const fittedCamera = new THREE.PerspectiveCamera(48, aspect, 0.1, 1e9);
  const fittedHorizontal = Math.cos(elevation) * depthSafeFit;
  fittedCamera.position.set(
    target.x + Math.cos(azimuth) * fittedHorizontal,
    target.y + Math.sin(elevation) * depthSafeFit,
    target.z + Math.sin(azimuth) * fittedHorizontal,
  );
  fittedCamera.lookAt(lookTarget);
  fittedCamera.updateMatrixWorld(true);
  for (const sample of denseSamples) {
    const projected = sample.clone().project(fittedCamera);
    assert.ok(
      Math.abs(projected.x) <= 0.84
        && Math.abs(projected.y) <= 0.84
        && projected.z >= -1
        && projected.z <= 1,
      `the returned mobile fit must contain every dense sample in x, y, and z; received (${projected.x}, ${projected.y}, ${projected.z})`,
    );
  }
});



test("RealtimeBattle safely ignores playback requests from clip-less runtime bindings", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });

  assert.doesNotThrow(
    () => battle.play({}),
    "a runtime binding that has not exposed animation clips must not break the command feedback path",
  );
});

test("RealtimeBattle clears held keyboard movement on canvas, window, and hidden-document focus loss without cancelling click-to-move", () => {
  const canvasListeners = new Map();
  const windowListeners = new Map();
  const documentListeners = new Map();
  const listeners = (target) => ({
    addEventListener(type, handler) {
      target.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (target.get(type) === handler) target.delete(type);
    },
  });
  const canvas = listeners(canvasListeners);
  const document = { ...listeners(documentListeners), activeElement: canvas, hidden: false };
  const window = listeners(windowListeners);
  const descriptors = new Map(
    ["document", "window", "ResizeObserver"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  Object.assign(globalThis, {
    document,
    window,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });

  const battle = new RealtimeBattle(canvas, { stageNumber: 1 });
  const commanderOrder = { x: 4, y: 0, z: -2 };
  const pressMovement = () => {
    document.activeElement = canvas;
    canvasListeners.get("keydown")({ code: "KeyW", preventDefault() {} });
    assert.deepEqual([...battle.pressed], ["KeyW"], "the movement key must be held before focus is lost");
  };
  const assertClearedWithoutCancellingOrder = (source, loseFocus) => {
    battle.commanderOrder = commanderOrder;
    pressMovement();
    loseFocus();
    assert.deepEqual([...battle.pressed], [], `${source} focus loss must clear held keyboard movement`);
    assert.strictEqual(
      battle.commanderOrder,
      commanderOrder,
      `${source} focus loss must preserve the active click-to-move commander order`,
    );
  };

  try {
    battle.attachEvents();
    assert.equal(typeof canvasListeners.get("blur"), "function", "the canvas must clear input when it loses focus");
    assert.equal(typeof windowListeners.get("blur"), "function", "the browser window must clear input when it loses focus");

    assertClearedWithoutCancellingOrder("canvas", () => {
      document.activeElement = null;
      canvasListeners.get("blur")();
    });
    assertClearedWithoutCancellingOrder("window", () => {
      document.activeElement = null;
      windowListeners.get("blur")();
    });
    assertClearedWithoutCancellingOrder("hidden document", () => {
      document.hidden = true;
      documentListeners.get("visibilitychange")();
      document.hidden = false;
    });
  } finally {
    battle.destroy();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test("RealtimeBattle projects WebGL pointer focus and clears it on cancellation, pointer exit, and canvas blur", () => {
  const canvasListeners = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const listeners = (target) => ({
    addEventListener(type, handler) {
      target.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (target.get(type) === handler) target.delete(type);
    },
  });
  const canvas = {
    ...listeners(canvasListeners),
    style: {},
    focus() {},
    setPointerCapture() {},
    hasPointerCapture: () => true,
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const document = { ...listeners(documentListeners), activeElement: canvas, hidden: false };
  const window = listeners(windowListeners);
  const descriptors = new Map(
    ["document", "window", "ResizeObserver"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  Object.assign(globalThis, {
    document,
    window,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });

  let availableActions = ["materialize"];
  const requestedActions = [];
  const focusedActions = [];
  const battle = new RealtimeBattle(
    canvas,
    { stageNumber: 1 },
    {
      getAvailableActions: () => availableActions,
      onActionRequest: (action) => {
        requestedActions.push(action);
        availableActions = [];
      },
      onActionFocus: (action) => focusedActions.push(action),
    },
  );
  const semanticRoot = { userData: { semantic: "materialize" }, parent: null };
  const semanticChild = { userData: {}, parent: semanticRoot };
  let hit = true;
  battle.camera = {};
  battle.raycaster = {
    setFromCamera() {},
    intersectObjects: () => (hit ? [{ object: semanticChild }] : []),
  };
  battle.interactives = [semanticRoot];

  try {
    battle.attachEvents();
    const pointer = {
      button: 0,
      clientX: 50,
      clientY: 50,
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 10,
    };

    canvasListeners.get("pointermove")(pointer);
    canvasListeners.get("pointermove")(pointer);
    hit = false;
    canvasListeners.get("pointermove")(pointer);
    const passiveHover = focusedActions.splice(0);

    hit = true;
    canvasListeners.get("pointerdown")(pointer);
    canvasListeners.get("pointercancel")(pointer);
    const pointercancel = focusedActions.splice(0);

    canvasListeners.get("pointermove")(pointer);
    canvasListeners.get("pointerleave")(pointer);
    const pointerleave = focusedActions.splice(0);

    canvasListeners.get("pointermove")(pointer);
    canvasListeners.get("blur")();
    const blur = focusedActions.splice(0);

    canvasListeners.get("pointerdown")(pointer);
    canvasListeners.get("pointerup")(pointer);
    const acceptedAction = focusedActions.splice(0);

    assert.deepEqual(
      { passiveHover, pointercancel, pointerleave, blur },
      {
        passiveHover: ["materialize", null],
        pointercancel: ["materialize", null],
        pointerleave: ["materialize", null],
        blur: ["materialize", null],
      },
      "WebGL focus callbacks must deduplicate stable hover and clear every command/dossier projection when interaction focus exits",
    );
    assert.deepEqual(
      requestedActions,
      [{
        type: "command-request",
        action: "materialize",
        requestId: "renderer-request-1",
        source: "renderer-pointer",
        rendererMode: "realtime-3d",
        occurredAt: 10,
      }],
      "eligible personal pointerup must dispatch a normalized renderer command request",
    );
    assert.equal(
      acceptedAction.at(-1),
      null,
      "accepted pointer action must refresh availability and clear stale WebGL focus after synchronous dispatch",
    );
  } finally {
    battle.destroy();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test("RealtimeBattle previewAction accepts the action-enriched DOM semantic and clears it through the renderer seam", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const semantic = Object.freeze({
    action: "hunt",
    source: "portal",
    target: "extractor",
    actor: "commander",
    actorClip: "Special",
    sourceAsset: "shade",
    clip: "Special",
  });

  battle.previewAction(semantic);
  assert.strictEqual(
    battle.previewActionSemantic,
    semantic,
    "DOM pointer or keyboard focus must project the exact action-enriched semantic supplied by the app bridge",
  );
  assert.deepEqual(
    Object.keys(battle.previewActionSemantic),
    Object.keys(semantic),
    "previewAction must not add undefined command metadata to the caller semantic",
  );

  battle.clearActionPreview();
  assert.equal(battle.previewActionSemantic, null, "DOM pointerout or blur must clear the renderer preview");
});

test("RealtimeBattle placement validation preserves the active deployment kind", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const receivedKinds = [];
  battle.navigation = {
    width: 24,
    height: 12,
    validateDeployment(_x, _y, _deployments, kind) {
      receivedKinds.push(kind);
      return { valid: kind === "tower" };
    },
  };

  battle.placementMode = "tower";
  assert.equal(battle.isPlacementLegal(8, 2), true, "tower preview must use tower route-blocking semantics");
  battle.placementMode = "barricade";
  assert.equal(battle.isPlacementLegal(8, 2), false, "barricade preview must use barricade route-blocking semantics");
  assert.deepEqual(receivedKinds, ["tower", "barricade"], "each WebGL preview must pass its current kind to the shared validator");
});

test("RealtimeBattle external focus is callback-pure and publishes minimap-compatible tactical state", () => {
  const tacticalRequests = [];
  const battle = new RealtimeBattle(
    null,
    { stageNumber: 1 },
    { onTacticalRequest: (request) => tacticalRequests.push(request) },
  );
  battle.updateFocusHighlight = () => {};
  const navigation = battle.navigation;
  battle.cachedNavigationSnapshot = {
    width: navigation.width,
    height: navigation.height,
    cells: navigation.cells,
    routes: navigation.routes.map(({ id, lane, cells }) => ({ id, lane, cells })),
    zones: navigation.zones.map(({ kind, cells }) => ({ kind, cells })),
    anchors: {
      portal: navigation.anchors.portal,
      boss: navigation.anchors.boss,
      extractor: navigation.anchors.extractor,
      rally: navigation.anchors.rally,
      alliedSpawn: navigation.anchors.alliedSpawn,
      nodes: navigation.anchors.nodes,
      hostileSpawns: navigation.anchors.hostileSpawns,
    },
  };
  battle.commander = { ...makeUnit({ x: -4, z: 0, hp: 3 }), id: "commander" };
  battle.allies = [{ ...makeUnit({ x: -2, z: 1, hp: 2 }), id: "ally-1" }];
  battle.enemies = [{ ...makeUnit({ x: 4, z: -1, hp: 2 }), id: "enemy-1" }];
  battle.deploymentsMap.set("tower-1", { id: "tower-1", kind: "tower", gridX: 8, gridY: 5 });

  battle.focusTacticalCell({ x: 8, y: 5 });
  const snapshot = battle.getTacticalSnapshot();

  assert.deepEqual(tacticalRequests, [], "applying minimap focus must not re-enter the tactical request callback");
  assert.deepEqual(
    {
      stageNumber: snapshot.stageNumber,
      navigationSize: [snapshot.navigation.width, snapshot.navigation.height],
      focus: snapshot.focus,
      units: snapshot.units,
      deployments: snapshot.deployments,
    },
    {
      stageNumber: 1,
      navigationSize: [24, 12],
      focus: { x: 8, y: 5 },
      units: [
        { id: "commander", team: 1, x: -4, z: 0, hp: 3 },
        { id: "ally-1", team: 1, x: -2, z: 1, hp: 2 },
        { id: "enemy-1", team: 2, x: 4, z: -1, hp: 2 },
      ],
      deployments: [{ id: "tower-1", kind: "tower", x: 8, y: 5 }],
    },
    "the WebGL snapshot must retain the navigation, world-unit, deployment, and focus fields consumed by the minimap",
  );
});

test("RealtimeBattle tactical snapshot reports the look target and perspective ground footprint", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  battle.camera = {
    aspect: 16 / 9,
    fov: 48,
    position: { x: 99, z: 88 },
  };
  battle.lookTarget.set(7, 2, -3);
  battle.zoom = 20;
  battle.orbitElevation = 0.9;

  const snapshotAt = ({ zoom = battle.zoom, aspect = battle.camera.aspect, elevation = battle.orbitElevation } = {}) => {
    battle.zoom = zoom;
    battle.camera.aspect = aspect;
    battle.orbitElevation = elevation;
    return battle.getTacticalSnapshot().viewport;
  };
  const assertFiniteFootprint = (viewport, context) => {
    assert.ok(viewport, `${context} must publish a viewport`);
    assert.ok(Number.isFinite(viewport.width) && viewport.width > 0, `${context} width must be finite and positive`);
    assert.ok(Number.isFinite(viewport.depth) && viewport.depth > 0, `${context} depth must be finite and positive`);
  };
  const closeTo = (actual, expected, context) => {
    assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12, `${context}: expected ${expected}, received ${actual}`);
  };

  const base = snapshotAt();
  const verticalSpan = 2 * Math.tan((48 * Math.PI / 180) / 2) * 20;
  assert.deepEqual(
    { x: base.x, z: base.z },
    { x: 7, z: -3 },
    "the minimap viewport center must follow lookTarget rather than the offset camera position",
  );
  assertFiniteFootprint(base, "the base perspective footprint");
  closeTo(base.width, verticalSpan * (16 / 9), "the viewport width must use the 48-degree vertical FOV and camera aspect");
  closeTo(base.depth, verticalSpan / Math.sin(0.9), "the viewport depth must project the vertical span through orbit elevation");

  const farther = snapshotAt({ zoom: 30, aspect: 16 / 9, elevation: 0.9 });
  assert.ok(farther.width > base.width && farther.depth > base.depth, "increasing camera distance must enlarge both world-space viewport dimensions");

  const narrow = snapshotAt({ zoom: 20, aspect: 3 / 4, elevation: 0.9 });
  assert.ok(narrow.width < base.width, "a narrower camera aspect must reduce world-space viewport width");
  closeTo(narrow.depth, base.depth, "camera aspect must not distort world-space viewport depth");

  const steeper = snapshotAt({ zoom: 20, aspect: 16 / 9, elevation: 1.15 });
  closeTo(steeper.width, base.width, "orbit elevation must not distort world-space viewport width");
  assert.ok(steeper.depth < base.depth, "a steeper orbit must reduce the ground-projected viewport depth");

  const guarded = snapshotAt({ zoom: Number.NaN, aspect: 0, elevation: Number.NaN });
  assertFiniteFootprint(guarded, "the guarded perspective footprint");
});

test("RealtimeBattle selected-unit orders follow the shared Stage 1 route around void", () => {
  const tacticalRequests = [];
  const canvas = {
    style: {},
    focus() {},
    setPointerCapture() {},
    hasPointerCapture: () => true,
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const battle = new RealtimeBattle(
    canvas,
    { stageNumber: 1 },
    { onTacticalRequest: (request) => tacticalRequests.push(request) },
  );
  const startCell = {
    x: Math.floor(battle.navigation.anchors.alliedSpawn.x),
    y: Math.floor(battle.navigation.anchors.alliedSpawn.y),
  };
  const targetCell = { x: 12, y: 2 };
  const authoredPath = battle.navigation.findPath(startCell, targetCell);
  const directCrossesVoid = Array.from({ length: 101 }, (_, step) => {
    const progress = step / 100;
    const x = startCell.x + 0.5 + (targetCell.x - startCell.x) * progress;
    const y = startCell.y + 0.5 + (targetCell.y - startCell.y) * progress;
    return !battle.navigation.walkable(x, y);
  }).some(Boolean);
  assert.ok(authoredPath && authoredPath.length > 2, "the Stage 1 fixture must expose a nontrivial shared route");
  assert.equal(directCrossesVoid, true, "the Stage 1 fixture's direct start-to-target segment must cross void");

  const startWorld = battle.navigation.gridToWorld(
    battle.navigation.anchors.alliedSpawn.x,
    battle.navigation.anchors.alliedSpawn.y,
  );
  const commanderWorld = battle.navigation.gridToWorld(3.5, 5.5);
  const targetWorld = battle.navigation.gridToWorld(targetCell.x + 0.5, targetCell.y + 0.5);
  battle.camera = {};
  battle.ground = {};
  battle.commander = makeUnit({ x: commanderWorld.x, z: commanderWorld.z });
  const ally = makeUnit({ x: startWorld.x, z: startWorld.z });
  battle.allies = [ally];
  battle.selection.add(ally);
  battle.raycaster = {
    setFromCamera() {},
    intersectObjects: () => [],
    intersectObject: () => [{ point: { x: targetWorld.x, y: 0, z: targetWorld.z } }],
  };
  battle.particles = { emit() {} };
  battle.audio = { playTone() {} };
  battle.play = () => {};
  const pointer = {
    button: 2,
    clientX: 50,
    clientY: 50,
    pointerId: 1,
    pointerType: "mouse",
    timeStamp: 10,
  };

  battle.onPointerDown(pointer);
  battle.onPointerUp(pointer);

  assert.deepEqual(tacticalRequests, [], "selected-unit movement must remain renderer-local");

  const visitedCells = new Set();
  let reachedTarget = false;
  for (let step = 0; step < 1200; step += 1) {
    battle.updateAllies(1 / 30);
    const cell = battle.navigation.worldToGrid(ally.root.position.x, ally.root.position.z);
    visitedCells.add(`${Math.floor(cell.x)},${Math.floor(cell.y)}`);
    if (Math.hypot(ally.root.position.x - targetWorld.x, ally.root.position.z - targetWorld.z) <= 0.16) {
      reachedTarget = true;
      break;
    }
  }

  assert.equal(reachedTarget, true, "the selected ally must reach the authored target instead of stopping at the void");
  assert.ok(visitedCells.size > 2, "the accepted order must traverse a nontrivial multi-cell route");
});




test("RealtimeBattle uses the unit Strike vocabulary for scout attacks", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const scout = makeUnit({ x: 2 });
  const target = makeUnit();
  const played = [];
  battle.play = (unit, clip, once) => played.push({ unit, clip, once });

  battle.enemyStrike(scout, target, 2);

  assert.equal(
    played.find(({ unit }) => unit === scout)?.clip,
    "Strike",
    "a scout uses the unit's exported Strike clip rather than a boss-only Attack clip",
  );
});

test("RealtimeBattle starts one-shot Defeat playback once when non-commander actors become defeated", () => {
  const enemyBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const enemyCommander = makeUnit();
  const ally = makeUnit();
  const enemy = makeUnit({ hp: 1 });
  const enemyPlays = [];
  enemyBattle.commander = enemyCommander;
  enemyBattle.allies = [ally];
  enemyBattle.enemies = [enemy];
  enemyBattle.engagements.set(ally, enemy);
  enemyBattle.engagements.set(enemy, ally);
  enemyBattle.play = (unit, clip, once) => enemyPlays.push({ unit, clip, once });

  enemyBattle.updateEngagements(1);
  enemyBattle.updateEngagements(1);

  const allyBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const allyCommander = makeUnit();
  const scout = makeUnit({ x: 2 });
  const defeatedAlly = makeUnit({ hit: 2 });
  const allyPlays = [];
  allyBattle.commander = allyCommander;
  allyBattle.allies = [defeatedAlly];
  allyBattle.enemies = [scout];
  allyBattle.engagements.set(defeatedAlly, scout);
  allyBattle.engagements.set(scout, defeatedAlly);
  allyBattle.play = (unit, clip, once) => allyPlays.push({ unit, clip, once });

  allyBattle.updateEngagements(2);
  allyBattle.updateEngagements(2);

  assert.equal(enemy.defeated, true, "lethal allied damage marks the enemy defeated");
  assert.equal(defeatedAlly.defeated, true, "the third scout hit marks a non-commander ally defeated");
  assert.deepEqual(
    enemyPlays.filter(({ clip }) => clip === "Defeat"),
    [{ unit: enemy, clip: "Defeat", once: true }],
    "a defeated enemy must start one finite Defeat clip and never restart it on later updates",
  );
  assert.deepEqual(
    allyPlays.filter(({ clip }) => clip === "Defeat"),
    [{ unit: defeatedAlly, clip: "Defeat", once: true }],
    "a defeated non-commander ally must start one finite Defeat clip and never restart it on later updates",
  );
});

test("RealtimeBattle keeps Defeat on a lethally assaulted exposed boss while live exposed bosses still AttackHeavy", () => {
  const lethalBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const lethalBoss = makeUnit({ hp: 16 });
  const lethalPlays = [];
  lethalBattle.boss = lethalBoss;
  lethalBattle.play = (unit, clip, once) => lethalPlays.push({ unit, clip, once });

  lethalBattle.applyCampaignState({ state: { legion: 0, bossHealth: 16, bossExposed: true } });
  lethalBattle.applyCampaignState({ state: { legion: 0, bossHealth: 0, bossExposed: true } });
  lethalBattle.playActionEffect({ action: "assault", source: "boss", target: "commander" });

  assert.equal(lethalBoss.defeated, true, "the final assault's campaign sync must defeat the boss");
  assert.deepEqual(
    lethalPlays,
    [{ unit: lethalBoss, clip: "Defeat", once: true }],
    "a lethal exposed-boss assault must leave the boss's one-shot Defeat playback intact",
  );

  const liveBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const liveBoss = makeUnit({ hp: 16 });
  const livePlays = [];
  liveBattle.boss = liveBoss;
  liveBattle.bossExposed = true;
  liveBattle.play = (unit, clip, once) => livePlays.push({ unit, clip, once });

  liveBattle.playActionEffect({ action: "assault", source: "boss", target: "commander" });

  assert.deepEqual(
    livePlays,
    [{ unit: liveBoss, clip: "AttackHeavy", once: true }],
    "a nonlethal exposed-boss assault must retain its boss AttackHeavy playback",
  );
});

test("RealtimeBattle clears a wave once every enemy is defeated or breach-retired while live enemies block completion", () => {
  const makeWaveBattle = () => {
    const events = [];
    const battle = new RealtimeBattle(
      null,
      { stageNumber: 1 },
      { onEncounterEvent: (event) => events.push(event) },
    );
    battle.currentWaveId = "scout";
    battle.encounter = {
      stageId: "cinder-span",
      state: { activeWaveId: "scout" },
    };
    return { battle, events };
  };

  const resolvedWave = makeWaveBattle();
  const defeated = makeUnit();
  const breached = makeUnit();
  defeated.defeated = true;
  breached.breachVisualized = true;
  resolvedWave.battle.enemies = [defeated, breached];

  resolvedWave.battle.updateEnemies(0);
  resolvedWave.battle.updateEnemies(0);

  assert.deepEqual(
    resolvedWave.events,
    [{ type: "wave-cleared", stageId: "cinder-span", waveId: "scout" }],
    "a mixed defeated-and-breached wave must clear once without repeating while its resolution is pending",
  );

  const blockedWave = makeWaveBattle();
  const live = makeUnit();
  live.breachVisualized = false;
  blockedWave.battle.enemies = [defeated, breached, live];
  blockedWave.battle.engagements.set(live, defeated);

  blockedWave.battle.updateEnemies(0);

  assert.deepEqual(
    blockedWave.events,
    [],
    "one live unresolved enemy must block wave completion even when every peer is defeated or breached",
  );
});

test("RealtimeBattle emits both same-tick enemy breaches before one wave-clear proposal and never repeats them", () => {
  const events = [];
  const battle = new RealtimeBattle(
    null,
    { stageNumber: 1 },
    { onEncounterEvent: (event) => events.push(event) },
  );
  const encounterState = Object.freeze({ activeWaveId: "scout" });
  battle.currentWaveId = "scout";
  battle.encounter = {
    stageId: "cinder-span",
    state: encounterState,
  };
  battle.particles = { emit() {} };
  battle.audio = { playTone() {} };
  battle.play = () => {};
  battle.shakeCamera = () => {};

  const portal = battle.navigation.gridToWorld(
    battle.navigation.anchors.portal.x,
    battle.navigation.anchors.portal.y,
  );
  const first = makeUnit({ x: portal.x, z: portal.z });
  const second = makeUnit({ x: portal.x, z: portal.z });
  first.id = "enemy-alpha";
  second.id = "enemy-bravo";
  first.waypoints = [];
  second.waypoints = [];
  battle.enemies = [first, second];

  battle.updateEnemies(0);
  battle.updateEnemies(0);

  assert.deepEqual(
    events,
    [
      { type: "breach", stageId: "cinder-span", waveId: "scout", enemyId: "enemy-alpha" },
      { type: "breach", stageId: "cinder-span", waveId: "scout", enemyId: "enemy-bravo" },
      { type: "wave-cleared", stageId: "cinder-span", waveId: "scout" },
    ],
    "each enemy must retain array-order identity, both breach proposals must precede the clear, and the next frame must emit nothing",
  );
  assert.deepEqual(
    encounterState,
    { activeWaveId: "scout" },
    "renderer proposals must not mutate the supplied authoritative encounter state",
  );
});



test("RealtimeBattle retires enemy animation mixers when an encounter wave is cleared", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const mixer = makeRetirableMixer();
  const enemy = { root: makeRoot(), mixer };
  battle.enemies = [enemy];
  battle.mixers = [mixer];

  battle.clearEncounterWave();

  assert.equal(enemy.root.removed, true, "cleared enemy root must leave the scene");
  assert.equal(mixer.stopped, 1, "cleared enemy mixer must stop all active actions");
  assert.deepEqual(mixer.uncachedRoots, [enemy.root], "cleared enemy mixer must release its cloned root");
  assert.deepEqual(battle.mixers, [], "cleared enemy mixer must not remain in the per-frame update list");
});

test("RealtimeBattle retires removed ally animation mixers during authoritative reconciliation", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const mixer = makeRetirableMixer();
  const ally = { root: makeRoot(), mixer, defeated: false };
  battle.scene = {};
  battle.templates.set("units/shade.glb", {});
  battle.allies = [ally];
  battle.mixers = [mixer];

  battle.reconcileAllies(0);

  assert.equal(ally.root.removed, true, "ally removed by authoritative count must leave the scene");
  assert.equal(mixer.stopped, 1, "removed ally mixer must stop all active actions");
  assert.deepEqual(mixer.uncachedRoots, [ally.root], "removed ally mixer must release its cloned root");
  assert.deepEqual(battle.mixers, [], "removed ally mixer must not remain in the per-frame update list");
});

test("RealtimeBattle exposes the shared 24×12 terrain walkability and elevation for 3D navigation", () => {
  const cinderSpan = new RealtimeBattle(null, { stageNumber: 1 });
  const veilCitadel = new RealtimeBattle(null, { stageNumber: 2 });
  const echoThrone = new RealtimeBattle(null, { stageNumber: 3 });

  const bridgeVoid = cinderSpan.navigationAt(-3, -3);
  assert.equal(bridgeVoid.x, 9, "Stage 1 navigation must map world space across all 24 grid columns");
  assert.equal(bridgeVoid.y, 3, "Stage 1 navigation must map world space across all 12 grid rows");
  assert.equal(
    bridgeVoid.walkable,
    false,
    "the Stage 1 bridge void must be unwalkable to 3D navigation just as it is on the 2D heightfield",
  );
  assert.deepEqual(
    veilCitadel.navigationAt(-3, -3.5),
    { x: 9, y: 2.5, elevation: 2, walkable: true },
    "the Stage 2 raised citadel must report the shared heightfield elevation",
  );
  assert.deepEqual(
    echoThrone.navigationAt(5, -0.5),
    { x: 17, y: 5.5, elevation: 0, walkable: true },
    "the Stage 3 throne approach must report the shared heightfield elevation",
  );
});

test("RealtimeBattle movement resolution rejects shared chasms and adopts shared terrain elevation", () => {
  const cinderSpan = new RealtimeBattle(null, { stageNumber: 1 });
  const veilCitadel = new RealtimeBattle(null, { stageNumber: 2 });
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let chasmTransition = null;
  for (const cell of cinderSpan.navigation.routes[0].cells) {
    const voidOffset = directions.find(([dx, dy]) => !cinderSpan.navigation.walkable(cell.x + dx, cell.y + dy));
    if (voidOffset) {
      chasmTransition = {
        from: cell,
        to: { x: cell.x + voidOffset[0], y: cell.y + voidOffset[1] },
      };
      break;
    }
  }
  assert.ok(chasmTransition, "Stage 1 must expose a legal route cell adjacent to a chasm");
  const bridgeStart = cinderSpan.navigation.gridToWorld(chasmTransition.from.x + 0.5, chasmTransition.from.y + 0.5);
  const bridgeTarget = cinderSpan.navigation.gridToWorld(chasmTransition.to.x + 0.5, chasmTransition.to.y + 0.5);
  const bridgeUnit = makeUnit({ x: bridgeStart.x, z: bridgeStart.z });
  bridgeUnit.radius = 0;

  const elevatedRoute = veilCitadel.navigation.routes[0].cells;
  const elevatedIndex = elevatedRoute.findIndex(
    (cell, index) => index > 0 && veilCitadel.navigation.heightAt(cell.x, cell.y) === 1,
  );
  assert.ok(elevatedIndex > 0, "Stage 2 must expose a reachable raised route cell");
  const plateauStart = veilCitadel.navigation.gridToWorld(
    elevatedRoute[elevatedIndex - 1].x + 0.5,
    elevatedRoute[elevatedIndex - 1].y + 0.5,
  );
  const plateauTarget = veilCitadel.navigation.gridToWorld(
    elevatedRoute[elevatedIndex].x + 0.5,
    elevatedRoute[elevatedIndex].y + 0.5,
  );
  const citadelUnit = makeUnit({ x: plateauStart.x, z: plateauStart.z });
  citadelUnit.radius = 0;

  const blockedAtChasm = cinderSpan.resolveMovement(bridgeUnit, bridgeTarget.x, bridgeTarget.z);
  assert.equal(blockedAtChasm.blocked, true, "a 3D unit must not enter the Stage 1 chasm");
  assert.equal(
    cinderSpan.navigationAt(blockedAtChasm.x, blockedAtChasm.z).walkable,
    true,
    "a blocked 3D move must finish on legal terrain",
  );
  assert.notDeepEqual(
    { x: blockedAtChasm.x, z: blockedAtChasm.z },
    bridgeTarget,
    "a blocked 3D move must not resolve onto its void target",
  );
  assert.deepEqual(
    veilCitadel.resolveMovement(citadelUnit, plateauTarget.x, plateauTarget.z),
    { x: plateauTarget.x, y: 0.42, z: plateauTarget.z, blocked: false },
    "a legal 3D move onto the Stage 2 plateau must take the same elevation as the shared heightfield",
  );
});

test("RealtimeBattle caps a stalled frame at six deterministic simulation steps", (t) => {
  const priorDocument = globalThis.document;
  const priorRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.document = { hidden: false };
  const scheduled = [];
  globalThis.requestAnimationFrame = (callback) => {
    scheduled.push(callback);
    return 91;
  };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
    if (priorRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = priorRequestAnimationFrame;
  });

  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const updates = [];
  let renders = 0;
  battle.running = true;
  battle.renderer = { render: () => { renders += 1; } };
  battle.scene = {};
  battle.camera = {};
  battle.update = (dt) => updates.push(dt);

  battle.frame(1000);

  assert.equal(updates.length, 6, "a one-second stall must not trigger more than six catch-up simulation steps");
  assert.ok(updates.every((dt) => dt === 1 / 60), "every catch-up step must use the fixed 60 Hz timestep");
  assert.equal(renders, 1, "the capped catch-up frame must still render exactly once");
  assert.deepEqual(scheduled, [battle.rafCallback], "the frame loop must schedule exactly one successor");
  assert.ok(battle.accumulator >= 0 && battle.accumulator < 1 / 60, "the capped frame must leave less than one simulation step queued");
});

test("RealtimeBattle spawns hostile waves from the 24×12 route frontage without legacy 16×8 coordinates", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 10 });
  const spawnCalls = [];
  battle.scene = { add() {} };
  battle.cloneTemplate = () => {
    const enemy = makeUnit();
    enemy.root.rotation = {};
    return enemy;
  };
  battle.resolveSpawn = (enemy, x, z) => {
    enemy.root.position.set(x, 0, z);
    spawnCalls.push({ x, z });
    return true;
  };
  battle.play = () => {};

  battle.spawnEncounterWave({ id: "zenith-wave", hostiles: 3, hostileHealth: 4 });

  const expectedSpawns = battle.navigation.routes.map((_, routeIndex) => {
    const spawnCell = battle.navigation.routePath(routeIndex, true)[0];
    return battle.navigation.gridToWorld(spawnCell.x + 0.5, spawnCell.y + 0.5);
  }).map(({ x, z }) => ({ x, z }));
  assert.deepEqual(spawnCalls, expectedSpawns, "each hostile route must spawn from its authored far-side endpoint");
  assert.equal(battle.enemies.length, 3, "the renderer must materialize every hostile in the supplied wave");
  battle.enemies.forEach((enemy, routeIndex) => {
    const spawnGrid = battle.navigation.worldToGrid(spawnCalls[routeIndex].x, spawnCalls[routeIndex].z);
    assert.equal(spawnGrid.x, 22.5, `route ${routeIndex + 1} must spawn beyond the legacy 16-column boundary`);
    assert.equal(enemy.waypoints.length, battle.navigation.routes[routeIndex].cells.length, `route ${routeIndex + 1} must retain its full authored path`);
    const finalGrid = battle.navigation.worldToGrid(enemy.waypoints.at(-1).x, enemy.waypoints.at(-1).z);
    assert.deepEqual(finalGrid, { x: 1.5, y: 5.5 }, `route ${routeIndex + 1} must terminate at the portal frontage`);
  });
});

test("RealtimeBattle reconcileEncounterWave spawns hostiles from the stage's recurringWave template once every authored wave id is exhausted", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 10 });
  battle.scene = { add() {} };
  battle.templates.set("units/scout.glb", {});
  battle.cloneTemplate = () => {
    const enemy = makeUnit();
    enemy.root.rotation = {};
    return enemy;
  };
  battle.resolveSpawn = (enemy, x, z) => {
    enemy.root.position.set(x, 0, z);
    return true;
  };
  battle.play = () => {};

  const recurringWave = Object.freeze({
    hostiles: 2,
    hostileHealth: 3,
    breachDamage: 1,
    pattern: "flanker",
    intervalSeconds: 65,
  });
  battle.encounter = {
    stageId: "gate-zenith",
    config: {
      waves: [{ id: "zenith-wave", hostiles: 3, hostileHealth: 4, cleared: true }],
      recurringWave,
    },
    state: { activeWaveId: "recurring-1" },
  };

  battle.reconcileEncounterWave("recurring-1");

  assert.equal(battle.currentWaveId, "recurring-1", "the recurring wave id (absent from the authored waves array) must still become the tracked active wave");
  assert.equal(battle.enemies.length, recurringWave.hostiles, "the renderer must spawn the recurring template's hostile count instead of silently spawning nothing");
  for (const enemy of battle.enemies) {
    assert.equal(enemy.hp, recurringWave.hostileHealth, "spawned hostiles must use the recurring template's health, not a default");
    assert.equal(enemy.archetype, "recurring-1", "spawned hostiles must be tagged with the recurring wave id for breach/clear tracking");
  }
});

test("RealtimeBattle maps Stage 1 waves to authored GLBs and later archetypes to the scout fallback", () => {
  const modelByWave = {};

  for (const waveId of ["scout", "guard", "reinforcement", "depthguard"]) {
    const battle = new RealtimeBattle(null, { stageNumber: 1 });
    for (const model of ["units/scout.glb", "units/guard.glb", "units/reinforce.glb"]) {
      battle.templates.set(model, {});
    }
    battle.scene = { add() {} };
    battle.resolveSpawn = () => true;
    battle.play = () => {};
    battle.cloneTemplate = (model) => {
      modelByWave[waveId] = model;
      const enemy = makeUnit();
      enemy.root.rotation = {};
      return enemy;
    };

    battle.spawnEncounterWave({ id: waveId, hostiles: 1, hostileHealth: 2 });
  }

  assert.deepEqual(
    modelByWave,
    {
      scout: "units/scout.glb",
      guard: "units/guard.glb",
      reinforcement: "units/reinforce.glb",
      depthguard: "units/scout.glb",
    },
    "only the declared Stage 1 waves may select dedicated GLBs; later archetypes must retain the scout fallback",
  );
});

test("RealtimeBattle rejects selected-unit orders that target the shared Stage 1 chasm", () => {
  const tacticalRequests = [];
  const failureParticles = [];
  const failureTones = [];
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const battle = new RealtimeBattle(
    canvas,
    { stageNumber: 1 },
    { onTacticalRequest: (request) => tacticalRequests.push(request) },
  );
  const start = battle.navigation.gridToWorld(
    battle.navigation.anchors.alliedSpawn.x,
    battle.navigation.anchors.alliedSpawn.y,
  );
  const ally = makeUnit({ x: start.x, z: start.z });
  battle.commander = makeUnit({ x: start.x, z: start.z });
  battle.allies = [ally];
  battle.selection.add(ally);
  battle.camera = {};
  battle.ground = {};
  battle.raycaster = {
    setFromCamera() {},
    intersectObjects: () => [],
    intersectObject: () => [{ point: { x: -3, y: 0, z: -3 } }],
  };
  battle.particles = { emit: (...args) => failureParticles.push(args) };
  battle.audio = { playTone: (...args) => failureTones.push(args) };
  battle.rally.set(start.x - 1.25, 0, start.z);
  battle.play = () => {};
  const priorRally = battle.rally.clone();

  battle.pick({ clientX: 50, clientY: 50 }, "allies");

  battle.updateAllies(1 / 30);
  assert.deepEqual(
    { x: ally.root.position.x, z: ally.root.position.z },
    { x: start.x, z: start.z },
    "an unreachable void target must not displace the selected ally horizontally from its legal formation position",
  );
  assert.deepEqual(
    battle.rally.toArray(),
    priorRally.toArray(),
    "rally input on the Stage 1 void must preserve the last legal rally point",
  );
  assert.equal(failureParticles.length, 1, "a rejected chasm order must emit one visible failure cue");
  assert.equal(failureTones.length, 1, "a rejected chasm order must emit one audible failure cue");
  assert.deepEqual(tacticalRequests, [], "a rejected selected-unit order must remain renderer-local");
});

test("RealtimeBattle movement resolution stops before static and live colliders", () => {
  const staticBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const staticMover = makeUnit({ x: -3, z: -0.5 });
  staticMover.radius = 0.42;
  staticBattle.commander = staticMover;
  staticBattle.staticBlockers = [{
    root: makeRoot(-0.5, -0.5),
    radius: 0.62,
    blocksMovement: true,
    active: () => true,
  }];

  const staticResult = staticBattle.resolveMovement(staticMover, 0, -0.5);

  assert.equal(staticResult.blocked, true, "the command node collider must block a commander before overlap");
  assert.ok(
    staticResult.x >= -1.56 && staticResult.x < -1.53,
    `the command node collider must stop at the combined-radius contact point (got x=${staticResult.x})`,
  );
  assert.equal(staticResult.z, -0.5, "static collision resolution must not introduce lateral drift");

  const liveBattle = new RealtimeBattle(null, { stageNumber: 1 });
  const liveMover = makeUnit({ x: -3, z: -0.5 });
  const liveBlocker = makeUnit({ x: -1, z: -0.5 });
  liveMover.radius = 0.42;
  liveBlocker.radius = 0.42;
  liveBattle.commander = liveMover;
  liveBattle.allies = [liveBlocker];

  const liveResult = liveBattle.resolveMovement(liveMover, 0, -0.5);

  assert.equal(liveResult.blocked, true, "a live ally must block a commander before overlap");
  assert.ok(
    liveResult.x >= -1.92 && liveResult.x < -1.8,
    `a live ally must stop at the first sampled position before combined-radius overlap (got x=${liveResult.x})`,
  );
  assert.equal(liveResult.z, -0.5, "live collision resolution must not introduce lateral drift");
});

test("RealtimeBattle resolves extractor feedback through the injected shared navigation anchor", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const defaultPoint = battle.actionFeedbackPoint("extractor");
  const baseNavigation = battle.navigation;
  const injectedAnchor = Object.freeze({ id: "extractor", x: 16.5, y: 5.5 });
  const gridToWorldCalls = [];
  battle.navigation = {
    ...baseNavigation,
    anchors: { ...baseNavigation.anchors, extractor: injectedAnchor },
    gridToWorld: (x, y) => {
      gridToWorldCalls.push({ x, y });
      return baseNavigation.gridToWorld(x, y);
    },
  };

  const injectedPoint = battle.actionFeedbackPoint("extractor");
  const injectedWorld = baseNavigation.gridToWorld(injectedAnchor.x, injectedAnchor.y);
  assert.deepEqual(
    gridToWorldCalls,
    [{ x: injectedAnchor.x, y: injectedAnchor.y }],
    "extractor feedback must resolve the current shared stage anchor through navigation.gridToWorld",
  );
  assert.deepEqual(
    injectedPoint,
    {
      x: injectedWorld.x,
      y: battle.navigationAt(injectedWorld.x, injectedWorld.z).elevation * 0.42,
      z: injectedWorld.z,
    },
    "extractor feedback must land on the injected shared navigation anchor",
  );
  assert.notDeepEqual(injectedPoint, defaultPoint, "changing the shared extractor anchor must move renderer feedback instead of retaining a legacy literal");
});

test("RealtimeBattle emits bounded directional feedback for every supported action without mutating authoritative combat state", () => {
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { ally: "#ally", accent: "#accent", hostile: "#hostile" },
  });
  const commander = makeUnit({ x: 1, z: 2 });
  const boss = makeUnit({ x: -2, z: 3 });
  const ally = makeUnit({ x: 4, z: -1 });
  const enemy = makeUnit({ x: -4, z: 1 });
  const portal = makeRoot(8, -2);
  const node = makeRoot(-5, 4);
  const campaign = Object.freeze({ state: Object.freeze({ phase: "active", legion: 2 }) });
  const particleCalls = [];
  const sampleCalls = [];
  const toneCalls = [];
  const shakeCalls = [];
  commander.root.position.y = 0.4;
  boss.root.position.y = 1;
  ally.root.position.y = 0.2;
  portal.position.y = 0.6;
  node.position.y = 0.8;
  battle.commander = commander;
  battle.boss = boss;
  battle.allies = [ally];
  battle.enemies = [enemy];
  battle.portal = portal;
  battle.node = { position: node.position, material: { emissiveIntensity: 0 } };
  battle.encounter = campaign;
  battle.authoritativeLegion = 2;
  battle.particles = { emit: (...args) => particleCalls.push(args) };
  battle.audio = {
    playSample: (...args) => sampleCalls.push(args),
    playTone: (...args) => toneCalls.push(args),
  };
  battle.shakeCamera = (...args) => shakeCalls.push(args);
  const hitStopCalls = [];
  battle.triggerHitStop = (duration) => hitStopCalls.push(duration);


  const extractorAnchor = battle.navigation.anchors.extractor;
  const extractorWorld = battle.navigation.gridToWorld(extractorAnchor.x, extractorAnchor.y);
  const extractor = {
    x: extractorWorld.x,
    y: battle.navigationAt(extractorWorld.x, extractorWorld.z).elevation * 0.42,
    z: extractorWorld.z,
  };
  const semantics = [
    { action: "hunt", source: "portal", target: "extractor" },
    { action: "extract", source: "extractor", target: "portal" },
    { action: "materialize", source: "portal", target: "portal" },
    { action: "capture", source: "portal", target: "node" },
    { action: "possess", source: "portal", target: "ally" },
    { action: "domain", source: "portal", target: "portal" },
    { action: "assault", source: "ally", target: "boss" },
  ];
  const feedback = semantics.map((semantic) => battle.emitActionFeedback(semantic));

  assert.deepEqual(
    battle.actionFeedbackPoint("extractor"),
    extractor,
    "extract feedback must use its authored coordinate on the expanded 24×12 tactical grid",
  );
  assert.deepEqual(
    feedback,
    [
      { action: "hunt", source: portal.position, target: extractor },
      { action: "extract", source: extractor, target: portal.position },
      { action: "materialize", source: portal.position, target: portal.position },
      { action: "capture", source: portal.position, target: node.position },
      { action: "possess", source: portal.position, target: ally.root.position },
      { action: "domain", source: portal.position, target: portal.position },
      { action: "assault", source: ally.root.position, target: boss.root.position },
    ],
    "each player action must preserve its semantic source and tactical target",
  );
  assert.deepEqual(
    particleCalls.map(([x, y, z, color, count]) => [x, Number(y.toFixed(2)), z, color, count]),
    [
      [8, 1.32, -2, "#accent", 5], [extractor.x, Number((extractor.y + 0.72).toFixed(2)), extractor.z, "#accent", 12],
      [extractor.x, Number((extractor.y + 0.72).toFixed(2)), extractor.z, "#ally", 5], [8, 1.32, -2, "#ally", 14],
      [8, 1.32, -2, "#ally", 8], [8, 1.32, -2, "#ally", 12],
      [8, 1.32, -2, "#accent", 7], [-5, 1.52, 4, "#accent", 18],
      [8, 1.32, -2, "#accent", 6], [4, 0.92, -1, "#accent", 16],
      [8, 1.32, -2, "#accent", 10], [8, 1.32, -2, "#accent", 14],
      [4, 0.92, -1, "#hostile", 11], [-2, 1.72, 3, "#hostile", 28],
    ],
    "each action must emit bounded source and target particle bursts in its semantic direction",
  );
  assert.deepEqual(
    sampleCalls.map(([action, x, y, z, gain]) => [action, x, Number(y.toFixed(2)), z, gain]),
    [
      ["hunt", 8, 1.32, -2, 0.52],
      ["extract", extractor.x, Number((extractor.y + 0.72).toFixed(2)), extractor.z, 0.58],
      ["materialize", 8, 1.32, -2, 0.7],
      ["capture", 8, 1.32, -2, 0.66],
      ["possess", 8, 1.32, -2, 0.62],
      ["domain", 8, 1.32, -2, 0.74],
      ["assault", 4, 0.92, -1, 0.78],
    ],
    "every feedback path must request its authored sample at the semantic source",
  );
  assert.deepEqual(
    toneCalls.map(([x, y, z, options]) => [x, Number(y.toFixed(2)), z, Number(options.gain.toFixed(3))]),
    [
      [extractor.x, Number((extractor.y + 0.72).toFixed(2)), extractor.z, 0.208],
      [8, 1.32, -2, 0.232],
      [-5, 1.52, 4, 0.264],
      [4, 0.92, -1, 0.248],
      [-2, 1.72, 3, 0.312],
    ],
    "distinct endpoints must add a directionally aligned target tone",
  );
  assert.ok(
    particleCalls.every(([, , , , count]) => count <= 28),
    "action feedback particles must stay within the bounded maximum burst size",
  );
  assert.equal(battle.portalPulse, 2.15, "portal-origin actions must leave a non-animated portal marker pulse");
  assert.equal(battle.nodePulse, 2.15, "capture must leave a non-animated command-node marker pulse");
  assert.deepEqual(shakeCalls, [[0.12, 0.18]], "only assault feedback may request camera shake");
  assert.deepEqual(
    hitStopCalls,
    [0.06],
    "assault feedback must request one bounded 0.06-second hit stop without extending command authority",
  );
  assert.equal(battle.encounter, campaign, "feedback must leave authoritative encounter configuration and state untouched");
  assert.equal(battle.authoritativeLegion, 2, "feedback must not change the campaign-authoritative legion count");
  assert.deepEqual(battle.allies, [ally], "feedback must not create or remove allied encounter units");
  assert.deepEqual(battle.enemies, [enemy], "feedback must not create or remove enemy encounter units");
  assert.equal(ally.root.removed, false, "feedback must not retire existing allies");
  assert.equal(enemy.root.removed, false, "feedback must not retire existing enemies");
});

test("RealtimeBattle resolves every verified action actor to the commander with supported clips", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const commander = makeUnit();
  const ally = makeUnit({ x: 2 });
  const boss = makeUnit({ x: -2 });
  const played = [];
  battle.commander = commander;
  battle.allies = [ally];
  battle.boss = boss;
  battle.portal = makeRoot(4, 1);
  battle.node = { position: makeRoot(-4, 1).position, material: { emissiveIntensity: 0 } };
  battle.bossExposed = false;
  battle.particles = null;
  battle.audio = { playSample() {}, playTone() {} };
  battle.play = (actor, clip, once) => played.push({ actor, clip, once });

  const semantics = [
    { action: "hunt", source: "portal", target: "extractor", actor: "commander", actorClip: "Special", clip: "Special" },
    { action: "extract", source: "extractor", target: "portal", actor: "commander", actorClip: "Special", clip: "Activate" },
    { action: "materialize", source: "portal", target: "portal", actor: "commander", actorClip: "Special", clip: "Activate" },
    { action: "capture", source: "portal", target: "node", actor: "commander", actorClip: "Special", clip: "Activate" },
    { action: "possess", source: "portal", target: "ally", actor: "commander", actorClip: "Special", clip: "Special" },
    { action: "domain", source: "portal", target: "portal", actor: "commander", actorClip: "Special", clip: "Activate" },
    { action: "assault", source: "ally", target: "boss", actor: "commander", actorClip: "Strike", clip: "Strike" },
  ];
  for (const semantic of semantics) battle.triggerAction(semantic);

  assert.deepEqual(
    played,
    semantics.map(({ actorClip }) => ({ actor: commander, clip: actorClip, once: true })),
    "all verified actions must route one-shot playback through the commander using actorClip rather than a source-atlas clip",
  );
  assert.ok(
    played.every(({ clip }) => clip === "Special" || clip === "Strike"),
    "commander playback must use only the model-proven Special or Strike clip vocabulary",
  );
});

test("RealtimeBattle materialize feedback stays renderer-local on the public action path", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const ally = makeUnit();
  const enemy = makeUnit({ x: 3 });
  const portal = makeRoot(6, -4);
  const campaign = Object.freeze({ state: Object.freeze({ phase: "active", legion: 2 }) });
  const particleCalls = [];
  const sampleCalls = [];
  const createCalls = [];
  const reconcileCalls = [];
  battle.allies = [ally];
  battle.enemies = [enemy];
  battle.portal = portal;
  battle.encounter = campaign;
  battle.authoritativeLegion = null;
  battle.running = true;
  battle.particles = { emit: (...args) => particleCalls.push(args) };
  battle.audio = { playSample: (...args) => sampleCalls.push(args) };
  battle.createAlly = (...args) => createCalls.push(args);
  battle.reconcileAllies = (...args) => reconcileCalls.push(args);
  battle.play = () => {};

  battle.triggerAction({ action: "materialize", source: "portal", target: "portal", count: 3 });

  assert.equal(particleCalls.length, 2, "materialize must emit bounded source and target renderer-local bursts");
  assert.deepEqual(sampleCalls, [["materialize", 6, 0.72, -4, 0.7]], "materialize must request its authored audio cue");
  assert.deepEqual(createCalls, [], "materialize feedback must not create units, even while the battle is running");
  assert.deepEqual(reconcileCalls, [], "materialize feedback must not reconcile units outside applyCampaignState");
  assert.equal(battle.encounter, campaign, "materialize feedback must not mutate encounter state");
  assert.equal(battle.authoritativeLegion, null, "materialize feedback must not mutate campaign-authoritative legion count");
  assert.deepEqual(battle.allies, [ally], "materialize feedback must not create or remove allies");
  assert.deepEqual(battle.enemies, [enemy], "materialize feedback must not create or remove enemies");
});

test("RealtimeBattle makes a melee exchange legible through midpoint and target-directed feedback", () => {
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { accent: "#gold", hostile: "#red" },
  });
  const ally = makeUnit({ x: -1, z: 2 });
  const enemy = makeUnit({ x: 3, z: -2 });
  const particleCalls = [];
  const toneCalls = [];
  battle.allies = [ally];
  battle.enemies = [enemy];
  battle.engagements.set(ally, enemy);
  battle.engagements.set(enemy, ally);
  battle.play = () => {};
  battle.particles = { emit: (...args) => particleCalls.push(args) };
  battle.audio = { playTone: (...args) => toneCalls.push(args) };

  battle.updateEngagements(1);

  assert.deepEqual(
    particleCalls,
    [
      [1, 0.9, 0, "#gold", 6, { speedMin: 1.2, speedMax: 2.8, life: 0.28, gravity: 4, upBias: 0.4 }],
      [ally.root.position.x, 0.8, ally.root.position.z, "#red", 8, { speedMin: 1.4, speedMax: 3.2, life: 0.32, gravity: 5 }],
    ],
    "each exchange must show a shared clash at the contact midpoint and a hostile impact on the struck ally",
  );
  assert.deepEqual(
    toneCalls.map(([x, y, z, options]) => ({ x, y, z, options })),
    [
      { x: 1, y: 0.9, z: 0, options: { freq: 900, endFreq: 320, duration: 0.09, type: "triangle", gain: 0.35 } },
      { x: -1, y: 0.8, z: 2, options: { freq: 220, endFreq: 90, duration: 0.14, type: "sawtooth", gain: 0.45 } },
    ],
    "each visual combat direction must have an aligned spatial sound cue",
  );
  assert.equal(ally.hit, 1, "the target receives exactly one combat hit for the exchange");
  assert.equal(enemy.hp, 1, "the attacker resolves exactly one combat hit against its paired enemy");
  assert.deepEqual(battle.allies, [ally], "combat feedback must not create or remove allied units");
  assert.deepEqual(battle.enemies, [enemy], "combat feedback must not create or remove enemy units");
});

test("RealtimeBattle loads every declared stage resource with or without a canvas test double", async () => {
  const expectedStageResources = new Map([
    [4, ["terrain/veil-citadel.glb", "bosses/cinder-warden.glb"]],
    [5, ["terrain/cinder-span.glb", "bosses/veil-tactician.glb"]],
    [6, ["terrain/veil-citadel.glb", "bosses/veil-tactician.glb"]],
    [7, ["terrain/cinder-span.glb", "bosses/gate-sovereign.glb"]],
    [8, ["terrain/echo-throne-steps.glb", "bosses/cinder-warden.glb"]],
    [9, ["terrain/veil-citadel.glb", "bosses/gate-sovereign.glb"]],
    [10, ["terrain/echo-throne-steps.glb", "bosses/gate-sovereign.glb"]],
  ]);

  for (const canvas of [null, {}]) {
    for (const [stageNumber, [terrain, boss]] of expectedStageResources) {
      const battle = new RealtimeBattle(canvas, { stageNumber });
      const loaded = [];
      battle.loadModel = async (resource) => {
        loaded.push(resource);
        return { animations: [] };
      };

      await battle.loadStageAssets();

      assert.equal(battle.stageNumber, stageNumber, `Stage ${stageNumber} must not be clamped to Stage 3.`);
      assert.deepEqual(
        { width: battle.navigation.width, height: battle.navigation.height },
        { width: 24, height: 12 },
        `Stage ${stageNumber} must initialize the expanded tactical navigation grid.`,
      );
      assert.deepEqual(
        loaded,
        [terrain, "units/shade.glb", "units/scout.glb", "units/guard.glb", "units/reinforce.glb", boss],
        `Stage ${stageNumber} must request every declared resource ${canvas ? "with" : "without"} a canvas test double.`,
      );
    }
  }
});

test("RealtimeBattle runtime presentation assets load possessed and echo-throne templates once without inflating required accounting", async () => {
  const statuses = [];
  const battle = new RealtimeBattle(
    null,
    { stageNumber: 3 },
    { onAssetStatus: (status) => statuses.push(status) },
  );
  const requests = [];
  battle.loadModel = async (resource) => {
    requests.push(resource);
    return { scene: {}, animations: [] };
  };

  const savedProcess = globalThis.process;
  try {
    globalThis.process = undefined;
    await battle.loadStageAssets();
  } finally {
    globalThis.process = savedProcess;
  }

  for (const resource of ["units/possessed.glb", "props/echo-throne.glb"]) {
    assert.equal(
      requests.filter((request) => request === resource).length,
      1,
      `${resource} must be requested exactly once during template loading`,
    );
    assert.equal(battle.templates.has(resource), true, `${resource} must enter the reusable template cache`);
  }
  assert.deepEqual(
    statuses.at(-1),
    { state: "loaded", loaded: 6, total: 6, clips: 0 },
    "optional presentation templates must not inflate the six required stage resources",
  );
});

test("RealtimeBattle runtime presentation assets render the possessed campaign ally from the possessed template", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const makeTemplate = (name) => {
    const scene = new THREE.Group();
    scene.name = name;
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    return { scene, animations: [] };
  };
  const battle = new RealtimeBattle(null, { stageNumber: 3 });
  battle.scene = new THREE.Scene();
  battle.contactGeometry = null;
  battle.contactMaterial = null;
  battle.templates.set("units/shade.glb", makeTemplate("shade-template"));
  battle.templates.set("units/possessed.glb", makeTemplate("possessed-template"));
  battle.resolveSpawn = () => true;
  battle.play = () => {};
  battle.applyEncounter = () => {};
  battle.reconcileDeployments = () => {};
  battle.updateNodeVisuals = () => {};

  battle.applyCampaignState({ state: { legion: 2, possessed: true } });

  assert.equal(battle.allies.length, 2, "authoritative legion count must still create both allied actors");
  assert.equal(battle.allies[0].isPossessed, true, "the authoritative possessed identity must remain attached to the first ally");
  assert.ok(
    battle.allies[0].root.getObjectByName("possessed-template"),
    "the possessed ally must visibly clone the possessed GLB rather than the ordinary shade GLB",
  );
  assert.ok(
    battle.allies[1].root.getObjectByName("shade-template"),
    "unpossessed allies must retain the ordinary shade identity",
  );
});

test("RealtimeBattle command-obelisk clones own highlight materials while retaining template-shared geometry", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const disposals = { sharedGeometry: 0, templateMaterial: 0, firstMaterial: 0, secondMaterial: 0 };
  const sharedGeometry = new THREE.BoxGeometry(1, 2, 1);
  sharedGeometry.dispose = () => { disposals.sharedGeometry += 1; };
  const templateMaterial = new THREE.MeshStandardMaterial({
    color: 0x334455,
    emissive: 0x111111,
    emissiveIntensity: 0.25,
  });
  templateMaterial.dispose = () => { disposals.templateMaterial += 1; };
  const templateScene = new THREE.Group();
  const templateMesh = new THREE.Mesh(sharedGeometry, templateMaterial);
  templateMesh.name = "command-obelisk-mesh";
  templateScene.add(templateMesh);

  const battle = new RealtimeBattle(null, { stageNumber: 3, reducedMotion: true });
  battle.contactGeometry = null;
  battle.contactMaterial = null;
  battle.templates.set("props/command-obelisk.glb", { scene: templateScene, animations: [] });

  const first = battle.cloneTemplate("props/command-obelisk.glb", 1.8);
  const second = battle.cloneTemplate("props/command-obelisk.glb", 1.8);
  const firstMesh = first.root.getObjectByName("command-obelisk-mesh");
  const secondMesh = second.root.getObjectByName("command-obelisk-mesh");

  assert.strictEqual(firstMesh.geometry, sharedGeometry, "first clone must reuse immutable template geometry");
  assert.strictEqual(secondMesh.geometry, sharedGeometry, "second clone must reuse immutable template geometry");
  assert.notStrictEqual(firstMesh.material, secondMesh.material, "distinct obelisk clones must not share mutable highlight material state");
  assert.notStrictEqual(firstMesh.material, templateMaterial, "first obelisk must not mutate the cached template material");
  assert.notStrictEqual(secondMesh.material, templateMaterial, "second obelisk must not mutate the cached template material");

  battle.applyInteractiveHighlight(first.root, "capture", true, false, 0.5, 0);
  battle.applyInteractiveHighlight(second.root, "capture", false, false, 0.5, 0);

  assert.ok(
    firstMesh.material.emissiveIntensity > secondMesh.material.emissiveIntensity,
    "hovering one obelisk must not raise the idle clone's emissive intensity",
  );
  assert.equal(templateMaterial.emissiveIntensity, 0.25, "clone highlighting must leave the cached template material unchanged");

  firstMesh.material.dispose = () => { disposals.firstMaterial += 1; };
  secondMesh.material.dispose = () => { disposals.secondMaterial += 1; };
  battle.retire(first);

  assert.deepEqual(
    disposals,
    { sharedGeometry: 0, templateMaterial: 0, firstMaterial: 1, secondMaterial: 0 },
    "retiring one obelisk must release only its owned material and keep template geometry plus the live clone intact",
  );
});

test("RealtimeBattle highlighted portal, extractor, boss, and obelisk clones isolate and retire their materials", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const disposals = {
    geometry: 0,
    texture: 0,
    templateMaterial: 0,
  };
  const sharedGeometry = new THREE.BoxGeometry(1, 2, 1);
  sharedGeometry.dispose = () => { disposals.geometry += 1; };
  const sharedTexture = new THREE.Texture();
  sharedTexture.dispose = () => { disposals.texture += 1; };
  const templateMaterial = new THREE.MeshStandardMaterial({
    color: 0x334455,
    emissive: 0x111111,
    emissiveIntensity: 0.25,
    metalness: 0.2,
    roughness: 0.6,
    map: sharedTexture,
  });
  templateMaterial.dispose = () => { disposals.templateMaterial += 1; };
  const templateScene = new THREE.Group();
  const templateMesh = new THREE.Mesh(sharedGeometry, templateMaterial);
  templateMesh.name = "interactive-template-mesh";
  templateScene.add(templateMesh);

  const cases = [
    { resource: "props/rift-portal.glb", semantic: "materialize" },
    { resource: "props/soul-extractor.glb", semantic: "extract" },
    { resource: "bosses/cinder-warden.glb", semantic: "assault" },
    { resource: "props/command-obelisk.glb", semantic: "capture" },
  ];
  const battle = new RealtimeBattle(null, { stageNumber: 1, reducedMotion: true });
  battle.contactGeometry = null;
  battle.contactMaterial = null;
  for (const { resource } of cases) {
    battle.templates.set(resource, { scene: templateScene, animations: [] });
  }

  const instances = cases.map(({ resource, semantic }) => {
    const first = battle.cloneTemplate(resource, 1.8);
    const second = battle.cloneTemplate(resource, 1.8);
    const firstMesh = first.root.getObjectByName("interactive-template-mesh");
    const secondMesh = second.root.getObjectByName("interactive-template-mesh");
    return { resource, semantic, first, second, firstMesh, secondMesh };
  });
  const runtimeMaterials = instances.flatMap(({ firstMesh, secondMesh }) => [
    firstMesh.material,
    secondMesh.material,
  ]);

  assert.equal(
    new Set([templateMaterial, ...runtimeMaterials]).size,
    1 + runtimeMaterials.length,
    "every highlighted runtime clone must own a material distinct from its template and every sibling",
  );
  for (const { resource, firstMesh, secondMesh } of instances) {
    assert.strictEqual(firstMesh.geometry, sharedGeometry, `${resource} must retain template-shared geometry`);
    assert.strictEqual(secondMesh.geometry, sharedGeometry, `${resource} sibling must retain template-shared geometry`);
    assert.strictEqual(firstMesh.material.map, sharedTexture, `${resource} must retain its template-shared texture`);
    assert.strictEqual(secondMesh.material.map, sharedTexture, `${resource} sibling must retain its template-shared texture`);
  }

  for (const { semantic, first, second, firstMesh, secondMesh } of instances) {
    const siblingBaseline = secondMesh.material.emissiveIntensity;
    battle.applyInteractiveHighlight(first.root, semantic, true, false, 0.8, 0);
    assert.ok(
      firstMesh.material.emissiveIntensity > siblingBaseline,
      `${semantic} hover must visibly mutate the targeted clone`,
    );
    assert.equal(
      secondMesh.material.emissiveIntensity,
      siblingBaseline,
      `${semantic} hover must not leak into its sibling clone`,
    );
    assert.equal(
      templateMaterial.emissiveIntensity,
      0.25,
      `${semantic} hover must not mutate the cached GLB template`,
    );
  }

  const ownedDisposals = new Map();
  for (const material of runtimeMaterials) {
    ownedDisposals.set(material, 0);
    material.dispose = () => ownedDisposals.set(material, ownedDisposals.get(material) + 1);
  }
  for (const { first, second } of instances) {
    battle.retire(first);
    battle.retire(first);
    battle.retire(second);
    battle.retire(second);
  }

  assert.equal(
    [...ownedDisposals.values()].every((count) => count === 1),
    true,
    "retire must dispose every runtime-owned material exactly once even when retirement is repeated",
  );
  assert.deepEqual(
    disposals,
    { geometry: 0, texture: 0, templateMaterial: 0 },
    "retire must preserve cached template materials and template-shared geometry and textures",
  );
});


test("RealtimeBattle runtime presentation assets activate one cached echo-throne clone on Domain replay", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const templateScene = new THREE.Group();
  templateScene.name = "echo-throne-template";
  templateScene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  const battle = new RealtimeBattle(null, { stageNumber: 3 });
  battle.scene = new THREE.Scene();
  battle.contactGeometry = null;
  battle.contactMaterial = null;
  battle.templates.set("props/echo-throne.glb", {
    scene: templateScene,
    animations: [new THREE.AnimationClip("Activate", 0.5, [])],
  });
  battle.emitActionFeedback = () => ({ action: "domain" });
  const activated = [];
  const play = battle.play;
  battle.play = function playObserved(instance, clip, once) {
    if (instance?.root?.getObjectByName?.("echo-throne-template")) activated.push({ instance, clip, once });
    return play.call(this, instance, clip, once);
  };
  let reloads = 0;
  battle.loadModel = async () => {
    reloads += 1;
    throw new Error("Domain replay must use the cached echo-throne template");
  };
  const domain = { action: "domain", source: "commander", target: "commander", actor: "commander", actorClip: "Special" };

  battle.triggerAction(domain);
  battle.triggerAction(domain);

  const renderedEchoThrones = [];
  battle.scene.traverse((node) => {
    if (node.name === "echo-throne-template") renderedEchoThrones.push(node);
  });
  assert.equal(renderedEchoThrones.length, 1, "Domain replay must reuse one visible echo-throne clone instead of stacking props");
  assert.equal(new Set(activated.map(({ instance }) => instance)).size, 1, "both Domain cues must target the same echo-throne instance");
  assert.deepEqual(
    activated.map(({ clip, once }) => ({ clip, once })),
    [{ clip: "Activate", once: true }, { clip: "Activate", once: true }],
    "each accepted Domain cue must request the authored one-shot Activate clip",
  );
  assert.equal(reloads, 0, "Domain replay must never reload an already cached echo-throne GLB");
});

test("RealtimeBattle runtime presentation assets tolerate optional identity load failure without changing required accounting", async () => {
  const failedOptional = new Set(["units/possessed.glb", "props/echo-throne.glb"]);
  const statuses = [];
  const requests = [];
  const battle = new RealtimeBattle(
    null,
    { stageNumber: 3 },
    { onAssetStatus: (status) => statuses.push(status) },
  );
  battle.loadModel = async (resource) => {
    requests.push(resource);
    if (failedOptional.has(resource)) throw new Error(`Unable to load ${resource}`);
    return { scene: {}, animations: [] };
  };

  const savedProcess = globalThis.process;
  try {
    globalThis.process = undefined;
    await assert.doesNotReject(
      battle.loadStageAssets(),
      "missing possessed and echo-throne presentation models must not prevent renderer startup",
    );
  } finally {
    globalThis.process = savedProcess;
  }

  assert.deepEqual(
    [...failedOptional].filter((resource) => requests.includes(resource)).sort(),
    [...failedOptional].sort(),
    "startup must attempt each optional identity resource before falling back",
  );
  assert.deepEqual(
    statuses.at(-1),
    { state: "loaded", loaded: 6, total: 6, clips: 0 },
    "optional failures must report the required stage-resource accounting accurately",
  );
  assert.equal(
    ["terrain/echo-throne-steps.glb", "units/shade.glb", "units/scout.glb", "units/guard.glb", "units/reinforce.glb", "bosses/gate-sovereign.glb"]
      .every((resource) => battle.templates.has(resource)),
    true,
    "all required stage templates must remain available after optional presentation failures",
  );
});

test("RealtimeBattle runtime presentation assets destroy an owned echo-throne clone without double-disposing its shared template", async (t) => {
  const THREE = await import("../vendor/three.module.min.js");
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: { removeEventListener() {} },
  });
  t.after(() => {
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete globalThis.document;
  });

  const disposals = { sharedGeometry: 0, sharedMaterial: 0, ownedGeometry: 0, ownedMaterial: 0 };
  const sharedGeometry = new THREE.BoxGeometry(1, 1, 1);
  sharedGeometry.dispose = () => { disposals.sharedGeometry += 1; };
  const sharedMaterial = new THREE.MeshStandardMaterial();
  sharedMaterial.dispose = () => { disposals.sharedMaterial += 1; };
  const ownedGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  ownedGeometry.dispose = () => { disposals.ownedGeometry += 1; };
  const ownedMaterial = new THREE.MeshStandardMaterial();
  ownedMaterial.userData.isRuntimeAssetClone = true;
  ownedMaterial.dispose = () => { disposals.ownedMaterial += 1; };
  const templateScene = new THREE.Group();
  templateScene.add(new THREE.Mesh(sharedGeometry, sharedMaterial));
  templateScene.clone = () => {
    const clone = new THREE.Group();
    clone.name = "echo-throne-template";
    clone.add(new THREE.Mesh(sharedGeometry, sharedMaterial));
    clone.add(new THREE.Mesh(ownedGeometry, ownedMaterial));
    return clone;
  };

  const canvas = { removeEventListener() {} };
  const battle = new RealtimeBattle(canvas, { stageNumber: 3 });
  battle.scene = new THREE.Scene();
  battle.contactGeometry = null;
  battle.contactMaterial = null;
  battle.templates.set("props/echo-throne.glb", {
    scene: templateScene,
    animations: [new THREE.AnimationClip("Activate", 0.5, [])],
  });
  battle.emitActionFeedback = () => ({ action: "domain" });
  battle.triggerAction({ action: "domain", source: "commander", target: "commander", actor: "commander" });

  assert.ok(
    battle.scene.getObjectByName("echo-throne-template"),
    "fixture requires Domain to materialize the runtime-owned echo-throne clone",
  );
  assert.deepEqual(disposals, { sharedGeometry: 0, sharedMaterial: 0, ownedGeometry: 0, ownedMaterial: 0 });

  battle.destroy();
  battle.destroy();

  assert.deepEqual(
    disposals,
    { sharedGeometry: 1, sharedMaterial: 1, ownedGeometry: 1, ownedMaterial: 1 },
    "destroy must release clone-owned resources and each cache-shared template resource exactly once",
  );
});

test("ParticleField recycles the fixed-capacity pool instead of growing unbounded", async () => {
  const { ParticleField } = await import("../battle-realtime-three.js");
  const added = [];
  const scene = { add: (object) => added.push(object) };
  const field = new ParticleField(scene);

  assert.equal(field.capacity, 360, "particle pool capacity must match the documented budget");
  assert.equal(added.length, 1, "constructing a ParticleField must add exactly one Points object to the scene");

  field.emit(0, 0, 0, "#ffffff", 400, {});
  const aliveCount = Array.from(field.alive).filter((flag) => flag === 1).length;
  assert.equal(aliveCount, 360, "emitting more particles than capacity must recycle oldest slots, never exceed capacity");
  assert.equal(field.cursor, 40, "cursor must wrap modulo capacity after overflowing (400 % 360 = 40)");

  field.update(10);
  const aliveAfterLongDt = Array.from(field.alive).filter((flag) => flag === 1).length;
  assert.equal(aliveAfterLongDt, 0, "a long enough dt must expire every particle back to the dead pool");

  field.dispose();
});

test("SpatialAudio constructs safely with a null AudioContext outside a browser environment", async () => {
  const { SpatialAudio } = await import("../battle-realtime-three.js");
  const audio = new SpatialAudio();

  assert.equal(audio.ctx, null, "non-browser SpatialAudio must not construct a real AudioContext");
  assert.equal(audio.master, null, "non-browser SpatialAudio must not construct a master gain node");
  assert.doesNotThrow(() => audio.playTone(0, 0, 0, { freq: 440 }), "playTone must tolerate a null AudioContext");
  assert.doesNotThrow(() => audio.playSample("hunt", 0, 0, 0, 1), "playSample must tolerate a null AudioContext");
  assert.doesNotThrow(() => audio.updateListener({ position: { x: 0, y: 0, z: 0 } }), "updateListener must tolerate a null AudioContext");
});

test("SpatialAudio abandons pending sample playback when disposed before decoding completes", async () => {
  const { promise: decodeStarted, resolve: markDecodeStarted } = Promise.withResolvers();
  const { promise: decoded, resolve: finishDecode } = Promise.withResolvers();
  const calls = { gains: 0, panners: 0, sources: 0, starts: 0 };
  const node = {
    gain: { value: 0 },
    connect(target) {
      return target;
    },
    disconnect() {},
  };

  class PendingDecodeAudioContext {
    state = "running";
    destination = {};

    createGain() {
      calls.gains += 1;
      return { ...node, gain: { value: 0 } };
    }

    createPanner() {
      calls.panners += 1;
      return { ...node };
    }

    createBufferSource() {
      calls.sources += 1;
      return {
        ...node,
        addEventListener() {},
        start() {
          calls.starts += 1;
        },
      };
    }

    decodeAudioData() {
      markDecodeStarted();
      return decoded;
    }

    close() {
      this.state = "closed";
      return Promise.resolve();
    }
  }

  const descriptors = new Map(
    ["fetch", "window"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { AudioContext: PendingDecodeAudioContext },
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }),
  });

  try {
    const { SpatialAudio } = await import("../battle-realtime-three.js");
    const audio = new SpatialAudio();
    calls.gains = 0;
    const playback = audio.playSample("hunt", 1, 2, 3, 0.5);

    await decodeStarted;
    audio.dispose();
    finishDecode({});

    await assert.doesNotReject(playback, "a disposed pending playback must settle without dereferencing cleared audio state");
    assert.deepEqual(
      calls,
      { gains: 0, panners: 0, sources: 0, starts: 0 },
      "resolving decode after disposal must not create playback nodes or start late audio",
    );
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test("RealtimeBattle triggers boss defeat feedback exactly once when applyCampaignState reports bossHealth reaching zero", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1, palette: { hostile: "#ff7f79" } });
  const boss = makeUnit({ x: 3, z: 5 });
  battle.boss = boss;
  const defeatCalls = [];
  const originalDefeat = battle.defeat.bind(battle);
  battle.defeat = (unit) => {
    defeatCalls.push(unit);
    return originalDefeat(unit);
  };

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 8 } });
  assert.deepEqual(defeatCalls, [], "the first sync at full boss health must not trigger defeat");

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 3 } });
  assert.deepEqual(defeatCalls, [], "a partial-damage sync must not trigger defeat");

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 0 } });
  assert.deepEqual(defeatCalls, [boss], "bossHealth transitioning to zero must call defeat(this.boss) exactly once");
  assert.equal(boss.defeated, true, "the boss instance itself must be marked defeated");

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 0 } });
  assert.deepEqual(defeatCalls, [boss], "a repeated zero-health sync must not re-trigger defeat (defeat() is itself idempotent via unit.defeated)");
});

test("RealtimeBattle hydrates an initially defeated boss without replaying transition feedback", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1, palette: { hostile: "#ff7f79" } });
  const boss = makeUnit({ x: 3, z: 5 });
  const particles = [];
  const tones = [];
  const animations = [];
  battle.boss = boss;
  battle.particles = { emit: (...args) => particles.push(args) };
  battle.audio = { playTone: (...args) => tones.push(args) };
  battle.play = (actor, clip, restart) => animations.push({ actor, clip, restart });

  battle.applyCampaignState({ state: { bossHealth: 0, bossMaxHealth: 8 } });

  assert.equal(boss.hp, 0, "the first authoritative snapshot must hydrate the boss's zero health");
  assert.equal(boss.defeated, true, "an initially zero-health boss must enter the defeated state");
  assert.deepEqual(
    animations,
    [{ actor: boss, clip: "Defeat", restart: true }],
    "initial defeat hydration must put the boss in its authored Defeat animation",
  );
  assert.deepEqual(
    { particles, tones },
    { particles: [], tones: [] },
    "initial defeat hydration must not replay transition-only particles or audio",
  );
});

test("RealtimeBattle applyCampaignState does not defeat the boss on a fresh stage entry at full health after a prior defeat", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1, palette: { hostile: "#ff7f79" } });
  const boss = makeUnit({ x: 3, z: 5 });
  battle.boss = boss;

  battle.applyCampaignState({ state: { legion: 0, bossHealth: 8 } });
  battle.applyCampaignState({ state: { legion: 0, bossHealth: 0 } });
  assert.equal(boss.defeated, true, "boss must be defeated once its health reaches zero");

  const nextBoss = makeUnit({ x: -1, z: 2 });
  battle.boss = nextBoss;
  battle.applyCampaignState({ state: { legion: 0, bossHealth: 12 } });
  assert.equal(nextBoss.defeated, false, "a fresh boss instance on stage retry/advance must not start pre-defeated");
});

test("RealtimeBattle shakeCamera lets a weaker overlapping pulse decay smoothly instead of spiking the envelope", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });

  battle.shakeCamera(0.35, 0.5);
  assert.equal(battle.shakeMagnitude, 0.35);
  assert.equal(battle.shakeDuration, 0.5);

  // Simulate 0.45s of decay (0.05s of the 0.5s duration remaining): residual strength = 0.35 * 0.05/0.5 = 0.035.
  battle.shakeTime = 0.05;
  const strengthBeforeWeakerPulse = battle.shakeMagnitude * (battle.shakeDuration > 0 ? battle.shakeTime / battle.shakeDuration : 0);
  assert.ok(Math.abs(strengthBeforeWeakerPulse - 0.035) < 1e-9, "sanity: the shake must have decayed to the expected residual strength");

  // A pulse weaker than the current residual strength (e.g. a footstep-dust-scale event) must not spike the envelope back up.
  battle.shakeCamera(0.02, 0.22);
  assert.equal(battle.shakeMagnitude, 0.35, "a pulse weaker than the still-decaying residual strength must not overwrite the peak magnitude");
  assert.equal(battle.shakeDuration, 0.5, "a weaker pulse must not reset the decay envelope's duration denominator");
  assert.equal(battle.shakeTime, 0.05, "a weaker pulse must not extend the remaining shake time");

  // A pulse stronger than the current residual strength (but weaker than the original peak) correctly takes over as the new envelope.
  battle.shakeCamera(0.14, 0.22);
  assert.equal(battle.shakeMagnitude, 0.14, "a pulse stronger than the current residual strength must take over as the new envelope, even if weaker than the original peak");
  assert.equal(battle.shakeDuration, 0.22);
  assert.equal(battle.shakeTime, 0.22);

  battle.shakeCamera(0.5, 0.3);
  assert.equal(battle.shakeMagnitude, 0.5, "a pulse stronger than the current envelope must take over");
  assert.equal(battle.shakeDuration, 0.3);
  assert.equal(battle.shakeTime, 0.3);
});

test("RealtimeBattle restores rally-to-commander grouping on possess and domain actions", () => {
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { ally: "#ally", accent: "#accent", hostile: "#hostile" },
  });
  battle.commanderPosition.set(4, 0, -2);
  battle.play = () => {};

  battle.playActionEffect({ action: "possess", source: "portal", target: "ally", actor: "commander" });
  assert.deepEqual(
    { x: battle.rally.x, y: battle.rally.y, z: battle.rally.z },
    { x: 4, y: 0, z: -2 },
    "possess must rally allies to the commander's current position",
  );

  battle.rally.set(99, 0, 99);
  battle.playActionEffect({ action: "domain", source: "portal", target: "portal", actor: "commander" });
  assert.deepEqual(
    { x: battle.rally.x, y: battle.rally.y, z: battle.rally.z },
    { x: 4, y: 0, z: -2 },
    "domain must also rally allies to the commander's current position",
  );

  battle.rally.set(99, 0, 99);
  battle.playActionEffect({ action: "hunt", source: "portal", target: "extractor", actor: "commander" });
  assert.deepEqual(
    { x: battle.rally.x, y: battle.rally.y, z: battle.rally.z },
    { x: 99, y: 0, z: 99 },
    "actions other than possess/domain must not touch the rally point",
  );
});

test("RealtimeBattle retire() disposes boss-identity-tint material clones without touching template-shared materials", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  let disposedCount = 0;
  const tintedMaterial = { userData: { isBossIdentityTint: true }, dispose: () => { disposedCount += 1; } };
  const sharedMaterial = { userData: {}, dispose: () => { disposedCount += 1; } };
  const boss = {
    root: {
      traverse(visit) {
        visit({ isMesh: true, material: tintedMaterial });
        visit({ isMesh: true, material: sharedMaterial });
        visit({ isMesh: false, material: sharedMaterial });
      },
      removeFromParent() {},
    },
    mixer: null,
  };

  battle.retire(boss);
  assert.equal(disposedCount, 1, "retire() must dispose exactly the boss-identity-tint clone, not the template-shared material");
});

test("RealtimeBattle Stage 4+ identity tint skips shared contact shadows and disposes shared resources only at destroy", async (t) => {
  const THREE = await import("../vendor/three.module.min.js");
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: { removeEventListener() {} },
  });
  t.after(() => {
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete globalThis.document;
  });

  const disposals = { contactGeometry: 0, contactMaterial: 0 };
  const battle = new RealtimeBattle(
    { removeEventListener() {} },
    { stageNumber: 4, palette: { hostile: "#ff204e" } },
  );
  battle.contactGeometry = new THREE.RingGeometry(0, 0.45, 16);
  battle.contactGeometry.dispose = () => { disposals.contactGeometry += 1; };
  battle.contactMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  battle.contactMaterial.dispose = () => { disposals.contactMaterial += 1; };

  const ordinaryMaterial = new THREE.MeshStandardMaterial({ color: 0x224466 });
  const ordinaryColor = ordinaryMaterial.color.clone();
  const ordinaryMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ordinaryMaterial);
  const contactShadow = new THREE.Mesh(battle.contactGeometry, battle.contactMaterial);
  const arrayOrdinaryMaterial = new THREE.MeshStandardMaterial({ color: 0x335577 });
  const arrayMaterials = [battle.contactMaterial, arrayOrdinaryMaterial];
  const arrayContactMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), arrayMaterials);
  const arrayContactMaterialsBeforeTint = arrayContactMesh.material;
  const arrayContactMaterialBeforeTint = arrayContactMesh.material[0];
  const arrayOrdinaryMaterialBeforeTint = arrayContactMesh.material[1];
  const bossRoot = new THREE.Group();
  bossRoot.add(ordinaryMesh, contactShadow);
  bossRoot.add(arrayContactMesh);
  const boss = { root: bossRoot, mixer: null };

  battle.applyBossIdentityTint(bossRoot);

  const expectedTint = ordinaryColor.clone().lerp(new THREE.Color("#ff204e"), 0.22);
  assert.notEqual(ordinaryMesh.material, ordinaryMaterial, "Stage 4+ ordinary boss materials must be cloned for identity tinting");
  assert.equal(ordinaryMesh.material.userData.isBossIdentityTint, true, "cloned boss material must carry the tint disposal marker");
  assert.equal(ordinaryMesh.material.color.getHex(), expectedTint.getHex(), "ordinary boss material must receive the hostile identity tint");
  assert.equal(
    arrayContactMesh.material,
    arrayContactMaterialsBeforeTint,
    "array-valued contact-shadow mesh materials must remain the same array during identity tinting",
  );
  assert.equal(
    arrayContactMesh.material[0],
    arrayContactMaterialBeforeTint,
    "array-valued contact-shadow mesh must retain the battle-shared contact material entry",
  );
  assert.equal(
    arrayContactMesh.material[1],
    arrayOrdinaryMaterialBeforeTint,
    "array-valued contact-shadow mesh must skip tinting its ordinary material slot",
  );
  assert.notEqual(
    arrayContactMesh.material[0].userData.isBossIdentityTint,
    true,
    "shared contact material must never be marked as a boss identity-tint clone",
  );
  assert.equal(contactShadow.material, battle.contactMaterial, "contact-shadow material must remain the battle-shared material");
  assert.equal(contactShadow.geometry, battle.contactGeometry, "contact-shadow geometry must remain the battle-shared geometry");

  battle.retire(boss);
  assert.deepEqual(
    disposals,
    { contactGeometry: 0, contactMaterial: 0 },
    "retiring a tinted boss must not dispose shared contact-shadow resources",
  );

  battle.destroy();
  battle.destroy();
  assert.deepEqual(
    disposals,
    { contactGeometry: 1, contactMaterial: 1 },
    "destroy must dispose each shared contact-shadow resource exactly once and remain idempotent",
  );
});



test("RealtimeBattle updateCamera default target branch keeps commander target before combat and blends to boss when active", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, { stageNumber: 1 });

  battle.camera = {
    position: new THREE.Vector3(),
    lookAt(target) {}
  };

  // Set positions within bounds (bounds are x: [-12, 12], z: [-6, 6])
  battle.commanderPosition.set(2, 0, 1);
  battle.boss = {
    root: {
      position: new THREE.Vector3(8, 0, 4)
    }
  };

  // 1. Before combat starts, target should be commanderPosition
  battle.updateCamera(100);
  assert.ok(Math.abs(battle.cameraTarget.x - 2) < 1e-5);
  assert.ok(Math.abs(battle.cameraTarget.z - 1) < 1e-5);

  // Reset target
  battle.cameraTarget.set(0, 0, 0);

  // 2. Active wave starts
  battle.currentWaveId = "wave-1";
  battle.updateCamera(100);
  // Expected target is lerp( (2,0,1), (8,0,4), 0.22 ) -> (3.32, 0, 1.66)
  assert.ok(Math.abs(battle.cameraTarget.x - 3.32) < 1e-5);
  assert.ok(Math.abs(battle.cameraTarget.z - 1.66) < 1e-5);

  // Reset and deactivate wave
  battle.cameraTarget.set(0, 0, 0);
  battle.currentWaveId = null;

  // 3. Enemies exist
  battle.enemies = [{ defeated: false }];
  battle.updateCamera(100);
  assert.ok(Math.abs(battle.cameraTarget.x - 3.32) < 1e-5);
  assert.ok(Math.abs(battle.cameraTarget.z - 1.66) < 1e-5);

  // Reset and remove enemies
  battle.cameraTarget.set(0, 0, 0);
  battle.enemies = [];

  // 4. Boss exposed
  battle.bossExposed = true;
  battle.updateCamera(100);
  assert.ok(Math.abs(battle.cameraTarget.x - 3.32) < 1e-5);
  assert.ok(Math.abs(battle.cameraTarget.z - 1.66) < 1e-5);
});

test("RealtimeBattle updateCamera clamps an extreme look target to forty percent of the battlefield bounds", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  let cameraCenter = null;
  battle.camera = {
    position: new THREE.Vector3(),
    lookAt(target) {
      cameraCenter = target.clone();
    },
  };
  battle.commanderPosition.set(Number.MAX_SAFE_INTEGER, 0, Number.MIN_SAFE_INTEGER);

  battle.updateCamera(100);

  const { right, near } = battle.navigation.bounds;
  assert.deepEqual(
    { x: cameraCenter.x, z: cameraCenter.z },
    { x: right * 0.4, z: near * 0.4 },
    "an extreme commander target must clamp the camera center to forty percent of each symmetric field bound",
  );
  assert.ok(
    [cameraCenter.x, cameraCenter.y, cameraCenter.z, ...battle.camera.position].every(Number.isFinite),
    "clamping an extreme target must preserve finite camera center and position output",
  );
});

test("RealtimeBattle destroy disposes shared WebGL resources once and remains idempotent", (t) => {
  const priorDocument = globalThis.document;
  globalThis.document = { removeEventListener() {} };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
  });

  const disposals = { geometry: 0, material: 0, texture: 0, background: 0, contact: 0, ring: 0, shadow: 0, renderer: 0, particles: 0, audio: 0 };
  const texture = { isTexture: true, dispose: () => { disposals.texture += 1; } };
  const backgroundTexture = { dispose: () => { disposals.background += 1; } };
  const material = { map: texture, dispose: () => { disposals.material += 1; } };
  const geometry = { dispose: () => { disposals.geometry += 1; } };
  const contactGeometry = { dispose: () => { disposals.contact += 1; } };
  const ringGeometry = { dispose: () => { disposals.ring += 1; } };
  const sharedMesh = { isMesh: true, geometry, material };
  const propRemovals = [];
  const makeProp = (name) => ({
    root: {
      traverse(visit) { visit({ isMesh: false }); },
      removeFromParent() { propRemovals.push(name); },
    },
    mixer: makeRetirableMixer(),
    actions: new Map(),
  });
  const canvas = { removeEventListener() {} };
  const battle = new RealtimeBattle(canvas, { stageNumber: 1 });
  battle.scene = {
    traverse(visit) {
      visit(sharedMesh);
      visit({ isMesh: true, geometry, material });
    },
  };
  battle.templates.set("units/shade.glb", {
    scene: {
      traverse(visit) {
        visit({ isMesh: true, geometry, material });
      },
    },
  });
  battle.renderer = { dispose: () => { disposals.renderer += 1; } };
  battle.particles = { dispose: () => { disposals.particles += 1; } };
  battle.audio = { dispose: () => { disposals.audio += 1; } };
  battle.ringGeometry = ringGeometry;
  battle.keyLight = { shadow: { dispose: () => { disposals.shadow += 1; } } };
  battle.backgroundTexture = backgroundTexture;
  battle.scene.background = backgroundTexture;
  battle.contactGeometry = contactGeometry;
  battle.extractorProp = makeProp("extractor");
  battle.portalProp = makeProp("portal");
  battle.nodeProps = [makeProp("node-1"), makeProp("node-2")];
  battle.node = null;

  battle.destroy();
  battle.destroy();

  assert.deepEqual(
    disposals,
    { geometry: 1, material: 1, texture: 1, background: 1, contact: 1, ring: 1, shadow: 1, renderer: 1, particles: 1, audio: 1 },
    "destroy must release each shared WebGL resource once even when the scene exposes it through multiple meshes and destroy is repeated",
  );
  assert.deepEqual(
    propRemovals,
    ["extractor", "portal", "node-1", "node-2"],
    "destroy must retire each browser-only prop root exactly once",
  );
  assert.equal(battle.backgroundTexture, null, "destroy must relinquish the background texture reference");
  assert.equal(battle.scene.background, null, "destroy must clear the scene background reference");
  assert.equal(battle.contactGeometry, null, "destroy must relinquish the contact-ring geometry reference");
  assert.equal(battle.extractorProp, null, "destroy must relinquish the extractor prop reference");
  assert.equal(battle.portalProp, null, "destroy must relinquish the portal prop reference");
  assert.equal(battle.nodeProps, null, "destroy must relinquish the node prop collection");
});

test("RealtimeBattle campaign and wave entry points remain inert after destroy", (t) => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: { removeEventListener() {} },
  });
  t.after(() => {
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete globalThis.document;
  });

  const battle = new RealtimeBattle({ removeEventListener() {} }, { stageNumber: 1 });
  battle.destroy();

  const existingEnemy = makeUnit();
  const calls = {
    reconcileAllies: 0,
    applyEncounter: 0,
    reconcileDeployments: 0,
    updateNodeVisuals: 0,
    cloneTemplate: 0,
  };
  battle.authoritativeLegion = 7;
  battle.capturedCount = 2;
  battle.lastBossHealth = 9;
  battle.currentWaveId = "retired-wave";
  battle.enemySerial = 13;
  battle.enemies = [existingEnemy];
  battle.reconcileAllies = () => { calls.reconcileAllies += 1; };
  battle.applyEncounter = () => { calls.applyEncounter += 1; };
  battle.reconcileDeployments = () => { calls.reconcileDeployments += 1; };
  battle.updateNodeVisuals = () => { calls.updateNodeVisuals += 1; };
  battle.cloneTemplate = () => {
    calls.cloneTemplate += 1;
    return makeUnit();
  };

  battle.applyCampaignState({
    encounter: {
      stageId: "stage-retired",
      config: { waves: [{ id: "late-wave", hostiles: 2 }] },
      state: { activeWaveId: "late-wave" },
    },
    state: {
      legion: 3,
      bossHealth: 0,
      bossMaxHealth: 8,
      deployments: [{ id: "late-tower", kind: "tower" }],
    },
  });
  battle.spawnEncounterWave({ id: "late-wave", hostiles: 2 });

  assert.deepEqual(
    calls,
    {
      reconcileAllies: 0,
      applyEncounter: 0,
      reconcileDeployments: 0,
      updateNodeVisuals: 0,
      cloneTemplate: 0,
    },
    "destroyed campaign and wave entry points must not reconcile state or allocate enemy instances",
  );
  assert.deepEqual(
    {
      authoritativeLegion: battle.authoritativeLegion,
      capturedCount: battle.capturedCount,
      lastBossHealth: battle.lastBossHealth,
      currentWaveId: battle.currentWaveId,
      enemySerial: battle.enemySerial,
      enemies: battle.enemies,
    },
    {
      authoritativeLegion: 7,
      capturedCount: 2,
      lastBossHealth: 9,
      currentWaveId: "retired-wave",
      enemySerial: 13,
      enemies: [existingEnemy],
    },
    "destroyed entry points must leave previously retired renderer state untouched",
  );
});

test("RealtimeBattle shares one contact-shadow material across clones and disposes it only at destroy", async (t) => {
  const THREE = await import("../vendor/three.module.min.js");
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: { removeEventListener() {} },
  });
  t.after(() => {
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete globalThis.document;
  });

  const disposals = { contactGeometry: 0, contactMaterial: 0, templateGeometry: 0, templateMaterial: 0 };
  const canvas = { removeEventListener() {} };
  const battle = new RealtimeBattle(canvas, { stageNumber: 1 });
  battle.scene = new THREE.Scene();
  battle.contactGeometry = new THREE.RingGeometry(0, 0.45, 16);
  battle.contactGeometry.dispose = () => { disposals.contactGeometry += 1; };
  battle.contactMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  battle.contactMaterial.dispose = () => { disposals.contactMaterial += 1; };

  const templateGeometry = new THREE.BoxGeometry(1, 1, 1);
  templateGeometry.dispose = () => { disposals.templateGeometry += 1; };
  const templateMaterial = new THREE.MeshStandardMaterial();
  templateMaterial.dispose = () => { disposals.templateMaterial += 1; };
  const templateScene = new THREE.Group();
  templateScene.add(new THREE.Mesh(templateGeometry, templateMaterial));
  battle.templates.set("units/shade.glb", { scene: templateScene, animations: [] });

  const first = battle.cloneTemplate("units/shade.glb", 1.25);
  const second = battle.cloneTemplate("units/shade.glb", 1.25);
  const firstShadow = first.root.children.find((child) => child.material === battle.contactMaterial);
  const secondShadow = second.root.children.find((child) => child.material === battle.contactMaterial);

  assert.ok(firstShadow, "the first clone must attach a contact shadow using the battle-owned material");
  assert.ok(secondShadow, "the second clone must attach a contact shadow using the battle-owned material");
  assert.equal(firstShadow.material, secondShadow.material, "all clone contact shadows must share one material instead of allocating per instance");

  battle.retire(first);
  battle.retire(second);
  assert.deepEqual(
    disposals,
    { contactGeometry: 0, contactMaterial: 0, templateGeometry: 0, templateMaterial: 0 },
    "retiring instances must not dispose battle-shared contact or template resources",
  );

  battle.destroy();
  battle.destroy();
  assert.deepEqual(
    disposals,
    { contactGeometry: 1, contactMaterial: 1, templateGeometry: 1, templateMaterial: 1 },
    "destroy must dispose every shared contact and template resource exactly once and remain idempotent",
  );
  assert.equal(battle.contactGeometry, null, "destroy must relinquish the shared contact geometry");
  assert.equal(battle.contactMaterial, null, "destroy must relinquish the shared contact material");
});

test("RealtimeBattle disposes parsed GLTF resources when loading completes after destroy", async (t) => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  const originalParse = GLTFLoader.prototype.parse;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: { removeEventListener() {} },
  });

  const disposals = { geometry: 0, material: 0, texture: 0 };
  const texture = { isTexture: true, dispose() { disposals.texture += 1; } };
  const material = { map: texture, dispose() { disposals.material += 1; } };
  const geometry = { dispose() { disposals.geometry += 1; } };
  const parsedScene = {
    traverse(visit) {
      visit({ isMesh: true, geometry, material });
    },
  };
  const { promise: parseStarted, resolve: markParseStarted } = Promise.withResolvers();
  let completeParse;

  GLTFLoader.prototype.parse = function parse(_data, _resourceBase, onLoad) {
    completeParse = () => onLoad({ scene: parsedScene, animations: [] });
    markParseStarted();
  };
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
  });
  t.after(() => {
    GLTFLoader.prototype.parse = originalParse;
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete globalThis.document;
    if (fetchDescriptor) Object.defineProperty(globalThis, "fetch", fetchDescriptor);
    else delete globalThis.fetch;
  });

  const battle = new RealtimeBattle({ removeEventListener() {} }, { stageNumber: 1 });
  const loading = battle.loadModel("props/soul-extractor.glb");
  await parseStarted;
  battle.destroy();
  completeParse();

  await assert.rejects(
    loading,
    /Realtime battle was destroyed while loading props\/soul-extractor\.glb/,
    "a late parsed GLTF must reject with teardown context rather than escape into the destroyed battle",
  );
  assert.deepEqual(
    disposals,
    { geometry: 1, material: 1, texture: 1 },
    "late GLTF teardown must dispose parsed geometry, material, and texture exactly once",
  );
  assert.equal(battle.templates.has("props/soul-extractor.glb"), false, "a late GLTF must never enter the destroyed battle template cache");
});

test("RealtimeBattle preserves marker fallbacks when each optional prop template is absent", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const optionalResources = [
    "props/soul-extractor.glb",
    "props/rift-portal.glb",
    "props/command-obelisk.glb",
  ];
  const mandatoryResources = [
    "terrain/cinder-span.glb",
    "units/shade.glb",
    "units/scout.glb",
    "units/guard.glb",
    "units/reinforce.glb",
    "bosses/cinder-warden.glb",
  ];
  const makeTemplate = () => {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    return { scene, animations: [] };
  };

  for (const missingResource of optionalResources) {
    const battle = new RealtimeBattle(null, { stageNumber: 1 });
    battle.scene = new THREE.Scene();
    battle.ringGeometry = null;
    battle.contactGeometry = null;
    battle.contactMaterial = null;
    for (const resource of [...mandatoryResources, ...optionalResources]) {
      if (resource !== missingResource) battle.templates.set(resource, makeTemplate());
    }
    const cloneCalls = [];
    const cloneTemplate = battle.cloneTemplate;
    battle.cloneTemplate = (...args) => {
      cloneCalls.push(args[0]);
      return cloneTemplate.call(battle, ...args);
    };

    assert.equal(
      battle.templates.has(missingResource),
      false,
      `fixture must omit the optional ${missingResource} template`,
    );



    const savedProcess = globalThis.process;
    try {
      globalThis.process = undefined;
      assert.doesNotThrow(
        () => battle.createBattleObjects(),
        `missing optional ${missingResource} must not collapse battle object creation`,
      );
    } finally {
      globalThis.process = savedProcess;
    }
    assert.equal(
      cloneCalls.includes(missingResource),
      false,
      `missing optional ${missingResource} must not attempt a model clone`,
    );


    assert.ok(battle.commander?.root, `missing optional ${missingResource} must still create the commander`);
    assert.ok(battle.boss?.root, `missing optional ${missingResource} must still create the boss`);
    assert.ok(battle.portal, `missing optional ${missingResource} must retain the portal marker`);
    assert.ok(battle.extractor, `missing optional ${missingResource} must retain the extractor marker`);
    assert.ok(battle.nodes.length > 0, `missing optional ${missingResource} must retain command-node markers`);

    if (missingResource === "props/rift-portal.glb") {
      assert.equal(battle.portalProp, undefined, "a missing portal prop must not create a model instance");
      assert.notEqual(battle.portal.material.visible, false, "a missing portal prop must leave the materialize marker visible");
      assert.equal(battle.portal.userData.semantic, "materialize", "the portal fallback must retain its command semantic");
    } else if (missingResource === "props/soul-extractor.glb") {
      assert.equal(battle.extractorProp, undefined, "a missing extractor prop must not create a model instance");
      assert.notEqual(battle.extractor.material.visible, false, "a missing extractor prop must leave the extract marker visible");
      assert.equal(battle.extractor.userData.semantic, "extract", "the extractor fallback must retain its command semantic");
    } else {
      assert.deepEqual(battle.nodeProps, [], "a missing obelisk prop must not create node model instances");
      assert.equal(
        battle.nodes.every((node) => node.material.visible !== false),
        true,
        "missing obelisk props must leave every command-node marker visible",
      );
    }
    if (missingResource !== "props/rift-portal.glb") {
      assert.ok(battle.portalProp?.root, "a present portal template must create a model instance");
      assert.equal(battle.portal.material.visible, false, "a present portal prop must hide the materialize marker");
    }
    if (missingResource !== "props/soul-extractor.glb") {
      assert.ok(battle.extractorProp?.root, "a present extractor template must create a model instance");
      assert.equal(battle.extractor.material.visible, false, "a present extractor prop must hide the extract marker");
    }
    if (missingResource !== "props/command-obelisk.glb") {
      assert.equal(
        battle.nodeProps.length,
        battle.nodes.length,
        "present obelisk templates must create one model instance per command node",
      );
      assert.equal(
        battle.nodes.every((node) => node.material.visible === false),
        true,
        "present obelisk props must hide every command-node marker",
      );
    }


    battle.audio.dispose();
  }
});


function makeRealtimeTowerScenario({ fortificationLevel = 1, distance = 1 } = {}) {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const enemy = { ...makeUnit({ x: distance, z: 0, hp: 10 }), id: "enemy-1" };
  const towerRoot = makeRoot();
  towerRoot.position.distanceTo = (target) => Math.hypot(
    towerRoot.position.x - target.x,
    towerRoot.position.z - target.z,
  );

  battle.fortificationLevel = fortificationLevel;
  battle.enemies = [enemy];
  battle.getGimmickAt = () => null;
  battle.drawTracer = () => {};
  battle.particles = { emit() {} };
  battle.audio = { playTone() {} };
  battle.deploymentsMap.set("tower-1", {
    id: "tower-1",
    kind: "tower",
    root: towerRoot,
    gridX: 0,
    gridY: 0,
    cooldown: 0,
  });

  return {
    battle,
    enemy,
    shotCount: () => battle.getTacticalSnapshot().towerShots.length,
  };
}

test("RealtimeBattle tower auto-fire applies fortification bonuses above the level-1 baseline", async (t) => {
  const cases = [
    { name: "level 1 deals baseline damage", fortificationLevel: 1, expectedDamage: 1 },
    { name: "level 2 adds twenty percent damage", fortificationLevel: 2, expectedDamage: 1.2 },
  ];

  for (const { name, fortificationLevel, expectedDamage } of cases) {
    await t.test(name, () => {
      const { battle, enemy, shotCount } = makeRealtimeTowerScenario({ fortificationLevel });

      battle.updateTowers(0);

      assert.deepEqual(
        {
          damage: Number((10 - enemy.hp).toFixed(6)),
          shots: shotCount(),
        },
        { damage: expectedDamage, shots: 1 },
        "one live enemy inside tower range must take the level-scaled damage from exactly one emitted shot",
      );
    });
  }
});

test("RealtimeBattle tower auto-fire includes the shared base-range boundary and excludes enemies beyond it", async (t) => {
  const cases = [
    { name: "enemy exactly four units away is in range", distance: 4, expectedShots: 1 },
    { name: "enemy just beyond four units is out of range", distance: 4.001, expectedShots: 0 },
  ];

  for (const { name, distance, expectedShots } of cases) {
    await t.test(name, () => {
      const { battle, shotCount } = makeRealtimeTowerScenario({ distance });

      battle.updateTowers(0);

      assert.equal(
        shotCount(),
        expectedShots,
        "the WebGL tower must use the same inclusive four-unit base range as the Canvas tower",
      );
    });
  }
});

test("RealtimeBattle tower auto-fire emits only one shot during the shared one-second cooldown", () => {
  const { battle, shotCount } = makeRealtimeTowerScenario();
  const shotsByElapsedTime = [];

  for (const elapsed of [0, 0.8, 0.2]) {
    battle.updateTowers(elapsed);
    shotsByElapsedTime.push(shotCount());
  }

  assert.deepEqual(
    shotsByElapsedTime,
    [1, 1, 2],
    "the tower must fire immediately, remain blocked at 0.8 seconds, and fire again after one full second",
  );
});

function measureRealtimeMobilityTick({ mobilityLevel, terrainMultiplier = 1, movementMultiplier = 1 }) {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const commander = makeUnit();
  const ally = makeUnit({ z: 1 });
  commander.root.rotation = { y: 0 };
  ally.customOrder = { x: 1, z: 1 };
  ally.customOrderReached = false;

  battle.mobilityLevel = mobilityLevel;
  battle.movementMultiplier = movementMultiplier;
  battle.commander = commander;
  battle.allies = [ally];
  battle.pressed.add("KeyD");
  battle.getGimmickAt = () => ({
    effects: { movementSpeedMultiplier: terrainMultiplier },
  });
  battle.applyResolvedMovement = (unit, targetX, targetZ) => {
    unit.root.position.set(targetX, 0, targetZ);
    return { x: targetX, y: 0, z: targetZ, blocked: false };
  };
  battle.play = () => {};

  battle.moveCommander(0.25);
  battle.updateAllies(0.25);

  return {
    commander: Math.hypot(commander.root.position.x, commander.root.position.z),
    ally: Math.hypot(ally.root.position.x, ally.root.position.z - 1),
  };
}

test("RealtimeBattle Mobility accelerates only the commander and composes with terrain movement", async (t) => {
  const baseline = measureRealtimeMobilityTick({ mobilityLevel: 1 });
  const upgraded = measureRealtimeMobilityTick({ mobilityLevel: 2 });
  const terrainMultiplier = 0.5;
  const terrainAffected = measureRealtimeMobilityTick({ mobilityLevel: 2, terrainMultiplier });
  const haste = measureRealtimeMobilityTick({ mobilityLevel: 1, movementMultiplier: 1.25 });

  await t.test("level 2 moves the commander exactly fifteen percent farther than level 1", () => {
    assert.equal(
      Number((upgraded.commander / baseline.commander).toFixed(12)),
      1.15,
      "Mobility level 1 must be the commander baseline and level 2 must add exactly fifteen percent",
    );
  });

  await t.test("level 2 leaves allied-unit movement at the level-1 distance", () => {
    assert.equal(
      Number((upgraded.ally / baseline.ally).toFixed(12)),
      1,
      "Mobility must not change allied-unit speed",
    );
  });

  await t.test("terrain movement effects multiply the upgraded commander distance", () => {
    assert.equal(
      Number((terrainAffected.commander / upgraded.commander).toFixed(12)),
      terrainMultiplier,
      "terrain movement effects must remain multiplicative with commander Mobility",
    );
  });
  await t.test("a 25% HASTE multiplier accelerates commander movement exactly once", () => {
    assert.equal(
      Number((haste.commander / baseline.commander).toFixed(12)),
      1.25,
      "the WebGL movement path must apply HASTE once rather than ignore or square the campaign multiplier",
    );
  });

});

test("RealtimeBattle selected allies use the stage ally palette and a motion-safe persistent WebGL indicator", async (t) => {
  const THREE = await import("../vendor/three.module.min.js");
  const stageAllyColor = "#88d7ff";
  const battle = new RealtimeBattle(null, {
    stageNumber: 3,
    palette: { ally: stageAllyColor },
    reducedMotion: false,
  });
  const ally = {
    ...makeUnit({ hp: 2 }),
    root: new THREE.Group(),
    defeated: false,
  };
  let now = 0;
  const nowDescriptor = Object.getOwnPropertyDescriptor(globalThis.performance, "now");
  Object.defineProperty(globalThis.performance, "now", {
    configurable: true,
    value: () => now,
  });
  t.after(() => {
    if (nowDescriptor) Object.defineProperty(globalThis.performance, "now", nowDescriptor);
    else delete globalThis.performance.now;
  });

  battle.allies = [ally];
  battle.selection.add(ally);
  battle.ringGeometry = new THREE.RingGeometry(0.5, 0.6, 16);

  battle.updateSelectionVisuals();

  assert.ok(ally.selectionRing, "a selected live ally must receive a circular selection indicator");
  assert.equal(ally.selectionRing.visible, true, "the selected WebGL indicator must be visible");
  assert.equal(
    ally.selectionRing.material.color.getHex(),
    0x88d7ff,
    "the WebGL selection indicator must stay synchronized with the stage ally palette",
  );
  assert.equal(ally.selectionRing.material.depthWrite, false, "the selected indicator must remain visible through scene depth");
  assert.equal(ally.selectionRing.renderOrder, 12, "the selected indicator must render above ordinary scene geometry");
  assert.ok(
    ally.selectionRing.scale.x > 0 && ally.selectionRing.material.opacity > 0,
    "the selected indicator must retain nonzero size and opacity",
  );

  const initialPulse = {
    scale: ally.selectionRing.scale.x,
    opacity: ally.selectionRing.material.opacity,
  };
  now = Math.PI / (2 * 0.008);
  battle.updateSelectionVisuals();
  assert.equal(ally.selectionRing.visible, true, "the selected indicator must remain visible across pulse updates");
  assert.notEqual(ally.selectionRing.scale.x, initialPulse.scale, "the selected indicator pulse must change scale over time");
  assert.notEqual(ally.selectionRing.material.opacity, initialPulse.opacity, "the selected indicator pulse must change opacity over time");

  battle.presentation.reducedMotion = true;
  now = 1000;
  battle.updateSelectionVisuals();
  const reducedMotionBaseline = {
    scale: [ally.selectionRing.scale.x, ally.selectionRing.scale.y, ally.selectionRing.scale.z],
    opacity: ally.selectionRing.material.opacity,
  };
  assert.deepEqual(
    reducedMotionBaseline,
    { scale: [0.78, 0.78, 0.78], opacity: 0.76 },
    "reduced motion must use the deterministic legible selection baseline",
  );
  now = 2000;
  battle.updateSelectionVisuals();
  assert.deepEqual(
    {
      scale: [ally.selectionRing.scale.x, ally.selectionRing.scale.y, ally.selectionRing.scale.z],
      opacity: ally.selectionRing.material.opacity,
    },
    reducedMotionBaseline,
    "reduced-motion selection visuals must not vary with time",
  );

  battle.selection.clear();
  battle.updateSelectionVisuals();
  assert.equal(ally.selectionRing.visible, false, "clearing selection must hide the WebGL indicator");
});

test("RealtimeBattle right-drag previews legal ally routes, commits on release, and rejects invalid routes", () => {
  let groundPoint;
  const canvas = {
    style: {},
    focus() {},
    setPointerCapture() {},
    hasPointerCapture: () => true,
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const battle = new RealtimeBattle(canvas, { stageNumber: 1 });
  const startCell = {
    x: Math.floor(battle.navigation.anchors.alliedSpawn.x),
    y: Math.floor(battle.navigation.anchors.alliedSpawn.y),
  };
  const firstTargetCell = { x: 12, y: 2 };
  const secondTargetCell = { x: 10, y: 2 };
  const start = battle.navigation.gridToWorld(startCell.x + 0.5, startCell.y + 0.5);
  const firstTarget = battle.navigation.gridToWorld(firstTargetCell.x + 0.5, firstTargetCell.y + 0.5);
  const secondTarget = battle.navigation.gridToWorld(secondTargetCell.x + 0.5, secondTargetCell.y + 0.5);
  assert.ok(
    battle.navigation.findPath(startCell, firstTargetCell)?.length > 1 &&
      battle.navigation.findPath(startCell, secondTargetCell)?.length > 1,
    "the deterministic Stage 1 fixture must expose two legal preview destinations",
  );

  const ally = makeUnit({ x: start.x, z: start.z });
  battle.commander = makeUnit({ x: start.x, z: start.z });
  battle.allies = [ally];
  battle.selection.add(ally);
  battle.camera = {};
  battle.ground = {};
  battle.scene = { add() {}, remove() {} };
  battle.resolvePointerAction = () => null;
  battle.resolvePointerAlly = () => null;
  battle.setPointerRay = () => true;
  battle.raycaster = {
    intersectObject: (object) => object === battle.ground
      ? [{ point: groundPoint }]
      : [],
  };

  const pointer = (pointerId, x, timeStamp = 10) => ({
    button: 2,
    clientX: x,
    clientY: 50,
    pointerId,
    pointerType: "mouse",
    timeStamp,
  });

  const initialCustomPath = ally.customPath;
  const initialCustomOrder = ally.customOrder;
  const initialCustomOrderReached = ally.customOrderReached;
  groundPoint = { x: firstTarget.x, y: 0, z: firstTarget.z };
  battle.onPointerDown(pointer(1, 10));
  battle.onPointerMove(pointer(1, 30, 20));
  assert.equal(battle.routePreviewActive, true, "a held right-drag over a legal tile must expose a live WebGL route preview");
  const firstPreview = JSON.stringify(battle.routePreview);
  assert.ok(firstPreview && firstPreview !== "null", "the legal preview must contain route geometry");
  assert.equal(
    battle.routePreview.line.material.depthTest,
    false,
    "the route preview line must not depth-test against terrain, or elevation variance along the route clips it invisible",
  );
  assert.equal(
    battle.routePreview.endpoint.material.depthTest,
    false,
    "the route preview endpoint marker must not depth-test against terrain",
  );

  groundPoint = { x: secondTarget.x, y: 0, z: secondTarget.z };
  battle.onPointerMove(pointer(1, 50, 30));
  assert.equal(battle.routePreviewActive, true, "the preview must remain active while the pointer moves across legal tiles");
  assert.notEqual(JSON.stringify(battle.routePreview), firstPreview, "pointer movement must update the proposed route geometry");

  battle.onPointerCancel(pointer(1, 50, 40));
  assert.equal(battle.routePreviewActive, false, "pointer cancellation must clear the transient WebGL route preview");
  assert.equal(battle.routePreview, null, "pointer cancellation must not leave stale WebGL route geometry");
  assert.strictEqual(ally.customPath, initialCustomPath, "cancelling a route preview must not create or mutate a path");
  assert.strictEqual(ally.customOrder, initialCustomOrder, "cancelling a route preview must not create or mutate an order");
  assert.strictEqual(
    ally.customOrderReached,
    initialCustomOrderReached,
    "cancelling a route preview must not create or mutate order completion state",
  );

  groundPoint = { x: firstTarget.x, y: 0, z: firstTarget.z };
  battle.onPointerDown(pointer(2, 10, 50));
  battle.onPointerMove(pointer(2, 30, 60));
  battle.onPointerUp(pointer(2, 30, 70));
  assert.equal(battle.routePreviewActive, false, "releasing a legal route must clear the transient preview");
  assert.equal(battle.routePreview, null, "committing a route must not leave stale WebGL preview geometry");
  assert.ok(ally.customPath?.length > 0, "releasing over a legal tile must commit the selected ally route");
  const priorPath = ally.customPath;
  const priorOrder = ally.customOrder;

  groundPoint = { x: -3, y: 0, z: -3 };
  battle.onPointerDown(pointer(3, 10, 80));
  battle.onPointerMove(pointer(3, 30, 90));
  assert.equal(battle.routePreviewActive, false, "an invalid tile must not advertise a legal WebGL route preview");
  battle.onPointerUp(pointer(3, 30, 100));
  assert.equal(battle.routePreview, null, "releasing an invalid route must leave preview state empty");
  assert.strictEqual(ally.customPath, priorPath, "an invalid route must not replace the last legal committed route");
  assert.strictEqual(ally.customOrder, priorOrder, "an invalid route must preserve the last legal destination");
});

test("RealtimeBattle publishes stable selection summaries and removes a defeated selected ally", () => {
  const summaries = [];
  const onSelectionChange = (summary) => summaries.push(summary);
  const battle = new RealtimeBattle(
    null,
    { stageNumber: 1 },
    { onSelectionChange },
  );

  assert.equal(
    battle.onSelectionChange,
    onSelectionChange,
    "the constructor must retain the selection callback supplied by the cockpit",
  );
  assert.deepEqual(
    battle.emitSelectionChange(),
    {
      count: 0,
      total: 0,
      health: 0,
      maxHealth: 0,
      possessed: 0,
      engaged: 0,
      moving: 0,
      order: "none",
      kind: "none",
    },
    "the first publication must describe an empty battlefield selection with plain scalar data",
  );

  const moving = {
    ...makeUnit({ hp: 3 }),
    isPossessed: true,
    customOrder: { x: 4, y: 0, z: 2 },
    customOrderReached: false,
  };
  const engaged = makeUnit({ hp: 1 });
  const enemy = makeUnit();
  battle.allies = [moving, engaged];
  battle.selection.add(moving);
  battle.selection.add(engaged);
  battle.engagements.set(engaged, enemy);
  battle.engagements.set(enemy, engaged);

  const selected = battle.emitSelectionChange();
  assert.deepEqual(
    selected,
    {
      count: 2,
      total: 2,
      health: 4,
      maxHealth: 6,
      possessed: 1,
      engaged: 1,
      moving: 1,
      order: "mixed",
      kind: "mixed",
    },
    "the dossier summary must aggregate the actual selected actors rather than campaign legion totals",
  );
  assert.equal(summaries.length, 2, "empty and selected states must each publish once");

  battle.emitSelectionChange();
  assert.equal(summaries.length, 2, "an unchanged scalar selection state must not publish twice");

  battle.defeat(engaged);
  assert.deepEqual(
    summaries.at(-1),
    {
      count: 1,
      total: 1,
      health: 3,
      maxHealth: 3,
      possessed: 1,
      engaged: 0,
      moving: 1,
      order: "moving",
      kind: "possessed",
    },
    "defeat must remove a selected actor and immediately republish the surviving selection",
  );
  assert.equal(battle.selection.has(engaged), false, "a defeated ally must not remain selected");

  battle.scene = {};
  battle.templates.set("units/shade.glb", {});
  battle.retire = () => {};
  battle.reconcileAllies(0);
  assert.deepEqual(
    summaries.at(-1),
    {
      count: 0,
      total: 0,
      health: 0,
      maxHealth: 0,
      possessed: 0,
      engaged: 0,
      moving: 0,
      order: "none",
      kind: "none",
    },
    "authoritative ally removal must clear and republish the selected set",
  );
  assert.equal(battle.selection.size, 0, "removed authoritative allies must not remain selected");
});

test("RealtimeBattle direct ally click replaces selection without issuing a ground order", () => {
  const summaries = [];
  const battle = new RealtimeBattle(
    {
      style: {},
      focus() {},
      setPointerCapture() {},
      hasPointerCapture: () => true,
      releasePointerCapture() {},
    },
    { stageNumber: 1 },
    { onSelectionChange: (summary) => summaries.push(summary) },
  );
  const prior = makeUnit({ hp: 1 });
  const clicked = makeUnit({ hp: 2 });
  battle.allies = [prior, clicked];
  battle.selection.add(prior);
  battle.updateMarqueeSelection = () => {};
  battle.resolvePointerAction = () => null;
  battle.resolvePointerAlly = () => clicked;
  let groundOrders = 0;
  battle.pick = () => {
    groundOrders += 1;
  };
  const pointer = {
    button: 0,
    clientX: 32,
    clientY: 24,
    pointerId: 7,
    pointerType: "mouse",
    timeStamp: 100,
  };

  battle.onPointerDown(pointer);
  battle.onPointerUp({ ...pointer, timeStamp: 150 });

  assert.deepEqual([...battle.selection], [clicked], "a primary ally click must select exactly the hit ally");
  assert.equal(groundOrders, 0, "the same ally click must not fall through to commander ground movement");
  assert.equal(summaries.at(-1).count, 1, "direct selection must publish the selected count");
  assert.equal(summaries.at(-1).health, 2, "direct selection must publish the selected ally's health");
});

test("RealtimeBattle primary empty-ground click rallies a selected ally instead of silently moving the commander (regression: previously ignored the selection)", () => {
  const canvas = {
    style: {},
    focus() {},
    setPointerCapture() {},
    hasPointerCapture: () => true,
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const battle = new RealtimeBattle(canvas, { stageNumber: 1 }, {});
  const commanderCell = { x: 3, y: 5 };
  const targetCell = { x: 12, y: 2 };
  const commanderWorld = battle.navigation.gridToWorld(commanderCell.x + 0.5, commanderCell.y + 0.5);
  const targetWorld = battle.navigation.gridToWorld(targetCell.x + 0.5, targetCell.y + 0.5);

  const ally = makeUnit({ x: commanderWorld.x + 1, z: commanderWorld.z });
  battle.commander = makeUnit({ x: commanderWorld.x, z: commanderWorld.z });
  battle.allies = [ally];
  battle.selection.add(ally);
  battle.camera = {};
  battle.ground = {};
  battle.scene = { add() {} };
  battle.resolvePointerAction = () => null;
  battle.resolvePointerAlly = () => null;
  battle.updateFocusHighlight = () => {};
  battle.raycaster = {
    setFromCamera() {},
    intersectObject: () => [{ point: { x: targetWorld.x, y: 0, z: targetWorld.z } }],
  };
  battle.particles = { emit() {} };
  battle.audio = { playTone() {} };
  const pointer = {
    button: 0,
    clientX: 50,
    clientY: 50,
    pointerId: 8,
    pointerType: "mouse",
    timeStamp: 100,
  };

  battle.onPointerDown(pointer);
  battle.onPointerUp({ ...pointer, timeStamp: 150 });

  assert.deepEqual([...battle.selection], [ally], "the primary-button ground click must preserve the selected ally");
  assert.equal(battle.commanderOrder, null, "an empty-ground click with a selected ally must not also move the commander");
  assert.ok(
    ally.customOrder || ally.customPath?.length,
    "the selected ally must receive a rally order, mirroring the right-click path -- previously the commander moved and the ally just sat there",
  );
});

test("RealtimeBattle primary empty-ground click moves the commander when nothing is selected", () => {
  const tacticalRequests = [];
  const canvas = {
    style: {},
    focus() {},
    setPointerCapture() {},
    hasPointerCapture: () => true,
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const battle = new RealtimeBattle(
    canvas,
    { stageNumber: 1 },
    { onTacticalRequest: (request) => tacticalRequests.push(request) },
  );
  const commanderCell = { x: 3, y: 5 };
  const targetCell = { x: 12, y: 2 };
  const commanderWorld = battle.navigation.gridToWorld(commanderCell.x + 0.5, commanderCell.y + 0.5);
  const targetWorld = battle.navigation.gridToWorld(targetCell.x + 0.5, targetCell.y + 0.5);
  assert.ok(
    battle.navigation.findPath(commanderCell, targetCell)?.length > 1,
    "the fixture must provide a legal commander route",
  );

  battle.commander = makeUnit({ x: commanderWorld.x, z: commanderWorld.z });
  battle.allies = [];
  battle.camera = {};
  battle.ground = {};
  battle.scene = { add() {} };
  battle.resolvePointerAction = () => null;
  battle.resolvePointerAlly = () => null;
  battle.updateFocusHighlight = () => {};
  battle.raycaster = {
    intersectObject: () => [{ point: { x: targetWorld.x, y: 0, z: targetWorld.z } }],
  };
  battle.particles = { emit() {} };
  battle.audio = { playTone() {} };
  const pointer = {
    button: 0,
    clientX: 50,
    clientY: 50,
    pointerId: 8,
    pointerType: "mouse",
    timeStamp: 100,
  };

  battle.onPointerDown(pointer);
  battle.onPointerUp({ ...pointer, timeStamp: 150 });

  assert.deepEqual(
    battle.focusedCell,
    targetCell,
    "the same ground click must focus the target tactical cell",
  );
  assert.deepEqual(
    tacticalRequests,
    [{ type: "focus", cell: targetCell }],
    "the same ground click must publish commander focus exactly once",
  );
  assert.deepEqual(
    { x: battle.commanderOrder.x, z: battle.commanderOrder.z },
    { x: targetWorld.x, z: targetWorld.z },
    "with nothing selected, the same ground click must queue commander movement to the focused cell",
  );
});

test("RealtimeBattle right-click with no selection moves the commander directly (regression: previously a no-op)", () => {
  const canvas = {
    style: {},
    focus() {},
    setPointerCapture() {},
    hasPointerCapture: () => true,
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const battle = new RealtimeBattle(canvas, { stageNumber: 1 }, {});
  const commanderCell = { x: 3, y: 5 };
  const targetCell = { x: 12, y: 2 };
  const commanderWorld = battle.navigation.gridToWorld(commanderCell.x + 0.5, commanderCell.y + 0.5);
  const targetWorld = battle.navigation.gridToWorld(targetCell.x + 0.5, targetCell.y + 0.5);

  battle.commander = makeUnit({ x: commanderWorld.x, z: commanderWorld.z });
  battle.allies = [];
  battle.camera = {};
  battle.ground = {};
  battle.scene = { add() {} };
  battle.resolvePointerAction = () => null;
  battle.updateFocusHighlight = () => {};
  battle.raycaster = {
    intersectObject: () => [{ point: { x: targetWorld.x, y: 0, z: targetWorld.z } }],
  };
  battle.particles = { emit() {} };
  battle.audio = { playTone() {} };

  const pointer = { button: 2, clientX: 50, clientY: 50, pointerId: 9, pointerType: "mouse", timeStamp: 100 };
  battle.onPointerDown(pointer);
  battle.onPointerUp({ ...pointer, timeStamp: 150 });

  assert.equal(battle.selection.size, 0, "the fixture must genuinely have no ally selected");
  assert.deepEqual(
    { x: battle.commanderOrder?.x, z: battle.commanderOrder?.z },
    { x: targetWorld.x, z: targetWorld.z },
    "a right-click with nothing selected must queue commander movement to the clicked ground point",
  );
});

test("RealtimeBattle right-click with allies selected rallies them and leaves the commander's own order untouched", () => {
  const canvas = {
    style: {},
    focus() {},
    setPointerCapture() {},
    hasPointerCapture: () => true,
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  const battle = new RealtimeBattle(canvas, { stageNumber: 1 }, {});
  const commanderCell = { x: 3, y: 5 };
  const targetCell = { x: 12, y: 2 };
  const commanderWorld = battle.navigation.gridToWorld(commanderCell.x + 0.5, commanderCell.y + 0.5);
  const targetWorld = battle.navigation.gridToWorld(targetCell.x + 0.5, targetCell.y + 0.5);

  const ally = makeUnit({ x: commanderWorld.x + 1, z: commanderWorld.z });
  battle.commander = makeUnit({ x: commanderWorld.x, z: commanderWorld.z });
  battle.allies = [ally];
  battle.selection.add(ally);
  battle.camera = {};
  battle.ground = {};
  battle.scene = { add() {} };
  battle.resolvePointerAction = () => null;
  battle.updateFocusHighlight = () => {};
  battle.raycaster = {
    setFromCamera() {},
    intersectObject: () => [{ point: { x: targetWorld.x, y: 0, z: targetWorld.z } }],
  };
  battle.particles = { emit() {} };
  battle.audio = { playTone() {} };

  const pointer = { button: 2, clientX: 50, clientY: 50, pointerId: 10, pointerType: "mouse", timeStamp: 100 };
  battle.onPointerDown(pointer);
  battle.onPointerUp({ ...pointer, timeStamp: 150 });

  assert.equal(battle.commanderOrder, null, "a right-click with allies selected must not also move the commander");
  assert.ok(ally.customOrder || ally.customPath?.length, "the selected ally must receive a rally order");
});

test("RealtimeBattle updateCommanderPathPreview shows a persistent destination marker at the final waypoint and hides it once the order clears", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, { stageNumber: 1 }, {});
  const added = [];
  battle.scene = { add: (obj) => added.push(obj) };
  battle.commander = { root: { position: new THREE.Vector3(0, 0, 0) } };
  battle.navigationAt = () => ({ elevation: 0 });
  battle.commanderPath = [{ x: 4, y: 4 }];

  battle.updateCommanderPathPreview();

  assert.ok(battle.commanderDestinationMarker, "a destination marker must be created once a commander path exists");
  assert.equal(battle.commanderDestinationMarker.visible, true, "the marker must be visible while the path is active");
  assert.ok(added.includes(battle.commanderDestinationMarker), "the marker must be added to the scene exactly once");
  // The path can trace across multiple grid cells with different terrain
  // elevation than the marker's own waypoint; depth-testing against terrain
  // would clip it under higher ground elsewhere along the route.
  assert.equal(
    battle.commanderPathLine.material.depthTest,
    false,
    "the commander's path line must not depth-test against terrain",
  );
  assert.equal(
    battle.commanderDestinationMarker.material.depthTest,
    false,
    "the commander's destination marker must not depth-test against terrain",
  );
  const expected = battle.navigation.gridToWorld(4.5, 4.5);
  assert.equal(battle.commanderDestinationMarker.position.x, expected.x, "the marker must sit at the final waypoint, not the commander");
  assert.equal(battle.commanderDestinationMarker.position.z, expected.z, "the marker must sit at the final waypoint, not the commander");

  battle.commanderPath = null;
  battle.updateCommanderPathPreview();
  assert.equal(battle.commanderDestinationMarker.visible, false, "the marker must hide once the commander has no active path");
});

test("RealtimeBattle updateRallyMarker shows a persistent marker while any ally is en route and hides it once everyone arrives", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 }, {});
  const added = [];
  battle.scene = { add: (obj) => added.push(obj) };
  battle.navigationAt = () => ({ elevation: 0 });
  battle.rally.set(3, 0, 3);
  const stillWalking = makeUnit();
  stillWalking.customPath = [{ x: 1, y: 0, z: 1 }];
  battle.allies = [stillWalking];

  battle.updateRallyMarker();
  assert.ok(battle.allyRallyMarker, "a rally marker must be created while an ally is still walking a custom path");
  assert.equal(battle.allyRallyMarker.visible, true);
  assert.ok(added.includes(battle.allyRallyMarker));
  assert.equal(
    battle.allyRallyMarker.material.depthTest,
    false,
    "the ally rally marker must not depth-test against terrain, or elevation variance under it clips it invisible",
  );

  stillWalking.customPath = [];
  stillWalking.customOrder = null;
  battle.updateRallyMarker();
  assert.equal(battle.allyRallyMarker.visible, false, "the rally marker must hide once every ally has arrived");
});

test("RealtimeBattle marquee publishes its selected actor set once", () => {
  const summaries = [];
  const battle = new RealtimeBattle(
    null,
    { stageNumber: 1 },
    { onSelectionChange: (summary) => summaries.push(summary) },
  );
  const inside = makeUnit({ hp: 2 });
  const outside = makeUnit({ hp: 3 });
  battle.allies = [inside, outside];
  battle.isMarqueeSelecting = true;
  battle.marqueeRect = { x0: 0, y0: 0, x1: 50, y1: 50 };
  battle.projectToScreen = (position) => (
    position === inside.root.position ? { x: 25, y: 25 } : { x: 75, y: 75 }
  );

  battle.updateMarqueeSelection();
  battle.updateMarqueeSelection();

  assert.deepEqual([...battle.selection], [inside], "marquee selection must contain only live allies inside its screen rectangle");
  assert.deepEqual(
    summaries,
    [{
      count: 1,
      total: 2,
      health: 2,
      maxHealth: 3,
      possessed: 0,
      engaged: 0,
      moving: 0,
      order: "holding",
      kind: "shade",
    }],
    "an unchanged marquee must emit one aggregate holding summary",
  );
});

test("RealtimeBattle marquee and single-click selection can only ever contain movable allies, never fixed deployments (towers/barricades)", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 }, {});
  const ally = makeUnit({ hp: 4 });
  battle.allies = [ally];
  battle.deploymentsMap.set("tower-1", { id: "tower-1", kind: "tower", root: { position: { x: 0, y: 0, z: 0 } } });
  battle.deploymentsMap.set("wall-1", { id: "wall-1", kind: "barricade", root: { position: { x: 1, y: 0, z: 1 } } });

  // A marquee rectangle wide enough to screen-cover every fixture position.
  battle.isMarqueeSelecting = true;
  battle.marqueeRect = { x0: 0, y0: 0, x1: 200, y1: 200 };
  battle.projectToScreen = () => ({ x: 50, y: 50 });
  battle.updateMarqueeSelection();

  assert.deepEqual(
    [...battle.selection],
    [ally],
    "marquee selection must only ever admit live allies, never tower/barricade deployments sharing the same screen space",
  );

  // selectAlly is the single-click entry point; feeding it a deployment must
  // not seat it, since deployments are structurally absent from this.allies.
  const towerLikeObject = battle.deploymentsMap.get("tower-1");
  battle.selectAlly(towerLikeObject);
  assert.equal(
    battle.selection.has(towerLikeObject),
    false,
    "selectAlly must never seat an object that is not a live member of this.allies",
  );
});

test("RealtimeBattle selection 'kind' resolves to the selected type's own identity, or 'mixed' only when a possessed ally and a shade ally are selected together", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 }, {});
  const shadeA = makeUnit({ hp: 3 });
  const shadeB = makeUnit({ hp: 2 });
  const possessed = { ...makeUnit({ hp: 3 }), isPossessed: true };
  battle.allies = [shadeA, shadeB, possessed];

  assert.equal(battle.emitSelectionChange().kind, "none", "an empty selection must resolve to kind 'none'");

  battle.selection.add(shadeA);
  assert.equal(battle.emitSelectionChange().kind, "shade", "a single ordinary ally must resolve to kind 'shade'");

  battle.selection.add(shadeB);
  assert.equal(
    battle.emitSelectionChange().kind,
    "shade",
    "multiple ordinary allies selected together are a uniform type and must still resolve to kind 'shade'",
  );

  battle.selection.clear();
  battle.selection.add(possessed);
  assert.equal(battle.emitSelectionChange().kind, "possessed", "the possessed ally alone must resolve to kind 'possessed'");

  battle.selection.add(shadeA);
  assert.equal(
    battle.emitSelectionChange().kind,
    "mixed",
    "a possessed ally selected together with an ordinary ally must resolve to kind 'mixed', not silently claim either uniform type",
  );
});

test("RealtimeBattle selectAlly publishes only semantic selection changes and clears invalid targets", () => {
  const summaries = [];
  const battle = new RealtimeBattle(
    null,
    { stageNumber: 1 },
    { onSelectionChange: (summary) => summaries.push(summary) },
  );
  const prior = makeUnit({ hp: 1 });
  const selected = { ...makeUnit({ hp: 2 }), maxHealth: 5 };
  const defeated = { ...makeUnit({ hp: 3 }), defeated: true };
  battle.allies = [prior, selected, defeated];
  battle.selection.add(prior);

  const selectedSummary = battle.selectAlly(selected);
  assert.deepEqual([...battle.selection], [selected], "the public API must replace the prior set with the requested live ally");
  assert.deepEqual(
    selectedSummary,
    {
      count: 1,
      total: 2,
      health: 2,
      maxHealth: 5,
      possessed: 0,
      engaged: 0,
      moving: 0,
      order: "holding",
      kind: "shade",
    },
    "direct selection must publish the selected ally's current and maximum health without counting defeated allies",
  );

  assert.strictEqual(
    battle.selectAlly(selected),
    selectedSummary,
    "reselecting the same ally must reuse the stable summary",
  );
  assert.equal(summaries.length, 1, "reselecting the same ally must not duplicate the cockpit callback");

  const clearedSummary = battle.selectAlly(defeated);
  assert.equal(battle.selection.size, 0, "a defeated ally must clear rather than enter the selected set");
  assert.deepEqual(
    clearedSummary,
    {
      count: 0,
      total: 2,
      health: 0,
      maxHealth: 0,
      possessed: 0,
      engaged: 0,
      moving: 0,
      order: "none",
      kind: "none",
    },
    "rejecting an invalid direct target must publish the cleared selection while preserving the live-force total",
  );
  assert.strictEqual(
    battle.selectAlly({ ...makeUnit(), id: "foreign" }),
    clearedSummary,
    "repeated invalid direct targets must preserve the stable cleared summary",
  );
  assert.equal(summaries.length, 2, "only the selected and cleared semantic states must reach the cockpit");
});

test("RealtimeBattle cloneTemplate wraps GLTF content in a wrapper root to preserve local offset on positioning", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, { stageNumber: 1 });

  // Create a mock template scene with a mesh
  const templateScene = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial()
  );
  templateScene.add(mesh);

  battle.templates.set("units/shade.glb", {
    scene: templateScene,
    animations: []
  });

  const instance = battle.cloneTemplate("units/shade.glb", 2);

  // The returned instance.root must be a wrapper Group
  assert.ok(instance.root instanceof THREE.Group, "instance.root must be a Group wrapper");
  assert.notStrictEqual(instance.root, templateScene, "instance.root must not be the template scene itself");

  // The wrapper root must contain the localRoot (normalized GLTF scene) as a child
  const localRoot = instance.root.children[0];
  assert.ok(localRoot, "instance.root wrapper must contain the localRoot child");
  assert.ok(localRoot instanceof THREE.Group || localRoot instanceof THREE.Object3D, "localRoot child must be a 3D object");

  // The localRoot must have the normalization scale and position offsets applied to its local transform
  assert.ok(localRoot.position.x !== 0 || localRoot.position.y !== 0 || localRoot.position.z !== 0, "localRoot position must have local offset applied");
  assert.ok(localRoot.scale.x !== 1, "localRoot scale must be normalized");

  // Now, position the instance.root in world space (e.g. at (10, 5, 20))
  instance.root.position.set(10, 5, 20);

  // The wrapper root position is updated, but localRoot's offset is intact
  assert.deepEqual(
    { x: instance.root.position.x, y: instance.root.position.y, z: instance.root.position.z },
    { x: 10, y: 5, z: 20 },
    "instance.root must be at the world-positioned coordinates"
  );
  assert.ok(localRoot.position.x !== 0 || localRoot.position.y !== 0 || localRoot.position.z !== 0, "localRoot offset must be preserved");
});

test("RealtimeBattle cloneTemplate preserves the authored ground-center pivot for asymmetric unit geometry", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const templateScene = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial(),
  );
  mesh.position.set(3, 0, -2);
  templateScene.add(mesh);

  battle.templates.set("units/shade.glb", {
    scene: templateScene,
    animations: [],
  });

  const instance = battle.cloneTemplate("units/shade.glb", 2);
  const localRoot = instance.root.children[0];
  const normalizedBounds = new THREE.Box3().setFromObject(localRoot);

  assert.equal(localRoot.position.x, 0, "asymmetric unit geometry must keep the local X origin");
  assert.equal(localRoot.position.z, 0, "asymmetric unit geometry must keep the local Z origin");
  assert.ok(localRoot.scale.x > 1, "unit geometry must retain its normalization scale");
  assert.ok(Math.abs(normalizedBounds.min.y) < 1e-6, "normalized unit geometry must remain grounded at Y=0");
});

test("RealtimeBattle cloneTemplate applies anisotropic Y compression only to terrain resources", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, { stageNumber: 1 });

  // Setup mock scene with BoxGeometry (5.2 x 0.65 x 2.7)
  const templateScene = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.65, 2.7),
    new THREE.MeshStandardMaterial()
  );
  templateScene.add(mesh);

  battle.templates.set("terrain/cinder-span.glb", {
    scene: templateScene,
    animations: []
  });

  const instance = battle.cloneTemplate("terrain/cinder-span.glb", 22);
  const localRoot = instance.root.children[0];

  // X and Z scale must remain identical (isotropic in X/Z)
  assert.equal(localRoot.scale.x, localRoot.scale.z, "X and Z scale must remain identical");
  // Y scale must be compressed by 0.125 compared to X/Z scale
  assert.ok(Math.abs(localRoot.scale.y - localRoot.scale.x * 0.125) < 1e-6, "Y scale must be compressed by 0.125");
  // Since geometry is centered, the min Y relative to the center is -0.65 / 2 = -0.325.
  // Position Y = -this.box.min.y * scale * 0.125 = 0.325 * localRoot.scale.y
  const expectedPosY = 0.325 * localRoot.scale.x * 0.125;
  assert.ok(Math.abs(localRoot.position.y - expectedPosY) < 1e-5, "position y offset must be scaled correctly on Y axis");
});
test("RealtimeBattle cloneTemplate lifts dark terrain materials for readable silhouettes", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const terrainScene = new THREE.Group();
  const authoredColor = new THREE.Color(0x05080c);
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: authoredColor.clone(),
    metalness: 0.95,
    roughness: 0.95,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
  });
  terrainScene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), darkMaterial));
  battle.templates.set("terrain/test-dark.glb", { scene: terrainScene, animations: [] });

  const instance = battle.cloneTemplate("terrain/test-dark.glb", 1);
  const normalizedMaterial = instance.root.children[0].children[0].material;
  const expectedLiftedColor = authoredColor.clone().multiplyScalar(1.35);

  assert.equal(normalizedMaterial.metalness, 0.4, "terrain metalness must be capped to prevent black metallic shading");
  assert.equal(normalizedMaterial.roughness, 0.72, "terrain roughness must be capped to preserve readable highlights");
  assert.equal(
    normalizedMaterial.color.getHex(),
    expectedLiftedColor.getHex(),
    "near-black terrain color must receive the authored readability lift",
  );
  assert.equal(normalizedMaterial.emissive.getHex(), 0x263454, "dark terrain must receive the slate emissive readability color");
  assert.equal(normalizedMaterial.emissiveIntensity, 0.26, "dark terrain must receive the slate emissive intensity floor");
});


test("RealtimeBattle cloneTemplate applies emissive readability lift to unit resources", async () => {
  const THREE = await import("../vendor/three.module.min.js");

  // Case 1: Unit with zero emissive and custom presentation palette
  const presentation = {
    stageNumber: 7,
    palette: {
      ally: "#00ffff"
    }
  };
  const battle = new RealtimeBattle(null, { stageNumber: 7 });
  battle.presentation = presentation;

  const unitScene1 = new THREE.Group();
  const matZero = new THREE.MeshStandardMaterial({
    emissive: new THREE.Color(0x000000)
  });
  const meshZero = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matZero);
  unitScene1.add(meshZero);

  battle.templates.set("units/test-zero.glb", {
    scene: unitScene1,
    animations: []
  });

  const instanceZero = battle.cloneTemplate("units/test-zero.glb", 1);
  const clonedMatZero = instanceZero.root.children[0].children[0].material;
  assert.equal(clonedMatZero.emissive.getHex(), 0x00ffff, "zero emissive unit uses the presentation ally color");
  assert.equal(clonedMatZero.emissiveIntensity, 0.1, "zero emissive unit raises intensity to 0.1");

  // Case 2: Unit with nonzero emissive and default fallback palette (no presentation)
  const battleDefault = new RealtimeBattle(null, { stageNumber: 1 });
  const unitScene2 = new THREE.Group();
  const matNonzero = new THREE.MeshStandardMaterial({
    emissive: new THREE.Color(0xff0000),
    emissiveIntensity: 0.1
  });
  const meshNonzero = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matNonzero);
  unitScene2.add(meshNonzero);

  battleDefault.templates.set("units/test-nonzero.glb", {
    scene: unitScene2,
    animations: []
  });

  const instanceNonzero = battleDefault.cloneTemplate("units/test-nonzero.glb", 1);
  const clonedMatNonzero = instanceNonzero.root.children[0].children[0].material;
  assert.equal(clonedMatNonzero.emissive.getHex(), 0xff0000, "nonzero emissive color is preserved");
  assert.equal(clonedMatNonzero.emissiveIntensity, 0.1, "nonzero emissive intensity floor is raised to 0.1");

  // Case 3: Unit with high nonzero emissive intensity (e.g. 0.8)
  const unitScene3 = new THREE.Group();
  const matHigh = new THREE.MeshStandardMaterial({
    emissive: new THREE.Color(0xff0000),
    emissiveIntensity: 0.8
  });
  const meshHigh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matHigh);
  unitScene3.add(meshHigh);

  battleDefault.templates.set("units/test-high.glb", {
    scene: unitScene3,
    animations: []
  });

  const instanceHigh = battleDefault.cloneTemplate("units/test-high.glb", 1);
  const clonedMatHigh = instanceHigh.root.children[0].children[0].material;
  assert.equal(clonedMatHigh.emissive.getHex(), 0xff0000, "nonzero emissive color is preserved");
  assert.equal(clonedMatHigh.emissiveIntensity, 0.8, "high emissive intensity is preserved");

  // Case 4: Non-unit asset with zero emissive
  const propScene = new THREE.Group();
  const matProp = new THREE.MeshStandardMaterial({
    emissive: new THREE.Color(0x000000)
  });
  const meshProp = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matProp);
  propScene.add(meshProp);

  battleDefault.templates.set("props/test.glb", {
    scene: propScene,
    animations: []
  });

  const instanceProp = battleDefault.cloneTemplate("props/test.glb", 1);
  const clonedMatProp = instanceProp.root.children[0].children[0].material;
  assert.equal(clonedMatProp.emissive.getHex(), 0x1a1a1a, "non-unit asset gets the fallback 0x1a1a1a color");
  assert.equal(clonedMatProp.emissiveIntensity, 0.15, "non-unit asset gets the fallback 0.15 intensity");
});

test("ParticleField direct disposal is idempotent and rejects later emission and updates", async () => {
  const { ParticleField } = await import("../battle-realtime-three.js");
  const field = new ParticleField({ add() {} });
  const releases = { points: 0, geometry: 0, material: 0 };
  field.points.removeFromParent = () => {
    releases.points += 1;
  };
  field.points.geometry.dispose = () => {
    releases.geometry += 1;
  };
  field.points.material.dispose = () => {
    releases.material += 1;
  };

  field.emit(1, 2, 3, "#ffffff", 1);
  const cursorBeforeDispose = field.cursor;
  field.dispose();
  field.dispose();

  assert.deepEqual(
    releases,
    { points: 1, geometry: 1, material: 1 },
    "direct repeated disposal must detach the Points object and release each owned GPU resource exactly once",
  );
  assert.equal(field.emit(4, 5, 6, "#ff0000", 2), false, "a disposed field must reject later particle emission");
  assert.equal(field.update(1 / 60), false, "a disposed field must reject later simulation updates");
  assert.equal(field.cursor, cursorBeforeDispose, "rejected post-disposal emission must not advance the particle pool");
});

test("SpatialAudio tracks modern listener transforms and directly disposes its graph once", async (t) => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const releases = { master: 0, context: 0 };

  class ModernAudioContext {
    state = "running";
    destination = {};
    listener = {
      positionX: { value: 0 },
      positionY: { value: 0 },
      positionZ: { value: 0 },
      forwardX: { value: 0 },
      forwardY: { value: 0 },
      forwardZ: { value: 0 },
      upX: { value: 0 },
      upY: { value: 0 },
      upZ: { value: 0 },
    };

    createGain() {
      return {
        gain: { value: 0 },
        connect(target) {
          return target;
        },
        disconnect() {
          releases.master += 1;
        },
      };
    }

    close() {
      releases.context += 1;
      this.state = "closed";
      return Promise.resolve();
    }
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { AudioContext: ModernAudioContext },
  });
  t.after(() => {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
  });

  const { SpatialAudio } = await import("../battle-realtime-three.js");
  const audio = new SpatialAudio();
  const listener = audio.ctx.listener;
  audio.updateListener({
    position: { x: 7, y: 3, z: -5 },
    getWorldDirection(target) {
      return target.set(-0.5, 0.25, -0.75);
    },
  });

  assert.deepEqual(
    {
      position: [listener.positionX.value, listener.positionY.value, listener.positionZ.value],
      forward: [listener.forwardX.value, listener.forwardY.value, listener.forwardZ.value],
      up: [listener.upX.value, listener.upY.value, listener.upZ.value],
    },
    {
      position: [7, 3, -5],
      forward: [-0.5, 0.25, -0.75],
      up: [0, 1, 0],
    },
    "modern AudioParams must follow the camera position, world direction, and Three.js Y-up orientation",
  );

  audio.dispose();
  audio.dispose();

  assert.deepEqual(
    releases,
    { master: 1, context: 1 },
    "direct repeated disposal must disconnect the master graph and close its AudioContext exactly once",
  );
  assert.equal(audio.master, null, "disposed audio must relinquish its master-node reference");
  assert.equal(audio.ctx, null, "disposed audio must relinquish its context reference");
});

test("RealtimeBattle boss phase transitions own their tint and emit one visual/audio cue per new phase", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { hostile: "#ff204e" },
  });
  const templateMaterial = new THREE.MeshStandardMaterial({
    color: 0x224466,
    emissive: 0x000000,
    emissiveIntensity: 0.1,
  });
  const originalTemplateDispose = templateMaterial.dispose.bind(templateMaterial);
  let templateDisposals = 0;
  templateMaterial.dispose = () => {
    templateDisposals += 1;
    originalTemplateDispose();
  };
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.Mesh(geometry, templateMaterial);
  const root = new THREE.Group();
  root.position.set(3, 0, -2);
  root.add(mesh);
  const boss = { id: "warden", root, defeated: false, mixer: null };
  const particles = [];
  const tones = [];
  const animations = [];
  battle.boss = boss;
  battle.bossExposed = true;
  battle.particles = { emit: (...args) => particles.push(args) };
  battle.audio = { playTone: (...args) => tones.push(args) };
  battle.play = (actor, clip, restart) => animations.push({ actor, clip, restart });

  battle.applyBossPhaseVisual({
    phaseIndex: 0,
    normalizedHealth: 1,
    phaseCue: { clip: "Special" },
  });
  const phaseMaterial = mesh.material;
  const originalPhaseDispose = phaseMaterial.dispose.bind(phaseMaterial);
  let phaseDisposals = 0;
  phaseMaterial.dispose = () => {
    phaseDisposals += 1;
    originalPhaseDispose();
  };

  assert.notEqual(phaseMaterial, templateMaterial, "phase tinting must clone a template-shared boss material");
  assert.equal(phaseMaterial.userData.isBossPhaseTint, true, "the cloned phase tint must be marked as renderer-owned");
  assert.deepEqual(
    { particles, tones, animations },
    { particles: [], tones: [], animations: [] },
    "the initial phase establishes a visual baseline without presenting a transition cue",
  );

  const pressuredPhase = {
    phaseIndex: 1,
    normalizedHealth: 0.6,
    phaseCue: { clip: "Special" },
  };
  battle.applyBossPhaseVisual(pressuredPhase);
  battle.applyBossPhaseVisual(pressuredPhase);

  assert.equal(mesh.material, phaseMaterial, "later phase updates must reuse the renderer-owned tint instead of cloning repeatedly");
  assert.equal(particles.length, 1, "entering a new phase must emit one visual burst and repeated same-phase state must emit none");
  assert.equal(tones.length, 1, "entering a new phase must emit one spatial tone and repeated same-phase state must emit none");
  assert.deepEqual(
    animations,
    [{ actor: boss, clip: "Special", restart: true }],
    "the authored phase animation must restart once on transition and not replay for repeated state",
  );

  battle.retire(boss);
  assert.equal(phaseDisposals, 1, "retiring the boss must dispose its renderer-owned phase-tint material");
  assert.equal(templateDisposals, 0, "retiring the boss must not dispose the template-shared source material");
  geometry.dispose();
  originalTemplateDispose();
});

test("RealtimeBattle marker pulses compose with the latest authoritative boss phase scale and emissive baseline", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const templateMaterial = new THREE.MeshStandardMaterial({
    color: 0x473544,
    emissive: 0x19080d,
    emissiveIntensity: 0.3,
  });
  const templateScene = new THREE.Group();
  const templateMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), templateMaterial);
  templateMesh.name = "boss-phase-highlight-mesh";
  templateScene.add(templateMesh);

  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    reducedMotion: true,
    palette: { hostile: "#ff204e" },
  });
  battle.contactGeometry = null;
  battle.contactMaterial = null;
  battle.templates.set("bosses/cinder-warden.glb", { scene: templateScene, animations: [] });
  battle.boss = battle.cloneTemplate("bosses/cinder-warden.glb", 2.7);
  battle.boss.root.userData.semantic = "assault";
  battle.reconcileAllies = () => {};
  battle.emitSelectionChange = () => {};
  battle.applyEncounter = () => {};
  battle.reconcileDeployments = () => {};
  battle.updateNodeVisuals = () => {};
  battle.syncObjectFeedback = () => {};
  battle.particles = { emit() {} };
  battle.audio = { playTone() {} };
  battle.play = () => {};
  let availableActions = new Set();
  battle.getAvailableActions = () => availableActions;
  // This test is about phase-tint/pulse composition, not range gating;
  // keep every action "in range" so isAct tracks availableActions alone.
  battle.getCommandReadiness = () => ({ ready: true });
  const bossMesh = battle.boss.root.getObjectByName("boss-phase-highlight-mesh");
  const closeTo = (actual, expected, message) => {
    assert.ok(
      Math.abs(actual - expected) <= 1e-10,
      `${message}; expected ${expected}, received ${actual}`,
    );
  };

  battle.applyCampaignState({
    state: { bossHealth: 10, bossMaxHealth: 10, bossPhaseCount: 3 },
  });
  const initialPhaseScale = battle.boss.root.scale.x;
  const initialPhaseIntensity = bossMesh.material.emissiveIntensity;
  battle.bossExposed = false;
  battle.lastHoveredAction = null;
  battle.updateMarkerPulses(1 / 60);

  battle.applyCampaignState({
    state: { bossHealth: 2, bossMaxHealth: 10, bossPhaseCount: 3 },
  });
  const authoritativeScale = battle.boss.root.scale.x;
  const authoritativeIntensity = bossMesh.material.emissiveIntensity;
  assert.ok(authoritativeScale > initialPhaseScale, "a later authoritative boss phase must increase the boss scale");
  assert.ok(
    authoritativeIntensity > initialPhaseIntensity,
    "reduced authoritative boss health and phase must raise the emissive baseline",
  );

  battle.bossExposed = true;
  availableActions = new Set(["assault"]);
  battle.updateMarkerPulses(1 / 60);
  closeTo(
    battle.boss.root.scale.x,
    authoritativeScale * 1.02,
    "actionable emphasis must multiply the latest authoritative phase scale",
  );
  closeTo(
    bossMesh.material.emissiveIntensity,
    authoritativeIntensity * 1.3,
    "actionable emphasis must multiply the latest authoritative phase and health emissive baseline",
  );

  battle.lastHoveredAction = "assault";
  battle.updateMarkerPulses(1 / 60);
  closeTo(
    battle.boss.root.scale.x,
    authoritativeScale * 1.08,
    "hover emphasis must multiply the latest authoritative phase scale",
  );
  closeTo(
    bossMesh.material.emissiveIntensity,
    authoritativeIntensity * 1.8,
    "hover emphasis must multiply the latest authoritative phase and health emissive baseline",
  );

  battle.lastHoveredAction = null;
  battle.bossExposed = false;
  availableActions = new Set();
  battle.updateMarkerPulses(1 / 60);
  closeTo(
    battle.boss.root.scale.x,
    authoritativeScale,
    "clearing emphasis must restore the latest authoritative phase scale",
  );
  closeTo(
    bossMesh.material.emissiveIntensity,
    authoritativeIntensity,
    "clearing emphasis must restore the latest authoritative phase and health emissive baseline",
  );
});

test("RealtimeBattle boss phase traversal preserves shared contact resources", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { hostile: "#ff204e" },
  });
  const disposals = { geometry: 0, material: 0 };
  const contactGeometry = new THREE.RingGeometry(0, 0.45, 16);
  const contactMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const originalGeometryDispose = contactGeometry.dispose.bind(contactGeometry);
  const originalMaterialDispose = contactMaterial.dispose.bind(contactMaterial);
  contactGeometry.dispose = () => { disposals.geometry += 1; };
  contactMaterial.dispose = () => { disposals.material += 1; };
  battle.contactGeometry = contactGeometry;
  battle.contactMaterial = contactMaterial;

  const contactShadow = new THREE.Mesh(contactGeometry, contactMaterial);
  const root = new THREE.Group();
  root.add(contactShadow);
  const boss = { root, defeated: false, mixer: null };
  battle.boss = boss;

  battle.applyBossPhaseVisual({
    phaseIndex: 1,
    normalizedHealth: 0.5,
    phaseCue: { clip: "Special" },
  });

  assert.equal(contactShadow.geometry, contactGeometry, "phase traversal must preserve the battle-shared contact geometry identity");
  assert.equal(contactShadow.material, contactMaterial, "phase traversal must preserve the battle-shared contact material identity");
  assert.notEqual(
    contactMaterial.userData.isBossPhaseTint,
    true,
    "the shared contact material must never be marked as a renderer-owned phase clone",
  );

  battle.retire(boss);
  assert.deepEqual(
    disposals,
    { geometry: 0, material: 0 },
    "retiring a phase-styled boss must not dispose battle-shared contact resources",
  );

  originalGeometryDispose();
  originalMaterialDispose();
});

test("RealtimeBattle emits one guardian or ranged spawn alert per pattern per wave", () => {
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { hostile: "#ff7f79" },
  });
  const particles = [];
  const tones = [];
  battle.scene = { add() {} };
  battle.particles = { emit: (...args) => particles.push(args) };
  battle.audio = { playTone: (...args) => tones.push(args) };
  battle.cloneTemplate = () => {
    const enemy = makeUnit();
    enemy.root.rotation = {};
    return enemy;
  };
  battle.resolveSpawn = () => true;
  battle.play = () => {};

  battle.spawnEncounterWave({ id: "shield-line", pattern: "guardian", hostiles: 3, hostileHealth: 4 });
  battle.spawnEncounterWave({ id: "artillery-line", pattern: "ranged", hostiles: 3, hostileHealth: 2 });

  assert.deepEqual(
    battle.enemies
      .filter((enemy) => enemy.lastAlertCue)
      .map((enemy) => ({ pattern: enemy.patternId, event: enemy.lastAlertCue.event })),
    [
      { pattern: "guardian", event: "guardian-shield" },
      { pattern: "ranged", event: "enemy-ranged-warning" },
    ],
    "guardian and ranged patterns must select their distinct spawn-alert contracts once per wave",
  );
  assert.equal(particles.length, 2, "six spawned enemies across two homogeneous waves must produce only two alert bursts");
  assert.equal(tones.length, 2, "six spawned enemies across two homogeneous waves must produce only two alert tones");
});

test("RealtimeBattle emits summon evolution effects only for an authoritative level transition without mutating frozen state", () => {
  const battle = new RealtimeBattle(null, {
    stageNumber: 1,
    palette: { ally: "#70e5d0" },
  });
  const portal = makeRoot(6, -4);
  const portalProp = {};
  const particles = [];
  const tones = [];
  const animations = [];
  battle.portal = portal;
  battle.portalProp = portalProp;
  battle.particles = { emit: (...args) => particles.push(args) };
  battle.audio = { playTone: (...args) => tones.push(args) };
  battle.play = (actor, clip, restart) => animations.push({ actor, clip, restart });

  const campaignAt = (level) => Object.freeze({
    state: Object.freeze({
      progression: Object.freeze({
        summons: Object.freeze({
          levels: Object.freeze({ shade: level }),
        }),
      }),
    }),
  });
  const baseline = campaignAt(1);
  const evolved = campaignAt(2);

  battle.applyCampaignState({ campaign: baseline });
  assert.deepEqual(
    { particles, tones, animations },
    { particles: [], tones: [], animations: [] },
    "the initial authoritative summon level is a baseline and must not be presented as an evolution",
  );

  battle.applyCampaignState({ campaign: evolved });
  assert.equal(particles.length, 1, "an authoritative summon level increase must emit one evolution particle burst");
  assert.equal(tones.length, 1, "an authoritative summon level increase must emit one evolution tone");
  assert.deepEqual(
    animations,
    [{ actor: portalProp, clip: "Activate", restart: true }],
    "an authoritative summon level increase must activate the portal once",
  );

  battle.applyCampaignState({ campaign: evolved });
  assert.equal(particles.length, 1, "repeating the same authoritative summon level must not duplicate evolution particles");
  assert.equal(tones.length, 1, "repeating the same authoritative summon level must not duplicate the evolution tone");
  assert.equal(animations.length, 1, "repeating the same authoritative summon level must not reactivate the portal");
  assert.deepEqual(
    {
      baseline: baseline.state.progression.summons.levels,
      evolved: evolved.state.progression.summons.levels,
    },
    {
      baseline: { shade: 1 },
      evolved: { shade: 2 },
    },
    "renderer observation must leave the supplied frozen campaign state unchanged",
  );
});

function observeThreeObjectFeedback(t) {
  const calls = { reconciles: [], speech: [], exchanges: [], renders: [], destroys: 0 };
  const originals = {
    reconcile: ObjectFeedbackLayer.prototype.reconcile,
    emitSpeech: ObjectFeedbackLayer.prototype.emitSpeech,
    emitExchange: ObjectFeedbackLayer.prototype.emitExchange,
    render: ObjectFeedbackLayer.prototype.render,
    destroy: ObjectFeedbackLayer.prototype.destroy,
  };
  ObjectFeedbackLayer.prototype.reconcile = function reconcile(objects, options) {
    calls.reconciles.push({
      objects: objects.map(({ id, kind, hp, maxHp }) => ({ id, kind, hp, maxHp })),
      options: { ...options },
    });
    return originals.reconcile.call(this, objects, options);
  };
  ObjectFeedbackLayer.prototype.emitSpeech = function emitSpeech(objectId, text, options) {
    calls.speech.push({ objectId, text });
    return originals.emitSpeech.call(this, objectId, text, options);
  };
  ObjectFeedbackLayer.prototype.emitExchange = function emitExchange(sourceId, targetId, value, type, options) {
    calls.exchanges.push({ sourceId, targetId, value, type });
    return originals.emitExchange.call(this, sourceId, targetId, value, type, options);
  };
  ObjectFeedbackLayer.prototype.render = function render(projector, now) {
    calls.renders.push({ projector: typeof projector, now });
  };
  ObjectFeedbackLayer.prototype.destroy = function destroy() {
    calls.destroys += 1;
    return originals.destroy.call(this);
  };
  t.after(() => {
    Object.assign(ObjectFeedbackLayer.prototype, originals);
  });
  return calls;
}

function makeThreeFeedbackCanvas() {
  const context = { clearRect() {} };
  return {
    clientWidth: 320,
    clientHeight: 180,
    width: 0,
    height: 0,
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 320, height: 180 }),
  };
}

test("RealtimeBattle object feedback mirrors authoritative actors, live deltas, frame projection, and lifecycle", (t) => {
  const priorWindow = globalThis.window;
  const priorDocument = globalThis.document;
  const priorRequestAnimationFrame = globalThis.requestAnimationFrame;
  const priorCancelAnimationFrame = globalThis.cancelAnimationFrame;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  t.after(() => {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
    if (priorRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = priorRequestAnimationFrame;
    if (priorCancelAnimationFrame === undefined) delete globalThis.cancelAnimationFrame;
    else globalThis.cancelAnimationFrame = priorCancelAnimationFrame;
  });

  const calls = observeThreeObjectFeedback(t);
  const canvas = {
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ width: 320, height: 180 }),
  };
  const battle = new RealtimeBattle(
    canvas,
    { stageNumber: 1, palette: { ally: "#70e5d0", hostile: "#ff7f79" } },
    { feedbackCanvas: makeThreeFeedbackCanvas() },
  );
  battle.reconcileAllies = () => {};
  battle.reconcileEncounterWave = () => {};
  battle.syncBossExposure = () => {};
  battle.reconcileDeployments = () => {};
  battle.updateNodeVisuals = () => {};
  battle.publishRuntimeState = () => {};
  battle.applyBossPhaseVisual = () => {};
  battle.update = () => {};
  battle.updatePlacementPreview = () => {};
  battle.updateFocusHighlight = () => {};
  battle.updateSelectionVisuals = () => {};
  battle.updateMarqueeVisual = () => {};
  battle.updateCommanderPathPreview = () => {};
  battle.renderer = { render() {}, dispose() {} };
  battle.scene = null;
  battle.camera = {};

  battle.commander = { ...makeUnit({ hp: 10 }), id: "commander", maxHealth: 10 };
  const ally = { ...makeUnit({ hp: 2 }), id: "ally-live", maxHealth: 3 };
  const enemy = { ...makeUnit({ hp: 4 }), id: "enemy-live", maxHealth: 4, breachVisualized: false };
  battle.allies = [ally];
  battle.enemies = [enemy];
  battle.boss = { ...makeUnit({ hp: 12 }), id: "boss", maxHealth: 12 };
  const deploymentRoot = makeRoot(5, 5);
  deploymentRoot.children = [];
  deploymentRoot.traverse = () => {};
  battle.deploymentsMap.set("tower-live", {
    id: "tower-live",
    kind: "tower",
    gridX: 5,
    gridY: 5,
    hp: 4,
    maxHp: 4,
    root: deploymentRoot,
  });

  const campaign = Object.freeze({
    stageId: "feedback-stage",
    stage: Object.freeze({
      legion: 1,
      nodes: 0,
      bossHealth: 12,
      bossMaxHealth: 12,
      deployments: Object.freeze([
        Object.freeze({ id: "tower-live", kind: "tower", cell: Object.freeze({ x: 5, y: 5 }), hp: 4, maxHp: 4 }),
      ]),
    }),
  });
  const campaignBefore = structuredClone(campaign);

  battle.applyCampaignState({ campaign });
  battle.applyCampaignState({ campaign });
  battle.currentWaveId = "wave-live";
  battle.encounter = {
    stageId: "feedback-stage",
    state: { activeWaveId: "wave-live" },
  };
  battle.pendingEncounterEvent = null;
  battle.emitEncounterEvent("breach");

  enemy.hp = 2;
  ally.hp = 3;
  battle.running = true;
  battle.lastTime = 1000;
  battle.frame(1016);
  battle.destroy();
  battle.destroy();

  const reconciledIds = calls.reconciles.at(-1)?.objects.map(({ id }) => id).sort() ?? [];
  const deltaValues = calls.exchanges
    .map(({ targetId, value, type }) => ({ targetId, value, type }))
    .sort((left, right) => left.targetId.localeCompare(right.targetId));
  assert.deepEqual(
    {
      reconciledIds,
      silentReconciles: calls.reconciles.map(({ options }) => options?.silent === true),
      speech: calls.speech,
      deltaValues,
      renders: calls.renders.map(({ projector }) => projector),
      destroys: calls.destroys,
      campaign,
    },
    {
      reconciledIds: ["ally-live", "boss", "commander", "enemy-live", "tower-live"],
      silentReconciles: [true, true],
      speech: [{ objectId: "commander", text: "Breach detected" }],
      deltaValues: [
        { targetId: "ally-live", value: 1, type: "heal" },
        { targetId: "enemy-live", value: 2, type: "outgoing" },
      ],
      renders: ["function"],
      destroys: 1,
      campaign: campaignBefore,
    },
    "the Three renderer must use one presentation-only feedback layer without replaying identical campaign snapshots",
  );
});

test("RealtimeBattle feedbackObjects surfaces ally and tower action-readiness as a stamina-style bar while omitting it for commander, boss, and non-tower deployments", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });

  battle.commander = { ...makeUnit({ hp: 10 }), id: "commander" };
  battle.boss = { ...makeUnit({ hp: 12 }), id: "boss" };
  battle.allies = [{ ...makeUnit({ hp: 3 }), id: "ally-1", cooldown: 0.275 }];
  battle.enemies = [{ ...makeUnit({ hp: 4 }), id: "enemy-1" }];
  battle.deploymentsMap.set("tower-1", {
    id: "tower-1",
    kind: "tower",
    hp: 4,
    maxHp: 4,
    cooldown: 0.25,
  });
  battle.deploymentsMap.set("wall-1", {
    id: "wall-1",
    kind: "barricade",
    hp: 5,
    maxHp: 5,
    cooldown: 0,
  });

  const byId = Object.fromEntries(battle.feedbackObjects().map((object) => [object.id, object]));

  assert.equal(byId["ally-1"].maxEnergy, 0.55, "an ally's readiness bar must span its full strike cooldown");
  assert.ok(
    Math.abs(byId["ally-1"].energy - 0.275) < 1e-9,
    "an ally halfway through its cooldown must report half-filled readiness",
  );
  assert.equal(byId["tower-1"].maxEnergy, 1, "a tower's readiness bar must span its full fire cooldown");
  assert.ok(
    Math.abs(byId["tower-1"].energy - 0.75) < 1e-9,
    "a tower three-quarters recovered must report three-quarters-filled readiness",
  );
  assert.deepEqual(
    [byId.commander.maxEnergy, byId.boss.maxEnergy, byId["wall-1"].maxEnergy],
    [undefined, undefined, undefined],
    "units without a cooldown-gated action must not draw a stamina bar",
  );
});

test("RealtimeBattle tags gimmick markers with click-resolvable command semantics, including the previously unreachable node and hunt candidates", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  battle.scene = new THREE.Scene();
  battle.ringGeometry = null;
  battle.contactGeometry = null;
  battle.contactMaterial = null;
  for (const resource of [
    "terrain/cinder-span.glb",
    "units/shade.glb",
    "units/scout.glb",
    "units/guard.glb",
    "units/reinforce.glb",
    "bosses/cinder-warden.glb",
  ]) {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    battle.templates.set(resource, { scene, animations: [] });
  }

  battle.createBattleObjects();


  assert.equal(
    battle.nodes[0].userData.semantic,
    "capture",
    "a command node marker must carry a Capture semantic so clicking it in the canvas triggers the command",
  );
  assert.equal(battle.portal.userData.semantic, "materialize", "the portal marker keeps its primary command semantic");
  assert.deepEqual(
    battle.portal.userData.semanticGroup,
    ["materialize", "domain"],
    "the portal anchor also covers its co-located Domain command",
  );
  assert.equal(battle.extractor.userData.semantic, "extract", "the extractor marker keeps its primary command semantic");
  assert.deepEqual(
    battle.extractor.userData.semanticGroup,
    ["hunt", "extract"],
    "the extractor anchor also covers its co-located Hunt command, which previously had no clickable trigger",
  );
});

test("RealtimeBattle resolvePointerAction resolves a marker's semantic group to whichever candidate the campaign currently allows", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  battle.setPointerRay = () => true;
  const groupRoot = { userData: { semanticGroup: ["hunt", "extract"] }, parent: null };
  battle.raycaster = { intersectObjects: () => [{ object: groupRoot }] };

  battle.getAvailableActions = () => ["extract"];
  assert.equal(
    battle.resolvePointerAction({}),
    "extract",
    "the group must resolve to whichever candidate is currently available",
  );

  battle.getAvailableActions = () => ["hunt"];
  assert.equal(
    battle.resolvePointerAction({}),
    "hunt",
    "the group must resolve to Hunt once it becomes the available candidate",
  );

  battle.getAvailableActions = () => ["materialize"];
  assert.equal(
    battle.resolvePointerAction({}),
    null,
    "a group with no currently available candidate must not resolve to an action",
  );
});

test("RealtimeBattle getCommandReadiness gates each action on the commander's distance to its world gimmick anchor", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });

  const materializeAtSpawn = battle.getCommandReadiness({ action: "materialize" });
  assert.equal(
    materializeAtSpawn.ready,
    true,
    "materialize is anchored at the portal, where the commander spawns, so it starts in range",
  );

  const huntFromSpawn = battle.getCommandReadiness({ action: "hunt" });
  assert.equal(huntFromSpawn.ready, false, "hunt is anchored at the distant extractor and must reject an out-of-range commander");
  assert.equal(huntFromSpawn.reason, "out-of-range");
  assert.ok(huntFromSpawn.distance > huntFromSpawn.required, "the reported distance must exceed the interaction radius it was measured against");

  const extractorAnchor = battle.navigation.anchors.extractor;
  const extractorWorld = battle.navigation.gridToWorld(extractorAnchor.x, extractorAnchor.y);
  battle.commanderPosition.set(extractorWorld.x, 0, extractorWorld.z);
  const huntAtExtractor = battle.getCommandReadiness({ action: "hunt" });
  assert.equal(huntAtExtractor.ready, true, "walking the commander to the extractor must bring Hunt into range");
});

test("RealtimeBattle plays a distinct commander motion clip per command instead of always the same generic clip", () => {
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  const commander = { id: "commander" };
  battle.commander = commander;
  battle.getAvailableActions = () => [];

  const expected = {
    hunt: "Strike",
    extract: "Cast",
    materialize: "Special",
    capture: "Cast",
    possess: "Cast",
    domain: "Special",
    assault: "StrikeHeavy",
  };

  for (const [action, clip] of Object.entries(expected)) {
    const plays = [];
    battle.play = (unit, playedClip, once) => plays.push({ unit, clip: playedClip, once });
    battle.playActionEffect({ action });
    assert.deepEqual(
      plays.find(({ unit }) => unit === commander),
      { unit: commander, clip, once: true },
      `${action} must play the commander's "${clip}" clip, not a one-size-fits-all default`,
    );
  }
});

test("RealtimeBattle updateActionRangeRing draws a constant range affordance at ACTION_INTERACTION_RADIUS and brightens only when an available action's anchor is inside it", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  battle.scene = new THREE.Scene();
  battle.getAvailableActions = () => ["hunt"];

  battle.updateActionRangeRing();

  assert.ok(battle.actionRangeRing, "a range ring must be created");
  assert.equal(
    battle.scene.children.includes(battle.actionRangeRing),
    true,
    "the ring must be added to the scene exactly once",
  );
  // The ring spans multiple grid cells (up to ACTION_INTERACTION_RADIUS), so
  // depth-testing against terrain would clip it under any nearby higher
  // elevation cell -- it must always draw on top instead (regression: this
  // previously rendered under the map on any stage with heightfield variance
  // near the commander).
  assert.equal(
    battle.actionRangeRing.material.depthTest,
    false,
    "the range ring must not depth-test against terrain, or elevation variance under its span clips it invisible",
  );
  assert.equal(
    battle.actionRangeRing.renderOrder,
    15,
    "the range ring must draw with an explicit renderOrder so it consistently layers above terrain",
  );
  assert.equal(
    battle.actionRangeRing.position.x,
    battle.commanderPosition.x,
    "the ring must track the commander's world position",
  );
  const { required: actionInteractionRadius } = battle.getCommandReadiness({ action: "hunt" });
  assert.equal(
    battle.actionRangeRing.geometry.parameters.outerRadius,
    actionInteractionRadius,
    "the ring radius must match the actual interaction-range gate, not an arbitrary constant",
  );
  // Hunt's anchor (the extractor) is far from the portal spawn: nothing is
  // reachable yet, so the ring must read as dim/neutral.
  const dimOpacity = battle.actionRangeRing.material.opacity;
  assert.ok(dimOpacity < 0.5, "the ring must read as dim when no available action's anchor is within range");

  const extractorAnchor = battle.navigation.anchors.extractor;
  const extractorWorld = battle.navigation.gridToWorld(extractorAnchor.x, extractorAnchor.y);
  battle.commanderPosition.set(extractorWorld.x, 0, extractorWorld.z);
  battle.updateActionRangeRing();

  assert.ok(
    battle.actionRangeRing.material.opacity > dimOpacity,
    "walking into Hunt's actual range must brighten the ring instead of leaving it at the dim/out-of-range reading",
  );
});

test("RealtimeBattle gimmick markers only glow actionable once the commander is both campaign-legal and within range (the readiness alarm)", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, { stageNumber: 1, reducedMotion: true });
  battle.scene = new THREE.Scene();
  battle.ringGeometry = null;
  battle.contactGeometry = null;
  battle.contactMaterial = null;
  for (const resource of [
    "terrain/cinder-span.glb",
    "units/shade.glb",
    "units/scout.glb",
    "units/guard.glb",
    "units/reinforce.glb",
    "bosses/cinder-warden.glb",
  ]) {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    battle.templates.set(resource, { scene, animations: [] });
  }
  battle.createBattleObjects();
  battle.getAvailableActions = () => ["hunt"];
  battle.lastHoveredAction = null;

  battle.updateMarkerPulses(1 / 60);
  assert.equal(
    battle.extractor.scale.x,
    1,
    "the extractor must not glow actionable while hunt is campaign-legal but the commander is still out of range",
  );

  const extractorAnchor = battle.navigation.anchors.extractor;
  const extractorWorld = battle.navigation.gridToWorld(extractorAnchor.x, extractorAnchor.y);
  battle.commanderPosition.set(extractorWorld.x, 0, extractorWorld.z);
  battle.updateMarkerPulses(1 / 60);
  assert.ok(
    battle.extractor.scale.x > 1,
    "walking the commander into range must light the extractor up as actionable, matching getCommandReadiness",
  );
});

test("RealtimeBattle tints the commander with a distinct identity color so it never renders identical to its own shade legion", async () => {
  const THREE = await import("../vendor/three.module.min.js");
  const battle = new RealtimeBattle(null, { stageNumber: 1 });
  battle.scene = new THREE.Scene();
  battle.ringGeometry = null;
  battle.contactGeometry = null;
  battle.contactMaterial = null;
  const shadeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000 });
  for (const resource of [
    "terrain/cinder-span.glb",
    "units/scout.glb",
    "units/guard.glb",
    "units/reinforce.glb",
    "bosses/cinder-warden.glb",
  ]) {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    battle.templates.set(resource, { scene, animations: [] });
  }
  const shadeScene = new THREE.Group();
  const shadeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shadeMaterial);
  shadeMesh.name = "shade-body";
  shadeScene.add(shadeMesh);
  battle.templates.set("units/shade.glb", { scene: shadeScene, animations: [] });

  battle.createBattleObjects();
  battle.createAlly();
  const ally = battle.allies[battle.allies.length - 1];
  const allyMesh = ally.root.getObjectByName("shade-body");
  const commanderMesh = battle.commander.root.getObjectByName("shade-body");

  assert.notEqual(
    commanderMesh.material,
    shadeMaterial,
    "the commander must own a runtime-cloned material, not the shared shade.glb template material",
  );
  assert.notEqual(
    commanderMesh.material.color.getHex(),
    0xffffff,
    "the commander's material must be visibly tinted away from the template's white base color",
  );
  assert.notEqual(
    commanderMesh.material.color.getHex(),
    allyMesh.material.color.getHex(),
    "the commander must read as a visually distinct color from an ordinary shade ally cloned from the same resource",
  );
  assert.equal(
    shadeMaterial.color.getHex(),
    0xffffff,
    "tinting the commander must never mutate the shared shade.glb template material",
  );
});

test("RealtimeBattle deduplicates repeated mouse and touch chest activations until synchronized chest ID changes", () => {
  for (const [pointerType, pointerIdBase] of [["mouse", 10], ["touch", 20]]) {
    const capturedPointers = new Set();
    const canvas = {
      style: {},
      focus() {},
      setPointerCapture(id) {
        capturedPointers.add(id);
      },
      hasPointerCapture(id) {
        return capturedPointers.has(id);
      },
      releasePointerCapture(id) {
        capturedPointers.delete(id);
      },
    };
    const encounterEvents = [];
    const tones = [];
    const battle = new RealtimeBattle(canvas, { stageNumber: 1 }, {
      onEncounterEvent(event) {
        encounterEvents.push(event);
      },
    });
    battle.stageId = "cinder-span";
    battle.resolvePointerAction = () => "open-chest";
    battle.setHoveredAction = () => {};
    battle.audio = {
      playTone(...args) {
        tones.push(args);
      },
      dispose() {},
    };
    battle.commanderPosition = { x: 0, y: 0, z: 0 };
    battle.createChestVisuals = (chest) => {
      battle.renderedChest = chest;
      battle.chestGroup = { position: { x: 1, y: 0, z: 2 } };
    };
    battle.removeChestVisuals = () => {
      battle.renderedChest = null;
      battle.chestGroup = null;
    };
    battle.applyEncounter = () => {};
    battle.reconcileDeployments = () => {};
    battle.updateNodeVisuals = () => {};
    battle.syncObjectFeedback = () => {};
    const synchronizeChest = (pendingChest) => {
      battle.applyCampaignState({ state: { stage: { pendingChest } } });
    };


    const activate = (pointerId) => {
      const event = {
        button: 0,
        clientX: 40,
        clientY: 50,
        pointerId,
        pointerType,
        timeStamp: 100,
      };
      battle.onPointerDown(event);
      battle.onPointerUp({ ...event, timeStamp: 150 });
    };

    synchronizeChest({ id: `${pointerType}-chest-a`, itemId: "void-blade" });
    activate(pointerIdBase);
    activate(pointerIdBase + 1);

    assert.deepEqual(
      encounterEvents,
      [{ type: "open-chest", stageId: "cinder-span", chestId: `${pointerType}-chest-a` }],
      `${pointerType} must emit one reducer request while the same chest is pending reconciliation`,
    );
    assert.equal(tones.length, 1, `${pointerType} must play the chest activation tone only once before reconciliation`);

    synchronizeChest({ id: `${pointerType}-chest-b`, itemId: "iron-resolve" });
    activate(pointerIdBase + 2);
    activate(pointerIdBase + 3);

    assert.deepEqual(
      encounterEvents,
      [
        { type: "open-chest", stageId: "cinder-span", chestId: `${pointerType}-chest-a` },
        { type: "open-chest", stageId: "cinder-span", chestId: `${pointerType}-chest-b` },
      ],
      `${pointerType} must allow exactly one new reducer request after synchronized chest ID changes`,
    );
    assert.equal(tones.length, 2, `${pointerType} must play one activation tone per synchronized chest ID`);
  }
});

test("RealtimeBattle emits exact chest events for mouse and touch and reconciles one disposable field visual", (t) => {
  const priorDocument = globalThis.document;
  const priorWindow = globalThis.window;
  globalThis.document = { removeEventListener() {} };
  globalThis.window = { removeEventListener() {} };
  t.after(() => {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  });

  const capturedPointers = new Set();
  const canvas = {
    style: {},
    focus() {},
    setPointerCapture(id) {
      capturedPointers.add(id);
    },
    hasPointerCapture(id) {
      return capturedPointers.has(id);
    },
    releasePointerCapture(id) {
      capturedPointers.delete(id);
    },
    removeEventListener() {},
  };
  const encounterEvents = [];
  const battle = new RealtimeBattle(canvas, { stageNumber: 1 }, {
    onEncounterEvent(event) {
      encounterEvents.push(event);
    },
  });
  battle.stageId = "cinder-span";
  battle.resolvePointerAction = () => "open-chest";
  battle.setHoveredAction = () => {};
  battle.audio = { playTone() {}, dispose() {} };
  battle.commanderPosition = { x: 0, y: 0, z: 0 };
  battle.createChestVisuals = (chest) => {
    battle.renderedChest = chest;
    battle.chestGroup = { position: { x: 1, y: 0, z: 2 } };
  };
  battle.removeChestVisuals = () => {
    battle.renderedChest = null;
    battle.chestGroup = null;
  };
  battle.applyEncounter = () => {};
  battle.reconcileDeployments = () => {};
  battle.updateNodeVisuals = () => {};
  battle.syncObjectFeedback = () => {};


  const click = (pointerType, pointerId, chestId) => {
    battle.applyCampaignState({ state: { stage: { pendingChest: { id: chestId } } } });
    const event = {
      button: 0,
      clientX: 40,
      clientY: 50,
      pointerId,
      pointerType,
      timeStamp: 100,
    };
    battle.onPointerDown(event);
    battle.onPointerUp({ ...event, timeStamp: 150 });
  };

  click("mouse", 1, "chest-scout");
  click("touch", 2, "chest-guard");
  assert.deepEqual(encounterEvents, [
    { type: "open-chest", stageId: "cinder-span", chestId: "chest-scout" },
    { type: "open-chest", stageId: "cinder-span", chestId: "chest-guard" },
  ], "WebGL mouse and touch taps must publish the same reducer-ready event shape");

  const lifecycle = [];
  battle.renderedChest = null;
  battle.chestGroup = null;
  battle.createChestVisuals = (chest) => {
    lifecycle.push(["create", chest.id]);
    battle.renderedChest = chest;
    battle.chestGroup = { position: { x: 0, y: 0, z: 0 } };
  };
  battle.removeChestVisuals = () => {
    lifecycle.push(["remove", battle.renderedChest?.id ?? null]);
    battle.renderedChest = null;
    battle.chestGroup = null;
  };

  battle.reconcileChest({ id: "chest-a", itemId: "void-blade" });
  battle.reconcileChest({ id: "chest-a", itemId: "void-blade" });
  battle.reconcileChest({ id: "chest-b", itemId: "iron-resolve" });
  battle.reconcileChest(null);
  assert.deepEqual(lifecycle, [
    ["create", "chest-a"],
    ["remove", "chest-a"],
    ["create", "chest-b"],
    ["remove", "chest-b"],
  ], "reconciliation must keep one chest visual, avoid rebuilding the same ID, and remove stale IDs");

  battle.renderedChest = { id: "chest-destroy" };
  battle.activeEffects = [{ type: "ATTACK", value: 2, charges: 1 }];
  battle.destroy();
  assert.deepEqual(lifecycle.at(-1), ["remove", "chest-destroy"], "destroy must remove the final chest visual");
  assert.deepEqual(battle.activeEffects, [], "destroy must clear field-effect presentation state");
});
