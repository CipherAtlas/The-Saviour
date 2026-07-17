import { createRunSeed } from "../generation/seededRandom.js";
import { PLAYER_CONFIG } from "../game/gameConfig.js";

export class GameUi {
  constructor(root, game, settings, input, audio, settingsMenu) {
    this.root = root;
    this.game = game;
    this.settings = settings;
    this.input = input;
    this.audio = audio;
    this.settingsMenu = settingsMenu;
    this.lastMessageTimer = null;
    this.lastDashPercent = -1;
    this.lastDashLabel = "";
    this.build();
    this.bindActions();
    this.setupTouchControls();
    this.applySettings(settings.getAll());
  }

  build() {
    this.root.insertAdjacentHTML("afterbegin", `
      <section class="screen title-screen" data-screen="title">
        <div class="title-content">
          <p class="eyebrow">A scythe-combat action roguelite</p>
          <h1>Reaper of the Hollow Crown</h1>
          <p class="title-copy">Ten vaults. One stolen princess. An otherworldly queen waiting beyond the final gate. Carve a path through the Hollow Realm and decide what survives the rescue.</p>
          <div class="load-status" data-loading>
            <div class="load-status-line"><span data-loading-label>Preparing the descent</span><span data-loading-percent>0%</span></div>
            <div class="load-track"><div class="load-fill" data-loading-bar></div></div>
          </div>
          <div class="button-row">
            <button class="button primary" data-action="new-run" disabled>Preparing models…</button>
            <button class="button" data-action="open-settings">Settings</button>
          </div>
        </div>
      </section>

      <section class="hud hidden" data-screen="hud">
        <div class="hud-top">
          <div class="health-panel">
            <div class="hud-labels"><span data-hud="location">Floor 1 · Chamber 1</span><span data-hud="health-text">140 / 140</span></div>
            <div class="bar"><div class="bar-fill" data-hud="health-bar"></div></div>
            <div class="dash-meter">
              <div class="dash-labels"><span>Dash energy</span><span data-hud="dash-text">Ready</span></div>
              <div class="bar dash-bar" role="progressbar" aria-label="Dash energy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" data-hud="dash-meter">
                <div class="bar-fill" data-hud="dash-bar"></div>
              </div>
            </div>
            <div class="path-strip" data-hud="paths" aria-label="Run upgrade paths">
              <span class="path-reaper">Reaper <strong data-path-rank="Reaper">0</strong></span>
              <span class="path-shade">Shade <strong data-path-rank="Shade">0</strong></span>
              <span class="path-grave">Grave <strong data-path-rank="Grave">0</strong></span>
            </div>
          </div>
          <div class="objective-panel" data-hud="objective">Defeat the Queen's servants</div>
        </div>
        <div class="boss-panel hidden" data-hud="boss-panel">
          <div class="boss-name">The Hollow Queen</div>
          <div class="bar"><div class="bar-fill" data-hud="boss-bar"></div></div>
        </div>
        <div class="hud-bottom">
          <div class="message-log" data-hud="message"></div>
          <div class="controls-hint">WASD move · Mouse aim · LMB sweep · Q charged reap · Shift / RMB dash · Walk into portals · Esc pause</div>
        </div>
      </section>

      <section class="modal hidden" data-screen="dialogue">
        <div class="panel dialogue-panel">
          <img class="dialogue-portrait hidden" data-dialogue="portrait" alt="" />
          <div>
            <div class="dialogue-speaker" data-dialogue="speaker"></div>
            <p class="dialogue-text" data-dialogue="text"></p>
            <div class="choice-list" data-dialogue="choices"></div>
          </div>
        </div>
      </section>

      <section class="modal hidden" data-screen="reward">
        <div class="panel upgrade-panel">
          <p class="eyebrow">Chamber reward</p>
          <h2>Shape your descent</h2>
          <p class="panel-copy">Choose a focused rank before opening the next chamber.</p>
          <div class="upgrade-grid" data-room-rewards></div>
        </div>
      </section>

      <section class="modal hidden" data-screen="blessing">
        <div class="panel upgrade-panel">
          <p class="eyebrow">The threshold yields</p>
          <h2>Choose a major blessing</h2>
          <p class="panel-copy">Commit to a powerful rank before descending to the next floor.</p>
          <div class="upgrade-grid" data-blessings></div>
        </div>
      </section>

      <section class="modal hidden" data-screen="pause">
        <div class="panel">
          <p class="eyebrow">The realm holds its breath</p>
          <h2>Paused</h2>
          <div class="button-row">
            <button class="button primary" data-action="resume">Resume</button>
            <button class="button" data-action="pause-settings">Settings</button>
            <button class="button danger" data-action="abandon-run">Abandon run</button>
          </div>
        </div>
      </section>

      <section class="modal hidden" data-screen="ending">
        <div class="panel">
          <p class="eyebrow" data-ending="eyebrow">The descent ends</p>
          <h2 data-ending="title">The Hollow Realm claims another</h2>
          <p class="panel-copy" data-ending="copy"></p>
          <div class="button-row">
            <button class="button primary" data-action="retry">Retry this seed</button>
            <button class="button" data-action="new-run">New seed</button>
            <button class="button" data-action="return-title">Title</button>
          </div>
        </div>
      </section>

      <div class="touch-controls" data-touch-controls>
        <div class="touch-stick" data-touch-stick><div class="touch-knob" data-touch-knob></div></div>
        <div class="touch-actions">
          <button class="touch-button" data-touch-action="heavy">Reap</button>
          <button class="touch-button" data-touch-action="dash">Dash</button>
          <button class="touch-button" data-touch-action="attack">Strike</button>
        </div>
      </div>`);
  }

  bindActions() {
    this.root.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "new-run") {
        await this.audio.resume();
        this.game.startRun(createRunSeed());
      }
      if (action === "retry") {
        await this.audio.resume();
        this.game.startRun(this.game.seed);
      }
      if (action === "open-settings") this.settingsMenu.open();
      if (action === "pause-settings") this.settingsMenu.open();
      if (action === "resume") this.game.togglePause();
      if (action === "abandon-run" || action === "return-title") this.game.setPhase("title");
    });
  }

  setLoadingProgress(progress) {
    const status = this.root.querySelector("[data-loading]");
    if (!status) return;
    status.classList.remove("ready", "error");
    this.root.querySelector("[data-loading-label]").textContent = `Loading ${progress.label}`;
    this.root.querySelector("[data-loading-percent]").textContent = `${Math.round(progress.ratio * 100)}%`;
    this.root.querySelector("[data-loading-bar]").style.transform = `scaleX(${progress.ratio})`;
  }

  setReady() {
    const status = this.root.querySelector("[data-loading]");
    status.classList.add("ready");
    this.root.querySelector("[data-loading-label]").textContent = "Models cached · realm ready";
    this.root.querySelector("[data-loading-percent]").textContent = "100%";
    this.root.querySelector("[data-loading-bar]").style.transform = "scaleX(1)";
    for (const button of this.root.querySelectorAll("[data-screen='title'] [data-action='new-run']")) {
      button.disabled = false;
      button.textContent = "Begin the descent";
    }
  }

  setLoadError() {
    const status = this.root.querySelector("[data-loading]");
    status.classList.add("error");
    this.root.querySelector("[data-loading-label]").textContent = "The realm failed to open · reload to retry";
    this.root.querySelector("[data-loading-percent]").textContent = "";
  }

  handleEvent(event) {
    const { type, detail } = event;
    if (type === "phaseChanged") {
      this.showPhase(detail.phase);
      if (detail.phase === "roomLoading") this.setObjective("Opening the next chamber…");
    }
    if (type === "roomReady") {
      this.setObjective(this.game.arena?.boss ? "Defeat the Hollow Queen" : "Defeat the Queen's servants");
    }
    if (type === "hudChanged") this.updateHud(detail);
    if (type === "arenaChanged") {
      this.setObjective(detail.boss ? "Defeat the Hollow Queen" : "Defeat the Queen's servants");
      this.root.querySelector("[data-hud='boss-panel']").classList.toggle("hidden", !detail.boss);
    }
    if (type === "dialogueStarted") this.showDialogue(detail);
    if (type === "dialogueResponse") this.showDialogueResponse(detail.response);
    if (type === "roomRewardOffered") {
      this.setObjective("Choose a chamber reward");
      this.showRoomRewards(detail.choices);
    }
    if (type === "blessingOffered") this.showBlessings(detail.choices);
    if (type === "roomCleared") {
      this.showMessage("Chamber conquered.");
    }
    if (type === "portalOpened") {
      this.setObjective("Follow the golden arrow and enter the center portal");
    }
    if (type === "roomRecovered") this.showMessage(`The threshold restores ${Math.round(detail.amount)} health.`);
    if (type === "playerRevived") this.showMessage(`Final Mercy restores ${Math.round(detail.health)} health.`);
    if (type === "enemyHit" && this.settings.get("gameplay.damageNumbers")) {
      this.showMessage(`${detail.critical ? "Critical · " : ""}${Math.round(detail.damage)} damage`);
    }
    if (type === "bossHealth") this.updateBossHealth(detail.health, detail.maxHealth);
    if (type === "runEnded") this.showEnding(detail);
    if (type === "blessingChosen") this.showMessage(`${detail.name} accepted`);
    if (type === "roomRewardChosen") {
      this.showMessage(`${detail.path} · ${detail.name} reached rank ${detail.rank}`);
    }
    if (type === "portalTraversalStarted") {
      this.setObjective("Descending…");
      this.showMessage("The Hollow Realm pulls you deeper.");
    }
    if (type === "roomLoadFailed") {
      this.setObjective("The next chamber failed to open · reload to retry");
      this.showMessage("The descent has lost its path.");
    }
  }

  showPhase(phase) {
    const title = this.root.querySelector("[data-screen='title']");
    const hud = this.root.querySelector("[data-screen='hud']");
    const pause = this.root.querySelector("[data-screen='pause']");
    const dialogue = this.root.querySelector("[data-screen='dialogue']");
    const reward = this.root.querySelector("[data-screen='reward']");
    const blessing = this.root.querySelector("[data-screen='blessing']");
    const ending = this.root.querySelector("[data-screen='ending']");
    title.classList.toggle("hidden", phase !== "title");
    hud.classList.toggle("hidden", ["title", "dead", "victory"].includes(phase));
    pause.classList.toggle("hidden", phase !== "paused");
    dialogue.classList.toggle("hidden", phase !== "dialogue");
    reward.classList.toggle("hidden", phase !== "reward");
    blessing.classList.toggle("hidden", phase !== "blessing");
    ending.classList.toggle("hidden", !["dead", "victory"].includes(phase));
  }

  updateHud(detail) {
    this.root.querySelector("[data-hud='location']").textContent = `Floor ${detail.floor}/${detail.totalFloors} · Chamber ${detail.room}`;
    this.root.querySelector("[data-hud='health-text']").textContent = `${Math.ceil(detail.health)} / ${detail.maxHealth}`;
    this.root.querySelector("[data-hud='health-bar']").style.transform = `scaleX(${Math.max(0, detail.health / detail.maxHealth)})`;
    for (const path of ["Reaper", "Shade", "Grave"]) {
      this.root.querySelector(`[data-path-rank='${path}']`).textContent = String(detail.paths?.[path] ?? 0);
    }
  }

  updateCombatResources(game) {
    if (!game.player) return;
    const cooldownDuration = PLAYER_CONFIG.dash.cooldown * game.player.dashCooldownMultiplier;
    const ratio = cooldownDuration > 0
      ? Math.max(0, Math.min(1, 1 - game.combat.dashCooldown / cooldownDuration))
      : 1;
    const percent = Math.round(ratio * 100);
    const label = game.combat.isDashing ? "Dashing" : percent >= 100 ? "Ready" : `${percent}%`;
    if (percent !== this.lastDashPercent) {
      this.root.querySelector("[data-hud='dash-bar']").style.transform = `scaleX(${ratio})`;
      this.root.querySelector("[data-hud='dash-meter']").setAttribute("aria-valuenow", String(percent));
      this.lastDashPercent = percent;
    }
    if (label !== this.lastDashLabel) {
      this.root.querySelector("[data-hud='dash-text']").textContent = label;
      this.lastDashLabel = label;
    }
  }

  setObjective(text) {
    this.root.querySelector("[data-hud='objective']").textContent = text;
  }

  showMessage(text) {
    const element = this.root.querySelector("[data-hud='message']");
    element.textContent = text;
    clearTimeout(this.lastMessageTimer);
    this.lastMessageTimer = setTimeout(() => { element.textContent = ""; }, 1500);
  }

  updateBossHealth(health, maxHealth) {
    this.root.querySelector("[data-hud='boss-bar']").style.transform = `scaleX(${Math.max(0, health / maxHealth)})`;
  }

  showDialogue(detail) {
    const portrait = this.root.querySelector("[data-dialogue='portrait']");
    portrait.classList.toggle("hidden", !detail.portrait);
    if (detail.portrait) {
      portrait.src = detail.portrait;
      portrait.alt = detail.speaker;
    }
    this.root.querySelector("[data-dialogue='speaker']").textContent = detail.speaker;
    this.root.querySelector("[data-dialogue='text']").textContent = detail.text;
    const choices = this.root.querySelector("[data-dialogue='choices']");
    choices.replaceChildren();
    for (const choice of detail.choices) {
      const button = document.createElement("button");
      button.className = "choice-button";
      button.textContent = choice.text;
      button.addEventListener("click", () => this.game.chooseDialogue(choice.index));
      choices.append(button);
    }
  }

  showDialogueResponse(response) {
    this.root.querySelector("[data-dialogue='text']").textContent = response;
    const choices = this.root.querySelector("[data-dialogue='choices']");
    choices.replaceChildren();
    const button = document.createElement("button");
    button.className = "choice-button";
    button.textContent = "Continue";
    button.addEventListener("click", () => this.game.continueDialogue());
    choices.append(button);
  }

  showUpgradeChoices(grid, choices, choose) {
    grid.replaceChildren();
    for (const choice of choices) {
      const button = document.createElement("button");
      button.className = `upgrade-card path-${choice.path.toLowerCase()}`;
      const header = document.createElement("span");
      header.className = "upgrade-card-header";
      const path = document.createElement("span");
      path.className = "upgrade-path";
      path.textContent = choice.path;
      const rank = document.createElement("span");
      rank.className = "upgrade-rank";
      rank.textContent = choice.maxRank === null ? "Restoration" : `Rank ${choice.nextRank}/${choice.maxRank}`;
      header.append(path, rank);
      const name = document.createElement("h3");
      name.textContent = choice.name;
      const description = document.createElement("p");
      description.textContent = choice.description;
      button.append(header, name, description);
      button.addEventListener("click", () => choose(choice.id));
      grid.append(button);
    }
    queueMicrotask(() => grid.querySelector("button")?.focus());
  }

  showRoomRewards(rewards) {
    this.showUpgradeChoices(
      this.root.querySelector("[data-room-rewards]"),
      rewards,
      (id) => this.game.chooseRoomReward(id),
    );
  }

  showBlessings(blessings) {
    this.showUpgradeChoices(
      this.root.querySelector("[data-blessings]"),
      blessings,
      (id) => this.game.chooseBlessing(id),
    );
  }

  showEnding(detail) {
    const victory = detail.victory;
    this.root.querySelector("[data-ending='eyebrow']").textContent = victory ? "The gate answers" : `Floor ${detail.floor} · Chamber ${detail.room}`;
    this.root.querySelector("[data-ending='title']").textContent = victory ? "The princess is free" : "The Hollow Realm claims another";
    const endings = {
      homecoming: "You return together with the truth of the old war. The kingdom's celebration becomes a reckoning.",
      sealed: "The gate closes forever. No songs remember the realm beneath the crown, but no darkness crosses it again.",
      wardens: "You remain together at the threshold, founding a new watch over both realms.",
    };
    this.root.querySelector("[data-ending='copy']").textContent = victory
      ? endings[detail.ending] ?? "The Hollow Queen falls, and the road home opens."
      : `Seed ${detail.seed}. Your next descent will remember nothing but your resolve.`;
  }

  setupTouchControls() {
    const stick = this.root.querySelector("[data-touch-stick]");
    const knob = this.root.querySelector("[data-touch-knob]");
    const updateStick = (event) => {
      const rect = stick.getBoundingClientRect();
      const x = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const y = -((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2));
      const length = Math.hypot(x, y);
      const normalized = length > 1 ? { x: x / length, y: y / length } : { x, y };
      this.input.setTouchMove(normalized.x, normalized.y);
      knob.style.transform = `translate(calc(-50% + ${normalized.x * 2.1}rem), calc(-50% + ${-normalized.y * 2.1}rem))`;
    };
    stick.addEventListener("pointerdown", (event) => { stick.setPointerCapture(event.pointerId); updateStick(event); });
    stick.addEventListener("pointermove", (event) => { if (stick.hasPointerCapture(event.pointerId)) updateStick(event); });
    const releaseStick = () => {
      this.input.setTouchMove(0, 0);
      knob.style.transform = "translate(-50%, -50%)";
    };
    stick.addEventListener("pointerup", releaseStick);
    stick.addEventListener("pointercancel", releaseStick);

    for (const button of this.root.querySelectorAll("[data-touch-action]")) {
      const action = button.dataset.touchAction;
      button.addEventListener("pointerdown", (event) => { event.preventDefault(); this.input.setTouchAction(action, true); });
      button.addEventListener("pointerup", () => this.input.setTouchAction(action, false));
      button.addEventListener("pointercancel", () => this.input.setTouchAction(action, false));
    }
  }

  applySettings(values) {
    document.documentElement.style.setProperty("--ui-scale", values.accessibility.uiScale);
    document.body.classList.toggle("high-contrast", values.accessibility.highContrast);
    document.body.classList.toggle("reduced-motion", values.camera.reducedMotion);
    document.body.classList.toggle("palette-deuteranopia", values.accessibility.colorPalette === "deuteranopia");
    document.body.classList.toggle("palette-tritanopia", values.accessibility.colorPalette === "tritanopia");
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const showTouch = values.controls.touchControls === "on" || (values.controls.touchControls === "auto" && coarse);
    this.root.querySelector("[data-touch-controls]").classList.toggle("enabled", showTouch);
  }

  hideForBenchmark() {
    for (const screen of this.root.querySelectorAll(".screen, .modal, .hud, .touch-controls")) screen.classList.add("hidden");
  }
}
