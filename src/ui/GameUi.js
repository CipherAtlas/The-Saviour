import { GLOSSARY_ENTRIES, GLOSSARY_UNLOCK_NOTIFICATION } from "../game/glossaryContent.js";
import { createRunSeed } from "../generation/seededRandom.js";
import { DIFFICULTY, PLAYER_CONFIG } from "../game/gameConfig.js";
import {
  characterArtAsset,
  narrativeBackgroundAsset,
  NarrativeImageReadinessCache,
  NARRATIVE_SCENE_IMAGE_CACHE_LIMIT,
  prepareNarrativeImage,
} from "../game/narrativeAssetManifest.js";
import { publicAssetUrl } from "../publicAssetUrl.js";

const HARVEST_MAX_UNITS = 300;
const HARVEST_UNITS_PER_SEGMENT = 100;
const DIALOGUE_HISTORY_RENDER_LIMIT = 120;
const CLAIM_STATUS = Object.freeze({
  outbound: "Throw",
  recalling: "Recall",
  empoweredWindow: "Catch attack",
  empoweredCleave: "Cleave",
  recovery: "Recover",
});

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}m`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function titleCaseId(value) {
  if (!value) return "None yet";
  return String(value).replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function bindingLabel(binding) {
  const labels = {
    Mouse0: "LMB",
    Mouse1: "RMB",
    Mouse2: "MMB",
    Escape: "Esc",
    ShiftLeft: "Shift",
    ShiftRight: "Shift",
    Space: "Space",
  };
  if (labels[binding]) return labels[binding];
  if (binding.startsWith("Gamepad:")) return binding.slice("Gamepad:".length);
  if (binding.startsWith("Key")) return binding.slice(3);
  if (binding.startsWith("Arrow")) return binding.slice(5);
  return binding;
}

function dispatchControlEvent(control, type) {
  const EventConstructor = control.ownerDocument?.defaultView?.Event ?? globalThis.Event;
  control.dispatchEvent(new EventConstructor(type, { bubbles: true }));
}

export function adjustFocusedMenuControl(control, direction) {
  if (!control || direction === 0 || control.disabled) return false;
  const stepDirection = direction < 0 ? -1 : 1;
  if (control.matches?.("select")) {
    const optionCount = control.options?.length ?? 0;
    const nextIndex = Math.max(0, Math.min(optionCount - 1, control.selectedIndex + stepDirection));
    if (optionCount === 0 || nextIndex === control.selectedIndex) return false;
    control.selectedIndex = nextIndex;
    dispatchControlEvent(control, "change");
    return true;
  }
  if (control.matches?.("input[type='range']")) {
    const minimum = Number.isFinite(Number(control.min)) ? Number(control.min) : 0;
    const maximum = Number.isFinite(Number(control.max)) ? Number(control.max) : 100;
    const step = Number.isFinite(Number(control.step)) && Number(control.step) > 0 ? Number(control.step) : 1;
    const nextValue = Math.max(minimum, Math.min(maximum, Number(control.value) + step * stepDirection));
    if (nextValue === Number(control.value)) return false;
    control.value = String(Number(nextValue.toFixed(8)));
    dispatchControlEvent(control, "input");
    dispatchControlEvent(control, "change");
    return true;
  }
  if (control.matches?.("input[type='checkbox']")) {
    const nextChecked = stepDirection > 0;
    if (control.checked === nextChecked) return false;
    control.checked = nextChecked;
    dispatchControlEvent(control, "input");
    dispatchControlEvent(control, "change");
    return true;
  }
  return false;
}

export function combatResourceViewModel(harvest = {}, claim = {}) {
  const units = Math.max(0, Math.min(HARVEST_MAX_UNITS, Math.floor(Number(harvest.units) || 0)));
  const filledSegments = Math.floor(units / HARVEST_UNITS_PER_SEGMENT);
  const phase = claim.phase ?? "idle";
  const claimStatus = phase === "idle"
    ? filledSegments > 0 ? "Ready" : "Empty"
    : CLAIM_STATUS[phase] ?? "Recover";
  const segments = Array.from({ length: 3 }, (_, index) => {
    const segmentUnits = Math.max(0, Math.min(HARVEST_UNITS_PER_SEGMENT, units - index * HARVEST_UNITS_PER_SEGMENT));
    const state = segmentUnits === 0
      ? "empty"
      : segmentUnits < HARVEST_UNITS_PER_SEGMENT
        ? "partial"
        : phase === "idle" ? "ready" : "filled";
    return {
      state,
      fillPercent: segmentUnits,
      marker: state === "ready" ? "✦" : state === "filled" ? "●" : state === "partial" ? "◐" : "○",
    };
  });
  return {
    units,
    filledSegments,
    claimStatus,
    phase,
    segments,
    unitsText: `${units} / ${HARVEST_MAX_UNITS} units`,
    filledText: `${filledSegments} / 3 filled`,
    ariaValueText: `${units} of ${HARVEST_MAX_UNITS} Harvest units; ${filledSegments} of 3 segments filled; Claim ${claimStatus}`,
  };
}

export class GameUi {
  constructor(root, game, settings, input, audio, settingsMenu, narrativeProgress, runSession = null) {
    this.root = root;
    this.game = game;
    this.settings = settings;
    this.input = input;
    this.audio = audio;
    this.settingsMenu = settingsMenu;
    this.narrativeProgress = narrativeProgress;
    this.runSession = runSession;
    this.assetsReady = false;
    this.menuOverlay = null;
    this.menuReturnFocus = null;
    this.pendingRunSeed = null;
    this.lastMessageTimer = null;
    this.harvestFeedbackTimer = null;
    this.harvestFeedbackState = "";
    this.lastGlossaryToastTimer = null;
    this.lastDashPercent = -1;
    this.lastDashLabel = "";
    this.lastCombatResourceSignature = "";
    this.glossaryTrigger = null;
    this.glossaryUnlocked = this.narrativeProgress?.isGlossaryUnlocked?.() === true;
    this.activeGlossaryEntryId = Object.values(GLOSSARY_ENTRIES)[0]?.id ?? null;
    this.endingOutcome = null;
    this.dialogueFocusSequenceId = null;
    this.dialogueOverlayReturnFocus = null;
    this.dialogueArtBeatId = null;
    this.dialogueArtToken = 0;
    this.dialoguePreloadSequenceId = null;
    this.dialogueImageCache = new NarrativeImageReadinessCache({
      maxEntries: NARRATIVE_SCENE_IMAGE_CACHE_LIMIT,
    });
    this.activeInputDevice = this.input.activeDevice ?? "keyboardMouse";
    this.build();
    this.harvestMeter = this.root.querySelector("[data-hud='harvest-meter']");
    this.harvestSegments = [...this.root.querySelectorAll("[data-harvest-segment]")];
    this.harvestUnits = this.root.querySelector("[data-hud='harvest-units']");
    this.harvestFilled = this.root.querySelector("[data-hud='harvest-filled']");
    this.harvestFeedback = this.root.querySelector("[data-hud='harvest-feedback']");
    this.claimStatus = this.root.querySelector("[data-hud='claim-status']");
    this.controlsHint = this.root.querySelector("[data-hud='controls-hint']");
    this.bindActions();
    this.setupTouchControls();
    this.updateControlsHint(this.activeInputDevice);
    this.updateDialogueInputHint(this.activeInputDevice);
    this.input.onActiveDeviceChanged?.((event) => {
      this.activeInputDevice = event.detail?.current ?? event.detail?.device ?? null;
      this.updateControlsHint(this.activeInputDevice);
      this.updateDialogueInputHint(this.activeInputDevice);
    });
    this.renderGlossary();
    this.updateGlossaryAccess();
    this.narrativeProgress?.subscribe?.(() => this.updateGlossaryAccess());
    this.applySettings(settings.getAll());
    this.showPhase(game.phase);
    this.refreshTitleState();
  }

  build() {
    const titleBackgroundUrl = publicAssetUrl("assets/vn/backgrounds/dungeon-threshold.png");
    const titlePrinceUrl = publicAssetUrl("assets/vn/zephyr-c-determined.png");
    this.root.style.setProperty("--menu-panel-background-image", `url("${titleBackgroundUrl}")`);
    this.root.insertAdjacentHTML("afterbegin", `
      <section class="screen title-screen" data-screen="title" aria-labelledby="title-heading">
        <div class="title-art" aria-hidden="true">
          <img class="title-art-background" src="${titleBackgroundUrl}" alt="" />
          <div class="title-ring-light"></div>
          <img class="title-art-zephyr" src="${titlePrinceUrl}" alt="" />
          <div class="title-motes"><i></i><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="title-content">
          <p class="eyebrow">A scythe-combat action roguelite</p>
          <h1 id="title-heading"><span>Reaper</span><span class="title-bridge">of the</span><span>Hollow Crown</span></h1>
          <p class="title-copy">Ten floors. One stolen princess. A Witch waiting below. Follow the bond, cut through the dark, and learn what devotion cannot see.</p>
          <div class="load-status" data-loading>
            <div class="load-status-line"><span data-loading-label>Preparing the descent</span><span data-loading-percent>0%</span></div>
            <div class="load-track"><div class="load-fill" data-loading-bar></div></div>
          </div>
          <nav class="title-actions" aria-label="Main menu">
            <button class="button primary hidden" data-action="continue-run" data-menu-index="01" disabled>Continue</button>
            <button class="button title-new-run" data-action="new-run" data-menu-index="02" disabled>Preparing models…</button>
            <button class="button title-utility" data-action="open-records" data-menu-index="03">Records</button>
            <button class="button title-utility glossary-title-button locked" data-action="open-glossary" data-menu-index="04" disabled aria-describedby="glossary-lock-note">Glossary · Locked</button>
            <button class="button title-utility" data-action="open-settings" data-menu-index="05">Settings</button>
            <button class="button title-utility" data-action="open-credits" data-menu-index="06">Credits</button>
            <button class="button title-utility hidden" data-action="quit" data-menu-index="07">Quit</button>
          </nav>
          <p class="glossary-lock-note" id="glossary-lock-note">Recovered records become available after an ending.</p>
          <p class="title-status" data-title-status role="status" aria-live="polite"></p>
        </div>
      </section>

      <section class="modal menu-modal hidden" data-screen="difficulty" data-menu-overlay role="dialog" aria-modal="true" aria-labelledby="difficulty-title">
        <div class="panel menu-panel difficulty-panel">
          <p class="eyebrow">Choose the pressure</p>
          <h2 id="difficulty-title">Difficulty</h2>
          <p class="panel-copy">The full story and every mechanic remain present. This choice is locked until the descent ends.</p>
          <div class="difficulty-grid" data-difficulty-grid></div>
          <button class="button quiet" data-action="close-menu">Back</button>
        </div>
      </section>

      <section class="modal menu-modal hidden" data-screen="records" data-menu-overlay role="dialog" aria-modal="true" aria-labelledby="records-title">
        <div class="panel menu-panel records-panel">
          <div class="menu-panel-heading"><div><p class="eyebrow">The ledger remembers</p><h2 id="records-title">Records</h2></div><button class="button quiet" data-action="close-menu">Close</button></div>
          <div class="records-content" data-records-content></div>
          <div class="menu-panel-actions"><button class="button danger" data-action="request-reset-records">Reset records</button></div>
        </div>
      </section>

      <section class="modal menu-modal hidden" data-screen="credits" data-menu-overlay role="dialog" aria-modal="true" aria-labelledby="credits-title">
        <div class="panel menu-panel credits-panel">
          <div class="menu-panel-heading"><div><p class="eyebrow">Those who shaped the Hollow Realm</p><h2 id="credits-title">Credits</h2></div><button class="button quiet" data-action="close-menu">Close</button></div>
          <div class="credits-content">
            <section><span class="credits-index" aria-hidden="true">01</span><div><h3>Music</h3><p>“Lamentation,” “Darkest Child,” “Darkest Child var A,” “Constancy” Parts One–Three, “Death of Kings,” and “Unlight” by Kevin MacLeod (incompetech.com), licensed under Creative Commons Attribution 4.0.</p></div></section>
            <section><span class="credits-index" aria-hidden="true">02</span><div><h3>Characters and dungeon models</h3><p>KayKit packs by Kay Lousberg, licensed CC0 1.0 Universal.</p></div></section>
            <section><span class="credits-index" aria-hidden="true">03</span><div><h3>Narrative and menu illustration</h3><p>Project-original production based on the approved character and scene direction.</p></div></section>
            <p class="credits-license">Full attribution, source links, modifications, and checksums are recorded in <code>public/assets/LICENSES.md</code>.</p>
          </div>
        </div>
      </section>

      <section class="modal menu-modal hidden" data-screen="confirmation" data-menu-overlay role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-copy">
        <div class="panel menu-panel confirmation-panel">
          <p class="eyebrow" data-confirmation-eyebrow>Confirm</p>
          <h2 id="confirmation-title" data-confirmation-title>Are you sure?</h2>
          <p class="panel-copy" id="confirmation-copy" data-confirmation-copy></p>
          <div class="button-row"><button class="button danger" data-action="confirm-menu">Confirm</button><button class="button primary" data-action="cancel-confirmation">Cancel</button></div>
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
            <div class="harvest-meter-wrap">
              <div class="harvest-labels">
                <span>Harvest</span>
                <span data-hud="harvest-units">0 / 300 units</span>
              </div>
              <div class="harvest-meter" role="progressbar" aria-label="Harvest for Reaper's Claim" aria-valuemin="0" aria-valuemax="300" aria-valuenow="0" aria-valuetext="0 of 300 Harvest units; 0 of 3 segments filled; Claim Empty" data-hud="harvest-meter">
                <span class="harvest-segment" data-harvest-segment="0" data-state="empty"><span class="harvest-segment-fill"></span><span class="harvest-segment-marker" aria-hidden="true">○</span></span>
                <span class="harvest-segment" data-harvest-segment="1" data-state="empty"><span class="harvest-segment-fill"></span><span class="harvest-segment-marker" aria-hidden="true">○</span></span>
                <span class="harvest-segment" data-harvest-segment="2" data-state="empty"><span class="harvest-segment-fill"></span><span class="harvest-segment-marker" aria-hidden="true">○</span></span>
              </div>
              <div class="harvest-meta"><span data-hud="harvest-filled">0 / 3 filled</span><span class="claim-status" data-hud="claim-status" data-state="empty">Claim · Empty</span></div>
              <span class="harvest-feedback" data-hud="harvest-feedback" role="status" aria-live="polite"></span>
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
          <div class="controls-hint" data-hud="controls-hint">WASD move · Mouse aim · LMB Strike · Q Reap · R Claim · Shift / RMB Dash · Esc pause</div>
        </div>
      </section>

      <section class="modal vn-screen hidden" data-screen="dialogue" role="dialog" aria-modal="true" aria-labelledby="dialogue-speaker">
        <div class="vn-art" aria-hidden="true">
          <img class="vn-background hidden" data-dialogue="background" alt="" />
          <div class="vn-background-fallback"></div>
          <div class="vn-atmosphere"></div>
          <div class="vn-cutout-slot" data-vn-stage="left"><img alt="" /></div>
          <div class="vn-cutout-slot" data-vn-stage="center-left"><img alt="" /></div>
          <div class="vn-cutout-slot" data-vn-stage="center"><img alt="" /></div>
          <div class="vn-cutout-slot" data-vn-stage="right"><img alt="" /></div>
        </div>
        <div class="vn-chrome" data-dialogue="chrome">
          <div class="vn-topbar">
            <div class="vn-scene-meta">
              <span data-dialogue="position">1 / 1</span>
              <span data-dialogue="read-state">New text</span>
            </div>
            <div class="vn-tools" aria-label="Visual novel controls">
              <button class="vn-tool" data-action="dialogue-auto" aria-pressed="false">Auto</button>
              <button class="vn-tool" data-action="dialogue-backlog" aria-expanded="false">History</button>
              <button class="vn-tool" data-action="dialogue-hide">Hide UI</button>
              <button class="vn-tool" data-action="dialogue-fast-forward" aria-pressed="false">Hold FF</button>
              <button class="vn-tool" data-action="dialogue-skip-request">Skip</button>
            </div>
          </div>
          <div class="vn-dialogue-box" data-dialogue="panel">
            <div class="vn-nameplate" id="dialogue-speaker" data-dialogue="speaker"></div>
            <p class="vn-dialogue-text">
              <span data-dialogue="text"></span><span class="vn-caret" aria-hidden="true"></span>
              <span class="sr-only" data-dialogue="announcer" aria-live="polite"></span>
            </p>
            <div class="vn-dialogue-footer">
              <span class="vn-input-hint" data-dialogue="input-hint">Advance · tap</span>
              <button class="button primary vn-advance" data-action="dialogue-continue">Reveal line</button>
            </div>
          </div>
        </div>
        <button class="button vn-show-ui hidden" data-action="dialogue-show-ui">Show dialogue UI</button>
        <aside class="vn-overlay vn-backlog hidden" data-dialogue="backlog" role="dialog" aria-modal="true" aria-labelledby="dialogue-history-title">
          <div class="vn-overlay-heading">
            <div><p class="eyebrow">This descent</p><h2 id="dialogue-history-title">Dialogue history</h2></div>
            <button class="button quiet" data-action="dialogue-backlog-close">Close</button>
          </div>
          <div class="vn-history-list" data-dialogue="history"></div>
        </aside>
        <section class="vn-overlay vn-skip-confirm hidden" data-dialogue="skip-confirm" role="alertdialog" aria-modal="true" aria-labelledby="dialogue-skip-title" aria-describedby="dialogue-skip-copy">
          <p class="eyebrow">Leave this scene?</p>
          <h2 id="dialogue-skip-title">Skip remaining dialogue</h2>
          <p id="dialogue-skip-copy">Unseen lines will remain unread in History and fast-forward will not unlock them.</p>
          <div class="button-row">
            <button class="button danger" data-action="dialogue-skip-confirm">Skip scene</button>
            <button class="button primary" data-action="dialogue-skip-cancel">Keep reading</button>
          </div>
        </section>
      </section>

      <section class="modal hidden" data-screen="reward">
        <div class="panel upgrade-panel">
          <p class="eyebrow">Chamber reward</p>
          <h2>Shape your descent</h2>
          <p class="panel-copy">Choose a focused rank before opening the next chamber.</p>
          <div class="upgrade-grid" data-room-rewards></div>
          <div class="upgrade-actions">
            <button class="button reroll-button" data-action="reroll-upgrades">Reroll choices · once this floor</button>
            <p class="reroll-status" data-reroll-status role="status" aria-live="polite"></p>
          </div>
        </div>
      </section>

      <section class="modal hidden" data-screen="blessing">
        <div class="panel upgrade-panel">
          <p class="eyebrow">The threshold yields</p>
          <h2>Choose a major blessing</h2>
          <p class="panel-copy">Commit to a powerful rank before descending to the next floor.</p>
          <div class="upgrade-grid" data-blessings></div>
          <div class="upgrade-actions">
            <button class="button reroll-button" data-action="reroll-upgrades">Reroll choices · once this floor</button>
            <p class="reroll-status" data-reroll-status role="status" aria-live="polite"></p>
          </div>
        </div>
      </section>

      <section class="modal hidden" data-screen="pause" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <div class="panel pause-panel">
          <p class="eyebrow">The realm holds its breath</p>
          <h2 id="pause-title">Paused</h2>
          <div class="button-row">
            <button class="button primary" data-action="resume">Resume</button>
            <button class="button" data-action="suspend-run">Suspend at last threshold</button>
            <button class="button" data-action="pause-settings">Settings</button>
            <button class="button danger" data-action="request-abandon-run">Abandon run</button>
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
          <div class="run-summary" data-run-summary></div>
          <div class="button-row">
            <button class="button primary" data-action="retry">Retry seed</button>
            <button class="button" data-action="new-run">New Descent</button>
            <button class="button" data-action="return-title">Title</button>
          </div>
        </div>
      </section>

      <section class="modal glossary-modal hidden" data-screen="glossary" role="dialog" aria-modal="true" aria-labelledby="glossary-title">
        <div class="panel glossary-panel">
          <div class="menu-panel-heading glossary-heading">
            <div>
              <p class="eyebrow">Recovered records</p>
              <h2 id="glossary-title">Glossary</h2>
            </div>
            <button class="button quiet glossary-close" data-action="close-glossary" aria-label="Close glossary">Close</button>
          </div>
          <p class="glossary-intro">The records below reframe the descent. They become available only after the choice beneath the final floor.</p>
          <div class="glossary-layout">
            <nav class="glossary-index" data-glossary-entries role="tablist" aria-label="Recovered glossary entries"></nav>
            <article class="glossary-detail" data-glossary-detail role="tabpanel" tabindex="0"></article>
          </div>
        </div>
      </section>

      <div class="ending-fade hidden" data-ending="fade" aria-hidden="true"></div>
      <div class="glossary-toast hidden" data-glossary-toast role="status" aria-live="polite"></div>

      <div class="touch-controls" data-touch-controls>
        <div class="touch-stick touch-move-stick" data-touch-stick role="application" aria-label="Movement stick"><div class="touch-knob" data-touch-knob></div></div>
        <div class="touch-stick touch-aim-stick" data-touch-aim-stick role="application" aria-label="Aim stick"><div class="touch-knob touch-aim-knob" data-touch-aim-knob></div></div>
        <div class="touch-actions">
          <button class="touch-button" data-touch-action="attack">Strike</button>
          <button class="touch-button" data-touch-action="heavy">Reap</button>
          <button class="touch-button" data-touch-action="dash">Dash</button>
          <button class="touch-button touch-claim" data-touch-action="claim">Claim</button>
        </div>
      </div>`);
  }

  bindActions() {
    this.root.addEventListener("click", async (event) => {
      if (event.target === this.root.querySelector("[data-screen='glossary']")) {
        this.closeGlossary();
        return;
      }
      if (event.target.matches?.("[data-menu-overlay]") && event.target.dataset.screen !== "confirmation") {
        this.closeMenuOverlay();
        return;
      }
      const button = event.target.closest("[data-action]");
      if (!button) {
        if (this.game.phase === "dialogue" && event.target.closest("[data-dialogue='panel']")) {
          this.game.continueDialogue(event.timeStamp);
        }
        return;
      }
      const action = button.dataset.action;
      if (action === "new-run") {
        this.openDifficulty(button, createRunSeed());
        return;
      }
      if (action === "retry") {
        this.openDifficulty(button, this.game.seed ?? createRunSeed(), this.game.difficultyId);
        return;
      }
      if (action === "choose-difficulty") {
        const difficultyId = button.dataset.difficulty;
        const seed = this.pendingRunSeed ?? createRunSeed();
        this.closeMenuOverlay({ restoreFocus: false });
        this.resetEndingPresentation();
        await this.audio.resume();
        const started = this.runSession?.startNewRun(seed, difficultyId) ?? (this.game.startRun(seed), true);
        if (!started) this.setTitleStatus("The descent could not begin. Choose a difficulty and try again.");
        return;
      }
      if (action === "continue-run") {
        await this.audio.resume();
        if (!this.runSession?.continueRun()) {
          this.refreshTitleState();
          this.setTitleStatus("That suspended descent could not be restored. Start a new descent instead.");
        }
        return;
      }
      if (action === "open-settings" || action === "pause-settings") {
        this.closeGlossary();
        this.closeMenuOverlay({ restoreFocus: false });
        this.settingsMenu.open(undefined, button);
        return;
      }
      if (action === "open-records") {
        this.renderRecords();
        this.openMenuOverlay("records", button);
        return;
      }
      if (action === "open-credits") {
        this.openMenuOverlay("credits", button);
        return;
      }
      if (action === "close-menu") {
        this.closeMenuOverlay();
        return;
      }
      if (action === "request-reset-records") {
        this.openConfirmation({
          trigger: button,
          eyebrow: "Erase the ledger",
          title: "Reset all records?",
          copy: "Attempts, endings, combat totals, and best times will be erased. Settings and story unlocks remain intact.",
          confirmLabel: "Reset records",
          onConfirm: () => {
            this.runSession?.resetStatistics();
            this.renderRecords();
            this.openMenuOverlay("records", button, { preserveReturnFocus: true });
          },
        });
        return;
      }
      if (action === "request-abandon-run") {
        this.openConfirmation({
          trigger: button,
          eyebrow: "End this descent",
          title: "Abandon the run?",
          copy: "The suspended threshold will be cleared and this attempt will be recorded as abandoned.",
          confirmLabel: "Abandon run",
          onConfirm: () => this.runSession?.abandonRun() ?? this.game.returnToTitle(),
        });
        return;
      }
      if (action === "confirm-menu") {
        const confirm = this.confirmationAction;
        const returnFocus = this.menuReturnFocus;
        this.confirmationAction = null;
        this.confirmationReturnOverlay = null;
        this.closeMenuOverlay({ restoreFocus: false });
        confirm?.();
        if (this.menuOverlay) this.menuReturnFocus = returnFocus;
        return;
      }
      if (action === "cancel-confirmation") {
        this.confirmationAction = null;
        const returnOverlay = this.confirmationReturnOverlay;
        this.confirmationReturnOverlay = null;
        if (returnOverlay) this.openMenuOverlay(returnOverlay, this.menuReturnFocus, { preserveReturnFocus: true });
        else this.closeMenuOverlay();
        return;
      }
      if (action === "resume") {
        this.game.togglePause(event.timeStamp);
        return;
      }
      if (action === "suspend-run") {
        if (this.runSession?.suspendToTitle()) {
          this.refreshTitleState();
          this.setTitleStatus("Descent suspended at the last chamber threshold.");
        } else {
          this.showMessage("No stable threshold is available yet.");
        }
        return;
      }
      if (action === "return-title") {
        this.resetEndingPresentation();
        this.game.returnToTitle();
        return;
      }
      if (action === "quit") {
        this.runSession?.quit();
        return;
      }
      if (action === "reload-game") {
        globalThis.location?.reload?.();
        return;
      }
      if (action === "dialogue-continue") this.game.continueDialogue(event.timeStamp);
      if (action === "dialogue-auto") this.game.toggleDialogueAuto(event.timeStamp);
      if (action === "dialogue-backlog") this.game.openDialogueBacklog(event.timeStamp);
      if (action === "dialogue-backlog-close") this.game.closeDialogueBacklog(event.timeStamp);
      if (action === "dialogue-hide" || action === "dialogue-show-ui") this.game.toggleDialogueUi(event.timeStamp);
      if (action === "dialogue-skip-request") this.game.requestDialogueSkip(event.timeStamp);
      if (action === "dialogue-skip-confirm") this.game.confirmDialogueSkip(event.timeStamp);
      if (action === "dialogue-skip-cancel") this.game.cancelDialogueOverlay(event.timeStamp);
      if (action === "reroll-upgrades") this.game.rerollUpgradeOffer();
      if (action === "kill-princess") this.game.tryKillPrincess(event.timeStamp);
      if (action === "open-glossary") this.openGlossary(button);
      if (action === "close-glossary") this.closeGlossary();
    });

    const fastForward = this.root.querySelector("[data-action='dialogue-fast-forward']");
    const releaseFastForward = (event) => {
      fastForward.setAttribute("aria-pressed", "false");
      if (this.game.phase === "dialogue") this.game.setDialogueFastForward(false, event.timeStamp);
      if (fastForward.hasPointerCapture?.(event.pointerId)) fastForward.releasePointerCapture(event.pointerId);
    };
    fastForward.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      fastForward.setPointerCapture(event.pointerId);
      fastForward.setAttribute("aria-pressed", "true");
      this.game.setDialogueFastForward(true, event.timeStamp);
    });
    fastForward.addEventListener("pointerup", releaseFastForward);
    fastForward.addEventListener("pointercancel", releaseFastForward);

    this.root.addEventListener("keydown", (event) => {
      const menuScope = this.activeMenuScope();
      if (menuScope && this.game.phase !== "dialogue") {
        if (event.key === "Tab") {
          this.trapTab(event, menuScope);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (this.settingsMenu.isOpen) this.settingsMenu.close();
          else if (!this.root.querySelector("[data-screen='glossary']").classList.contains("hidden")) this.closeGlossary();
          else if (this.menuOverlay === "confirmation") this.root.querySelector("[data-action='cancel-confirmation']")?.click();
          else if (this.menuOverlay) this.closeMenuOverlay();
          else if (this.game.phase === "paused") this.game.togglePause(event.timeStamp);
          return;
        }
      }
      if (this.game.phase !== "dialogue") return;
      const view = this.game.dialogue.snapshot();
      if (event.key !== "Tab") return;
      const screen = this.root.querySelector("[data-screen='dialogue']");
      const scope = view?.backlogOpen
        ? this.root.querySelector("[data-dialogue='backlog']")
        : view?.skipConfirmationOpen
          ? this.root.querySelector("[data-dialogue='skip-confirm']")
          : view?.uiHidden
            ? this.root.querySelector("[data-action='dialogue-show-ui']")
            : screen;
      const controls = scope.matches?.("button")
        ? [scope]
        : [...scope.querySelectorAll("button")].filter((control) => !control.disabled && !control.closest(".hidden"));
      if (controls.length > 0) {
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (!scope.contains?.(document.activeElement) && document.activeElement !== scope) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  focusableControls(scope) {
    if (!scope) return [];
    return [...scope.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])")]
      .filter((control) => !control.closest(".hidden") && control.getAttribute("aria-hidden") !== "true");
  }

  trapTab(event, scope) {
    const controls = this.focusableControls(scope);
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!scope.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }

  activeMenuScope() {
    if (this.settingsMenu?.isOpen) return this.settingsMenu.element;
    if (this.menuOverlay) return this.root.querySelector(`[data-screen='${this.menuOverlay}']`);
    const glossary = this.root.querySelector("[data-screen='glossary']");
    if (!glossary.classList.contains("hidden")) return glossary;
    const phaseScreen = {
      title: "title",
      paused: "pause",
      reward: "reward",
      blessing: "blessing",
      dead: "ending",
      victory: "ending",
      endingComplete: "ending",
    }[this.game.phase];
    return phaseScreen ? this.root.querySelector(`[data-screen='${phaseScreen}']`) : null;
  }

  openMenuOverlay(screenId, trigger, { preserveReturnFocus = false } = {}) {
    if (!preserveReturnFocus) this.menuReturnFocus = trigger ?? document.activeElement;
    for (const overlay of this.root.querySelectorAll("[data-menu-overlay]")) {
      overlay.classList.toggle("hidden", overlay.dataset.screen !== screenId);
    }
    this.menuOverlay = screenId;
    queueMicrotask(() => this.focusableControls(this.activeMenuScope())[0]?.focus());
  }

  closeMenuOverlay({ restoreFocus = true } = {}) {
    for (const overlay of this.root.querySelectorAll("[data-menu-overlay]")) overlay.classList.add("hidden");
    this.menuOverlay = null;
    this.pendingRunSeed = null;
    if (restoreFocus) this.menuReturnFocus?.focus?.();
    this.menuReturnFocus = null;
  }

  openDifficulty(trigger, seed, preferredDifficulty = this.settings.get("gameplay.lastDifficultyId")) {
    if (!this.assetsReady) {
      this.setTitleStatus("The realm is still loading.");
      return;
    }
    this.pendingRunSeed = seed;
    const grid = this.root.querySelector("[data-difficulty-grid]");
    grid.replaceChildren();
    for (const profile of Object.values(DIFFICULTY)) {
      const button = document.createElement("button");
      button.className = `difficulty-card${profile.id === preferredDifficulty ? " selected" : ""}`;
      button.dataset.action = "choose-difficulty";
      button.dataset.difficulty = profile.id;
      button.innerHTML = `<span class="difficulty-label">${profile.label}</span><span>${profile.description}</span><small>${profile.id === "story" ? "Longer warnings · lighter pressure" : profile.id === "ruthless" ? "Tighter warnings · denser squads" : "Authored timing · intended pressure"}</small>`;
      if (profile.id === preferredDifficulty) button.setAttribute("aria-current", "true");
      grid.append(button);
    }
    this.openMenuOverlay("difficulty", trigger);
    queueMicrotask(() => grid.querySelector(".selected")?.focus());
  }

  openConfirmation({ trigger, eyebrow, title, copy, confirmLabel, onConfirm }) {
    const screen = this.root.querySelector("[data-screen='confirmation']");
    this.confirmationReturnOverlay = this.menuOverlay;
    screen.querySelector("[data-confirmation-eyebrow]").textContent = eyebrow;
    screen.querySelector("[data-confirmation-title]").textContent = title;
    screen.querySelector("[data-confirmation-copy]").textContent = copy;
    screen.querySelector("[data-action='confirm-menu']").textContent = confirmLabel;
    this.confirmationAction = onConfirm;
    this.openMenuOverlay("confirmation", trigger, { preserveReturnFocus: Boolean(this.confirmationReturnOverlay) });
    queueMicrotask(() => screen.querySelector("[data-action='cancel-confirmation']")?.focus());
  }

  setTitleStatus(message = "") {
    this.root.querySelector("[data-title-status]").textContent = message;
  }

  refreshTitleState() {
    const state = this.runSession?.titleState?.() ?? { continueRun: null, canQuit: false };
    const continueButton = this.root.querySelector("[data-action='continue-run']");
    const suspended = state.continueRun;
    continueButton.classList.toggle("hidden", !suspended);
    continueButton.disabled = !this.assetsReady || !suspended;
    continueButton.textContent = suspended
      ? `Continue · Floor ${suspended.floor}, Chamber ${suspended.room} · ${titleCaseId(suspended.difficultyId)}`
      : "Continue";
    const quitButton = this.root.querySelector("[data-action='quit']");
    quitButton.classList.toggle("hidden", state.canQuit !== true);
    if (state.suspendStorageError === "readUnavailable") {
      this.setTitleStatus("Suspended runs are unavailable in this browser. New descents still work.");
    }
    return state;
  }

  renderRecords() {
    const model = this.runSession?.recordsSnapshot?.();
    const content = this.root.querySelector("[data-records-content]");
    content.replaceChildren();
    if (!model) {
      content.textContent = "Records are unavailable in this build.";
      return;
    }
    const { statistics, derived } = model;
    const overview = document.createElement("div");
    overview.className = "records-overview";
    overview.innerHTML = `
      <article><strong>${statistics.attempts}</strong><span>Attempts</span></article>
      <article><strong>${derived.completions}</strong><span>Endings reached</span></article>
      <article><strong>${Math.round(derived.completionRate * 100)}%</strong><span>Completion rate</span></article>
      <article><strong>${formatDuration(statistics.totalActivePlaytimeSeconds)}</strong><span>Active playtime</span></article>
      <article><strong>${statistics.boss.clears}/${statistics.boss.attempts}</strong><span>Witch clears</span></article>
      <article><strong>${Math.round(statistics.highestHit)}</strong><span>Highest hit</span></article>`;
    content.append(overview);

    const comparison = document.createElement("div");
    comparison.className = "records-difficulties";
    for (const profile of Object.values(DIFFICULTY)) {
      const completions = statistics.completions[profile.id];
      const article = document.createElement("article");
      article.innerHTML = `<h3>${profile.label}</h3><dl><div><dt>Deepest floor</dt><dd>${statistics.deepestFloor[profile.id] || "—"}</dd></div><div><dt>Mercy ending</dt><dd>${completions.kill}</dd></div><div><dt>Release ending</dt><dd>${completions.timeout}</dd></div><div><dt>Best completion</dt><dd>${statistics.bestCompletionTimeSeconds[profile.id] == null ? "—" : formatDuration(statistics.bestCompletionTimeSeconds[profile.id])}</dd></div></dl>`;
      comparison.append(article);
    }
    content.append(comparison);
    const preferences = document.createElement("p");
    preferences.className = "records-preferences";
    preferences.textContent = statistics.attempts === 0
      ? "No descent has ended yet. The ledger will begin with your first completed attempt."
      : `Preferred path: ${derived.preferredPath ?? "unformed"} · Most selected upgrade: ${titleCaseId(derived.mostSelectedUpgrade)} · Favored major action: ${titleCaseId(derived.favoriteMajorAction)}`;
    content.append(preferences);
    if (model.storageError) {
      const warning = document.createElement("p");
      warning.className = "storage-warning";
      warning.textContent = "Records are available for this session, but persistent browser storage is unavailable.";
      content.prepend(warning);
    }
  }

  handleMenuInput(timeStamp = performance.now()) {
    const scope = this.activeMenuScope();
    if (!scope || this.game.phase === "dialogue") return false;
    const moveUp = this.input.consumePressed("moveUp");
    const moveLeft = this.input.consumePressed("moveLeft");
    const moveDown = this.input.consumePressed("moveDown");
    const moveRight = this.input.consumePressed("moveRight");
    const verticalDirection = moveUp ? -1 : moveDown ? 1 : 0;
    const horizontalDirection = moveLeft ? -1 : moveRight ? 1 : 0;
    const confirmAttack = this.input.consumePressed("attack");
    const confirmInteract = this.input.consumePressed("interact");
    const confirm = confirmAttack ?? confirmInteract;
    const back = this.input.consumePressed("pause") ?? this.input.consumePressed("dash");
    if (back) {
      if (this.settingsMenu.isOpen) this.settingsMenu.close();
      else if (!this.root.querySelector("[data-screen='glossary']").classList.contains("hidden")) this.closeGlossary();
      else if (this.menuOverlay === "confirmation") this.root.querySelector("[data-action='cancel-confirmation']")?.click();
      else if (this.menuOverlay) this.closeMenuOverlay();
      else if (this.game.phase === "paused") this.game.togglePause(back.timeStamp ?? timeStamp);
      return true;
    }

    const activeControl = document.activeElement;
    if (activeControl?.matches?.(".glossary-index-button") && verticalDirection !== 0) {
      this.moveGlossarySelection(verticalDirection);
      return true;
    }
    if (verticalDirection === 0 && horizontalDirection !== 0 && adjustFocusedMenuControl(activeControl, horizontalDirection)) {
      return true;
    }

    const focusDirection = verticalDirection || horizontalDirection;
    if (focusDirection !== 0) {
      const controls = this.focusableControls(scope);
      if (controls.length > 0) {
        const current = Math.max(0, controls.indexOf(document.activeElement));
        controls[(current + focusDirection + controls.length) % controls.length].focus();
      }
      return true;
    }

    if (confirm) {
      if (activeControl?.matches?.("button:not(:disabled), input[type='checkbox']:not(:disabled)")) {
        activeControl.click();
      } else {
        adjustFocusedMenuControl(activeControl, 1);
      }
      return true;
    }
    return false;
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
    this.assetsReady = true;
    status.classList.add("ready");
    this.root.querySelector("[data-loading-label]").textContent = "Models cached · realm ready";
    this.root.querySelector("[data-loading-percent]").textContent = "100%";
    this.root.querySelector("[data-loading-bar]").style.transform = "scaleX(1)";
    for (const button of this.root.querySelectorAll("[data-screen='title'] [data-action='new-run']")) {
      button.disabled = false;
      button.textContent = "New Descent";
    }
    this.refreshTitleState();
  }

  setLoadError() {
    this.assetsReady = false;
    const status = this.root.querySelector("[data-loading]");
    status.classList.add("error");
    this.root.querySelector("[data-loading-label]").textContent = "The realm failed to open · reload to retry";
    this.root.querySelector("[data-loading-percent]").textContent = "";
    const statusMessage = this.root.querySelector("[data-title-status]");
    statusMessage.replaceChildren();
    const retry = document.createElement("button");
    retry.className = "button quiet";
    retry.dataset.action = "reload-game";
    retry.textContent = "Reload assets";
    statusMessage.append(retry);
    this.refreshTitleState();
  }

  handleEvent(event) {
    const { type, detail = {} } = event;
    if (type === "phaseChanged") {
      this.showPhase(detail.phase);
      if (detail.phase === "title") this.refreshTitleState();
      if (detail.phase === "roomLoading") this.setObjective("Opening the next chamber…");
    }
    if (type === "runStarted" || type === "runResumed") {
      this.resetEndingPresentation();
      this.setTitleStatus("");
    }
    if (type === "roomReady") {
      this.setObjective(this.game.arena?.boss ? "Defeat the Witch" : "Defeat the Witch's servants");
    }
    if (type === "hudChanged") this.updateHud(detail);
    if (type === "harvestChanged") this.showHarvestFeedback(detail);
    if (type === "arenaChanged") {
      this.setObjective(detail.boss ? "Defeat the Witch" : "Defeat the Witch's servants");
      this.root.querySelector("[data-hud='boss-panel']").classList.toggle("hidden", !detail.boss);
    }
    if (type === "dialogueStarted" || type === "dialogueAdvanced") {
      this.showDialogue(detail, { focus: type === "dialogueStarted" });
    }
    if (type === "roomRewardOffered") {
      this.setObjective("Choose a chamber reward");
      this.showRoomRewards(detail.choices, detail.rerollAvailable);
    }
    if (type === "blessingOffered") this.showBlessings(detail.choices, detail.rerollAvailable);
    if (type === "upgradeRerolled") {
      if (detail.tier === "chamber") this.showRoomRewards(detail.choices, false);
      else this.showBlessings(detail.choices, false);
      this.showMessage("The offered paths have shifted.");
    }
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
    this.root.querySelector("[data-screen='hud']").classList.toggle("hidden", ["title", "dialogue", "dead", "victory", "endingComplete", "endingChoice", "endingStrike", "endingFade"].includes(phase));
    this.root.querySelector("[data-screen='pause']").classList.toggle("hidden", phase !== "paused");
    this.root.querySelector("[data-screen='dialogue']").classList.toggle("hidden", phase !== "dialogue");
    this.root.querySelector("[data-screen='reward']").classList.toggle("hidden", phase !== "reward");
    this.root.querySelector("[data-screen='blessing']").classList.toggle("hidden", phase !== "blessing");
    this.root.querySelector("[data-screen='ending-decision']").classList.toggle("hidden", phase !== "endingChoice");
    this.root.querySelector("[data-screen='ending']").classList.toggle("hidden", !terminal);
    this.root.querySelector("[data-touch-controls]").classList.toggle("hidden", !["playing", "portalTraversal"].includes(phase));
    if (phase !== "dialogue") {
      const dialoguePaused = phase === "paused" && this.game.pausedPhase === "dialogue";
      if (!dialoguePaused) {
        this.dialogueArtToken += 1;
        this.dialogueArtBeatId = null;
        this.dialoguePreloadSequenceId = null;
        this.hideDialogueArt();
        this.dialogueFocusSequenceId = null;
        this.dialogueOverlayReturnFocus = null;
        this.root.querySelector("[data-screen='dialogue']").classList.remove("ui-hidden");
        this.root.querySelector("[data-action='dialogue-fast-forward']").setAttribute("aria-pressed", "false");
      }
    }
    if (phase !== "title") this.closeGlossary();
    if (["roomLoading", "playing", "portalTraversal", "dialogue", "endingChoice", "endingStrike", "endingFade"].includes(phase)) {
      this.closeMenuOverlay({ restoreFocus: false });
    }
    if (phase === "title") {
      this.refreshTitleState();
      queueMicrotask(() => {
        if (!this.menuOverlay && !this.settingsMenu.isOpen) {
          const preferred = this.root.querySelector("[data-action='continue-run']:not(.hidden):not(:disabled)")
            ?? this.root.querySelector("[data-action='new-run']:not(:disabled)");
          preferred?.focus();
        }
      });
    }
    if (phase === "paused") queueMicrotask(() => this.root.querySelector("[data-action='resume']")?.focus());
    if (terminal) queueMicrotask(() => this.root.querySelector("[data-action='retry']")?.focus());
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

    const harvest = game.combat.harvest?.snapshot?.() ?? { units: 0 };
    const claim = game.combat.claim?.snapshot?.() ?? { phase: "idle" };
    const model = combatResourceViewModel(harvest, claim);
    const signature = `${model.units}:${model.phase}`;
    if (signature === this.lastCombatResourceSignature) return;
    this.lastCombatResourceSignature = signature;
    this.harvestMeter.setAttribute("aria-valuenow", String(model.units));
    this.harvestMeter.setAttribute("aria-valuetext", model.ariaValueText);
    this.harvestUnits.textContent = model.unitsText;
    this.harvestFilled.textContent = model.filledText;
    this.claimStatus.textContent = `Claim · ${model.claimStatus}`;
    this.claimStatus.dataset.state = model.phase === "idle" ? model.claimStatus.toLowerCase() : model.phase;
    for (const [index, segment] of model.segments.entries()) {
      const element = this.harvestSegments[index];
      element.dataset.state = segment.state;
      element.style.setProperty("--harvest-fill", `${segment.fillPercent}%`);
      element.querySelector(".harvest-segment-marker").textContent = segment.marker;
    }
  }

  updateControlsHint(device) {
    if (!this.controlsHint) return;
    if (device === "gamepad") {
      this.controlsHint.textContent = "Left stick move · Right stick aim · X Strike · Y Reap · RB Claim · A Dash · Menu pause";
      return;
    }
    if (device === "touch") {
      this.controlsHint.textContent = "Left stick move · Right stick aim · Strike · Reap · Dash · Claim";
      return;
    }
    this.controlsHint.textContent = "WASD move · Mouse aim · LMB Strike · Q Reap · R Claim · Shift / RMB Dash · Esc pause";
  }

  updateDialogueInputHint(device) {
    const hint = this.root.querySelector("[data-dialogue='input-hint']");
    if (!hint) return;
    if (device === "touch") {
      hint.textContent = "Tap reader controls · hold FF to fast-forward";
      return;
    }
    const prefix = device === "gamepad" ? "Gamepad:" : null;
    const actionBinding = (action) => {
      const bindings = this.input.actionBindings?.(action) ?? [];
      const match = prefix
        ? bindings.find((binding) => binding.startsWith(prefix))
        : bindings.find((binding) => !binding.startsWith("Gamepad:"));
      return bindingLabel(match ?? action);
    };
    hint.textContent = [
      `Advance ${actionBinding("attack")}/${actionBinding("interact")}`,
      `Auto ${actionBinding("heavy")}`,
      `History ${actionBinding("dash")}`,
      `Hide ${actionBinding("moveUp")}`,
      `Hold FF ${actionBinding("claim")}`,
      `Skip ${actionBinding("moveDown")}`,
      `Pause ${actionBinding("pause")}`,
    ].join(" · ");
  }

  showHarvestFeedback(detail) {
    const delta = Math.trunc(Number(detail.delta) || 0);
    if (delta === 0) return;
    const state = delta > 0 ? "gain" : "spend";
    const amount = Math.abs(delta);
    clearTimeout(this.harvestFeedbackTimer);
    this.harvestFeedbackState = state;
    this.harvestMeter.dataset.feedback = state;
    this.harvestFeedback.textContent = state === "gain"
      ? `+${amount} Harvest gained`
      : `−${amount} Harvest spent`;
    this.harvestFeedbackTimer = setTimeout(() => {
      this.harvestFeedbackState = "";
      delete this.harvestMeter.dataset.feedback;
      this.harvestFeedback.textContent = "";
      this.harvestFeedbackTimer = null;
    }, 900);
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

  showDialogue(detail, { focus = false } = {}) {
    const screen = this.root.querySelector("[data-screen='dialogue']");
    screen.dataset.sequenceId = detail.sequenceId;
    screen.dataset.beatId = detail.beatId;
    screen.dataset.stage = detail.stage;
    screen.classList.toggle("ui-hidden", detail.uiHidden);

    if (this.dialogueArtBeatId !== detail.beatId) this.prepareDialogueArt(detail);
    if (this.dialoguePreloadSequenceId !== detail.sequenceId) {
      this.dialoguePreloadSequenceId = detail.sequenceId;
      this.preloadDialogueSceneArt(detail);
    }

    this.root.querySelector("[data-dialogue='speaker']").textContent = detail.speaker;
    this.root.querySelector("[data-dialogue='text']").textContent = detail.revealedText ?? detail.text;
    this.root.querySelector("[data-dialogue='announcer']").textContent = detail.phase === "awaitingAdvance" ? detail.text : "";
    const position = Math.max(1, Number(detail.position) || 1);
    const total = Math.max(position, Number(detail.total) || position);
    this.root.querySelector("[data-dialogue='position']").textContent = `${position} / ${total}`;
    this.root.querySelector("[data-dialogue='read-state']").textContent = detail.isRead ? "Previously read" : "New text";

    const advance = this.root.querySelector("[data-action='dialogue-continue']");
    advance.textContent = detail.phase === "revealing"
      ? "Reveal line"
      : position >= total ? "Finish scene" : "Continue";
    this.root.querySelector("[data-action='dialogue-auto']").setAttribute("aria-pressed", String(detail.autoEnabled));
    this.root.querySelector("[data-action='dialogue-fast-forward']").setAttribute("aria-pressed", String(detail.fastForwardHeld));
    this.root.querySelector("[data-action='dialogue-backlog']").setAttribute("aria-expanded", String(detail.backlogOpen));

    const showUi = this.root.querySelector("[data-action='dialogue-show-ui']");
    showUi.classList.toggle("hidden", !detail.uiHidden);
    this.renderDialogueHistory(detail.history);

    const backlog = this.root.querySelector("[data-dialogue='backlog']");
    const backlogWasOpen = !backlog.classList.contains("hidden");
    backlog.classList.toggle("hidden", !detail.backlogOpen);
    const confirmation = this.root.querySelector("[data-dialogue='skip-confirm']");
    const confirmationWasOpen = !confirmation.classList.contains("hidden");
    confirmation.classList.toggle("hidden", !detail.skipConfirmationOpen);

    const overlayOpened = (detail.backlogOpen && !backlogWasOpen)
      || (detail.skipConfirmationOpen && !confirmationWasOpen);
    const overlayClosed = (!detail.backlogOpen && backlogWasOpen)
      || (!detail.skipConfirmationOpen && confirmationWasOpen);
    if (overlayOpened && document.activeElement instanceof HTMLElement) {
      this.dialogueOverlayReturnFocus = document.activeElement;
    }

    if (detail.backlogOpen && !backlogWasOpen) {
      queueMicrotask(() => backlog.querySelector("[data-action='dialogue-backlog-close']")?.focus());
    } else if (detail.skipConfirmationOpen && !confirmationWasOpen) {
      queueMicrotask(() => confirmation.querySelector("[data-action='dialogue-skip-cancel']")?.focus());
    } else if (overlayClosed) {
      const returnFocus = this.dialogueOverlayReturnFocus;
      this.dialogueOverlayReturnFocus = null;
      queueMicrotask(() => {
        if (returnFocus?.isConnected) returnFocus.focus();
        else advance.focus();
      });
    } else if (focus && this.dialogueFocusSequenceId !== detail.sequenceId) {
      this.dialogueFocusSequenceId = detail.sequenceId;
      queueMicrotask(() => advance.focus());
    }
  }

  hideDialogueArt() {
    const screen = this.root.querySelector("[data-screen='dialogue']");
    const background = this.root.querySelector("[data-dialogue='background']");
    if (!screen || !background) return;
    background.onload = null;
    background.onerror = null;
    background.classList.add("hidden");
    background.removeAttribute("src");
    delete background.dataset.assetId;
    screen.dataset.backgroundReady = "false";
    for (const slot of this.root.querySelectorAll("[data-vn-stage]")) {
      slot.classList.remove("active");
      delete slot.dataset.character;
      const image = slot.querySelector("img");
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
      image.alt = "";
    }
  }

  preloadDialogueSceneArt(detail) {
    try {
      const currentBackgroundPath = narrativeBackgroundAsset(detail.background).path;
      const currentArtPath = characterArtAsset(detail.artState).path;
      const paths = [];
      const sequence = this.game.dialogue.sequence(detail.sequenceId);
      for (const beat of sequence.beats) {
        const background = narrativeBackgroundAsset(beat.background);
        const art = characterArtAsset(beat.artState);
        if (background.ready && background.path !== currentBackgroundPath) paths.push(background.path);
        if (art.path !== currentArtPath) paths.push(art.path);
      }
      return this.dialogueImageCache.preloadScene(paths);
    } catch {
      return Promise.resolve([]);
    }
  }

  loadDialogueImage(path) {
    return prepareNarrativeImage(path);
  }

  prepareDialogueArt(detail) {
    const screen = this.root.querySelector("[data-screen='dialogue']");
    const background = this.root.querySelector("[data-dialogue='background']");
    const backgroundAsset = narrativeBackgroundAsset(detail.background);
    const artAsset = characterArtAsset(detail.artState);
    const activeSlot = this.root.querySelector(`[data-vn-stage='${detail.stage}']`);
    const cutout = activeSlot?.querySelector("img");
    const token = ++this.dialogueArtToken;
    this.dialogueArtBeatId = detail.beatId;
    const outgoingArtReady = background.getAttribute("src") !== null
      && [...this.root.querySelectorAll("[data-vn-stage]")].some((slot) => (
        slot.classList.contains("active")
        && slot.querySelector("img")?.getAttribute("src") !== null
      ));
    if (!outgoingArtReady) this.hideDialogueArt();
    screen.dataset.artState = outgoingArtReady ? "transitioning" : "loading";

    const currentReady = backgroundAsset.ready && activeSlot && cutout
      ? Promise.all([
        this.loadDialogueImage(backgroundAsset.path),
        this.loadDialogueImage(artAsset.path),
      ])
      : Promise.reject(new Error(`Narrative art is unavailable for beat ${detail.beatId}.`));

    return currentReady.then(([nextBackground, nextCutout]) => {
      if (token !== this.dialogueArtToken || this.dialogueArtBeatId !== detail.beatId) return;

      nextBackground.className = "vn-background";
      nextBackground.dataset.dialogue = "background";
      nextBackground.dataset.assetId = backgroundAsset.id;
      nextBackground.alt = "";
      nextCutout.alt = "";

      background.replaceWith(nextBackground);
      cutout.replaceWith(nextCutout);
      for (const slot of this.root.querySelectorAll("[data-vn-stage]")) {
        if (slot !== activeSlot) slot.classList.remove("active");
      }
      activeSlot.dataset.character = artAsset.characterId;
      activeSlot.classList.add("active");
      screen.dataset.backgroundReady = "true";
      screen.dataset.artState = "ready";
    }).catch(() => {
      if (token !== this.dialogueArtToken || this.dialogueArtBeatId !== detail.beatId) return;
      if (!outgoingArtReady) this.hideDialogueArt();
      screen.dataset.artState = "error";
    });
  }

  renderDialogueHistory(history = []) {
    const list = this.root.querySelector("[data-dialogue='history']");
    list.replaceChildren();
    if (history.length === 0) {
      const empty = document.createElement("p");
      empty.className = "vn-history-empty";
      empty.textContent = "Completed lines from this scene will appear here.";
      list.append(empty);
      return;
    }
    const visibleHistory = history.slice(-DIALOGUE_HISTORY_RENDER_LIMIT);
    if (visibleHistory.length < history.length) {
      const limitNotice = document.createElement("p");
      limitNotice.className = "vn-history-limit";
      limitNotice.textContent = `Showing the latest ${DIALOGUE_HISTORY_RENDER_LIMIT} lines.`;
      list.append(limitNotice);
    }
    for (const beat of visibleHistory) {
      const article = document.createElement("article");
      article.className = "vn-history-beat";
      const speaker = document.createElement("h3");
      speaker.textContent = beat.speaker;
      const text = document.createElement("p");
      text.textContent = beat.text;
      article.append(speaker, text);
      list.append(article);
    }
    list.lastElementChild?.scrollIntoView?.({ block: "nearest" });
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
      if (choice.preview?.rows?.length > 0) {
        const preview = document.createElement("dl");
        preview.className = "upgrade-preview";
        for (const row of choice.preview.rows) {
          const item = document.createElement("div");
          const label = document.createElement("dt");
          const value = document.createElement("dd");
          label.textContent = row.label;
          value.textContent = `${row.beforeText} → ${row.afterText}`;
          item.append(label, value);
          preview.append(item);
        }
        button.append(preview);
      }
      const facts = [];
      if (choice.tags?.length) facts.push(...choice.tags.map(titleCaseId));
      if (choice.prerequisites?.length) facts.push(`Needs ${choice.prerequisites.map(titleCaseId).join(", ")}`);
      if (choice.excludes?.length) facts.push(`Excludes ${choice.excludes.map(titleCaseId).join(", ")}`);
      if (choice.synergies?.length) facts.push(`Pairs with ${choice.synergies.map(titleCaseId).join(", ")}`);
      if (choice.transformation?.status === "live") facts.push("Transforms an action");
      if (facts.length > 0) {
        const list = document.createElement("span");
        list.className = "upgrade-facts";
        list.textContent = facts.join(" · ");
        button.append(list);
      }
      button.addEventListener("click", () => choose(choice.id));
      grid.append(button);
    }
    queueMicrotask(() => grid.querySelector("button")?.focus());
  }

  setRerollState(screenId, available) {
    const screen = this.root.querySelector(`[data-screen='${screenId}']`);
    const button = screen.querySelector("[data-action='reroll-upgrades']");
    const status = screen.querySelector("[data-reroll-status]");
    button.disabled = !available;
    button.textContent = available ? "Reroll choices · once this floor" : "Reroll unavailable this floor";
    status.textContent = available ? "One deterministic reroll remains on this floor." : "";
  }

  showRoomRewards(rewards = [], rerollAvailable = false) {
    this.showUpgradeChoices(
      this.root.querySelector("[data-room-rewards]"),
      rewards,
      (id) => this.game.chooseRoomReward(id),
    );
    this.setRerollState("reward", rerollAvailable);
  }

  showBlessings(blessings = [], rerollAvailable = false) {
    this.showUpgradeChoices(
      this.root.querySelector("[data-blessings]"),
      blessings,
      (id) => this.game.chooseBlessing(id),
    );
    this.setRerollState("blessing", rerollAvailable);
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
    this.renderRunSummary(this.runSession?.lastRunSummary?.());
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

  renderRunSummary(summary) {
    const root = this.root.querySelector("[data-run-summary]");
    root.replaceChildren();
    if (!summary) return;
    const kills = Object.values(summary.enemiesKilled?.byType ?? {}).reduce((total, count) => total + count, 0);
    const preferredPath = Object.entries(summary.pathTotals ?? {})
      .sort(([leftId, left], [rightId, right]) => right - left || leftId.localeCompare(rightId))[0]?.[0] ?? "Unformed";
    const outcome = summary.terminal?.kind === "ending"
      ? summary.terminal.id === "kill" ? "Mercy ending" : "Release ending"
      : titleCaseId(summary.terminal?.cause ?? "Defeated");
    const rows = [
      ["Outcome", outcome],
      ["Difficulty", titleCaseId(summary.difficultyId)],
      ["Time", formatDuration(summary.durationSeconds)],
      ["Deepest floor", String(summary.deepestFloor)],
      ["Rooms cleared", String(summary.roomsCleared)],
      ["Enemies reaped", String(kills)],
      ["Damage dealt", String(Math.round(summary.damageDealt))],
      ["Highest hit", String(Math.round(summary.highestHit))],
      ["Preferred path", preferredPath],
    ];
    const heading = document.createElement("h3");
    heading.textContent = "Descent summary";
    const list = document.createElement("dl");
    for (const [label, value] of rows) {
      const item = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      item.append(term, description);
      list.append(item);
    }
    root.append(heading, list);
  }

  renderGlossary() {
    const index = this.root.querySelector("[data-glossary-entries]");
    index.replaceChildren();
    Object.values(GLOSSARY_ENTRIES).forEach((entry, entryIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "glossary-index-button";
      button.id = `glossary-tab-${entry.id}`;
      button.dataset.glossaryEntry = entry.id;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", "glossary-detail");
      const number = document.createElement("span");
      number.className = "glossary-index-number";
      number.setAttribute("aria-hidden", "true");
      number.textContent = String(entryIndex + 1).padStart(2, "0");
      const label = document.createElement("span");
      label.textContent = entry.title;
      button.append(number, label);
      button.addEventListener("click", () => this.selectGlossaryEntry(entry.id));
      button.addEventListener("keydown", (event) => {
        const direction = {
          ArrowUp: -1,
          ArrowLeft: -1,
          ArrowDown: 1,
          ArrowRight: 1,
          Home: "first",
          End: "last",
        }[event.key];
        if (direction === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        this.moveGlossarySelection(direction);
      });
      index.append(button);
    });
    this.selectGlossaryEntry(this.activeGlossaryEntryId);
  }

  moveGlossarySelection(direction) {
    const entries = Object.values(GLOSSARY_ENTRIES);
    if (entries.length === 0) return;
    const currentIndex = Math.max(0, entries.findIndex((entry) => entry.id === this.activeGlossaryEntryId));
    const nextIndex = direction === "first"
      ? 0
      : direction === "last"
        ? entries.length - 1
        : (currentIndex + direction + entries.length) % entries.length;
    this.selectGlossaryEntry(entries[nextIndex].id);
    this.root.querySelector(`[data-glossary-entry="${entries[nextIndex].id}"]`)?.focus();
  }

  selectGlossaryEntry(entryId) {
    const entry = GLOSSARY_ENTRIES[entryId] ?? Object.values(GLOSSARY_ENTRIES)[0];
    if (!entry) return;
    this.activeGlossaryEntryId = entry.id;
    const detail = this.root.querySelector("[data-glossary-detail]");
    const kicker = document.createElement("p");
    kicker.className = "eyebrow";
    kicker.textContent = "Recovered record";
    const title = document.createElement("h3");
    title.id = "glossary-detail-title";
    title.textContent = entry.title;
    const text = document.createElement("p");
    text.textContent = entry.text;
    detail.id = "glossary-detail";
    detail.setAttribute("aria-labelledby", `glossary-tab-${entry.id}`);
    detail.replaceChildren(kicker, title, text);
    for (const button of this.root.querySelectorAll("[data-glossary-entry]")) {
      const selected = button.dataset.glossaryEntry === entry.id;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
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
    queueMicrotask(() => modal.querySelector(".glossary-index-button.active")?.focus());
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
    const setupStick = (stick, knob, apply) => {
      const updateStick = (event) => {
        event.preventDefault();
        const rect = stick.getBoundingClientRect();
        const x = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const y = -((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2));
        const length = Math.hypot(x, y);
        const normalized = length > 1 ? { x: x / length, y: y / length } : { x, y };
        apply(normalized.x, normalized.y, event.timeStamp);
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
        event.preventDefault();
        apply(0, 0, event.timeStamp);
        knob.style.transform = "translate(-50%, -50%)";
        if (stick.hasPointerCapture(event.pointerId)) stick.releasePointerCapture(event.pointerId);
      };
      stick.addEventListener("pointerup", releaseStick);
      stick.addEventListener("pointercancel", releaseStick);
    };

    const moveStick = this.root.querySelector("[data-touch-stick]");
    const moveKnob = this.root.querySelector("[data-touch-knob]");
    const aimStick = this.root.querySelector("[data-touch-aim-stick]");
    const aimKnob = this.root.querySelector("[data-touch-aim-knob]");
    setupStick(moveStick, moveKnob, (x, y, timeStamp) => this.input.setTouchMove(x, y, timeStamp));
    setupStick(aimStick, aimKnob, (x, y) => this.input.setTouchAim(x, y));

    for (const button of this.root.querySelectorAll("[data-touch-action]")) {
      const action = button.dataset.touchAction;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.input.setTouchAction(action, true, event.timeStamp);
      });
      const releaseAction = (event) => {
        event.preventDefault();
        this.input.setTouchAction(action, false, event.timeStamp);
        if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      };
      button.addEventListener("pointerup", releaseAction);
      button.addEventListener("pointercancel", releaseAction);
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
    this.updateDialogueInputHint(this.activeInputDevice);
  }

  hideForBenchmark() {
    for (const screen of this.root.querySelectorAll(".screen, .modal, .hud, .touch-controls, .ending-fade, .glossary-toast")) {
      screen.classList.add("hidden");
    }
  }
}
