import {
  RULES_VERSION,
  STAGES,
  applyAction,
  chooseReward,
  createCampaign,
  createSaveEnvelope,
  getAvailableActions,
  getStageChecklist,
  restoreSaveEnvelope,
  retryStage,
  startCampaign
} from "./campaign-state.js";

const BUILD_TAG = "abyssal-surge-static-v1";
const DB_NAME = "abyssal-surge-campaign";
const DB_VERSION = 1;
const STORE_NAME = "campaigns";
const PRIMARY_KEY = "primary";
const FALLBACK_KEY = "abyssal-surge-campaign-fallback-v1";
const MAX_IMPORT_BYTES = 256 * 1024;
const ACTION_KEYS = Object.freeze({ h: "hunt", e: "extract", m: "materialize", c: "capture", p: "possess", d: "domain", a: "assault" });
const CUE_BY_EFFECT = Object.freeze({
  extract: "assets/audio/extract.mp3",
  domain: "assets/audio/domain.mp3"
});
const VIDEO_BY_STAGE = Object.freeze({
  "cinder-span": "assets/video/cinder-span.mp4",
  "veil-citadel": "assets/video/veil-citadel.mp4",
  "echo-throne": "assets/video/echo-throne.mp4"
});
const IMAGE_BY_STAGE = Object.freeze({
  "cinder-span": "assets/images/cinder-span.png",
  "veil-citadel": "assets/images/veil-citadel.png",
  "echo-throne": "assets/images/echo-throne.png"
});

class CampaignStorage {
  constructor() {
    this.db = null;
    this.mode = "memory";
    this.memory = null;
  }

  async open() {
    if (!("indexedDB" in window)) {
      this.mode = "fallback";
      return this.mode;
    }
    try {
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("IndexedDB is blocked by another tab."));
      });
      this.mode = "indexeddb";
    } catch {
      this.db = null;
      this.mode = "fallback";
    }
    return this.mode;
  }

  readFallback() {
    if (this.memory) return this.memory;
    try {
      const raw = window.localStorage.getItem(FALLBACK_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  writeFallback(envelope) {
    this.memory = envelope;
    try {
      window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(envelope));
      return "localStorage";
    } catch {
      return "memory";
    }
  }

  async load() {
    if (this.db) {
      try {
        const record = await new Promise((resolve, reject) => {
          const request = this.db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(PRIMARY_KEY);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (record?.envelope) return { envelope: record.envelope, source: "IndexedDB" };
      } catch {
        this.mode = "fallback";
      }
    }
    const envelope = this.readFallback();
    return { envelope, source: envelope ? "local fallback" : null };
  }

  async save(envelope) {
    if (this.db) {
      try {
        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction(STORE_NAME, "readwrite");
          transaction.objectStore(STORE_NAME).put({ id: PRIMARY_KEY, envelope });
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });
        this.mode = "indexeddb";
        return "IndexedDB";
      } catch {
        this.mode = "fallback";
      }
    }
    return this.writeFallback(envelope);
  }
}

const elements = Object.freeze({
  lobby: document.querySelector("#campaign-lobby"),
  screen: document.querySelector("#campaign-screen"),
  start: document.querySelector("#start-campaign"),
  resume: document.querySelector("#resume-campaign"),
  restart: document.querySelector("#restart-campaign"),
  retry: document.querySelector("#retry-stage"),
  stageNumber: document.querySelector("#stage-number"),
  stageHeading: document.querySelector("#stage-heading"),
  stageRegion: document.querySelector("#stage-region"),
  stageObjective: document.querySelector("#stage-objective"),
  status: document.querySelector("#campaign-status"),
  souls: document.querySelector("#souls-value"),
  legion: document.querySelector("#legion-value"),
  nodes: document.querySelector("#nodes-value"),
  integrity: document.querySelector("#integrity-value"),
  bossLabel: document.querySelector("#boss-label"),
  boss: document.querySelector("#boss-value"),
  checklist: document.querySelector("#objective-checklist"),
  rewardPanel: document.querySelector("#reward-panel"),
  rewardOptions: document.querySelector("#reward-options"),
  complete: document.querySelector("#campaign-complete"),
  completionSummary: document.querySelector("#completion-summary"),
  saveStatus: document.querySelector("#save-status"),
  exportSave: document.querySelector("#export-save"),
  importSave: document.querySelector("#import-save"),
  effect: document.querySelector("#visual-effect"),
  ambience: document.querySelector("#toggle-stage-ambience"),
  transition: document.querySelector("#stage-transition"),
  video: document.querySelector("#stage-transition-video"),
  cinematic: document.querySelector("#campaign-cinematic"),
  cinematicButton: document.querySelector("#play-cinematic"),
  cinematicStatus: document.querySelector("#cinematic-status"),
  commandButtons: [...document.querySelectorAll("[data-action]")],
  stageButtons: [1, 2, 3].map((number) => document.querySelector(`#stage-select-${number}`))
});

let campaign = null;
let storedCampaign = null;
let storage = new CampaignStorage();
let cuePlayer = null;
let ambiencePlayer = null;

function currentStage() {
  return STAGES[campaign.stageIndex];
}

function setSaveStatus(message) {
  elements.saveStatus.textContent = message;
}

function renderChecklist() {
  elements.checklist.replaceChildren();
  for (const item of getStageChecklist(campaign)) {
    const row = document.createElement("li");
    row.className = item.complete ? "complete" : "pending";
    row.textContent = item.label;
    row.setAttribute("aria-label", `${item.label}: ${item.complete ? "complete" : "pending"}`);
    elements.checklist.append(row);
  }
}

function renderRewards(stage) {
  elements.rewardOptions.replaceChildren();
  for (const reward of stage.rewards) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reward-option";
    button.dataset.rewardId = reward.id;
    const name = document.createElement("strong");
    name.textContent = reward.name;
    const description = document.createElement("span");
    description.textContent = reward.description;
    button.append(name, description);
    button.addEventListener("click", () => handleReward(reward.id));
    elements.rewardOptions.append(button);
  }
}

function renderStageMedia(stage) {
  const videoSource = VIDEO_BY_STAGE[stage.id];
  const imageSource = IMAGE_BY_STAGE[stage.id];
  if (elements.video.dataset.stage === stage.id) return;

  elements.video.dataset.stage = stage.id;
  elements.transition.style.removeProperty("background-image");
  if (imageSource) {
    const image = new Image();
    image.onload = () => {
      if (elements.video.dataset.stage === stage.id) {
        elements.transition.style.backgroundImage = `linear-gradient(115deg, rgb(14 18 36 / 92%), rgb(17 27 44 / 72%)), url("${imageSource}")`;
      }
    };
    image.onerror = () => elements.transition.style.removeProperty("background-image");
    image.src = imageSource;
  }

  elements.video.hidden = true;
  elements.video.removeAttribute("src");
  elements.video.load();
  if (!videoSource || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  elements.video.src = videoSource;
  elements.video.onloadeddata = () => {
    elements.video.hidden = false;
    elements.video.play().catch(() => undefined);
  };
  elements.video.onerror = () => {
    elements.video.hidden = true;
    elements.video.removeAttribute("src");
  };
  elements.video.load();
}

function render() {
  if (!campaign) return;
  const stage = currentStage();
  const state = campaign.stage;
  const available = new Set(getAvailableActions(campaign));
  const isComplete = campaign.status === "campaign-complete";

  elements.stageNumber.textContent = `Stage ${stage.number} of ${STAGES.length}`;
  elements.stageHeading.textContent = stage.title;
  elements.stageRegion.textContent = stage.region;
  elements.stageObjective.textContent = stage.objective;
  elements.status.textContent = campaign.lastMessage;
  elements.souls.textContent = String(state.souls);
  elements.legion.textContent = `${state.legion} / ${state.capacity}`;
  elements.nodes.textContent = `${state.nodes} / ${stage.nodeGoal}`;
  elements.integrity.textContent = `${state.integrity} / 10`;
  elements.bossLabel.textContent = `${stage.bossName} ward`;
  elements.boss.textContent = `${state.bossHealth} / ${stage.bossHealth}`;
  elements.retry.disabled = campaign.status === "reward" || isComplete;
  elements.rewardPanel.hidden = campaign.status !== "reward";
  elements.complete.hidden = !isComplete;
  elements.completionSummary.textContent = isComplete ? campaign.lastMessage : "";

  for (const button of elements.commandButtons) {
    const action = button.dataset.action;
    button.disabled = !available.has(action);
    button.setAttribute("aria-disabled", String(!available.has(action)));
  }
  for (const [index, button] of elements.stageButtons.entries()) {
    const stageNumber = index + 1;
    const active = stageNumber === stage.number;
    const cleared = stageNumber < stage.number || isComplete;
    button.disabled = true;
    button.classList.toggle("active", active);
    button.classList.toggle("cleared", cleared);
    button.classList.toggle("locked", !active && !cleared);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
    button.setAttribute("aria-label", `${STAGES[index].title}: ${active ? "current stage" : cleared ? "cleared" : "locked"}`);
  }

  renderChecklist();
  if (campaign.status === "reward") renderRewards(stage);
  renderStageMedia(stage);
}

function revealCampaign() {
  elements.lobby.hidden = true;
  elements.screen.hidden = false;
  render();
  window.requestAnimationFrame(() => elements.stageHeading.focus());
}

function playCue(effect) {
  const source = CUE_BY_EFFECT[effect];
  if (!source) return;
  if (!cuePlayer) {
    cuePlayer = new Audio();
    cuePlayer.preload = "none";
    cuePlayer.addEventListener("error", () => undefined);
  }
  cuePlayer.pause();
  cuePlayer.currentTime = 0;
  cuePlayer.src = source;
  cuePlayer.play().catch(() => undefined);
}

function flashEffect(effect) {
  const isCritical = ["materialize", "domain", "assault"].includes(effect);
  if (isCritical) {
    elements.effect.className = "visual-effect effect-inversion is-active";
    setTimeout(() => {
      elements.effect.className = "visual-effect";
      void elements.effect.offsetWidth;
      elements.effect.classList.add("is-active", `effect-${effect}`);
      elements.effect.addEventListener("animationend", () => {
        elements.effect.className = "visual-effect";
      }, { once: true });
    }, 150);
  } else {
    elements.effect.className = "visual-effect";
    void elements.effect.offsetWidth;
    elements.effect.classList.add("is-active", `effect-${effect}`);
    elements.effect.addEventListener("animationend", () => {
      elements.effect.className = "visual-effect";
    }, { once: true });
  }
}

async function persistCampaign(context = "Campaign saved") {
  if (!campaign) return;
  const savedTo = await storage.save(createSaveEnvelope(campaign));
  setSaveStatus(`${context} in ${savedTo}.`);
}

async function handleAction(action) {
  if (!campaign) return;
  const result = applyAction(campaign, action);
  campaign = result.state;
  render();
  if (result.accepted) {
    flashEffect(result.effect);
    playCue(result.effect);
    await persistCampaign("Campaign saved");
    if (campaign.status === "reward") elements.rewardOptions.querySelector("button")?.focus();
  }
}

async function handleReward(rewardId) {
  if (!campaign) return;
  const result = chooseReward(campaign, rewardId);
  campaign = result.state;
  render();
  if (result.accepted) {
    flashEffect("reward");
    playCue("reward");
    await persistCampaign("Reward and campaign saved");
    if (campaign.status === "campaign-complete") document.querySelector("#completion-heading")?.focus();
  }
}

async function beginNewCampaign() {
  if (campaign && campaign.trace.length > 0 && !window.confirm("Start a new campaign? Your current local run will be replaced.")) return;
  const result = startCampaign(createCampaign());
  campaign = result.state;
  storedCampaign = null;
  revealCampaign();
  flashEffect("awaken");
  await persistCampaign("New campaign saved");
}

async function handleRetry() {
  if (!campaign) return;
  const result = retryStage(campaign);
  campaign = result.state;
  render();
  if (result.accepted) {
    flashEffect("retry");
    await persistCampaign("Stage retry saved");
  }
}

function exportSave() {
  if (!campaign) return;
  const blob = new Blob([JSON.stringify(createSaveEnvelope(campaign), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "abyssal-surge-campaign-save.json";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setSaveStatus("Versioned campaign save exported.");
}

async function importSave(file) {
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    setSaveStatus("Import rejected: save exceeds the 256 KiB limit.");
    elements.importSave.value = "";
    return;
  }
  try {
    const envelope = JSON.parse(await file.text());
    campaign = restoreSaveEnvelope(envelope);
    storedCampaign = campaign;
    revealCampaign();
    await persistCampaign("Imported campaign saved");
    flashEffect("reward");
  } catch (error) {
    setSaveStatus(`Import rejected: ${error instanceof Error ? error.message : "invalid save file"}`);
  } finally {
    elements.importSave.value = "";
  }
}

function toggleAmbience() {
  if (!ambiencePlayer) {
    ambiencePlayer = new Audio("assets/audio/ambient.mp3");
    ambiencePlayer.loop = true;
    ambiencePlayer.preload = "none";
    ambiencePlayer.addEventListener("error", () => {
      ambiencePlayer.pause();
      elements.ambience.textContent = "Ambient sound unavailable";
      elements.ambience.setAttribute("aria-pressed", "false");
    });
  }
  if (ambiencePlayer.paused) {
    ambiencePlayer.play().then(() => {
      elements.ambience.textContent = "Pause ambient sound";
      elements.ambience.setAttribute("aria-pressed", "true");
    }).catch(() => {
      elements.ambience.textContent = "Ambient sound unavailable";
    });
  } else {
    ambiencePlayer.pause();
    elements.ambience.textContent = "Play ambient sound";
    elements.ambience.setAttribute("aria-pressed", "false");
  }
}

function playCinematic() {
  const video = elements.cinematic;
  video.hidden = false;
  video.muted = true;
  elements.cinematicButton.disabled = true;
  elements.cinematicStatus.textContent = "Loading optional cinematic…";
  video.onloadeddata = () => {
    elements.cinematicButton.disabled = false;
    elements.cinematicStatus.textContent = "Cinematic playing muted. Use native controls to enable sound.";
    video.play().catch(() => {
      elements.cinematicStatus.textContent = "Cinematic is ready. Press play in its native controls.";
    });
  };
  video.onerror = () => {
    video.pause();
    video.hidden = true;
    video.removeAttribute("src");
    video.load();
    elements.cinematicButton.disabled = false;
    elements.cinematicStatus.textContent = "Cinematic unavailable. Text campaign briefing remains complete.";
  };
  video.src = "assets/video/shadow-lord-cinematic.mp4";
  video.load();
}

function wireControls() {
  elements.start.addEventListener("click", beginNewCampaign);
  elements.restart.addEventListener("click", beginNewCampaign);
  elements.resume.addEventListener("click", () => {
    campaign = storedCampaign;
    revealCampaign();
    document.querySelector("#stage-heading")?.focus();
  });
  elements.retry.addEventListener("click", handleRetry);
  elements.commandButtons.forEach((button) => button.addEventListener("click", () => handleAction(button.dataset.action)));
  elements.exportSave.addEventListener("click", exportSave);
  elements.importSave.addEventListener("change", () => importSave(elements.importSave.files?.[0]));
  elements.ambience.addEventListener("click", toggleAmbience);
  elements.cinematicButton.addEventListener("click", playCinematic);
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
    const action = ACTION_KEYS[event.key.toLowerCase()];
    if (action && campaign && getAvailableActions(campaign).includes(action)) {
      event.preventDefault();
      handleAction(action);
    }
  });
}

function initReactBitsEffects() {
  // 1. Interactive Particles Background (Fluid Shadow Smoke Particles)
  const canvas = document.querySelector("#particles-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let particles = [];
    const maxParticles = 50;
    let mouse = { x: -1000, y: -1000 };

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener("mouseleave", () => {
      mouse.x = -1000;
      mouse.y = -1000;
    });

    // Spawn extra particles on click
    window.addEventListener("click", (e) => {
      for (let i = 0; i < 8; i++) {
        particles.push(new Particle(e.clientX, e.clientY, true));
      }
      if (particles.length > maxParticles + 20) {
        particles.splice(0, particles.length - (maxParticles + 20));
      }
    });

    class Particle {
      constructor(x, y, isSpawned = false) {
        this.isSpawned = isSpawned;
        if (isSpawned) {
          this.x = x + (Math.random() - 0.5) * 20;
          this.y = y + (Math.random() - 0.5) * 20;
          this.size = Math.random() * 4 + 2;
          this.speedY = (Math.random() - 0.5) * 1.5;
          this.speedX = (Math.random() - 0.5) * 1.5;
          this.alpha = 0.8;
        } else {
          this.reset();
          this.y = Math.random() * canvas.height;
        }
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + 20;
        this.size = Math.random() * 3 + 1;
        this.speedY = -(Math.random() * 0.8 + 0.2);
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.alpha = Math.random() * 0.5 + 0.1;
        this.color = Math.random() > 0.5 ? "112, 229, 208" : "171, 104, 255"; // aqua or purple
      }
      update() {
        // Interaction with mouse
        if (mouse.x !== -1000) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120) {
            // Repel slightly
            const force = (120 - dist) / 120;
            this.x -= (dx / dist) * force * 1.5;
            this.y -= (dy / dist) * force * 1.5;
          }
        }

        this.y += this.speedY;
        this.x += this.speedX;

        if (this.isSpawned) {
          this.alpha -= 0.015;
          if (this.alpha <= 0) {
            const idx = particles.indexOf(this);
            if (idx > -1) particles.splice(idx, 1);
          }
        } else {
          if (this.y < -20 || this.x < -20 || this.x > canvas.width + 20) {
            this.reset();
          }
        }
      }
      draw() {
        ctx.fillStyle = `rgba(${this.color || "112, 229, 208"}, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p) {
          p.update();
          p.draw();
        }
      }
      requestAnimationFrame(animate);
    }
    animate();
  }

  // 2. Spotlight & Tilt Effects (only on devices with hover capability)
  if (window.matchMedia("(hover: hover)").matches) {
    const panels = document.querySelectorAll(".panel, .map-node, .storyboard-card");
    panels.forEach((panel) => {
      panel.addEventListener("mousemove", (e) => {
        const rect = panel.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        panel.style.setProperty("--mouse-x", `${x}px`);
        panel.style.setProperty("--mouse-y", `${y}px`);

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -6; // max 6 degrees tilt
        const rotateY = ((x - centerX) / centerX) * 6;
        panel.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });

      panel.addEventListener("mouseleave", () => {
        panel.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
      });
    });

    // 3. Magnetic Buttons Effect
    const buttons = document.querySelectorAll("button, .file-button");
    buttons.forEach((btn) => {
      btn.classList.add("magnetic-button");
      window.addEventListener("mousemove", (e) => {
        const rect = btn.getBoundingClientRect();
        const btnX = rect.left + rect.width / 2;
        const btnY = rect.top + rect.height / 2;
        const dx = e.clientX - btnX;
        const dy = e.clientY - btnY;
        const dist = Math.hypot(dx, dy);

        if (dist < 70) {
          // Pull button towards cursor
          const pullX = dx * 0.25;
          const pullY = dy * 0.25;
          btn.style.transform = `translate(${pullX}px, ${pullY}px)`;
        } else {
          btn.style.transform = "";
        }
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
      });
    });
  }
}

≔493ep..495ac
  wireControls();
  initReactBitsEffects();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
}

async function initialize() {
  document.documentElement.dataset.rulesVersion = RULES_VERSION;
  document.documentElement.dataset.buildTag = BUILD_TAG;
  await storage.open();
  const loaded = await storage.load();
  if (loaded.envelope) {
    try {
      storedCampaign = restoreSaveEnvelope(loaded.envelope);
      elements.resume.hidden = false;
      setSaveStatus(`A compatible campaign is available from ${loaded.source}.`);
    } catch {
      setSaveStatus("A local save was found but is incompatible. Start a new campaign or import a valid save.");
    }
  } else {
    setSaveStatus(storage.mode === "indexeddb" ? "No local campaign yet. IndexedDB is ready." : "IndexedDB is unavailable; this session will use the safe local fallback.");
  }
  wireControls();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => undefined);
}

initialize();
