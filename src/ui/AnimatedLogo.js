const LOGO_MODES = Object.freeze({
  MAIN_MENU: "mainMenu",
  LOADING: "loading",
});

const MODE_DEFAULTS = Object.freeze({
  [LOGO_MODES.MAIN_MENU]: Object.freeze({
    loopDuration: 7.2,
    shimmerSpeed: 7.2,
    shimmerWidth: 16,
    glowIntensity: 0.22,
    glowPulseSpeed: 7.2,
    particleAmount: 6,
    scalePulseStrength: 0.01,
    glintInterval: 8.4,
    completionDuration: 0.86,
  }),
  [LOGO_MODES.LOADING]: Object.freeze({
    loopDuration: 6.4,
    shimmerSpeed: 4.8,
    shimmerWidth: 19,
    glowIntensity: 0.28,
    glowPulseSpeed: 5.6,
    particleAmount: 9,
    scalePulseStrength: 0.012,
    glintInterval: 6.4,
    completionDuration: 0.86,
  }),
});

const PARTICLE_ORIGINS = Object.freeze([
  Object.freeze({ x: 24, y: 52, dx: -12, dy: -16, delay: -1.1, size: 1.5 }),
  Object.freeze({ x: 34, y: 29, dx: -8, dy: -13, delay: -3.8, size: 1.1 }),
  Object.freeze({ x: 48, y: 20, dx: 5, dy: -15, delay: -5.4, size: 1.35 }),
  Object.freeze({ x: 66, y: 25, dx: 11, dy: -12, delay: -2.6, size: 1.15 }),
  Object.freeze({ x: 78, y: 45, dx: 14, dy: -5, delay: -4.5, size: 1.45 }),
  Object.freeze({ x: 73, y: 65, dx: 13, dy: 9, delay: -0.7, size: 1.05 }),
  Object.freeze({ x: 59, y: 77, dx: 8, dy: 15, delay: -5.9, size: 1.4 }),
  Object.freeze({ x: 43, y: 75, dx: -4, dy: 15, delay: -2.1, size: 1.05 }),
  Object.freeze({ x: 28, y: 65, dx: -13, dy: 8, delay: -4.9, size: 1.25 }),
  Object.freeze({ x: 52, y: 47, dx: 5, dy: -10, delay: -3.2, size: 0.95 }),
  Object.freeze({ x: 62, y: 52, dx: 10, dy: 2, delay: -1.8, size: 1.1 }),
  Object.freeze({ x: 49, y: 61, dx: -5, dy: 11, delay: -6.2, size: 0.9 }),
]);

const GLINT_POINTS = Object.freeze([
  Object.freeze({ x: 50, y: 13 }),
  Object.freeze({ x: 50, y: 22 }),
  Object.freeze({ x: 57, y: 18 }),
  Object.freeze({ x: 62, y: 66 }),
  Object.freeze({ x: 55, y: 83 }),
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value, fallback, minimum, maximum) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, minimum, maximum) : fallback;
}

export function animatedLogoConfig(mode = LOGO_MODES.MAIN_MENU, overrides = {}) {
  const safeMode = Object.values(LOGO_MODES).includes(mode) ? mode : LOGO_MODES.MAIN_MENU;
  const defaults = MODE_DEFAULTS[safeMode];
  return Object.freeze({
    mode: safeMode,
    loopDuration: finiteNumber(overrides.loopDuration, defaults.loopDuration, 4, 16),
    shimmerSpeed: finiteNumber(overrides.shimmerSpeed, defaults.shimmerSpeed, 2.5, 20),
    shimmerWidth: finiteNumber(overrides.shimmerWidth, defaults.shimmerWidth, 8, 32),
    glowIntensity: finiteNumber(overrides.glowIntensity, defaults.glowIntensity, 0, 0.55),
    glowPulseSpeed: finiteNumber(overrides.glowPulseSpeed, defaults.glowPulseSpeed, 3, 20),
    particleAmount: Math.round(finiteNumber(overrides.particleAmount, defaults.particleAmount, 0, PARTICLE_ORIGINS.length)),
    scalePulseStrength: finiteNumber(overrides.scalePulseStrength, defaults.scalePulseStrength, 0, 0.015),
    glintInterval: finiteNumber(overrides.glintInterval, defaults.glintInterval, 6, 12),
    completionDuration: finiteNumber(overrides.completionDuration, defaults.completionDuration, 0.45, 1.4),
    reducedMotion: overrides.reducedMotion === true,
    particlesEnabled: overrides.particlesEnabled !== false,
    bloomEnabled: overrides.bloomEnabled !== false,
  });
}

function element(document, tagName, className) {
  const node = document.createElement(tagName);
  node.className = className;
  return node;
}

export class AnimatedLogo {
  static MODES = LOGO_MODES;

  constructor(host, { imageUrl, onComplete = null, ...options } = {}) {
    if (!host?.ownerDocument || typeof host.append !== "function") {
      throw new TypeError("AnimatedLogo requires a DOM host element.");
    }
    if (typeof imageUrl !== "string" || imageUrl.length === 0) {
      throw new TypeError("AnimatedLogo requires an image URL.");
    }

    this.host = host;
    this.document = host.ownerDocument;
    this.imageUrl = imageUrl;
    this.onComplete = typeof onComplete === "function" ? onComplete : null;
    this.config = animatedLogoConfig(options.mode, options);
    this.loadingProgress = null;
    this.completionPlayed = false;
    this.completionPromise = null;
    this.completionTimer = null;
    this.completionCancel = null;

    this.element = element(this.document, "div", "animated-logo");
    this.element.dataset.mode = this.config.mode;
    this.element.setAttribute("aria-hidden", "true");
    this.element.style.setProperty("--animated-logo-mask", `url("${imageUrl}")`);

    this.surface = element(this.document, "div", "animated-logo__surface");
    this.base = element(this.document, "img", "animated-logo__base");
    this.base.src = imageUrl;
    this.base.alt = "";
    this.base.draggable = false;

    this.glow = element(this.document, "span", "animated-logo__effect animated-logo__glow");
    this.shimmer = element(this.document, "span", "animated-logo__effect animated-logo__shimmer");
    this.trace = element(this.document, "span", "animated-logo__effect animated-logo__trace");
    this.verticalTrace = element(this.document, "span", "animated-logo__effect animated-logo__vertical-trace");
    this.completion = element(this.document, "span", "animated-logo__effect animated-logo__completion");
    this.glints = element(this.document, "span", "animated-logo__effect animated-logo__glints");
    this.particles = element(this.document, "span", "animated-logo__particles");
    this.glintNodes = [];

    GLINT_POINTS.forEach((point, index) => {
      const glint = element(this.document, "i", "animated-logo__glint");
      glint.style.setProperty("--glint-x", `${point.x}%`);
      glint.style.setProperty("--glint-y", `${point.y}%`);
      glint.dataset.glint = String(index);
      this.glintNodes.push(glint);
      this.glints.append(glint);
    });

    this.surface.append(
      this.base,
      this.glow,
      this.shimmer,
      this.trace,
      this.verticalTrace,
      this.completion,
      this.glints,
      this.particles,
    );
    this.element.append(this.surface);
    this.host.replaceChildren(this.element);
    this.applyConfig(this.config);
  }

  applyConfig(config) {
    this.config = config;
    this.element.dataset.mode = config.mode;
    this.element.dataset.reducedMotion = String(config.reducedMotion);
    this.element.dataset.particles = String(config.particlesEnabled && config.particleAmount > 0);
    this.element.dataset.bloom = String(config.bloomEnabled);
    this.element.style.setProperty("--logo-loop-duration", `${config.loopDuration}s`);
    this.element.style.setProperty("--logo-shimmer-duration", `${config.shimmerSpeed}s`);
    this.element.style.setProperty("--logo-shimmer-width", `${config.shimmerWidth}%`);
    this.element.style.setProperty("--logo-glow-opacity", String(config.glowIntensity));
    this.element.style.setProperty("--logo-glow-duration", `${config.glowPulseSpeed}s`);
    this.element.style.setProperty("--logo-scale-pulse", String(config.scalePulseStrength));
    this.element.style.setProperty("--logo-glint-interval", `${config.glintInterval}s`);
    this.element.style.setProperty("--logo-completion-duration", `${config.completionDuration}s`);
    const glintCycle = config.glintInterval * this.glintNodes.length;
    this.glintNodes.forEach((glint, index) => {
      glint.style.setProperty("--glint-cycle", `${glintCycle}s`);
      glint.style.setProperty("--glint-delay", `${config.glintInterval * index}s`);
    });
    this.renderParticles(config.particleAmount);
  }

  configure(options = {}) {
    this.applyConfig(animatedLogoConfig(options.mode ?? this.config.mode, { ...this.config, ...options }));
  }

  setMode(mode, overrides = {}) {
    this.applyConfig(animatedLogoConfig(mode, {
      reducedMotion: this.config.reducedMotion,
      particlesEnabled: this.config.particlesEnabled,
      bloomEnabled: this.config.bloomEnabled,
      ...overrides,
    }));
    this.resetCompletion();
  }

  setProgress(progress = null) {
    const numeric = Number(progress);
    if (progress === null || progress === undefined || !Number.isFinite(numeric)) {
      this.loadingProgress = null;
      this.element.dataset.progress = "indeterminate";
      this.element.style.setProperty("--logo-progress-turn", "0turn");
      return;
    }
    this.loadingProgress = clamp(numeric, 0, 1);
    this.element.dataset.progress = "determinate";
    this.element.style.setProperty("--logo-progress-turn", `${this.loadingProgress}turn`);
  }

  setReducedMotion(enabled) {
    this.configure({ reducedMotion: enabled === true });
  }

  setParticlesEnabled(enabled) {
    this.configure({ particlesEnabled: enabled === true });
  }

  setParticleAmount(amount) {
    this.configure({ particleAmount: amount });
  }

  setBloomEnabled(enabled) {
    this.configure({ bloomEnabled: enabled === true });
  }

  renderParticles(amount) {
    const count = clamp(Math.round(Number(amount) || 0), 0, PARTICLE_ORIGINS.length);
    this.particles.replaceChildren();
    for (let index = 0; index < count; index += 1) {
      const origin = PARTICLE_ORIGINS[index];
      const particle = element(this.document, "i", "animated-logo__particle");
      particle.style.setProperty("--particle-x", `${origin.x}%`);
      particle.style.setProperty("--particle-y", `${origin.y}%`);
      particle.style.setProperty("--particle-dx", `${origin.dx}px`);
      particle.style.setProperty("--particle-dy", `${origin.dy}px`);
      particle.style.setProperty("--particle-delay", `${origin.delay}s`);
      particle.style.setProperty("--particle-size", `${origin.size}px`);
      this.particles.append(particle);
    }
  }

  resetCompletion() {
    this.completionCancel?.();
    this.completionCancel = null;
    if (this.completionTimer !== null) clearTimeout(this.completionTimer);
    this.completionTimer = null;
    this.completionPlayed = false;
    this.completionPromise = null;
    this.element.classList.remove("is-completing");
  }

  playCompletion() {
    if (this.completionPromise) return this.completionPromise;
    this.completionPlayed = true;
    this.completionPromise = new Promise((resolve) => {
      let resolved = false;
      let onAnimationEnd = null;
      const finish = (emit = true) => {
        if (resolved) return;
        resolved = true;
        if (onAnimationEnd) this.completion.removeEventListener("animationend", onAnimationEnd);
        if (this.completionTimer !== null) clearTimeout(this.completionTimer);
        this.completionTimer = null;
        this.completionCancel = null;
        this.element.classList.remove("is-completing");
        const detail = Object.freeze({ mode: this.config.mode, progress: this.loadingProgress });
        if (emit) {
          const EventConstructor = this.document.defaultView?.CustomEvent ?? globalThis.CustomEvent;
          if (EventConstructor) {
            this.element.dispatchEvent(new EventConstructor("animated-logo-complete", { detail }));
          }
          this.onComplete?.(detail);
        }
        resolve(detail);
      };
      this.completionCancel = () => finish(false);

      if (this.config.reducedMotion) {
        queueMicrotask(finish);
        return;
      }

      onAnimationEnd = (event) => {
        if (event.animationName === "animated-logo-complete-sweep") finish();
      };
      this.completion.addEventListener("animationend", onAnimationEnd, { once: true });
      this.element.classList.add("is-completing");
      this.completionTimer = setTimeout(finish, this.config.completionDuration * 1000 + 140);
    });
    return this.completionPromise;
  }

  destroy() {
    this.completionCancel?.();
    this.completionCancel = null;
    if (this.completionTimer !== null) clearTimeout(this.completionTimer);
    this.completionTimer = null;
    this.element.remove();
  }
}
