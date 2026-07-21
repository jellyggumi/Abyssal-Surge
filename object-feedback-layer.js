/**
 * ObjectFeedbackLayer - Presentation-only overlay layer for combat object feedback.
 * Renders HP bars, status badges, speech bubbles, and floating damage/heal exchanges.
 */
export class ObjectFeedbackLayer {
  constructor(canvas, options = {}) {
    if (!canvas) {
      throw new Error("ObjectFeedbackLayer requires a canvas element");
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    // Default configuration options
    const resolvedMaxVisible = options.maxVisible !== undefined ? options.maxVisible : (options.maxVisibleObjects !== undefined ? options.maxVisibleObjects : 16);
    this.options = {
      maxSpeech: options.maxSpeech || 16,
      maxExchanges: options.maxExchanges || 64,
      speechDuration: options.speechDuration || 2500,
      exchangeDuration: options.exchangeDuration || 1200,
      dedupeWindow: options.dedupeWindow || 2000,
      minSpeechInterval: options.minSpeechInterval || 1000,
      fontFamily: options.fontFamily || "monospace, sans-serif",
      reducedMotion: options.reducedMotion !== undefined ? options.reducedMotion : false,
      dprClamp: options.dprClamp || 2,
      maxVisible: resolvedMaxVisible,
      maxVisibleObjects: resolvedMaxVisible,
      ...options
    };

    // Auto-detect reduced motion preference if not explicitly overridden
    if (options.reducedMotion === undefined && typeof window !== "undefined") {
      this.options.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    // Pools (fixed-capacity arrays for zero allocation during combat)
    this.speechPool = Array.from({ length: this.options.maxSpeech }, () => ({
      active: false,
      objectId: null,
      text: "",
      startTime: 0,
      duration: 0,
      x: 0,
      y: 0
    }));

    this.exchangePool = Array.from({ length: this.options.maxExchanges }, () => ({
      active: false,
      objectId: null,
      sourceId: null,
      targetId: null,
      value: 0,
      type: "", // 'outgoing', 'incoming', 'heal'
      startTime: 0,
      duration: 0,
      x: 0,
      y: 0,
      offsetIndex: 0
    }));

    // Object map by id
    this.objects = new Map();

    // Speech history for dedupe/cooldown logic (starts at -Infinity to allow immediate now=0 triggers)
    this.speechHistory = new Map(); // objectId -> { lastText, lastTextTime, lastSpeechTime }

    // Preallocated render queue to prevent per-frame garbage collector allocations
    this.renderQueue = new Array(128);
    this.renderQueueCount = 0;

    this.destroyed = false;

    // Window resize handler registration
    this.resizeBound = this.resize.bind(this);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.resizeBound);
    }
    this.resize();
  }

  /**
   * Synchronizes object attributes silently or with full lifecycle updates.
   * @param {Array} objectsList List of current object records
   * @param {Object} options Options object containing { silent }
   */
  reconcile(objectsList, options = {}) {
    if (this.destroyed) return;

    const silent = !!options.silent;
    const currentIds = new Set();

    for (let i = 0; i < objectsList.length; i++) {
      const src = objectsList[i];
      if (!src || src.id === undefined || src.id === null) continue;
      currentIds.add(src.id);

      let obj = this.objects.get(src.id);
      if (!obj) {
        obj = {
          id: src.id,
          kind: src.kind || "generic",
          label: src.label || "",
          hp: src.hp !== undefined ? src.hp : 100,
          maxHp: src.maxHp !== undefined ? src.maxHp : 100,
          energy: src.energy !== undefined ? src.energy : null,
          maxEnergy: src.maxEnergy !== undefined ? src.maxEnergy : null,
          resourceKind: src.resourceKind,
          statuses: Array.isArray(src.statuses) ? [...src.statuses] : [],
          selected: !!src.selected,
          priority: src.priority || 0,
          visible: src.visible !== undefined ? src.visible : true,
          // Internal projection state (populated during render)
          screenX: 0,
          screenY: 0,
          depth: 0,
          projectedVisible: false,
          renderPriority: 0,
          renderedThisFrame: false
        };
        this.objects.set(src.id, obj);
      } else {
        // Hydration sync: update mutable stats
        obj.kind = src.kind || obj.kind;
        obj.label = src.label !== undefined ? src.label : obj.label;
        obj.hp = src.hp !== undefined ? src.hp : obj.hp;
        obj.energy = src.energy;
        obj.maxEnergy = src.maxEnergy;
        obj.maxHp = src.maxHp !== undefined ? src.maxHp : obj.maxHp;
        obj.resourceKind = src.resourceKind;
        
        if (Array.isArray(src.statuses)) {
          // Avoid allocation if status contents are identical
          let changed = src.statuses.length !== obj.statuses.length;
          if (!changed) {
            for (let j = 0; j < src.statuses.length; j++) {
              if (src.statuses[j] !== obj.statuses[j]) {
                changed = true;
                break;
              }
            }
          }
          if (changed) {
            obj.statuses = [...src.statuses];
          }
        }
        
        obj.selected = src.selected !== undefined ? !!src.selected : obj.selected;
        obj.priority = src.priority !== undefined ? src.priority : obj.priority;
        obj.visible = src.visible !== undefined ? src.visible : obj.visible;
      }
    }

    // Clean up objects that are no longer present (always done to prevent stale anchors)
    for (const id of this.objects.keys()) {
      if (!currentIds.has(id)) {
        this.objects.delete(id);
        this.speechHistory.delete(id);

        // Deactivate active speech bubbles for this removed object ID
        for (let i = 0; i < this.speechPool.length; i++) {
          const bubble = this.speechPool[i];
          if (bubble.active && bubble.objectId === id) {
            bubble.active = false;
          }
        }

        // Deactivate active exchanges for this removed object ID
        for (let i = 0; i < this.exchangePool.length; i++) {
          const exchange = this.exchangePool[i];
          if (exchange.active && (exchange.sourceId === id || exchange.targetId === id)) {
            exchange.active = false;
          }
        }
      }
    }
  }

  /**
   * Spawns a speech bubble for an object with dedupe and cooldown enforcement.
   */
  emitSpeech(objectId, text, options = {}) {
    if (this.destroyed) return false;

    const now = options.now !== undefined ? options.now : performance.now();
    const duration = options.duration || this.options.speechDuration;

    let history = this.speechHistory.get(objectId);
    if (!history) {
      // Cooldown initialized to -Infinity to allow immediate trigger at now=0
      history = { lastText: "", lastTextTime: -Infinity, lastSpeechTime: -Infinity };
      this.speechHistory.set(objectId, history);
    }

    const dedupeWindow = this.options.dedupeWindow;
    const minSpeechInterval = this.options.minSpeechInterval;

    if (text === history.lastText && (now - history.lastTextTime) < dedupeWindow) {
      return false; // Deduplicated
    }
    if ((now - history.lastSpeechTime) < minSpeechInterval) {
      return false; // Cooldown active
    }

    // Update history markers
    history.lastText = text;
    history.lastTextTime = now;
    history.lastSpeechTime = now;

    // Find and occupy an inactive bubble slot
    let slot = null;
    let oldestIndex = -1;
    let oldestTime = Infinity;

    for (let i = 0; i < this.speechPool.length; i++) {
      const bubble = this.speechPool[i];
      if (!bubble.active) {
        slot = bubble;
        break;
      }
      if (bubble.startTime < oldestTime) {
        oldestTime = bubble.startTime;
        oldestIndex = i;
      }
    }

    // Evict oldest bubble if pool is fully saturated
    if (!slot && oldestIndex !== -1) {
      slot = this.speechPool[oldestIndex];
    }

    if (slot) {
      const maxLen = 40;
      slot.active = true;
      slot.objectId = objectId;
      slot.text = text.length > maxLen ? text.substring(0, maxLen) + "..." : text;
      slot.startTime = now;
      slot.duration = duration;
      slot.x = 0;
      slot.y = 0;
      return true;
    }

    return false;
  }

  /**
   * Emits floating combat feedback numbers representing damage or healing values.
   */
  emitExchange(sourceId, targetId, value, type, options = {}) {
    if (this.destroyed) return false;

    const now = options.now !== undefined ? options.now : performance.now();
    const duration = options.duration || this.options.exchangeDuration;

    let slot = null;
    let oldestIndex = -1;
    let oldestTime = Infinity;

    for (let i = 0; i < this.exchangePool.length; i++) {
      const exchange = this.exchangePool[i];
      if (!exchange.active) {
        slot = exchange;
        break;
      }
      if (exchange.startTime < oldestTime) {
        oldestTime = exchange.startTime;
        oldestIndex = i;
      }
    }

    // Evict oldest exchange event if pool is fully saturated
    if (!slot && oldestIndex !== -1) {
      slot = this.exchangePool[oldestIndex];
    }

    if (slot) {
      slot.active = true;
      slot.sourceId = sourceId;
      slot.targetId = targetId;
      slot.value = Number(value) || 0;
      slot.type = type || "outgoing"; // 'outgoing', 'incoming', 'heal'
      slot.startTime = now;
      slot.duration = duration;
      slot.x = 0;
      slot.y = 0;

      // Calculate stagger offset for simultaneous numbers on the same target
      const targetIdToUse = targetId !== null && targetId !== undefined ? targetId : sourceId;
      let activeOnSameTarget = 0;
      for (let i = 0; i < this.exchangePool.length; i++) {
        const e = this.exchangePool[i];
        if (e.active && e !== slot && (e.targetId === targetIdToUse || e.sourceId === targetIdToUse)) {
          activeOnSameTarget++;
        }
      }
      slot.offsetIndex = activeOnSameTarget;

      return true;
    }

    return false;
  }

  /**
   * Projects coordinates, updates timelines, and draws the overlay frame.
   * @param {Function} projector Mapping function (object) -> {x, y, depth, visible}
   * @param {number} now Current timestamp
   */
  render(projector, now = performance.now()) {
    if (this.destroyed) return;

    // Clear backing store
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const dpr = Math.min(window.devicePixelRatio || 1, this.options.dprClamp);
    const logicalWidth = this.canvas.width / dpr;
    const logicalHeight = this.canvas.height / dpr;

    this.renderQueueCount = 0;

    // 1. Projection, edge-clamping, and priority computation
    for (const [id, obj] of this.objects.entries()) {
      obj.renderedThisFrame = false; // Reset render visibility state

      if (!obj.visible) {
        obj.projectedVisible = false;
        continue;
      }

      const projected = projector(obj);
      if (!projected || projected.visible === false) {
        obj.projectedVisible = false;
        continue;
      }

      obj.screenX = projected.x;
      obj.screenY = projected.y;
      obj.depth = projected.depth !== undefined ? projected.depth : 0;
      obj.projectedVisible = true;

      // Restrain badges inside logical viewport boundary
      const marginX = 40;
      const marginY = 30;
      obj.screenX = Math.max(marginX, Math.min(logicalWidth - marginX, obj.screenX));
      obj.screenY = Math.max(marginY, Math.min(logicalHeight - marginY, obj.screenY));

      // Hoist priority computation once per object
      obj.renderPriority = this._computePriority(obj);

      this._ensureQueueCapacity(this.renderQueueCount + 1);
      this.renderQueue[this.renderQueueCount++] = obj;
    }

    // 2. Deterministic priority and depth sorting (in-place bubble sort to avoid closures/allocations)
    this._sortRenderQueue();

    // 3. Pool garbage/timeout sweep
    for (let i = 0; i < this.speechPool.length; i++) {
      const bubble = this.speechPool[i];
      if (bubble.active && (now - bubble.startTime >= bubble.duration)) {
        bubble.active = false;
      }
    }
    for (let i = 0; i < this.exchangePool.length; i++) {
      const exchange = this.exchangePool[i];
      if (exchange.active && (now - exchange.startTime >= exchange.duration)) {
        exchange.active = false;
      }
    }

    // 4. Drawing operations
    this.ctx.save();
    this.ctx.scale(dpr, dpr);

    // Render HP / status badges for the top maxVisibleObjects
    const maxVisible = this.options.maxVisible;
    const startIdx = Math.max(0, this.renderQueueCount - maxVisible);

    for (let i = startIdx; i < this.renderQueueCount; i++) {
      const obj = this.renderQueue[i];
      obj.renderedThisFrame = true;
      this._drawBadge(obj, now);
    }

    // Draw speech bubbles (only if parent was rendered and stays inside maxVisible cap)
    for (let i = 0; i < this.speechPool.length; i++) {
      const bubble = this.speechPool[i];
      if (!bubble.active) continue;

      const obj = this.objects.get(bubble.objectId);
      if (obj && obj.projectedVisible && obj.renderedThisFrame) {
        this._drawSpeechBubble(bubble, obj, now);
      }
    }

    // Draw combat exchanges (only if target was rendered and stays inside maxVisible cap)
    for (let i = 0; i < this.exchangePool.length; i++) {
      const exchange = this.exchangePool[i];
      if (!exchange.active) continue;

      const targetId = exchange.targetId !== null && exchange.targetId !== undefined ? exchange.targetId : exchange.sourceId;
      const obj = this.objects.get(targetId);
      if (obj && obj.projectedVisible && obj.renderedThisFrame) {
        this._drawExchangeText(exchange, obj, now);
      }
    }

    this.ctx.restore();
  }

  /**
   * Resizes canvas buffer dimension to match parent container with DPR clamping.
   */
  resize() {
    if (this.destroyed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.options.dprClamp);

    let width = this.canvas.clientWidth;
    let height = this.canvas.clientHeight;

    if (width === 0 || height === 0) {
      const rect = this.canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }

    // Fallbacks if not visible in DOM yet
    if (width === 0) width = 800;
    if (height === 0) height = 450;

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
  }

  /**
   * Clears the backing store, active maps, and object references.
   */
  clear() {
    if (this.destroyed) return;

    this.objects.clear();
    this.speechHistory.clear();

    for (let i = 0; i < this.speechPool.length; i++) {
      this.speechPool[i].active = false;
    }
    for (let i = 0; i < this.exchangePool.length; i++) {
      this.exchangePool[i].active = false;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Deregisters event listeners, clears collections, and disables class operations.
   */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.resizeBound);
    }

    this.objects.clear();
    this.speechHistory.clear();
    this.speechPool = [];
    this.exchangePool = [];
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Returns a serializable, plain data snapshot of the current state.
   */
  snapshot() {
    if (this.destroyed) {
      return { destroyed: true };
    }
    return {
      objects: Array.from(this.objects.entries()).map(([id, obj]) => ({
        id: obj.id,
        kind: obj.kind,
        label: obj.label,
        hp: obj.hp,
        maxHp: obj.maxHp,
        energy: obj.energy,
        maxEnergy: obj.maxEnergy,
        resourceKind: obj.resourceKind,
        statuses: [...obj.statuses],
        selected: obj.selected,
        priority: obj.priority,
        visible: obj.visible,
        screenX: obj.screenX,
        screenY: obj.screenY,
        depth: obj.depth,
        projectedVisible: obj.projectedVisible
      })),
      speech: this.speechPool.filter(s => s.active).map(s => ({
        objectId: s.objectId,
        text: s.text,
        startTime: s.startTime,
        duration: s.duration,
        x: s.x,
        y: s.y
      })),
      exchanges: this.exchangePool.filter(e => e.active).map(e => ({
        sourceId: e.sourceId,
        targetId: e.targetId,
        value: e.value,
        type: e.type,
        startTime: e.startTime,
        duration: e.duration,
        x: e.x,
        y: e.y,
        offsetIndex: e.offsetIndex
      })),
      options: { ...this.options }
    };
  }

  /* Internal Drawing Methods */

  _drawBadge(obj, now) {
    const ctx = this.ctx;
    const hpRatio = obj.maxHp > 0 ? Math.max(0, Math.min(1, obj.hp / obj.maxHp)) : 0;
    const isAlly = obj.kind === "ally" || obj.kind === "hero" || obj.kind === "player" || obj.kind === "commander";
    const baseColor = isAlly ? "#71d8c6" : "#e06156"; // aqua vs danger
    const hasEnergy = this._hasEnergy(obj);
    const energyRatio = hasEnergy ? Math.max(0, Math.min(1, (obj.energy || 0) / obj.maxEnergy)) : 0;

    ctx.save();

    // Position compact badge above screen coordinate anchor
    const x = obj.screenX;
    const y = obj.screenY - 24;

    const badgeW = 60;
    const badgeH = 18;
    const energyExtra = hasEnergy ? 6 : 0;
    const halfW = badgeW / 2;

    ctx.strokeStyle = obj.selected ? "#f2d38b" : `${baseColor}66`;
    ctx.lineWidth = obj.selected ? 2 : 1;
    ctx.fillStyle = "rgba(6, 9, 19, 0.75)";

    // Main background card
    this._drawRoundedRect(ctx, x - halfW, y - badgeH / 2, badgeW, badgeH + energyExtra, 4);
    ctx.fill();
    ctx.stroke();

    // Compact health bar background
    const barW = 50;
    const barH = 4;
    const barX = x - barW / 2;
    const barY = y + 2;

    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(barX, barY, barW, barH);

    // HP Fill (Pulsing Red highlight under low health; static if reducedMotion is true)
    let fillStyle = baseColor;
    if (hpRatio <= 0.3) {
      if (this.options.reducedMotion) {
        fillStyle = "rgba(224, 97, 86, 0.8)";
      } else {
        const pulse = Math.sin(now / 100) * 0.5 + 0.5;
        fillStyle = `rgba(224, 97, 86, ${0.4 + pulse * 0.6})`;
      }
    }
    ctx.fillStyle = fillStyle;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    // Readiness/stamina bar: fills as the unit's next-action cooldown recovers
    if (hasEnergy) {
      const energyY = barY + barH + 3;
      const energyH = 3;
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(barX, energyY, barW, energyH);
      ctx.fillStyle = obj.resourceKind === "focus"
        ? (energyRatio >= 1 ? "#d7b5ff" : "#8d5bd1")
        : (energyRatio >= 1 ? "#8fd8ff" : "#4d84b0");
      ctx.fillRect(barX, energyY, barW * energyRatio, energyH);
    }

    // Compact title text
    ctx.font = "8px " + this.options.fontFamily;
    ctx.fillStyle = "#aeb7bd";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let labelText = obj.label || "";
    if (labelText.length > 9) {
      labelText = labelText.substring(0, 7) + "..";
    }
    ctx.fillText(labelText.toUpperCase(), x, y - 4);

    // Status chips
    if (obj.statuses && obj.statuses.length > 0) {
      const statusY = y - badgeH / 2 - 8;
      let startX = x - ((obj.statuses.length * 18) - 2) / 2;

      for (let i = 0; i < obj.statuses.length; i++) {
        const status = obj.statuses[i];
        const abbrev = this._abbreviateStatus(status);

        ctx.fillStyle = "rgba(242, 211, 139, 0.25)";
        ctx.strokeStyle = "rgba(242, 211, 139, 0.6)";
        ctx.lineWidth = 1;

        const chipW = 16;
        const chipH = 8;
        this._drawRoundedRect(ctx, startX, statusY - chipH / 2, chipW, chipH, 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 6px " + this.options.fontFamily;
        ctx.fillStyle = "#f2d38b";
        ctx.fillText(abbrev, startX + chipW / 2, statusY);

        startX += 18;
      }
    }

    ctx.restore();
  }

  _drawSpeechBubble(bubble, obj, now) {
    const ctx = this.ctx;
    const elapsed = now - bubble.startTime;
    const progress = Math.max(0, Math.min(1, elapsed / bubble.duration));

    let opacity = 1;
    let floatOffset = 0;

    if (!this.options.reducedMotion) {
      if (bubble.duration - elapsed < 500) {
        opacity = Math.max(0, (bubble.duration - elapsed) / 500);
      }
      floatOffset = progress * -8;
    }

    ctx.save();
    ctx.globalAlpha = opacity;

    ctx.font = "10px " + this.options.fontFamily;
    const textW = ctx.measureText(bubble.text).width;
    const padX = 6;
    const padY = 4;
    const boxW = textW + padX * 2;
    const boxH = 14 + padY * 2;

    const x = obj.screenX;
    const badgeHeightOffset = ((obj.statuses && obj.statuses.length > 0) ? 44 : 36) + (this._hasEnergy(obj) ? 6 : 0);
    const y = obj.screenY - badgeHeightOffset + floatOffset;

    const boxX = x - boxW / 2;
    const boxY = y - boxH - 4;

    // Dark translucent background with gold accent borders
    ctx.fillStyle = "rgba(6, 9, 19, 0.85)";
    ctx.strokeStyle = "#f2d38b";
    ctx.lineWidth = 1;

    this._drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    // Triangle bubble tail pointing to target
    ctx.beginPath();
    ctx.moveTo(x - 4, boxY + boxH);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 4, boxY + boxH);
    ctx.closePath();
    ctx.fillStyle = "rgba(6, 9, 19, 0.85)";
    ctx.fill();

    // Tail outline stroke
    ctx.beginPath();
    ctx.moveTo(x - 4, boxY + boxH);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 4, boxY + boxH);
    ctx.strokeStyle = "#f2d38b";
    ctx.stroke();

    // Mask border beneath tail
    ctx.beginPath();
    ctx.moveTo(x - 3, boxY + boxH);
    ctx.lineTo(x + 3, boxY + boxH);
    ctx.strokeStyle = "rgba(6, 9, 19, 0.85)";
    ctx.stroke();

    ctx.fillStyle = "#f2d38b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(bubble.text, x, boxY + boxH / 2);

    ctx.restore();
  }

  _drawExchangeText(exchange, obj, now) {
    const ctx = this.ctx;
    const elapsed = now - exchange.startTime;
    const progress = Math.max(0, Math.min(1, elapsed / exchange.duration));

    let opacity = 1;
    let floatOffset = 0;

    if (!this.options.reducedMotion) {
      if (exchange.duration - elapsed < 300) {
        opacity = Math.max(0, (exchange.duration - elapsed) / 300);
      }
      floatOffset = progress * -24;
    }

    ctx.save();
    ctx.globalAlpha = opacity;

    const staggerY = -14 * exchange.offsetIndex;
    const x = obj.screenX;
    const y = obj.screenY - 10 + floatOffset + staggerY;

    let color = "#ffffff";
    let text = "";
    const magnitude = Math.abs(Number(exchange.value) || 0);
    const isCrit = magnitude >= (this.options.critThreshold ?? 20) && exchange.type !== "heal";

    // Differentiate types and signs
    if (exchange.type === "outgoing") {
      color = "#e06156"; // Outgoing damage: Danger Red
      text = `-${exchange.value}`;
    } else if (exchange.type === "incoming") {
      color = "#b388ff"; // Incoming damage: Purple / Violet
      text = `-${exchange.value}`;
    } else if (exchange.type === "heal") {
      color = "#71d8c6"; // Health restoration: Aqua / Green-Blue
      text = `+${exchange.value}`;
    } else {
      text = String(exchange.value);
    }
    if (isCrit) text += "!";

    ctx.font = (isCrit ? "bold 16px " : "bold 12px ") + this.options.fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Legibility shadow outline (thicker for a heavier hit)
    ctx.strokeStyle = "rgba(6, 9, 19, 0.9)";
    ctx.lineWidth = isCrit ? 4 : 3;
    ctx.strokeText(text, x, y);

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  _hasEnergy(obj) {
    return typeof obj.maxEnergy === "number" && obj.maxEnergy > 0;
  }

  _abbreviateStatus(status) {
    if (!status) return "";
    const clean = status.trim().toUpperCase();
    const map = {
      BURNING: "BRN",
      FROZEN: "FRZ",
      STUNNED: "STN",
      POISONED: "PSN",
      SHIELDED: "SHD",
      HASTE: "HST",
      SLOW: "SLW",
      WEAK: "WEK",
      BLEED: "BLD"
    };
    return map[clean] || (clean.length > 3 ? clean.substring(0, 3) : clean);
  }

  _drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* Internal Low-Allocation Sorting/Capacity Helpers */

  _ensureQueueCapacity(needed) {
    if (needed > this.renderQueue.length) {
      const newLen = Math.max(needed, this.renderQueue.length * 2);
      const newQueue = new Array(newLen);
      for (let i = 0; i < this.renderQueueCount; i++) {
        newQueue[i] = this.renderQueue[i];
      }
      this.renderQueue = newQueue;
    }
  }

  _computePriority(o) {
    let p = (o.priority || 0) * 10;
    if (o.selected) p += 1000;
    if (o.kind === "boss" || o.kind === "commander") p += 500;
    const hpRatio = o.maxHp > 0 ? o.hp / o.maxHp : 1;
    if (hpRatio <= 0.3) p += 300;
    return p;
  }

  _compareObjects(a, b) {
    if (a.renderPriority !== b.renderPriority) {
      return a.renderPriority - b.renderPriority;
    }
    return b.depth - a.depth; // Larger depth drawn first
  }

  _sortRenderQueue() {
    const count = this.renderQueueCount;
    const queue = this.renderQueue;
    for (let i = 1; i < count; i++) {
      const key = queue[i];
      let j = i - 1;
      while (j >= 0 && this._compareObjects(queue[j], key) > 0) {
        queue[j + 1] = queue[j];
        j--;
      }
      queue[j + 1] = key;
    }
  }
}

export default ObjectFeedbackLayer;
