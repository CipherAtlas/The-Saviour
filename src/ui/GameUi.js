import { createRunSeed } from "../generation/seededRandom.js";
import { DIFFICULTY, PLAYER_CONFIG, STRAIGHT_CHARGE_CONFIG } from "../game/gameConfig.js";
import {
  bookendBackgroundAsset,
  bookendCharacterAsset,
  BookendImageCache,
  prepareBookendImage,
} from "../game/bookendAssetManifest.js";
import { publicAssetUrl } from "../publicAssetUrl.js";
import { AnimatedLogo } from "./AnimatedLogo.js";

const HARVEST_MAX_UNITS = 300;
const HARVEST_UNITS_PER_SEGMENT = 100;
const CLAIM_STATUS = Object.freeze({
  outbound: "Throw",
  recalling: "Recall",
  empoweredWindow: "Catch attack",
  empoweredCleave: "Cleave",
  recovery: "Recover",
});
const DIFFICULTY_MENU_COPY = Object.freeze({
  relaxed: "More recovery. Fewer threats.",
  standard: "The intended experience.",
  ruthless: "Faster threats. Less mercy.",
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

export function formatSpeedrunTime(seconds) {
  const totalHundredths = Math.max(0, Math.floor((Number(seconds) || 0) * 100 + 0.000001));
  const hours = Math.floor(totalHundredths / 360_000);
  const minutes = Math.floor((totalHundredths % 360_000) / 6_000);
  const remainderSeconds = Math.floor((totalHundredths % 6_000) / 100);
  const hundredths = totalHundredths % 100;
  const clock = `${String(minutes).padStart(2, "0")}:${String(remainderSeconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
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

export function combatResourceViewModel(harvest = {}, claim = {}, primaryCharge = {}) {
  const units = Math.max(0, Math.min(HARVEST_MAX_UNITS, Math.floor(Number(harvest.units) || 0)));
  const filledSegments = Math.floor(units / HARVEST_UNITS_PER_SEGMENT);
  const chargingLine = primaryCharge.chargingPrimary === true;
  const chargeRatio = chargingLine
    ? clamp01(Number(primaryCharge.primaryCharge) / STRAIGHT_CHARGE_CONFIG.buildupDuration)
    : 0;
  const claimPhase = claim.phase ?? "idle";
  const phase = chargingLine ? "lineCharge" : claimPhase;
  const claimStatus = chargingLine
    ? `Grave Line ${Math.round(chargeRatio * 100)}%`
    : claimPhase === "idle"
      ? filledSegments > 0 ? "Ready" : "Empty"
      : CLAIM_STATUS[claimPhase] ?? "Recover";
  const chargeSegmentIndex = chargingLine ? Math.max(0, filledSegments - 1) : -1;
  const segments = Array.from({ length: 3 }, (_, index) => {
    const segmentUnits = Math.max(0, Math.min(HARVEST_UNITS_PER_SEGMENT, units - index * HARVEST_UNITS_PER_SEGMENT));
    if (index === chargeSegmentIndex) {
      return {
        state: "charging",
        fillPercent: Math.round(chargeRatio * 100),
        marker: chargeRatio >= 0.98 ? "◆" : "▶",
      };
    }
    const state = segmentUnits === 0
      ? "empty"
      : segmentUnits < HARVEST_UNITS_PER_SEGMENT
        ? "partial"
        : claimPhase === "idle" ? "ready" : "filled";
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
    ariaValueText: `${units} of ${HARVEST_MAX_UNITS} Harvest units; ${filledSegments} of 3 segments filled; ${chargingLine ? claimStatus : `Claim ${claimStatus}`}`,
  };
}

export class GameUi {
  constructor(root, game, settings, input, audio, settingsMenu, runSession = null) {
    this.root = root;
    this.game = game;
    this.settings = settings;
    this.input = input;
    this.audio = audio;
    this.settingsMenu = settingsMenu;
    this.runSession = runSession;
    this.assetsReady = false;
    this.loadFailed = false;
    this.visiblePhase = game.phase;
    this.loadingTransitionToken = 0;
    this.menuOverlay = null;
    this.menuReturnFocus = null;
    this.pendingRunSeed = null;
    this.lastMessageTimer = null;
    this.harvestFeedbackTimer = null;
    this.harvestFeedbackState = "";
    this.lastDashPercent = -1;
    this.lastDashLabel = "";
    this.lastCombatResourceSignature = "";
    this.lastSpeedrunClock = "";
    this.endingOutcome = null;
    this.bookendFocusSequenceId = null;
    this.bookendArtBeatId = null;
    this.bookendArtToken = 0;
    this.bookendPreloadSequenceId = null;
    this.bookendImageCache = new BookendImageCache();
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
    this.updateBookendInputHint(this.activeInputDevice);
    this.input.onActiveDeviceChanged?.((event) => {
      this.activeInputDevice = event.detail?.current ?? event.detail?.device ?? null;
      this.updateControlsHint(this.activeInputDevice);
      this.updateBookendInputHint(this.activeInputDevice);
    });
    this.applySettings(settings.getAll());
    this.showPhase(game.phase);
    this.refreshTitleState();
  }

  build() {
    const titleBackgroundUrl = publicAssetUrl("assets/vn/backgrounds/dungeon-threshold.png");
    const titlePrinceUrl = publicAssetUrl("assets/vn/zephyr-c-determined.png");
    const brandIconUrl = publicAssetUrl("assets/branding/the-saviour-icon.png");
    const upgradeDialBackgroundUrl = publicAssetUrl("assets/ui/upgrade-scythe-dial-background.png");
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
          <div class="title-brand-logo" data-logo-slot="title"></div>
          <h1 id="title-heading"><span>The Saviour</span></h1>
          <p class="title-copy">Ten floors. One stolen princess. A Witch waiting below. Follow the bond, cut through the dark, and learn what devotion cannot see.</p>
          <nav class="title-actions" aria-label="Main menu">
            <button class="button primary hidden" data-action="continue-run" disabled>Continue</button>
            <button class="button title-new-run" data-action="new-run" disabled>Preparing models…</button>
            <button class="button title-speedrun" data-action="speedrun" disabled>Preparing models…</button>
            <button class="button title-utility" data-action="open-records">Records</button>
            <button class="button title-utility" data-action="open-settings">Settings</button>
            <button class="button title-utility" data-action="open-credits">Credits</button>
            <button class="button title-utility hidden" data-action="quit">Quit</button>
          </nav>
          <p class="title-status" data-title-status role="status" aria-live="polite"></p>
        </div>
      </section>

      <section class="screen loading-screen hidden" data-screen="loading" role="status" aria-label="Loading The Saviour">
        <div class="loading-brand-logo" data-logo-slot="loading"></div>
      </section>

      <section class="modal menu-modal hidden" data-screen="difficulty" data-menu-overlay role="dialog" aria-modal="true" aria-labelledby="difficulty-title">
        <div class="panel menu-panel difficulty-panel">
          <header class="difficulty-heading">
            <h2 id="difficulty-title">Difficulty</h2>
          </header>
          <div class="difficulty-grid" data-difficulty-grid></div>
          <button class="button quiet difficulty-back" data-action="close-menu">Back</button>
        </div>
      </section>

      <section class="modal menu-modal hidden" data-screen="speedrun-rules" data-menu-overlay role="dialog" aria-modal="true" aria-labelledby="speedrun-rules-title">
        <div class="panel menu-panel speedrun-rules-panel">
          <p class="eyebrow">Race the Hollow Realm</p>
          <h2 id="speedrun-rules-title">Speedrun</h2>
          <p class="panel-copy">The full ten-floor descent, stripped to combat and build decisions.</p>
          <dl class="speedrun-rules">
            <div><dt>Bookends</dt><dd>Intro and ending VN skipped</dd></div>
            <div><dt>Pressure</dt><dd>Fixed Ruthless balance</dd></div>
            <div><dt>Clock starts</dt><dd>First playable frame</dd></div>
            <div><dt>Clock includes</dt><dd>Combat, portals, upgrades, and blessings</dd></div>
            <div><dt>Clock stops</dt><dd>The instant the Witch dies</dd></div>
            <div><dt>Finale</dt><dd>Five-second decision remains, untimed</dd></div>
          </dl>
          <p class="speedrun-rules-note">Speedrun records remain separate from standard descents.</p>
          <div class="button-row"><button class="button primary" data-action="start-speedrun">Start Speedrun</button><button class="button quiet" data-action="close-menu">Back</button></div>
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
            <section><span class="credits-index" aria-hidden="true">03</span><div><h3>Bookend and menu illustration</h3><p>Project-original production based on the approved character and scene direction.</p></div></section>
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
              <div class="harvest-meter" role="progressbar" aria-label="Harvest for Reaper's Claim and Grave Line" aria-valuemin="0" aria-valuemax="300" aria-valuenow="0" aria-valuetext="0 of 300 Harvest units; 0 of 3 segments filled; Claim Empty" data-hud="harvest-meter">
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
          <div class="objective-panel" data-hud="objective">Defeat all enemies</div>
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

      <section class="modal vn-screen hidden" data-screen="bookend" role="dialog" aria-modal="true" aria-labelledby="bookend-speaker">
        <div class="vn-art" aria-hidden="true">
          <img class="vn-background hidden" data-bookend="background" alt="" />
          <div class="vn-background-fallback"></div>
          <div class="vn-atmosphere"></div>
          <div class="vn-cutout-slot" data-vn-stage="left"><img alt="" /></div>
          <div class="vn-cutout-slot" data-vn-stage="center-left"><img alt="" /></div>
          <div class="vn-cutout-slot" data-vn-stage="center"><img alt="" /></div>
          <div class="vn-cutout-slot" data-vn-stage="right"><img alt="" /></div>
        </div>
        <div class="vn-chrome" data-bookend="chrome">
          <div class="vn-topbar">
            <div class="vn-scene-meta">
              <span data-bookend="position">1 / 1</span>
            </div>
          </div>
          <div class="vn-dialogue-box" data-bookend="panel">
            <div class="vn-nameplate" id="bookend-speaker" data-bookend="speaker"></div>
            <p class="vn-dialogue-text">
              <span data-bookend="text"></span><span class="vn-caret" aria-hidden="true"></span>
              <span class="sr-only" data-bookend="announcer" aria-live="polite"></span>
            </p>
            <div class="vn-dialogue-footer">
              <span class="vn-input-hint" data-bookend="input-hint">Advance · tap</span>
              <button class="button primary vn-advance" data-action="bookend-continue">Continue</button>
            </div>
          </div>
        </div>
      </section>

      <section class="modal hidden" data-screen="reward" role="dialog" aria-modal="true" aria-labelledby="reward-title">
        <div class="panel upgrade-panel">
          <img class="upgrade-dial-art" src="${upgradeDialBackgroundUrl}" alt="" aria-hidden="true">
          <header class="upgrade-heading">
            <p class="eyebrow">Chamber reward</p>
            <h2 id="reward-title">Shape your descent</h2>
          </header>
          <div class="upgrade-grid" data-room-rewards></div>
          <div class="upgrade-actions">
            <button class="button reroll-button" data-action="reroll-upgrades">Reroll choices · once this floor</button>
          </div>
        </div>
      </section>

      <section class="modal hidden" data-screen="blessing" role="dialog" aria-modal="true" aria-labelledby="blessing-title">
        <div class="panel upgrade-panel">
          <img class="upgrade-dial-art" src="${upgradeDialBackgroundUrl}" alt="" aria-hidden="true">
          <header class="upgrade-heading">
            <p class="eyebrow">The threshold yields</p>
            <h2 id="blessing-title">Choose a major blessing</h2>
            <p class="panel-copy">Commit to a powerful rank before descending to the next floor.</p>
          </header>
          <div class="upgrade-grid" data-blessings></div>
          <div class="upgrade-actions">
            <button class="button reroll-button" data-action="reroll-upgrades">Reroll choices · once this floor</button>
          </div>
        </div>
      </section>

      <section class="modal pause-modal hidden" data-screen="pause" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <div class="panel pause-panel">
          <header class="pause-heading">
            <h2 id="pause-title">Paused</h2>
          </header>
          <nav class="pause-actions" aria-label="Pause menu">
            <button class="button primary" data-action="resume">Resume</button>
            <button class="button" data-action="suspend-run" aria-label="Suspend at last threshold">Suspend Run</button>
            <button class="button" data-action="pause-settings">Settings</button>
            <button class="button danger" data-action="request-abandon-run">Abandon run</button>
          </nav>
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

      <div class="ending-fade hidden" data-ending="fade" aria-hidden="true"></div>
      <div class="speedrun-timer hidden" data-speedrun-timer role="timer" aria-label="Speedrun timer">
        <span>Speedrun</span>
        <strong data-speedrun-time>00:00.00</strong>
        <small data-speedrun-state>Ruthless</small>
      </div>

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
    this.titleLogo = new AnimatedLogo(this.root.querySelector("[data-logo-slot='title']"), {
      imageUrl: brandIconUrl,
      mode: AnimatedLogo.MODES.MAIN_MENU,
    });
    this.loadingLogo = new AnimatedLogo(this.root.querySelector("[data-logo-slot='loading']"), {
      imageUrl: brandIconUrl,
      mode: AnimatedLogo.MODES.LOADING,
    });
    this.loadingLogo.setProgress(null);
  }

  bindActions() {
    this.root.addEventListener("click", async (event) => {
      if (event.target.matches?.("[data-menu-overlay]") && event.target.dataset.screen !== "confirmation") {
        this.closeMenuOverlay();
        return;
      }
      const button = event.target.closest("[data-action]");
      if (!button) {
        if (this.game.phase === "bookend" && event.target.closest("[data-bookend='panel']")) {
          this.game.continueBookend();
        }
        return;
      }
      const action = button.dataset.action;
      if (action === "speedrun") {
        this.openSpeedrunRules(button, createRunSeed());
        return;
      }
      if (action === "new-run") {
        if (this.game.runType === "speedrun" && button.closest("[data-screen='ending']")) {
          await this.startSpeedrun(createRunSeed());
          return;
        }
        this.openDifficulty(button, createRunSeed());
        return;
      }
      if (action === "retry") {
        if (this.game.runType === "speedrun") {
          await this.startSpeedrun(this.game.seed ?? createRunSeed());
          return;
        }
        this.openDifficulty(button, this.game.seed ?? createRunSeed(), this.game.difficultyId);
        return;
      }
      if (action === "start-speedrun") {
        const seed = this.pendingRunSeed ?? createRunSeed();
        await this.startSpeedrun(seed);
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
          copy: "Attempts, endings, combat totals, Speedrun records, and best times will be erased. Settings remain intact.",
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
      if (action === "bookend-continue") this.game.continueBookend();
      if (action === "reroll-upgrades") this.game.rerollUpgradeOffer();
      if (action === "kill-princess") this.game.tryKillPrincess(event.timeStamp);
    });

    this.root.addEventListener("keydown", (event) => {
      const menuScope = this.activeMenuScope();
      if (menuScope) {
        if (event.key === "Tab") {
          this.trapTab(event, menuScope);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (this.settingsMenu.isOpen) this.settingsMenu.close();
          else if (this.menuOverlay === "confirmation") this.root.querySelector("[data-action='cancel-confirmation']")?.click();
          else if (this.menuOverlay) this.closeMenuOverlay();
          else if (this.game.phase === "paused") this.game.togglePause(event.timeStamp);
          return;
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
    const phaseScreen = {
      title: "title",
      bookend: "bookend",
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
      button.innerHTML = `<span class="difficulty-label">${profile.label}</span><span class="difficulty-summary">${DIFFICULTY_MENU_COPY[profile.id] ?? profile.description}</span>`;
      if (profile.id === preferredDifficulty) button.setAttribute("aria-current", "true");
      grid.append(button);
    }
    this.openMenuOverlay("difficulty", trigger);
    queueMicrotask(() => grid.querySelector(".selected")?.focus());
  }

  openSpeedrunRules(trigger, seed) {
    if (!this.assetsReady) {
      this.setTitleStatus("The realm is still loading.");
      return;
    }
    this.pendingRunSeed = seed;
    this.openMenuOverlay("speedrun-rules", trigger);
    queueMicrotask(() => this.root.querySelector("[data-action='start-speedrun']")?.focus());
  }

  async startSpeedrun(seed) {
    this.closeMenuOverlay({ restoreFocus: false });
    this.resetEndingPresentation();
    await this.audio.resume();
    const started = this.runSession?.startSpeedrun(seed)
      ?? (this.game.startRun(seed, { runType: "speedrun" }), true);
    if (!started) this.setTitleStatus("The Speedrun could not begin. Try a fresh attempt.");
    return started;
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
      ? suspended.runType === "speedrun"
        ? `Continue Speedrun · ${formatSpeedrunTime(suspended.elapsedSeconds)} · Floor ${suspended.floor}, Chamber ${suspended.room}`
        : `Continue · Floor ${suspended.floor}, Chamber ${suspended.room} · ${titleCaseId(suspended.difficultyId)}`
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
    const speedrun = model.speedrun ?? { attempts: 0, completions: 0, best: null };
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

    const speedrunRecord = document.createElement("section");
    speedrunRecord.className = "records-speedrun";
    const speedrunTitle = document.createElement("h3");
    speedrunTitle.textContent = "Speedrun · Ruthless";
    const speedrunRows = document.createElement("dl");
    const bestRows = [
      ["Attempts", String(speedrun.attempts)],
      ["Witch clears", String(speedrun.completions)],
      ["Best time", speedrun.best ? formatSpeedrunTime(speedrun.best.timeSeconds) : "—"],
      ["Best seed", speedrun.best?.seed ?? "—"],
      ["Decision", speedrun.best ? speedrun.best.ending === "kill" ? "Mercy" : "Hesitation" : "—"],
    ];
    for (const [label, value] of bestRows) {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      row.append(term, description);
      speedrunRows.append(row);
    }
    speedrunRecord.append(speedrunTitle, speedrunRows);
    content.append(speedrunRecord);
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
    if (model.speedrunStorageError) {
      const warning = document.createElement("p");
      warning.className = "storage-warning";
      warning.textContent = "Speedrun records are available for this session, but persistent browser storage is unavailable.";
      content.prepend(warning);
    }
  }

  handleMenuInput(timeStamp = performance.now()) {
    const scope = this.activeMenuScope();
    if (!scope || this.game.phase === "bookend") return false;
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
      else if (this.menuOverlay === "confirmation") this.root.querySelector("[data-action='cancel-confirmation']")?.click();
      else if (this.menuOverlay) this.closeMenuOverlay();
      else if (this.game.phase === "paused") this.game.togglePause(back.timeStamp ?? timeStamp);
      return true;
    }

    const activeControl = document.activeElement;
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

  async setReady() {
    const transitionToken = ++this.loadingTransitionToken;
    this.setLoadingProgress({ ratio: 1 });
    await this.loadingLogo.playCompletion();
    if (transitionToken !== this.loadingTransitionToken) return false;
    this.assetsReady = true;
    this.loadFailed = false;
    for (const button of this.root.querySelectorAll("[data-screen='title'] [data-action='new-run']")) {
      button.disabled = false;
      button.textContent = "New Descent";
    }
    const speedrunButton = this.root.querySelector("[data-screen='title'] [data-action='speedrun']");
    if (speedrunButton) {
      speedrunButton.disabled = false;
      speedrunButton.textContent = "Speedrun";
    }
    this.showPhase(this.game.phase);
    this.refreshTitleState();
    return true;
  }

  setLoadError() {
    this.loadingTransitionToken += 1;
    this.assetsReady = false;
    this.loadFailed = true;
    this.loadingLogo.resetCompletion();
    const statusMessage = this.root.querySelector("[data-title-status]");
    statusMessage.replaceChildren();
    const retry = document.createElement("button");
    retry.className = "button quiet";
    retry.dataset.action = "reload-game";
    retry.textContent = "Reload assets";
    statusMessage.append(retry);
    this.showPhase(this.game.phase);
    this.refreshTitleState();
  }

  setLoadingProgress(progress = null) {
    const ratio = Number(progress?.ratio);
    const normalized = Number.isFinite(ratio) ? clamp01(ratio) : null;
    this.loadingLogo.setProgress(normalized);
    const loadingScreen = this.root.querySelector("[data-screen='loading']");
    loadingScreen.setAttribute(
      "aria-label",
      normalized === null
        ? "Loading The Saviour"
        : `Loading The Saviour, ${Math.round(normalized * 100)} percent`,
    );
  }

  completeRoomLoad() {
    return this.loadingLogo.playCompletion();
  }

  async finishLoadingTransition(nextPhase) {
    const transitionToken = ++this.loadingTransitionToken;
    await this.loadingLogo.playCompletion();
    if (transitionToken !== this.loadingTransitionToken) return;
    this.showPhase(nextPhase);
  }

  handleEvent(event) {
    const { type, detail = {} } = event;
    if (type === "phaseChanged") {
      if (detail.phase === "roomLoading") {
        this.loadingTransitionToken += 1;
        this.loadingLogo.resetCompletion();
        this.setLoadingProgress(null);
        this.showPhase(detail.phase);
      } else if (this.visiblePhase === "roomLoading") {
        void this.finishLoadingTransition(detail.phase);
      } else {
        this.showPhase(detail.phase);
      }
      if (detail.phase === "title") this.refreshTitleState();
      if (detail.phase === "roomLoading") this.setObjective("Opening the next chamber…");
    }
    if (type === "runStarted" || type === "runResumed") {
      this.resetEndingPresentation();
      this.setTitleStatus("");
    }
    if (type === "roomReady") {
      this.setObjective(this.game.arena?.boss ? "Defeat the Witch" : "Defeat all enemies");
    }
    if (type === "hudChanged") this.updateHud(detail);
    if (type === "harvestChanged") this.showHarvestFeedback(detail);
    if (type === "arenaChanged") {
      this.setObjective(detail.boss ? "Defeat the Witch" : "Defeat all enemies");
      this.root.querySelector("[data-hud='boss-panel']").classList.toggle("hidden", !detail.boss);
    }
    if (type === "bookendStarted" || type === "bookendAdvanced") {
      this.showBookend(detail, { focus: type === "bookendStarted" });
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
    this.visiblePhase = phase;
    const terminal = ["dead", "victory", "endingComplete"].includes(phase);
    const brandLoading = phase === "roomLoading"
      || (phase === "title" && !this.assetsReady && !this.loadFailed);
    this.root.querySelector("[data-screen='loading']").classList.toggle("hidden", !brandLoading);
    this.root.querySelector("[data-screen='title']").classList.toggle("hidden", phase !== "title" || brandLoading);
    this.root.querySelector("[data-screen='hud']").classList.toggle("hidden", ["title", "roomLoading", "bookend", "dead", "victory", "endingComplete", "endingChoice", "endingStrike", "endingFade"].includes(phase));
    this.root.querySelector("[data-screen='pause']").classList.toggle("hidden", phase !== "paused");
    this.root.querySelector("[data-screen='bookend']").classList.toggle("hidden", phase !== "bookend");
    this.root.querySelector("[data-screen='reward']").classList.toggle("hidden", phase !== "reward");
    this.root.querySelector("[data-screen='blessing']").classList.toggle("hidden", phase !== "blessing");
    this.root.querySelector("[data-screen='ending-decision']").classList.toggle("hidden", phase !== "endingChoice");
    this.root.querySelector("[data-screen='ending']").classList.toggle("hidden", !terminal);
    this.root.querySelector("[data-touch-controls]").classList.toggle("hidden", !["playing", "portalTraversal"].includes(phase));
    if (phase !== "bookend") {
      this.bookendArtToken += 1;
      this.bookendArtBeatId = null;
      this.bookendPreloadSequenceId = null;
      this.hideBookendArt();
      this.bookendFocusSequenceId = null;
    }
    if (["roomLoading", "playing", "portalTraversal", "bookend", "endingChoice", "endingStrike", "endingFade"].includes(phase)) {
      this.closeMenuOverlay({ restoreFocus: false });
    }
    if (phase === "title" && !brandLoading) {
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

  updateSpeedrunTimer(snapshot) {
    const timer = this.root.querySelector("[data-speedrun-timer]");
    if (!timer) return;
    const visible = snapshot?.active === true;
    timer.classList.toggle("hidden", !visible);
    if (!visible) {
      this.lastSpeedrunClock = "";
      return;
    }
    const clock = formatSpeedrunTime(snapshot.elapsedSeconds);
    if (clock !== this.lastSpeedrunClock) {
      timer.querySelector("[data-speedrun-time]").textContent = clock;
      timer.setAttribute("aria-label", `Speedrun time ${clock}`);
      this.lastSpeedrunClock = clock;
    }
    timer.classList.toggle("finished", snapshot.finished === true);
    const state = timer.querySelector("[data-speedrun-state]");
    state.textContent = snapshot.finished
      ? "Witch defeated · time locked"
      : this.game.phase === "paused" ? "Paused" : "Ruthless";
  }

  updateCombatResources(game) {
    if (!game.player) return;
    const cooldownDuration = PLAYER_CONFIG.dash.cooldown * game.player.dashCooldownMultiplier;
    const ratio = cooldownDuration > 0
      ? Math.max(0, Math.min(1, 1 - game.combat.dashCooldown / cooldownDuration))
      : 1;
    const percent = Math.round(ratio * 100);
    const chargeDashSpent = (game.combat.primaryHoldArmed || game.combat.chargingPrimary)
      && game.combat.primaryChargeDashesUsed >= STRAIGHT_CHARGE_CONFIG.dashAllowance;
    const label = game.combat.isDashing ? "Dashing"
      : chargeDashSpent ? "Charge dash spent"
        : percent >= 100 ? "Ready" : `${percent}%`;
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
    const model = combatResourceViewModel(harvest, claim, game.combat);
    const signature = `${model.units}:${model.phase}:${Math.round((game.combat.primaryCharge ?? 0) * 100)}`;
    if (signature === this.lastCombatResourceSignature) return;
    this.lastCombatResourceSignature = signature;
    this.harvestMeter.setAttribute("aria-valuenow", String(model.units));
    this.harvestMeter.setAttribute("aria-valuetext", model.ariaValueText);
    this.harvestUnits.textContent = model.unitsText;
    this.harvestFilled.textContent = model.filledText;
    this.claimStatus.textContent = model.phase === "lineCharge" ? model.claimStatus : `Claim · ${model.claimStatus}`;
    this.claimStatus.dataset.state = model.phase === "idle" ? model.claimStatus.toLowerCase() : model.phase;
    this.harvestMeter.dataset.action = model.phase;
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
      this.controlsHint.textContent = "Left stick move · Right stick aim · Tap X combo / hold X Grave Line (1 dash) · Y Reap · RB Claim · A Dash · Menu pause";
      return;
    }
    if (device === "touch") {
      this.controlsHint.textContent = "Left stick move · Right stick aim · Tap Strike combo / hold Grave Line (1 dash) · Reap · Dash · Claim";
      return;
    }
    this.controlsHint.textContent = "WASD move · Mouse aim · Tap LMB combo / hold Grave Line (1 dash) · Q Reap · R Claim · Shift / RMB Dash · Esc pause";
  }

  updateBookendInputHint(device) {
    const hint = this.root.querySelector("[data-bookend='input-hint']");
    if (!hint) return;
    if (device === "touch") {
      hint.textContent = "Tap Continue";
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
    hint.textContent = `Continue ${actionBinding("attack")}/${actionBinding("interact")}`;
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

  showBookend(detail, { focus = false } = {}) {
    const screen = this.root.querySelector("[data-screen='bookend']");
    screen.dataset.sequenceId = detail.sequenceId;
    screen.dataset.beatId = detail.beatId;
    screen.dataset.stage = detail.stage;

    if (this.bookendArtBeatId !== detail.beatId) this.prepareBookendArt(detail);
    if (this.bookendPreloadSequenceId !== detail.sequenceId) {
      this.bookendPreloadSequenceId = detail.sequenceId;
      this.preloadBookendSceneArt(detail);
    }

    this.root.querySelector("[data-bookend='speaker']").textContent = detail.speaker;
    this.root.querySelector("[data-bookend='text']").textContent = detail.text;
    this.root.querySelector("[data-bookend='announcer']").textContent = detail.text;
    const position = Math.max(1, Number(detail.position) || 1);
    const total = Math.max(position, Number(detail.total) || position);
    this.root.querySelector("[data-bookend='position']").textContent = `${position} / ${total}`;
    const advance = this.root.querySelector("[data-action='bookend-continue']");
    advance.textContent = position >= total ? "Begin" : "Continue";
    if (detail.kind === "ending" && position >= total) advance.textContent = "Continue";
    if (focus && this.bookendFocusSequenceId !== detail.sequenceId) {
      this.bookendFocusSequenceId = detail.sequenceId;
      queueMicrotask(() => advance.focus());
    }
  }

  hideBookendArt() {
    const screen = this.root.querySelector("[data-screen='bookend']");
    const background = this.root.querySelector("[data-bookend='background']");
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

  preloadBookendSceneArt(detail) {
    try {
      const paths = [
        bookendBackgroundAsset(detail.background).path,
        bookendCharacterAsset(detail.artState).path,
      ];
      if (detail.nextBackground) paths.push(bookendBackgroundAsset(detail.nextBackground).path);
      if (detail.nextArtState) paths.push(bookendCharacterAsset(detail.nextArtState).path);
      return this.bookendImageCache.preload(paths);
    } catch {
      return Promise.resolve([]);
    }
  }

  loadBookendImage(path) {
    return prepareBookendImage(path);
  }

  prepareBookendArt(detail) {
    const screen = this.root.querySelector("[data-screen='bookend']");
    const background = this.root.querySelector("[data-bookend='background']");
    const backgroundAsset = bookendBackgroundAsset(detail.background);
    const artAsset = bookendCharacterAsset(detail.artState);
    const activeSlot = this.root.querySelector(`[data-vn-stage='${detail.stage}']`);
    const cutout = activeSlot?.querySelector("img");
    const token = ++this.bookendArtToken;
    this.bookendArtBeatId = detail.beatId;
    const outgoingArtReady = background.getAttribute("src") !== null
      && [...this.root.querySelectorAll("[data-vn-stage]")].some((slot) => (
        slot.classList.contains("active")
        && slot.querySelector("img")?.getAttribute("src") !== null
      ));
    if (!outgoingArtReady) this.hideBookendArt();
    screen.dataset.artState = outgoingArtReady ? "transitioning" : "loading";

    const currentReady = activeSlot && cutout
      ? Promise.all([
        this.loadBookendImage(backgroundAsset.path),
        this.loadBookendImage(artAsset.path),
      ])
      : Promise.reject(new Error(`Bookend art is unavailable for beat ${detail.beatId}.`));

    return currentReady.then(([nextBackground, nextCutout]) => {
      if (token !== this.bookendArtToken || this.bookendArtBeatId !== detail.beatId) return;

      nextBackground.className = "vn-background";
      nextBackground.dataset.bookend = "background";
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
      if (token !== this.bookendArtToken || this.bookendArtBeatId !== detail.beatId) return;
      if (!outgoingArtReady) this.hideBookendArt();
      screen.dataset.artState = "error";
    });
  }

  showUpgradeChoices(grid, choices, choose) {
    grid.replaceChildren();
    const buttons = [];
    for (const choice of choices) {
      const button = document.createElement("button");
      button.className = `upgrade-card path-${choice.path.toLowerCase()}`;
      button.type = "button";
      const art = document.createElement("img");
      art.className = "upgrade-card-art";
      art.src = publicAssetUrl(`assets/ui/upgrade-option-${choice.path.toLowerCase()}-sprite.png`);
      art.alt = "";
      art.setAttribute("aria-hidden", "true");
      art.draggable = false;
      const stud = document.createElement("img");
      stud.className = "upgrade-card-stud";
      stud.src = publicAssetUrl(`assets/ui/upgrade-option-${choice.path.toLowerCase()}-stud.png`);
      stud.alt = "";
      stud.setAttribute("aria-hidden", "true");
      stud.draggable = false;
      const content = document.createElement("span");
      content.className = "upgrade-card-content";
      const header = document.createElement("span");
      header.className = "upgrade-card-header";
      const path = document.createElement("span");
      path.className = "upgrade-path";
      path.textContent = choice.path;
      const rank = document.createElement("span");
      rank.className = "upgrade-rank";
      rank.textContent = choice.maxRank === null ? "Restoration" : `Rank ${choice.nextRank}/${choice.maxRank}`;
      header.append(path);
      const name = document.createElement("h3");
      name.textContent = choice.name;
      content.append(header, name, rank);
      const details = document.createElement("dl");
      details.className = "upgrade-details";
      const appendDetail = (labelText, valueText, kind = "text") => {
        const item = document.createElement("div");
        item.dataset.detail = kind;
        const label = document.createElement("dt");
        const value = document.createElement("dd");
        label.textContent = labelText;
        value.textContent = valueText;
        item.append(label, value);
        details.append(item);
      };
      if (choice.preview?.rows?.length > 0) {
        for (const row of choice.preview.rows) {
          appendDetail(row.label, `${row.beforeText} → ${row.afterText}`, "value");
        }
      }
      const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
      const profile = [];
      if (choice.prerequisites?.length) profile.push(countLabel(choice.prerequisites.length, "requirement"));
      if (choice.excludes?.length) profile.push(countLabel(choice.excludes.length, "conflict"));
      if (choice.synergies?.length) profile.push(countLabel(choice.synergies.length, "synergy", "synergies"));
      if (choice.transformation?.status === "live") profile.push("Action upgrade");
      if (profile.length > 0) appendDetail("Build", profile.join(" · "), "summary");
      if (details.childElementCount > 0) content.append(details);
      button.append(art, stud, content);
      button.addEventListener("click", () => choose(choice.id));
      buttons.push(button);
      grid.append(button);
    }
    queueMicrotask(() => buttons[Math.min(1, buttons.length - 1)]?.focus());
  }

  setRerollState(screenId, available) {
    const screen = this.root.querySelector(`[data-screen='${screenId}']`);
    const button = screen.querySelector("[data-action='reroll-upgrades']");
    button.disabled = !available;
    button.textContent = available ? "Reroll choices · once this floor" : "Reroll unavailable this floor";
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
    const summary = this.runSession?.lastRunSummary?.();
    this.renderRunSummary(summary);
    const completed = detail.completed === true || detail.ending === "kill" || detail.ending === "timeout";
    const ending = detail.ending ?? this.endingOutcome;
    const eyebrow = this.root.querySelector("[data-ending='eyebrow']");
    const title = this.root.querySelector("[data-ending='title']");
    const copy = this.root.querySelector("[data-ending='copy']");
    const retry = this.root.querySelector("[data-screen='ending'] [data-action='retry']");
    const newRun = this.root.querySelector("[data-screen='ending'] [data-action='new-run']");
    const speedrun = summary?.runType === "speedrun" || this.game.runType === "speedrun";
    retry.textContent = speedrun ? "Retry Seed" : "Retry seed";
    newRun.textContent = speedrun ? "New Speedrun" : "New Descent";
    if (speedrun) {
      const time = summary?.speedrunTimeSeconds ?? this.runSession?.speedrunSnapshot?.().elapsedSeconds ?? 0;
      if (completed) {
        eyebrow.textContent = summary?.isPersonalBest ? "New personal best" : "Speedrun complete";
        title.textContent = "The Witch is defeated";
        copy.textContent = `${formatSpeedrunTime(time)} · Seed ${detail.seed ?? summary?.seed ?? this.game.seed} · ${ending === "kill" ? "Mercy chosen" : "Hesitation chosen"}`;
      } else {
        eyebrow.textContent = `Floor ${detail.floor} · Chamber ${detail.room}`;
        title.textContent = "Speedrun ended";
        copy.textContent = `${formatSpeedrunTime(time)} elapsed · Seed ${detail.seed ?? summary?.seed ?? this.game.seed}`;
      }
      return;
    }
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
    const speedrun = summary.runType === "speedrun";
    const rows = speedrun ? [
      ["Mode", "Speedrun"],
      ["Outcome", summary.terminal?.kind === "ending"
        ? summary.terminal.id === "kill" ? "Mercy decision" : "Hesitation decision"
        : outcome],
      ["Difficulty", "Ruthless"],
      [summary.speedrunFinished ? "Witch time" : "Elapsed", formatSpeedrunTime(summary.speedrunTimeSeconds)],
      ["Record", summary.isPersonalBest
        ? "New personal best"
        : summary.terminal?.kind === "ending" ? "Completed attempt" : "Attempt ended"],
      ["Seed", summary.seed],
    ] : [
      ["Outcome", outcome],
      ["Difficulty", titleCaseId(summary.difficultyId)],
      ["Time", formatDuration(summary.durationSeconds)],
    ];
    rows.push(
      ["Deepest floor", String(summary.deepestFloor)],
      ["Rooms cleared", String(summary.roomsCleared)],
      ["Enemies reaped", String(kills)],
      ["Damage dealt", String(Math.round(summary.damageDealt))],
      ["Highest hit", String(Math.round(summary.highestHit))],
      ["Preferred path", preferredPath],
    );
    const heading = document.createElement("h3");
    heading.textContent = speedrun ? "Speedrun summary" : "Descent summary";
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
    const effectsDensity = clamp01(values.graphics.effectsDensity);
    const particlesEnabled = !values.accessibility.reducedParticles;
    this.titleLogo.configure({
      reducedMotion: values.camera.reducedMotion,
      particlesEnabled,
      particleAmount: Math.round(6 * effectsDensity),
    });
    this.loadingLogo.configure({
      reducedMotion: values.camera.reducedMotion,
      particlesEnabled,
      particleAmount: Math.round(9 * effectsDensity),
    });
    this.updateBookendInputHint(this.activeInputDevice);
  }

  hideForBenchmark() {
    for (const screen of this.root.querySelectorAll(".screen, .modal, .hud, .touch-controls, .ending-fade")) {
      screen.classList.add("hidden");
    }
  }
}
