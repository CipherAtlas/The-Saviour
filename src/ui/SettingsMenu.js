const TABS = Object.freeze({
  graphics: [
    ["graphics.resolutionScale", "Resolution scale", "Internal render resolution.", "range", 0.5, 1.25, 0.05],
    ["graphics.shadows", "Shadows", "Quality of real-time shadows.", "select", ["off", "low", "medium", "high"]],
    ["graphics.effectsDensity", "Effects density", "Number of combat particles.", "range", 0.25, 1, 0.05],
    ["graphics.antialias", "Antialiasing", "Applied after the next reload.", "toggle"],
    ["graphics.fpsLimit", "Frame-rate limit", "Maximum rendered frames per second.", "select", ["60", "90", "120", "unlimited"]],
    ["graphics.fullscreen", "Fullscreen", "Use the entire display.", "toggle"],
  ],
  camera: [
    ["camera.zoom", "Camera zoom", "Adjust combat framing distance.", "range", 0.8, 1.25, 0.05],
    ["camera.aimLookAhead", "Aim look-ahead", "How far framing leads your scythe aim.", "range", 0, 1.5, 0.05],
    ["camera.dynamicZoom", "Dynamic boss zoom", "Pull back for large encounters.", "toggle"],
    ["camera.shake", "Camera shake", "Impact shake intensity.", "range", 0, 1, 0.05],
    ["camera.reducedMotion", "Reduced motion", "Disable shake and strong UI motion.", "toggle"],
  ],
  audio: [
    ["audio.master", "Master", "Overall output level.", "range", 0, 1, 0.05],
    ["audio.music", "Music", "Adaptive music level.", "range", 0, 1, 0.05],
    ["audio.musicIntensity", "Arrangement intensity", "Density of instruments and percussion.", "range", 0, 1, 0.05],
    ["audio.dynamicMusic", "Adaptive battle score", "Shift orchestration on bar boundaries as danger changes.", "toggle"],
    ["audio.sfx", "Effects", "Combat sound level.", "range", 0, 1, 0.05],
    ["audio.ui", "Interface", "Menu and notification sounds.", "range", 0, 1, 0.05],
    ["audio.muteUnfocused", "Mute while unfocused", "Silence the game when switching windows.", "toggle"],
  ],
  gameplay: [
    ["gameplay.lastDifficultyId", "Difficulty", "Used as the next run's initial selection.", "select", ["relaxed", "standard", "ruthless"]],
    ["gameplay.aimAssist", "Aim assist", "Bias attacks toward nearby enemies.", "range", 0, 1, 0.05],
    ["gameplay.autoTarget", "Auto target", "Strength of soft target selection.", "range", 0, 1, 0.05],
    ["gameplay.damageNumbers", "Spatial combat numbers", "Show spatial damage, mitigation, and healing meaning above combatants.", "toggle"],
    ["gameplay.chargeMode", "Heavy charge input", "Hold or toggle the charged reap.", "select", ["hold", "toggle"]],
  ],
  accessibility: [
    ["accessibility.uiScale", "Interface scale", "Resize all menus and HUD elements.", "range", 0.8, 1.35, 0.05],
    ["accessibility.highContrast", "High contrast", "Increase panel and combat contrast.", "toggle"],
    ["accessibility.colorPalette", "Color palette", "Alternative combat color mapping.", "select", ["default", "deuteranopia", "tritanopia"]],
    ["accessibility.screenFlashes", "Screen flashes", "Enable bright impact feedback.", "toggle"],
    ["accessibility.reducedParticles", "Reduced particles", "Lower visual effect density further.", "toggle"],
  ],
  controls: [
    ["controls.touchControls", "Touch controls", "Show virtual controls automatically, always, or never.", "select", ["auto", "on", "off"]],
    ["moveUp", "Move up", "Primary binding.", "binding"],
    ["moveDown", "Move down", "Primary binding.", "binding"],
    ["moveLeft", "Move left", "Primary binding.", "binding"],
    ["moveRight", "Move right", "Primary binding.", "binding"],
    ["attack", "Scythe attack", "Primary binding.", "binding"],
    ["heavy", "Charged reap", "Primary binding.", "binding"],
    ["dash", "Dash", "Primary binding.", "binding"],
    ["claim", "Reaper's Claim", "Primary binding.", "binding"],
    ["interact", "Interact", "Primary binding.", "binding"],
    ["build", "Build ledger", "Open the current run build.", "binding"],
  ],
});

function titleCase(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

const RANGE_DISPLAY_SCALE = 100;

export function toRangeDisplayValue(value) {
  return Number(value) * RANGE_DISPLAY_SCALE;
}

export function fromRangeDisplayValue(value) {
  return Number(value) / RANGE_DISPLAY_SCALE;
}

export class SettingsMenu {
  constructor(root, settings, input) {
    this.root = root;
    this.settings = settings;
    this.input = input;
    this.activeTab = "graphics";
    this.onClose = null;
    this.previousFocus = null;
    this.element = document.createElement("div");
    this.element.className = "modal settings-modal hidden";
    this.element.innerHTML = `
      <section class="panel settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="settings-heading"><p class="eyebrow">Configure your journey</p><h2 id="settings-title">Settings</h2></div>
        <nav class="settings-tabs" role="tablist" aria-label="Settings categories"></nav>
        <div class="settings-content" role="tabpanel"></div>
        <p class="settings-status" role="status" aria-live="polite"></p>
        <div class="settings-actions">
          <button class="button danger" data-action="reset-settings">Reset defaults</button>
          <button class="button primary" data-action="close-settings">Done</button>
        </div>
      </section>`;
    root.append(this.element);
    this.tabsElement = this.element.querySelector(".settings-tabs");
    this.contentElement = this.element.querySelector(".settings-content");
    this.statusElement = this.element.querySelector(".settings-status");
    this.element.querySelector("[data-action='close-settings']").addEventListener("click", () => this.close());
    this.element.querySelector("[data-action='reset-settings']").addEventListener("click", () => {
      this.settings.reset();
      this.renderTab();
    });
    this.element.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [...this.element.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)")]
        .filter((control) => !control.closest(".hidden"));
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!this.element.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    });
    this.renderTabs();
  }

  open(onClose, trigger = document.activeElement) {
    this.onClose = onClose;
    this.previousFocus = trigger;
    this.statusElement.textContent = "";
    this.element.classList.remove("hidden");
    this.renderTab();
    this.element.querySelector("button, input, select")?.focus();
  }

  close() {
    this.input.cancelCapture();
    this.element.classList.add("hidden");
    const callback = this.onClose;
    const previousFocus = this.previousFocus;
    this.onClose = null;
    this.previousFocus = null;
    callback?.();
    previousFocus?.focus?.();
  }

  get isOpen() {
    return !this.element.classList.contains("hidden");
  }

  renderTabs() {
    this.tabsElement.replaceChildren();
    for (const tab of Object.keys(TABS)) {
      const button = document.createElement("button");
      button.className = `settings-tab ${tab === this.activeTab ? "active" : ""}`;
      button.id = `settings-tab-${tab}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", `settings-panel-${tab}`);
      button.setAttribute("aria-selected", String(tab === this.activeTab));
      button.tabIndex = tab === this.activeTab ? 0 : -1;
      button.textContent = titleCase(tab);
      button.addEventListener("click", () => this.selectTab(tab));
      button.addEventListener("keydown", (event) => {
        const direction = ({
          ArrowUp: -1,
          ArrowLeft: -1,
          ArrowDown: 1,
          ArrowRight: 1,
          Home: "first",
          End: "last",
        }[event.key] ?? {
          KeyA: -1,
          KeyD: 1,
        }[event.code]);
        if (direction === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        this.moveTab(direction);
      });
      this.tabsElement.append(button);
    }
  }

  selectTab(tab, focus = false) {
    if (!(tab in TABS)) return;
    this.activeTab = tab;
    this.renderTabs();
    this.renderTab();
    if (focus) this.tabsElement.querySelector(`#settings-tab-${tab}`)?.focus();
  }

  moveTab(direction) {
    const tabs = Object.keys(TABS);
    const currentIndex = Math.max(0, tabs.indexOf(this.activeTab));
    const nextIndex = direction === "first"
      ? 0
      : direction === "last"
        ? tabs.length - 1
        : (currentIndex + direction + tabs.length) % tabs.length;
    this.selectTab(tabs[nextIndex], true);
  }

  renderTab() {
    this.contentElement.replaceChildren();
    this.contentElement.id = `settings-panel-${this.activeTab}`;
    this.contentElement.setAttribute("aria-labelledby", `settings-tab-${this.activeTab}`);
    for (const field of TABS[this.activeTab]) this.contentElement.append(this.createRow(field));
  }

  setStatus(message) {
    this.statusElement.textContent = message;
  }

  createRow([path, label, description, type, ...options]) {
    const row = document.createElement("label");
    row.className = "setting-row";
    row.innerHTML = `<span class="setting-label"><strong>${label}</strong><span>${description}</span></span>`;
    const control = document.createElement("span");
    control.className = "setting-control";

    if (type === "range") {
      const input = document.createElement("input");
      const output = document.createElement("output");
      input.type = "range";
      [input.min, input.max, input.step] = options.map((value) => String(toRangeDisplayValue(value)));
      input.value = toRangeDisplayValue(this.settings.get(path));
      output.textContent = input.value;
      input.addEventListener("input", () => {
        output.textContent = input.value;
        this.settings.set(path, fromRangeDisplayValue(input.value));
      });
      control.append(input, output);
    }

    if (type === "toggle") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = this.settings.get(path);
      input.addEventListener("change", async () => {
        this.settings.set(path, input.checked);
        if (path === "graphics.fullscreen") {
          try {
            if (input.checked && !document.fullscreenElement) await document.documentElement.requestFullscreen?.();
            if (!input.checked && document.fullscreenElement) await document.exitFullscreen?.();
          } catch {
            input.checked = Boolean(document.fullscreenElement);
            this.settings.set(path, input.checked);
            this.setStatus("Fullscreen could not be changed. Browser permission may be required.");
          }
        }
      });
      control.append(input);
    }

    if (type === "select") {
      const select = document.createElement("select");
      for (const optionValue of options[0]) {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = titleCase(optionValue);
        select.append(option);
      }
      select.value = this.settings.get(path);
      select.addEventListener("change", () => this.settings.set(path, select.value));
      control.append(select);
    }

    if (type === "binding") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "binding-button";
      const bindings = this.settings.get(`controls.bindings.${path}`);
      button.textContent = bindings.join(" / ");
      button.addEventListener("click", async () => {
        button.textContent = "Press a key or button…";
        const binding = await this.input.captureNextBinding();
        if (!binding) return this.renderTab();
        const conflict = this.settings.bindingConflict(path, binding);
        const accepted = this.settings.setBinding(path, binding);
        button.textContent = accepted ? this.settings.get(`controls.bindings.${path}`).join(" / ") : `In use: ${titleCase(conflict)}`;
        if (!accepted) setTimeout(() => this.renderTab(), 900);
      });
      control.append(button);
    }

    row.append(control);
    return row;
  }
}
