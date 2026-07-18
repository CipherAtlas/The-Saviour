import { GLOSSARY_ENTRIES, GLOSSARY_UNLOCK_NOTIFICATION } from "../game/glossaryContent.js";
import { createRunSeed } from "../generation/seededRandom.js";
import { PLAYER_CONFIG } from "../game/gameConfig.js";

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export class GameUi {
  constructor(root, game, settings, input, audio, settingsMenu, narrativeProgress) {
    this.root = root;
    this.game = game;
    this.settings = settings;
    this.input = input;
    this.audio = audio;
    this.settingsMenu = settingsMenu;
    this.narrativeProgress = narrativeProgress;
    this.lastMessageTimer = null;
    this.lastGlossaryToastTimer = null;
    this.lastDashPercent = -1;
    this.lastDashLabel = "";
    this.glossaryTrigger = null;
    this.glossaryUnlocked = this.narrativeProgress?.isGlossaryUnlocked?.() === true;
    this.endingOutcome = null;
    this.build();
    this.bindActions();
    this.setupTouchControls();
    this.renderGlossary();
    this.updateGlossaryAccess();
    this.narrativeProgress?.subscribe?.(() => this.updateGlossaryAccess());
    this.applySettings(settings.getAll());
    this.showPhase(game.phase);
  }

  build() {
    this.root.insertAdjacentHTML("afterbegin", `
      <section class="screen title-screen" data-screen="title">
        <div class="title-content">
          <p class="eyebrow">A scythe-combat action roguelite</p>
          <h1>Reaper of the Hollow Crown</h1>
          <p class="title-copy">Ten floors. One stolen princess. A Witch waiting below. Follow the bond, cut through the dark, and learn what devotion cannot see.</p>
          <div class="load-status" data-loading>
            <div class="load-status-line"><span data-loading-label>Preparing the descent</span><span data-loading-percent>0%</span></div>
            <div class="load-track"><div class="load-fill" data-loading-bar></div></div>
          </div>
          <div class="button-row title-actions">
            <button class="button primary" data-action="new-run" disabled>Preparing models…</button>
            <button class="button" data-action="open-settings">Settings</button>
            <button class="button glossary-title-button locked" data-action="open-glossary" disabled aria-describedby="glossary-lock-note">Glossary · Locked</button>
          </div>
          <p class="glossary-lock-note" id="glossary-lock-note">Recovered records become available after an ending.</p>
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
          <div class="objective-panel" data-hud="objective">Defeat the Witch's servants</div>
        </div>
        <div class="boss-panel hidden" data-hud="boss-panel">
          <div class="boss-name">The Witch</div>
          <div class="bar"><div class="bar-fill" data-hud="boss-bar"></div></div>
        </div>
        <div class="hud-bottom">
          <div class="message-log" data-hud="message" aria-live="polite"></div>
          <div class="controls-hint">WASD move · Mouse aim · LMB sweep · Q charged reap · Shift / RMB dash · Walk into portals · Esc pause</div>
        </div>
      </section>

      <section class="modal hidden" data-screen="dialogue" role="dialog" aria-modal="true" aria-labelledby="dialogue-speaker">
        <div class="panel dialogue-panel" data-dialogue="panel">
          <img class="dialogue-portrait hidden" data-dialogue="portrait" alt="" />
          <div class="dialogue-body">
            <div class="dialogue-heading">
              <div class="dialogue-speaker" id="dialogue-speaker" data-dialogue="speaker"></div>
              <div class="dialogue-position" data-dialogue="position"></div>
            </div>
            <p class="dialogue-text" data-dialogue="text" aria-live="polite"></p>
            <div class="dialogue-controls">
              <button class="button primary" data-action="dialogue-continue">Continue</button>
              <button class="button quiet" data-action="dialogue-skip">Skip scene</button>
            </div>
          </div>
        </div>
      </section>

      <section class="modal hidden" data-screen="reward">
        <div class="panel upgrade-panel">
          <p class="eyebrow">Chamber reward</p>
          <h2>Shape your descent</h2>
          <div class="inline-dialogue hidden" data-upgrade-dialogue="reward" aria-label="Princess and Prince dialogue"></div>
          <p class="panel-copy">Choose a focused rank before opening the next chamber.</p>
          <div class="upgrade-grid" data-room-rewards></div>
        </div>
      </section>

      <section class="modal hidden" data-screen="blessing">
        <div class="panel upgrade-panel">
          <p class="eyebrow">The threshold yields</p>
          <h2>Choose a major blessing</h2>
          <div class="inline-dialogue hidden" data-upgrade-dialogue="blessing" aria-label="Princess and Prince dialogue"></div>
          <p class="panel-copy">Commit to a powerful rank before descending to the next floor.</p>
          <div class="upgrade-grid" data-blessings></div>
        </div>
      </section>

      <section class="modal hidden" data-screen="pause">
        <div class="panel pause-panel">
          <p class="eyebrow">The realm holds its breath</p>
          <h2>Paused</h2>
          <div class="button-row">
            <button class="button primary" data-action="resume">Resume</button>
            <button class="button" data-action="pause-settings">Settings</button>
            <button class="button danger" data-action="abandon-run">Abandon run</button>
          </div>
        </div>
      </section>

      <section class="modal ending-decision hidden" data-screen="ending-decision" aria-labelledby="ending-decision-title">
        <div class="ending-decision-ornament" aria-hidden="true"></div>
        <div class="ending-decision-shell" data-ending-decision>
          <p class="eyebrow">One act remains</p>
          <h2 id="ending-decision-title">End the corruption</h2>
          <div class="wedding-ring-countdown" data-ending="countdown" role="progressbar" aria-label="Time remaining to kill Elowen" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
            <svg viewBox="0 0 140 140" aria-hidden="true">
              <circle class="wedding-ring wedding-ring-past" cx="66" cy="70" r="48" pathLength="1"></circle>
              <circle class="wedding-ring wedding-ring-track" cx="74" cy="70" r="48" pathLength="1"></circle>
              <circle class="wedding-ring wedding-ring-progress" data-ending="ring" cx="74" cy="70" r="48" pathLength="1"></circle>
              <path class="wedding-ring-fracture" d="M61 15l8 15-7 13 10 14-9 15 8 15-7 14 9 18"></path>
            </svg>
          </div>
          <p class="ending-decision-status" data-ending="status" aria-live="polite">Her voice is still her own.</p>
          <button class="ending-kill-action" data-action="kill-princess">
            <span class="ending-kill-kicker">Before she is lost</span>
            <strong>Kill Elowen</strong>
            <span class="ending-kill-hint">Strike · Interact · Tap</span>
          </button>
        </div>
      </section>

      <section class="modal hidden" data-screen="ending">
        <div class="panel ending-panel">
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

      <section class="modal glossary-modal hidden" data-screen="glossary" role="dialog" aria-modal="true" aria-labelledby="glossary-title">
        <div class="panel glossary-panel">
          <div class="glossary-heading">
            <div>
              <p class="eyebrow">Recovered records</p>
              <h2 id="glossary-title">Glossary</h2>
            </div>
            <button class="button quiet glossary-close" data-action="close-glossary" aria-label="Close glossary">Close</button>
          </div>
          <p class="glossary-intro">The records below reframe the descent. They become available only after the choice beneath the final floor.</p>
          <div class="glossary-grid" data-glossary-entries></div>
        </div>
      </section>

      <div class="ending-fade hidden" data-ending="fade" aria-hidden="true"></div>
      <div class="glossary-toast hidden" data-glossary-toast role="status" aria-live="polite"></div>

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
      if (event.target === this.root.querySelector("[data-screen='glossary']")) {
        this.closeGlossary();
        return;
      }
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "new-run") {
        this.resetEndingPresentation();
        await this.audio.resume();
        this.game.startRun(createRunSeed());
      }
      if (action === "retry") {
        this.resetEndingPresentation();
        await this.audio.resume();
        this.game.startRun(this.game.seed);
      }
      if (action === "open-settings" || action === "pause-settings") {
        this.closeGlossary();
        this.settingsMenu.open();
      }
      if (action === "resume") this.game.togglePause(event.timeStamp);
      if (action === "abandon-run" || action === "return-title") {
        this.resetEndingPresentation();
        this.game.returnToTitle();
      }
      if (action === "dialogue-continue") this.game.continueDialogue();
      if (action === "dialogue-skip") this.game.skipDialogue();
      if (action === "kill-princess") this.game.tryKillPrincess(event.timeStamp);
      if (action === "open-glossary") this.openGlossary(button);
      if (action === "close-glossary") this.closeGlossary();
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
    const { type, detail = {} } = event;
    if (type === "phaseChanged") {
      this.showPhase(detail.phase);
      if (detail.phase === "roomLoading") this.setObjective("Opening the next chamber…");
    }
    if (type === "runStarted") this.resetEndingPresentation();
    if (type === "roomReady") {
      this.setObjective(this.game.arena?.boss ? "Defeat the Witch" : "Defeat the Witch's servants");
    }
    if (type === "hudChanged") this.updateHud(detail);
    if (type === "arenaChanged") {
      this.setObjective(detail.boss ? "Defeat the Witch" : "Defeat the Witch's servants");
      this.root.querySelector("[data-hud='boss-panel']").classList.toggle("hidden", !detail.boss);
    }
    if (type === "dialogueStarted" || type === "dialogueAdvanced") this.showDialogue(detail);
    if (type === "roomRewardOffered") {
      this.setObjective("Choose a chamber reward");
      this.showRoomRewards(detail.choices, detail.dialogue);
    }
    if (type === "blessingOffered") this.showBlessings(detail.choices, detail.dialogue);
    if (type === "endingDecisionStarted" || type === "endingDecisionUpdated") this.updateEndingDecision(detail);
    if (type === "endingChoiceResolved") this.resolveEndingChoice(detail.ending);
    if (type === "endingFadeStarted" || type === "endingFadeUpdated") this.updateEndingFade(detail);
    if (type === "endingCompleted") this.completeEnding(detail.ending);
    if (type === "glossaryUnlocked") {
      this.updateGlossaryAccess(true);
      this.showGlossaryToast(GLOSSARY_UNLOCK_NOTIFICATION.text);
    }
    if (type === "roomCleared") this.showMessage("Chamber conquered.");
    if (type === "portalOpened") this.setObjective("Follow the golden arrow and enter the center portal");
    if (type === "roomRecovered") this.showMessage(`The threshold restores ${Math.round(detail.amount)} health.`);
    if (type === "playerRevived") this.showMessage(`Final Mercy restores ${Math.round(detail.health)} health.`);
    if (type === "enemyHit" && this.settings.get("gameplay.damageNumbers")) {
      this.showMessage(`${detail.critical ? "Critical · " : ""}${Math.round(detail.damage)} damage`);
    }
    if (type === "bossHealth") this.updateBossHealth(detail.health, detail.maxHealth);
    if (type === "runEnded") this.showEnding(detail);
    if (type === "blessingChosen") this.showMessage(`${detail.name} accepted`);
    if (type === "roomRewardChosen") this.showMessage(`${detail.path} · ${detail.name} reached rank ${detail.rank}`);
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
    const terminal = ["dead", "victory", "endingComplete"].includes(phase);
    this.root.querySelector("[data-screen='title']").classList.toggle("hidden", phase !== "title");
    this.root.querySelector("[data-screen='hud']").classList.toggle("hidden", ["title", "dead", "victory", "endingComplete", "endingChoice", "endingFade"].includes(phase));
    this.root.querySelector("[data-screen='pause']").classList.toggle("hidden", phase !== "paused");
    this.root.querySelector("[data-screen='dialogue']").classList.toggle("hidden", phase !== "dialogue");
    this.root.querySelector("[data-screen='reward']").classList.toggle("hidden", phase !== "reward");
    this.root.querySelector("[data-screen='blessing']").classList.toggle("hidden", phase !== "blessing");
    this.root.querySelector("[data-screen='ending-decision']").classList.toggle("hidden", phase !== "endingChoice");
    this.root.querySelector("[data-screen='ending']").classList.toggle("hidden", !terminal);
    this.root.querySelector("[data-touch-controls]").classList.toggle("hidden", !["playing", "portalTraversal"].includes(phase));
    if (phase !== "title") this.closeGlossary();
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
    const panel = this.root.querySelector("[data-dialogue='panel']");
    const portrait = this.root.querySelector("[data-dialogue='portrait']");
    const hasPortrait = Boolean(detail.portrait);
    panel.classList.toggle("has-portrait", hasPortrait);
    portrait.classList.toggle("hidden", !hasPortrait);
    if (hasPortrait) {
      portrait.src = detail.portrait;
      portrait.alt = detail.speaker;
    } else {
      portrait.removeAttribute("src");
      portrait.alt = "";
    }
    this.root.querySelector("[data-dialogue='speaker']").textContent = detail.speaker;
    this.root.querySelector("[data-dialogue='text']").textContent = detail.text;
    const position = Math.max(1, Number(detail.position) || 1);
    const total = Math.max(position, Number(detail.total) || position);
    this.root.querySelector("[data-dialogue='position']").textContent = `${position} / ${total}`;
    this.root.querySelector("[data-action='dialogue-continue']").textContent = position >= total ? "Finish" : "Continue";
    queueMicrotask(() => this.root.querySelector("[data-action='dialogue-continue']")?.focus());
  }

  renderInlineDialogue(container, beats = []) {
    container.replaceChildren();
    container.classList.toggle("hidden", beats.length === 0);
    for (const beat of beats) {
      const article = document.createElement("article");
      article.className = "inline-dialogue-beat";
      const speaker = document.createElement("span");
      speaker.className = "inline-dialogue-speaker";
      speaker.textContent = beat.speaker;
      const text = document.createElement("p");
      text.textContent = beat.text;
      article.append(speaker, text);
      container.append(article);
    }
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

  showRoomRewards(rewards = [], dialogue = []) {
    this.renderInlineDialogue(this.root.querySelector("[data-upgrade-dialogue='reward']"), dialogue);
    this.showUpgradeChoices(
      this.root.querySelector("[data-room-rewards]"),
      rewards,
      (id) => this.game.chooseRoomReward(id),
    );
  }

  showBlessings(blessings = [], dialogue = []) {
    this.renderInlineDialogue(this.root.querySelector("[data-upgrade-dialogue='blessing']"), dialogue);
    this.showUpgradeChoices(
      this.root.querySelector("[data-blessings]"),
      blessings,
      (id) => this.game.chooseBlessing(id),
    );
  }

  updateEndingDecision(detail) {
    const decision = detail.decision ?? detail;
    const progress = clamp01(decision.progress);
    const urgency = clamp01(decision.urgency);
    const screen = this.root.querySelector("[data-screen='ending-decision']");
    screen.classList.remove("hidden", "corruption-low", "corruption-medium", "corruption-high");
    screen.classList.add(urgency >= 0.72 ? "corruption-high" : urgency >= 0.3 ? "corruption-medium" : "corruption-low");
    screen.style.setProperty("--ending-corruption", String(urgency));
    this.root.classList.add("ending-corruption");
    this.root.style.setProperty("--ending-corruption", String(urgency));

    const ring = this.root.querySelector("[data-ending='ring']");
    ring.style.strokeDashoffset = String(progress);
    const countdown = this.root.querySelector("[data-ending='countdown']");
    countdown.setAttribute("aria-valuenow", String(Math.round((1 - progress) * 100)));
    const remainingSeconds = Math.max(0, Number(decision.remainingMs) || 0) / 1_000;
    countdown.setAttribute("aria-valuetext", `${remainingSeconds.toFixed(1)} seconds remain`);
    this.root.querySelector("[data-ending='status']").textContent = urgency >= 0.72
      ? "The corruption has almost taken her."
      : urgency >= 0.3
        ? "Her voice is breaking apart."
        : "Her voice is still her own.";
  }

  resolveEndingChoice(ending) {
    this.endingOutcome = ending;
    this.root.querySelector("[data-screen='ending-decision']").classList.add("hidden");
    this.root.classList.remove("ending-corruption");
    this.root.style.setProperty("--ending-corruption", "0");
  }

  updateEndingFade(detail) {
    const fade = detail.fade ?? detail;
    const progress = clamp01(fade.progress);
    const overlay = this.root.querySelector("[data-ending='fade']");
    overlay.classList.remove("hidden");
    overlay.style.setProperty("--ending-fade", String(progress));
  }

  completeEnding(ending) {
    this.endingOutcome = ending;
    this.resolveEndingChoice(ending);
    const overlay = this.root.querySelector("[data-ending='fade']");
    overlay.style.setProperty("--ending-fade", "0");
    overlay.classList.add("hidden");
    this.showEnding({ completed: true, ending, victory: ending === "kill" });
    this.showPhase("endingComplete");
  }

  resetEndingPresentation() {
    this.endingOutcome = null;
    this.root.classList.remove("ending-corruption");
    this.root.style.setProperty("--ending-corruption", "0");
    const decision = this.root.querySelector("[data-screen='ending-decision']");
    decision.classList.add("hidden");
    decision.classList.remove("corruption-low", "corruption-medium", "corruption-high");
    decision.style.setProperty("--ending-corruption", "0");
    const ring = this.root.querySelector("[data-ending='ring']");
    ring.style.strokeDashoffset = "0";
    const overlay = this.root.querySelector("[data-ending='fade']");
    overlay.style.setProperty("--ending-fade", "0");
    overlay.classList.add("hidden");
  }

  showEnding(detail) {
    const completed = detail.completed === true || detail.ending === "kill" || detail.ending === "timeout";
    const ending = detail.ending ?? this.endingOutcome;
    const eyebrow = this.root.querySelector("[data-ending='eyebrow']");
    const title = this.root.querySelector("[data-ending='title']");
    const copy = this.root.querySelector("[data-ending='copy']");
    if (completed && ending === "kill") {
      eyebrow.textContent = "The last mercy";
      title.textContent = "You found her";
      copy.textContent = "Elowen dies as herself. The corruption dies with her, and the world survives the rescue.";
      return;
    }
    if (completed && ending === "timeout") {
      eyebrow.textContent = "The containment is broken";
      title.textContent = "Love opened the cage";
      copy.textContent = "The Prince hesitates. Elowen's voice disappears, the corruption walks free, and the Witch's warning becomes his final truth.";
      return;
    }
    eyebrow.textContent = `Floor ${detail.floor} · Chamber ${detail.room}`;
    title.textContent = "The Hollow Realm claims another";
    copy.textContent = `Seed ${detail.seed}. Your next descent will remember nothing but your resolve.`;
  }

  renderGlossary() {
    const grid = this.root.querySelector("[data-glossary-entries]");
    grid.replaceChildren();
    for (const entry of Object.values(GLOSSARY_ENTRIES)) {
      const article = document.createElement("article");
      article.className = "glossary-entry";
      article.id = `glossary-${entry.id}`;
      const title = document.createElement("h3");
      title.textContent = entry.title;
      const text = document.createElement("p");
      text.textContent = entry.text;
      article.append(title, text);
      grid.append(article);
    }
  }

  updateGlossaryAccess(unlocked = this.narrativeProgress?.isGlossaryUnlocked?.() === true) {
    this.glossaryUnlocked = unlocked;
    const button = this.root.querySelector("[data-action='open-glossary']");
    button.disabled = !unlocked;
    button.classList.toggle("locked", !unlocked);
    button.textContent = unlocked ? "Glossary" : "Glossary · Locked";
    button.setAttribute("aria-label", unlocked ? "Open unlocked glossary" : "Glossary locked until an ending is completed");
    this.root.querySelector(".glossary-lock-note").classList.toggle("hidden", unlocked);
  }

  openGlossary(trigger) {
    if (!this.glossaryUnlocked) {
      this.showGlossaryToast("Complete either ending to recover the sealed records.");
      return;
    }
    this.glossaryTrigger = trigger;
    const modal = this.root.querySelector("[data-screen='glossary']");
    modal.classList.remove("hidden");
    queueMicrotask(() => modal.querySelector("[data-action='close-glossary']")?.focus());
  }

  closeGlossary() {
    const modal = this.root.querySelector("[data-screen='glossary']");
    if (modal.classList.contains("hidden")) return;
    modal.classList.add("hidden");
    this.glossaryTrigger?.focus?.();
    this.glossaryTrigger = null;
  }

  showGlossaryToast(text) {
    const toast = this.root.querySelector("[data-glossary-toast]");
    toast.textContent = text;
    toast.classList.remove("hidden");
    clearTimeout(this.lastGlossaryToastTimer);
    this.lastGlossaryToastTimer = setTimeout(() => toast.classList.add("hidden"), 4200);
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
      this.input.setTouchMove(normalized.x, normalized.y, event.timeStamp);
      knob.style.transform = `translate(calc(-50% + ${normalized.x * 2.1}rem), calc(-50% + ${-normalized.y * 2.1}rem))`;
    };
    stick.addEventListener("pointerdown", (event) => {
      stick.setPointerCapture(event.pointerId);
      updateStick(event);
    });
    stick.addEventListener("pointermove", (event) => {
      if (stick.hasPointerCapture(event.pointerId)) updateStick(event);
    });
    const releaseStick = (event) => {
      this.input.setTouchMove(0, 0, event.timeStamp);
      knob.style.transform = "translate(-50%, -50%)";
    };
    stick.addEventListener("pointerup", releaseStick);
    stick.addEventListener("pointercancel", releaseStick);

    for (const button of this.root.querySelectorAll("[data-touch-action]")) {
      const action = button.dataset.touchAction;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.input.setTouchAction(action, true, event.timeStamp);
      });
      button.addEventListener("pointerup", (event) => this.input.setTouchAction(action, false, event.timeStamp));
      button.addEventListener("pointercancel", (event) => this.input.setTouchAction(action, false, event.timeStamp));
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
    for (const screen of this.root.querySelectorAll(".screen, .modal, .hud, .touch-controls, .ending-fade, .glossary-toast")) {
      screen.classList.add("hidden");
    }
  }
}
