const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export class DefenseViewport {
  constructor(root = document.documentElement) {
    this.root = root;
    this.update = this.update.bind(this);
    this.active = false;
  }

  start() {
    if (this.active) return this;
    this.active = true;
    window.visualViewport?.addEventListener("resize", this.update);
    window.visualViewport?.addEventListener("scroll", this.update);
    window.addEventListener("resize", this.update);
    window.addEventListener("orientationchange", this.update);
    this.update();
    return this;
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    window.visualViewport?.removeEventListener("resize", this.update);
    window.visualViewport?.removeEventListener("scroll", this.update);
    window.removeEventListener("resize", this.update);
    window.removeEventListener("orientationchange", this.update);
  }

  update() {
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const portrait = height > width;
    const logicalWidth = portrait ? height : width;
    const logicalHeight = portrait ? width : height;
    this.root.style.setProperty("--defense-physical-left", `${left}px`);
    this.root.style.setProperty("--defense-physical-top", `${top}px`);
    this.root.style.setProperty("--defense-physical-width", `${width}px`);
    this.root.style.setProperty("--defense-physical-height", `${height}px`);
    this.root.style.setProperty("--defense-logical-width", `${logicalWidth}px`);
    this.root.style.setProperty("--defense-logical-height", `${logicalHeight}px`);
    this.root.dataset.defensePortrait = String(portrait);
    window.dispatchEvent(new CustomEvent("abyssal:defense-viewportchange", {
      detail: { left, top, width, height, logicalWidth, logicalHeight, portrait },
    }));
  }

  mapPhysicalToLogical({ clientX, clientY }) {
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const px = clientX - left;
    const py = clientY - top;
    if (height <= width) return { x: clamp(px, 0, width), y: clamp(py, 0, height) };
    return { x: clamp(py, 0, height), y: clamp(width - px, 0, width) };
  }
}
