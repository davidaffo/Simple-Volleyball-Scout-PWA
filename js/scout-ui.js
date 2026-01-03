function getEnabledSkills() {
  return SKILLS.filter(skill => {
    const cfg = state.metricsConfig[skill.id];
    return !cfg || cfg.enabled !== false;
  });
}
function isSkillEnabled(skillId) {
  if (!skillId) return false;
  const cfg = state.metricsConfig && state.metricsConfig[skillId];
  return !cfg || cfg.enabled !== false;
}
function getTeamScopeFromEvent(ev) {
  return ev && ev.team === "opponent" ? "opponent" : "our";
}
function getOppositeScope(scope) {
  return scope === "opponent" ? "our" : "opponent";
}
function isFarSideForScope(scope) {
  const swapped = !!state.courtSideSwapped;
  return scope === "our" ? swapped : !swapped;
}
function isFarSideForScopeAtSwap(scope, swapped) {
  return scope === "our" ? swapped : !swapped;
}
function isServingForScope(scope) {
  return scope === "opponent" ? !state.isServing : !!state.isServing;
}
function getServeDisplayCourt(scope = "our") {
  const baseCourt = scope === "opponent" ? state.opponentCourt : state.court;
  if (!Array.isArray(baseCourt) || baseCourt.length === 0) return [];
  if (isServingForScope(scope) && typeof removeLiberosAndRestoreForScope === "function") {
    return removeLiberosAndRestoreForScope(baseCourt, scope);
  }
  return getCourtShape(baseCourt);
}
function getTeamNameForScope(scope) {
  return scope === "opponent"
    ? state.selectedOpponentTeam || "Avversaria"
    : state.selectedTeam || "Squadra";
}
function getPlayersForScope(scope) {
  return scope === "opponent" ? state.opponentPlayers || [] : state.players || [];
}
function getPlayerNumbersForScope(scope) {
  return scope === "opponent" ? state.opponentPlayerNumbers || {} : state.playerNumbers || {};
}
function getLiberosForScope(scope) {
  return scope === "opponent" ? state.opponentLiberos || [] : state.liberos || [];
}
function getCaptainsForScope(scope) {
  return scope === "opponent" ? state.opponentCaptains || [] : state.captains || [];
}
function getEnabledSkillsForScope(scope) {
  if (scope === "opponent" && state.useOpponentTeam) {
    const cfg = state.opponentSkillConfig || {};
    return SKILLS.filter(skill => cfg[skill.id] !== false);
  }
  return getEnabledSkills();
}
function isSkillEnabledForScope(skillId, scope) {
  if (!skillId) return false;
  if (scope === "opponent" && state.useOpponentTeam) {
    const cfg = state.opponentSkillConfig || {};
    return cfg[skillId] !== false;
  }
  return isSkillEnabled(skillId);
}
function makePlayerKey(scope, playerIdx) {
  return (scope || "our") + ":" + playerIdx;
}
function isPlayerKeyInScope(key, scope) {
  if (!key || !scope) return false;
  return key.startsWith(scope + ":");
}
const selectedSkillPerPlayer = {};
const serveMetaByPlayer = {};
const attackMetaByPlayer = {};
const blockConfirmByPlayer = {};
const serveTypeSelectHandlers = {};
let blockInlinePlayer = null;
const selectedEventIds = new Set();
let lastSelectedEventId = null;
const eventTableContexts = {};
let lastEventContextKey = null;
let lastReceiveContext = { our: null, opponent: null };
let lastLogRenderedKey = null;
let aggTableView = { mode: "summary", skillId: null, playerIdx: null };
let aggTableHeadCache = null;
let analysisStatsCache = null;
let analysisStatsScope = "our";
let serveTrajectoryScope = null;
function getAttackMetaForPlayer(scope, playerIdx) {
  const scopedKey = scope + ":" + playerIdx;
  if (attackMetaByPlayer[scopedKey]) return attackMetaByPlayer[scopedKey];
  const fallbackKey = makePlayerKey(scope, playerIdx);
  const direct = attackMetaByPlayer[fallbackKey];
  if (direct && direct.playerIdx === playerIdx && direct.scope === scope) return direct;
  const keys = Object.keys(attackMetaByPlayer);
  for (let i = 0; i < keys.length; i += 1) {
    const meta = attackMetaByPlayer[keys[i]];
    if (meta && meta.playerIdx === playerIdx && meta.scope === scope) return meta;
  }
  return null;
}
function getActiveAttackKeyForScope(scope) {
  if (attackInlinePlayer && isPlayerKeyInScope(attackInlinePlayer, scope)) {
    return attackInlinePlayer;
  }
  const keys = Object.keys(attackMetaByPlayer);
  for (let i = 0; i < keys.length; i += 1) {
    const meta = attackMetaByPlayer[keys[i]];
    if (!meta || meta.scope !== scope) continue;
    if (typeof meta.playerIdx !== "number") continue;
    return keys[i];
  }
  return null;
}
const ERROR_TYPES = [
  { id: "Double", label: "Doppia" },
  { id: "Carry", label: "Accompagnata" },
  { id: "Position", label: "Posizione" },
  { id: "Invasion", label: "Invasione" },
  { id: "Invasion_Back", label: "Invasione di seconda linea" },
  { id: "Reconstruction", label: "Ricostruzione" },
  { id: "Generic", label: "Generico" },
  { id: "Red_Card", label: "Cartellino Rosso" }
];
let selectedErrorType = "Generic";
let errorModalPrefillPlayer = null;
const elAttackTrajectoryModal = document.getElementById("attack-trajectory-modal");
const elAttackTrajectoryCanvas = document.getElementById("attack-trajectory-canvas");
const elAttackTrajectoryImage = document.getElementById("attack-trajectory-image");
const elAttackTrajectoryInstructions = document.getElementById("attack-trajectory-instructions");
const elAttackTrajectoryNetpoints = document.getElementById("attack-trajectory-netpoints");
const elAttackTrajectoryClose = document.getElementById("attack-trajectory-close");
const elAttackTrajectoryCloseBtn = document.getElementById("attack-trajectory-close-btn");
const elLineupModal = document.getElementById("lineup-modal");
const elLineupModalCourt = document.getElementById("lineup-modal-court");
const elLineupModalBench = document.getElementById("lineup-modal-bench");
const elLineupModalClose = document.getElementById("lineup-modal-close");
const elLineupModalCancel = document.getElementById("lineup-modal-cancel");
const elLineupModalSaveOverride = document.getElementById("lineup-modal-save-override");
const elLineupModalSaveSubstitution = document.getElementById("lineup-modal-save-substitution");
const elLineupModalTitle = document.getElementById("lineup-modal-title");
const elLineupModalApplyDefault = document.getElementById("lineup-modal-apply-default");
const elLineupModalToggleNumbers = document.getElementById("lineup-modal-toggle-numbers");
const elLineupPreferredLibero = document.getElementById("lineup-preferred-libero");
const elLogServeTrajectory = document.getElementById("log-serve-trajectory");
const elLogServeCardOur = document.getElementById("log-serve-card-our");
const elLogServeCardOpp = document.getElementById("log-serve-card-opp");
const elLogServeCanvasOur = document.getElementById("log-serve-canvas-our");
const elLogServeCanvasOpp = document.getElementById("log-serve-canvas-opp");
const elLogServeNameOur = document.getElementById("log-serve-name-our");
const elLogServeNameOpp = document.getElementById("log-serve-name-opp");
const elLogServeStatsOur = document.getElementById("log-serve-stats-our");
const elLogServeStatsOpp = document.getElementById("log-serve-stats-opp");
const elServeTrajectoryLogToggleInline = document.getElementById("serve-trajectory-log-toggle-inline");
const elServeTrajectoryLogToggleInlineOpp = document.getElementById("serve-trajectory-log-toggle-inline-opp");
const elLiveSetScore = document.getElementById("live-set-score");
const elAggSetScore = document.getElementById("agg-set-score");
const elNextSetInline = document.getElementById("next-set-inline");
const elNextSetClose = document.getElementById("next-set-close");
const elNextSetBlockOur = document.getElementById("next-set-block-our");
const elNextSetBlockOpp = document.getElementById("next-set-block-opp");
const elNextSetTeamOur = document.getElementById("next-set-team-our");
const elNextSetTeamOpp = document.getElementById("next-set-team-opp");
const elNextSetCourtOur = document.getElementById("next-set-court-our");
const elNextSetCourtOpp = document.getElementById("next-set-court-opp");
const elNextSetBenchOur = document.getElementById("next-set-bench-our");
const elNextSetBenchOpp = document.getElementById("next-set-bench-opp");
const elNextSetDefaultOur = document.getElementById("next-set-default-our");
const elNextSetDefaultOpp = document.getElementById("next-set-default-opp");
const elNextSetRotateCwOur = document.getElementById("next-set-rotate-cw-our");
const elNextSetRotateCcwOur = document.getElementById("next-set-rotate-ccw-our");
const elNextSetRotateCwOpp = document.getElementById("next-set-rotate-cw-opp");
const elNextSetRotateCcwOpp = document.getElementById("next-set-rotate-ccw-opp");
const elNextSetRotationSelectOur = document.getElementById("next-set-rotation-select-our");
const elNextSetRotationSelectOpp = document.getElementById("next-set-rotation-select-opp");
const elNextSetSwapRow = document.getElementById("next-set-swap-row");
const elNextSetSides = document.getElementById("next-set-sides");
const elNextSetSideOur = document.getElementById("next-set-side-our");
const elNextSetSideOpp = document.getElementById("next-set-side-opp");
const elNextSetSideOurLabel = document.getElementById("next-set-side-our-label");
const elNextSetSideOppLabel = document.getElementById("next-set-side-opp-label");
const elNextSetSwapCourt = document.getElementById("next-set-swap-court");
const elNextSetServeOur = document.getElementById("next-set-serve-our");
const elNextSetServeOpp = document.getElementById("next-set-serve-opp");
const elNextSetServeOurLabel = document.getElementById("next-set-serve-our-label");
const elNextSetServeOppLabel = document.getElementById("next-set-serve-opp-label");
const elNextSetStart = document.getElementById("next-set-start");
const elNextSetCancel = document.getElementById("next-set-cancel");
const elUseOpponentTeamToggle = document.getElementById("use-opponent-team-toggle");
const elOpponentTeamSettings = document.getElementById("opponent-team-settings");
const elOpponentSkillServe = document.getElementById("opponent-skill-serve");
const elOpponentSkillPass = document.getElementById("opponent-skill-pass");
const elOpponentSkillAttack = document.getElementById("opponent-skill-attack");
const elOpponentSkillDefense = document.getElementById("opponent-skill-defense");
const elOpponentSkillBlock = document.getElementById("opponent-skill-block");
const elOpponentSkillSecond = document.getElementById("opponent-skill-second");
const elAnalysisFilterTeams = document.getElementById("analysis-filter-teams");
const elAnalysisFilterSets = document.getElementById("analysis-filter-sets");
const elAggSummaryExtraBody = document.getElementById("agg-summary-extra-body");
const elVideoFilterTeams = document.getElementById("video-filter-teams");
const elPlayersDbModal = document.getElementById("players-db-modal");
const elPlayersDbBody = document.getElementById("players-db-body");
const elPlayersDbCount = document.getElementById("players-db-count");
const elPlayersDbClose = document.getElementById("players-db-close");
const elPlayersDbClean = document.getElementById("btn-clean-players-db");
const elTeamsManagerModal = document.getElementById("teams-manager-modal");
const elTeamsManagerList = document.getElementById("teams-manager-list");
const elTeamsManagerClose = document.getElementById("teams-manager-close");
const elTeamsManagerDelete = document.getElementById("teams-manager-delete");
const elTeamsManagerDuplicate = document.getElementById("teams-manager-duplicate");
const elTeamsManagerExport = document.getElementById("teams-manager-export");
const elTeamsManagerImport = document.getElementById("teams-manager-import");
const elTeamsManagerFileInput = document.getElementById("teams-manager-file-input");
const elTeamsManagerOpenPlayersDb = document.getElementById("teams-manager-open-players-db");
const elSetStartModal = document.getElementById("set-start-modal");
const elSetStartModalTitle = document.getElementById("set-start-modal-title");
const elSetStartModalBody = document.getElementById("set-start-modal-body");
const elSetStartModalClose = document.getElementById("set-start-modal-close");
const elSetStartModalCancel = document.getElementById("set-start-modal-cancel");
let teamsManagerSelectedName = "";
const courtModalElements = [];
let courtOverlayEl = null;
courtModalElements.push(elSkillModal, elLineupModal, elErrorModal, elPointModal, elAttackTrajectoryModal);
const elServeTypeButtons = document.getElementById("serve-type-buttons");
const SERVE_START_IMG_NEAR = "images/trajectory/service_start_near.png";
const SERVE_START_IMG_FAR = "images/trajectory/service_start_far.png";
const SERVE_END_IMG_NEAR = "images/trajectory/service_end_near.png";
const SERVE_END_IMG_FAR = "images/trajectory/service_end_far.png";
const NORMAL_EVAL_CODES = new Set(["#", "+", "!", "-", "=", "/"]);
const TRAJECTORY_IMG_NEAR = "images/trajectory/attack_empty_near.png";
const TRAJECTORY_IMG_FAR = "images/trajectory/attack_empty_far.png";
const TRAJECTORY_NET_POINTS = [
  // Calcolati dai pixel delle immagini (intersezioni linee bianche su 1080px)
  { id: "5", label: "5", x: 120 / 1080 },
  { id: "7-9", label: "7-9", x: 330 / 1080 },
  { id: "3", label: "3", x: 540 / 1080 },
  { id: "4", label: "4", x: 749.5 / 1080 },
  { id: "6-F", label: "6-F", x: 959 / 1080 }
];
let trajectoryBaseZone = null;
function getTrajectoryImageForZone(zone, isFarSide) {
  if (!zone) return isFarSide ? TRAJECTORY_IMG_FAR : TRAJECTORY_IMG_NEAR;
  if (!isFarSide) {
    if (zone === 4 || zone === 3 || zone === 2) {
      return `images/trajectory/attack_${zone}_near.png`;
    }
    return TRAJECTORY_IMG_NEAR;
  }
  if (zone === 4 || zone === 5) return "images/trajectory/attack_4_far.png";
  if (zone === 3 || zone === 6) return "images/trajectory/attack_3_far.png";
  if (zone === 2 || zone === 1) return "images/trajectory/attack_2_far.png";
  return TRAJECTORY_IMG_FAR;
}
let trajectoryStart = null;
let trajectoryEnd = null;
let trajectoryResolver = null;
let trajectoryDragging = false;
let trajectoryNetPointId = null;
let trajectorySetType = null;
let trajectoryMode = "attack";
let attackTrajectoryForcePopup = false;
let trajectoryMirror = false;
let trajectoryForceFar = false;
let trajectoryEscapeHandler = null;
const attackTrajectoryCourtSizingEls = {
  content: null,
  body: null,
  stage: null
};
function setAttackTrajectoryCourtSizing(isCourt) {
  if (!attackTrajectoryCourtSizingEls.content) {
    attackTrajectoryCourtSizingEls.content = elAttackTrajectoryModal?.querySelector(".attack-trajectory-content") || null;
    attackTrajectoryCourtSizingEls.body = elAttackTrajectoryModal?.querySelector(".attack-trajectory-body") || null;
    attackTrajectoryCourtSizingEls.stage = elAttackTrajectoryModal?.querySelector(".attack-trajectory-stage") || null;
  }
  const { content, body, stage } = attackTrajectoryCourtSizingEls;
  if (isCourt) {
    if (content) {
      content.style.width = "100%";
      content.style.height = "100%";
      content.style.maxHeight = "100%";
      content.style.minHeight = "0";
      content.style.display = "grid";
      content.style.gridTemplateRows = "1fr auto";
      content.style.overflow = "hidden";
    }
    if (body) {
      body.style.flex = "1 1 auto";
      body.style.height = "100%";
      body.style.minHeight = "0";
    }
    if (stage) {
      stage.style.flex = "1 1 auto";
      stage.style.height = "100%";
      stage.style.minHeight = "0";
      stage.style.maxHeight = "100%";
    }
  } else {
    if (content) {
      content.style.width = "";
      content.style.height = "";
      content.style.maxHeight = "";
      content.style.minHeight = "";
      content.style.display = "";
      content.style.gridTemplateRows = "";
      content.style.overflow = "";
    }
    if (body) {
      body.style.flex = "";
      body.style.height = "";
      body.style.minHeight = "";
    }
    if (stage) {
      stage.style.flex = "";
      stage.style.height = "";
      stage.style.minHeight = "";
      stage.style.maxHeight = "";
    }
  }
}
let serveTrajectoryType = "JF";
let serveTypeKeyHandler = null;
let lineupModalCourt = [];
let lineupDragName = "";
let lineupSelectedName = "";
let lineupNumberMode = false;
let lineupModalScope = "our";
let lineupDragFromIdx = null;
let lineupModalDefaultRotation = null;
let lineupModalContext = "match";
let setStartEditSetNum = null;
let setStartModalSetNum = null;
let setStartModalScope = "our";
let nextSetDraft = null;
let nextSetModalOpen = false;
let nextSetDragName = "";
let nextSetDragFromIdx = null;
let nextSetDragScope = null;
let serveTypeInlineHandler = null;
let serveTypeInlinePlayer = null;
let serveTypeFocusPlayer = null;
let attackInlinePlayer = null;
let queuedSetTypeChoice = null;
let activeSkillModalContext = null;
let currentEditControl = null;
let currentEditCell = null;
let lockedCourtAreaHeight = null;
function isDesktopCourtModalLayout() {
  if (state.forceMobileLayout) return false;
  if (document.body && document.body.classList.contains("force-mobile")) return false;
  if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return false;
  return true;
}
function updateCourtModalPlacement() {
  const playersArea = document.querySelector("#court-area") || document.querySelector(".players-area");
  const useCourt = isDesktopCourtModalLayout();
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.toggle("desktop-court-modal", useCourt);
  }
  if (!playersArea) return;
  if (useCourt) {
    if (!courtOverlayEl) {
      courtOverlayEl = document.createElement("div");
      courtOverlayEl.id = "court-overlay";
      playersArea.appendChild(courtOverlayEl);
    } else if (courtOverlayEl.parentElement !== playersArea) {
      playersArea.appendChild(courtOverlayEl);
    }
  }
  courtModalElements.forEach(modal => {
    if (!modal) return;
    if (!modal.__originalParent) {
      modal.__originalParent = modal.parentElement || document.body;
    }
    if (modal.classList.contains("force-popup")) {
      if (modal.__originalParent && modal.parentElement !== modal.__originalParent) {
        modal.__originalParent.appendChild(modal);
      }
      modal.classList.remove("court-modal");
      modal.style.position = "";
      modal.style.inset = "";
      modal.style.width = "";
      modal.style.height = "";
      modal.style.padding = "";
      modal.style.overflow = "";
      return;
    }
    if (useCourt) {
      if (courtOverlayEl && modal.parentElement !== courtOverlayEl) {
        courtOverlayEl.appendChild(modal);
      }
      modal.classList.add("court-modal");
      modal.style.position = "absolute";
      modal.style.inset = "0";
      modal.style.width = "100%";
      modal.style.height = "100%";
      modal.style.padding = "0";
      modal.style.overflow = "hidden";
    } else {
      if (modal.__originalParent && modal.parentElement !== modal.__originalParent) {
        modal.__originalParent.appendChild(modal);
      }
      modal.classList.remove("court-modal");
      modal.style.position = "";
      modal.style.inset = "";
      modal.style.width = "";
      modal.style.height = "";
      modal.style.padding = "";
      modal.style.overflow = "";
    }
  });
}
function restoreModalToPopup(modal) {
  if (!modal) return;
  if (!modal.__originalParent) {
    modal.__originalParent = modal.parentElement || document.body;
  }
  if (modal.__originalParent && modal.parentElement !== modal.__originalParent) {
    modal.__originalParent.appendChild(modal);
  }
  modal.classList.remove("court-modal");
  modal.style.position = "";
  modal.style.inset = "";
  modal.style.width = "";
  modal.style.height = "";
  modal.style.padding = "";
  modal.style.overflow = "";
}
function setCourtAreaLocked(isLocked) {
  const courtArea = document.querySelector("#court-area") || document.querySelector(".players-area");
  if (!courtArea) return;
  if (isLocked) {
    if (lockedCourtAreaHeight === null) {
      const playerEl = courtArea.querySelector("#players-container");
      const actionsEls = Array.from(courtArea.querySelectorAll(".court-actions-bar"));
      const gapValue = window.getComputedStyle(courtArea).gap || "0px";
      const gap = parseFloat(gapValue) || 0;
      const getOuterHeight = el => {
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        const marginTop = parseFloat(styles.marginTop) || 0;
        const marginBottom = parseFloat(styles.marginBottom) || 0;
        return rect.height + marginTop + marginBottom;
      };
      if (playerEl && actionsEls.length) {
        const actionsHeight = actionsEls.reduce((sum, el) => sum + getOuterHeight(el), 0);
        const itemsCount = (playerEl ? 1 : 0) + actionsEls.length;
        const gapCount = Math.max(0, itemsCount - 1);
        lockedCourtAreaHeight = Math.ceil(getOuterHeight(playerEl) + actionsHeight + gap * gapCount);
      } else {
        lockedCourtAreaHeight = courtArea.offsetHeight || null;
      }
    }
    if (lockedCourtAreaHeight) {
      courtArea.style.height = `${lockedCourtAreaHeight}px`;
      courtArea.style.minHeight = `${lockedCourtAreaHeight}px`;
      courtArea.style.maxHeight = `${lockedCourtAreaHeight}px`;
    }
  } else {
    courtArea.style.height = "";
    courtArea.style.minHeight = "";
    courtArea.style.maxHeight = "";
    lockedCourtAreaHeight = null;
  }
}
function setModalOpenState(isOpen, forcePopup = false) {
  const useCourt = isDesktopCourtModalLayout() && !forcePopup;
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.toggle("desktop-court-modal-open", isOpen && useCourt);
  }
  setCourtAreaLocked(isOpen && useCourt);
  if (useCourt) return;
  if (isOpen) {
    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");
  } else {
    document.body.style.overflow = "";
    document.body.classList.remove("modal-open");
  }
}
function isBackRowZone(z) {
  return z === 5 || z === 6 || z === 1;
}
function clamp01(n) {
  if (n == null || isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
function getCourtShape(court) {
  if (typeof ensureCourtShapeFor === "function") return ensureCourtShapeFor(court);
  const shaped = Array.isArray(court) ? court : [];
  return Array.from({ length: 6 }, (_, idx) => {
    const slot = shaped[idx] || {};
    return { main: slot.main || "", replaced: slot.replaced || "" };
  });
}
function cloneCourt(court) {
  if (typeof cloneCourtLineup === "function") return cloneCourtLineup(court);
  return getCourtShape(court).map(slot => ({ main: slot.main, replaced: slot.replaced }));
}
function buildCourtFromNames(names = []) {
  return Array.from({ length: 6 }, (_, idx) => ({ main: names[idx] || "", replaced: "" }));
}
function cloneSetMap(map) {
  return JSON.parse(JSON.stringify(map || {}));
}
function getNextSetEntry(scope) {
  if (!nextSetDraft) return null;
  return scope === "opponent" ? nextSetDraft.opponent : nextSetDraft.our;
}
function updateNextSetEntry(scope, entry) {
  if (!nextSetDraft || !entry) return;
  if (scope === "opponent") {
    nextSetDraft.opponent = entry;
  } else {
    nextSetDraft.our = entry;
  }
}
function setNextSetPlayer(scope, posIdx, name) {
  const entry = getNextSetEntry(scope);
  if (!entry) return;
  const liberos = getLiberosForScope(scope);
  const core = typeof LineupCore !== "undefined" ? LineupCore : null;
  let nextCourt = [];
  if (core && typeof core.setPlayerOnCourt === "function") {
    nextCourt = core.setPlayerOnCourt({
      court: entry.court || [],
      posIdx,
      playerName: name,
      liberos
    });
  } else {
    nextCourt = getCourtShape(entry.court || []).map((slot, idx) => {
      const updated = Object.assign({}, slot);
      if (updated.main === name) updated.main = "";
      if (updated.replaced === name) updated.replaced = "";
      if (idx === posIdx) updated.main = name;
      return updated;
    });
  }
  updateNextSetEntry(scope, Object.assign({}, entry, { court: nextCourt }));
}
function swapNextSetSlots(scope, fromIdx, toIdx) {
  const entry = getNextSetEntry(scope);
  if (!entry) return;
  const core = typeof LineupCore !== "undefined" ? LineupCore : null;
  let nextCourt = [];
  if (core && typeof core.swapCourtSlots === "function") {
    nextCourt = core.swapCourtSlots({
      court: entry.court || [],
      fromIdx,
      toIdx
    });
  } else {
    nextCourt = getCourtShape(entry.court || []);
    const tmp = nextCourt[fromIdx];
    nextCourt[fromIdx] = nextCourt[toIdx];
    nextCourt[toIdx] = tmp;
  }
  updateNextSetEntry(scope, Object.assign({}, entry, { court: nextCourt }));
}
function clearNextSetSlot(scope, posIdx) {
  const entry = getNextSetEntry(scope);
  if (!entry) return;
  const nextCourt = getCourtShape(entry.court || []).map((slot, idx) => {
    if (idx !== posIdx) return slot;
    return { main: "", replaced: "" };
  });
  updateNextSetEntry(scope, Object.assign({}, entry, { court: nextCourt }));
}
function renderNextSetLineup(scope, courtEl, benchEl) {
  if (!courtEl || !benchEl) return;
  const entry = getNextSetEntry(scope);
  if (!entry) return;
  courtEl.innerHTML = "";
  const court = getCourtShape(entry.court || []);
  const numbersMap = getPlayerNumbersForScope(scope);
  const isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  court.forEach((slot, idx) => {
    const card = document.createElement("div");
    card.className = "lineup-slot pos-" + (idx + 1) + (!slot.main ? " empty" : "");
    card.style.gridArea = "pos" + (idx + 1);
    card.dataset.pos = "P" + (idx + 1);
    if (slot.main) {
      card.draggable = true;
      card.addEventListener("dragstart", e => {
        nextSetDragName = slot.main;
        nextSetDragFromIdx = idx;
        nextSetDragScope = scope;
        if (e.dataTransfer) {
          e.dataTransfer.setData("text/plain", slot.main);
          e.dataTransfer.effectAllowed = "move";
        }
      });
      card.addEventListener("dragend", () => {
        nextSetDragName = "";
        nextSetDragFromIdx = null;
        nextSetDragScope = null;
      });
    }
    card.addEventListener("dragover", e => {
      e.preventDefault();
      card.classList.add("drop-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drop-over"));
    card.addEventListener("drop", e => {
      e.preventDefault();
      card.classList.remove("drop-over");
      const name = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || nextSetDragName || "";
      if (!name) return;
      if (nextSetDragScope && nextSetDragScope !== scope) return;
      if (typeof nextSetDragFromIdx === "number" && nextSetDragFromIdx !== idx) {
        swapNextSetSlots(scope, nextSetDragFromIdx, idx);
      } else {
        setNextSetPlayer(scope, idx, name);
      }
      nextSetDragFromIdx = null;
      nextSetDragName = "";
      nextSetDragScope = null;
      renderNextSetLineups();
    });
    card.addEventListener("click", () => {
      if (slot.main) {
        clearNextSetSlot(scope, idx);
        renderNextSetLineups();
      }
    });
    card.addEventListener("touchend", e => {
      if (!nextSetDragName) return;
      if (nextSetDragScope && nextSetDragScope !== scope) return;
      e.preventDefault();
      if (typeof nextSetDragFromIdx === "number" && nextSetDragFromIdx !== idx) {
        swapNextSetSlots(scope, nextSetDragFromIdx, idx);
      } else {
        setNextSetPlayer(scope, idx, nextSetDragName);
      }
      nextSetDragName = "";
      nextSetDragFromIdx = null;
      nextSetDragScope = null;
      renderNextSetLineups();
    });
    const body = document.createElement("div");
    body.className = "slot-body";
    const nameLabel = document.createElement("div");
    nameLabel.className = "slot-name";
    nameLabel.textContent = slot.main ? formatLineupModalName(slot.main, { compactCourt: true }) : "Trascina qui";
    body.appendChild(nameLabel);
    card.appendChild(body);
    courtEl.appendChild(card);
  });
  const benchNames = getBenchForLineupWithRoster(
    court,
    getPlayersForScope(scope),
    getLiberosForScope(scope),
    numbersMap
  );
  benchEl.innerHTML = "";
  if (benchNames.length === 0) {
    const empty = document.createElement("div");
    empty.className = "bench-empty";
    empty.textContent = "Nessuna riserva disponibile.";
    benchEl.appendChild(empty);
  } else {
    benchNames.forEach(name => {
      const chip = document.createElement("div");
      chip.className = "lineup-chip";
      chip.draggable = true;
      chip.dataset.playerName = name;
      chip.addEventListener("dragstart", e => {
        nextSetDragName = name;
        nextSetDragFromIdx = null;
        nextSetDragScope = scope;
        if (e.dataTransfer) {
          e.dataTransfer.setData("text/plain", name);
          e.dataTransfer.effectAllowed = "move";
        }
      });
      chip.addEventListener("dragend", () => {
        nextSetDragName = "";
        nextSetDragFromIdx = null;
        nextSetDragScope = null;
      });
      chip.addEventListener("click", () => {
        const nextEmpty = court.findIndex(slot => !slot.main);
        const targetIdx = nextEmpty !== -1 ? nextEmpty : 0;
        setNextSetPlayer(scope, targetIdx, name);
        renderNextSetLineups();
      });
      chip.addEventListener("touchstart", e => {
        if (!isCoarse) return;
        e.preventDefault();
        nextSetDragName = name;
        nextSetDragScope = scope;
      });
      const span = document.createElement("span");
      span.textContent = formatLineupModalName(name, { compactCourt: true });
      chip.appendChild(span);
      benchEl.appendChild(chip);
    });
  }
}
function renderNextSetLineups() {
  if (!nextSetDraft) return;
  updateNextSetRotationUI();
  renderNextSetLineup("opponent", elNextSetCourtOpp, elNextSetBenchOpp);
  renderNextSetLineup("our", elNextSetCourtOur, elNextSetBenchOur);
  updateNextSetDefaultButtons();
}
function updateNextSetDefaultButtons() {
  if (elNextSetDefaultOur) {
    const defaults = getRawDefaultStartForScope("our");
    const hasLineup = !!defaults;
    elNextSetDefaultOur.disabled = !hasLineup;
  }
  if (elNextSetDefaultOpp) {
    const defaults = getRawDefaultStartForScope("opponent");
    const hasLineup = !!defaults;
    elNextSetDefaultOpp.disabled = !hasLineup;
  }
}
function updateNextSetRotationUI() {
  if (!nextSetDraft) return;
  if (elNextSetRotationSelectOur) {
    elNextSetRotationSelectOur.value = String(nextSetDraft.our && nextSetDraft.our.rotation ? nextSetDraft.our.rotation : 1);
  }
  if (elNextSetRotationSelectOpp) {
    elNextSetRotationSelectOpp.value = String(
      nextSetDraft.opponent && nextSetDraft.opponent.rotation ? nextSetDraft.opponent.rotation : 1
    );
  }
}
function setNextSetRotation(scope, value) {
  if (!nextSetDraft) return;
  const rotation = Math.min(6, Math.max(1, parseInt(value, 10) || 1));
  const entry = getNextSetEntry(scope);
  if (!entry) return;
  updateNextSetEntry(scope, Object.assign({}, entry, { rotation }));
  updateNextSetRotationUI();
}
function rotateNextSetCourt(scope, direction) {
  if (!nextSetDraft) return;
  const entry = getNextSetEntry(scope);
  if (!entry) return;
  const court = getCourtShape(entry.court || []);
  let rotated = [];
  if (direction === "cw") {
    rotated = [court[5], court[0], court[1], court[2], court[3], court[4]];
  } else {
    rotated = [court[1], court[2], court[3], court[4], court[5], court[0]];
  }
  const currentRotation = entry.rotation || 1;
  const rotation = direction === "cw" ? ((currentRotation % 6) + 1) : (currentRotation === 1 ? 6 : currentRotation - 1);
  updateNextSetEntry(scope, Object.assign({}, entry, { court: rotated, rotation }));
  renderNextSetLineups();
}
function getDefaultSetStartForScope(scope = "our") {
  const defaultGetter =
    scope === "opponent" ? getSelectedOpponentTeamDefaultSettings : getSelectedTeamDefaultSettings;
  const defaults = typeof defaultGetter === "function" ? defaultGetter() : null;
  const players = getPlayersForScope(scope);
  const lineup = defaults && defaults.defaultLineup ? defaults.defaultLineup : players;
  const rotation = defaults && defaults.defaultRotation ? defaults.defaultRotation : 1;
  return {
    court: buildCourtFromNames(lineup),
    rotation: rotation
  };
}
function getRawDefaultStartForScope(scope = "our") {
  if (typeof loadTeamFromStorage !== "function" || typeof extractRosterFromTeam !== "function") return null;
  const teamName = scope === "opponent" ? state.selectedOpponentTeam || "" : state.selectedTeam || "";
  if (!teamName) return null;
  const team = scope === "opponent" ? loadOpponentTeamFromStorage(teamName) : loadTeamFromStorage(teamName);
  if (!team) return null;
  const roster = extractRosterFromTeam(team);
  const lineup = Array.isArray(roster.defaultLineup) ? roster.defaultLineup : [];
  const hasLineup = lineup.some(name => (name || "").trim());
  if (!hasLineup) return null;
  const rotation = roster.defaultRotation || 1;
  return { court: buildCourtFromNames(lineup), rotation };
}
function getPreviousSetStart(scope, setNum) {
  if (!state.setStarts || setNum <= 1) return null;
  const prev = state.setStarts[setNum - 1];
  if (!prev) return null;
  const entry = scope === "opponent" ? prev.opponent : prev.our;
  if (!entry) return null;
  return {
    court: cloneCourt(entry.court || []),
    rotation: typeof entry.rotation === "number" ? entry.rotation : 1
  };
}
function computeSetWinner(setNum) {
  if (!setNum) return null;
  const summary = computePointsSummary(setNum, { teamScope: "our" });
  if (!summary) return null;
  if (summary.totalFor === summary.totalAgainst) return null;
  return summary.totalFor > summary.totalAgainst ? "our" : "opponent";
}
function computeSetWinScore() {
  const results = state.setResults || {};
  let totalFor = 0;
  let totalAgainst = 0;
  Object.keys(results).forEach(key => {
    const winner = results[key];
    if (winner === "our") totalFor += 1;
    if (winner === "opponent") totalAgainst += 1;
  });
  return { for: totalFor, against: totalAgainst };
}
function updateSetScoreDisplays() {
  const score = computeSetWinScore();
  const label = score.for + " - " + score.against;
  if (elLiveSetScore) elLiveSetScore.textContent = label;
  if (elAggSetScore) elAggSetScore.textContent = label;
}
function buildNextSetDraft(setNum) {
  const nextSet = Math.min(5, Math.max(1, setNum || 1));
  const baseOurCourt =
    typeof removeLiberosAndRestoreForScope === "function"
      ? removeLiberosAndRestoreForScope(state.court || [], "our")
      : cloneCourt(state.court || []);
  const baseOppCourt =
    typeof removeLiberosAndRestoreForScope === "function"
      ? removeLiberosAndRestoreForScope(state.opponentCourt || [], "opponent")
      : cloneCourt(state.opponentCourt || []);
  const our = {
    court: cloneCourt(baseOurCourt),
    rotation: state.rotation || 1
  };
  const opponent = {
    court: cloneCourt(baseOppCourt),
    rotation: state.opponentRotation || 1
  };
  const serveDefault = !!state.isServing;
  return {
    setNum: nextSet,
    our,
    opponent,
    swapCourt: nextSet > 1,
    isServing: serveDefault
  };
}
function openNextSetLineupModal(scope = "our") {
  if (!nextSetDraft) return;
  lineupModalContext = "next-set";
  lineupModalScope = scope === "opponent" ? "opponent" : "our";
  const entry = lineupModalScope === "opponent" ? nextSetDraft.opponent : nextSetDraft.our;
  lineupModalCourt = cloneCourt((entry && entry.court) || []);
  lineupModalDefaultRotation = entry && typeof entry.rotation === "number" ? entry.rotation : null;
  lineupDragName = "";
  lineupSelectedName = "";
  lineupNumberMode = false;
  renderLineupModal();
  updateLineupModalControls();
  if (elLineupModal) {
    if (isDesktopCourtModalLayout()) {
      setCourtAreaLocked(true);
    }
    updateCourtModalPlacement();
    elLineupModal.classList.remove("hidden");
    setModalOpenState(true);
  }
}
function openNextSetModal(setNum) {
  if (!elNextSetInline) return;
  const activeTab = document && document.body ? document.body.dataset.activeTab : "";
  if (activeTab !== "scout") return;
  nextSetDraft = buildNextSetDraft(setNum);
  if (elNextSetServeOurLabel) {
    elNextSetServeOurLabel.textContent = getTeamNameForScope("our");
  }
  if (elNextSetServeOppLabel) {
    elNextSetServeOppLabel.textContent = getTeamNameForScope("opponent");
  }
  if (elNextSetSideOurLabel) {
    elNextSetSideOurLabel.textContent = getTeamNameForScope("our");
  }
  if (elNextSetSideOppLabel) {
    elNextSetSideOppLabel.textContent = getTeamNameForScope("opponent");
  }
  if (elNextSetTeamOur) {
    elNextSetTeamOur.textContent = getTeamNameForScope("our");
  }
  if (elNextSetTeamOpp) {
    elNextSetTeamOpp.textContent = getTeamNameForScope("opponent");
  }
  if (elNextSetSwapCourt) {
    elNextSetSwapCourt.checked = !!nextSetDraft.swapCourt;
    elNextSetSwapCourt.disabled = false;
  }
  if (elNextSetServeOur) elNextSetServeOur.checked = !!nextSetDraft.isServing;
  if (elNextSetServeOpp) elNextSetServeOpp.checked = !nextSetDraft.isServing;
  if (elNextSetBlockOpp) {
    elNextSetBlockOpp.classList.toggle("hidden", !state.useOpponentTeam);
  }
  const isFirstSet = nextSetDraft.setNum === 1;
  if (elNextSetSwapRow) elNextSetSwapRow.classList.toggle("hidden", isFirstSet);
  if (elNextSetSides) elNextSetSides.classList.toggle("hidden", !isFirstSet);
  if (elNextSetSideOur) elNextSetSideOur.checked = !nextSetDraft.swapCourt;
  if (elNextSetSideOpp) elNextSetSideOpp.checked = !!nextSetDraft.swapCourt;
  if (elNextSetCancel) elNextSetCancel.classList.toggle("hidden", isFirstSet);
  if (elNextSetClose) elNextSetClose.classList.toggle("hidden", isFirstSet);
  const title = document.getElementById("next-set-title");
  if (title) title.textContent = "Preparazione set " + nextSetDraft.setNum;
  elNextSetInline.classList.remove("hidden");
  elNextSetInline.setAttribute("aria-hidden", "false");
  nextSetModalOpen = true;
  setScoutControlsDisabled(true);
  const courtArea = document.getElementById("court-area");
  if (courtArea) {
    courtArea.classList.add("court-area--next-set");
  }
  renderNextSetLineups();
}
function closeNextSetModal({ force = false } = {}) {
  if (!elNextSetInline) return;
  if (!force && nextSetDraft && nextSetDraft.setNum === 1) return;
  elNextSetInline.classList.add("hidden");
  elNextSetInline.setAttribute("aria-hidden", "true");
  nextSetDraft = null;
  nextSetModalOpen = false;
  setScoutControlsDisabled(!!state.matchFinished);
  nextSetDragName = "";
  nextSetDragFromIdx = null;
  nextSetDragScope = null;
  const courtArea = document.getElementById("court-area");
  if (courtArea) {
    courtArea.classList.remove("court-area--next-set");
  }
}
function applyNextSetDraft() {
  if (!nextSetDraft) return;
  const prevSet = state.currentSet || 1;
  const nextSet = nextSetDraft.setNum || prevSet;
  const prevSetResults = cloneSetMap(state.setResults);
  const prevSetStarts = cloneSetMap(state.setStarts);
  const nextSetResults = cloneSetMap(prevSetResults);
  if (nextSet > 1 && !nextSetResults[prevSet]) {
    const winner = computeSetWinner(prevSet);
    if (winner) nextSetResults[prevSet] = winner;
  }
  const nextSetStarts = cloneSetMap(prevSetStarts);
  const ourRotation =
    typeof nextSetDraft.our.rotation === "number"
      ? nextSetDraft.our.rotation
      : state.rotation || 1;
  const oppRotation =
    typeof nextSetDraft.opponent.rotation === "number"
      ? nextSetDraft.opponent.rotation
      : state.opponentRotation || 1;
  nextSetStarts[nextSet] = {
    our: { court: cloneCourt(nextSetDraft.our.court || []), rotation: ourRotation },
    opponent: { court: cloneCourt(nextSetDraft.opponent.court || []), rotation: oppRotation },
    swapCourt: !!nextSetDraft.swapCourt,
    isServing: !!nextSetDraft.isServing
  };
  state.setResults = nextSetResults;
  state.setStarts = nextSetStarts;
  state.courtSideSwapped = !!nextSetDraft.swapCourt;
  syncCourtSideLayout();
  if (typeof commitCourtChange === "function") {
    commitCourtChange(cloneCourt(nextSetDraft.our.court || []), { clean: true });
  } else {
    state.court = cloneCourt(nextSetDraft.our.court || []);
  }
  if (state.useOpponentTeam) {
    if (typeof commitCourtChangeForScope === "function") {
      commitCourtChangeForScope(cloneCourt(nextSetDraft.opponent.court || []), "opponent");
    } else {
      state.opponentCourt = cloneCourt(nextSetDraft.opponent.court || []);
    }
  }
  if (typeof setRotation === "function") {
    setRotation(ourRotation);
  } else {
    state.rotation = ourRotation;
  }
  if (state.useOpponentTeam) {
    if (typeof setOpponentRotation === "function") {
      setOpponentRotation(oppRotation);
    } else {
      state.opponentRotation = oppRotation;
    }
  }
  if (typeof setIsServing === "function") {
    setIsServing(!!nextSetDraft.isServing);
  } else {
    state.isServing = !!nextSetDraft.isServing;
  }
  if (nextSet !== prevSet) {
    applySetChange(nextSet, {
      prevSet,
      nextSet,
      prevFinished: !!state.matchFinished,
      nextFinished: false,
      actionType: "set-change",
      prevSetResults,
      nextSetResults,
      prevSetStarts,
      nextSetStarts
    });
  } else {
    state.matchFinished = false;
    saveState({ persistLocal: true });
    renderEventsLog();
    renderLiveScore();
    updateMatchStatusUI();
  }
  renderPlayers();
  renderBenchChips();
  renderLineupChips();
  if (state.useOpponentTeam) {
    renderOpponentPlayers();
  }
  updateSetScoreDisplays();
  closeNextSetModal({ force: true });
}
function shouldOpenNextSetModal() {
  const hasEvents = state.events && state.events.length > 0;
  const currentSet = state.currentSet || 1;
  const hasStart = state.setStarts && state.setStarts[currentSet];
  const activeTab = document && document.body ? document.body.dataset.activeTab : "";
  return activeTab === "scout" && !hasEvents && !hasStart;
}
function getLineupModalPlayers() {
  return lineupModalScope === "opponent" ? state.opponentPlayers || [] : state.players || [];
}
function getLineupModalLiberos() {
  return lineupModalScope === "opponent" ? state.opponentLiberos || [] : state.liberos || [];
}
function getLineupModalNumbers() {
  return lineupModalScope === "opponent" ? state.opponentPlayerNumbers || {} : state.playerNumbers || {};
}
function getLineupModalPreferredLibero() {
  if (typeof getTeamPreferredLibero === "function") {
    return getTeamPreferredLibero(lineupModalScope);
  }
  return lineupModalScope === "opponent" ? state.opponentPreferredLibero || "" : state.preferredLibero || "";
}
function setLineupModalPreferredLibero(name) {
  if (typeof setTeamPreferredLibero === "function") {
    setTeamPreferredLibero(lineupModalScope, name);
  } else if (lineupModalScope === "opponent") {
    state.opponentPreferredLibero = name || "";
  } else {
    state.preferredLibero = name || "";
  }
}
function syncLineupPreferredLiberoSelect() {
  if (!elLineupPreferredLibero) return;
  const liberos = getLineupModalLiberos();
  const numbers = getLineupModalNumbers();
  const preferred = getLineupModalPreferredLibero();
  const ordered = typeof sortNamesByNumber === "function" ? sortNamesByNumber(liberos, numbers) : liberos.slice();
  elLineupPreferredLibero.innerHTML = "";
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "-";
  elLineupPreferredLibero.appendChild(emptyOpt);
  ordered.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent =
      lineupModalScope === "opponent"
        ? formatNameWithNumberFor(name, numbers)
        : formatNameWithNumber(name);
    elLineupPreferredLibero.appendChild(opt);
  });
  elLineupPreferredLibero.value = preferred && ordered.includes(preferred) ? preferred : "";
  elLineupPreferredLibero.disabled = ordered.length === 0;
  if (!elLineupPreferredLibero._preferredBound) {
    elLineupPreferredLibero.addEventListener("change", () => {
      const next = elLineupPreferredLibero.value || "";
      setLineupModalPreferredLibero(next);
      saveState();
      if (typeof renderLiberoChipsInline === "function") {
        renderLiberoChipsInline();
      }
      if (typeof renderOpponentLiberoChipsInline === "function") {
        renderOpponentLiberoChipsInline();
      }
    });
    elLineupPreferredLibero._preferredBound = true;
  }
}
function formatLineupModalName(name, options = {}) {
  return formatNameWithNumber(name, options);
}
function getBenchForLineupWithRoster(court, rosterNames, liberos, numbersMap) {
  const libSet = new Set(liberos || []);
  const used = new Set();
  getCourtShape(court).forEach(slot => {
    const name = slot.main || "";
    if (name) used.add(name);
  });
  const bench = (rosterNames || []).filter(name => name && !libSet.has(name) && !used.has(name));
  if (typeof sortNamesByNumber === "function") {
    return sortNamesByNumber(bench, numbersMap || {});
  }
  return bench;
}
function updateLineupModalControls() {
  const isNextSet = lineupModalContext === "next-set";
  const isSetStartEdit = lineupModalContext === "set-start";
    if (elLineupModalSaveOverride) {
      elLineupModalSaveOverride.classList.remove("hidden");
      elLineupModalSaveOverride.textContent = isNextSet ? "Salva formazione" : "Metti in campo (Override)";
    }
  if (elLineupModalSaveSubstitution) {
    elLineupModalSaveSubstitution.classList.toggle("hidden", isNextSet);
  }
  if (elLineupModalTitle) {
    elLineupModalTitle.textContent =
      lineupModalScope === "opponent" ? "Imposta formazione avversaria" : "Imposta formazione";
  }
  if (elLineupModalToggleNumbers) {
    elLineupModalToggleNumbers.textContent = lineupNumberMode ? "Esci modalità numeri" : "Modalità numeri";
  }
}
function applyDefaultLineupToModal() {
  const teamName = lineupModalScope === "opponent" ? state.selectedOpponentTeam || "" : state.selectedTeam || "";
  if (!teamName) {
    alert("Seleziona prima una squadra.");
    return;
  }
  if (typeof loadTeamFromStorage !== "function" || typeof extractRosterFromTeam !== "function") {
    alert("Funzioni squadra non disponibili.");
    return;
  }
  const team = loadTeamFromStorage(teamName);
  if (!team) {
    alert("Squadra non trovata o corrotta.");
    return;
  }
  const roster = extractRosterFromTeam(team);
  const fallback = roster.playersDetailed && roster.playersDetailed.length > 0
    ? roster.playersDetailed.filter(p => !p.out).map(p => p.name)
    : roster.players || [];
  const names =
    roster.defaultLineup && roster.defaultLineup.length > 0 ? roster.defaultLineup : fallback;
  lineupModalCourt = Array.from({ length: 6 }, (_, idx) => ({ main: names[idx] || "", replaced: "" }));
  lineupModalDefaultRotation = roster.defaultRotation || 1;
  renderLineupModal();
}
function applyNumberToLineupSlot(slotIdx, rawValue) {
  const value = (rawValue || "").trim();
  if (!value) return false;
  const players = getLineupModalPlayers();
  const numbers = getLineupModalNumbers();
  const matchName = players.find(name => numbers[name] === value);
  if (!matchName) return false;
  assignPlayerToLineup(matchName, slotIdx);
  return true;
}
function focusLineupNumberInput(slotIdx) {
  const input = elLineupModalCourt
    ? elLineupModalCourt.querySelector(`.lineup-number-input[data-slot-index="${slotIdx}"]`)
    : null;
  if (input) {
    input.focus();
    input.select();
  }
}
function exitLineupNumberMode() {
  lineupNumberMode = false;
  renderLineupModal();
}
function getSortedPlayerEntries() {
  const players = state.players || [];
  const numbers = state.playerNumbers || {};
  const names = typeof sortNamesByNumber === "function" ? sortNamesByNumber(players, numbers) : players.slice();
  const idxMap = new Map(players.map((name, idx) => [name, idx]));
  return names
    .map(name => ({ name, idx: idxMap.get(name) }))
    .filter(entry => typeof entry.idx === "number");
}
function getSortedPlayerEntriesForScope(scope) {
  const players = getPlayersForScope(scope);
  const numbers = getPlayerNumbersForScope(scope);
  const names = typeof sortNamesByNumber === "function" ? sortNamesByNumber(players, numbers) : players.slice();
  const idxMap = new Map(players.map((name, idx) => [name, idx]));
  return names
    .map(name => ({ name, idx: idxMap.get(name) }))
    .filter(entry => typeof entry.idx === "number");
}
function sortPlayerOptionsByNumber(options) {
  const players = state.players || [];
  const numbers = state.playerNumbers || {};
  const getNum = idx => {
    const name = players[idx];
    if (!name) return null;
    const raw = numbers[name];
    const parsed = raw !== undefined && raw !== null && raw !== "" ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  return options.slice().sort((a, b) => {
    const idxA = Number(a.value);
    const idxB = Number(b.value);
    const numA = getNum(idxA);
    const numB = getNum(idxB);
    if (numA === null && numB === null) {
      return String(a.label || "").localeCompare(String(b.label || ""), "it", { sensitivity: "base" });
    }
    if (numA === null) return 1;
    if (numB === null) return -1;
    if (numA !== numB) return numA - numB;
    return String(a.label || "").localeCompare(String(b.label || ""), "it", { sensitivity: "base" });
  });
}
function sortPlayerOptionsByNumberForScope(options, scope) {
  const players = getPlayersForScope(scope);
  const numbers = getPlayerNumbersForScope(scope);
  const getNum = idx => {
    const name = players[idx];
    if (!name) return null;
    const raw = numbers[name];
    const parsed = raw !== undefined && raw !== null && raw !== "" ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  return options.slice().sort((a, b) => {
    const idxA = Number(a.value);
    const idxB = Number(b.value);
    const numA = getNum(idxA);
    const numB = getNum(idxB);
    if (numA === null && numB === null) {
      return String(a.label || "").localeCompare(String(b.label || ""), "it", { sensitivity: "base" });
    }
    if (numA === null) return 1;
    if (numB === null) return -1;
    if (numA !== numB) return numA - numB;
    return String(a.label || "").localeCompare(String(b.label || ""), "it", { sensitivity: "base" });
  });
}
function sortPlayerIndexesByNumber(indices) {
  const players = state.players || [];
  const numbers = state.playerNumbers || {};
  const getNum = idx => {
    const name = players[idx];
    if (!name) return null;
    const raw = numbers[name];
    const parsed = raw !== undefined && raw !== null && raw !== "" ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  return indices.slice().sort((a, b) => {
    const numA = getNum(a);
    const numB = getNum(b);
    if (numA === null && numB === null) return a - b;
    if (numA === null) return 1;
    if (numB === null) return -1;
    if (numA !== numB) return numA - numB;
    return a - b;
  });
}
function sortPlayerIndexesByNumberForScope(indices, scope) {
  const players = getPlayersForScope(scope);
  const numbers = getPlayerNumbersForScope(scope);
  const getNum = idx => {
    const name = players[idx];
    if (!name) return null;
    const raw = numbers[name];
    const parsed = raw !== undefined && raw !== null && raw !== "" ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  return indices.slice().sort((a, b) => {
    const numA = getNum(a);
    const numB = getNum(b);
    if (numA === null && numB === null) return a - b;
    if (numA === null) return 1;
    if (numB === null) return -1;
    if (numA !== numB) return numA - numB;
    return a - b;
  });
}
function setServeTypeSelection(type) {
  const t = (type || "").toUpperCase();
  const normalized = t === "F" || t === "S" ? t : "JF";
  serveTrajectoryType = normalized;
  if (!elServeTypeButtons) return;
  const btns = elServeTypeButtons.querySelectorAll("[data-serve-type]");
  btns.forEach(btn => {
    const isActive = (btn.dataset.serveType || "").toUpperCase() === normalized;
    btn.classList.toggle("active", isActive);
  });
}
if (elServeTypeButtons) {
  elServeTypeButtons.addEventListener("click", e => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const type = (target.dataset.serveType || "").toUpperCase();
    if (!type) return;
    setServeTypeSelection(type);
  });
  setServeTypeSelection("JF");
}
function bindServeTypeInlineListener(playerIdx, onSelect, scope = "our") {
  const key = makePlayerKey(scope, playerIdx);
  serveTypeSelectHandlers[key] = onSelect;
  if (serveTypeInlineHandler) return;
  serveTypeInlineHandler = e => {
    const key = (e.key || "").toUpperCase();
    if (key !== "F" && key !== "J" && key !== "S") return;
    const activePlayer =
      serveTypeInlinePlayer !== null ? serveTypeInlinePlayer : serveTypeFocusPlayer;
    if (activePlayer === null || activePlayer === undefined) return;
    const handler = serveTypeSelectHandlers[activePlayer];
    if (typeof handler === "function") {
      handler(key === "J" ? "JF" : key);
    }
  };
  window.addEventListener("keydown", serveTypeInlineHandler);
}
function setServeTypeFocusPlayer(playerIdx, scope = "our") {
  serveTypeFocusPlayer = makePlayerKey(scope, playerIdx);
}
function removeServeTypeInlineKeyListener() {
  if (serveTypeInlineHandler) {
    window.removeEventListener("keydown", serveTypeInlineHandler);
    serveTypeInlineHandler = null;
  }
}
function clearServeTypeInlineListener() {
  removeServeTypeInlineKeyListener();
  serveTypeInlinePlayer = null;
  serveTypeFocusPlayer = null;
  Object.keys(serveTypeSelectHandlers).forEach(key => {
    delete serveTypeSelectHandlers[key];
  });
}
function clearAttackSelection(playerIdx = null, scope = "our") {
  if (playerIdx === null || playerIdx === undefined) {
    attackInlinePlayer = null;
    Object.keys(attackMetaByPlayer).forEach(key => {
      delete attackMetaByPlayer[key];
    });
    return;
  }
  const key = makePlayerKey(scope, playerIdx);
  delete attackMetaByPlayer[key];
  if (attackInlinePlayer === key) {
    attackInlinePlayer = null;
  }
}
function shouldPromptAttackSetType(scope = "our") {
  const enabled =
    scope === "opponent" ? state.opponentSetTypePromptEnabled : state.setTypePromptEnabled;
  return !!enabled;
}
function applyAttackTrajectoryToEvent(event, payload) {
  if (!payload || !event) return;
  event.attackStart = payload.start || event.attackStart || null;
  event.attackEnd = payload.end || event.attackEnd || null;
  event.attackStartZone = payload.startZone || event.attackStartZone || null;
  event.attackEndZone = payload.endZone || event.attackEndZone || null;
  event.attackDirection = payload;
  event.attackTrajectory = payload;
  if (!event.originZone) {
    event.originZone = event.attackStartZone || event.originZone || null;
  }
  if (event.attackStartZone) {
    event.zone = event.attackStartZone;
    event.playerPosition = event.attackStartZone;
  }
}
async function startAttackSelection(playerIdx, setTypeChoice, onDone, scope = "our") {
  const key = makePlayerKey(scope, playerIdx);
  if (
    attackInlinePlayer !== null &&
    attackInlinePlayer !== key &&
    isPlayerKeyInScope(attackInlinePlayer, scope)
  ) {
    return;
  }
  attackInlinePlayer = key;
  const meta = { setType: setTypeChoice || null, playerIdx, scope };
  if (state.videoScoutMode) {
    const videoTime = getActiveVideoPlaybackSeconds();
    if (typeof videoTime === "number") meta.videoTime = videoTime;
  }
  const trajectoryEnabled =
    scope === "opponent" ? state.opponentAttackTrajectoryEnabled : state.attackTrajectoryEnabled;
  if (trajectoryEnabled) {
    const baseZone = getCurrentZoneForPlayer(playerIdx, "attack", scope);
    const forceFar = isFarSideForScope(scope);
    const coords = await openAttackTrajectoryModal({
      baseZone: baseZone || null,
      setType: setTypeChoice || null,
      forceFar,
      scope
    });
    if (coords) {
      meta.trajectory = coords;
      meta.trajectorySkipped = false;
    } else {
      meta.trajectorySkipped = true;
    }
  }
  attackMetaByPlayer[key] = meta;
  if (typeof onDone === "function") {
    onDone();
  }
}
function getServeBaseZoneForPlayer(playerIdx, scope = "our") {
  const players = getPlayersForScope(scope);
  if (typeof playerIdx !== "number" || !players || !players[playerIdx]) return null;
  const name = players[playerIdx];
  const baseCourt = getServeDisplayCourt(scope);
  if (!baseCourt || !baseCourt.length) return null;
  const slotIdx = baseCourt.findIndex(slot => slot && slot.main === name);
  return slotIdx === -1 ? null : slotIdx + 1;
}
function maybeRotateServeToZoneOne(playerIdx, scope = "our") {
  // disabilitato: la battuta è consentita solo alla giocatrice in zona 1
}
async function startServeTypeSelection(playerIdx, type, onDone, scope = "our") {
  const key = makePlayerKey(scope, playerIdx);
  if (serveTypeInlinePlayer !== null && serveTypeInlinePlayer !== key) return;
  serveTypeInlinePlayer = key;
  setServeTypeFocusPlayer(playerIdx, scope);
  removeServeTypeInlineKeyListener();
  const zone = getServeBaseZoneForPlayer(playerIdx, scope);
  if (zone !== 1) {
    serveTypeInlinePlayer = null;
    return;
  }
  const meta = { serveType: type };
  if (state.videoScoutMode) {
    const videoTime = getActiveVideoPlaybackSeconds();
    if (typeof videoTime === "number") meta.videoTime = videoTime;
  }
  const serveTrajEnabled =
    scope === "opponent" ? state.opponentServeTrajectoryEnabled : state.serveTrajectoryEnabled;
  if (serveTrajEnabled) {
    const forceFar = isFarSideForScope(scope);
    const traj = await collectServeTrajectory(Object.assign({}, meta, { forceFar, scope }));
    meta.serveType = traj.serveType || type;
    meta.serveStart = traj.serveStart || null;
    meta.serveEnd = traj.serveEnd || null;
  }
  const shouldQueueServe = state.useOpponentTeam && state.predictiveSkillFlow;
  if (shouldQueueServe) {
    const players = getPlayersForScope(scope);
    const fallbackServer = getServerPlayerForScope(scope);
    state.pendingServe = {
      scope,
      playerIdx,
      playerName: players[playerIdx] || (fallbackServer && fallbackServer.name) || null,
      meta
    };
    clearServeTypeInlineListener();
    if (state.forceSkillActive && state.forceSkillScope === scope) {
      state.forceSkillActive = false;
      state.forceSkillScope = null;
      if (scope === "opponent") {
        state.opponentSkillFlowOverride = null;
      } else {
        state.skillFlowOverride = null;
      }
    }
    state.flowTeamScope = getOppositeScope(scope);
    setSelectedSkillForScope(scope, playerIdx, null);
    delete serveMetaByPlayer[key];
  } else {
    serveMetaByPlayer[key] = meta;
  }
  if (typeof onDone === "function") {
    onDone();
  }
}
async function collectServeTrajectory(prefill = {}) {
  const startRes = await openAttackTrajectoryModal({
    mode: "serve-start",
    start: prefill.serveStart || null,
    serveType: prefill.serveType || null,
    forceFar: prefill.forceFar,
    scope: prefill.scope
  });
  const serveType = (startRes && startRes.serveType) || prefill.serveType || "JF";
  const serveStart = startRes && startRes.point ? startRes.point : prefill.serveStart || null;
  const endRes = await openAttackTrajectoryModal({
    mode: "serve-end",
    end: prefill.serveEnd || null,
    forceFar: prefill.forceFar,
    scope: prefill.scope
  });
  const serveEnd = endRes && endRes.point ? endRes.point : prefill.serveEnd || null;
  return { serveType, serveStart, serveEnd };
}
function getBenchForLineup(court) {
  const libSet = new Set(state.liberos || []);
  const used = new Set();
  getCourtShape(court).forEach(slot => {
    const name = slot.main || "";
    if (name) used.add(name);
  });
  const bench = (state.players || []).filter(name => name && !libSet.has(name) && !used.has(name));
  if (typeof sortNamesByNumber === "function") {
    return sortNamesByNumber(bench, state.playerNumbers || {});
  }
  return bench;
}
function getLineupBaseCourtFromState() {
  const libSet = new Set(getLineupModalLiberos());
  const baseCourt =
    lineupModalScope === "opponent" ? state.opponentCourt || [] : state.court;
  return getCourtShape(baseCourt).map(slot => {
    if (libSet.has(slot.main)) {
      return { main: slot.replaced || "", replaced: "" };
    }
    return { main: slot.main || "", replaced: "" };
  });
}
function getLineupSubstitutions(prevCourt, nextCourt) {
  const libSet = new Set(state.liberos || []);
  const subs = [];
  for (let i = 0; i < 6; i += 1) {
    const prevName = (prevCourt[i] && prevCourt[i].main) || "";
    const nextName = (nextCourt[i] && nextCourt[i].main) || "";
    if (!prevName || !nextName || prevName === nextName) continue;
    if (libSet.has(prevName) || libSet.has(nextName)) continue;
    subs.push({ playerIn: nextName, playerOut: prevName });
  }
  return subs;
}
function assignPlayerToLineup(name, posIdx) {
  const core = typeof LineupCore !== "undefined" ? LineupCore : null;
  if (core && typeof core.setPlayerOnCourt === "function") {
    lineupModalCourt = core.setPlayerOnCourt({
      court: lineupModalCourt,
      posIdx,
      playerName: name,
      liberos: getLineupModalLiberos()
    });
  } else {
    lineupModalCourt = getCourtShape(lineupModalCourt).map((slot, idx) => {
      const updated = Object.assign({}, slot);
      if (updated.main === name) updated.main = "";
      if (updated.replaced === name) updated.replaced = "";
      if (idx === posIdx) updated.main = name;
      return updated;
    });
  }
}
function swapLineupSlots(fromIdx, toIdx) {
  const core = typeof LineupCore !== "undefined" ? LineupCore : null;
  if (core && typeof core.swapCourtSlots === "function") {
    lineupModalCourt = core.swapCourtSlots({
      court: lineupModalCourt,
      fromIdx,
      toIdx
    });
    return;
  }
  const court = getCourtShape(lineupModalCourt);
  const next = court.map(slot => Object.assign({}, slot));
  const tmp = next[fromIdx];
  next[fromIdx] = next[toIdx];
  next[toIdx] = tmp;
  lineupModalCourt = next;
}
function clearLineupSlot(posIdx) {
  const core = typeof LineupCore !== "undefined" ? LineupCore : null;
  if (core && typeof core.clearCourtSlot === "function") {
    lineupModalCourt = core.clearCourtSlot({
      court: lineupModalCourt,
      posIdx,
      liberos: getLineupModalLiberos()
    });
  } else {
    lineupModalCourt = getCourtShape(lineupModalCourt).map((slot, idx) =>
      idx === posIdx ? { main: "", replaced: "" } : slot
    );
  }
}
function renderLineupModal() {
  if (!elLineupModalCourt || !elLineupModalBench) return;
  elLineupModalCourt.innerHTML = "";
  syncLineupPreferredLiberoSelect();
  const court = getCourtShape(lineupModalCourt);
  const numbersMap = getLineupModalNumbers();
  const isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  court.forEach((slot, idx) => {
    const areaClass = "pos-" + (idx + 1);
    const card = document.createElement("div");
    card.className = "lineup-slot " + areaClass + (!slot.main ? " empty" : "");
    card.style.gridArea = "pos" + (idx + 1);
    card.dataset.pos = "P" + (idx + 1);
    if (slot.main) {
      card.draggable = true;
      card.addEventListener("dragstart", e => {
        lineupDragName = slot.main;
        lineupDragFromIdx = idx;
        if (e.dataTransfer) {
          e.dataTransfer.setData("text/plain", slot.main);
          e.dataTransfer.effectAllowed = "move";
        }
      });
      card.addEventListener("dragend", () => {
        lineupDragName = "";
        lineupDragFromIdx = null;
      });
    }
    card.addEventListener("dragover", e => {
      e.preventDefault();
      card.classList.add("drop-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drop-over"));
    card.addEventListener("drop", e => {
      e.preventDefault();
      card.classList.remove("drop-over");
      const name = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || lineupDragName || "";
      if (name) {
        if (typeof lineupDragFromIdx === "number" && lineupDragFromIdx !== idx) {
          swapLineupSlots(lineupDragFromIdx, idx);
        } else {
          assignPlayerToLineup(name, idx);
        }
        lineupDragFromIdx = null;
        lineupDragName = "";
        renderLineupModal();
      }
    });
    card.addEventListener("click", () => {
      if (lineupNumberMode) return;
      if (lineupSelectedName) {
        assignPlayerToLineup(lineupSelectedName, idx);
        lineupSelectedName = "";
        renderLineupModal();
        return;
      }
      if (slot.main) {
        clearLineupSlot(idx);
        renderLineupModal();
      }
    });
    card.addEventListener("touchend", e => {
      if (!lineupDragName) return;
      e.preventDefault();
      if (typeof lineupDragFromIdx === "number" && lineupDragFromIdx !== idx) {
        swapLineupSlots(lineupDragFromIdx, idx);
      } else {
        assignPlayerToLineup(lineupDragName, idx);
      }
      lineupDragName = "";
      lineupDragFromIdx = null;
      lineupSelectedName = "";
      renderLineupModal();
    });
    const head = document.createElement("div");
    head.className = "slot-head";
    const label = document.createElement("span");
    label.textContent = "Pos " + (idx + 1);
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "secondary small slot-clear";
    clearBtn.textContent = "✕";
    clearBtn.addEventListener("click", () => {
      clearLineupSlot(idx);
      renderLineupModal();
    });
    head.appendChild(label);
    head.appendChild(clearBtn);
    const body = document.createElement("div");
    body.className = "slot-body";
    if (lineupNumberMode) {
      const numInput = document.createElement("input");
      numInput.type = "text";
      numInput.inputMode = "numeric";
      numInput.className = "lineup-number-input";
      numInput.dataset.slotIndex = String(idx);
      numInput.value = (numbersMap[slot.main] || "").trim();
      numInput.addEventListener("focus", () => numInput.select());
      numInput.addEventListener("click", e => {
        e.stopPropagation();
        numInput.select();
      });
      numInput.addEventListener("keydown", e => {
        if (e.key === "Tab") {
          e.preventDefault();
          applyNumberToLineupSlot(idx, numInput.value);
          const next = (idx + (e.shiftKey ? 5 : 1)) % 6;
          renderLineupModal();
          focusLineupNumberInput(next);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          applyNumberToLineupSlot(idx, numInput.value);
          exitLineupNumberMode();
        }
      });
      body.appendChild(numInput);
    } else {
      const nameLabel = document.createElement("div");
      nameLabel.className = "slot-name";
      nameLabel.textContent = slot.main ? formatLineupModalName(slot.main, { compactCourt: true }) : "Trascina qui";
      body.appendChild(nameLabel);
    }
    card.appendChild(head);
    card.appendChild(body);
    elLineupModalCourt.appendChild(card);
  });
  const benchNames = getBenchForLineupWithRoster(
    court,
    getLineupModalPlayers(),
    getLineupModalLiberos(),
    getLineupModalNumbers()
  );
  elLineupModalBench.innerHTML = "";
  if (benchNames.length === 0) {
    const empty = document.createElement("div");
    empty.className = "bench-empty";
    empty.textContent = "Nessuna riserva disponibile.";
    elLineupModalBench.appendChild(empty);
  } else {
    benchNames.forEach(name => {
      const chip = document.createElement("div");
      chip.className = "lineup-chip" + (lineupSelectedName === name ? " selected" : "");
      chip.draggable = true;
      chip.dataset.playerName = name;
      chip.addEventListener("dragstart", e => {
        lineupDragName = name;
        lineupDragFromIdx = null;
        if (e.dataTransfer) {
          e.dataTransfer.setData("text/plain", name);
          e.dataTransfer.effectAllowed = "move";
        }
      });
      chip.addEventListener("dragend", () => {
        lineupDragName = "";
        lineupDragFromIdx = null;
      });
      chip.addEventListener("click", () => {
        const nextEmpty = court.findIndex(slot => !slot.main);
        const targetIdx = nextEmpty !== -1 ? nextEmpty : 0;
        assignPlayerToLineup(name, targetIdx);
        lineupSelectedName = "";
        renderLineupModal();
      });
      chip.addEventListener("touchstart", e => {
        if (!isCoarse) return;
        e.preventDefault();
        lineupDragName = name;
        lineupSelectedName = name;
        renderLineupModal();
      });
      const span = document.createElement("span");
      span.textContent = formatLineupModalName(name, { compactCourt: true });
      chip.appendChild(span);
      elLineupModalBench.appendChild(chip);
    });
  }
}
function openMobileLineupModal(scope = "our") {
  lineupModalContext = "match";
  lineupModalScope = scope === "opponent" ? "opponent" : "our";
  lineupModalDefaultRotation = null;
  const libSet = new Set(getLineupModalLiberos());
  const baseCourt =
    lineupModalScope === "opponent" ? state.opponentCourt || [] : state.court;
  const normalizedCourt = getCourtShape(baseCourt).map(slot => {
    if (libSet.has(slot.main)) {
      return { main: slot.replaced || "", replaced: "" };
    }
    return { main: slot.main || "", replaced: "" };
  });
  lineupModalCourt = cloneCourt(normalizedCourt);
  renderLineupModal();
  updateLineupModalControls();
  if (elLineupModal) {
    if (isDesktopCourtModalLayout()) {
      setCourtAreaLocked(true);
    }
    updateCourtModalPlacement();
    elLineupModal.classList.remove("hidden");
    setModalOpenState(true);
  }
}
function renderSetStartModal() {
  if (!elSetStartModalBody) return;
  const setNum = setStartModalSetNum || state.currentSet || 1;
  const scope = setStartModalScope || "our";
  ensureSetStartSnapshot(setNum);
  if (elSetStartModalTitle) {
    const label = "Formazione di partenza S" + String(setNum);
    elSetStartModalTitle.textContent = scope === "opponent" ? label + " avversaria" : label;
  }
  const startInfo = buildSetStartInfoList([setNum], scope)[0];
  const sortedEntries =
    scope === "opponent" ? getSortedPlayerEntriesForScope(scope) : getSortedPlayerEntries();
  const list = document.createElement("div");
  list.className = "set-start-list";
  sortedEntries.forEach(({ name }) => {
    const row = document.createElement("div");
    row.className = "set-start-row";
    const label = document.createElement("span");
    label.className = "set-start-name";
    label.textContent =
      scope === "opponent"
        ? formatNameWithNumberFor(name, getPlayerNumbersForScope(scope))
        : formatNameWithNumber(name);
    row.appendChild(label);
    const select = document.createElement("select");
    select.className = "set-start-select";
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "-";
    select.appendChild(emptyOpt);
    const inOpt = document.createElement("option");
    inOpt.value = "in";
    inOpt.textContent = "in";
    select.appendChild(inOpt);
    for (let pos = 1; pos <= 6; pos += 1) {
      const opt = document.createElement("option");
      opt.value = String(pos);
      opt.textContent = String(pos);
      select.appendChild(opt);
    }
    const key = makePlayerNameKey(name);
    const pos = startInfo && startInfo.positions ? startInfo.positions.get(key) : null;
    const isSub = startInfo && startInfo.subsIn ? startInfo.subsIn.has(key) : false;
    select.value = pos ? String(pos) : isSub ? "in" : "";
    select.addEventListener("change", () => {
      updateSetStartSelection(setNum, scope, name, select.value);
      renderSetStartModal();
    });
    row.appendChild(select);
    list.appendChild(row);
  });
  elSetStartModalBody.innerHTML = "";
  elSetStartModalBody.appendChild(list);
}
function openSetStartEditor(setNum, scope = "our") {
  const targetSet = parseInt(setNum, 10) || state.currentSet || 1;
  setStartModalSetNum = targetSet;
  setStartModalScope = scope === "opponent" ? "opponent" : "our";
  renderSetStartModal();
  if (elSetStartModal) {
    elSetStartModal.classList.remove("hidden");
    setModalOpenState(true, true);
  }
}
function closeLineupModal() {
  if (elLineupModal) {
    elLineupModal.classList.add("hidden");
    elLineupModal.classList.remove("force-popup");
    setModalOpenState(false);
  }
  lineupDragName = "";
  lineupSelectedName = "";
  lineupNumberMode = false;
  lineupModalContext = "match";
  setStartEditSetNum = null;
}
function closeSetStartModal() {
  if (elSetStartModal) {
    elSetStartModal.classList.add("hidden");
  }
  setStartModalSetNum = null;
  setStartModalScope = "our";
  setModalOpenState(false, true);
}
function saveLineupModal({ countSubstitutions = false } = {}) {
  const prevCourt = countSubstitutions ? getLineupBaseCourtFromState() : null;
  const nextCourt = getCourtShape(lineupModalCourt);
  const applyDefaultRotation = lineupModalDefaultRotation;
  if (lineupModalContext === "next-set" && nextSetDraft) {
    const draftEntry = lineupModalScope === "opponent" ? nextSetDraft.opponent : nextSetDraft.our;
    const nextRotation =
      typeof applyDefaultRotation === "number"
        ? applyDefaultRotation
        : (draftEntry && typeof draftEntry.rotation === "number" ? draftEntry.rotation : null);
    if (lineupModalScope === "opponent") {
      nextSetDraft.opponent = { court: cloneCourt(nextCourt), rotation: nextRotation };
    } else {
      nextSetDraft.our = { court: cloneCourt(nextCourt), rotation: nextRotation };
    }
    lineupModalDefaultRotation = null;
    closeLineupModal();
    return;
  }
  if (lineupModalContext === "set-start") {
    lineupModalDefaultRotation = null;
    closeLineupModal();
    return;
  }
  if (lineupModalScope === "opponent") {
    if (typeof commitCourtChangeForScope === "function") {
      commitCourtChangeForScope(nextCourt, "opponent");
    } else {
      state.opponentCourt = nextCourt;
      saveState();
      if (typeof renderOpponentPlayers === "function") renderOpponentPlayers();
    }
    if (applyDefaultRotation && typeof setOpponentRotation === "function") {
      setOpponentRotation(applyDefaultRotation);
    } else if (applyDefaultRotation) {
      state.opponentRotation = Math.min(6, Math.max(1, parseInt(applyDefaultRotation, 10) || 1));
      if (typeof updateOpponentRotationDisplay === "function") updateOpponentRotationDisplay();
      if (typeof renderOpponentPlayers === "function") renderOpponentPlayers();
      saveState();
    }
  } else if (typeof commitCourtChange === "function") {
    commitCourtChange(nextCourt, { clean: true });
  } else {
    state.court = nextCourt;
    saveState();
    if (typeof renderPlayers === "function") renderPlayers();
    if (typeof renderBenchChips === "function") renderBenchChips();
    if (typeof renderLineupChips === "function") renderLineupChips();
    if (typeof updateRotationDisplay === "function") updateRotationDisplay();
  }
  if (lineupModalScope !== "opponent" && applyDefaultRotation) {
    if (typeof setRotation === "function") {
      setRotation(applyDefaultRotation);
    } else {
      state.rotation = Math.min(6, Math.max(1, parseInt(applyDefaultRotation, 10) || 1));
      if (typeof updateRotationDisplay === "function") updateRotationDisplay();
      saveState();
    }
  }
  if (countSubstitutions && lineupModalScope !== "opponent") {
    const subs = getLineupSubstitutions(prevCourt || [], nextCourt);
    subs.forEach(sub => recordSubstitutionEvent(sub));
  }
  lineupModalDefaultRotation = null;
  closeLineupModal();
}
function closeCurrentEdit({ refresh = false } = {}) {
  if (currentEditControl) {
    try {
      currentEditControl.blur();
    } catch (_) {
      // ignore
    }
  }
  if (currentEditCell) {
    currentEditCell.dataset.editing = "false";
    currentEditCell = null;
    currentEditControl = null;
    if (refresh) {
      renderEventsLog({ suppressScroll: true });
      renderVideoAnalysis();
    }
  }
}
function setSelectedSkillForScope(scope, playerIdx, skillId) {
  const key = makePlayerKey(scope, playerIdx);
  if (skillId) {
    selectedSkillPerPlayer[key] = skillId;
    if (skillId !== "serve") {
      delete serveMetaByPlayer[key];
    }
    if (skillId === "block") {
      blockConfirmByPlayer[key] = false;
      blockInlinePlayer = key;
    } else {
      delete blockConfirmByPlayer[key];
      if (blockInlinePlayer === key) {
        blockInlinePlayer = null;
      }
    }
  } else {
    delete selectedSkillPerPlayer[key];
    delete serveMetaByPlayer[key];
    delete blockConfirmByPlayer[key];
    if (blockInlinePlayer === key) {
      blockInlinePlayer = null;
    }
  }
}
function getSelectedSkillForScope(scope, playerIdx) {
  const key = makePlayerKey(scope, playerIdx);
  return selectedSkillPerPlayer.hasOwnProperty(key) ? selectedSkillPerPlayer[key] : null;
}
function isAnySelectedSkillForScope(scope, skillId) {
  const prefix = (scope || "our") + ":";
  return Object.keys(selectedSkillPerPlayer).some(key => {
    if (!key.startsWith(prefix)) return false;
    return selectedSkillPerPlayer[key] === skillId;
  });
}
function setSelectedSkill(playerIdx, skillId) {
  setSelectedSkillForScope("our", playerIdx, skillId);
}
function getSelectedSkill(playerIdx) {
  return getSelectedSkillForScope("our", playerIdx);
}
function isAnySelectedSkill(skillId) {
  return isAnySelectedSkillForScope("our", skillId);
}
function isSetterPlayerForScope(scope, playerIdx) {
  if (typeof getRoleLabelForRotation !== "function") return false;
  const players = getPlayersForScope(scope);
  if (typeof playerIdx !== "number" || !players[playerIdx]) return false;
  const name = players[playerIdx];
  const baseCourt =
    scope === "opponent"
      ? state.autoRolePositioning && state.opponentAutoRoleBaseCourt && state.opponentAutoRoleBaseCourt.length === 6
        ? ensureCourtShapeFor(state.opponentAutoRoleBaseCourt)
        : ensureCourtShapeFor(state.opponentCourt)
      : state.autoRolePositioning && autoRoleBaseCourt
        ? ensureCourtShapeFor(autoRoleBaseCourt)
        : ensureCourtShapeFor(state.court);
  const idx = (baseCourt || []).findIndex(
    slot => slot && (slot.main === name || slot.replaced === name)
  );
  if (idx === -1) return false;
  const rotation = scope === "opponent" ? state.opponentRotation || 1 : state.rotation || 1;
  return String(getRoleLabelForRotation(idx + 1, rotation)).toUpperCase() === "P";
}
function isSetterPlayer(playerIdx) {
  return isSetterPlayerForScope("our", playerIdx);
}
function getSetterFromCourtForScope(scope) {
  if (typeof getRoleLabel !== "function") return { idx: null, name: null };
  const court =
    scope === "opponent" ? getCourtShape(state.opponentCourt || []) : getCourtShape(state.court);
  const players = getPlayersForScope(scope);
  for (let i = 0; i < court.length; i += 1) {
    const role = String(getRoleLabel(i + 1)).toUpperCase();
    if (role !== "P") continue;
    const name = court[i] && court[i].main ? court[i].main : "";
    if (!name) continue;
    const idx = Array.isArray(players) ? players.indexOf(name) : -1;
    return { idx: idx >= 0 ? idx : null, name };
  }
  return { idx: null, name: null };
}
function getSetterFromCourt() {
  return getSetterFromCourtForScope("our");
}
function getSetterFromLastSetEventForScope(scope) {
  if (!isSkillEnabledForScope("second", scope)) return null;
  const last = state.events && state.events.length ? state.events[state.events.length - 1] : null;
  if (!last || last.skillId !== "second") return null;
  const lastScope = getTeamScopeFromEvent(last);
  if (lastScope !== scope) return null;
  const idx = typeof last.playerIdx === "number" ? last.playerIdx : null;
  const players = getPlayersForScope(scope);
  const name = last.playerName || (idx !== null && players && players[idx]) || null;
  return { idx, name };
}
function getSetterFromLastSetEvent() {
  return getSetterFromLastSetEventForScope("our");
}
function resetSetTypeState() {
  Object.keys(selectedSkillPerPlayer).forEach(key => delete selectedSkillPerPlayer[key]);
}
function getPredictedSkillIdSingle() {
  const enabledSkills = getEnabledSkills();
  const flowNext = skillId => {
    switch (skillId) {
      case "serve":
        return "block";
      case "pass":
        return "second";
      case "second":
        return "attack";
      case "attack":
        return "block";
      case "block":
        return "defense";
      case "defense":
        return "second";
      default:
        return null;
    }
  };
  const resolveEnabledSkill = skillId => {
    const visited = new Set();
    let current = skillId;
    while (current && !visited.has(current)) {
      if (isSkillEnabled(current)) return current;
      visited.add(current);
      current = flowNext(current);
    }
    return null;
  };
  if (state.skillFlowOverride) return resolveEnabledSkill(state.skillFlowOverride);
  if (!state.predictiveSkillFlow) return null;
  if (enabledSkills.length === 0) return null;
  if (state.freeballPending) return resolveEnabledSkill("second");
  const ownEvents = (state.events || []).filter(ev => {
    if (!ev || !ev.skillId) return false;
    if (!ev.team) return true;
    return ev.team !== "opponent";
  });
  const last = getLastFlowEvent(ownEvents);
  const possessionServe = !!state.isServing;
  const fallback = resolveEnabledSkill(possessionServe ? "serve" : "pass");
  if (!last) return fallback;
  if (last.skillId === "pass" && (last.code === "/" || last.receiveEvaluation === "/")) {
    return resolveEnabledSkill("block") || fallback;
  }
  if (last.skillId === "attack" && last.code === "!") {
    return resolveEnabledSkill("second") || fallback;
  }
  if (last.skillId === "defense" && (last.code === "-" || last.code === "/")) {
    return resolveEnabledSkill("block") || fallback;
  }
  if (last.skillId === "block" && last.code === "-") {
    return resolveEnabledSkill("block") || fallback;
  }
  const dir = typeof getPointDirection === "function" ? getPointDirection(last) : null;
  if (dir === "for") return resolveEnabledSkill("serve") || fallback;
  if (dir === "against") return resolveEnabledSkill("pass") || fallback;
  return resolveEnabledSkill(flowNext(last.skillId)) || fallback;
}
function computeTwoTeamFlowFromEvent(ev) {
  const scope = getTeamScopeFromEvent(ev);
  const other = getOppositeScope(scope);
  if (ev.skillId === "serve" && ev.code === "=") {
    return { teamScope: other, skillId: "serve" };
  }
  const dir = typeof getPointDirection === "function" ? getPointDirection(ev) : null;
  if (dir === "for" || dir === "against") {
    const scoringScope = dir === "for" ? scope : other;
    return { teamScope: scoringScope, skillId: "serve" };
  }
  if (ev.skillId === "pass" && (ev.code === "/" || ev.receiveEvaluation === "/")) {
    return { teamScope: other, skillId: "second" };
  }
  if (ev.skillId === "defense" && ev.code === "/") {
    return { teamScope: other, skillId: "second" };
  }
  if (ev.skillId === "defense" && ev.code === "-") {
    return { teamScope: other, skillId: "defense" };
  }
  if (ev.skillId === "block" && ev.code === "-") {
    return { teamScope: other, skillId: "defense" };
  }
  switch (ev.skillId) {
    case "serve":
      return { teamScope: other, skillId: "pass" };
    case "pass":
    case "freeball":
      return { teamScope: scope, skillId: "second" };
    case "second":
      return { teamScope: scope, skillId: "attack" };
    case "attack": {
      if (ev.code === "/") {
        return { teamScope: other, skillId: "block" };
      }
      if (ev.code === "!") {
        return { teamScope: scope, skillId: "second" };
      }
      return { teamScope: other, skillId: "defense" };
    }
    case "block":
      if (ev.code === "-") {
        return { teamScope: other, skillId: "defense" };
      }
      return { teamScope: scope, skillId: "defense" };
    case "defense":
      if (ev.code === "-" || ev.code === "/") {
        return { teamScope: other, skillId: "second" };
      }
      return { teamScope: scope, skillId: "second" };
    default:
      return { teamScope: scope, skillId: null };
  }
}
function getLastFlowEvent(events) {
  const list = Array.isArray(events) ? events : [];
  const skillIds = new Set(SKILLS.map(skill => skill.id));
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const ev = list[i];
    if (!ev) continue;
    if (skillIds.has(ev.skillId)) return ev;
    if (ev.skillId === "manual") {
      const dir = typeof getPointDirection === "function" ? getPointDirection(ev) : null;
      if (dir) return ev;
    }
  }
  return null;
}
function getActiveServerName(scope) {
  if (state.pendingServe && state.pendingServe.scope === scope) {
    return state.pendingServe.playerName || null;
  }
  const last = getLastFlowEvent(state.events || []);
  if (last && last.skillId === "serve" && getTeamScopeFromEvent(last) === scope) {
    return last.playerName || null;
  }
  const server = getServerPlayerForScope(scope);
  return server && server.name ? server.name : null;
}
function isPostServeLockForScope(scope) {
  if (!state.useOpponentTeam || !state.predictiveSkillFlow) return false;
  if (state.forceSkillActive && state.forceSkillScope === scope) return false;
  if (state.pendingServe && state.pendingServe.scope === scope) return true;
  const last = getLastFlowEvent(state.events || []);
  if (last && last.skillId === "serve" && getTeamScopeFromEvent(last) === scope) {
    if (last.code === "=") return false;
    return true;
  }
  return false;
}
function getServeCodeFromPassCode(code) {
  const map = {
    "#": "-",
    "+": "-",
    "!": "!",
    "-": "+",
    "/": "/",
    "=": "#"
  };
  return map[code] || "=";
}
function getAttackCodeFromBlockCode(code) {
  const map = {
    "#": "/",
    "+": "-",
    "-": "+",
    "=": "#"
  };
  return map[code] || null;
}
function resolveFlowSkillForScope(scope, skillId) {
  const flowNext = current => {
    switch (current) {
      case "serve":
        return "pass";
      case "pass":
      case "freeball":
        return "second";
      case "second":
        return "attack";
      case "attack":
        return "block";
      case "block":
        return "defense";
      case "defense":
        return "second";
      default:
        return null;
    }
  };
  const visited = new Set();
  let current = skillId;
  while (current && !visited.has(current)) {
    if (isSkillEnabledForScope(current, scope)) return current;
    visited.add(current);
    current = flowNext(current);
  }
  return null;
}
function getAutoFlowState() {
  if (!state.useOpponentTeam || !state.predictiveSkillFlow) return null;
  if (state.pendingServe && state.pendingServe.scope) {
    return {
      teamScope: getOppositeScope(state.pendingServe.scope),
      skillId: "pass"
    };
  }
  if (state.skillFlowOverride) {
    return {
      teamScope: "our",
      skillId: resolveFlowSkillForScope("our", state.skillFlowOverride)
    };
  }
  if (state.opponentSkillFlowOverride) {
    return {
      teamScope: "opponent",
      skillId: resolveFlowSkillForScope("opponent", state.opponentSkillFlowOverride)
    };
  }
  const last = getLastFlowEvent(state.events || []);
  let flowScope = state.flowTeamScope || (state.isServing ? "our" : "opponent");
  let nextSkill = "serve";
  if (last) {
    const next = computeTwoTeamFlowFromEvent(last);
    flowScope = next.teamScope;
    nextSkill = next.skillId;
  }
  if (state.freeballPending && state.freeballPendingScope) {
    flowScope = state.freeballPendingScope;
    nextSkill = "second";
  }
  const override = flowScope === "opponent" ? state.opponentSkillFlowOverride : state.skillFlowOverride;
  if (override) nextSkill = override;
  const resolved = resolveFlowSkillForScope(flowScope, nextSkill);
  return { teamScope: flowScope, skillId: resolved };
}
function canOverrideServeError(scope, skillId, code, flowState, playerName) {
  if (!flowState || flowState.teamScope === scope) return false;
  if (flowState.skillId !== "pass") return false;
  if (skillId !== "serve" || code !== "=") return false;
  if (!isSkillEnabledForScope("serve", scope)) return false;
  const serverName = getActiveServerName(scope);
  if (!serverName) return false;
  return serverName === playerName;
}
function getServerPlayerForScope(scope) {
  const players = getPlayersForScope(scope);
  const baseCourt = scope === "opponent" ? state.opponentCourt : state.court;
  const court = getCourtShape(baseCourt);
  const slot = court[0] || {};
  const name = slot.main || slot.replaced || "";
  if (!name) return null;
  const idx = players.indexOf(name);
  return { idx: idx >= 0 ? idx : null, name };
}
function shouldInferServeFromPass(scope, skillId) {
  if (!state.useOpponentTeam || !state.predictiveSkillFlow) return false;
  if (skillId !== "pass") return false;
  if (
    state.pendingServe &&
    state.pendingServe.scope &&
    getOppositeScope(state.pendingServe.scope) === scope
  ) {
    return true;
  }
  const last = getLastFlowEvent(state.events || []);
  const baseNext = last
    ? computeTwoTeamFlowFromEvent(last)
    : { teamScope: state.isServing ? "our" : "opponent", skillId: "serve" };
  if (baseNext.skillId !== "serve") return false;
  const servingScope = baseNext.teamScope;
  if (getOppositeScope(servingScope) !== scope) return false;
  if (!isSkillEnabledForScope("serve", servingScope)) return false;
  if (!isSkillEnabledForScope("pass", scope)) return false;
  return true;
}
function shouldInferAttackFromBlock(scope, skillId, code) {
  if (!state.useOpponentTeam || !state.predictiveSkillFlow) return false;
  if (skillId !== "block") return false;
  if (!code) return false;
  const last = getLastFlowEvent(state.events || []);
  if (!last || last.skillId !== "attack") return false;
  const attackScope = getOppositeScope(scope);
  if (getTeamScopeFromEvent(last) !== attackScope) return false;
  if (last.code !== "/") return false;
  return true;
}
function updateSkillStatsForEvent(scope, playerIdx, skillId, prevCode, nextCode) {
  if (prevCode === nextCode) return;
  const bucket = scope === "our" ? state.stats : state.opponentStats;
  if (!bucket || typeof playerIdx !== "number") return;
  if (!bucket[playerIdx] || !bucket[playerIdx][skillId]) return;
  if (prevCode && bucket[playerIdx][skillId][prevCode] > 0) {
    bucket[playerIdx][skillId][prevCode] -= 1;
  }
  if (nextCode) {
    bucket[playerIdx][skillId][nextCode] = (bucket[playerIdx][skillId][nextCode] || 0) + 1;
  }
}
function shouldSkipBlockConfirm(scope = "our") {
  if (!state.useOpponentTeam || !state.predictiveSkillFlow) return false;
  const last = getLastFlowEvent(state.events || []);
  if (!last || last.skillId !== "attack" || last.code !== "/") return false;
  const expectedScope = getOppositeScope(getTeamScopeFromEvent(last));
  return expectedScope === scope;
}
function applyBlockInference(blockEvent, blockScope, blockCode) {
  if (!state.useOpponentTeam || !state.predictiveSkillFlow) return;
  if (!blockEvent || blockEvent.skillId !== "block") return;
  const attackScope = getOppositeScope(blockScope);
  const events = state.events || [];
  let attackEvent = null;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (!ev || ev.skillId !== "attack") continue;
    if (getTeamScopeFromEvent(ev) !== attackScope) continue;
    if (ev.pendingBlockEval || ev.code === "/") {
      attackEvent = ev;
      break;
    }
  }
  if (!attackEvent) return null;
  if (blockCode === "/") {
    const prevCode = attackEvent.code;
    attackEvent.code = "";
    attackEvent.pendingBlockEval = false;
    attackEvent.derivedFromBlock = true;
    const attackIdx = resolvePlayerIdx(attackEvent);
    updateSkillStatsForEvent(attackScope, attackIdx, "attack", prevCode, "");
    return attackEvent;
  }
  const prevCode = attackEvent.code;
  const nextCode = getAttackCodeFromBlockCode(blockCode);
  attackEvent.code = nextCode || "";
  attackEvent.pendingBlockEval = false;
  attackEvent.derivedFromBlock = true;
  const attackIdx = resolvePlayerIdx(attackEvent);
  updateSkillStatsForEvent(attackScope, attackIdx, "attack", prevCode, attackEvent.code);
  return attackEvent;
}
function getPredictedSkillIdForScope(scope) {
  if (scope === "opponent" && !state.useOpponentTeam) return null;
  if (!state.predictiveSkillFlow) return null;
  if (
    state.pendingServe &&
    state.pendingServe.scope &&
    getOppositeScope(state.pendingServe.scope) === scope
  ) {
    return resolveFlowSkillForScope(scope, "pass");
  }
  if (scope === "opponent" && state.useOpponentTeam && state.predictiveSkillFlow) {
    const last = getLastFlowEvent(state.events || []);
    if (last && last.skillId === "serve" && getTeamScopeFromEvent(last) === scope && last.code === "=") {
      return resolveFlowSkillForScope(scope, "serve");
    }
  }
  const enabledSkills = getEnabledSkillsForScope(scope);
  if (enabledSkills.length === 0) return null;
  const flowNext = skillId => {
    switch (skillId) {
      case "serve":
        return "pass";
      case "pass":
      case "freeball":
        return "second";
      case "second":
        return "attack";
      case "attack":
        return "block";
      case "block":
        return "defense";
      case "defense":
        return "second";
      default:
        return null;
    }
  };
  const resolveEnabledSkill = skillId => {
    const visited = new Set();
    let current = skillId;
    while (current && !visited.has(current)) {
      if (isSkillEnabledForScope(current, scope)) return current;
      visited.add(current);
      current = flowNext(current);
    }
    return null;
  };
  const override =
    scope === "opponent" ? state.opponentSkillFlowOverride : state.skillFlowOverride;
  if (override) return resolveEnabledSkill(override);
  if (state.freeballPending && state.freeballPendingScope === scope) {
    return resolveEnabledSkill("second");
  }
  const events = state.events || [];
  const last = getLastFlowEvent(events);
  let flowScope = state.flowTeamScope || (state.isServing ? "our" : "opponent");
  let nextSkill = null;
  if (last) {
    const next = computeTwoTeamFlowFromEvent(last);
    flowScope = next.teamScope;
    nextSkill = next.skillId;
  } else {
    flowScope = state.isServing ? "our" : "opponent";
    nextSkill = flowScope === "our" ? "serve" : "serve";
  }
  if (flowScope !== scope) return null;
  return resolveEnabledSkill(nextSkill) || null;
}
function getPredictedSkillId() {
  if (!state.useOpponentTeam) {
    return getPredictedSkillIdSingle();
  }
  return getPredictedSkillIdForScope("our");
}
function updateNextSkillIndicator(skillId) {
  if (!elNextSkillIndicator) return;
  updateSetTypeVisibility(skillId);
  if (!state.predictiveSkillFlow) {
    elNextSkillIndicator.style.display = "none";
    elNextSkillIndicator.textContent = "Prossima skill: —";
    elNextSkillIndicator.classList.remove("active");
    return;
  }
  elNextSkillIndicator.style.display = "";
  let scopeLabel = "";
  let resolvedSkillId = skillId;
  if (state.useOpponentTeam) {
    const ours = getPredictedSkillIdForScope("our");
    const opp = getPredictedSkillIdForScope("opponent");
    if (!resolvedSkillId) resolvedSkillId = ours || opp || null;
    if (opp && !ours) {
      scopeLabel = " (" + getTeamNameForScope("opponent") + ")";
    } else if (ours && !opp) {
      scopeLabel = " (" + getTeamNameForScope("our") + ")";
    }
  }
  const meta = SKILLS.find(s => s.id === resolvedSkillId);
  const label = meta ? meta.label : skillId || "—";
  elNextSkillIndicator.textContent = "Prossima skill: " + (label || "—") + scopeLabel;
  elNextSkillIndicator.classList.toggle("active", !!resolvedSkillId);
}
function updateSetTypeVisibility(nextSkillId = null) {
  if (!elSetTypeShortcuts) return;
  elSetTypeShortcuts.classList.remove("set-type-inline--active");
  elSetTypeShortcuts.style.display = "none";
}
function resetTrajectoryState() {
  trajectoryStart = null;
  trajectoryEnd = null;
  trajectoryDragging = false;
  if (elAttackTrajectoryCanvas) {
    const ctx = elAttackTrajectoryCanvas.getContext("2d");
    ctx && ctx.clearRect(0, 0, elAttackTrajectoryCanvas.width, elAttackTrajectoryCanvas.height);
  }
}
function resizeTrajectoryCanvas() {
  if (!elAttackTrajectoryCanvas || !elAttackTrajectoryImage) return;
  const rect = elAttackTrajectoryImage.getBoundingClientRect();
  const canvas = elAttackTrajectoryCanvas;
  const height = rect.height;
  canvas.width = rect.width;
  canvas.height = height;
  canvas.style.width = rect.width + "px";
  canvas.style.height = height + "px";
  if (canvas.parentElement) {
    const inCourtModal = !!(elAttackTrajectoryModal && elAttackTrajectoryModal.classList.contains("court-modal"));
    canvas.parentElement.style.height = inCourtModal ? "" : height + "px";
  }
  drawTrajectory();
}
function drawTrajectory(tempEnd = null) {
  if (!elAttackTrajectoryCanvas) return;
  const ctx = elAttackTrajectoryCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, elAttackTrajectoryCanvas.width, elAttackTrajectoryCanvas.height);
  const start = trajectoryStart;
  const end = tempEnd || trajectoryEnd;
  if (trajectoryMode === "serve-start") {
    const pt = start;
    if (pt) {
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (trajectoryMode === "serve-end") {
    const pt = end || start;
    if (pt) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (start) {
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(start.x, start.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (start && end) {
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
function getTrajectoryDisplayBox() {
  if (!elAttackTrajectoryCanvas || !elAttackTrajectoryImage) return null;
  const stageW = elAttackTrajectoryCanvas.clientWidth || elAttackTrajectoryCanvas.width || 1;
  const stageH = elAttackTrajectoryCanvas.clientHeight || elAttackTrajectoryCanvas.height || 1;
  const natW = elAttackTrajectoryImage.naturalWidth || stageW;
  const natH = elAttackTrajectoryImage.naturalHeight || stageH;
  if (!natW || !natH) return { offsetX: 0, offsetY: 0, width: stageW, height: stageH };
  const scale = Math.min(stageW / natW, stageH / natH);
  const dispW = natW * scale;
  const dispH = natH * scale;
  const offsetX = (stageW - dispW) / 2;
  const offsetY = (stageH - dispH) / 2;
  return { offsetX, offsetY, width: dispW, height: dispH };
}
function denormalizeTrajectoryPoint(norm) {
  const box = getTrajectoryDisplayBox();
  if (!box || !norm) return null;
  return {
    x: box.offsetX + clamp01(norm.x || 0) * box.width,
    y: box.offsetY + clamp01(norm.y || 0) * box.height
  };
}
function normalizeTrajectoryPoint(pt) {
  if (!elAttackTrajectoryCanvas || !pt) return null;
  const box = getTrajectoryDisplayBox();
  if (!box) return { x: 0, y: 0 };
  const relX = (pt.x - box.offsetX) / (box.width || 1);
  const relY = (pt.y - box.offsetY) / (box.height || 1);
  return {
    x: clamp01(relX),
    y: clamp01(relY)
  };
}
function mirrorTrajectoryPoint(norm) {
  if (!norm) return norm;
  return {
    x: 1 - clamp01(norm.x),
    y: 1 - clamp01(norm.y)
  };
}
function computeAttackDirectionDeg(start, end) {
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return Math.round(((angle + 360) % 360) * 10) / 10; // 0-360, 1 decimal
}
function getAttackZone(normalizedPoint, isFarSide = false) {
  if (!normalizedPoint) return null;
  const x = clamp01(normalizedPoint.x);
  const third = x < 1 / 3 ? 0 : x < 2 / 3 ? 1 : 2;
  if (!isFarSide) {
    return third === 0 ? 4 : third === 1 ? 3 : 2;
  }
  return third === 0 ? 5 : third === 1 ? 6 : 1;
}
function mapBackRowZone(zone, baseZone) {
  if (!zone) return zone;
  const isBackRow = baseZone === 5 || baseZone === 6 || baseZone === 1;
  if (isBackRow) {
    if (zone === 4) return 5;
    if (zone === 3) return 6;
    if (zone === 2) return 1;
  }
  return zone;
}
function getTrajectoryNetPoint(id) {
  if (!id) return null;
  return TRAJECTORY_NET_POINTS.find(point => point.id === id) || null;
}
function getDefaultTrajectoryNetPointId(baseZone, setType) {
  if (setType === "fast") return "6-F";
  if ((setType || "").toLowerCase() === "damp") return "4";
  if (baseZone === 4 || baseZone === 5) return "5";
  if (baseZone === 3 || baseZone === 6) return "3";
  if (baseZone === 2 || baseZone === 1) return "6-F";
  return "3";
}
function getNearestTrajectoryNetPointId(start) {
  if (!start) return null;
  const x = clamp01(start.x);
  let closest = TRAJECTORY_NET_POINTS[0];
  let best = Math.abs(x - closest.x);
  for (let i = 1; i < TRAJECTORY_NET_POINTS.length; i++) {
    const candidate = TRAJECTORY_NET_POINTS[i];
    const diff = Math.abs(x - candidate.x);
    if (diff < best) {
      best = diff;
      closest = candidate;
    }
  }
  return closest ? closest.id : null;
}
function setTrajectoryNetPointId(id) {
  trajectoryNetPointId = id;
  if (!elAttackTrajectoryNetpoints) return;
  const buttons = elAttackTrajectoryNetpoints.querySelectorAll("[data-net-point]");
  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.netPoint === id);
  });
}
function updateTrajectoryImageFromStart() {
  if (trajectoryMode !== "attack") return;
  if (!trajectoryStart || !elAttackTrajectoryImage) return;
  const startNorm = normalizeTrajectoryPoint(trajectoryStart);
  if (!startNorm) return;
  const mirrorX = trajectoryMirror || trajectoryForceFar;
  const zoneNorm = mirrorX
    ? { x: 1 - clamp01(startNorm.x), y: clamp01(startNorm.y) }
    : startNorm;
  const startZoneRaw = getAttackZone(zoneNorm, trajectoryForceFar);
  const imgSrc = getTrajectoryImageForZone(startZoneRaw, trajectoryMirror || trajectoryForceFar);
  if (elAttackTrajectoryImage.dataset.activeSrc !== imgSrc) {
    elAttackTrajectoryImage.dataset.activeSrc = imgSrc;
    elAttackTrajectoryImage.src = imgSrc;
  }
}
function applyTrajectoryStartFromNetPoint() {
  if (trajectoryMode !== "attack") return;
  const point = getTrajectoryNetPoint(trajectoryNetPointId);
  if (!point || !elAttackTrajectoryCanvas) return;
  const box = getTrajectoryDisplayBox();
  const canvas = elAttackTrajectoryCanvas;
  const mirrorX = trajectoryMirror || trajectoryForceFar;
  const normX = mirrorX ? 1 - point.x : point.x;
  const x = box ? box.offsetX + normX * box.width : normX * canvas.width;
  const startFromTop = trajectoryMirror || trajectoryForceFar;
  const fixedY = box
    ? box.offsetY + (startFromTop ? 0.5 : box.height - 0.5)
    : startFromTop
      ? 0.5
      : canvas.height - 0.5;
  trajectoryStart = { x, y: fixedY };
  updateTrajectoryImageFromStart();
  drawTrajectory();
}
function openAttackTrajectoryModal(prefill = null) {
  return new Promise(resolve => {
    if (!elAttackTrajectoryModal || !elAttackTrajectoryCanvas || !elAttackTrajectoryImage) {
      resolve(null);
      return;
    }
    const forcePopup = !!(prefill && prefill.forcePopup);
    attackTrajectoryForcePopup = forcePopup;
    if (!forcePopup) {
      elAttackTrajectoryModal.classList.remove("force-popup");
      if (isDesktopCourtModalLayout()) {
        setCourtAreaLocked(true);
        setAttackTrajectoryCourtSizing(true);
      }
      updateCourtModalPlacement();
    } else {
      elAttackTrajectoryModal.classList.add("force-popup");
      setAttackTrajectoryCourtSizing(false);
      restoreModalToPopup(elAttackTrajectoryModal);
    }
    const scope = prefill && prefill.scope ? prefill.scope : "our";
    const mirrorFlag = scope === "opponent" ? state.opponentCourtViewMirrored : state.courtViewMirrored;
    trajectoryForceFar = !!(prefill && prefill.forceFar);
    trajectoryMirror = !forcePopup && !!mirrorFlag && !trajectoryForceFar;
    const mode = (prefill && prefill.mode) || "attack";
    trajectoryMode = mode;
    serveTrajectoryScope = mode === "serve-start" || mode === "serve-end" ? scope : null;
    trajectoryBaseZone = prefill && prefill.baseZone ? prefill.baseZone : null;
    trajectorySetType = prefill && prefill.setType ? prefill.setType : null;
    trajectoryResolver = resolve;
    resetTrajectoryState();
    trajectoryNetPointId = null;
    const simplified = !!state.attackTrajectorySimplified;
    if (elAttackTrajectoryNetpoints) {
      const shouldShowNet = mode === "attack" && simplified;
      elAttackTrajectoryNetpoints.classList.toggle("hidden", !shouldShowNet);
    }
    if (elServeTypeButtons) {
      elServeTypeButtons.classList.toggle("hidden", mode !== "serve-start");
      if (mode === "serve-start") {
        setServeTypeSelection("JF");
      }
    }
    if (elAttackTrajectoryInstructions) {
      const hideInstructions = mode === "serve-start" || mode === "serve-end";
      elAttackTrajectoryInstructions.textContent = hideInstructions
        ? ""
        : simplified
          ? "Scegli il punto rete e poi clicca il punto di arrivo."
          : "Clicca (o trascina) per disegnare la traiettoria dal punto di partenza a quello di arrivo.";
      elAttackTrajectoryInstructions.classList.toggle("hidden", hideInstructions);
    }
    const getInitialImage = () => {
      if (trajectoryForceFar) {
        if (mode === "serve-start") return SERVE_START_IMG_FAR;
        if (mode === "serve-end") return SERVE_END_IMG_FAR;
        return TRAJECTORY_IMG_FAR;
      }
      if (mode === "serve-start") return trajectoryMirror ? SERVE_START_IMG_FAR : SERVE_START_IMG_NEAR;
      if (mode === "serve-end") return trajectoryMirror ? SERVE_END_IMG_FAR : SERVE_END_IMG_NEAR;
      return trajectoryMirror ? TRAJECTORY_IMG_FAR : TRAJECTORY_IMG_NEAR;
    };
    elAttackTrajectoryImage.dataset.activeSrc = getInitialImage();
    elAttackTrajectoryImage.src = getInitialImage();
    if (serveTypeKeyHandler) {
      window.removeEventListener("keydown", serveTypeKeyHandler);
    }
    if (trajectoryEscapeHandler) {
      window.removeEventListener("keydown", trajectoryEscapeHandler);
      trajectoryEscapeHandler = null;
    }
    if (mode === "serve-start") {
      if (prefill && prefill.serveType) {
        setServeTypeSelection(prefill.serveType);
      }
      serveTypeKeyHandler = e => {
        const key = (e.key || "").toUpperCase();
        if (key === "F" || key === "J" || key === "S") {
          setServeTypeSelection(key === "J" ? "JF" : key);
        }
      };
      window.addEventListener("keydown", serveTypeKeyHandler);
    } else {
      serveTypeKeyHandler = null;
    }
    trajectoryEscapeHandler = e => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closeAttackTrajectoryModal(null);
    };
    window.addEventListener("keydown", trajectoryEscapeHandler);
    elAttackTrajectoryModal.classList.remove("hidden");
    setModalOpenState(true, forcePopup);
    renderLogServeTrajectories();
    const applyPrefill = () => {
      if (!elAttackTrajectoryCanvas || elAttackTrajectoryCanvas.width === 0 || elAttackTrajectoryCanvas.height === 0) {
        return;
      }
      if (prefill && prefill.start && prefill.end) {
        const mirrorForDisplay = trajectoryMirror || trajectoryForceFar;
        const startNorm = mirrorForDisplay ? mirrorTrajectoryPoint(prefill.start) : prefill.start;
        const endNorm = mirrorForDisplay ? mirrorTrajectoryPoint(prefill.end) : prefill.end;
        const startPx = denormalizeTrajectoryPoint(startNorm);
        const endPx = denormalizeTrajectoryPoint(endNorm);
        if (!startPx || !endPx) return;
        trajectoryStart = startPx;
        trajectoryEnd = endPx;
        if (simplified) {
          const inferredNetPoint = getNearestTrajectoryNetPointId(startNorm);
          setTrajectoryNetPointId(inferredNetPoint || getDefaultTrajectoryNetPointId(trajectoryBaseZone, trajectorySetType));
        }
        updateTrajectoryImageFromStart();
        drawTrajectory();
        return;
      }
      if (mode === "serve-start" && prefill && prefill.start) {
        const mirrorForDisplay = trajectoryMirror || trajectoryForceFar;
        const startNorm = mirrorForDisplay ? mirrorTrajectoryPoint(prefill.start) : prefill.start;
        const startPx = denormalizeTrajectoryPoint(startNorm);
        if (startPx) {
          trajectoryStart = startPx;
          drawTrajectory();
        }
      }
      if (mode === "serve-end" && prefill && prefill.end) {
        const mirrorForDisplay = trajectoryMirror || trajectoryForceFar;
        const endNorm = mirrorForDisplay ? mirrorTrajectoryPoint(prefill.end) : prefill.end;
        const endPx = denormalizeTrajectoryPoint(endNorm);
        if (endPx) {
          trajectoryEnd = endPx;
          drawTrajectory();
        }
      }
      if (simplified && mode === "attack") {
        const defaultNetPoint = getDefaultTrajectoryNetPointId(trajectoryBaseZone, trajectorySetType);
        setTrajectoryNetPointId(defaultNetPoint);
        applyTrajectoryStartFromNetPoint();
      }
    };
    requestAnimationFrame(() => {
      resizeTrajectoryCanvas();
      setTimeout(() => {
        resizeTrajectoryCanvas();
        applyPrefill();
      }, 50);
    });
  });
}
function closeAttackTrajectoryModal(result = null) {
  if (!elAttackTrajectoryModal) return;
  elAttackTrajectoryModal.classList.add("hidden");
  setModalOpenState(false, attackTrajectoryForcePopup);
  setAttackTrajectoryCourtSizing(false);
  elAttackTrajectoryModal.classList.remove("force-popup");
  attackTrajectoryForcePopup = false;
  trajectoryMirror = false;
  trajectoryForceFar = false;
  trajectoryBaseZone = null;
  trajectorySetType = null;
  trajectoryMode = "attack";
  serveTrajectoryScope = null;
  if (serveTypeKeyHandler) {
    window.removeEventListener("keydown", serveTypeKeyHandler);
    serveTypeKeyHandler = null;
  }
  if (trajectoryEscapeHandler) {
    window.removeEventListener("keydown", trajectoryEscapeHandler);
    trajectoryEscapeHandler = null;
  }
  if (trajectoryResolver) {
    trajectoryResolver(result);
    trajectoryResolver = null;
  }
  renderLogServeTrajectories();
}
async function captureServeTrajectory(event, { forcePopup = false } = {}) {
  try {
    const scope = getTeamScopeFromEvent(event);
    const forceFar = forcePopup ? false : isFarSideForScope(scope);
    const startRes = await openAttackTrajectoryModal({
      mode: "serve-start",
      start: event.serveStart || null,
      forcePopup,
      forceFar,
      scope
    });
    if (startRes && startRes.serveType) {
      event.serveType = startRes.serveType;
    }
    if (startRes && startRes.point) {
      event.serveStart = startRes.point;
    }
    const endRes = await openAttackTrajectoryModal({
      mode: "serve-end",
      end: event.serveEnd || null,
      forcePopup,
      forceFar,
      scope
    });
    if (endRes && endRes.point) {
      event.serveEnd = endRes.point;
    }
  } catch (err) {
    console.error("Errore cattura traiettoria servizio", err);
  } finally {
    saveState();
    renderEventsLog({ suppressScroll: true });
    renderVideoAnalysis();
    renderServeTrajectoryAnalysis();
  }
}
function forceNextSkill(skillId, scope = "our") {
  if (!skillId) return;
  state.predictiveSkillFlow = true;
  state.freeballPending = false;
  state.freeballPendingScope = scope;
  state.skillFlowOverride = null;
  state.opponentSkillFlowOverride = null;
  state.pendingServe = null;
  state.forceSkillActive = true;
  state.forceSkillScope = scope;
  if (scope === "opponent") {
    state.opponentSkillFlowOverride = skillId;
  } else {
    state.skillFlowOverride = skillId;
  }
  state.flowTeamScope = scope;
  if (scope === "our") {
    if (skillId === "serve" && !state.isServing) {
      state.isServing = true;
      state.autoRotatePending = false;
      if (typeof enforceAutoLiberoForState === "function") {
        enforceAutoLiberoForState({ skipServerOnServe: true });
      }
    }
    if (skillId === "pass") {
      state.isServing = false;
      state.autoRotatePending = true;
      state.freeballPending = false;
      if (typeof enforceAutoLiberoForState === "function") {
        enforceAutoLiberoForState({ skipServerOnServe: true });
      }
    }
  }
  saveState({ persistLocal: true });
  renderPlayers();
  updateNextSkillIndicator(skillId);
  const toggle = document.getElementById("predictive-skill-toggle");
  if (toggle) toggle.checked = true;
}
let videoScoutHomeParent = null;
let videoScoutHomeNextSibling = null;
function relocateVideoScoutContainer() {
  if (!elVideoScoutContainer) return;
  if (!videoScoutHomeParent) {
    videoScoutHomeParent = elVideoScoutContainer.parentElement;
    videoScoutHomeNextSibling = elVideoScoutContainer.nextSibling;
  }
  const logSection = document.querySelector('[data-log-section]');
  if (state.useOpponentTeam && logSection) {
    const anchor = logSection.querySelector("#events-log-summary");
    logSection.insertBefore(elVideoScoutContainer, anchor || logSection.firstChild);
    return;
  }
  if (videoScoutHomeParent) {
    if (videoScoutHomeNextSibling && videoScoutHomeNextSibling.parentElement === videoScoutHomeParent) {
      videoScoutHomeParent.insertBefore(elVideoScoutContainer, videoScoutHomeNextSibling);
    } else {
      videoScoutHomeParent.appendChild(elVideoScoutContainer);
    }
  }
}
function updateVideoScoutModeLayout() {
  if (!elVideoScoutContainer) return;
  const useScout = !!state.videoScoutMode;
  elVideoScoutContainer.classList.toggle("hidden", !useScout);
  relocateVideoScoutContainer();
  renderEventsLog({ suppressScroll: true });
  if (!useScout) {
    if (elAnalysisVideoScout) {
      elAnalysisVideoScout.pause();
    }
    if (ytPlayerScout && typeof ytPlayerScout.pauseVideo === "function") {
      ytPlayerScout.pauseVideo();
    }
  }
}
let videoObjectUrl = "";
let ytPlayer = null;
let ytApiPromise = null;
let ytPlayerReady = false;
let currentYoutubeId = "";
let youtubeFallback = false;
let pendingYoutubeSeek = null;
let ytPlayerScout = null;
let ytPlayerScoutReady = false;
let currentYoutubeIdScout = "";
let youtubeScoutFallback = false;
let lastVideoSnapshotMs = 0;
let videoSnapshotTimer = null;
let playByPlayTimer = null;
const playByPlayState = {
  active: false,
  index: -1,
  key: null,
  endTime: null,
  endAtMs: null
};
let bulkEditActive = false;
let bulkEditSession = null;
const videoUndoStack = [];
const VIDEO_UNDO_LIMIT = 30;
function openMatchManagerModal() {
  if (!elMatchManagerModal) return;
  elMatchManagerModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  if (typeof renderMatchesSelect === "function") renderMatchesSelect();
  if (typeof applyMatchInfoToUI === "function") applyMatchInfoToUI();
  if (typeof renderMatchSummary === "function") renderMatchSummary();
}
function closeMatchManagerModal() {
  if (!elMatchManagerModal) return;
  elMatchManagerModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}
function buildPlayersDbUsage(teamsMap) {
  const usage = {};
  Object.entries(teamsMap || {}).forEach(([teamName, teamData]) => {
    const normalized =
      typeof normalizeTeamPayload === "function" ? normalizeTeamPayload(teamData, teamName) : teamData;
    const roster = normalized && Array.isArray(normalized.playersDetailed) ? normalized.playersDetailed : [];
    roster.forEach(player => {
      const id = player && (player.id || player.playerId);
      if (!id) return;
      if (!usage[id]) usage[id] = [];
      usage[id].push(teamName);
    });
  });
  Object.keys(usage).forEach(id => {
    usage[id] = usage[id].filter(Boolean).sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
  });
  return usage;
}
function renderPlayersDbList() {
  if (!elPlayersDbBody || !elPlayersDbCount) return;
  const db = state.playersDb || {};
  const teamsMap = typeof loadTeamsMapFromStorage === "function" ? loadTeamsMapFromStorage() : state.savedTeams || {};
  const usage = buildPlayersDbUsage(teamsMap);
  const entries = Object.values(db).filter(entry => {
    if (!entry || !entry.id) return false;
    if (typeof isTemplatePlayerName === "function" && isTemplatePlayerName(entry.name)) return false;
    return true;
  });
  entries.sort((a, b) => {
    const lastA = (a.lastName || "").trim();
    const lastB = (b.lastName || "").trim();
    const firstA = (a.firstName || "").trim();
    const firstB = (b.firstName || "").trim();
    const nameA = (a.name || "").trim();
    const nameB = (b.name || "").trim();
    if (lastA && lastB && lastA !== lastB) return lastA.localeCompare(lastB, "it", { sensitivity: "base" });
    if (firstA && firstB && firstA !== firstB) return firstA.localeCompare(firstB, "it", { sensitivity: "base" });
    return nameA.localeCompare(nameB, "it", { sensitivity: "base" });
  });
  elPlayersDbBody.innerHTML = "";
  if (entries.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "Nessuna giocatrice nell'archivio.";
    tr.appendChild(td);
    elPlayersDbBody.appendChild(tr);
    elPlayersDbCount.textContent = "0 giocatrici";
    return;
  }
  const orphanCount = entries.filter(entry => !usage[entry.id] || usage[entry.id].length === 0).length;
  entries.forEach(entry => {
    const tr = document.createElement("tr");
    const tdLast = document.createElement("td");
    const tdFirst = document.createElement("td");
    const tdTeams = document.createElement("td");
    const tdId = document.createElement("td");
    tdLast.textContent = entry.lastName || "";
    tdFirst.textContent = entry.firstName || "";
    tdTeams.textContent = (usage[entry.id] || []).join(", ") || "—";
    tdId.textContent = entry.id || "";
    tr.appendChild(tdLast);
    tr.appendChild(tdFirst);
    tr.appendChild(tdTeams);
    tr.appendChild(tdId);
    elPlayersDbBody.appendChild(tr);
  });
  elPlayersDbCount.textContent =
    entries.length + " giocatrici" + (orphanCount > 0 ? " · " + orphanCount + " senza squadra" : "");
}
function openPlayersDbModal() {
  if (!elPlayersDbModal) return;
  renderPlayersDbList();
  elPlayersDbModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}
function closePlayersDbModal() {
  if (!elPlayersDbModal) return;
  elPlayersDbModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}
function syncOpponentSettingsUI() {
  const enabled = !!state.useOpponentTeam;
  if (elUseOpponentTeamToggle) elUseOpponentTeamToggle.checked = enabled;
  if (elOpponentTeamSettings) {
    elOpponentTeamSettings.classList.toggle("hidden", !enabled);
  }
  const opponentPanel = document.querySelector('[data-team-panel="opponent"]');
  if (opponentPanel) {
    opponentPanel.classList.toggle("hidden", !enabled);
  }
  const opponentSettingsPanel = document.querySelector('[data-team-panel="opponent-settings"]');
  if (opponentSettingsPanel) {
    opponentSettingsPanel.classList.toggle("hidden", !enabled);
  }
  if (enabled && state.selectedOpponentTeam) {
    state.match.opponent = state.selectedOpponentTeam;
    saveState();
  }
  if (!enabled) {
    state.courtSideSwapped = false;
    state.courtViewMirrored = false;
    state.opponentCourtViewMirrored = false;
    saveState();
  }
  if (typeof syncCourtSideLayout === "function") {
    syncCourtSideLayout();
  }
  relocateVideoScoutContainer();
  if (typeof renderPlayers === "function") {
    renderPlayers();
  }
  if (typeof applyMatchInfoToUI === "function") {
    applyMatchInfoToUI();
  }
}
function renderTeamsManagerList() {
  if (!elTeamsManagerList) return;
  const names = typeof listTeamsFromStorage === "function" ? listTeamsFromStorage() : [];
  if (!names.includes(teamsManagerSelectedName)) {
    teamsManagerSelectedName = "";
  }
  elTeamsManagerList.innerHTML = "";
  if (names.length === 0) {
    const empty = document.createElement("li");
    empty.className = "teams-manager-item";
    empty.textContent = "Nessuna squadra salvata.";
    elTeamsManagerList.appendChild(empty);
  } else {
    names.forEach(name => {
      const item = document.createElement("li");
      item.className = "teams-manager-item" + (name === teamsManagerSelectedName ? " selected" : "");
      item.dataset.teamName = name;
      item.textContent = name;
      item.addEventListener("click", () => {
        teamsManagerSelectedName = name;
        renderTeamsManagerList();
      });
      elTeamsManagerList.appendChild(item);
    });
  }
  const hasSelection = !!teamsManagerSelectedName;
  if (elTeamsManagerDelete) elTeamsManagerDelete.disabled = !hasSelection;
  if (elTeamsManagerDuplicate) elTeamsManagerDuplicate.disabled = !hasSelection;
  if (elTeamsManagerExport) elTeamsManagerExport.disabled = !hasSelection;
}
function openTeamsManagerModal() {
  if (!elTeamsManagerModal) return;
  teamsManagerSelectedName = state.selectedTeam || "";
  renderTeamsManagerList();
  elTeamsManagerModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}
function closeTeamsManagerModal() {
  if (!elTeamsManagerModal) return;
  elTeamsManagerModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}
function importTeamToStorageOnly(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const raw = evt && evt.target ? String(evt.target.result || "") : "";
      const data = JSON.parse(raw);
      const normalized =
        typeof normalizeTeamPayload === "function" ? normalizeTeamPayload(data) : data;
      const name = normalized && normalized.name ? normalized.name.trim() : "";
      if (!name) {
        alert("Il file non contiene un nome squadra valido.");
        return;
      }
      if (typeof saveTeamToStorage === "function") {
        saveTeamToStorage(name, normalized);
      }
      if (typeof syncTeamsFromStorage === "function") syncTeamsFromStorage();
      if (typeof renderTeamsSelect === "function") renderTeamsSelect();
      teamsManagerSelectedName = name;
      renderTeamsManagerList();
      alert("Squadra importata: " + name);
    } catch (err) {
      logError("Errore importazione squadra (manager)", err);
      alert("File squadra non valido.");
    }
  };
  reader.readAsText(file);
}
function removeOrphanPlayersFromDb() {
  const teamsMap = typeof loadTeamsMapFromStorage === "function" ? loadTeamsMapFromStorage() : state.savedTeams || {};
  const usage = buildPlayersDbUsage(teamsMap);
  const db = Object.assign({}, state.playersDb || {});
  const ids = Object.keys(db);
  const orphans = ids.filter(id => !usage[id] || usage[id].length === 0);
  if (orphans.length === 0) {
    alert("Non ci sono giocatrici senza squadra.");
    return;
  }
  const ok = confirm("Rimuovere " + orphans.length + " giocatrici senza squadra dall'archivio?");
  if (!ok) return;
  orphans.forEach(id => {
    delete db[id];
  });
  state.playersDb = db;
  if (typeof savePlayersDbToStorage === "function") {
    savePlayersDbToStorage(db);
  }
  renderPlayersDbList();
}
const BULK_EDIT_CONFIG = {
  videoTime: {
    label: "Tempo video",
    build: ({ proxy, context }) => {
      const baseMs = context && typeof context.baseMs === "number" ? context.baseMs : null;
      const first = proxy && proxy.t ? computeEventVideoTime(proxy, baseMs) : 0;
      return createVideoTimeInput(proxy, first, () => {});
    }
  },
  set: {
    label: "Set",
    build: ({ proxy }) => createNumberSelect(proxy, "set", 1, 5, () => {})
  },
  player: {
    label: "Giocatrice",
    build: ({ proxy }) => createPlayerSelect(proxy, () => {})
  },
  setter: {
    label: "Alzatore",
    build: ({ proxy }) => createPlayerSelect(proxy, () => {}, { target: "setter" })
  },
  skill: {
    label: "Fondamentale",
    build: ({ proxy }) => createSkillSelect(proxy, () => {})
  },
  code: {
    label: "Codice",
    build: ({ proxy }) => createCodeSelect(proxy, () => {})
  },
  rotation: {
    label: "Rotazione",
    build: ({ proxy }) => createNumberSelect(proxy, "rotation", 1, 6, () => {})
  },
  zone: {
    label: "Zona",
    build: ({ proxy }) => createNumberSelect(proxy, "zone", 1, 6, () => {})
  },
  setterPosition: {
    label: "Posizione palleggio",
    build: ({ proxy }) => createNumberSelect(proxy, "setterPosition", 1, 6, () => {})
  },
  opponentSetterPosition: {
    label: "Posizione palleggio avv",
    build: ({ proxy }) => createNumberSelect(proxy, "opponentSetterPosition", 1, 6, () => {})
  },
  receivePosition: {
    label: "Zona ricezione",
    build: ({ proxy }) => createNumberSelect(proxy, "receivePosition", 1, 6, () => {})
  },
  base: {
    label: "Base",
    build: ({ proxy }) => createBaseSelect(proxy, () => {})
  },
  setType: {
    label: "Tipo alzata",
    build: ({ proxy }) => createSetTypeSelect(proxy, () => {})
  },
  combination: {
    label: "Combinazione",
    build: ({ proxy }) => createTextInput(proxy, "combination", () => {})
  },
  serveType: {
    label: "Tipo servizio",
    build: ({ proxy }) => createServeTypeSelect(proxy, () => {})
  },
  receiveEvaluation: {
    label: "Valutazione ricezione",
    build: ({ proxy }) => createEvalSelect(proxy, "receiveEvaluation", () => {}, { includeFb: true })
  },
  attackEvaluation: {
    label: "Valutazione attacco",
    build: ({ proxy }) => createEvalSelect(proxy, "attackEvaluation", () => {})
  },
  attackBp: {
    label: "Fase attacco",
    build: ({ proxy }) => createPhaseSelect(proxy, () => {})
  },
  attackType: {
    label: "Tipo attacco",
    build: ({ proxy }) => createTextInput(proxy, "attackType", () => {})
  },
  blockNumber: {
    label: "Numero muro",
    build: ({ proxy }) => createNumberInput(proxy, "blockNumber", 0, undefined, () => {})
  },
  playerIn: {
    label: "In",
    build: ({ proxy }) => createPlayerNameSelect(proxy, "playerIn", () => {})
  },
  playerOut: {
    label: "Out",
    build: ({ proxy }) => createPlayerNameSelect(proxy, "playerOut", () => {})
  },
  durationMs: {
    label: "Durata (ms)",
    build: ({ proxy }) => createNumberInput(proxy, "durationMs", 0, undefined, () => {})
  }
};
const elBtnFreeball = document.getElementById("btn-freeball");
const elBtnFreeballOpp = document.getElementById("btn-freeball-opp");
const elBtnToggleCourtView = document.getElementById("btn-toggle-court-view");
const elNextSkillIndicator = document.getElementById("next-skill-indicator");
const elSetTypeShortcuts = document.getElementById("set-type-shortcuts");
const elSetTypeCurrent = document.getElementById("set-type-current");
const elBtnOffsetSkills = document.getElementById("btn-offset-skills");
const elBtnVideoUndo = document.getElementById("btn-video-undo");
const elOffsetModal = document.getElementById("offset-modal");
const elOffsetSkillGrid = document.getElementById("offset-skill-grid");
const elOffsetClose = document.getElementById("offset-close");
const elOffsetApply = document.getElementById("offset-apply");
const elBtnUnifyTimes = document.getElementById("btn-unify-times");
const elUnifyTimesModal = document.getElementById("unify-times-modal");
const elUnifyTimesGrid = document.getElementById("unify-times-grid");
const elUnifyTimesClose = document.getElementById("unify-times-close");
const elUnifyTimesApply = document.getElementById("unify-times-apply");
const elBtnSkillDuration = document.getElementById("btn-skill-duration");
const elSkillDurationModal = document.getElementById("skill-duration-modal");
const elSkillDurationGrid = document.getElementById("skill-duration-grid");
const elSkillDurationClose = document.getElementById("skill-duration-close");
const elSkillDurationApply = document.getElementById("skill-duration-apply");
const elBtnTimeout = document.getElementById("btn-timeout");
const elBtnTimeoutOpp = document.getElementById("btn-timeout-opp");
const elTimeoutCount = document.getElementById("timeout-count");
const elTimeoutOppCount = document.getElementById("timeout-opp-count");
const elSubstitutionRemaining = document.getElementById("substitution-remaining");
const elSubstitutionRemainingOpp = document.getElementById("substitution-remaining-opp");
const LOCAL_VIDEO_CACHE = "volley-video-cache";
const LOCAL_VIDEO_REQUEST = "/__local-video__";
const LOCAL_VIDEO_DB = "volley-video-db";
const LOCAL_VIDEO_STORE = "videos";
const TAB_ORDER = ["info", "scout", "aggregated", "video"];
function buildReceiveDisplayMapping(court, rotation, scope = "our") {
  if (typeof buildAutoRolePermutation === "function") {
    const perm =
      buildAutoRolePermutation({
        baseLineup: court,
        rotation,
        phase: "receive",
        isServing: state.isServing,
        autoRoleP1American: scope === "opponent"
          ? !!state.opponentAutoRoleP1American
          : !!state.autoRoleP1American
      }) || [];
    return perm.map(item => ({
      slot: (item && item.slot) || { main: "", replaced: "" },
      idx: typeof item.idx === "number" ? item.idx : 0
    }));
  }
  const base = ensureCourtShapeFor(court);
  const mapping = base.map((slot, idx) => ({ slot, idx }));
  const rot = Math.min(6, Math.max(1, parseInt(rotation, 10) || 1));
  if (typeof INTELLISCOUT_RECEIVE_ASSIGNMENTS !== "undefined") {
    const pairs = INTELLISCOUT_RECEIVE_ASSIGNMENTS[rot] || [];
    const snapshot = mapping.slice();
    pairs.forEach(([targetIdx, sourceIdx]) => {
      if (targetIdx == null || sourceIdx == null) return;
      if (!snapshot[sourceIdx]) return;
      mapping[targetIdx] = snapshot[sourceIdx];
    });
    return mapping;
  }
  if (typeof applyReceivePattern === "function") {
    return applyReceivePattern(mapping, rot);
  }
  return mapping;
}
function getAutoRoleDisplayCourt(forSkillId = null, scope = "our") {
  const useAuto = !!state.autoRolePositioning;
  const opponentBase =
    useAuto && scope === "opponent" && state.opponentAutoRoleBaseCourt && state.opponentAutoRoleBaseCourt.length === 6
      ? ensureCourtShapeFor(state.opponentAutoRoleBaseCourt)
      : ensureCourtShapeFor(state.opponentCourt);
  const baseCourt =
    useAuto && scope === "our" && autoRoleBaseCourt
      ? ensureCourtShapeFor(autoRoleBaseCourt)
      : scope === "opponent"
        ? opponentBase
        : ensureCourtShapeFor(state.court);
  const servingCourt = isServingForScope(scope) ? getServeDisplayCourt(scope) : null;
  const effectiveBase = servingCourt ? ensureCourtShapeFor(servingCourt) : baseCourt;
  if (!useAuto) {
    return effectiveBase.map((slot, idx) => ({ slot, idx }));
  }
  if (forSkillId === "serve") {
    return ensureCourtShapeFor(effectiveBase).map((slot, idx) => ({ slot, idx }));
  }
  if (forSkillId === "pass") {
    const rotation = scope === "opponent" ? state.opponentRotation : state.rotation;
    return buildReceiveDisplayMapping(effectiveBase, rotation || 1, scope);
  }
  const phase = forSkillId ? getCurrentPhase(scope) : isServingForScope(scope) ? "attack" : "receive";
  if (typeof buildAutoRolePermutation === "function") {
    const perm =
      buildAutoRolePermutation({
        baseLineup: effectiveBase,
        rotation: scope === "opponent" ? state.opponentRotation || 1 : state.rotation || 1,
        phase,
        isServing: scope === "opponent" ? !state.isServing : state.isServing,
        autoRoleP1American: scope === "opponent"
          ? !!state.opponentAutoRoleP1American
          : !!state.autoRoleP1American
      }) || [];
    return perm.map(item => ({
      slot: (item && item.slot) || { main: "", replaced: "" },
      idx: typeof item.idx === "number" ? item.idx : 0
    }));
  }
  return ensureCourtShapeFor(effectiveBase).map((slot, idx) => ({ slot, idx }));
}
function valueToString(val) {
  if (val === null || val === undefined) return "";
  if (Array.isArray(val) || typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch (_) {
      return String(val);
    }
  }
  return String(val);
}
function parseInputValue(raw) {
  const str = (raw || "").trim();
  if (str === "") return null;
  // Try JSON first (for arrays/objects/booleans/null/numbers)
  try {
    return JSON.parse(str);
  } catch (_) {
    const num = parseFloat(str);
    if (!Number.isNaN(num)) return num;
    return str;
  }
}
function formatAttackPhaseLabel(val) {
  const phase = normalizePhaseValue(val);
  if (phase === "bp") return "BP";
  if (phase === "so") return "SO";
  return "";
}
function createNumberInput(ev, field, min, max, onDone) {
  const input = document.createElement("input");
  input.type = "number";
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  input.value = ev[field] === null || ev[field] === undefined ? "" : String(ev[field]);
  input.addEventListener("change", () => {
    markVideoUndoCapture(input);
    const val = parseFloat(input.value);
    if (!Number.isNaN(val) && (min === undefined || val >= min) && (max === undefined || val <= max)) {
      ev[field] = val;
      refreshAfterVideoEdit(true);
    }
  });
  input.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
    renderEventsLog();
  });
  return input;
}
function createTextInput(ev, field, onDone) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = valueToString(ev[field]);
  input.addEventListener("change", () => {
    markVideoUndoCapture(input);
    ev[field] = parseInputValue(input.value);
    refreshAfterVideoEdit(false);
  });
  input.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
    renderEventsLog();
  });
  return input;
}
function createCheckboxInput(ev, field, onDone) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!ev[field];
  input.addEventListener("change", () => {
    ev[field] = input.checked;
    refreshAfterVideoEdit(false);
  });
  input.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
    renderEventsLog();
  });
  return input;
}
function getNextEventId() {
  const maxId = (state.events || []).reduce((max, ev) => {
    const val = typeof ev.eventId === "number" ? ev.eventId : 0;
    return val > max ? val : max;
  }, 0);
  return maxId + 1;
}
function ensureSkillClock() {
  state.skillClock = state.skillClock || { paused: false, pausedAtMs: null, pausedAccumMs: 0, lastEffectiveMs: null };
  if (typeof state.skillClock.paused !== "boolean") state.skillClock.paused = false;
  if (typeof state.skillClock.pausedAccumMs !== "number") state.skillClock.pausedAccumMs = 0;
  return state.skillClock;
}
function getSkillClockMs() {
  ensureSkillClock();
  if (state.skillClock.paused) {
    return state.skillClock.lastEffectiveMs || 0;
  }
  return Date.now() - (state.skillClock.pausedAccumMs || 0);
}
function pauseSkillClock() {
  ensureSkillClock();
  if (state.skillClock.paused) return;
  state.skillClock.lastEffectiveMs = getSkillClockMs();
  state.skillClock.pausedAtMs = Date.now();
  state.skillClock.paused = true;
}
function resumeSkillClock() {
  ensureSkillClock();
  if (!state.skillClock.paused) return;
  const now = Date.now();
  const pausedAt = state.skillClock.pausedAtMs || now;
  state.skillClock.pausedAccumMs = (state.skillClock.pausedAccumMs || 0) + Math.max(0, now - pausedAt);
  state.skillClock.paused = false;
  state.skillClock.pausedAtMs = null;
  state.skillClock.lastEffectiveMs = null;
}
function ensureVideoClock() {
  const offset = state.video && typeof state.video.offsetSeconds === "number" ? state.video.offsetSeconds : 0;
  state.videoClock = state.videoClock || {
    startMs: Date.now(),
    paused: false,
    pausedAtMs: null,
    pausedAccumMs: 0,
    currentSeconds: offset
  };
  if (typeof state.videoClock.paused !== "boolean") state.videoClock.paused = false;
  if (typeof state.videoClock.pausedAccumMs !== "number") state.videoClock.pausedAccumMs = 0;
  if (typeof state.videoClock.startMs !== "number") state.videoClock.startMs = Date.now();
  if (typeof state.videoClock.currentSeconds !== "number") state.videoClock.currentSeconds = offset;
  return state.videoClock;
}
function getVideoClockSeconds() {
  ensureVideoClock();
  const offset = state.video && typeof state.video.offsetSeconds === "number" ? state.video.offsetSeconds : 0;
  if (state.videoClock.paused) {
    return state.videoClock.currentSeconds || offset;
  }
  const elapsed = Date.now() - (state.videoClock.startMs || Date.now()) - (state.videoClock.pausedAccumMs || 0);
  const seconds = Math.max(0, offset + elapsed / 1000);
  state.videoClock.currentSeconds = seconds;
  return seconds;
}
function pauseVideoClock() {
  ensureVideoClock();
  if (state.videoClock.paused) return;
  state.videoClock.currentSeconds = getVideoClockSeconds();
  state.videoClock.pausedAtMs = Date.now();
  state.videoClock.paused = true;
}
function resumeVideoClock() {
  ensureVideoClock();
  if (!state.videoClock.paused) return;
  const now = Date.now();
  const pausedAt = state.videoClock.pausedAtMs || now;
  state.videoClock.pausedAccumMs = (state.videoClock.pausedAccumMs || 0) + Math.max(0, now - pausedAt);
  state.videoClock.paused = false;
  state.videoClock.pausedAtMs = null;
}
function getActiveVideoPlaybackSeconds() {
  const activeTab = document && document.body ? document.body.dataset.activeTab : "";
  const preferScout = !!state.videoScoutMode && activeTab !== "video";
  if (state.video && state.video.youtubeId) {
    const scoutFirst =
      preferScout &&
      ytPlayerScout &&
      ytPlayerScoutReady &&
      typeof ytPlayerScout.getCurrentTime === "function";
    if (scoutFirst) {
      const t = ytPlayerScout.getCurrentTime();
      if (isFinite(t)) return Math.max(0, t);
    }
    if (ytPlayer && ytPlayerReady && typeof ytPlayer.getCurrentTime === "function") {
      const t = ytPlayer.getCurrentTime();
      if (isFinite(t)) return Math.max(0, t);
    }
    if (
      ytPlayerScout &&
      ytPlayerScoutReady &&
      typeof ytPlayerScout.getCurrentTime === "function"
    ) {
      const t = ytPlayerScout.getCurrentTime();
      if (isFinite(t)) return Math.max(0, t);
    }
    return null;
  }
  if (preferScout && elAnalysisVideoScout && typeof elAnalysisVideoScout.currentTime === "number") {
    return Math.max(0, elAnalysisVideoScout.currentTime || 0);
  }
  if (elAnalysisVideo && typeof elAnalysisVideo.currentTime === "number") {
    return Math.max(0, elAnalysisVideo.currentTime || 0);
  }
  if (elAnalysisVideoScout && typeof elAnalysisVideoScout.currentTime === "number") {
    return Math.max(0, elAnalysisVideoScout.currentTime || 0);
  }
  return null;
}
function isVideoElementPlaying(videoEl) {
  return !!(videoEl && !videoEl.paused && !videoEl.ended && videoEl.readyState >= 2);
}
function isYoutubePlayerPlaying(player, readyFlag) {
  if (!readyFlag || !player || typeof player.getPlayerState !== "function") return false;
  try {
    return player.getPlayerState() === 1;
  } catch (_) {
    return false;
  }
}
function isVideoPlaybackActive() {
  if (state.video && state.video.youtubeId) {
    if (isYoutubePlayerPlaying(ytPlayerScout, ytPlayerScoutReady)) return true;
    if (isYoutubePlayerPlaying(ytPlayer, ytPlayerReady)) return true;
    return false;
  }
  return isVideoElementPlaying(elAnalysisVideoScout) || isVideoElementPlaying(elAnalysisVideo);
}
function scheduleVideoSafeRender(task) {
  if (typeof task !== "function") return;
  if (!state.videoScoutMode || !isVideoPlaybackActive()) {
    task();
    return;
  }
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(task, { timeout: 200 });
    return;
  }
  setTimeout(task, 60);
}
function scheduleRenderPlayers() {
  scheduleVideoSafeRender(renderPlayers);
}
function schedulePostEventUpdates({
  suppressScroll = false,
  includeAggregates = true,
  append = true,
  playerIdx = null,
  skillId = null,
  persistLocal = false,
  scope = "our"
} = {}) {
  scheduleVideoSafeRender(() => {
    saveState({ persistLocal });
    if (scope === "our" && typeof playerIdx === "number" && skillId) {
      updateSkillStatsUI(playerIdx, skillId);
    }
    renderPlayers();
    renderEventsLog({ suppressScroll, append });
    if (includeAggregates) {
      renderLiveScore();
      renderScoreAndRotations(computePointsSummary());
      renderAggregatedTable();
      renderVideoAnalysis();
      renderTrajectoryAnalysis();
      renderServeTrajectoryAnalysis();
    }
  });
}
function applySavedPlaybackToVideo(videoEl) {
  if (!videoEl || !state.video) return;
  const saved = state.video.lastPlaybackSeconds;
  if (typeof saved !== "number" || !isFinite(saved)) return;
  const target = Math.max(0, saved);
  const applyTime = () => {
    try {
      videoEl.currentTime = target;
    } catch (_) {
      // ignore seek errors
    }
  };
  if (videoEl.readyState >= 1) {
    applyTime();
    return;
  }
  const onMeta = () => {
    applyTime();
    videoEl.removeEventListener("loadedmetadata", onMeta);
  };
  videoEl.addEventListener("loadedmetadata", onMeta);
}
function updateVideoPlaybackSnapshot(forcedSeconds = null, force = false) {
  if (!state.video) return;
  const now = Date.now();
  if (!force && now - lastVideoSnapshotMs < 1500) return;
  const playback =
    typeof forcedSeconds === "number" && isFinite(forcedSeconds)
      ? forcedSeconds
      : getActiveVideoPlaybackSeconds();
  if (typeof playback !== "number" || !isFinite(playback)) return;
  lastVideoSnapshotMs = now;
  state.video.lastPlaybackSeconds = Math.max(0, playback);
  saveState({ persistLocal: true });
}
function startVideoPlaybackSnapshotTimer() {
  if (videoSnapshotTimer) return;
  videoSnapshotTimer = setInterval(() => {
    if (!state.video || !state.video.youtubeId) return;
    updateVideoPlaybackSnapshot();
  }, 2000);
}
function getEventVideoSeconds(baseVideoTime = null) {
  if (typeof baseVideoTime === "number") return Math.max(0, baseVideoTime);
  if (state.videoScoutMode) {
    const playback = getActiveVideoPlaybackSeconds();
    if (typeof playback === "number") return Math.max(0, playback);
  }
  if (!state.events || state.events.length === 0) {
    ensureVideoClock();
    if (
      state.videoClock.paused &&
      (state.videoClock.currentSeconds || 0) === 0 &&
      state.videoClock.pausedAccumMs === 0
    ) {
      state.videoClock.startMs = Date.now();
      state.videoClock.currentSeconds = 0;
      state.videoClock.paused = false;
      state.videoClock.pausedAtMs = null;
    }
    return 0;
  }
  return getVideoClockSeconds();
}
function buildBaseEventPayload(base) {
  ensureSkillClock();
  if (
    (!state.events || state.events.length === 0) &&
    state.skillClock &&
    state.skillClock.pausedAccumMs === 0 &&
    !state.skillClock.pausedAtMs &&
    !state.skillClock.lastEffectiveMs
  ) {
    state.skillClock.pausedAccumMs = Date.now();
    state.skillClock.paused = false;
    state.skillClock.pausedAtMs = null;
    state.skillClock.lastEffectiveMs = 0;
  }
  ensureVideoClock();
  if (
    (!state.events || state.events.length === 0) &&
    state.videoClock &&
    state.videoClock.paused &&
    state.videoClock.pausedAccumMs === 0 &&
    !state.videoClock.pausedAtMs &&
    (state.videoClock.currentSeconds || 0) === 0
  ) {
    const offset = state.video && typeof state.video.offsetSeconds === "number" ? state.video.offsetSeconds : 0;
    state.videoClock.startMs = Date.now();
    state.videoClock.currentSeconds = Math.max(0, offset);
    state.videoClock.paused = false;
    state.videoClock.pausedAtMs = null;
  }
  const now = new Date();
  const nowIso = now.toISOString();
  const clockMs = getSkillClockMs();
  let videoSeconds = getEventVideoSeconds(base && base.videoTime);
  if (
    (!state.events || state.events.length === 0) &&
    !state.videoScoutMode &&
    !(base && typeof base.videoTime === "number")
  ) {
    ensureVideoClock();
    state.videoClock.startMs = Date.now();
    state.videoClock.pausedAccumMs = 0;
    state.videoClock.paused = false;
    state.videoClock.pausedAtMs = null;
    state.videoClock.currentSeconds = 0;
    videoSeconds = 0;
  }
  const teamScope = (base && (base.teamScope || base.team)) || "our";
  const rotationValue = teamScope === "opponent" ? state.opponentRotation : state.rotation;
  const rotation = Math.min(6, Math.max(1, parseInt(rotationValue, 10) || 1));
  const scoreSnapshot = computePointsSummary(state.currentSet || 1);
  const zone =
    typeof base.playerIdx === "number"
      ? getCurrentZoneForPlayer(base.playerIdx, base.skillId, teamScope)
      : null;
  const lastEvent = state.events && state.events.length > 0 ? state.events[state.events.length - 1] : null;
  const lastEventTime = lastEvent ? lastEvent.t : null;
  const durationMs = getDefaultSkillDurationMs();
  return {
    eventId: getNextEventId(),
    t: nowIso,
    durationMs: durationMs,
    clockMs,
    set: state.currentSet,
    rotation,
    courtSideSwapped: !!state.courtSideSwapped,
    playerIdx: base.playerIdx,
    playerName:
      base.playerName ||
      (typeof base.playerIdx === "number"
        ? getPlayersForScope(teamScope)[base.playerIdx]
        : base.playerName) ||
      null,
    zone,
    originZone: zone,
    skillId: base.skillId,
    code: base.code,
    pointDirection: base.pointDirection || null,
    value: base.value,
    autoRotationDirection: null,
    autoRotateNext: null,
    setterPosition: rotation,
    opponentSetterPosition:
      teamScope === "opponent"
        ? Math.min(6, Math.max(1, parseInt(state.rotation, 10) || 1))
        : Math.min(6, Math.max(1, parseInt(state.opponentRotation, 10) || 1)),
    playerPosition: zone,
    receivePosition: null,
    base: base.base || null,
    setType: base.setType || null,
    combination: base.combination || null,
    serveStart: null,
    serveEnd: null,
    serveType: null,
    receiveEvaluation: null,
    attackEvaluation: null,
    attackBp: null,
    attackType: null,
    attackStartZone: null,
    attackEndZone: null,
    attackStart: null,
    attackEnd: null,
    attackDirection: null,
    blockNumber: null,
    errorType: base.errorType || null,
    playerIn: base.playerIn || null,
    playerOut: base.playerOut || null,
    relatedEvents: base.relatedEvents || [],
    team: teamScope === "opponent" ? "opponent" : "our",
    teamName: getTeamNameForScope(teamScope),
    homeScore: scoreSnapshot.totalFor || 0,
    visitorScore: scoreSnapshot.totalAgainst || 0,
    actionType: base.actionType || null,
    prevSet: base.prevSet || null,
    nextSet: base.nextSet || null,
    prevMatchFinished: base.prevMatchFinished || null,
    nextMatchFinished: base.nextMatchFinished || null,
    prevClock: base.prevClock || null,
    nextClock: base.nextClock || null,
    prevVideoClock: base.prevVideoClock || null,
    nextVideoClock: base.nextVideoClock || null,
    videoTime: videoSeconds
  };
}
function renderSkillChoice(playerIdx, playerName, scope = "our") {
  if (state.matchFinished) {
    alert("Partita in pausa. Riprendi per continuare lo scout.");
    return;
  }
  if (!elSkillModalBody) return;
  activeSkillModalContext = { playerIdx, playerName: playerName || null, skillId: null, scope };
  updateSetTypeVisibility(getPredictedSkillIdForScope(scope) || getPredictedSkillId());
  modalMode = "skill";
  modalSubPosIdx = -1;
  elSkillModalBody.innerHTML = "";
  const players = getPlayersForScope(scope);
  if (elSkillModalTitle) {
    const title =
      (scope === "opponent"
        ? formatNameWithNumberFor(playerName || players[playerIdx], getPlayerNumbersForScope(scope))
        : formatNameWithNumber(playerName || players[playerIdx])) ||
      (playerName || "Giocatrice");
    elSkillModalTitle.textContent = title + " · scegli fondamentale";
  }
  const enabledSkills = getEnabledSkillsForScope(scope);
  if (enabledSkills.length === 0) {
    const empty = document.createElement("div");
    empty.className = "players-empty";
    empty.textContent = "Abilita almeno un fondamentale nelle impostazioni per scoutizzare.";
    elSkillModalBody.appendChild(empty);
    return;
  }
  const grid = document.createElement("div");
  grid.className = "modal-skill-grid";
  enabledSkills.forEach(skill => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "modal-skill-btn";
    btn.innerHTML = `<span>${skill.label}</span><span class="modal-skill-badge badge-${skill.id}">${skill.label[0]}</span>`;
    btn.addEventListener("click", () => renderSkillCodes(playerIdx, playerName, skill.id, scope));
    grid.appendChild(btn);
  });
  elSkillModalBody.appendChild(grid);
}
function renderSkillCodes(playerIdx, playerName, skillId, scope = "our") {
  if (!elSkillModalBody) return;
  activeSkillModalContext = { playerIdx, playerName: playerName || null, skillId, scope };
  const predicted = getPredictedSkillIdForScope(scope) || getPredictedSkillId();
  updateSetTypeVisibility(skillId === "attack" ? "attack" : predicted);
  modalMode = "skill-codes";
  modalSubPosIdx = -1;
  elSkillModalBody.innerHTML = "";
  const skill = SKILLS.find(s => s.id === skillId);
  const players = getPlayersForScope(scope);
  const nameValue = playerName || players[playerIdx];
  const title =
    (scope === "opponent"
      ? formatNameWithNumberFor(nameValue, getPlayerNumbersForScope(scope))
      : formatNameWithNumber(nameValue)) ||
    (nameValue || "Giocatrice");
  if (elSkillModalTitle) {
    elSkillModalTitle.textContent =
      (skill ? skill.label + " · " : "") + title;
  }
  const header = document.createElement("div");
  header.className = "modal-skill-head";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "secondary modal-skill-back";
  backBtn.textContent = "Indietro";
  backBtn.addEventListener("click", () => {
    delete serveMetaByPlayer[makePlayerKey(scope, playerIdx)];
    clearServeTypeInlineListener();
    clearAttackSelection(playerIdx, scope);
    renderSkillChoice(playerIdx, playerName, scope);
  });
  header.appendChild(backBtn);
  elSkillModalBody.appendChild(header);

  const playerKey = makePlayerKey(scope, playerIdx);
  if (skillId !== "serve" && serveTypeInlinePlayer === playerKey) {
    clearServeTypeInlineListener();
  }
  if (skillId !== "attack" && attackInlinePlayer === playerKey) {
    clearAttackSelection(playerIdx, scope);
  }
  if (skillId === "serve" && !serveMetaByPlayer[playerKey]) {
    if (serveTypeInlinePlayer !== null && serveTypeInlinePlayer !== playerKey) {
      return;
    }
    const typeWrap = document.createElement("div");
    typeWrap.className = "modal-skill-codes";
    typeWrap.addEventListener("pointerdown", () => setServeTypeFocusPlayer(playerIdx, scope));
    setServeTypeFocusPlayer(playerIdx, scope);
    const types = [
      { id: "F", label: "Float (F)" },
      { id: "JF", label: "Jump float (JF)" },
      { id: "S", label: "Spin (S)" }
    ];
    const handleSelect = async type => {
      await startServeTypeSelection(playerIdx, type, () => {
        renderSkillCodes(playerIdx, playerName, skillId, scope);
      });
    };
    types.forEach(t => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "event-btn";
      btn.textContent = t.label;
      btn.addEventListener("click", () => handleSelect(t.id));
      typeWrap.appendChild(btn);
    });
    bindServeTypeInlineListener(playerIdx, handleSelect, scope);
    elSkillModalBody.appendChild(typeWrap);
    return;
  }
  if (skillId === "attack" && !getAttackMetaForPlayer(scope, playerIdx)) {
    if (
      attackInlinePlayer !== null &&
      attackInlinePlayer !== playerKey &&
      isPlayerKeyInScope(attackInlinePlayer, scope)
    ) {
      return;
    }
    if (shouldPromptAttackSetType(scope)) {
      const queuedSetType = normalizeSetTypeValue(queuedSetTypeChoice);
      if (queuedSetType) {
        startAttackSelection(playerIdx, queuedSetType, () => {
          const key = makePlayerKey(scope, playerIdx);
          if (attackMetaByPlayer[key]) {
            attackMetaByPlayer[key].fromNextSetType = true;
          }
          queuedSetTypeChoice = null;
          setNextSetType("");
          renderSkillCodes(playerIdx, playerName, skillId, scope);
        }, scope);
        return;
      }
      const wrap = document.createElement("div");
      wrap.className = "modal-skill-codes";
      const setTypeOptions = isSetterPlayerForScope(scope, playerIdx)
        ? [{ value: "Damp", label: "Damp" }]
        : DEFAULT_SET_TYPE_OPTIONS;
      setTypeOptions.forEach(opt => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "event-btn";
        btn.textContent = formatSetTypeLabelWithShortcut(opt.value, opt.label);
        btn.addEventListener("click", async () => {
          await startAttackSelection(playerIdx, opt.value, () => {
            renderSkillCodes(playerIdx, playerName, skillId, scope);
          });
        });
        wrap.appendChild(btn);
      });
      elSkillModalBody.appendChild(wrap);
    } else {
      if (attackInlinePlayer === playerKey) return;
      startAttackSelection(playerIdx, null, () => {
        renderSkillCodes(playerIdx, playerName, skillId, scope);
      });
    }
    return;
  }

  const codesWrap = document.createElement("div");
  codesWrap.className = "modal-skill-codes";
  const codes = (state.metricsConfig?.[skillId]?.activeCodes || RESULT_CODES).slice();
  if (!codes.includes("/")) codes.push("/");
  if (!codes.includes("=")) codes.push("=");
  const ordered = codes.filter(c => c !== "/" && c !== "=").concat("/", "=");
  ordered.forEach(code => {
    const btn = document.createElement("button");
    btn.type = "button";
    const tone = typeof getCodeTone === "function" ? getCodeTone(skillId, code) : "neutral";
    btn.className = "event-btn code-" + tone;
    btn.textContent = code;
    btn.dataset.playerIdx = String(playerIdx);
    btn.dataset.playerName = nameValue;
    btn.dataset.skillId = skillId;
    btn.dataset.code = code;
    btn.addEventListener("click", async e => {
      const attackMeta = getAttackMetaForPlayer(scope, playerIdx);
      const usedQueuedSetType =
        skillId === "attack" &&
        attackMeta &&
        attackMeta.fromNextSetType;
      const success = await handleEventClick(
        playerIdx,
        skillId,
        code,
        playerName,
        e.currentTarget,
        {
          serveMeta: serveMetaByPlayer[playerKey] || null,
          attackMeta: attackMeta || null,
          scope
        }
      );
      if (success) {
        delete serveMetaByPlayer[playerKey];
        if (skillId === "serve") {
          clearServeTypeInlineListener();
        }
        if (skillId === "attack") {
          if (usedQueuedSetType) {
            setNextSetType("");
          }
          clearAttackSelection(playerIdx, scope);
        }
        closeSkillModal();
      }
    });
    codesWrap.appendChild(btn);
  });
  elSkillModalBody.appendChild(codesWrap);

  const extraRow = document.createElement("div");
  extraRow.className = "modal-skill-extra";
  const errorBtn = document.createElement("button");
  errorBtn.type = "button";
  errorBtn.className = "small event-btn danger full-width";
  errorBtn.textContent = "Errore/Fallo";
  errorBtn.addEventListener("click", () => {
    openErrorModal({
      playerIdx,
      playerName: nameValue,
      scope
    });
    closeSkillModal();
  });
  extraRow.appendChild(errorBtn);
  elSkillModalBody.appendChild(extraRow);
}
function openSkillModal(playerIdx, playerName, scope = "our") {
  if (!elSkillModal || !elSkillModalBody) return;
  if (isDesktopCourtModalLayout()) {
    setCourtAreaLocked(true);
  }
  updateCourtModalPlacement();
  const idx = typeof playerIdx === "number" ? playerIdx : parseInt(playerIdx, 10);
  const players = getPlayersForScope(scope);
  if (isNaN(idx) || !players[idx]) return;
  renderSkillChoice(idx, playerName, scope);
  elSkillModal.classList.remove("hidden");
  setModalOpenState(true);
}
function openSkillCodesModal(playerIdx, playerName, skillId, scope = "our") {
  if (!elSkillModal || !elSkillModalBody) return;
  if (isDesktopCourtModalLayout()) {
    setCourtAreaLocked(true);
  }
  updateCourtModalPlacement();
  const idx = typeof playerIdx === "number" ? playerIdx : parseInt(playerIdx, 10);
  const players = getPlayersForScope(scope);
  if (isNaN(idx) || !players[idx]) return;
  if (!skillId) return;
  renderSkillCodes(idx, playerName, skillId, scope);
  elSkillModal.classList.remove("hidden");
  setModalOpenState(true);
}
function openSubModal(posIdx) {
  if (!elSkillModal || !elSkillModalBody) return;
  if (isDesktopCourtModalLayout()) {
    setCourtAreaLocked(true);
  }
  updateCourtModalPlacement();
  modalMode = "sub";
  modalSubPosIdx = posIdx;
  elSkillModalBody.innerHTML = "";
  if (elSkillModalTitle) {
    elSkillModalTitle.textContent = "Sostituisci posizione " + (posIdx + 1);
  }
  const bench = getBenchPlayers();
  const liberos = getBenchLiberos();
  const candidates = Array.from(new Set([...bench, ...liberos]));
  if (candidates.length === 0) {
    const empty = document.createElement("div");
    empty.className = "players-empty";
    empty.textContent = "Nessuna riserva disponibile.";
    elSkillModalBody.appendChild(empty);
  } else {
    candidates.forEach(name => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isLib = (state.liberos || []).includes(name);
      btn.className = "sub-option-btn" + (isLib ? " libero" : "");
      btn.textContent = formatNameWithNumber(name);
      if (isLib) {
        const tag = document.createElement("span");
        tag.className = "sub-libero-tag";
        tag.textContent = "Libero";
        btn.appendChild(tag);
      }
      btn.addEventListener("click", () => {
        setCourtPlayer(posIdx, "main", name);
        closeSkillModal();
      });
      elSkillModalBody.appendChild(btn);
    });
  }
  elSkillModal.classList.remove("hidden");
  setModalOpenState(true);
}
function closeSkillModal() {
  if (!elSkillModal) return;
  elSkillModal.classList.add("hidden");
  setModalOpenState(false);
  activeSkillModalContext = null;
}
// esponi per gli handler inline (fallback mobile)
window._closeSkillModal = closeSkillModal;
function renderErrorModal() {
  if (!elErrorModalBody) return;
  elErrorModalBody.innerHTML = "";
  const scope = (errorModalPrefillPlayer && errorModalPrefillPlayer.scope) || "our";
  const typeSection = document.createElement("div");
  typeSection.className = "error-type-section";
  const typeLabel = document.createElement("p");
  typeLabel.className = "section-note";
  typeLabel.textContent = "Tipo errore:";
  typeSection.appendChild(typeLabel);
  const typeGrid = document.createElement("div");
  typeGrid.className = "error-choice-grid error-type-grid";
  ERROR_TYPES.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "error-choice-btn error-type-btn";
    btn.textContent = item.label;
    btn.dataset.errorType = item.id;
    btn.addEventListener("click", () => setSelectedErrorType(item.id, typeGrid));
    typeGrid.appendChild(btn);
  });
  typeSection.appendChild(typeGrid);
  elErrorModalBody.appendChild(typeSection);
  setSelectedErrorType(selectedErrorType || "Generic", typeGrid);
  const note = document.createElement("p");
  note.className = "section-note";
  note.textContent = "Seleziona la giocatrice a cui assegnare l'errore/fallo oppure applicalo alla squadra.";
  elErrorModalBody.appendChild(note);
  const grid = document.createElement("div");
  grid.className = "error-choice-grid";
  if (errorModalPrefillPlayer && typeof errorModalPrefillPlayer.playerIdx === "number") {
    const prefillName =
      errorModalPrefillPlayer.playerName ||
      (getPlayersForScope(scope) && getPlayersForScope(scope)[errorModalPrefillPlayer.playerIdx]) ||
      "Giocatrice";
    const preBtn = document.createElement("button");
    preBtn.type = "button";
    preBtn.className = "error-choice-btn";
    preBtn.textContent = "Applica a " + formatNameWithNumber(prefillName);
    preBtn.addEventListener("click", () => {
      addPlayerError(errorModalPrefillPlayer.playerIdx, prefillName, selectedErrorType, scope);
      errorModalPrefillPlayer = null;
      closeErrorModal();
    });
    grid.appendChild(preBtn);
  }
  const teamBtn = document.createElement("button");
  teamBtn.type = "button";
  teamBtn.className = "error-choice-btn danger";
  teamBtn.textContent = "Assegna alla squadra";
  teamBtn.addEventListener("click", () => {
    handleTeamError(selectedErrorType, scope);
    errorModalPrefillPlayer = null;
    closeErrorModal();
  });
  grid.appendChild(teamBtn);
  const players = getPlayersForScope(scope);
  if (!players || players.length === 0) {
    const empty = document.createElement("div");
    empty.className = "players-empty";
    empty.textContent = "Aggiungi giocatrici per assegnare l'errore.";
    elErrorModalBody.appendChild(empty);
    elErrorModalBody.appendChild(grid);
    return;
  }
  const entries =
    scope === "opponent"
      ? getSortedPlayerEntriesForScope(scope)
      : getSortedPlayerEntries();
  entries.forEach(({ name, idx }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "error-choice-btn";
    btn.textContent =
      scope === "opponent"
        ? formatNameWithNumberFor(name, getPlayerNumbersForScope(scope))
        : formatNameWithNumber(name);
    btn.addEventListener("click", () => {
      addPlayerError(idx, name, selectedErrorType, scope);
      errorModalPrefillPlayer = null;
      closeErrorModal();
    });
    grid.appendChild(btn);
  });
  elErrorModalBody.appendChild(grid);
}
function renderPointModal() {
  if (!elPointModalBody) return;
  elPointModalBody.innerHTML = "";
  const note = document.createElement("p");
  note.className = "section-note";
  note.textContent = "Seleziona la giocatrice a cui assegnare il punto oppure applicalo alla squadra.";
  elPointModalBody.appendChild(note);
  const grid = document.createElement("div");
  grid.className = "error-choice-grid";
  const teamBtn = document.createElement("button");
  teamBtn.type = "button";
  teamBtn.className = "error-choice-btn success";
  teamBtn.textContent = "Assegna alla squadra";
  teamBtn.addEventListener("click", () => {
    handleTeamPoint();
    closePointModal();
  });
  grid.appendChild(teamBtn);
  if (!state.players || state.players.length === 0) {
    const empty = document.createElement("div");
    empty.className = "players-empty";
    empty.textContent = "Aggiungi giocatrici per assegnare il punto.";
    elPointModalBody.appendChild(empty);
    elPointModalBody.appendChild(grid);
    return;
  }
  getSortedPlayerEntries().forEach(({ name, idx }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "error-choice-btn";
    btn.textContent = formatNameWithNumber(name);
    btn.addEventListener("click", () => {
      addPlayerPoint(idx, name);
      closePointModal();
    });
    grid.appendChild(btn);
  });
  elPointModalBody.appendChild(grid);
}
function openErrorModal(prefill = null) {
  if (!elErrorModal) return;
  errorModalPrefillPlayer = prefill;
  renderErrorModal();
  if (isDesktopCourtModalLayout()) {
    setCourtAreaLocked(true);
  }
  updateCourtModalPlacement();
  elErrorModal.classList.remove("hidden");
  setModalOpenState(true);
}
function closeErrorModal() {
  if (!elErrorModal) return;
  elErrorModal.classList.add("hidden");
  setModalOpenState(false);
}
function openPointModal() {
  if (!elPointModal) return;
  renderPointModal();
  if (isDesktopCourtModalLayout()) {
    setCourtAreaLocked(true);
  }
  updateCourtModalPlacement();
  elPointModal.classList.remove("hidden");
  setModalOpenState(true);
}
function closePointModal() {
  if (!elPointModal) return;
  elPointModal.classList.add("hidden");
  setModalOpenState(false);
}
function attachModalCloseHandlers() {
  const closeHandler = e => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    closeSkillModal();
  };
  const events = ["click", "pointerup", "pointerdown", "touchend", "touchstart"];
  const closeButtons = [elSkillModalClose, document.querySelector(".skill-modal__close-abs")];
  closeButtons.forEach(btn => {
    if (!btn) return;
    events.forEach(evt => {
      btn.addEventListener(evt, closeHandler, { passive: false, capture: true });
    });
    btn.onclick = closeHandler;
  });
  if (elSkillModalBackdrop) {
    events.forEach(evt =>
      elSkillModalBackdrop.addEventListener(evt, closeHandler, { passive: false })
    );
  }
  const closeAggSkillHandler = e => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    closeAggSkillModal();
  };
  if (elAggSkillModalClose) {
    events.forEach(evt => {
      elAggSkillModalClose.addEventListener(evt, closeAggSkillHandler, {
        passive: false,
        capture: true
      });
    });
    elAggSkillModalClose.onclick = closeAggSkillHandler;
  }
  if (elAggSkillModalBackdrop) {
    events.forEach(evt =>
      elAggSkillModalBackdrop.addEventListener(evt, closeAggSkillHandler, { passive: false })
    );
  }
  const closeErrorHandler = e => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    closeErrorModal();
  };
  const closePointHandler = e => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    closePointModal();
  };
  const errorCloseButtons = [elErrorModalClose];
  errorCloseButtons.forEach(btn => {
    if (!btn) return;
    events.forEach(evt => {
      btn.addEventListener(evt, closeErrorHandler, { passive: false, capture: true });
    });
    btn.onclick = closeErrorHandler;
  });
  if (elErrorModalBackdrop) {
    events.forEach(evt =>
      elErrorModalBackdrop.addEventListener(evt, closeErrorHandler, { passive: false })
    );
  }
  const pointCloseButtons = [elPointModalClose];
  pointCloseButtons.forEach(btn => {
    if (!btn) return;
    events.forEach(evt => {
      btn.addEventListener(evt, closePointHandler, { passive: false, capture: true });
    });
    btn.onclick = closePointHandler;
  });
  if (elPointModalBackdrop) {
    events.forEach(evt =>
      elPointModalBackdrop.addEventListener(evt, closePointHandler, { passive: false })
    );
  }
  if (elSkillModal) {
    elSkillModal.addEventListener(
      "click",
      e => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest("[data-close-skill]")) {
          closeHandler(e);
        }
      },
      true
    );
  }
  if (elErrorModal) {
    elErrorModal.addEventListener(
      "click",
      e => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest("[data-close-error]")) {
          closeErrorHandler(e);
        }
      },
      true
    );
  }
  if (elPointModal) {
    elPointModal.addEventListener(
      "click",
      e => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest("[data-close-point]")) {
          closePointHandler(e);
        }
      },
      true
    );
  }
  const closeBulkHandler = e => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    closeBulkEditModal();
  };
  const bulkCloseButtons = [elBulkEditClose, elBulkEditCancel];
  bulkCloseButtons.forEach(btn => {
    if (!btn) return;
    events.forEach(evt => {
      btn.addEventListener(evt, closeBulkHandler, { passive: false, capture: true });
    });
    btn.onclick = closeBulkHandler;
  });
  if (elBulkEditBackdrop) {
    events.forEach(evt =>
      elBulkEditBackdrop.addEventListener(evt, closeBulkHandler, { passive: false })
    );
  }
  if (elBulkEditModal) {
    elBulkEditModal.addEventListener(
      "click",
      e => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest("[data-close-bulk]")) {
          closeBulkHandler(e);
        }
      },
      true
    );
  }
}
function applyPlayersFromTextarea() {
  if (!elPlayersInput) return;
  const raw = elPlayersInput.value;
  const parsed = parseDelimitedTeamText(raw);
  const currentPlayers = normalizePlayers(state.players || []);
  const appendPlayers = parsed && parsed.players && parsed.players.length > 0
    ? normalizePlayers(parsed.players)
    : raw
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0);
  const mergedPlayers = currentPlayers.concat(
    appendPlayers.filter(name => !currentPlayers.some(p => p.toLowerCase() === name.toLowerCase()))
  );
  if (mergedPlayers.length === 0) {
    alert("Nessuna giocatrice valida trovata.");
    return;
  }
  if (parsed && parsed.players && parsed.players.length > 0) {
    updatePlayersList(mergedPlayers, {
      askReset: false,
      preserveCourt: true,
      liberos: [...new Set([...(state.liberos || []), ...(parsed.liberos || [])])],
      playerNumbers: Object.assign({}, state.playerNumbers || {}, parsed.numbers || {})
    });
    if (typeof refreshTeamManagerPlayersFromState === "function") {
      refreshTeamManagerPlayersFromState();
    }
    return;
  }
  updatePlayersList(mergedPlayers, { askReset: false, preserveCourt: true });
  if (typeof refreshTeamManagerPlayersFromState === "function") {
    refreshTeamManagerPlayersFromState();
  }
}
function renderSkillRows(targetEl, playerIdx, activeName, options = {}) {
  if (!targetEl) return;
  const { closeAfterAction = false, nextSkillId = null, scope = "our" } = options;
  const playerKey = makePlayerKey(scope, playerIdx);
  const getSkillColors = skillId => {
    const fallback = { bg: "#2f2f2f", text: "#e5e7eb" };
    return SKILL_COLORS[skillId] || fallback;
  };
  const isCompactMobile = !!state.forceMobileLayout || window.matchMedia("(max-width: 900px)").matches;
  const enabledSkills = getEnabledSkillsForScope(scope);
  if (enabledSkills.length === 0) {
    const empty = document.createElement("div");
    empty.className = "players-empty";
    empty.textContent = "Abilita almeno un fondamentale nelle impostazioni per scoutizzare.";
    targetEl.appendChild(empty);
    return;
  }
  const activeAttackKey = getActiveAttackKeyForScope(scope);
  if (activeAttackKey && activeAttackKey !== playerKey) {
    const locked = document.createElement("div");
    locked.className = "players-empty";
    locked.textContent = "Attacco in corso: completa la valutazione.";
    targetEl.appendChild(locked);
    return;
  }
  if (state.useOpponentTeam && state.predictiveSkillFlow) {
    const isForcedScope = state.forceSkillActive && state.forceSkillScope === scope;
    if (!isForcedScope) {
      if (state.pendingServe && state.pendingServe.scope === scope) {
        const fallbackServer = getServerPlayerForScope(scope);
        const pendingName = state.pendingServe.playerName || (fallbackServer && fallbackServer.name) || null;
        const pendingIdx = typeof state.pendingServe.playerIdx === "number" ? state.pendingServe.playerIdx : null;
        const normalizedPending = pendingName ? pendingName.trim().toLowerCase() : null;
        const normalizedActive = activeName ? activeName.trim().toLowerCase() : null;
        const isPendingPlayer =
          (pendingIdx !== null && pendingIdx === playerIdx) ||
          (normalizedPending && normalizedActive && normalizedPending === normalizedActive);
        if (isPendingPlayer && isSkillEnabledForScope("serve", scope)) {
          const grid = document.createElement("div");
          grid.className = "code-grid";
          const title = document.createElement("div");
          title.className = "skill-header";
          const titleSpan = document.createElement("span");
          titleSpan.className = "skill-title skill-serve";
          const colors = getSkillColors("serve");
          titleSpan.style.backgroundColor = colors.bg;
          titleSpan.style.color = colors.text;
          titleSpan.textContent = "Battuta";
          title.appendChild(titleSpan);
          grid.appendChild(title);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "event-btn code-negative";
          btn.textContent = "=";
          btn.dataset.playerIdx = String(playerIdx);
          btn.dataset.playerName = activeName;
          btn.dataset.skillId = "serve";
          btn.dataset.code = "=";
          btn.addEventListener("click", async e => {
            const success = await handleEventClick(
              playerIdx,
              "serve",
              "=",
              activeName,
              e.currentTarget,
              { scope }
            );
            if (!success) return;
            clearServeTypeInlineListener();
            setSelectedSkillForScope(scope, playerIdx, null);
            renderPlayers();
          });
          grid.appendChild(btn);
          targetEl.appendChild(grid);
          return;
        }
        const locked = document.createElement("div");
        locked.className = "players-empty";
        locked.textContent = "In attesa dell'altra squadra.";
        targetEl.appendChild(locked);
        return;
      }
      if (isPostServeLockForScope(scope)) {
        const serverName = getActiveServerName(scope);
        if (serverName && serverName === activeName && isSkillEnabledForScope("serve", scope)) {
          const grid = document.createElement("div");
          grid.className = "code-grid";
          const title = document.createElement("div");
          title.className = "skill-header";
          const titleSpan = document.createElement("span");
          titleSpan.className = "skill-title skill-serve";
          const colors = getSkillColors("serve");
          titleSpan.style.backgroundColor = colors.bg;
          titleSpan.style.color = colors.text;
          titleSpan.textContent = "Battuta";
          title.appendChild(titleSpan);
          grid.appendChild(title);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "event-btn code-negative";
          btn.textContent = "=";
          btn.dataset.playerIdx = String(playerIdx);
          btn.dataset.playerName = activeName;
          btn.dataset.skillId = "serve";
          btn.dataset.code = "=";
          btn.addEventListener("click", async e => {
            const success = await handleEventClick(
              playerIdx,
              "serve",
              "=",
              activeName,
              e.currentTarget,
              { scope }
            );
            if (!success) return;
            clearServeTypeInlineListener();
            setSelectedSkillForScope(scope, playerIdx, null);
            renderPlayers();
          });
          grid.appendChild(btn);
          targetEl.appendChild(grid);
          return;
        }
        const locked = document.createElement("div");
        locked.className = "players-empty";
        locked.textContent = "In attesa dell'altra squadra.";
        targetEl.appendChild(locked);
        return;
      }
      const flowState = getAutoFlowState();
      const server = getServerPlayerForScope(scope);
      const allowServeErrorOnly =
        flowState &&
        flowState.teamScope &&
        flowState.teamScope !== scope &&
        flowState.skillId === "pass" &&
        isSkillEnabledForScope("serve", scope) &&
        server &&
        server.name === activeName;
      if (allowServeErrorOnly) {
        const grid = document.createElement("div");
        grid.className = "code-grid";
        const title = document.createElement("div");
        title.className = "skill-header";
        const titleSpan = document.createElement("span");
        titleSpan.className = "skill-title skill-serve";
        const colors = getSkillColors("serve");
        titleSpan.style.backgroundColor = colors.bg;
        titleSpan.style.color = colors.text;
        titleSpan.textContent = "Battuta";
        title.appendChild(titleSpan);
        grid.appendChild(title);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "event-btn code-negative";
        btn.textContent = "=";
        btn.dataset.playerIdx = String(playerIdx);
        btn.dataset.playerName = activeName;
        btn.dataset.skillId = "serve";
        btn.dataset.code = "=";
        btn.addEventListener("click", async e => {
          const success = await handleEventClick(
            playerIdx,
            "serve",
            "=",
            activeName,
            e.currentTarget,
            { scope }
          );
          if (!success) return;
          clearServeTypeInlineListener();
          setSelectedSkillForScope(scope, playerIdx, null);
          renderPlayers();
        });
        grid.appendChild(btn);
        targetEl.appendChild(grid);
        return;
      }
      if (flowState && flowState.teamScope && flowState.teamScope !== scope) {
        const locked = document.createElement("div");
        locked.className = "players-empty";
        locked.textContent = "In attesa dell'altra squadra.";
        targetEl.appendChild(locked);
        return;
      }
    }
  }
  if (isCompactMobile) {
    const pickedSkillId = nextSkillId || null;
    if (
      pickedSkillId === "block" &&
      blockInlinePlayer !== null &&
      blockInlinePlayer !== playerKey &&
      isPlayerKeyInScope(blockInlinePlayer, scope)
    ) {
      return;
    }
    if (pickedSkillId === "block" && blockConfirmByPlayer[playerKey] !== true) {
      if (shouldSkipBlockConfirm(scope)) {
        blockConfirmByPlayer[playerKey] = true;
      } else {
        const grid = document.createElement("div");
        grid.className = "code-grid block-confirm-grid";
        const skipBtn = document.createElement("button");
        skipBtn.type = "button";
        skipBtn.className = "event-btn block-confirm-skip";
        skipBtn.textContent = "No muro";
        skipBtn.addEventListener("click", () => {
          delete blockConfirmByPlayer[playerKey];
          if (blockInlinePlayer === playerKey) blockInlinePlayer = null;
          setSelectedSkillForScope(scope, playerIdx, null);
          const predicted = getPredictedSkillIdForScope(scope);
          const nextSkill = predicted === "block" ? "defense" : "defense";
          if (typeof forceNextSkill === "function" && scope === "our") {
            forceNextSkill(nextSkill);
          } else if (scope === "opponent") {
            state.opponentSkillFlowOverride = nextSkill;
            saveState();
          }
          scheduleRenderPlayers();
        });
        const goBtn = document.createElement("button");
        goBtn.type = "button";
        goBtn.className = "event-btn block-confirm-go";
        goBtn.textContent = "Muro";
        goBtn.addEventListener("click", () => {
          blockInlinePlayer = playerKey;
          blockConfirmByPlayer[playerKey] = true;
          scheduleRenderPlayers();
        });
        grid.appendChild(skipBtn);
        grid.appendChild(goBtn);
        targetEl.appendChild(grid);
        return;
      }
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "skill-picker-btn skill-single-btn" + (pickedSkillId ? " skill-" + pickedSkillId : "");
    if (pickedSkillId) {
      const colors = getSkillColors(pickedSkillId);
      const meta = SKILLS.find(s => s.id === pickedSkillId);
      btn.style.backgroundColor = colors.bg;
      btn.style.color = colors.text;
      btn.textContent = meta ? meta.label : pickedSkillId;
      btn.addEventListener("click", () => {
        openSkillCodesModal(playerIdx, activeName, pickedSkillId, scope);
      });
    } else {
      btn.textContent = "Seleziona skill";
      btn.addEventListener("click", () => openSkillModal(playerIdx, activeName, scope));
    }
    targetEl.appendChild(btn);
    return;
  }
  const enabledSkillIds = new Set(enabledSkills.map(s => s.id));
  let pickedSkillId = nextSkillId || getSelectedSkillForScope(scope, playerIdx);
  if (pickedSkillId && !enabledSkillIds.has(pickedSkillId)) {
    if (!nextSkillId) setSelectedSkillForScope(scope, playerIdx, null);
    pickedSkillId = null;
  }
  if (
    pickedSkillId === "serve" &&
    state.useOpponentTeam &&
    state.predictiveSkillFlow &&
    serveMetaByPlayer[playerKey]
  ) {
    const cachedMeta = serveMetaByPlayer[playerKey];
    state.pendingServe = {
      scope,
      playerIdx,
      playerName: activeName,
      meta: cachedMeta
    };
    delete serveMetaByPlayer[playerKey];
    setSelectedSkillForScope(scope, playerIdx, null);
    scheduleRenderPlayers();
    return;
  }
  if (pickedSkillId !== "serve" && serveTypeInlinePlayer === playerKey) {
    clearServeTypeInlineListener();
  }
  if (pickedSkillId !== "attack" && attackInlinePlayer === playerKey) {
    clearAttackSelection(playerIdx, scope);
  }
  if (!pickedSkillId) {
    const grid = document.createElement("div");
    grid.className = "skill-grid";
    enabledSkills.forEach(skill => {
      if (
        skill.id === "block" &&
        blockInlinePlayer !== null &&
        blockInlinePlayer !== playerKey &&
        isPlayerKeyInScope(blockInlinePlayer, scope)
      ) {
        return;
      }
      const colors = getSkillColors(skill.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "skill-picker-btn skill-" + skill.id;
      btn.style.backgroundColor = colors.bg;
      btn.style.color = colors.text;
      btn.textContent = skill.label;
      btn.addEventListener("click", () => {
        setSelectedSkillForScope(scope, playerIdx, skill.id);
        scheduleRenderPlayers();
      });
      grid.appendChild(btn);
    });
    targetEl.appendChild(grid);
    return;
  }
  if (pickedSkillId === "serve" && !serveMetaByPlayer[playerKey]) {
    const serveZone = getServeBaseZoneForPlayer(playerIdx, scope);
    if (serveZone !== 1) {
      const locked = document.createElement("div");
      locked.className = "players-empty";
      locked.textContent = "La battuta è disponibile solo per la zona 1.";
      targetEl.appendChild(locked);
      return;
    }
    if (serveTypeInlinePlayer !== null && serveTypeInlinePlayer !== playerKey) {
      return;
    }
    const grid = document.createElement("div");
    grid.className = "code-grid serve-type-grid";
    grid.addEventListener("pointerdown", () => setServeTypeFocusPlayer(playerIdx, scope));
    const title = document.createElement("div");
    title.className = "skill-header";
    const titleSpan = document.createElement("span");
    titleSpan.className = "skill-title skill-serve";
    titleSpan.textContent = "Battuta · tipo";
    title.appendChild(titleSpan);
    grid.appendChild(title);
    const types = [
      { id: "F", label: "Float (F)" },
      { id: "JF", label: "Jump float (JF)" },
      { id: "S", label: "Spin (S)" }
    ];
    const handleSelect = async type => {
      await startServeTypeSelection(playerIdx, type, renderPlayers, scope);
    };
    types.forEach(t => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "event-btn";
      btn.textContent = t.label;
      btn.addEventListener("click", () => handleSelect(t.id));
      grid.appendChild(btn);
    });
    bindServeTypeInlineListener(playerIdx, handleSelect, scope);
    targetEl.appendChild(grid);
    return;
  }
  if (pickedSkillId === "attack" && !getAttackMetaForPlayer(scope, playerIdx)) {
    if (
      attackInlinePlayer !== null &&
      attackInlinePlayer !== playerKey &&
      isPlayerKeyInScope(attackInlinePlayer, scope)
    ) {
      return;
    }
    if (shouldPromptAttackSetType(scope)) {
      const queuedSetType = normalizeSetTypeValue(queuedSetTypeChoice);
      if (queuedSetType && queuedSetType.toLowerCase() === "damp" && isSetterPlayerForScope(scope, playerIdx)) {
        if (attackInlinePlayer === playerKey) return;
        const dampChoice = queuedSetTypeChoice;
        queuedSetTypeChoice = null;
        setNextSetType("");
        startAttackSelection(
          playerIdx,
          dampChoice,
          () => {
            const metaKey = makePlayerKey(scope, playerIdx);
            if (attackMetaByPlayer[metaKey]) {
              attackMetaByPlayer[metaKey].fromNextSetType = true;
            }
            renderPlayers();
          },
          scope
        );
        return;
      }
      if (queuedSetType) {
        const grid = document.createElement("div");
        grid.className = "code-grid attack-select-grid";
        const title = document.createElement("div");
        title.className = "skill-header";
        const titleSpan = document.createElement("span");
        titleSpan.className = "skill-title skill-attack";
        titleSpan.textContent = "Attacco";
        title.appendChild(titleSpan);
        grid.appendChild(title);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "event-btn attack-main-btn";
        btn.textContent = "Attacco";
        btn.addEventListener("click", async () => {
          await startAttackSelection(playerIdx, queuedSetType, renderPlayers, scope);
          const metaKey = makePlayerKey(scope, playerIdx);
          if (attackMetaByPlayer[metaKey]) {
            attackMetaByPlayer[metaKey].fromNextSetType = true;
          }
          queuedSetTypeChoice = null;
          setNextSetType("");
        });
        grid.appendChild(btn);
        targetEl.appendChild(grid);
        return;
      }
      const grid = document.createElement("div");
      grid.className = "code-grid attack-select-grid";
      const title = document.createElement("div");
      title.className = "skill-header";
      const titleSpan = document.createElement("span");
      titleSpan.className = "skill-title skill-attack";
      titleSpan.textContent = "Attacco";
      title.appendChild(titleSpan);
      grid.appendChild(title);
      const setTypeOptions = isSetterPlayerForScope(scope, playerIdx)
        ? [{ value: "Damp", label: "Damp" }]
        : DEFAULT_SET_TYPE_OPTIONS;
      setTypeOptions.forEach(opt => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "event-btn";
        btn.textContent = formatSetTypeLabelWithShortcut(opt.value, opt.label);
        btn.addEventListener("click", async () => {
          await startAttackSelection(playerIdx, opt.value, renderPlayers, scope);
        });
        grid.appendChild(btn);
      });
      targetEl.appendChild(grid);
    } else if (nextSkillId) {
      const grid = document.createElement("div");
      grid.className = "code-grid attack-select-grid";
      const title = document.createElement("div");
      title.className = "skill-header";
      const titleSpan = document.createElement("span");
      titleSpan.className = "skill-title skill-attack";
      titleSpan.textContent = "Attacco";
      title.appendChild(titleSpan);
      grid.appendChild(title);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "event-btn attack-main-btn";
      btn.textContent = "Attacco";
      btn.addEventListener("click", async () => {
        await startAttackSelection(playerIdx, null, renderPlayers, scope);
      });
      grid.appendChild(btn);
      targetEl.appendChild(grid);
    } else {
      const grid = document.createElement("div");
      grid.className = "code-grid attack-select-grid";
      const title = document.createElement("div");
      title.className = "skill-header";
      const titleSpan = document.createElement("span");
      titleSpan.className = "skill-title skill-attack";
      titleSpan.textContent = "Attacco";
      title.appendChild(titleSpan);
      grid.appendChild(title);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "event-btn attack-main-btn";
      btn.textContent = "Attacco";
      btn.addEventListener("click", async () => {
        await startAttackSelection(playerIdx, null, renderPlayers, scope);
      });
      grid.appendChild(btn);
      targetEl.appendChild(grid);
    }
    return;
  }
  if (
    pickedSkillId === "block" &&
    blockInlinePlayer !== null &&
    blockInlinePlayer !== playerKey &&
    isPlayerKeyInScope(blockInlinePlayer, scope)
  ) {
    return;
  }
  if (pickedSkillId === "block" && blockConfirmByPlayer[playerKey] !== true) {
    if (shouldSkipBlockConfirm(scope)) {
      blockConfirmByPlayer[playerKey] = true;
    } else {
    const grid = document.createElement("div");
    grid.className = "code-grid block-confirm-grid";
    const title = document.createElement("div");
    title.className = "skill-header";
    const titleSpan = document.createElement("span");
    titleSpan.className = "skill-title skill-block";
    titleSpan.textContent = "Muro";
    title.appendChild(titleSpan);
    grid.appendChild(title);
    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "event-btn block-confirm-skip";
    skipBtn.textContent = "No muro";
    skipBtn.addEventListener("click", () => {
      delete blockConfirmByPlayer[playerKey];
      if (blockInlinePlayer === playerKey) blockInlinePlayer = null;
      setSelectedSkillForScope(scope, playerIdx, null);
      const predicted = getPredictedSkillIdForScope(scope);
      const nextSkill = predicted === "block" ? "defense" : "defense";
      if (typeof forceNextSkill === "function" && scope === "our") {
        forceNextSkill(nextSkill);
      } else if (scope === "opponent") {
        state.opponentSkillFlowOverride = nextSkill;
        saveState();
      }
      scheduleRenderPlayers();
    });
    const goBtn = document.createElement("button");
    goBtn.type = "button";
    goBtn.className = "event-btn block-confirm-go";
    goBtn.textContent = "Muro";
    goBtn.addEventListener("click", () => {
      blockInlinePlayer = playerKey;
      blockConfirmByPlayer[playerKey] = true;
      scheduleRenderPlayers();
    });
    grid.appendChild(skipBtn);
    grid.appendChild(goBtn);
    targetEl.appendChild(grid);
    return;
    }
  }
  if (pickedSkillId === "attack") {
    const metaKey = makePlayerKey(scope, playerIdx);
    if (
      attackInlinePlayer !== null &&
      attackInlinePlayer !== metaKey &&
      isPlayerKeyInScope(attackInlinePlayer, scope)
    ) {
      const locked = document.createElement("div");
      locked.className = "players-empty";
      locked.textContent = "Attacco in corso: completa la valutazione.";
      targetEl.appendChild(locked);
      return;
    }
    if (!getAttackMetaForPlayer(scope, playerIdx)) {
      const locked = document.createElement("div");
      locked.className = "players-empty";
      locked.textContent = "Attacco in corso: completa la valutazione.";
      targetEl.appendChild(locked);
      return;
    }
  }
  const skillMeta = SKILLS.find(s => s.id === pickedSkillId);
  const codes = (state.metricsConfig[pickedSkillId]?.activeCodes || RESULT_CODES).slice();
  if (!codes.includes("/")) codes.push("/");
  if (!codes.includes("=")) codes.push("=");
  const ordered = codes.filter(c => c !== "/" && c !== "=").concat("/", "=");
  const grid = document.createElement("div");
  grid.className = "code-grid";
  const title = document.createElement("div");
  title.className = "skill-header";
  const titleSpan = document.createElement("span");
  titleSpan.className = "skill-title skill-" + pickedSkillId + (nextSkillId ? " next-skill" : "");
  const colors = getSkillColors(pickedSkillId);
  titleSpan.style.backgroundColor = colors.bg;
  titleSpan.style.color = colors.text;
  titleSpan.textContent = skillMeta ? skillMeta.label : pickedSkillId;
  title.appendChild(titleSpan);
  grid.appendChild(title);
  ordered.forEach(code => {
    const btn = document.createElement("button");
    btn.type = "button";
    const tone = typeof getCodeTone === "function" ? getCodeTone(pickedSkillId, code) : "neutral";
    btn.className = "event-btn code-" + tone;
    btn.textContent = code;
    btn.dataset.playerIdx = String(playerIdx);
    btn.dataset.playerName = activeName;
    btn.dataset.skillId = pickedSkillId;
    btn.dataset.code = code;
    btn.addEventListener("click", async e => {
      const attackMeta = getAttackMetaForPlayer(scope, playerIdx);
      const success = await handleEventClick(
        playerIdx,
        pickedSkillId,
        code,
        activeName,
        e.currentTarget,
        {
          serveMeta: serveMetaByPlayer[playerKey] || null,
          attackMeta: attackMeta || null,
          scope
        }
      );
      if (!success) return;
      delete serveMetaByPlayer[playerKey];
      if (pickedSkillId === "serve") {
        clearServeTypeInlineListener();
      }
      if (pickedSkillId === "attack") {
        clearAttackSelection(playerIdx, scope);
      }
      if (pickedSkillId === "block") {
        delete blockConfirmByPlayer[playerKey];
        if (blockInlinePlayer === playerKey) blockInlinePlayer = null;
      }
      setSelectedSkillForScope(scope, playerIdx, null);
      if (closeAfterAction) closeSkillModal();
      renderPlayers();
    });
    grid.appendChild(btn);
  });
  const showBackBtn = !(state.predictiveSkillFlow && nextSkillId);
  if (showBackBtn) {
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "secondary small code-back-btn";
    backBtn.textContent = "← Scegli un altro fondamentale";
    backBtn.addEventListener("click", () => {
      setSelectedSkillForScope(scope, playerIdx, null);
      renderPlayers();
    });
    grid.appendChild(backBtn);
  }
  targetEl.appendChild(grid);
}
function renderTeamCourtCards(options = {}) {
  const {
    container,
    scope = "our",
    court = [],
    baseCourt = null,
    displayCourt = null,
    numbersMap = {},
    captainSet = new Set(),
    libSet = new Set(),
    allowDrag = false,
    allowReturn = false,
    isCompactMobile = false,
    nextSkillId = null,
    allowDrop = false
  } = options;
  if (!container) return;
  const renderOrder = [3, 2, 1, 4, 5, 0];
  const map = displayCourt || court.map((slot, idx) => ({ slot, idx }));
  renderOrder.forEach(idx => {
    const meta = POSITIONS_META[idx];
    const slotInfo = map[idx] || { slot: { main: "" }, idx: idx };
    const slot = slotInfo.slot || { main: "" };
    const posIdx = slotInfo.idx != null ? slotInfo.idx : idx;
    const fallbackSlot = baseCourt && baseCourt[idx] ? baseCourt[idx] : null;
    const effectiveSlot = !slot.main && fallbackSlot && fallbackSlot.main ? fallbackSlot : slot;
    const activeName = effectiveSlot.main;
    const card = document.createElement("div");
    card.className = "player-card court-card pos-" + (idx + 1);
    const isLibSlot = libSet.has(effectiveSlot.main);
    if (isLibSlot) {
      card.classList.add("libero-card");
    }
    card.dataset.posNumber = String(idx + 1);
    card.dataset.posIndex = String(posIdx);
    card.dataset.playerName = activeName || "";
    card.dataset.teamScope = scope;
    if (!activeName) {
      card.classList.add("empty");
    }
    if (isCompactMobile) {
      card.classList.add("compact-card");
    }
    card.dataset.dropTarget = "main";
    const header = document.createElement("div");
    const canDrag = allowDrag && !!activeName && isLibSlot;
    header.className = "court-header" + (canDrag ? " draggable" : "");
    header.draggable = canDrag;
    if (canDrag) {
      header.addEventListener("dragstart", e => handleCourtDragStart(e, posIdx));
      header.addEventListener("dragend", handleCourtDragEnd);
    }
    const tagBar = document.createElement("div");
    tagBar.className = "court-tagbar";
    const posLabel = document.createElement("span");
    posLabel.className = "court-pos-label";
    posLabel.textContent = "Pos " + (idx + 1);
    const tagLibero = document.createElement("span");
    tagLibero.className = "court-libero-pill";
    tagLibero.textContent = "L";
    tagLibero.style.visibility = isLibSlot ? "visible" : "hidden";
    tagBar.appendChild(posLabel);
    tagBar.appendChild(tagLibero);
    if (allowReturn && isLibSlot && effectiveSlot.replaced) {
      const btnReturn = document.createElement("button");
      btnReturn.type = "button";
      btnReturn.className = "libero-return-btn";
      btnReturn.title = "Rientra " + effectiveSlot.replaced;
      btnReturn.textContent = "↩";
      const handleReturn = e => {
        e.stopPropagation();
        if (scope === "opponent" && typeof restorePlayerFromLiberoForScope === "function") {
          restorePlayerFromLiberoForScope(posIdx, "opponent");
        } else if (typeof restorePlayerFromLibero === "function") {
          restorePlayerFromLibero(posIdx);
        }
      };
      btnReturn.addEventListener("click", handleReturn);
      btnReturn.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          handleReturn(e);
        }
      });
      tagBar.appendChild(btnReturn);
    }
    header.appendChild(tagBar);
    const nameBlock = document.createElement("div");
    nameBlock.className = "court-name-block inline";
    const nameLabel = document.createElement("div");
    nameLabel.className = "court-name";
    if (isLibSlot) {
      nameLabel.classList.add("libero-flag");
    }
      if (activeName && scope === "opponent" && typeof formatNameWithNumberFor === "function") {
        nameLabel.textContent = formatNameWithNumberFor(activeName, numbersMap, {
          captainSet,
          compactCourt: true
        });
    } else {
      nameLabel.textContent = activeName
        ? formatNameWithNumber(activeName, { compactCourt: true })
        : scope === "our"
          ? "Trascina una giocatrice qui"
          : "—";
    }
    nameBlock.appendChild(nameLabel);
    if (scope === "our" || scope === "opponent") {
      const roleTag = document.createElement("span");
      roleTag.className = "court-role-tag";
      const rotationValue = scope === "opponent" ? state.opponentRotation : state.rotation;
      roleTag.textContent =
        typeof getRoleLabelForRotation === "function"
          ? getRoleLabelForRotation((posIdx || 0) + 1, rotationValue || 1)
          : getRoleLabel((posIdx || 0) + 1);
      nameBlock.appendChild(roleTag);
    }
    header.appendChild(nameBlock);
    card.appendChild(header);

    if (allowDrop) {
      card.addEventListener("dragenter", e => handlePositionDragOver(e, card), true);
      card.addEventListener("dragover", e => handlePositionDragOver(e, card), true);
      card.addEventListener("dragleave", () => handlePositionDragLeave(card), true);
      card.addEventListener("drop", e => handlePositionDrop(e, card), true);
    }

    if (activeName && (scope === "our" || scope === "opponent")) {
      const players = getPlayersForScope(scope);
      const playerIdx = players.findIndex(p => p === activeName);
      if (playerIdx === -1) {
        container.appendChild(card);
        return;
      }
      renderSkillRows(card, playerIdx, activeName, { nextSkillId, scope });
    }
    if (meta) {
      card.style.gridArea = meta.gridArea;
    }
    container.appendChild(card);
  });
}
function renderPlayers() {
  if (!elPlayersContainer) return;
  syncCourtSideLayout();
  elPlayersContainer.innerHTML = "";
  elPlayersContainer.classList.add("court-layout");
  elPlayersContainer.classList.toggle("court-layout--mirror", !!state.courtViewMirrored);
  ensureCourtShape();
  ensureMetricsConfigDefaults();
  let predictedSkillId = state.useOpponentTeam
    ? getPredictedSkillIdForScope("our")
    : getPredictedSkillId();
  let predictedOpponentSkillId = state.useOpponentTeam ? getPredictedSkillIdForScope("opponent") : null;
  if (state.useOpponentTeam && state.predictiveSkillFlow && !predictedOpponentSkillId) {
    const oppFallbackSeed = isServingForScope("opponent") ? "serve" : "pass";
    if (isSkillEnabledForScope(oppFallbackSeed, "opponent")) {
      predictedOpponentSkillId = oppFallbackSeed;
    } else {
      const enabledOpp = getEnabledSkillsForScope("opponent");
      predictedOpponentSkillId = enabledOpp.length ? enabledOpp[0].id : null;
    }
  }
  if (state.predictiveSkillFlow && !state.useOpponentTeam && !predictedSkillId) {
    const fallbackSeed = state.isServing ? "serve" : "pass";
    if (isSkillEnabled(fallbackSeed)) {
      predictedSkillId = fallbackSeed;
    } else {
      const enabled = getEnabledSkills();
      predictedSkillId = enabled.length ? enabled[0].id : null;
    }
  }
  const isCompactMobile = !!state.forceMobileLayout || window.matchMedia("(max-width: 900px)").matches;
  updateSetTypeVisibility(predictedSkillId || predictedOpponentSkillId);
  const hasSelectedServe = isAnySelectedSkill("serve");
  const layoutSkill =
    state.predictiveSkillFlow && predictedSkillId
      ? predictedSkillId
      : isAnySelectedSkill("pass")
        ? "pass"
        : hasSelectedServe
          ? "serve"
          : null;
  const displayCourt = getAutoRoleDisplayCourt(layoutSkill, "our");
  renderTeamCourtCards({
    container: elPlayersContainer,
    scope: "our",
    court: displayCourt.map(item => item.slot || { main: "" }),
    baseCourt: ensureCourtShapeFor(state.court),
    displayCourt,
    numbersMap: state.playerNumbers || {},
    captainSet: new Set((state.captains || []).map(name => name.toLowerCase())),
    libSet: new Set(state.liberos || []),
    allowDrag: true,
    allowReturn: true,
    allowDrop: true,
    isCompactMobile,
    nextSkillId: predictedSkillId
  });
  recalcAllStatsAndUpdateUI();
  renderLineupChips();
  renderOpponentPlayers({ nextSkillId: predictedOpponentSkillId });
  renderLogServeTrajectories();
}
function renderOpponentPlayers({ nextSkillId = null, animate = false } = {}) {
  if (!state.useOpponentTeam) return;
  const elOpponentContainer = document.getElementById("opponent-players-container");
  if (!elOpponentContainer) return;
  const shouldAnimate = animate && typeof captureRects === "function" && typeof animateFlip === "function";
  const prevRects = shouldAnimate
    ? captureRects('.court-card[data-team-scope="opponent"]', el => {
        const name = el.dataset.playerName || "";
        const pos = el.dataset.posIndex || "";
        return name || "pos-" + pos;
      })
    : null;
  if (typeof ensureOpponentLiberosFromTeam === "function") {
    ensureOpponentLiberosFromTeam();
  }
  syncCourtSideLayout();
  if (typeof updateOpponentRotationDisplay === "function") {
    updateOpponentRotationDisplay();
  }
  elOpponentContainer.innerHTML = "";
  elOpponentContainer.classList.add("court-layout");
  elOpponentContainer.classList.toggle("court-layout--mirror", !!state.opponentCourtViewMirrored);
  const baseOppCourt =
    Array.isArray(state.opponentCourt) && state.opponentCourt.length === 6
      ? state.opponentCourt
      : Array.from({ length: 6 }, (_, idx) => ({ main: (state.opponentPlayers || [])[idx] || "" }));
  const court =
    typeof ensureCourtShapeFor === "function"
      ? ensureCourtShapeFor(baseOppCourt)
      : Array.from({ length: 6 }, (_, idx) => baseOppCourt[idx] || { main: "" });
  let predictedSkillId = nextSkillId || getPredictedSkillIdForScope("opponent");
  if (state.predictiveSkillFlow && !predictedSkillId) {
    const fallbackSeed = isServingForScope("opponent") ? "serve" : "pass";
    if (isSkillEnabledForScope(fallbackSeed, "opponent")) {
      predictedSkillId = fallbackSeed;
    } else {
      const enabledOpp = getEnabledSkillsForScope("opponent");
      predictedSkillId = enabledOpp.length ? enabledOpp[0].id : null;
    }
  }
  const layoutSkill =
    state.predictiveSkillFlow && predictedSkillId
      ? predictedSkillId
      : isAnySelectedSkillForScope("opponent", "pass")
        ? "pass"
        : isAnySelectedSkillForScope("opponent", "serve")
          ? "serve"
          : null;
  const displayCourt = getAutoRoleDisplayCourt(layoutSkill, "opponent");
  renderTeamCourtCards({
    container: elOpponentContainer,
    scope: "opponent",
    court: displayCourt.map(item => item.slot || { main: "" }),
    baseCourt: ensureCourtShapeFor(state.opponentCourt || []),
    displayCourt,
    numbersMap: state.opponentPlayerNumbers || {},
    captainSet: new Set((state.opponentCaptains || []).map(name => name.toLowerCase())),
    libSet: new Set(state.opponentLiberos || []),
    allowReturn: true,
    allowDrop: true,
    isCompactMobile: !!state.forceMobileLayout || window.matchMedia("(max-width: 900px)").matches,
    nextSkillId: predictedSkillId
  });
  if (shouldAnimate) {
    animateFlip(prevRects, '.court-card[data-team-scope="opponent"]', el => {
      const name = el.dataset.playerName || "";
      const pos = el.dataset.posIndex || "";
      return name || "pos-" + pos;
    });
  }
}
function syncCourtSideLayout() {
  const courtArea = document.getElementById("court-area");
  const opponentPanel = document.querySelector('[data-team-panel="opponent"]');
  const homePanel = document.querySelector('[data-team-panel="home"]');
  const swapped = !!state.courtSideSwapped;
  const homeIsFar = swapped;
  const opponentIsFar = !swapped;
  state.courtViewMirrored = homeIsFar;
  state.opponentCourtViewMirrored = opponentIsFar;
  if (courtArea) {
    courtArea.classList.toggle("court-area--swapped", swapped);
  }
  if (opponentPanel) {
    opponentPanel.classList.toggle("team-panel--far", !swapped);
    opponentPanel.classList.toggle("team-panel--near", swapped);
  }
  if (homePanel) {
    homePanel.classList.toggle("team-panel--far", swapped);
    homePanel.classList.toggle("team-panel--near", !swapped);
  }
}
function swapTeamsInMatch() {
  const swapState = (keyA, keyB) => {
    const tmp = state[keyA];
    state[keyA] = state[keyB];
    state[keyB] = tmp;
  };
  swapState("selectedTeam", "selectedOpponentTeam");
  swapState("players", "opponentPlayers");
  swapState("playerNumbers", "opponentPlayerNumbers");
  swapState("liberos", "opponentLiberos");
  swapState("captains", "opponentCaptains");
  swapState("court", "opponentCourt");
  swapState("rotation", "opponentRotation");
  swapState("courtViewMirrored", "opponentCourtViewMirrored");
  swapState("autoRoleP1American", "opponentAutoRoleP1American");
  swapState("attackTrajectoryEnabled", "opponentAttackTrajectoryEnabled");
  swapState("serveTrajectoryEnabled", "opponentServeTrajectoryEnabled");
  swapState("setTypePromptEnabled", "opponentSetTypePromptEnabled");
  swapState("autoLiberoBackline", "opponentAutoLiberoBackline");
  swapState("autoLiberoRole", "opponentAutoLiberoRole");
  swapState("liberoAutoMap", "opponentLiberoAutoMap");
  swapState("preferredLibero", "opponentPreferredLibero");
  swapState("skillFlowOverride", "opponentSkillFlowOverride");

  if (typeof updateAutoRoleBaseCourtCache === "function") {
    updateAutoRoleBaseCourtCache(state.court);
  }
  if (state.useOpponentTeam) {
    state.match.opponent = state.selectedOpponentTeam || "";
    if (typeof applyMatchInfoToUI === "function") {
      applyMatchInfoToUI();
    }
  }
  if (typeof renderTeamsSelect === "function") renderTeamsSelect();
  if (typeof renderOpponentTeamsSelect === "function") renderOpponentTeamsSelect();
  if (typeof renderOpponentPlayersList === "function") renderOpponentPlayersList();
  if (typeof renderOpponentLiberoTags === "function") renderOpponentLiberoTags();
  if (typeof renderLiberoChipsInline === "function") renderLiberoChipsInline();
  if (typeof applyPlayersFromStateToTextarea === "function") applyPlayersFromStateToTextarea();
  if (typeof applyOpponentPlayersFromStateToTextarea === "function") {
    applyOpponentPlayersFromStateToTextarea();
  }
  saveState();
  renderPlayers();
}
function clearReceiveContext(scope = "our") {
  lastReceiveContext[scope] = null;
}
function animateFreeballButton() {
  if (!elBtnFreeball) return;
  elBtnFreeball.classList.remove("freeball-pulse");
  // force reflow to restart animation
  // eslint-disable-next-line no-unused-expressions
  elBtnFreeball.offsetWidth;
  elBtnFreeball.classList.add("freeball-pulse");
  setTimeout(() => elBtnFreeball.classList.remove("freeball-pulse"), 420);
}
function animateEventToLog() {
  // fallback no-op: some builds don't include the log animation helper
}
function triggerFreeballFlow({ persist = true, rerender = true, startSkill = null, scope = "our" } = {}) {
  const desiredStartSkill =
    startSkill || (isSkillEnabledForScope("second", scope) ? "second" : null);
  state.freeballPending = true;
  state.freeballPendingScope = scope;
  state.flowTeamScope = scope;
  state.predictiveSkillFlow = true;
  if (scope === "opponent") {
    state.opponentSkillFlowOverride = desiredStartSkill;
  } else {
    state.skillFlowOverride = desiredStartSkill;
  }
  animateFreeballButton();
  if (persist) saveState();
  if (rerender) {
    renderPlayers();
    updateNextSkillIndicator(getPredictedSkillIdForScope(scope));
  }
}
function rememberReceiveContext(ev) {
  if (!ev) return;
  const scope = getTeamScopeFromEvent(ev);
  const zone = ev.zone || ev.playerPosition || null;
  lastReceiveContext[scope] = {
    zone,
    evaluation: ev.code || ev.receiveEvaluation || null,
    set: ev.set || null,
    eventId: ev.eventId || null
  };
}
function applyReceiveContextToEvent(ev) {
  if (!ev) return;
  const scope = getTeamScopeFromEvent(ev);
  // Un servizio segna l'inizio di un nuovo scambio
  if (ev.skillId === "serve") {
    clearReceiveContext(scope);
    return;
  }
  // Registra la ricezione e salva i dati utili per le azioni successive
  if (ev.skillId === "pass") {
    const zone = ev.zone || ev.playerPosition || null;
    if (ev.receivePosition == null) ev.receivePosition = zone;
    rememberReceiveContext(ev);
    return;
  }
  const ctx = lastReceiveContext[scope];
  const sameSet = ctx && (ctx.set === null || ctx.set === ev.set);
  const fromReceive = !!ctx && sameSet;
  if ((ev.skillId === "second" || ev.skillId === "attack") && fromReceive) {
    if (ctx.zone != null && ev.receivePosition == null) ev.receivePosition = ctx.zone;
    if (ctx.evaluation && !ev.receiveEvaluation) ev.receiveEvaluation = ctx.evaluation;
  }
  if (ev.skillId === "attack") {
    // Default BP, salvo attacco immediato dopo ricezione (solo il primo)
    ev.attackBp = !fromReceive;
    clearReceiveContext(scope);
  }
}
function addRelatedEvent(ev, relatedId) {
  if (!ev || relatedId === null || relatedId === undefined) return;
  if (!Array.isArray(ev.relatedEvents)) {
    ev.relatedEvents = [];
  }
  if (!ev.relatedEvents.includes(relatedId)) {
    ev.relatedEvents.push(relatedId);
  }
}
function addRelatedLink(ev, relatedId, type) {
  if (!ev || relatedId === null || relatedId === undefined) return;
  if (!type) return;
  if (!Array.isArray(ev.relatedLinks)) {
    ev.relatedLinks = [];
  }
  if (!ev.relatedLinks.some(link => link && link.eventId === relatedId && link.type === type)) {
    ev.relatedLinks.push({ eventId: relatedId, type });
  }
}
function linkEvents(evA, evB, type = null) {
  if (!evA || !evB) return;
  if (evA.eventId === null || evA.eventId === undefined) return;
  if (evB.eventId === null || evB.eventId === undefined) return;
  addRelatedEvent(evA, evB.eventId);
  addRelatedEvent(evB, evA.eventId);
  if (type) {
    addRelatedLink(evA, evB.eventId, type);
    addRelatedLink(evB, evA.eventId, type);
  }
}
function findLastEventBySkills(events, { scope = null, skillIds = [] } = {}) {
  const list = Array.isArray(events) ? events : [];
  const ids = Array.isArray(skillIds) ? skillIds : [skillIds];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const ev = list[i];
    if (!ev || !ids.includes(ev.skillId)) continue;
    if (scope && getTeamScopeFromEvent(ev) !== scope) continue;
    return ev;
  }
  return null;
}
function incrementSkillStats(scope, playerIdx, skillId, code) {
  if (typeof playerIdx !== "number" || playerIdx < 0) return;
  if (scope === "our") {
    if (!state.stats[playerIdx]) {
      state.stats[playerIdx] = {};
    }
    if (!state.stats[playerIdx][skillId]) {
      state.stats[playerIdx][skillId] = { "#": 0, "+": 0, "!": 0, "-": 0, "=": 0, "/": 0 };
    }
    state.stats[playerIdx][skillId][code] =
      (state.stats[playerIdx][skillId][code] || 0) + 1;
    return;
  }
  state.opponentStats = state.opponentStats || [];
  if (!state.opponentStats[playerIdx]) {
    state.opponentStats[playerIdx] = {};
  }
  if (!state.opponentStats[playerIdx][skillId]) {
    state.opponentStats[playerIdx][skillId] = { "#": 0, "+": 0, "!": 0, "-": 0, "=": 0, "/": 0 };
  }
  state.opponentStats[playerIdx][skillId][code] =
    (state.opponentStats[playerIdx][skillId][code] || 0) + 1;
}
async function handleEventClick(
  playerIdxStr,
  skillId,
  code,
  playerName,
  sourceEl,
  { setTypeChoice = null, serveMeta = null, attackMeta = null, scope = "our" } = {}
) {
  if (state.matchFinished) {
    alert("Partita in pausa. Riprendi per continuare lo scout.");
    return false;
  }
  ensureSetStartSnapshot(state.currentSet || 1);
  let forceMatch = false;
  let allowPendingServePass = false;
  let flowState = null;
  let activeOverride = null;
  let inferredServeEvent = null;
  if (state.useOpponentTeam && state.predictiveSkillFlow) {
    flowState = getAutoFlowState();
    activeOverride = scope === "opponent" ? state.opponentSkillFlowOverride : state.skillFlowOverride;
    forceMatch = state.forceSkillActive && state.forceSkillScope === scope && activeOverride === skillId;
    allowPendingServePass =
      state.pendingServe &&
      state.pendingServe.scope &&
      getOppositeScope(state.pendingServe.scope) === scope &&
      skillId === "pass";
  }
  const wasFreeball = !!state.freeballPending;
  const players = getPlayersForScope(scope);
  let playerIdx = parseInt(playerIdxStr, 10);
  if (isNaN(playerIdx) || !players[playerIdx]) {
    playerIdx = players.findIndex(p => p === playerName);
  }
  if ((playerIdx === -1 || !players[playerIdx]) && playerName) {
    const raw = playerName.trim().toLowerCase();
    const normalized = raw.replace(/^[0-9]+\\s*/, "");
    playerIdx = players.findIndex(p => {
      const base = (p || "").trim().toLowerCase();
      if (!base) return false;
      return base === normalized || base === raw;
    });
  }
  if (playerIdx === -1 || !players[playerIdx]) return false;
  if (skillId === "serve" && !serveMeta && state.pendingServe && state.pendingServe.scope === scope) {
    serveMeta = state.pendingServe.meta || null;
  }
  if (skillId === "serve") {
    const serveZone = getServeBaseZoneForPlayer(playerIdx, scope);
    if (serveZone !== 1) {
      return false;
    }
  }
  if (state.useOpponentTeam && state.predictiveSkillFlow) {
    const playerLabel = playerName || players[playerIdx];
    if (forceMatch || allowPendingServePass) {
      // forced skill always allowed
    } else if (isPostServeLockForScope(scope)) {
      if (skillId !== "serve" || code !== "=" || getActiveServerName(scope) !== playerLabel) {
        return false;
      }
    } else if (
      flowState &&
      flowState.teamScope &&
      flowState.teamScope !== scope &&
      !canOverrideServeError(scope, skillId, code, flowState, playerLabel)
    ) {
      return false;
    }
  }
  state.freeballPending = false;
  state.freeballPendingScope = scope;
  if (scope === "opponent") {
    state.opponentSkillFlowOverride = null;
  } else {
    state.skillFlowOverride = null;
  }
  const selectionVideoTime = state.videoScoutMode
    ? serveMeta && typeof serveMeta.videoTime === "number"
      ? serveMeta.videoTime
      : attackMeta && typeof attackMeta.videoTime === "number"
        ? attackMeta.videoTime
        : null
    : null;
  if (state.pendingServe && !forceMatch) {
    const pendingScope = state.pendingServe.scope;
    if (pendingScope && scope !== pendingScope && skillId !== "pass") {
      return false;
    }
  }
  const shouldInferServe = shouldInferServeFromPass(scope, skillId);
  if (shouldInferServe) {
    const servingScope = getOppositeScope(scope);
    const server = getServerPlayerForScope(servingScope);
    const pendingServe = state.pendingServe;
    const serveMetaToUse =
      pendingServe && pendingServe.scope === servingScope ? pendingServe.meta || {} : serveMeta || {};
    const serverName =
      pendingServe && pendingServe.scope === servingScope && pendingServe.playerName
        ? pendingServe.playerName
        : server
          ? server.name
          : null;
    const serverIdx =
      pendingServe && pendingServe.scope === servingScope && typeof pendingServe.playerIdx === "number"
        ? pendingServe.playerIdx
        : server
          ? server.idx
          : null;
    if (serverName) {
      const serveCode = getServeCodeFromPassCode(code);
      const serveEvent = buildBaseEventPayload({
        playerIdx: serverIdx,
        playerName: serverName,
        skillId: "serve",
        code: serveCode,
        teamScope: servingScope
      });
      serveEvent.derivedFromPassServe = true;
      serveEvent.serveType = serveMetaToUse.serveType || serveEvent.serveType || "JF";
      serveEvent.serveStart = serveMetaToUse.serveStart || serveEvent.serveStart || null;
      serveEvent.serveEnd = serveMetaToUse.serveEnd || serveEvent.serveEnd || null;
      applyReceiveContextToEvent(serveEvent);
      state.events.push(serveEvent);
      inferredServeEvent = serveEvent;
      incrementSkillStats(servingScope, serverIdx, "serve", serveCode);
      if (state.pendingServe && state.pendingServe.scope === servingScope) {
        state.pendingServe = null;
      }
    }
  }
  const event = buildBaseEventPayload({
    playerIdx,
    playerName: players[playerIdx],
    skillId,
    code,
    videoTime: selectionVideoTime,
    teamScope: scope
  });
  if (inferredServeEvent) {
    linkEvents(inferredServeEvent, event, "serve-pass");
  } else if (skillId === "pass" && state.useOpponentTeam) {
    const lastServe = findLastEventBySkills(state.events, {
      scope: getOppositeScope(scope),
      skillIds: ["serve"]
    });
    if (lastServe) {
      linkEvents(lastServe, event, "serve-pass");
    }
  }
  if (skillId === "defense" && state.useOpponentTeam) {
    const lastAttackOrBlock = findLastEventBySkills(state.events, {
      scope: getOppositeScope(scope),
      skillIds: ["attack", "block"]
    });
    if (lastAttackOrBlock) {
      const relType = lastAttackOrBlock.skillId === "block" ? "block-defense" : "attack-defense";
      linkEvents(lastAttackOrBlock, event, relType);
    }
  }
  if (skillId === "attack" && state.useOpponentTeam) {
    const lastSet = findLastEventBySkills(state.events, {
      scope,
      skillIds: ["second"]
    });
    if (lastSet) {
      linkEvents(lastSet, event, "set-attack");
    }
  }
  if (skillId === "serve") {
    if (serveMeta) {
      event.serveType = serveMeta.serveType || event.serveType || "JF";
      event.serveStart = serveMeta.serveStart || event.serveStart || null;
      event.serveEnd = serveMeta.serveEnd || event.serveEnd || null;
    } else if (!event.serveType) {
      event.serveType = "JF";
    }
    clearServeTypeInlineListener();
    if (state.pendingServe && state.pendingServe.scope === scope) {
      state.pendingServe = null;
    }
  }
  let appliedSetType = setTypeChoice || (attackMeta && attackMeta.setType) || null;
  if (skillId === "attack") {
    const otherScope = getOppositeScope(scope);
    if (
      state.useOpponentTeam &&
      state.predictiveSkillFlow &&
      code === "/" &&
      isSkillEnabledForScope("block", otherScope)
    ) {
      event.pendingBlockEval = true;
    }
    if (appliedSetType) {
      event.setType = appliedSetType;
    }
    if (attackMeta && attackMeta.trajectory) {
      applyAttackTrajectoryToEvent(event, attackMeta.trajectory);
    }
    const setterFromSet = getSetterFromLastSetEventForScope(scope);
    if (setterFromSet && (setterFromSet.idx !== null || setterFromSet.name)) {
      event.setterIdx = setterFromSet.idx;
      event.setterName = setterFromSet.name;
    } else {
      const setterFromCourt = getSetterFromCourtForScope(scope);
      event.setterIdx = setterFromCourt.idx;
      event.setterName = setterFromCourt.name;
    }
    // di default consideriamo l'attacco BP, poi correggiamo se deriva da ricezione
    event.attackBp = true;
  }
  event.fromFreeball = wasFreeball;
  if (!event.fromFreeball && skillId === "attack") {
    const prevEvent = state.events && state.events.length ? state.events[state.events.length - 1] : null;
    if (
      prevEvent &&
      prevEvent.skillId === "second" &&
      prevEvent.fromFreeball &&
      getTeamScopeFromEvent(prevEvent) === scope
    ) {
      event.fromFreeball = true;
    }
  }
  applyReceiveContextToEvent(event);
  state.events.push(event);
  handleAutoRotationFromEvent(event, scope);
  if (state.useOpponentTeam) {
    const nextFlow = computeTwoTeamFlowFromEvent(event);
    state.flowTeamScope = nextFlow.teamScope;
  }
  if (state.useOpponentTeam && state.predictiveSkillFlow && skillId === "serve" && code === "=") {
    const nextServeScope = getOppositeScope(scope);
    state.flowTeamScope = nextServeScope;
    state.isServing = nextServeScope === "our";
  }
  incrementSkillStats(scope, playerIdx, skillId, code);
  if (state.forceSkillActive && state.forceSkillScope === scope) {
    state.forceSkillActive = false;
    state.forceSkillScope = null;
  }
  const inferredAttackEvent = skillId === "block" ? applyBlockInference(event, scope, code) : null;
  if (inferredAttackEvent) {
    linkEvents(inferredAttackEvent, event, "attack-block");
  }
  if (skillId === "serve" && code === "/") {
    triggerFreeballFlow({ persist: false, rerender: false, scope });
  }
  if (skillId === "attack" && code === "!") {
    triggerFreeballFlow({ persist: false, rerender: false, scope });
  }
  if (
    state.useOpponentTeam &&
    state.predictiveSkillFlow &&
    (skillId === "pass" || skillId === "defense") &&
    code === "/"
  ) {
    triggerFreeballFlow({ persist: false, rerender: false, scope: getOppositeScope(scope) });
  }
  animateEventToLog(sourceEl, skillId, code);
  const persistLocal = typeof getPointDirection === "function" && !!getPointDirection(event);
  schedulePostEventUpdates({
    includeAggregates: !state.predictiveSkillFlow || !!inferredAttackEvent,
    append: !inferredAttackEvent,
    playerIdx,
    skillId,
    persistLocal,
    scope
  });
  if (
    (scope === "opponent" ? state.opponentAttackTrajectoryEnabled : state.attackTrajectoryEnabled) &&
    skillId === "attack" &&
    !(attackMeta && attackMeta.trajectory) &&
    !(attackMeta && attackMeta.trajectorySkipped)
  ) {
    const baseZoneForMapping = event.originZone || event.zone || event.playerPosition || null;
    const forceFar = isFarSideForScope(scope);
    openAttackTrajectoryModal({
      baseZone: baseZoneForMapping,
      setType: event.setType || null,
      forceFar,
      scope
    }).then(coords => {
      if (coords && coords.start && coords.end) {
        const mapZone = z => mapBackRowZone(z, baseZoneForMapping);
        const trajectoryPayload = {
          start: coords.start,
          end: coords.end,
          startZone: mapZone(coords.startZone || null),
          endZone: mapZone(coords.endZone || null),
          directionDeg: null
        };
        event.attackStart = coords.start;
        event.attackEnd = coords.end;
        event.attackStartZone = trajectoryPayload.startZone;
        event.attackEndZone = trajectoryPayload.endZone;
        event.attackDirection = trajectoryPayload; // richiesta: tutto dentro direzione attacco
        event.attackTrajectory = trajectoryPayload;
        if (!event.originZone) {
          event.originZone = baseZoneForMapping;
        }
        if (trajectoryPayload.startZone) {
          event.zone = trajectoryPayload.startZone;
          event.playerPosition = trajectoryPayload.startZone;
        }
        saveState({ persistLocal });
        renderEventsLog({ suppressScroll: true });
        renderVideoAnalysis();
        renderTrajectoryAnalysis();
        renderServeTrajectoryAnalysis();
      }
    });
  }
  if (
    (scope === "opponent" ? state.opponentServeTrajectoryEnabled : state.serveTrajectoryEnabled) &&
    skillId === "serve" &&
    !serveMeta &&
    code !== "="
  ) {
    captureServeTrajectory(event);
  }
  return true;
}
function computeMetrics(counts, skillId) {
  ensureMetricsConfigDefaults();
  const cfg = state.metricsConfig && state.metricsConfig[skillId];
  const total = RESULT_CODES.reduce((sum, code) => sum + (counts[code] || 0), 0);
  if (!total) {
    return { total: 0, pos: null, eff: null, prf: null, positiveCount: 0, negativeCount: 0 };
  }
  const positiveCodes = Array.from(new Set([...(cfg && cfg.positive ? cfg.positive : []), "#", "+"]));
  const negativeCodes = (cfg && cfg.negative) || ["-"];
  const positiveCount = positiveCodes.reduce((sum, code) => sum + (counts[code] || 0), 0);
  const negativeCount = negativeCodes.reduce(
    (sum, code) => sum + (counts[code] || 0),
    0
  );
  const pos = (positiveCount / total) * 100;
  const cfgPositivesOnly = (cfg && cfg.positive) || [];
  const effPosCount = cfgPositivesOnly.reduce((sum, code) => sum + (counts[code] || 0), 0);
  const eff = ((effPosCount - negativeCount) / total) * 100;
  const prf = ((counts["#"] || 0) / total) * 100;
  return { total, pos, eff, prf, positiveCount, negativeCount };
}
function getSkillLabel(skillId) {
  const skill = SKILLS.find(s => s.id === skillId);
  return (skill && skill.label) || skillId || "Fondamentale";
}
function getErrorTypeLabel(typeId) {
  const item = ERROR_TYPES.find(t => t.id === typeId);
  return (item && item.label) || "Generico";
}
function setSelectedErrorType(typeId, container) {
  selectedErrorType = typeId || "Generic";
  if (!container) return;
  const buttons = container.querySelectorAll("[data-error-type]");
  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.errorType === selectedErrorType);
  });
}
function ensurePlayerAnalysisState() {
  if (!state.uiPlayerAnalysis || typeof state.uiPlayerAnalysis !== "object") {
    state.uiPlayerAnalysis = {
      playerIdx: null,
      showAttack: true,
      showServe: true,
      showSecond: false,
      courtSideByScope: { our: "near", opponent: "far" }
    };
  }
  const prefs = state.uiPlayerAnalysis;
  prefs.showAttack = prefs.showAttack !== false;
  prefs.showServe = prefs.showServe !== false;
  prefs.showSecond = prefs.showSecond === true;
  if (!prefs.courtSideByScope || typeof prefs.courtSideByScope !== "object") {
    const fallback = typeof prefs.courtSide === "string" ? prefs.courtSide : "near";
    prefs.courtSideByScope = { our: getAnalysisCourtSide(fallback), opponent: "far" };
  } else {
    prefs.courtSideByScope = Object.assign({ our: "near", opponent: "far" }, prefs.courtSideByScope);
    prefs.courtSideByScope.our = getAnalysisCourtSide(prefs.courtSideByScope.our);
    prefs.courtSideByScope.opponent = getAnalysisCourtSide(prefs.courtSideByScope.opponent);
  }
  if (typeof prefs.playerIdx !== "number") {
    prefs.playerIdx = null;
  }
  return prefs;
}
function getPlayerAnalysisPlayerIdx() {
  const prefs = ensurePlayerAnalysisState();
  const players = getPlayersForScope(getAnalysisTeamScope());
  if (!players.length) {
    prefs.playerIdx = null;
    return null;
  }
  if (typeof prefs.playerIdx !== "number" || prefs.playerIdx < 0 || prefs.playerIdx >= players.length) {
    prefs.playerIdx = 0;
  }
  return prefs.playerIdx;
}
function getAggTableElements() {
  const table = elAggTableBody ? elAggTableBody.closest("table") : null;
  const thead = table ? table.querySelector("thead") : null;
  return { table, thead };
}
function ensureAggTableHeadCache(thead) {
  if (!thead || aggTableHeadCache !== null) return;
  aggTableHeadCache = thead.innerHTML;
}
function resetAggTableView() {
  aggTableView = { mode: "summary", skillId: null, playerIdx: null };
}
function getSkillIdFromHeader(th) {
  if (!th || !th.classList) return null;
  if (th.classList.contains("skill-serve")) return "serve";
  if (th.classList.contains("skill-pass")) return "pass";
  if (th.classList.contains("skill-attack")) return "attack";
  if (th.classList.contains("skill-block")) return "block";
  if (th.classList.contains("skill-defense")) return "defense";
  return null;
}
function renderAggDetailHeader(thead, columns) {
  if (!thead) return;
  thead.innerHTML = "";
  const tr = document.createElement("tr");
  columns.forEach((col, idx) => {
    const th = document.createElement("th");
    th.textContent = col.label;
    if (col.className) th.className = col.className;
    if (col.onClick) {
      th.classList.add("agg-table-back");
      th.addEventListener("click", col.onClick);
    }
    tr.appendChild(th);
  });
  thead.appendChild(tr);
}
function ensureSetStartSnapshot(setNum) {
  const targetSet = parseInt(setNum, 10) || state.currentSet || 1;
  state.setStarts = state.setStarts || {};
  if (state.setStarts[targetSet]) return;
  const ourCourt =
    typeof removeLiberosAndRestoreForScope === "function"
      ? removeLiberosAndRestoreForScope(state.court || [], "our")
      : cloneCourt(state.court || []);
  const oppCourt =
    typeof removeLiberosAndRestoreForScope === "function"
      ? removeLiberosAndRestoreForScope(state.opponentCourt || [], "opponent")
      : cloneCourt(state.opponentCourt || []);
  state.setStarts[targetSet] = {
    our: { court: cloneCourt(ourCourt || []), rotation: state.rotation || 1 },
    opponent: { court: cloneCourt(oppCourt || []), rotation: state.opponentRotation || 1 },
    swapCourt: !!state.courtSideSwapped,
    isServing: !!state.isServing
  };
}
function getPlayedSetNumbers() {
  const setNums = new Set();
  (state.events || []).forEach(ev => {
    const num = parseInt(ev && ev.set, 10);
    if (num) setNums.add(num);
  });
  return Array.from(setNums).sort((a, b) => a - b);
}
function getSetStartEntryForScope(setNum, scope) {
  const entry = state.setStarts && state.setStarts[setNum];
  if (entry) {
    const data = scope === "opponent" ? entry.opponent : entry.our;
    if (data && Array.isArray(data.court)) {
      return { court: data.court, rotation: typeof data.rotation === "number" ? data.rotation : 1 };
    }
  }
  if (setNum === 1) {
    const fallback = getDefaultSetStartForScope(scope);
    if (fallback) return fallback;
  }
  return null;
}
function makePlayerNameKey(name) {
  return String(name || "").trim().toLowerCase();
}
function buildSetStartInfoList(setNumbers, scope) {
  const substitutionsBySet = new Map();
  (setNumbers || []).forEach(num => substitutionsBySet.set(num, new Set()));
  (state.events || []).forEach(ev => {
    if (!ev || ev.actionType !== "substitution") return;
    const setNum = parseInt(ev.set, 10) || 1;
    if (!substitutionsBySet.has(setNum)) return;
    if (getTeamScopeFromEvent(ev) !== scope) return;
    const playerIn = makePlayerNameKey(ev.playerIn || "");
    if (playerIn) substitutionsBySet.get(setNum).add(playerIn);
  });
  return (setNumbers || []).map(setNum => {
    const entry = getSetStartEntryForScope(setNum, scope);
    const positions = new Map();
    if (entry && Array.isArray(entry.court)) {
      entry.court.forEach((slot, idx) => {
        const name = typeof slot === "string" ? slot : slot && typeof slot === "object" ? slot.main || "" : "";
        const key = makePlayerNameKey(name);
        if (!key) return;
        positions.set(key, idx + 1);
      });
    }
    const rotation = entry && typeof entry.rotation === "number" ? entry.rotation : 1;
    let setterPos = null;
    if (typeof getRoleLabelForRotation === "function") {
      for (let pos = 1; pos <= 6; pos += 1) {
        if (String(getRoleLabelForRotation(pos, rotation)).toUpperCase() === "P") {
          setterPos = pos;
          break;
        }
      }
    }
    const subsIn = substitutionsBySet.get(setNum) || new Set();
    return { setNum, positions, setterPos, subsIn };
  });
}
function renderAggSummaryHeader(thead, setNumbers) {
  if (!thead) return;
  thead.innerHTML = "";
  const rowTop = document.createElement("tr");
  const rowBottom = document.createElement("tr");
  const addCell = (row, label, { colspan, rowspan, className } = {}) => {
    const th = document.createElement("th");
    th.textContent = label;
    if (colspan) th.setAttribute("colspan", colspan);
    if (rowspan) th.setAttribute("rowspan", rowspan);
    if (className) th.className = className;
    row.appendChild(th);
  };
  addCell(rowTop, "Atleta", { rowspan: 2 });
  if (setNumbers && setNumbers.length) {
    addCell(rowTop, "Formazione di partenza", { colspan: setNumbers.length });
    setNumbers.forEach(num => {
      const th = document.createElement("th");
      th.textContent = "S" + num;
      th.className = "set-start-header";
      th.dataset.setNum = String(num);
      th.addEventListener("click", () => {
        const scope =
          analysisTeamFilterState.teams && analysisTeamFilterState.teams.has("opponent")
            ? "opponent"
            : "our";
        openSetStartEditor(num, scope);
      });
      rowBottom.appendChild(th);
    });
  }
  addCell(rowTop, "Punti", { colspan: 4 });
  addCell(rowTop, "Battuta", { colspan: 5, className: "skill-col skill-serve" });
  addCell(rowTop, "Ricezione", { colspan: 5, className: "skill-col skill-pass" });
  addCell(rowTop, "Attacco", { colspan: 6, className: "skill-col skill-attack" });
  addCell(rowTop, "Muro", { colspan: 2, className: "skill-col skill-block" });
  addCell(rowTop, "Difesa", { colspan: 3, className: "skill-col skill-defense" });

  addCell(rowBottom, "Fatti");
  addCell(rowBottom, "Subiti");
  addCell(rowBottom, "Δ");
  addCell(rowBottom, "Falli/Errori");

  addCell(rowBottom, "Tot", { className: "skill-col skill-serve" });
  addCell(rowBottom, "Err", { className: "skill-col skill-serve" });
  addCell(rowBottom, "Punti", { className: "skill-col skill-serve" });
  addCell(rowBottom, "Eff", { className: "skill-col skill-serve" });
  addCell(rowBottom, "Pos", { className: "skill-col skill-serve" });

  addCell(rowBottom, "Tot", { className: "skill-col skill-pass" });
  addCell(rowBottom, "Err", { className: "skill-col skill-pass" });
  addCell(rowBottom, "Pos", { className: "skill-col skill-pass" });
  addCell(rowBottom, "Prf", { className: "skill-col skill-pass" });
  addCell(rowBottom, "Eff", { className: "skill-col skill-pass" });

  addCell(rowBottom, "Tot", { className: "skill-col skill-attack" });
  addCell(rowBottom, "Err", { className: "skill-col skill-attack" });
  addCell(rowBottom, "Mur", { className: "skill-col skill-attack" });
  addCell(rowBottom, "Punti", { className: "skill-col skill-attack" });
  addCell(rowBottom, "% Punti", { className: "skill-col skill-attack" });
  addCell(rowBottom, "Eff", { className: "skill-col skill-attack" });

  addCell(rowBottom, "Tot", { className: "skill-col skill-block" });
  addCell(rowBottom, "Punti", { className: "skill-col skill-block" });

  addCell(rowBottom, "Tot", { className: "skill-col skill-defense" });
  addCell(rowBottom, "Err", { className: "skill-col skill-defense" });
  addCell(rowBottom, "Eff", { className: "skill-col skill-defense" });

  thead.appendChild(rowTop);
  thead.appendChild(rowBottom);
}
function buildAggBodyHeaderRows(thead) {
  if (!thead) return [];
  const rows = Array.from(thead.querySelectorAll("tr"));
  if (!rows.length) return [];
  return rows
    .map(sourceRow => {
      const cells = Array.from(sourceRow.children || []);
      if (!cells.length) return null;
      const tr = document.createElement("tr");
      tr.className = "agg-body-header";
      cells.forEach(cell => {
        const td = document.createElement("td");
        td.textContent = cell.textContent || "";
        if (cell.className) td.className = cell.className;
        if (cell.dataset) {
          Object.keys(cell.dataset).forEach(key => {
            td.dataset[key] = cell.dataset[key];
          });
        }
        const colspan = cell.getAttribute("colspan");
        if (colspan) td.setAttribute("colspan", colspan);
        const rowspan = cell.getAttribute("rowspan");
        if (rowspan) td.setAttribute("rowspan", rowspan);
        tr.appendChild(td);
      });
      return tr;
    })
    .filter(Boolean);
}
function applySkillClassToCells(cells, skillId, startIndex = 0) {
  if (!skillId) return;
  cells.forEach((td, idx) => {
    if (idx < startIndex) return;
    td.classList.add("skill-col", "skill-" + skillId);
  });
}
function getScopeFromSetHeaderTarget(target) {
  if (!target) return null;
  const row = target.closest("tr");
  if (row && row.dataset && row.dataset.teamScope) return row.dataset.teamScope;
  if (analysisTeamFilterState.teams && analysisTeamFilterState.teams.has("opponent")) return "opponent";
  return "our";
}
function bindSetStartHeaderClicks(thead) {
  if (!thead || thead._setStartBound) return;
  thead.addEventListener("click", ev => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    const cell = target.closest(".set-start-header");
    if (!cell || !cell.dataset || !cell.dataset.setNum) return;
    const setNum = parseInt(cell.dataset.setNum, 10);
    if (!setNum) return;
    const scope = getScopeFromSetHeaderTarget(cell);
    openSetStartEditor(setNum, scope);
  });
  thead._setStartBound = true;
}
function bindSetStartBodyHeaderClicks() {
  if (!elAggTableBody || elAggTableBody._setStartBound) return;
  elAggTableBody.addEventListener("click", ev => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    const cell = target.closest(".set-start-header");
    if (!cell || !cell.dataset || !cell.dataset.setNum) return;
    const setNum = parseInt(cell.dataset.setNum, 10);
    if (!setNum) return;
    const scope = getScopeFromSetHeaderTarget(cell);
    openSetStartEditor(setNum, scope);
  });
  elAggTableBody._setStartBound = true;
}
function bindAggSummaryInteractions(thead) {
  if (!thead) return;
  const headerRow = thead.querySelector("tr");
  if (!headerRow) return;
  const skillHeaders = headerRow.querySelectorAll("th.skill-col");
  skillHeaders.forEach(th => {
    const skillId = getSkillIdFromHeader(th);
    if (!skillId) return;
    th.classList.add("agg-skill-header");
    th.title = "Dettagli " + getSkillLabel(skillId);
    th.addEventListener("click", () => {
      aggTableView = { mode: "skill", skillId, playerIdx: null };
      renderAggregatedTable();
    });
  });
}
if (elSetStartModalClose) {
  elSetStartModalClose.addEventListener("click", closeSetStartModal);
}
if (elSetStartModalCancel) {
  elSetStartModalCancel.addEventListener("click", closeSetStartModal);
}
function renderAggSkillDetailTable(summaryAll) {
  const { thead } = getAggTableElements();
  if (!elAggTableBody || !thead) return;
  const skillId = aggTableView.skillId;
  const skillLabel = getSkillLabel(skillId);
  const skillHeaderClass = "skill-col skill-" + skillId;
  const analysisScope = getAnalysisTeamScope();
  const analysisPlayers = getPlayersForScope(analysisScope);
  const analysisNumbers = getPlayerNumbersForScope(analysisScope);
  renderAggDetailHeader(thead, [
    {
      label: "Atleta · " + skillLabel + " <- Tabellino",
      onClick: () => {
        resetAggTableView();
        renderAggregatedTable();
      }
    },
    { label: "Tot", className: skillHeaderClass },
    { label: "#", className: skillHeaderClass },
    { label: "+", className: skillHeaderClass },
    { label: "!", className: skillHeaderClass },
    { label: "-", className: skillHeaderClass },
    { label: "=", className: skillHeaderClass },
    { label: "/", className: skillHeaderClass },
    { label: "Pos", className: skillHeaderClass },
    { label: "Prf", className: skillHeaderClass },
    { label: "Eff", className: skillHeaderClass }
  ]);
  elAggTableBody.innerHTML = "";
  if (!analysisPlayers || analysisPlayers.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 11;
    td.textContent = "Aggiungi giocatrici per vedere il dettaglio " + skillLabel + ".";
    tr.appendChild(td);
    elAggTableBody.appendChild(tr);
    renderScoreAndRotations(summaryAll, analysisScope);
    renderSecondTable();
    renderTrajectoryAnalysis();
    renderServeTrajectoryAnalysis();
    return;
  }
  const totals = emptyCounts();
  const buildRow = (label, counts, playerIdx, isTotal = false) => {
    const metrics = computeMetrics(counts, skillId);
    const row = document.createElement("tr");
    if (isTotal) row.className = "rotation-row total";
    const cells = [
      label,
      metrics.total,
      counts["#"] || 0,
      counts["+"] || 0,
      counts["!"] || 0,
      counts["-"] || 0,
      counts["="] || 0,
      counts["/"] || 0,
      metrics.pos === null ? "-" : formatPercent(metrics.pos),
      metrics.prf === null ? "-" : formatPercent(metrics.prf),
      metrics.eff === null ? "-" : formatPercent(metrics.eff)
    ];
    const tdList = [];
    cells.forEach((text, idx) => {
      const td = document.createElement("td");
      td.textContent = text;
      if (idx === 0 && !isTotal) {
        td.classList.add("agg-player-cell");
        td.addEventListener("click", () => {
          const prefs = ensurePlayerAnalysisState();
          prefs.playerIdx = playerIdx;
          saveState();
          setActiveAggTab("player");
          renderPlayerAnalysis();
        });
      }
      tdList.push(td);
      row.appendChild(td);
    });
    applySkillClassToCells(tdList, skillId, 0);
    elAggTableBody.appendChild(row);
  };
  const sortedEntries =
    analysisScope === "opponent"
      ? getSortedPlayerEntriesForScope(analysisScope)
      : getSortedPlayerEntries();
  sortedEntries.forEach(({ name, idx }) => {
    const counts = getAggSkillCounts(skillId, idx);
    mergeCounts(totals, counts);
    const label =
      analysisScope === "opponent"
        ? formatNameWithNumberFor(name, analysisNumbers)
        : formatNameWithNumber(name);
    buildRow(label, counts, idx, false);
  });
  buildRow("Totale squadra", totals, null, true);
  renderScoreAndRotations(summaryAll, analysisScope);
  renderSecondTable();
  renderTrajectoryAnalysis();
  renderServeTrajectoryAnalysis();
}
function renderAggPlayerDetailTable(summaryAll) {
  const { thead } = getAggTableElements();
  if (!elAggTableBody || !thead) return;
  const playerIdx = aggTableView.playerIdx;
  const playerLabel = getAggSkillPlayerLabel(playerIdx);
  const analysisScope = getAnalysisTeamScope();
  const analysisPlayers = getPlayersForScope(analysisScope);
  renderAggDetailHeader(thead, [
    {
      label: "Fondamentale · " + playerLabel + " <- Tabellino",
      onClick: () => {
        resetAggTableView();
        renderAggregatedTable();
      }
    },
    { label: "Tot" },
    { label: "#" },
    { label: "+" },
    { label: "!" },
    { label: "-" },
    { label: "=" },
    { label: "/" },
    { label: "Pos" },
    { label: "Prf" },
    { label: "Eff" }
  ]);
  elAggTableBody.innerHTML = "";
  if (!analysisPlayers || analysisPlayers.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 11;
    td.textContent = "Aggiungi giocatrici per vedere il dettaglio.";
    tr.appendChild(td);
    elAggTableBody.appendChild(tr);
    renderScoreAndRotations(summaryAll, analysisScope);
    renderSecondTable();
    renderTrajectoryAnalysis();
    renderServeTrajectoryAnalysis();
    return;
  }
  const skillOrder = ["serve", "pass", "attack", "block", "defense"];
  skillOrder.forEach(skillId => {
    const counts = getAggSkillCounts(skillId, playerIdx);
    const metrics = computeMetrics(counts, skillId);
    const row = document.createElement("tr");
    const cells = [
      getSkillLabel(skillId),
      metrics.total,
      counts["#"] || 0,
      counts["+"] || 0,
      counts["!"] || 0,
      counts["-"] || 0,
      counts["="] || 0,
      counts["/"] || 0,
      metrics.pos === null ? "-" : formatPercent(metrics.pos),
      metrics.prf === null ? "-" : formatPercent(metrics.prf),
      metrics.eff === null ? "-" : formatPercent(metrics.eff)
    ];
    const tdList = [];
    cells.forEach(text => {
      const td = document.createElement("td");
      td.textContent = text;
      tdList.push(td);
      row.appendChild(td);
    });
    applySkillClassToCells(tdList, skillId, 0);
    elAggTableBody.appendChild(row);
  });
  renderScoreAndRotations(summaryAll, analysisScope);
  renderSecondTable();
  renderTrajectoryAnalysis();
  renderServeTrajectoryAnalysis();
}
function getAggSkillCounts(skillId, playerIdx) {
  if (!skillId) return emptyCounts();
  const statsSource =
    analysisStatsCache && analysisStatsScope === getAnalysisTeamScope()
      ? analysisStatsCache
      : state.stats || [];
  if (playerIdx === "team") {
    const totals = emptyCounts();
    Object.values(statsSource || []).forEach(playerStats => {
      const counts = normalizeCounts(playerStats && playerStats[skillId]);
      mergeCounts(totals, counts);
    });
    return totals;
  }
  const idx = typeof playerIdx === "number" ? playerIdx : parseInt(playerIdx, 10);
  if (isNaN(idx) || !statsSource || !statsSource[idx]) return emptyCounts();
  return normalizeCounts(statsSource[idx][skillId]);
}
function getAggSkillPlayerLabel(playerIdx) {
  if (playerIdx === "team") return "Totale squadra";
  const idx = typeof playerIdx === "number" ? playerIdx : parseInt(playerIdx, 10);
  const scope = getAnalysisTeamScope();
  const players = getPlayersForScope(scope);
  const numbers = getPlayerNumbersForScope(scope);
  if (isNaN(idx) || !players || !players[idx]) return "Giocatrice";
  return scope === "opponent"
    ? formatNameWithNumberFor(players[idx], numbers)
    : formatNameWithNumber(players[idx]);
}
function renderPlayerAnalysisControls() {
  if (!elPlayerAnalysisSelect) return;
  const prefs = ensurePlayerAnalysisState();
  renderAnalysisTeamFilter();
  const analysisScope = getAnalysisTeamScope();
  const players = getPlayersForScope(analysisScope);
  const numbers = getPlayerNumbersForScope(analysisScope);
  elPlayerAnalysisSelect.innerHTML = "";
  if (!players.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nessuna giocatrice";
    elPlayerAnalysisSelect.appendChild(opt);
    elPlayerAnalysisSelect.disabled = true;
  } else {
    const entries =
      analysisScope === "opponent"
        ? getSortedPlayerEntriesForScope(analysisScope)
        : getSortedPlayerEntries();
    entries.forEach(({ name, idx }) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent =
        analysisScope === "opponent"
          ? formatNameWithNumberFor(name, numbers) || name || "Giocatrice " + (idx + 1)
          : formatNameWithNumber(name) || name || "Giocatrice " + (idx + 1);
      elPlayerAnalysisSelect.appendChild(opt);
    });
    elPlayerAnalysisSelect.disabled = false;
    const selectedIdx = getPlayerAnalysisPlayerIdx();
    if (selectedIdx !== null) {
      elPlayerAnalysisSelect.value = String(selectedIdx);
    } else {
      const firstEntry = entries[0];
      elPlayerAnalysisSelect.value = firstEntry ? String(firstEntry.idx) : "0";
    }
  }
  if (!elPlayerAnalysisSelect._playerAnalysisBound) {
    elPlayerAnalysisSelect.addEventListener("change", () => {
      const idx = parseInt(elPlayerAnalysisSelect.value, 10);
      prefs.playerIdx = isNaN(idx) ? null : idx;
      saveState();
      renderPlayerAnalysis();
    });
    elPlayerAnalysisSelect._playerAnalysisBound = true;
  }
  if (elPlayerAnalysisCourtSide) {
    const scopeSide = getAnalysisCourtSide(prefs.courtSideByScope[analysisScope]);
    renderAnalysisCourtSideRadios(elPlayerAnalysisCourtSide, scopeSide, () => {
      const scope = getAnalysisTeamScope();
      prefs.courtSideByScope[scope] = getAnalysisCourtSide(getCheckedRadioValue(elPlayerAnalysisCourtSide));
      saveState();
      renderPlayerAnalysis();
    }, "analysis-player-court-side");
  }
  if (elPlayerAnalysisShowAttack) {
    elPlayerAnalysisShowAttack.checked = !!prefs.showAttack;
    if (!elPlayerAnalysisShowAttack._bound) {
      elPlayerAnalysisShowAttack.addEventListener("change", () => {
        prefs.showAttack = !!elPlayerAnalysisShowAttack.checked;
        saveState();
        renderPlayerAnalysis();
      });
      elPlayerAnalysisShowAttack._bound = true;
    }
  }
  if (elPlayerAnalysisShowServe) {
    elPlayerAnalysisShowServe.checked = !!prefs.showServe;
    if (!elPlayerAnalysisShowServe._bound) {
      elPlayerAnalysisShowServe.addEventListener("change", () => {
        prefs.showServe = !!elPlayerAnalysisShowServe.checked;
        saveState();
        renderPlayerAnalysis();
      });
      elPlayerAnalysisShowServe._bound = true;
    }
  }
  if (elPlayerAnalysisShowSecond) {
    elPlayerAnalysisShowSecond.checked = !!prefs.showSecond;
    if (!elPlayerAnalysisShowSecond._bound) {
      elPlayerAnalysisShowSecond.addEventListener("change", () => {
        prefs.showSecond = !!elPlayerAnalysisShowSecond.checked;
        saveState();
        renderPlayerAnalysis();
      });
      elPlayerAnalysisShowSecond._bound = true;
    }
  }
}
function renderPlayerAnalysisTable() {
  if (!elPlayerAnalysisBody) return;
  elPlayerAnalysisBody.innerHTML = "";
  const idx = getPlayerAnalysisPlayerIdx();
  const analysisScope = getAnalysisTeamScope();
  const players = getPlayersForScope(analysisScope);
  const numbers = getPlayerNumbersForScope(analysisScope);
  const filteredEvents = filterEventsByAnalysisTeam(state.events || []);
  const statsByPlayer = ensureAnalysisStatsCache();
  if (idx === null || !players || !players[idx]) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 26;
    td.textContent = "Seleziona una giocatrice per vedere il tabellino.";
    tr.appendChild(td);
    elPlayerAnalysisBody.appendChild(tr);
    return;
  }
  const name = players[idx];
  const serveCounts = normalizeCounts(statsByPlayer[idx] && statsByPlayer[idx].serve);
  const passCounts = normalizeCounts(statsByPlayer[idx] && statsByPlayer[idx].pass);
  const attackCounts = normalizeCounts(statsByPlayer[idx] && statsByPlayer[idx].attack);
  const blockCounts = normalizeCounts(statsByPlayer[idx] && statsByPlayer[idx].block);
  const defenseCounts = normalizeCounts(statsByPlayer[idx] && statsByPlayer[idx].defense);

  const serveMetrics = computeMetrics(serveCounts, "serve");
  const passMetrics = computeMetrics(passCounts, "pass");
  const attackMetrics = computeMetrics(attackCounts, "attack");
  const defenseMetrics = computeMetrics(defenseCounts, "defense");

  const playerPoints = computePlayerPointsMap(filteredEvents, analysisScope);
  const playerErrors = computePlayerErrorsMap(filteredEvents);
  const points = playerPoints[idx] || { for: 0, against: 0 };
  const personalErrors = playerErrors[idx] || 0;
  const attackTotal = totalFromCounts(attackCounts);

  const row = document.createElement("tr");
  const cells = [
    {
      text:
        analysisScope === "opponent"
          ? formatNameWithNumberFor(name, numbers)
          : formatNameWithNumber(name)
    },
    { text: points.for || 0 },
    { text: points.against || 0 },
    { text: formatDelta((points.for || 0) - (points.against || 0)) },
    { text: personalErrors || 0 },

    { text: totalFromCounts(serveCounts), className: "skill-col skill-serve" },
    { text: serveCounts["="] || 0, className: "skill-col skill-serve" },
    { text: serveCounts["#"] || 0, className: "skill-col skill-serve" },
    { text: serveMetrics.eff === null ? "-" : formatPercent(serveMetrics.eff), className: "skill-col skill-serve" },
    { text: serveMetrics.pos === null ? "-" : formatPercent(serveMetrics.pos), className: "skill-col skill-serve" },

    { text: totalFromCounts(passCounts), className: "skill-col skill-pass" },
    { text: passMetrics.negativeCount || 0, className: "skill-col skill-pass" },
    { text: passMetrics.pos === null ? "-" : formatPercent(passMetrics.pos), className: "skill-col skill-pass" },
    { text: passMetrics.prf === null ? "-" : formatPercent(passMetrics.prf), className: "skill-col skill-pass" },
    { text: passMetrics.eff === null ? "-" : formatPercent(passMetrics.eff), className: "skill-col skill-pass" },

    { text: attackTotal, className: "skill-col skill-attack" },
    { text: attackCounts["="] || 0, className: "skill-col skill-attack" },
    { text: attackCounts["/"] || 0, className: "skill-col skill-attack" },
    { text: attackCounts["#"] || 0, className: "skill-col skill-attack" },
    { text: formatPercentValue(attackCounts["#"] || 0, attackTotal), className: "skill-col skill-attack" },
    { text: attackMetrics.eff === null ? "-" : formatPercent(attackMetrics.eff), className: "skill-col skill-attack" },

    { text: totalFromCounts(blockCounts), className: "skill-col skill-block" },
    { text: (blockCounts["#"] || 0) + (blockCounts["+"] || 0), className: "skill-col skill-block" },

    { text: totalFromCounts(defenseCounts), className: "skill-col skill-defense" },
    { text: defenseMetrics.negativeCount || 0, className: "skill-col skill-defense" },
    { text: defenseMetrics.eff === null ? "-" : formatPercent(defenseMetrics.eff), className: "skill-col skill-defense" }
  ];
  cells.forEach(cell => {
    const td = document.createElement("td");
    td.textContent = cell.text;
    if (cell.className) td.className = cell.className;
    row.appendChild(td);
  });
  elPlayerAnalysisBody.appendChild(row);
}
function updatePlayerAnalysisVisibility() {
  const prefs = ensurePlayerAnalysisState();
  if (elPlayerAnalysisAttack) {
    elPlayerAnalysisAttack.classList.toggle("hidden", !prefs.showAttack);
  }
  if (elPlayerAnalysisServe) {
    elPlayerAnalysisServe.classList.toggle("hidden", !prefs.showServe);
  }
  if (elPlayerAnalysisSecond) {
    elPlayerAnalysisSecond.classList.toggle("hidden", !prefs.showSecond);
  }
}
function renderPlayerAnalysis() {
  if (!elPlayerAnalysisBody) return;
  renderPlayerAnalysisControls();
  renderPlayerAnalysisTable();
  updatePlayerAnalysisVisibility();
  const prefs = ensurePlayerAnalysisState();
  if (prefs.showAttack) {
    renderPlayerTrajectoryAnalysis();
  }
  if (prefs.showServe) {
    renderPlayerServeTrajectoryAnalysis();
  }
  if (prefs.showSecond) {
    renderPlayerSecondTable();
  }
}
function renderAggSkillModal(skillId, playerIdx) {
  if (!elAggSkillModalBody) return;
  ensureAnalysisStatsCache();
  const skillLabel = getSkillLabel(skillId);
  const playerLabel = getAggSkillPlayerLabel(playerIdx);
  if (elAggSkillModalTitle) {
    elAggSkillModalTitle.textContent = skillLabel + " · " + playerLabel;
  }
  const counts = getAggSkillCounts(skillId, playerIdx);
  const metrics = computeMetrics(counts, skillId);
  elAggSkillModalBody.innerHTML = "";
  const summary = document.createElement("div");
  summary.className = "agg-skill-summary";
  const summaryItems = [
    { label: "Totale", value: metrics.total },
    { label: "Positivi", value: metrics.positiveCount },
    { label: "Negativi", value: metrics.negativeCount }
  ];
  if (metrics.prf !== null) {
    summaryItems.push({ label: "Prf", value: formatPercent(metrics.prf) });
  }
  if (metrics.pos !== null) {
    summaryItems.push({ label: "Pos", value: formatPercent(metrics.pos) });
  }
  if (metrics.eff !== null) {
    summaryItems.push({ label: "Eff", value: formatPercent(metrics.eff) });
  }
  summaryItems.forEach(item => {
    const card = document.createElement("div");
    card.className = "agg-skill-summary-card";
    const label = document.createElement("div");
    label.className = "agg-skill-summary-label";
    label.textContent = item.label;
    const value = document.createElement("div");
    value.className = "agg-skill-summary-value";
    value.textContent = item.value;
    card.appendChild(label);
    card.appendChild(value);
    summary.appendChild(card);
  });
  elAggSkillModalBody.appendChild(summary);
  const codesTable = document.createElement("table");
  codesTable.className = "agg-skill-codes";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Codice", "Tot", "%"].forEach(text => {
    const th = document.createElement("th");
    th.textContent = text;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  codesTable.appendChild(thead);
  const tbody = document.createElement("tbody");
  const codes = (state.metricsConfig[skillId]?.activeCodes || RESULT_CODES).slice();
  if (!codes.includes("/")) codes.push("/");
  if (!codes.includes("=")) codes.push("=");
  const ordered = codes.filter(c => c !== "/" && c !== "=").concat("/", "=");
  ordered.forEach(code => {
    const tr = document.createElement("tr");
    const count = counts[code] || 0;
    const cells = [code, count, formatPercentValue(count, metrics.total)];
    cells.forEach(text => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  codesTable.appendChild(tbody);
  elAggSkillModalBody.appendChild(codesTable);
}
function openAggSkillModal(skillId, playerIdx) {
  if (!elAggSkillModal || !elAggSkillModalBody) return;
  renderAggSkillModal(skillId, playerIdx);
  elAggSkillModal.classList.remove("hidden");
  setModalOpenState(true);
}
function closeAggSkillModal() {
  if (!elAggSkillModal) return;
  elAggSkillModal.classList.add("hidden");
  setModalOpenState(false);
}
window._closeAggSkillModal = closeAggSkillModal;
function emptyCounts() {
  return { "#": 0, "+": 0, "!": 0, "-": 0, "=": 0, "/": 0 };
}
function totalFromCounts(counts) {
  return RESULT_CODES.reduce((sum, code) => sum + (counts[code] || 0), 0);
}
function mergeCounts(target, source) {
  RESULT_CODES.forEach(code => {
    target[code] = (target[code] || 0) + (source[code] || 0);
  });
}
function getCurrentZoneForPlayer(playerIdx, forSkillId = null, scope = "our") {
  const players = getPlayersForScope(scope);
  if (typeof playerIdx !== "number" || !players || !players[playerIdx]) return null;
  const name = players[playerIdx];
  const getZoneFromCourt = court => {
    if (!court || !Array.isArray(court)) return null;
    const slotIdx = court.findIndex(
      slot => slot && (slot.main === name || slot.replaced === name)
    );
    if (slotIdx === -1) return null;
    return slotIdx + 1;
  };
  if (state.autoRolePositioning && forSkillId) {
    const displayCourt = getAutoRoleDisplayCourt(forSkillId, scope);
    const displayIdx = displayCourt.findIndex(
      item => item && item.slot && (item.slot.main === name || item.slot.replaced === name)
    );
    if (displayIdx !== -1) return displayIdx + 1;
  }
  const baseCourt = scope === "opponent" ? state.opponentCourt : state.court;
  return getZoneFromCourt(baseCourt);
}
function normalizeCounts(raw) {
  return Object.assign(emptyCounts(), raw || {});
}
function formatPercentValue(numerator, denominator) {
  if (!denominator) return "-";
  return formatPercent((numerator / denominator) * 100);
}
function formatPercent(x) {
  if (x === null || x === undefined || isNaN(x)) return "-";
  return x.toFixed(0) + "%";
}
function updateSkillStatsUI(playerIdx, skillId) {
  const row = elPlayersContainer.querySelector(
    '.skill-row[data-player-idx="' +
      playerIdx +
      '"][data-skill-id="' +
      skillId +
      '"]'
  );
  if (!row) return;
  const counts =
    (state.stats[playerIdx] && state.stats[playerIdx][skillId]) || {
      "#": 0,
      "+": 0,
      "!": 0,
      "-": 0,
      "=": 0,
      "/": 0
    };
  const metrics = computeMetrics(counts, skillId);
  const countsSpan = row.querySelector(".skill-counts");
  if (countsSpan) {
    countsSpan.textContent =
      "#:" +
      counts["#"] +
      " +:" +
      counts["+"] +
      " !:" +
      counts["!"] +
      " -:" +
      counts["-"] +
      " =:" +
      counts["="] +
      " /:" +
      counts["/"];
  }
  const statsDiv = row.querySelector(".skill-stats");
  if (!statsDiv) return;
  let text = "Tot: " + metrics.total;
  if (metrics.prf !== null) {
    text += " | Prf: " + formatPercent(metrics.prf);
  }
  if (metrics.pos !== null) {
    text += " | Pos: " + formatPercent(metrics.pos);
  }
  if (metrics.eff !== null) {
    text += " | Eff: " + formatPercent(metrics.eff);
  }
  statsDiv.textContent = text;
}
function recalcAllStatsAndUpdateUI() {
  initStats();
  state.events.forEach(ev => {
    const idx = ev.playerIdx;
    if (ev && ev.team === "opponent") {
      return;
    }
    if (ev.skillId === "manual" || ev.actionType === "timeout" || ev.actionType === "substitution") {
      return;
    }
    if (idx === null || idx === undefined || idx < 0 || !state.players[idx]) {
      return;
    }
    if (!state.stats[idx]) {
      state.stats[idx] = {};
    }
    if (!state.stats[idx][ev.skillId]) {
      state.stats[idx][ev.skillId] = {
        "#": 0,
        "+": 0,
        "!": 0,
        "-": 0,
        "=": 0,
        "/": 0
      };
    }
    state.stats[idx][ev.skillId][ev.code] =
      (state.stats[idx][ev.skillId][ev.code] || 0) + 1;
  });
  state.players.forEach((_, idx) => {
    SKILLS.forEach(skill => {
      updateSkillStatsUI(idx, skill.id);
    });
  });
  renderLiveScore();
  renderAggregatedTable();
  if (activeAggTab === "player") {
    renderPlayerAnalysis();
  }
  renderVideoAnalysis();
}
function getEventKey(ev, fallbackIdx = 0) {
  if (!ev) return "ev-" + fallbackIdx;
  if (typeof ev.eventId === "number" || typeof ev.eventId === "string") return ev.eventId;
  if (!ev.__tmpKey) {
    ev.__tmpKey = "tmp-" + (ev.t || Date.now()) + "-" + fallbackIdx;
  }
  return ev.__tmpKey;
}
function pruneEventSelection() {
  const allKeys = new Set();
  Object.values(eventTableContexts).forEach(ctx => {
    ctx.rows.forEach(r => allKeys.add(r.key));
  });
  Array.from(selectedEventIds).forEach(key => {
    if (!allKeys.has(key)) selectedEventIds.delete(key);
  });
  if (lastSelectedEventId && !allKeys.has(lastSelectedEventId)) {
    lastSelectedEventId = null;
  }
}
function clearEventSelection({ clearContexts = true } = {}) {
  selectedEventIds.clear();
  lastSelectedEventId = null;
  lastEventContextKey = null;
  if (clearContexts) {
    Object.keys(eventTableContexts).forEach(key => {
      delete eventTableContexts[key];
    });
  }
  updateSelectionStyles();
}
function updateSelectionStyles() {
  pruneEventSelection();
  Object.values(eventTableContexts).forEach(ctx => {
    const total = ctx.rows ? ctx.rows.length : 0;
    const selectedCount = ctx.rows ? ctx.rows.filter(r => selectedEventIds.has(r.key)).length : 0;
    if (ctx.selectAllCheckbox) {
      ctx.selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < total;
      ctx.selectAllCheckbox.checked = total > 0 && selectedCount === total;
    }
    if (ctx.table) {
      ctx.table.classList.toggle("bulk-edit-active", selectedCount > 1);
    }
    ctx.rows.forEach(r => {
      const selected = selectedEventIds.has(r.key);
      r.tr.dataset.selected = selected ? "true" : "false";
      r.tr.classList.toggle("selected", selected);
      if (r.checkbox) {
        r.checkbox.checked = selected;
      }
    });
  });
}
function registerEventTableContext(key, ctx) {
  if (!key) return;
  eventTableContexts[key] = ctx;
  updateSelectionStyles();
}
function removeEventTableContext(key) {
  if (!key) return;
  delete eventTableContexts[key];
  updateSelectionStyles();
}
function getRowsForContext(contextKey) {
  const ctx = eventTableContexts[contextKey];
  return ctx ? ctx.rows : [];
}
function getSelectedRows(contextKey = null) {
  if (contextKey && eventTableContexts[contextKey]) {
    return eventTableContexts[contextKey].rows.filter(r => selectedEventIds.has(r.key));
  }
  const seen = new Set();
  const rows = [];
  const ctxOrder = ["video", "log", ...Object.keys(eventTableContexts)];
  ctxOrder.forEach(key => {
    const ctx = eventTableContexts[key];
    if (!ctx) return;
    ctx.rows.forEach(r => {
      if (selectedEventIds.has(r.key) && !seen.has(r.key)) {
        seen.add(r.key);
        rows.push(r);
      }
    });
  });
  return rows;
}
function setSelectionForContext(contextKey, keysSet, anchorKey = null, opts = {}) {
  const ctx = contextKey ? eventTableContexts[contextKey] : null;
  if (!ctx) return;
  selectedEventIds.clear();
  keysSet.forEach(k => selectedEventIds.add(k));
  lastSelectedEventId = anchorKey || Array.from(keysSet)[0] || null;
  lastEventContextKey = contextKey;
  updateSelectionStyles();
  closeCurrentEdit();
  if (typeof ctx.onSelectionChange === "function") {
    ctx.onSelectionChange(getSelectedRows(contextKey), contextKey, opts);
  }
}
function toggleSelectionForContext(contextKey, key, opts = {}) {
  const next = new Set(selectedEventIds);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  setSelectionForContext(contextKey, next, key, opts);
}
function selectRangeForContext(contextKey, anchorKey, targetKey, opts = {}) {
  const rows = getRowsForContext(contextKey);
  if (!rows.length) return;
  const anchorIdx = Math.max(0, rows.findIndex(r => r.key === anchorKey));
  const targetIdx = Math.max(0, rows.findIndex(r => r.key === targetKey));
  const start = Math.min(anchorIdx, targetIdx);
  const end = Math.max(anchorIdx, targetIdx);
  const range = new Set(rows.slice(start, end + 1).map(r => r.key));
  setSelectionForContext(contextKey, range, anchorKey, opts);
}
function getActiveEventContextKey() {
  if (lastEventContextKey && eventTableContexts[lastEventContextKey]) return lastEventContextKey;
  if (activeTab === "video" && eventTableContexts.video) return "video";
  if (eventTableContexts.log) return "log";
  const keys = Object.keys(eventTableContexts);
  return keys[0] || null;
}
function isEditingField(target) {
  if (!target) return false;
  const tag = (target.tagName || "").toLowerCase();
  if (target.isContentEditable) return true;
  return ["input", "textarea", "select", "option", "button"].includes(tag);
}
function scrollRowIntoView(record) {
  if (!record || !record.tr || typeof record.tr.scrollIntoView !== "function") return;
  record.tr.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function handleSeekForSelection(contextKey, opts = {}) {
  if (!opts || !opts.userAction) return;
  const activeTab = document && document.body ? document.body.dataset.activeTab : "";
  if (contextKey === "log" && !state.videoScoutMode && activeTab !== "video") {
    return;
  }
  const rows = getSelectedRows(contextKey);
  if (!rows.length) return;
  const target =
    rows.find(r => r.key === lastSelectedEventId) ||
    rows[rows.length - 1];
  if (!target) return;
  const t = typeof target.videoTime === "number" ? target.videoTime : null;
  if (isFinite(t)) {
    const preservePlayback =
      typeof opts.preservePlayback === "boolean" ? opts.preservePlayback : contextKey === "log";
    seekVideoToTime(t, { preservePlayback });
  }
}
function moveSelection(contextKey, delta, extendRange = false) {
  const ctx = eventTableContexts[contextKey];
  if (!ctx || !ctx.rows.length) return;
  const rows = ctx.rows;
  const currentKey =
    (selectedEventIds.size && lastSelectedEventId && selectedEventIds.has(lastSelectedEventId)
      ? lastSelectedEventId
      : selectedEventIds.values().next().value) || rows[0].key;
  if (extendRange && selectedEventIds.size) {
    const selectedIdx = rows
      .map((row, idx) => (selectedEventIds.has(row.key) ? idx : -1))
      .filter(idx => idx !== -1);
    const edgeIdx = delta > 0 ? Math.max(...selectedIdx) : Math.min(...selectedIdx);
    let anchorKey =
      lastSelectedEventId && selectedEventIds.has(lastSelectedEventId)
        ? lastSelectedEventId
        : rows[selectedIdx[0]].key;
    let targetIdx = Math.min(rows.length - 1, Math.max(0, edgeIdx + delta));
    const targetKey = rows[targetIdx].key;
    selectRangeForContext(contextKey, anchorKey, targetKey, { userAction: true });
    const targetRow = rows.find(r => r.key === targetKey);
    scrollRowIntoView(targetRow);
    handleSeekForSelection(contextKey, { userAction: true });
    return;
  }
  let anchorKey = currentKey;
  let anchorIdx = rows.findIndex(r => r.key === anchorKey);
  if (anchorIdx === -1) {
    anchorIdx = 0;
    anchorKey = rows[0].key;
  }
  let targetIdx = Math.min(rows.length - 1, Math.max(0, anchorIdx + delta));
  const targetKey = rows[targetIdx].key;
  setSelectionForContext(contextKey, new Set([targetKey]), targetKey, { userAction: true });
  const targetRow = rows.find(r => r.key === targetKey);
  scrollRowIntoView(targetRow);
  handleSeekForSelection(contextKey, { userAction: true });
}
function adjustSelectedVideoTimes(deltaSeconds) {
  const rows = getSelectedRows(getActiveEventContextKey());
  if (!rows.length) return;
  pushVideoUndoSnapshot();
  rows.forEach(r => {
    const ev = r.ev;
    if (!ev) return;
    const current =
      typeof ev.videoTime === "number"
        ? ev.videoTime
        : typeof r.videoTime === "number"
          ? r.videoTime
          : 0;
    const next = Math.max(0, current + deltaSeconds);
    ev.videoTime = next;
  });
  refreshAfterVideoEdit(false);
  renderEventsLog();
  handleSeekForSelection(getActiveEventContextKey(), { userAction: true });
}
function adjustCurrentRowVideoTime(deltaSeconds) {
  const ctxKey = getActiveEventContextKey();
  if (!ctxKey || !eventTableContexts[ctxKey]) return;
  const rows = eventTableContexts[ctxKey].rows || [];
  if (!rows.length) return;
  pushVideoUndoSnapshot();
  const currentKey =
    (selectedEventIds.size && lastSelectedEventId && selectedEventIds.has(lastSelectedEventId)
      ? lastSelectedEventId
      : selectedEventIds.values().next().value) || rows[0].key;
  const target = rows.find(r => r.key === currentKey);
  if (!target || !target.ev) return;
  const baseMs = getVideoBaseTimeMs(getVideoSkillEvents());
  const current =
    typeof target.ev.videoTime === "number"
      ? target.ev.videoTime
      : typeof target.videoTime === "number"
        ? target.videoTime
        : computeEventVideoTime(target.ev, baseMs);
  target.ev.videoTime = Math.max(0, current + deltaSeconds);
  saveState({ persistLocal: true });
  renderEventsLog();
  renderVideoAnalysis();
  handleSeekForSelection(ctxKey, { userAction: true });
}
function buildSelectedSegments() {
  const rows = getSelectedRows("video");
  const baseRows = rows.length ? rows : getSelectedRows(getActiveEventContextKey());
  if (!baseRows.length) return [];
  const segments = baseRows
    .map(r => {
      const ev = r.ev || {};
      const start =
        typeof r.videoTime === "number"
          ? r.videoTime
          : typeof ev.videoTime === "number"
            ? ev.videoTime
            : computeEventVideoTime(ev, getVideoBaseTimeMs(getVideoSkillEvents()));
      const duration =
        typeof ev.durationMs === "number" && isFinite(ev.durationMs) ? ev.durationMs / 1000 : 5;
      const end = start + duration;
      return {
        key: r.key,
        start,
        end,
        duration,
        label:
          (ev.playerName
            ? formatNameWithNumberFor(ev.playerName, getPlayerNumbersForScope(getTeamScopeFromEvent(ev)))
            : "Evento") +
          " " +
          (ev.skillId || "") +
          " " +
          (ev.code || "")
      };
    })
    .filter(seg => isFinite(seg.start) && isFinite(seg.end))
    .sort((a, b) => a.start - b.start);
  return segments;
}
function getFileBasename(name) {
  if (!name) return "";
  const cleaned = String(name).split(/[\\/]/).pop();
  return cleaned || "";
}
function getFileExtension(name) {
  const base = getFileBasename(name);
  const idx = base.lastIndexOf(".");
  if (idx > 0 && idx < base.length - 1) return base.slice(idx);
  return "";
}
function stripFileExtension(name) {
  const base = getFileBasename(name);
  const idx = base.lastIndexOf(".");
  if (idx > 0) return base.slice(0, idx);
  return base;
}
function buildFfmpegConcatCommand(segments, inputName, outputName) {
  if (!segments || !segments.length) return "";
  const trims = segments
    .map((seg, idx) => {
      const start = seg.start.toFixed(2);
      const end = seg.end.toFixed(2);
      return `[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${idx}];` +
        `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${idx}]`;
    })
    .join(";");
  const concat = segments.map((_, idx) => `[v${idx}][a${idx}]`).join("") + `concat=n=${segments.length}:v=1:a=1[outv][outa]`;
  const input = inputName || "input.mp4";
  const output = outputName || "output.mp4";
  return `ffmpeg -i "${input}" -filter_complex "${trims};${concat}" -map "[outv]" -map "[outa]" -c:v libx264 -c:a aac "${output}"`;
}
async function copyFfmpegFromSelection() {
  const segments = buildSelectedSegments();
  if (!segments.length) {
    alert("Seleziona uno o più eventi per generare il comando ffmpeg.");
    return;
  }
  const inputName = state.video && state.video.youtubeId ? "" : getFileBasename(state.video && state.video.fileName);
  if (!inputName) {
    alert("Carica un file video locale per usare il comando ffmpeg.");
    return;
  }
  const ext = getFileExtension(inputName);
  const defaultBase = stripFileExtension(inputName) || "output";
  const outputBase = prompt("Nome file output (senza estensione):", defaultBase + "_clip");
  if (!outputBase) return;
  const sanitizedBase = stripFileExtension(outputBase.trim()) || "output";
  const outputName = sanitizedBase + ext;
  const cmd = buildFfmpegConcatCommand(segments, inputName, outputName);
  try {
    await navigator.clipboard.writeText(cmd);
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = cmd;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  alert("Comando ffmpeg copiato negli appunti.");
}
function renderEventsLog(options = {}) {
  const append = !!options.append;
  let summaryText = "Nessun evento";
  let compactSummary = "";
  const suppressScroll = !!options.suppressScroll;
  if (!state.events || state.events.length === 0) {
    if (elEventsLog) elEventsLog.innerHTML = "";
    if (elEventsLog) elEventsLog.textContent = "Nessun evento ancora registrato.";
    if (elEventsLogSummary) elEventsLogSummary.textContent = summaryText;
    if (elUndoLastSummary) elUndoLastSummary.textContent = "—";
    lastLogRenderedKey = null;
    return;
  }
  const recent = state.events.slice(-40).sort((a, b) => {
    const at = new Date(a.t || 0).getTime();
    const bt = new Date(b.t || 0).getTime();
    if (isFinite(at) && isFinite(bt) && at !== bt) return at - bt; // oldest first
    return (a.eventId || 0) - (b.eventId || 0);
  });
  const latest = recent[recent.length - 1];
  const latestKey = getEventKey(latest, recent.length - 1);
  const getEventSkillLabel = ev => {
    if (ev.actionType === "timeout") return "Timeout";
    if (ev.actionType === "substitution") return "Cambio";
    const meta = SKILLS.find(s => s.id === ev.skillId);
    return meta ? meta.label : ev.skillId || "";
  };
  const getEventShortLabel = ev => {
    if (ev.actionType === "timeout") return "TO";
    if (ev.actionType === "substitution") return "CH";
    return getShortSkill(ev.skillId);
  };
  const formatEv = ev => {
    const dateObj = new Date(ev.t);
    const timeStr = isNaN(dateObj.getTime())
      ? ""
      : dateObj.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
    const errorTypeLabel =
      ev.errorType && (ev.code === "error" || ev.code === "team-error")
        ? getErrorTypeLabel(ev.errorType)
        : "";
    const scope = getTeamScopeFromEvent(ev);
    const numbers = getPlayerNumbersForScope(scope);
    const nameLabel = ev.playerName ? formatNameWithNumberFor(ev.playerName, numbers) : null;
    const numRaw = ev.playerName ? numbers[ev.playerName] : null;
    const num =
      numRaw !== undefined && numRaw !== null && String(numRaw).trim() !== "" ? String(numRaw) : "";
    const leftText =
      "[S" +
      ev.set +
      "] " +
      (nameLabel || "#" + ev.playerIdx) +
      " - " +
      getEventSkillLabel(ev) +
      " " +
      ev.code +
      (errorTypeLabel ? " · " + errorTypeLabel : "");
    const shortSkill = getEventShortLabel(ev);
    const initials = getInitials(ev.playerName);
    const compact =
      (num || initials || "#" + (typeof ev.playerIdx === "number" ? ev.playerIdx + 1 : "?")) +
      " " +
      shortSkill +
      " " +
      (ev.code || "") +
      (errorTypeLabel ? " " + errorTypeLabel : "");
    const compactClean = compact.trim();
    return { leftText, timeStr, compact: compactClean };
  };
  const latestFmt = formatEv(latest);
  summaryText = latestFmt.leftText;
  compactSummary = latestFmt.compact;
  const skillEvents = getVideoSkillEvents();
  const baseMs = getVideoBaseTimeMs(skillEvents);
  let didAppend = false;
  if (append && elEventsLog && lastLogRenderedKey) {
    const lastIdx = recent.findIndex(ev => getEventKey(ev) === lastLogRenderedKey);
    if (lastIdx !== -1) {
      const toAppend = recent.slice(lastIdx + 1);
      if (toAppend.length > 0) {
        renderEventTableRows(elEventsLog, toAppend, {
          showSeek: false,
          showVideoTime: true,
          baseMs,
          enableSelection: true,
          contextKey: "log",
          onSelectionChange: (_rows, _ctx, opts) => handleSeekForSelection("log", opts),
          append: true
        });
        const table = elEventsLog.querySelector("table");
        const tbody = table ? table.querySelector("tbody") : null;
        const ctxRef = eventTableContexts.log;
        if (tbody && ctxRef && ctxRef.rows) {
          const overflow = tbody.rows.length - recent.length;
          if (overflow > 0) {
            for (let i = 0; i < overflow; i += 1) {
              const first = tbody.rows[0];
              if (first) first.remove();
            }
            ctxRef.rows.splice(0, overflow);
            pruneEventSelection();
          }
        }
        didAppend = true;
      }
    }
  }
  if (!didAppend) {
    if (elEventsLog) elEventsLog.innerHTML = "";
    renderEventTableRows(elEventsLog, recent, {
      showSeek: false,
      showVideoTime: true,
      baseMs,
      enableSelection: true,
      contextKey: "log",
      onSelectionChange: (_rows, _ctx, opts) => handleSeekForSelection("log", opts)
    });
  }
  lastLogRenderedKey = latestKey;
  if (elEventsLog && !suppressScroll) {
    requestAnimationFrame(() => {
      elEventsLog.scrollTop = elEventsLog.scrollHeight;
    });
  }
  if (elEventsLogSummary) {
    elEventsLogSummary.textContent = summaryText;
  }
  if (elUndoLastSummary) {
    elUndoLastSummary.textContent = compactSummary || "—";
  }
  updateTeamCounters();
  renderLogServeTrajectories();
}
function getTimeoutCountForSet(setNum) {
  const set = Number(setNum) || 1;
  return (state.events || []).filter(
    ev => ev && ev.actionType === "timeout" && ev.set === set && ev.code !== "TOA"
  ).length;
}
function getTimeoutOppCountForSet(setNum) {
  const set = Number(setNum) || 1;
  return (state.events || []).filter(
    ev => ev && ev.actionType === "timeout" && ev.set === set && ev.code === "TOA"
  ).length;
}
function getSubstitutionCountForSet(setNum) {
  const set = Number(setNum) || 1;
  return (state.events || []).filter(ev => ev && ev.actionType === "substitution" && ev.set === set).length;
}
function updateTeamCounters() {
  const setNum = state.currentSet || 1;
  if (elTimeoutCount) {
    const used = getTimeoutCountForSet(setNum);
    const remaining = Math.max(0, 2 - used);
    elTimeoutCount.textContent = String(remaining);
  }
  if (elTimeoutOppCount) {
    const used = getTimeoutOppCountForSet(setNum);
    const remaining = Math.max(0, 2 - used);
    elTimeoutOppCount.textContent = String(remaining);
  }
  if (elSubstitutionRemaining) {
    const used = getSubstitutionCountForSet(setNum);
    const remaining = Math.max(0, 6 - used);
    elSubstitutionRemaining.textContent = String(remaining);
  }
  if (elSubstitutionRemainingOpp) {
    const used = getSubstitutionCountForSet(setNum);
    const remaining = Math.max(0, 6 - used);
    elSubstitutionRemainingOpp.textContent = String(remaining);
  }
}
function recordTimeoutEvent() {
  recordSetAction("timeout", { playerName: "Timeout", code: "TO" });
  saveState({ persistLocal: true });
  renderEventsLog();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  updateRotationDisplay();
}
function recordOpponentTimeoutEvent() {
  recordSetAction("timeout", { playerName: "Timeout Avv.", code: "TOA" });
  saveState({ persistLocal: true });
  renderEventsLog();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  updateRotationDisplay();
}
function recordSubstitutionEvent({ playerIn, playerOut }) {
  const label = playerIn || "Cambio";
  recordSetAction("substitution", {
    playerName: label,
    playerIn: playerIn || null,
    playerOut: playerOut || null,
    code: "SUB"
  });
  saveState({ persistLocal: true });
  renderEventsLog();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  updateRotationDisplay();
}
function openOffsetModal() {
  if (!elOffsetModal || !elOffsetSkillGrid) return;
  elOffsetSkillGrid.innerHTML = "";
  SKILLS.forEach(skill => {
    const row = document.createElement("div");
    row.className = "offset-skill-row";
    const label = document.createElement("label");
    label.textContent = skill.label;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "1";
    input.value = "0";
    input.dataset.skillId = skill.id;
    row.appendChild(label);
    row.appendChild(input);
    elOffsetSkillGrid.appendChild(row);
  });
  elOffsetModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}
function closeOffsetModal() {
  if (!elOffsetModal) return;
  elOffsetModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}
function getDefaultSkillDurationMs() {
  return 5000;
}
function renderSkillDurationGrid() {
  if (!elSkillDurationGrid) return;
  elSkillDurationGrid.innerHTML = "";
  const last = state.skillDurationLastApplied || {};
  SKILLS.forEach(skill => {
    const row = document.createElement("div");
    row.className = "offset-skill-row";
    const label = document.createElement("label");
    label.textContent = skill.label;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "250";
    input.min = "250";
    const storedValue = last[skill.id];
    const baseValue =
      typeof storedValue === "number" && isFinite(storedValue) && storedValue > 0
        ? String(storedValue)
        : String(getDefaultSkillDurationMs());
    input.value = baseValue;
    input.dataset.skillId = skill.id;
    row.appendChild(label);
    row.appendChild(input);
    elSkillDurationGrid.appendChild(row);
  });
}
function openSkillDurationModal() {
  if (!elSkillDurationModal) return;
  renderSkillDurationGrid();
  elSkillDurationModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}
function closeSkillDurationModal() {
  if (!elSkillDurationModal) return;
  elSkillDurationModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}
function applySkillDurationDefaults() {
  if (!elSkillDurationGrid) return;
  const defaults = {};
  elSkillDurationGrid.querySelectorAll("input[data-skill-id]").forEach(input => {
    const id = input.dataset.skillId;
    const value = parseFloat(input.value || "0");
    if (!id || !isFinite(value) || value <= 0) return;
    defaults[id] = value;
  });
  if (!Object.keys(defaults).length) {
    alert("Inserisci una durata valida per almeno una skill.");
    return;
  }
  pushVideoUndoSnapshot(true);
  (state.events || []).forEach(ev => {
    if (!ev || !ev.skillId) return;
    const next = defaults[ev.skillId];
    if (!next) return;
    ev.durationMs = next;
  });
  state.skillDurationLastApplied = defaults;
  saveState({ persistLocal: true });
  renderEventsLog({ suppressScroll: true });
  renderVideoAnalysis();
  closeSkillDurationModal();
}
const LINK_TIME_OPTIONS = [
  {
    type: "serve-pass",
    label: "Battuta / Ricezione",
    source: { id: "serve", label: "Battuta" },
    target: { id: "pass", label: "Ricezione" }
  },
  {
    type: "set-attack",
    label: "Attacco / Alzata",
    source: { id: "attack", label: "Attacco" },
    target: { id: "second", label: "Alzata" }
  },
  {
    type: "attack-block",
    label: "Attacco / Muro",
    source: { id: "attack", label: "Attacco" },
    target: { id: "block", label: "Muro" }
  },
  {
    type: "attack-defense",
    label: "Attacco / Difesa",
    source: { id: "attack", label: "Attacco" },
    target: { id: "defense", label: "Difesa" }
  },
  {
    type: "block-defense",
    label: "Muro / Difesa",
    source: { id: "block", label: "Muro" },
    target: { id: "defense", label: "Difesa" }
  }
];
function renderUnifyTimesOptions() {
  if (!elUnifyTimesGrid) return;
  elUnifyTimesGrid.innerHTML = "";
  LINK_TIME_OPTIONS.forEach(opt => {
    const row = document.createElement("div");
    row.className = "unify-times-row";
    const head = document.createElement("div");
    head.className = "unify-times-row__head";
    const enable = document.createElement("input");
    enable.type = "checkbox";
    enable.checked = true;
    enable.dataset.linkType = opt.type;
    const label = document.createElement("span");
    label.className = "unify-times-row__label";
    label.textContent = opt.label;
    head.appendChild(enable);
    head.appendChild(label);
    row.appendChild(head);
    const options = document.createElement("div");
    options.className = "unify-times-row__options";
    const name = `unify-source-${opt.type}`;
    const sourceLabel = document.createElement("label");
    const sourceInput = document.createElement("input");
    sourceInput.type = "radio";
    sourceInput.name = name;
    sourceInput.value = opt.source.id;
    sourceInput.checked = true;
    sourceLabel.appendChild(sourceInput);
    sourceLabel.appendChild(document.createTextNode(opt.source.label));
    const targetLabel = document.createElement("label");
    const targetInput = document.createElement("input");
    targetInput.type = "radio";
    targetInput.name = name;
    targetInput.value = opt.target.id;
    targetLabel.appendChild(targetInput);
    targetLabel.appendChild(document.createTextNode(opt.target.label));
    options.appendChild(sourceLabel);
    options.appendChild(targetLabel);
    row.appendChild(options);
    elUnifyTimesGrid.appendChild(row);
  });
}
function openUnifyTimesModal() {
  if (!elUnifyTimesModal) return;
  renderUnifyTimesOptions();
  elUnifyTimesModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}
function closeUnifyTimesModal() {
  if (!elUnifyTimesModal) return;
  elUnifyTimesModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}
function getFilteredVideoEventsForAnalysis() {
  const skillEvents = getVideoSkillEvents();
  const filtered = skillEvents
    .map(item => item.ev)
    .filter(ev => matchesVideoFilters(ev, videoFilterState));
  return { events: filtered, baseMs: getVideoBaseTimeMs(skillEvents) };
}
function resolveSourceEventForLink(evA, evB, preferredSkill) {
  if (preferredSkill) {
    if (evA.skillId === preferredSkill) return evA;
    if (evB.skillId === preferredSkill) return evB;
  }
  if (typeof evA.videoTime === "number") return evA;
  if (typeof evB.videoTime === "number") return evB;
  return evA;
}
function applyUnifyTimes() {
  if (!elUnifyTimesGrid) return;
  const enabledTypes = new Set();
  const preferredSources = {};
  elUnifyTimesGrid.querySelectorAll("input[type=\"checkbox\"][data-link-type]").forEach(input => {
    if (input.checked) enabledTypes.add(input.dataset.linkType);
  });
  LINK_TIME_OPTIONS.forEach(opt => {
    const selected = elUnifyTimesGrid.querySelector(`input[name="unify-source-${opt.type}"]:checked`);
    preferredSources[opt.type] = selected ? selected.value : opt.source.id;
  });
  if (!enabledTypes.size) {
    alert("Seleziona almeno un collegamento da unificare.");
    return;
  }
  const { events, baseMs } = getFilteredVideoEventsForAnalysis();
  if (!events.length) {
    alert("Non ci sono skill con i filtri attivi.");
    return;
  }
  const byId = new Map();
  events.forEach(ev => {
    if (ev && ev.eventId != null) byId.set(ev.eventId, ev);
  });
  const seen = new Set();
  const pairs = [];
  events.forEach(ev => {
    const links = Array.isArray(ev.relatedLinks) ? ev.relatedLinks : [];
    links.forEach(link => {
      if (!link || !enabledTypes.has(link.type)) return;
      const other = byId.get(link.eventId);
      if (!other || other === ev) return;
      const aId = ev.eventId;
      const bId = other.eventId;
      if (aId == null || bId == null) return;
      const key = aId < bId ? `${aId}|${bId}|${link.type}` : `${bId}|${aId}|${link.type}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ a: ev, b: other, type: link.type });
    });
  });
  if (!pairs.length) {
    alert("Nessun collegamento trovato nei filtri attivi.");
    return;
  }
  pushVideoUndoSnapshot(true);
  pairs.forEach(pair => {
    const preferred = preferredSources[pair.type] || null;
    const source = resolveSourceEventForLink(pair.a, pair.b, preferred);
    const time = computeEventVideoTime(source, baseMs);
    if (!isFinite(time)) return;
    pair.a.videoTime = time;
    pair.b.videoTime = time;
  });
  saveState({ persistLocal: true });
  renderEventsLog({ suppressScroll: true });
  renderVideoAnalysis();
  closeUnifyTimesModal();
}
function applyOffsetsToSelectedSkills() {
  const ctxKey = getActiveEventContextKey();
  const rows = ctxKey ? getSelectedRows(ctxKey) : [];
  if (!rows.length) {
    alert("Seleziona una o più skill da modificare.");
    return;
  }
  if (!elOffsetSkillGrid) return;
  const offsets = {};
  elOffsetSkillGrid.querySelectorAll("input[data-skill-id]").forEach(input => {
    const id = input.dataset.skillId;
    const value = parseFloat(input.value || "0");
    if (id && !isNaN(value) && value !== 0) offsets[id] = value;
  });
  if (!Object.keys(offsets).length) {
    alert("Inserisci almeno un offset diverso da 0.");
    return;
  }
  pushVideoUndoSnapshot();
  const baseMs = getVideoBaseTimeMs(getVideoSkillEvents());
  rows.forEach(r => {
    const ev = r.ev;
    if (!ev || !ev.skillId) return;
    const delta = offsets[ev.skillId];
    if (!delta) return;
    const current =
      typeof ev.videoTime === "number"
        ? ev.videoTime
        : typeof r.videoTime === "number"
          ? r.videoTime
          : computeEventVideoTime(ev, baseMs);
    ev.videoTime = Math.max(0, current + delta);
  });
  saveState({ persistLocal: true });
  renderEventsLog();
  renderVideoAnalysis();
  handleSeekForSelection(ctxKey, { userAction: true });
  closeOffsetModal();
}
function getVideoSkillEvents() {
  return (state.events || [])
    .map((ev, idx) => ({ ev, idx }))
    .filter(item => item.ev && item.ev.skillId);
}
function getVideoBaseTimeMs(eventsList) {
  const list = eventsList || getVideoSkillEvents();
  if (!list.length) return null;
  const baseMs = new Date(list[0].ev.t).getTime();
  return isNaN(baseMs) ? null : baseMs;
}
function computeEventVideoTime(ev, baseMs) {
  if (ev && typeof ev.videoTime === "number") {
    return Math.max(0, ev.videoTime);
  }
  const offset =
    state.video && typeof state.video.offsetSeconds === "number" ? state.video.offsetSeconds : 0;
  if (!ev) return Math.max(0, offset);
  const base = typeof baseMs === "number" ? baseMs : null;
  if (!base) return Math.max(0, offset);
  const evMs = new Date(ev.t).getTime();
  const delta = isNaN(evMs) ? 0 : (evMs - base) / 1000;
  if (!isFinite(delta)) return Math.max(0, offset);
  return Math.max(0, offset + delta);
}
function formatVideoTimestamp(seconds) {
  if (!isFinite(seconds)) return "00:00:00";
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}
function parseYoutubeId(url) {
  if (!url) return "";
  try {
    const u = new URL(url.trim());
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "");
    }
    if (u.hostname.includes("youtube.com")) {
      return u.searchParams.get("v") || "";
    }
    return "";
  } catch (_) {
    return "";
  }
}
function buildYoutubeEmbedSrc(id, startSeconds = 0, enableApi = false, autoplay = false) {
  const start = Math.max(0, Math.floor(startSeconds));
  const origin =
    window.location && window.location.origin && window.location.origin.startsWith("http")
      ? "&origin=" + encodeURIComponent(window.location.origin)
      : "";
  const apiParam = enableApi ? "1" : "0";
  const autoplayParam = autoplay ? "&autoplay=1" : "";
  return (
    "https://www.youtube.com/embed/" +
    id +
    "?enablejsapi=" +
    apiParam +
    "&rel=0&playsinline=1&start=" +
    start +
    origin +
    autoplayParam
  );
}
function loadYoutubeApi() {
  if (window.YT && typeof window.YT.Player === "function") {
    return Promise.resolve();
  }
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise(resolve => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onload = () => {
      if (window.YT && typeof window.YT.Player === "function") {
        resolve();
      }
    };
    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };
    document.body.appendChild(script);
  });
  return ytApiPromise;
}
function applyPendingYoutubeSeek() {
  if (!pendingYoutubeSeek || !ytPlayerReady || !ytPlayer || typeof ytPlayer.seekTo !== "function") {
    return;
  }
  const { time, autoplay } = pendingYoutubeSeek;
  ytPlayer.seekTo(Math.max(0, time), true);
  if (autoplay && typeof ytPlayer.playVideo === "function") {
    ytPlayer.playVideo();
  }
  pendingYoutubeSeek = null;
}
function queueYoutubeSeek(time, autoplay = true) {
  pendingYoutubeSeek = { time, autoplay };
  applyPendingYoutubeSeek();
}
async function renderYoutubePlayer(startSeconds = 0) {
  const id = state.video && state.video.youtubeId;
  const hasYoutube = !!id;
  if (elAnalysisVideo) {
    elAnalysisVideo.style.display = hasYoutube ? "none" : "block";
  }
  if (!elYoutubeFrame) return;
  elYoutubeFrame.style.display = hasYoutube ? "block" : "none";
  elYoutubeFrame.classList.toggle("active", hasYoutube);
  // se stiamo servendo da file:// o senza origin valido, forziamo il fallback embed per evitare errori 153
  const isFileOrigin = window.location && window.location.protocol === "file:";
  if (!hasYoutube) {
    if (ytPlayer && ytPlayer.stopVideo) {
      ytPlayer.stopVideo();
    }
    elYoutubeFrame.src = "";
    ytPlayerReady = false;
    currentYoutubeId = "";
    pendingYoutubeSeek = null;
    return;
  }
  const start = Math.max(0, startSeconds || 0);
  currentYoutubeId = id;
  youtubeFallback = isFileOrigin;
  if (youtubeFallback) {
    elYoutubeFrame.src = buildYoutubeEmbedSrc(id, start, true);
    return;
  }
  try {
    await loadYoutubeApi();
    if (ytPlayer) {
      ytPlayer.loadVideoById(id, start);
      ytPlayerReady = true;
      applyPendingYoutubeSeek();
      return;
    }
    ytPlayer = new YT.Player("youtube-frame", {
      videoId: id,
      host: "https://www.youtube.com",
      playerVars: {
        start: start,
        rel: 0,
        playsinline: 1,
        origin: window.location.origin
      },
      events: {
        onReady: () => {
          ytPlayerReady = true;
          applyPendingYoutubeSeek();
          if (start && !pendingYoutubeSeek) {
            ytPlayer.seekTo(start, true);
          }
        },
        onError: () => {
          ytPlayerReady = false;
          youtubeFallback = true;
          ytPlayer = null;
          pendingYoutubeSeek = null;
          if (elYoutubeFrame) {
            elYoutubeFrame.src = buildYoutubeEmbedSrc(id, start, true);
          }
        }
      }
    });
  } catch (_) {
    youtubeFallback = true;
    pendingYoutubeSeek = null;
    elYoutubeFrame.src = buildYoutubeEmbedSrc(id, start, true);
  }
}
async function renderYoutubePlayerScout(startSeconds = 0) {
  const id = state.video && state.video.youtubeId;
  const hasYoutube = !!id;
  if (elAnalysisVideoScout) {
    elAnalysisVideoScout.style.display = hasYoutube ? "none" : "block";
  }
  if (!elYoutubeFrameScout) return;
  elYoutubeFrameScout.style.display = hasYoutube ? "block" : "none";
  elYoutubeFrameScout.classList.toggle("active", hasYoutube);
  const isFileOrigin = window.location && window.location.protocol === "file:";
  if (!hasYoutube) {
    if (ytPlayerScout && ytPlayerScout.stopVideo) {
      ytPlayerScout.stopVideo();
    }
    elYoutubeFrameScout.src = "";
    ytPlayerScoutReady = false;
    currentYoutubeIdScout = "";
    return;
  }
  const start = Math.max(0, startSeconds || 0);
  currentYoutubeIdScout = id;
  youtubeScoutFallback = isFileOrigin;
  if (youtubeScoutFallback) {
    elYoutubeFrameScout.src = buildYoutubeEmbedSrc(id, start, true);
    return;
  }
  try {
    await loadYoutubeApi();
    if (ytPlayerScout) {
      ytPlayerScout.loadVideoById(id, start);
      ytPlayerScoutReady = true;
      return;
    }
    ytPlayerScout = new YT.Player("youtube-frame-scout", {
      videoId: id,
      host: "https://www.youtube.com",
      playerVars: {
        start: start,
        rel: 0,
        playsinline: 1,
        origin: window.location.origin
      },
      events: {
        onReady: () => {
          ytPlayerScoutReady = true;
          if (start) {
            ytPlayerScout.seekTo(start, true);
          }
        },
        onError: () => {
          ytPlayerScoutReady = false;
          youtubeScoutFallback = true;
          ytPlayerScout = null;
          if (elYoutubeFrameScout) {
            elYoutubeFrameScout.src = buildYoutubeEmbedSrc(id, start, true);
          }
        }
      }
    });
  } catch (_) {
    youtubeScoutFallback = true;
    elYoutubeFrameScout.src = buildYoutubeEmbedSrc(id, start, true);
  }
}
function syncYoutubeUrlInputs(value) {
  const url = value || "";
  if (elYoutubeUrlInput && elYoutubeUrlInput.value !== url) {
    elYoutubeUrlInput.value = url;
  }
  if (elYoutubeUrlInputScout && elYoutubeUrlInputScout.value !== url) {
    elYoutubeUrlInputScout.value = url;
  }
}
function handleYoutubeUrlLoad(url) {
  const id = parseYoutubeId(url);
  if (!id) {
    alert("Inserisci un link YouTube valido.");
    return;
  }
  if (videoObjectUrl) {
    try {
      URL.revokeObjectURL(videoObjectUrl);
    } catch (_) {
      // ignore
    }
    videoObjectUrl = "";
  }
  clearCachedLocalVideo();
  if (elAnalysisVideo) {
    elAnalysisVideo.pause();
    elAnalysisVideo.removeAttribute("src");
    elAnalysisVideo.load();
  }
  if (elAnalysisVideoScout) {
    elAnalysisVideoScout.pause();
    elAnalysisVideoScout.removeAttribute("src");
    elAnalysisVideoScout.load();
  }
  state.video = state.video || {
    offsetSeconds: 0,
    fileName: "",
    youtubeId: "",
    youtubeUrl: "",
    lastPlaybackSeconds: 0
  };
  state.video.youtubeId = id;
  state.video.youtubeUrl = url.trim();
  state.video.fileName = "YouTube: " + state.video.youtubeUrl;
  state.video.lastPlaybackSeconds = 0;
  syncYoutubeUrlInputs(state.video.youtubeUrl);
  saveState();
  renderYoutubePlayer(0);
  renderYoutubePlayerScout(0);
  renderVideoAnalysis();
}
function clearYoutubeSource() {
  if (!state.video) return;
  state.video.youtubeId = "";
  state.video.youtubeUrl = "";
  state.video.lastPlaybackSeconds = 0;
  syncYoutubeUrlInputs("");
  if (ytPlayer && ytPlayer.stopVideo) {
    ytPlayer.stopVideo();
  }
  ytPlayer = null;
  ytPlayerReady = false;
  youtubeFallback = false;
  pendingYoutubeSeek = null;
  if (elYoutubeFrame) {
    elYoutubeFrame.src = "";
    elYoutubeFrame.style.display = "none";
  }
  currentYoutubeId = "";
  if (ytPlayerScout && ytPlayerScout.stopVideo) {
    ytPlayerScout.stopVideo();
  }
  ytPlayerScout = null;
  ytPlayerScoutReady = false;
  youtubeScoutFallback = false;
  if (elYoutubeFrameScout) {
    elYoutubeFrameScout.src = "";
    elYoutubeFrameScout.style.display = "none";
  }
  currentYoutubeIdScout = "";
}
async function clearCachedLocalVideo() {
  try {
    if ("caches" in window) {
      const cache = await caches.open(LOCAL_VIDEO_CACHE);
      await cache.delete(LOCAL_VIDEO_REQUEST);
    }
    await clearVideoBlobFromDb();
  } catch (_) {
    // ignore cache errors
  }
}
function openVideoDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("indexedDB-unavailable"));
      return;
    }
    const request = indexedDB.open(LOCAL_VIDEO_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_VIDEO_STORE)) {
        db.createObjectStore(LOCAL_VIDEO_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("indexedDB-open-failed"));
  });
}
async function saveVideoBlobToDb(file) {
  if (!file) return;
  try {
    const db = await openVideoDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_VIDEO_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("indexedDB-write-failed"));
      tx.objectStore(LOCAL_VIDEO_STORE).put(file, "current");
    });
    db.close();
  } catch (_) {
    // ignore indexedDB errors
  }
}
async function loadVideoBlobFromDb() {
  try {
    const db = await openVideoDb();
    const blob = await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_VIDEO_STORE, "readonly");
      const req = tx.objectStore(LOCAL_VIDEO_STORE).get("current");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error("indexedDB-read-failed"));
    });
    db.close();
    return blob || null;
  } catch (_) {
    return null;
  }
}
async function clearVideoBlobFromDb() {
  try {
    const db = await openVideoDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_VIDEO_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("indexedDB-clear-failed"));
      tx.objectStore(LOCAL_VIDEO_STORE).delete("current");
    });
    db.close();
  } catch (_) {
    // ignore indexedDB errors
  }
}
async function persistLocalVideo(file) {
  if (!file) return;
  try {
    if ("caches" in window) {
      const cache = await caches.open(LOCAL_VIDEO_CACHE);
      await cache.put(
        LOCAL_VIDEO_REQUEST,
        new Response(file, { headers: { "Content-Type": file.type || "video/mp4" } })
      );
    }
    await saveVideoBlobToDb(file);
  } catch (_) {
    // ignore cache errors
  }
}
async function restoreCachedLocalVideo() {
  if (!elAnalysisVideo && !elAnalysisVideoScout) return;
  if (state.video && state.video.youtubeId) return;
  try {
    let blob = null;
    if ("caches" in window) {
      const cache = await caches.open(LOCAL_VIDEO_CACHE);
      const match = await cache.match(LOCAL_VIDEO_REQUEST);
      if (match) {
        blob = await match.blob();
      }
    }
    if (!blob) {
      blob = await loadVideoBlobFromDb();
    }
    if (!blob) return;
    if (videoObjectUrl) {
      try {
        URL.revokeObjectURL(videoObjectUrl);
      } catch (_) {
        // ignore
      }
    }
    const url = URL.createObjectURL(blob);
    videoObjectUrl = url;
    if (elAnalysisVideo) {
      elAnalysisVideo.src = url;
      elAnalysisVideo.load();
      applySavedPlaybackToVideo(elAnalysisVideo);
    }
    if (elAnalysisVideoScout) {
      elAnalysisVideoScout.src = url;
      elAnalysisVideoScout.load();
      applySavedPlaybackToVideo(elAnalysisVideoScout);
    }
    if (state.video) {
      state.video.fileName = state.video.fileName || "Video locale";
    }
    renderVideoAnalysis();
  } catch (_) {
    // ignore cache errors
  }
}
function restoreYoutubeFromState() {
  if (!state.video || !state.video.youtubeId) return;
  if (state.video.youtubeUrl) {
    syncYoutubeUrlInputs(state.video.youtubeUrl);
  }
  const start =
    typeof state.video.lastPlaybackSeconds === "number" && isFinite(state.video.lastPlaybackSeconds)
      ? state.video.lastPlaybackSeconds
      : state.video.offsetSeconds || 0;
  renderYoutubePlayer(start);
  renderYoutubePlayerScout(start);
  renderVideoAnalysis();
}
function updateVideoSyncLabel() {
  if (!elVideoSyncLabel) return;
  const offset =
    state.video && typeof state.video.offsetSeconds === "number" ? state.video.offsetSeconds : 0;
  elVideoSyncLabel.textContent =
    offset > 0 ? "Prima skill allineata a " + formatVideoTimestamp(offset) : "La prima skill parte da 0:00";
}
function shouldTrackVideoUndo() {
  return document && document.body && document.body.dataset.activeTab === "video";
}
function pushVideoUndoSnapshot(force = false) {
  if ((!force && !shouldTrackVideoUndo()) || (!force && bulkEditActive)) return;
  const snapshot = {
    events: JSON.parse(JSON.stringify(state.events || [])),
    video: Object.assign({}, state.video || {})
  };
  videoUndoStack.push(snapshot);
  if (videoUndoStack.length > VIDEO_UNDO_LIMIT) {
    videoUndoStack.shift();
  }
}
function markVideoUndoCapture(el) {
  if (!el || !el.dataset) return;
  if (el.dataset.undoCaptured === "true") return;
  pushVideoUndoSnapshot();
  el.dataset.undoCaptured = "true";
}
function undoLastVideoEdit() {
  const snapshot = videoUndoStack.pop();
  if (!snapshot) {
    alert("Non ci sono modifiche video da annullare.");
    return;
  }
  state.events = Array.isArray(snapshot.events) ? snapshot.events : [];
  state.video = Object.assign({}, state.video || {}, snapshot.video || {});
  saveState();
  recalcAllStatsAndUpdateUI();
  renderEventsLog({ suppressScroll: true });
  renderServeTrajectoryAnalysis();
  renderTrajectoryAnalysis();
  renderPlayers();
}
function resolvePlayerIdx(ev) {
  const scope = getTeamScopeFromEvent(ev);
  const players = getPlayersForScope(scope);
  if (typeof ev.playerIdx === "number" && players[ev.playerIdx]) {
    return ev.playerIdx;
  }
  return players.findIndex(name => name === ev.playerName);
}
function refreshAfterVideoEdit(shouldRecalcStats) {
  if (bulkEditActive) return;
  saveState({ persistLocal: shouldTrackVideoUndo() });
  if (shouldRecalcStats) {
    recalcAllStatsAndUpdateUI();
    renderEventsLog();
  }
  renderVideoAnalysis();
}
function createPlayerSelect(ev, onDone, options = {}) {
  const select = document.createElement("select");
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "—";
  select.appendChild(emptyOpt);
  const scope = getTeamScopeFromEvent(ev);
  const players = getPlayersForScope(scope);
  const numbers = getPlayerNumbersForScope(scope);
  players.forEach((name, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent =
      scope === "opponent" ? formatNameWithNumberFor(name, numbers) : formatNameWithNumber(name);
    select.appendChild(opt);
  });
  const isSetterTarget = options && options.target === "setter";
  const playerIdx = isSetterTarget
    ? typeof ev.setterIdx === "number"
      ? ev.setterIdx
      : typeof ev.setterName === "string"
        ? players.indexOf(ev.setterName)
        : -1
    : resolvePlayerIdx(ev);
  select.value = playerIdx >= 0 ? String(playerIdx) : "";
  select.addEventListener("change", () => {
    markVideoUndoCapture(select);
    const raw = select.value;
    const val = parseInt(raw, 10);
    if (!raw) {
      if (isSetterTarget) {
        ev.setterIdx = null;
        ev.setterName = null;
      } else {
        ev.playerIdx = null;
        ev.playerName = null;
      }
      refreshAfterVideoEdit(true);
      return;
    }
    if (!isNaN(val) && players[val]) {
      if (isSetterTarget) {
        ev.setterIdx = val;
        ev.setterName = players[val];
      } else {
        ev.playerIdx = val;
        ev.playerName = players[val];
      }
      refreshAfterVideoEdit(true);
    }
  });
  select.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return select;
}
function createSkillSelect(ev, onDone) {
  const select = document.createElement("select");
  SKILLS.forEach(skill => {
    const opt = document.createElement("option");
    opt.value = skill.id;
    opt.textContent = skill.label;
    select.appendChild(opt);
  });
  select.value = ev.skillId || SKILLS[0]?.id || "";
  select.addEventListener("change", () => {
    if (select.value) {
      ev.skillId = select.value;
      refreshAfterVideoEdit(true);
    }
  });
  select.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return select;
}
function createCodeSelect(ev, onDone) {
  const select = document.createElement("select");
  RESULT_CODES.forEach(code => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = code;
    select.appendChild(opt);
  });
  select.value = ev.code || RESULT_CODES[0];
  select.addEventListener("change", () => {
    markVideoUndoCapture(select);
    ev.code = select.value;
    refreshAfterVideoEdit(true);
  });
  select.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return select;
}
function createNumberSelect(ev, field, min, max, onDone) {
  const select = document.createElement("select");
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "—";
  select.appendChild(emptyOpt);
  for (let i = min; i <= max; i += 1) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    select.appendChild(opt);
  }
  select.value = ev[field] != null ? String(ev[field]) : "";
  select.addEventListener("change", () => {
    markVideoUndoCapture(select);
    const val = parseInt(select.value, 10);
    if (!isNaN(val) && val >= min && val <= max) {
      ev[field] = val;
      refreshAfterVideoEdit(field === "rotation" || field === "setterPosition" || field === "opponentSetterPosition");
    }
  });
  select.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return select;
}
function createBaseSelect(ev, onDone) {
  const select = document.createElement("select");
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "—";
  select.appendChild(emptyOpt);
  DEFAULT_BASE_OPTIONS.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label || opt.value;
    select.appendChild(option);
  });
  select.value = ev.base || "";
  select.addEventListener("change", () => {
    markVideoUndoCapture(select);
    ev.base = select.value || null;
    refreshAfterVideoEdit(true);
  });
  select.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return select;
}
function createSetTypeSelect(ev, onDone) {
  const select = document.createElement("select");
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "—";
  select.appendChild(emptyOpt);
  DEFAULT_SET_TYPE_OPTIONS.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label || opt.value;
    select.appendChild(option);
  });
  select.value = ev.setType || "";
  select.addEventListener("change", () => {
    markVideoUndoCapture(select);
    ev.setType = select.value || null;
    refreshAfterVideoEdit(true);
  });
  select.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return select;
}
function createServeTypeSelect(ev, onDone) {
  const select = document.createElement("select");
  const options = [
    { value: "F", label: "F" },
    { value: "JF", label: "JF" },
    { value: "S", label: "S" }
  ];
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "—";
  select.appendChild(emptyOpt);
  options.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
  });
  select.value = ev.serveType || "";
  select.addEventListener("change", () => {
    markVideoUndoCapture(select);
    ev.serveType = select.value || null;
    refreshAfterVideoEdit(true);
  });
  select.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return select;
}
function createEvalSelect(ev, field, onDone, { includeFb = false } = {}) {
  const select = document.createElement("select");
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "—";
  select.appendChild(emptyOpt);
  const list = RESULT_CODES.slice();
  if (includeFb) list.push("FB");
  list.forEach(code => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = code;
    select.appendChild(opt);
  });
  select.value = ev[field] || "";
  select.addEventListener("change", () => {
    markVideoUndoCapture(select);
    ev[field] = select.value || null;
    refreshAfterVideoEdit(true);
  });
  select.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return select;
}
function createPhaseSelect(ev, onDone) {
  const select = document.createElement("select");
  DEFAULT_PHASE_OPTIONS.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label || opt.value;
    select.appendChild(option);
  });
  const val = normalizePhaseValue(ev.attackBp);
  select.value = val || "bp";
  select.addEventListener("change", () => {
    markVideoUndoCapture(select);
    const choice = select.value;
    ev.attackBp = choice === "bp";
    refreshAfterVideoEdit(true);
  });
  select.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return select;
}
function createPlayerNameSelect(ev, field, onDone) {
  const select = document.createElement("select");
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "—";
  select.appendChild(emptyOpt);
  const scope = getTeamScopeFromEvent(ev);
  const players = getPlayersForScope(scope);
  const numbers = getPlayerNumbersForScope(scope);
  players.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = formatNameWithNumberFor(name, numbers) || name;
    select.appendChild(opt);
  });
  select.value = ev[field] || "";
  select.addEventListener("change", () => {
    markVideoUndoCapture(select);
    ev[field] = select.value || null;
    refreshAfterVideoEdit(true);
  });
  select.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return select;
}
function createSetInput(ev, onDone) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "5";
  input.value = ev.set || "";
  input.addEventListener("change", () => {
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val > 0) {
      ev.set = val;
      refreshAfterVideoEdit(true);
    }
  });
  input.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return input;
}
function createRotationInput(ev, onDone) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "6";
  input.value = ev.rotation || "";
  input.addEventListener("change", () => {
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 6) {
      ev.rotation = val;
      refreshAfterVideoEdit(true);
    }
  });
  input.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return input;
}
function createZoneInput(ev, onDone) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "6";
  input.placeholder = "1-6";
  const fallback = getCurrentZoneForPlayer(resolvePlayerIdx(ev), null, getTeamScopeFromEvent(ev));
  input.value = ev.zone || fallback || "";
  input.addEventListener("change", () => {
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 6) {
      ev.zone = val;
      refreshAfterVideoEdit(false);
    }
  });
  input.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return input;
}
function createVideoTimeInput(ev, videoTime, onDone) {
  const totalSeconds = Math.max(0, Number.isFinite(videoTime) ? videoTime : 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const wrapper = document.createElement("div");
  wrapper.className = "video-time-input";
  const makePart = (label, value, max) => {
    const block = document.createElement("label");
    block.className = "video-time-part";
    const span = document.createElement("span");
    span.textContent = label;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    if (typeof max === "number") input.max = String(max);
    input.step = "1";
    input.value = String(value);
    block.appendChild(span);
    block.appendChild(input);
    return { block, input };
  };
  const hh = makePart("H", hours, 23);
  const mm = makePart("M", minutes, 59);
  const ss = makePart("S", seconds, 59);
  wrapper.appendChild(hh.block);
  wrapper.appendChild(mm.block);
  wrapper.appendChild(ss.block);

  const commit = () => {
    markVideoUndoCapture(wrapper);
    const h = Math.max(0, parseInt(hh.input.value || "0", 10) || 0);
    const m = Math.max(0, parseInt(mm.input.value || "0", 10) || 0);
    const s = Math.max(0, parseInt(ss.input.value || "0", 10) || 0);
    const next = h * 3600 + m * 60 + s;
    ev.videoTime = Math.max(0, next);
    refreshAfterVideoEdit(false);
  };
  [hh.input, mm.input, ss.input].forEach(input => {
    input.addEventListener("change", commit);
    input.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      commit();
      if (typeof onDone === "function") onDone();
      renderVideoAnalysis();
    });
    input.addEventListener("blur", () => {
      commit();
      if (typeof onDone === "function") onDone();
      renderVideoAnalysis();
    });
  });
  return wrapper;
}
function makeEditableCell(td, _title, factory, guard = null) {
  const startEdit = () => {
    if (td.dataset.editing === "true") return;
    if (currentEditCell && currentEditCell !== td) {
      closeCurrentEdit({ refresh: false });
    }
    td.dataset.editing = "true";
    td.innerHTML = "";
    const endEdit = () => {
      td.dataset.editing = "false";
      if (currentEditControl === control) currentEditControl = null;
      if (currentEditCell === td) currentEditCell = null;
      closeCurrentEdit({ refresh: false });
    };
    const control = factory(() => {
      endEdit();
    });
    td.appendChild(control);
    currentEditControl = control;
    currentEditCell = td;
    if (typeof control.focus === "function") {
      control.focus();
    }
    control.addEventListener("blur", endEdit);
  };
  td.addEventListener("dblclick", e => {
    e.stopPropagation();
    const isAllowed =
      !guard || typeof guard.isRowSelected !== "function" || guard.isRowSelected() === true;
    if (!isAllowed) {
      if (guard && typeof guard.requestSelect === "function") {
        guard.requestSelect();
        setTimeout(() => {
          if (guard.isRowSelected && guard.isRowSelected()) {
            startEdit();
          }
        }, 0);
      }
      return;
    }
    startEdit();
  });
}
function renderEventTableRows(target, events, options = {}) {
  if (!target) return;
  const append = !!options.append;
  const contextKey = options.contextKey || target.id || (target.closest && target.closest("[data-context-key]")?.dataset.contextKey) || "events";
  const enableSelection = options.enableSelection !== false;
  const showCheckbox = options.showCheckbox !== false;
  if (!enableSelection) removeEventTableContext(contextKey);
  const showVideoTime = options.showVideoTime;
  const showSeek = options.showSeek;
  const showIndex = options.showIndex !== false;
  const baseMs = options.baseMs || null;
  const targetIsTbody = target.tagName && target.tagName.toLowerCase() === "tbody";
  let table = targetIsTbody ? null : null;
  let tbody = targetIsTbody ? target : null;
  let usingExisting = false;
  if (append) {
    if (targetIsTbody) {
      usingExisting = true;
    } else {
      table = target.querySelector("table");
      tbody = table ? table.querySelector("tbody") : null;
      usingExisting = !!tbody;
    }
  }
  if (!usingExisting) {
    target.innerHTML = "";
    table = targetIsTbody ? null : document.createElement("table");
    tbody = targetIsTbody ? target : document.createElement("tbody");
  }
  const rowRecords = [];
  let ctxRef = null;
  if (enableSelection) {
    if (append && eventTableContexts[contextKey]) {
      ctxRef = eventTableContexts[contextKey];
      ctxRef.onSelectionChange = options.onSelectionChange || ctxRef.onSelectionChange || null;
      ctxRef.baseMs = baseMs;
    } else {
      ctxRef = { rows: [], onSelectionChange: options.onSelectionChange || null, baseMs };
      eventTableContexts[contextKey] = ctxRef;
    }
  }

  const handleRowClick = (record, e, fromCheckbox = false) => {
    if (!enableSelection) return;
    const key = record.key;
    const isMeta = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;
    if (isShift && lastSelectedEventId && selectedEventIds.has(lastSelectedEventId)) {
      selectRangeForContext(contextKey, lastSelectedEventId, key, { userAction: true });
      scrollRowIntoView(record);
      return;
    }
    if (isMeta) {
      toggleSelectionForContext(contextKey, key, { userAction: true });
    } else {
      setSelectionForContext(contextKey, new Set([key]), key, { userAction: true });
    }
    scrollRowIntoView(record);
  };

  if (!targetIsTbody && !usingExisting) {
    table.className = options.tableClass || "event-edit-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headers = [
      ...(enableSelection && showCheckbox ? [{ label: "✓" }] : []),
      ...(showIndex ? [{ label: "ID" }] : []),
      ...(showVideoTime ? [{ label: "Tempo", bulkKey: "videoTime" }] : []),
      { label: "Set", bulkKey: "set" },
      { label: "Pt N" },
      { label: "Pt A" },
      { label: "Squadra" },
      { label: "Giocatrice", bulkKey: "player" },
      { label: "Alzatore", bulkKey: "setter" },
      { label: "Fondamentale", bulkKey: "skill" },
      { label: "Codice", bulkKey: "code" },
      { label: "Link" },
      { label: "Tipo errore" },
      { label: "FB N" },
      { label: "Rot", bulkKey: "rotation" },
      { label: "Zona", bulkKey: "zone" },
      { label: "Pos Palleggio", bulkKey: "setterPosition" },
      { label: "Pos Palleggio Avv", bulkKey: "opponentSetterPosition" },
      { label: "Zona Rice", bulkKey: "receivePosition" },
      { label: "Base", bulkKey: "base" },
      { label: "Tipo Alzata", bulkKey: "setType" },
      { label: "Combinazione", bulkKey: "combination" },
      { label: "Tipo Servizio", bulkKey: "serveType" },
      { label: "Servizio Start" },
      { label: "Servizio End" },
      { label: "Valut Rice", bulkKey: "receiveEvaluation" },
      { label: "Valut Att", bulkKey: "attackEvaluation" },
      { label: "Att BP", bulkKey: "attackBp" },
      { label: "Tipo Att", bulkKey: "attackType" },
      { label: "Direzione Att" },
      { label: "Muro N", bulkKey: "blockNumber" },
      { label: "In", bulkKey: "playerIn" },
      { label: "Out", bulkKey: "playerOut" },
      { label: "Dur (ms)", bulkKey: "durationMs" }
    ];
    headers.push({ label: "Elimina" });
    const bulkHeaders = [];
    headers.forEach((h, idx) => {
      const th = document.createElement("th");
      if (enableSelection && showCheckbox && idx === 0) {
        const selectAll = document.createElement("input");
        selectAll.type = "checkbox";
        selectAll.title = "Seleziona tutto";
        selectAll.addEventListener("change", () => {
          const ctx = eventTableContexts[contextKey];
          if (!ctx || !ctx.rows) return;
          if (selectAll.checked) {
            const all = new Set(ctx.rows.map(r => r.key));
            setSelectionForContext(contextKey, all, ctx.rows[0]?.key || null, { userAction: true });
          } else {
            setSelectionForContext(contextKey, new Set(), null, { userAction: true });
          }
        });
        th.appendChild(selectAll);
        if (ctxRef) ctxRef.selectAllCheckbox = selectAll;
      } else {
        th.textContent = h.label;
        if (h.bulkKey && BULK_EDIT_CONFIG[h.bulkKey]) {
          th.classList.add("bulk-editable");
          th.dataset.bulkKey = h.bulkKey;
          th.title = "Modifica tutte le skill selezionate";
          th.addEventListener("click", () => {
            const ctx = eventTableContexts[contextKey];
            if (!ctx || !ctx.rows) return;
            const selected = ctx.rows.filter(r => selectedEventIds.has(r.key));
            if (selected.length < 2) return;
            openBulkEditModal(contextKey, h.bulkKey);
          });
          bulkHeaders.push(th);
        }
      }
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    table.appendChild(tbody);
    if (ctxRef) {
      ctxRef.table = table;
      ctxRef.bulkHeaders = bulkHeaders;
    }
  }
  if (append && usingExisting && ctxRef && table) {
    ctxRef.table = table;
    ctxRef.bulkHeaders = Array.from(table.querySelectorAll("th.bulk-editable"));
  }
  const startIdx = append && ctxRef && ctxRef.rows ? ctxRef.rows.length : 0;
  events.forEach((ev, index) => {
    const displayIdx = append ? startIdx + index : index;
    const tr = document.createElement("tr");
    const videoTime = showVideoTime ? computeEventVideoTime(ev, baseMs) : null;
    const zoneDisplay = ev.zone || ev.playerPosition || "";
    const key = getEventKey(ev, displayIdx);
    let rowCheckbox = null;
    const editGuard = {
      isRowSelected: () => selectedEventIds.has(key),
      requestSelect: () => setSelectionForContext(contextKey, new Set([key]), key)
    };
    tr.className = "event-row";
    tr.dataset.eventKey = key;
    const formatTrajPoint = pt =>
      pt && typeof pt.x === "number" && typeof pt.y === "number"
        ? `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`
        : "";
    const traj = ev.attackTrajectory || {};
    const trajStartPt = traj.start || ev.attackStart || null;
    const trajEndPt = traj.end || ev.attackEnd || null;
    const receiveEvalDisplay = valueToString(ev.receiveEvaluation);
    const attackPhaseDisplay = formatAttackPhaseLabel(ev.attackBp);
    const formatAttackDir = () => {
      const dir = ev.attackDirection || traj || null;
      if (dir && typeof dir === "object") {
        const s = dir.start || trajStartPt;
        const e = dir.end || trajEndPt;
        const sStr = formatTrajPoint(s);
        const eStr = formatTrajPoint(e);
        return sStr && eStr ? `${sStr}→${eStr}` : sStr || eStr || "";
      }
      return valueToString(dir);
    };
    const formatRelatedEvents = () => {
      if (!Array.isArray(ev.relatedEvents) || ev.relatedEvents.length === 0) return "";
      return ev.relatedEvents.map(id => (id != null ? String(id) : "")).filter(Boolean).join(" ");
    };
    const resolveTeamLabel = () => {
      if (ev.team === "opponent") return state.selectedOpponentTeam || "Avversaria";
      if (ev.team && ev.team !== "opponent") return ev.teamName || state.selectedTeam || "Squadra";
      if (ev.code === "opp-error" || ev.code === "opp-point" || ev.playerName === "Avversari") {
        return state.selectedOpponentTeam || "Avversaria";
      }
      return state.selectedTeam || "Squadra";
    };
    if (enableSelection && showCheckbox) {
      const selectTd = document.createElement("td");
      selectTd.className = "row-select";
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = selectedEventIds.has(key);
      chk.addEventListener("click", e => {
        e.stopPropagation();
        handleRowClick({ key, tr, idx: displayIdx }, e, true);
      });
      selectTd.appendChild(chk);
      tr.appendChild(selectTd);
      rowCheckbox = chk;
    }
    const cells = [
      ...(showIndex ? [{ text: ev.eventId != null ? String(ev.eventId) : "" }] : []),
      ...(showVideoTime
        ? [
            {
              text: formatVideoTimestamp(videoTime),
              classes: ["event-time-cell"],
              editable: td =>
                makeEditableCell(td, "Tempo video", done => createVideoTimeInput(ev, videoTime, done), editGuard)
            }
          ]
        : []),
      {
        text: ev.set || "1",
        editable: td => makeEditableCell(td, "Set", done => createNumberSelect(ev, "set", 1, 5, done), editGuard)
      },
      { text: valueToString(ev.homeScore) },
      { text: valueToString(ev.visitorScore) },
      { text: resolveTeamLabel() },
      {
        text: (() => {
          const scope = getTeamScopeFromEvent(ev);
          const players = getPlayersForScope(scope);
          const numbers = getPlayerNumbersForScope(scope);
          const name = ev.playerName || players[resolvePlayerIdx(ev)];
          if (!name) return "—";
          return scope === "opponent"
            ? formatNameWithNumberFor(name, numbers)
            : formatNameWithNumber(name);
        })(),
        editable: td => makeEditableCell(td, "Giocatrice", done => createPlayerSelect(ev, done), editGuard)
      },
      {
        text: (() => {
          const scope = getTeamScopeFromEvent(ev);
          const players = getPlayersForScope(scope);
          const numbers = getPlayerNumbersForScope(scope);
          const setterName =
            ev.setterName || (typeof ev.setterIdx === "number" ? players[ev.setterIdx] : "");
          return setterName ? formatNameWithNumberFor(setterName, numbers) : "";
        })(),
        editable: td =>
          makeEditableCell(td, "Alzatore", done => createPlayerSelect(ev, done, { target: "setter" }), editGuard)
      },
      {
        text:
          ev.actionType === "timeout"
            ? "Timeout"
            : ev.actionType === "substitution"
              ? "Cambio"
              : (SKILLS.find(s => s.id === ev.skillId) || {}).label || ev.skillId || "",
        editable: td => makeEditableCell(td, "Fondamentale", done => createSkillSelect(ev, done), editGuard)
      },
      {
        text: ev.code || "",
        editable: td => makeEditableCell(td, "Codice", done => createCodeSelect(ev, done), editGuard)
      },
      { text: formatRelatedEvents() },
      {
        text:
          ev.errorType && (ev.code === "error" || ev.code === "team-error")
            ? getErrorTypeLabel(ev.errorType)
            : ""
      },
      { text: ev.skillId === "attack" && ev.fromFreeball ? "FB" : "" },
      {
        text: ev.rotation || "-",
        editable: td =>
          makeEditableCell(td, "Rotazione", done => createNumberSelect(ev, "rotation", 1, 6, done), editGuard)
      },
      {
        text: zoneDisplay ? String(zoneDisplay) : "",
        editable: td => makeEditableCell(td, "Zona", done => createNumberSelect(ev, "zone", 1, 6, done), editGuard)
      },
      {
        text: valueToString(ev.setterPosition || ev.rotation || ""),
        editable: td =>
          makeEditableCell(td, "Posizione palleggio", done => createNumberSelect(ev, "setterPosition", 1, 6, done), editGuard)
      },
      {
        text: valueToString(ev.opponentSetterPosition),
        editable: td =>
          makeEditableCell(
            td,
            "Posizione palleggio avv",
            done => createNumberSelect(ev, "opponentSetterPosition", 1, 6, done),
            editGuard
          )
      },
      {
        text: valueToString(ev.receivePosition),
        editable: td =>
          makeEditableCell(td, "Zona ricezione", done => createNumberSelect(ev, "receivePosition", 1, 6, done), editGuard)
      },
      {
        text: valueToString(ev.base),
        editable: td => makeEditableCell(td, "Base", done => createBaseSelect(ev, done), editGuard)
      },
      {
        text: valueToString(ev.setType),
        editable: td => makeEditableCell(td, "Tipo alzata", done => createSetTypeSelect(ev, done), editGuard)
      },
      {
        text: valueToString(ev.combination),
        editable: td => makeEditableCell(td, "Combinazione", done => createTextInput(ev, "combination", done), editGuard)
      },
      {
        text: valueToString(ev.serveType),
        editable: td => makeEditableCell(td, "Tipo servizio", done => createServeTypeSelect(ev, done), editGuard)
      },
      {
        text: formatTrajPoint(ev.serveStart),
        classes: ["traj-cell"],
        onClick: e => {
          e.stopPropagation();
          captureServeTrajectory(ev, { forcePopup: true }).then(() => {
            renderEventTableRows(target, events, options);
          });
        }
      },
      {
        text: formatTrajPoint(ev.serveEnd),
        classes: ["traj-cell"],
        onClick: e => {
          e.stopPropagation();
          captureServeTrajectory(ev, { forcePopup: true }).then(() => {
            renderEventTableRows(target, events, options);
          });
        }
      },
      {
        text: receiveEvalDisplay,
        editable: td =>
          makeEditableCell(
            td,
            "Valutazione ricezione",
            done => createEvalSelect(ev, "receiveEvaluation", done, { includeFb: true }),
            editGuard
          )
      },
      {
        text: valueToString(ev.attackEvaluation),
        editable: td =>
          makeEditableCell(td, "Valutazione attacco", done => createEvalSelect(ev, "attackEvaluation", done), editGuard)
      },
      {
        text: attackPhaseDisplay,
        editable: td => makeEditableCell(td, "Fase attacco", done => createPhaseSelect(ev, done), editGuard)
      },
      {
        text: valueToString(ev.attackType),
        editable: td => makeEditableCell(td, "Tipo attacco", done => createTextInput(ev, "attackType", done), editGuard)
      },
      {
        text: formatAttackDir(),
        classes: ["traj-cell"],
        onClick: e => {
          e.stopPropagation();
          const dir = ev.attackDirection || traj || null;
          const baseZonePrefill = ev.originZone || ev.zone || ev.playerPosition || null;
          const evScope = getTeamScopeFromEvent(ev);
          const forceFar = false;
          const prefill =
            dir && typeof dir === "object" && dir.start && dir.end
              ? {
                  start: dir.start,
                  end: dir.end,
                  startZone: dir.startZone,
                  endZone: dir.endZone,
                  baseZone: baseZonePrefill,
                  setType: ev.setType || null,
                  forceFar,
                  scope: evScope
                }
              : traj && traj.start && traj.end
              ? {
                  start: traj.start,
                  end: traj.end,
                  startZone: traj.startZone,
                  endZone: traj.endZone,
                  baseZone: baseZonePrefill,
                  setType: ev.setType || null,
                  forceFar,
                  scope: evScope
                }
              : { baseZone: baseZonePrefill, setType: ev.setType || null, forceFar, scope: evScope };
          openAttackTrajectoryModal(Object.assign({ forcePopup: true }, prefill)).then(coords => {
            if (!coords || !coords.start || !coords.end) return;
            const mapZone = z => mapBackRowZone(z, baseZonePrefill);
            const trajectoryPayload = {
              start: coords.start,
              end: coords.end,
              startZone: mapZone(coords.startZone || null),
              endZone: mapZone(coords.endZone || null),
              directionDeg: null
            };
            ev.attackStart = coords.start;
            ev.attackEnd = coords.end;
            ev.attackStartZone = trajectoryPayload.startZone;
            ev.attackEndZone = trajectoryPayload.endZone;
            ev.attackDirection = trajectoryPayload;
            ev.attackTrajectory = trajectoryPayload;
            if (!ev.originZone) {
              ev.originZone = baseZonePrefill;
            }
            if (trajectoryPayload.startZone) {
              ev.zone = trajectoryPayload.startZone;
              ev.playerPosition = trajectoryPayload.startZone;
            }
            saveState();
            renderEventsLog({ suppressScroll: true });
            renderVideoAnalysis();
            renderTrajectoryAnalysis();
            renderServeTrajectoryAnalysis();
          });
        }
      },
      {
        text: valueToString(ev.blockNumber),
        editable: td =>
          makeEditableCell(td, "Numero muro", done => createNumberInput(ev, "blockNumber", 0, undefined, done), editGuard)
      },
      {
        text: valueToString(ev.playerIn),
        editable: td => makeEditableCell(td, "In", done => createPlayerNameSelect(ev, "playerIn", done), editGuard)
      },
      {
        text: valueToString(ev.playerOut),
        editable: td => makeEditableCell(td, "Out", done => createPlayerNameSelect(ev, "playerOut", done), editGuard)
      },
      {
        text: valueToString(ev.durationMs || ""),
        editable: td =>
          makeEditableCell(td, "Durata (ms)", done => createNumberInput(ev, "durationMs", 0, undefined, done), editGuard)
      }
    ];
    cells.forEach(cell => {
      const td = document.createElement("td");
      if (cell.control) {
        td.innerHTML = "";
        td.appendChild(cell.control);
      } else {
        td.textContent = cell.text != null ? String(cell.text) : "";
      }
      if (cell.editable) {
        cell.editable(td);
      }
      if (cell.classes && Array.isArray(cell.classes)) {
        cell.classes.forEach(cls => td.classList.add(cls));
      }
      if (typeof cell.onClick === "function") {
        td.classList.add("clickable-cell");
        td.addEventListener("dblclick", e => cell.onClick(e, td));
      }
      tr.appendChild(td);
    });
    rowRecords.push({ key, tr, idx: displayIdx, ev, videoTime, checkbox: rowCheckbox });
    tr.addEventListener("dblclick", () => {
      if (showSeek) seekVideoToTime(videoTime);
    });
    if (enableSelection) {
      tr.addEventListener("click", e => handleRowClick({ key, tr, idx: displayIdx }, e));
    }
    const deleteTd = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "small danger";
    deleteBtn.textContent = "✕";
    deleteBtn.title = "Elimina skill";
    deleteBtn.addEventListener("click", e => {
      e.stopPropagation();
      deleteEventByKey(key);
    });
    deleteTd.appendChild(deleteBtn);
    tr.appendChild(deleteTd);
    tbody.appendChild(tr);
  });
  if (enableSelection && ctxRef) {
    if (append) {
      ctxRef.rows = (ctxRef.rows || []).concat(rowRecords);
    } else {
      ctxRef.rows = rowRecords;
    }
    registerEventTableContext(contextKey, ctxRef);
    handleSeekForSelection(contextKey);
  }
  if (!targetIsTbody && !usingExisting) {
    target.appendChild(table);
  }
}
function closeBulkEditModal() {
  if (!elBulkEditModal) return;
  elBulkEditModal.classList.add("hidden");
  if (elBulkEditBody) elBulkEditBody.innerHTML = "";
  if (elBulkEditHint) elBulkEditHint.textContent = "";
  setModalOpenState(false);
  bulkEditActive = false;
  bulkEditSession = null;
}
function shouldRecalcForBulkKey(bulkKey) {
  const noRecalc = new Set(["videoTime", "durationMs", "combination", "attackType"]);
  return !noRecalc.has(bulkKey);
}
function openBulkEditModal(contextKey, bulkKey) {
  if (!elBulkEditModal || !elBulkEditBody) return;
  const config = BULK_EDIT_CONFIG[bulkKey];
  if (!config) return;
  const rows = getSelectedRows(contextKey);
  if (!rows || rows.length < 2) return;
  const events = rows.map(r => r.ev).filter(Boolean);
  if (!events.length) return;
  const seed = Object.assign({}, events[0]);
  const pending = {};
  bulkEditSession = {
    pending,
    events,
    shouldRecalc: shouldRecalcForBulkKey(bulkKey)
  };
  bulkEditActive = true;
  const proxy = new Proxy(seed, {
    set: (_obj, prop, value) => {
      pending[prop] = value;
      seed[prop] = value;
      return true;
    },
    get: (_obj, prop) => seed[prop]
  });
  const ctx = eventTableContexts[contextKey] || {};
  const control = config.build({ proxy, events, context: ctx });
  elBulkEditBody.innerHTML = "";
  elBulkEditBody.appendChild(control);
  if (elBulkEditTitle) {
    elBulkEditTitle.textContent = "Modifica multipla: " + config.label;
  }
  if (elBulkEditHint) {
    elBulkEditHint.textContent = "Applica a " + events.length + " skill selezionate.";
  }
  elBulkEditModal.classList.remove("hidden");
  setModalOpenState(true);
  if (elBulkEditApply) {
    elBulkEditApply.onclick = () => {
      if (!bulkEditSession) {
        closeBulkEditModal();
        return;
      }
      const entries = Object.entries(bulkEditSession.pending || {});
      if (entries.length === 0) {
        closeBulkEditModal();
        return;
      }
      pushVideoUndoSnapshot(true);
      bulkEditActive = false;
      bulkEditSession.events.forEach(ev => {
        entries.forEach(([key, value]) => {
          ev[key] = value;
        });
      });
      const shouldRecalc = bulkEditSession.shouldRecalc;
      closeBulkEditModal();
      refreshAfterVideoEdit(shouldRecalc);
      renderEventsLog({ suppressScroll: true });
    };
  }
  const focusable = control && typeof control.querySelector === "function" ? control.querySelector("input,select") : null;
  if (focusable && typeof focusable.focus === "function") focusable.focus();
}
function getVideoPlayByPlayRows() {
  const ctx = eventTableContexts.video;
  return ctx && Array.isArray(ctx.rows) ? ctx.rows : [];
}
function getPlayByPlayStartIndex(rows) {
  if (!rows.length) return -1;
  const preferredKey =
    lastSelectedEventId && selectedEventIds.has(lastSelectedEventId)
      ? lastSelectedEventId
      : selectedEventIds.values().next().value;
  if (preferredKey) {
    const idx = rows.findIndex(r => r.key === preferredKey);
    if (idx !== -1) return idx;
  }
  return 0;
}
function getPlayByPlayStartTime(row, baseMs) {
  if (!row) return null;
  if (typeof row.videoTime === "number" && isFinite(row.videoTime)) return row.videoTime;
  const ev = row.ev || {};
  if (typeof ev.videoTime === "number" && isFinite(ev.videoTime)) return ev.videoTime;
  return computeEventVideoTime(ev, baseMs);
}
function getPlayByPlayDurationSeconds(ev) {
  const baseMs = ev && typeof ev.durationMs === "number" && isFinite(ev.durationMs)
    ? ev.durationMs
    : getDefaultSkillDurationMs();
  const seconds = baseMs != null ? baseMs / 1000 : 5;
  return Math.max(0.1, seconds);
}
function stopPlayByPlay() {
  if (playByPlayTimer) {
    clearInterval(playByPlayTimer);
    playByPlayTimer = null;
  }
  playByPlayState.active = false;
  playByPlayState.index = -1;
  playByPlayState.key = null;
  playByPlayState.endTime = null;
  playByPlayState.endAtMs = null;
}
function ensurePlayByPlayMonitor() {
  if (playByPlayTimer) return;
  playByPlayTimer = setInterval(() => {
    if (!state.videoPlayByPlay) {
      stopPlayByPlay();
      return;
    }
    const activeTab = document && document.body ? document.body.dataset.activeTab : "";
    if (activeTab !== "video") {
      stopPlayByPlay();
      return;
    }
    const rows = getVideoPlayByPlayRows();
    if (!rows.length || !playByPlayState.active) {
      stopPlayByPlay();
      return;
    }
    if (playByPlayState.index < 0 || playByPlayState.index >= rows.length) {
      stopPlayByPlay();
      return;
    }
    if (!isFinite(playByPlayState.endTime)) return;
    const current = getActiveVideoPlaybackSeconds();
    if (typeof current !== "number") {
      if (playByPlayState.endAtMs && Date.now() < playByPlayState.endAtMs) return;
    } else if (current + 0.03 < playByPlayState.endTime) {
      return;
    }
    const nextIndex = playByPlayState.index + 1;
    if (nextIndex >= rows.length) {
      stopPlayByPlay();
      return;
    }
    startPlayByPlayAtIndex(nextIndex);
  }, 150);
}
function startPlayByPlayFromSelection() {
  const rows = getVideoPlayByPlayRows();
  if (!rows.length) {
    stopPlayByPlay();
    return;
  }
  const idx = getPlayByPlayStartIndex(rows);
  startPlayByPlayAtIndex(idx);
}
function startPlayByPlayAtIndex(idx) {
  const rows = getVideoPlayByPlayRows();
  if (!rows.length || idx < 0 || idx >= rows.length) {
    stopPlayByPlay();
    return;
  }
  const row = rows[idx];
  playByPlayState.active = true;
  playByPlayState.index = idx;
  playByPlayState.key = row.key;
  const baseMs = eventTableContexts.video ? eventTableContexts.video.baseMs : getVideoBaseTimeMs(getVideoSkillEvents());
  const start = getPlayByPlayStartTime(row, baseMs);
  if (!isFinite(start)) {
    stopPlayByPlay();
    return;
  }
  const duration = getPlayByPlayDurationSeconds(row.ev || {});
  playByPlayState.endTime = start + duration;
  playByPlayState.endAtMs = Date.now() + duration * 1000;
  setSelectionForContext("video", new Set([row.key]), row.key, { userAction: false });
  scrollRowIntoView(row);
  seekVideoToTime(start);
  if (state.video && state.video.youtubeId) {
    if (ytPlayer && typeof ytPlayer.playVideo === "function") {
      ytPlayer.playVideo();
    } else if (ytPlayerScout && typeof ytPlayerScout.playVideo === "function") {
      ytPlayerScout.playVideo();
    } else if (elYoutubeFrame && elYoutubeFrame.contentWindow) {
      try {
        elYoutubeFrame.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "playVideo", args: [] }),
          "*"
        );
      } catch (_) {
        // ignore
      }
    } else if (elYoutubeFrameScout && elYoutubeFrameScout.contentWindow) {
      try {
        elYoutubeFrameScout.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "playVideo", args: [] }),
          "*"
        );
      } catch (_) {
        // ignore
      }
    }
  }
  ensurePlayByPlayMonitor();
}
function syncPlayByPlayAfterRender() {
  if (!state.videoPlayByPlay) {
    stopPlayByPlay();
    return;
  }
  if (!playByPlayState.active) return;
  const rows = getVideoPlayByPlayRows();
  if (!rows.length) {
    stopPlayByPlay();
    return;
  }
  const idx = playByPlayState.key ? rows.findIndex(r => r.key === playByPlayState.key) : -1;
  if (idx === -1) {
    stopPlayByPlay();
    return;
  }
  playByPlayState.index = idx;
  playByPlayState.key = rows[idx].key;
}
function handleVideoSelectionChange(_rows, _ctx, opts) {
  if (!opts || !opts.userAction) return;
  const activeTab = document && document.body ? document.body.dataset.activeTab : "";
  if (state.videoPlayByPlay) {
    if (activeTab !== "video") return;
    startPlayByPlayFromSelection();
    return;
  }
  handleSeekForSelection("video", { preservePlayback: true, userAction: true });
}
function renderVideoAnalysis() {
  if (!elVideoSkillsContainer) return;
  const skillEvents = getVideoSkillEvents();
  const baseMs = getVideoBaseTimeMs(skillEvents);
  updateVideoSyncLabel();
  if (elVideoFileLabel) {
    const label =
      (state.video && state.video.youtubeId && state.video.youtubeUrl) ||
      (state.video && state.video.fileName) ||
      "Nessun file caricato";
    elVideoFileLabel.textContent = label;
  }
  if (!skillEvents.length) {
    if (state.videoPlayByPlay) stopPlayByPlay();
    try {
      renderVideoFilters([]);
    } catch (err) {
      console.error("Video filters error", err);
    }
    elVideoSkillsContainer.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.textContent = "Registra alcune skill per vederle qui.";
    tr.appendChild(td);
    const tbl = document.createElement("table");
    tbl.className = "video-skills-table event-edit-table";
    const tbody = document.createElement("tbody");
    tbody.appendChild(tr);
    tbl.appendChild(tbody);
    elVideoSkillsContainer.appendChild(tbl);
    return;
  }
  try {
    renderVideoFilters(skillEvents.map(item => item.ev));
  } catch (err) {
    console.error("Video filters error", err);
  }
  let updatedZones = false;
  skillEvents.forEach(({ ev }) => {
    const fallbackZone = getCurrentZoneForPlayer(resolvePlayerIdx(ev), null, getTeamScopeFromEvent(ev));
    if ((ev.zone === undefined || ev.zone === null || ev.zone === "") && fallbackZone) {
      ev.zone = fallbackZone;
      updatedZones = true;
    }
  });
  const filteredEvents = skillEvents
    .map(item => item.ev)
    .filter(ev => matchesVideoFilters(ev, videoFilterState));
  if (!filteredEvents.length) {
    if (state.videoPlayByPlay) stopPlayByPlay();
    elVideoSkillsContainer.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.textContent = "Nessuna skill con i filtri attivi.";
    tr.appendChild(td);
    const tbl = document.createElement("table");
    tbl.className = "video-skills-table event-edit-table";
    const tbody = document.createElement("tbody");
    tbody.appendChild(tr);
    tbl.appendChild(tbody);
    elVideoSkillsContainer.appendChild(tbl);
    return;
  }
  renderEventTableRows(
    elVideoSkillsContainer,
    filteredEvents,
    {
      showSeek: false,
      showVideoTime: true,
      baseMs,
      tableClass: "video-skills-table event-edit-table",
      enableSelection: true,
      contextKey: "video",
      onSelectionChange: handleVideoSelectionChange
    }
  );
  syncPlayByPlayAfterRender();
  if (updatedZones) {
    saveState();
  }
}
function seekVideoToTime(seconds, options = {}) {
  if (!isFinite(seconds)) return;
  const preservePlayback = !!options.preservePlayback;
  const target = Math.max(0, seconds);
  updateVideoPlaybackSnapshot(target, true);
  const activeTab = document && document.body ? document.body.dataset.activeTab : "";
  const preferScout = !!state.videoScoutMode && activeTab !== "video";
  const wasPlaying =
    state.video && state.video.youtubeId
      ? (preferScout ? isYoutubePlayerPlaying(ytPlayerScout, ytPlayerScoutReady) : false) ||
        isYoutubePlayerPlaying(ytPlayer, ytPlayerReady)
      : isVideoElementPlaying(preferScout ? elAnalysisVideoScout : elAnalysisVideo) ||
        isVideoElementPlaying(elAnalysisVideoScout) ||
        isVideoElementPlaying(elAnalysisVideo);
  const playbackCommand = preservePlayback ? (wasPlaying ? "play" : "none") : "play";
  if (state.video && state.video.youtubeId) {
    if (preferScout) {
      if (youtubeScoutFallback && elYoutubeFrameScout) {
        if (elYoutubeFrameScout.contentWindow) {
          try {
            elYoutubeFrameScout.contentWindow.postMessage(
              JSON.stringify({ event: "command", func: "seekTo", args: [target, true] }),
              "*"
            );
            if (playbackCommand !== "none") {
              elYoutubeFrameScout.contentWindow.postMessage(
                JSON.stringify({ event: "command", func: "playVideo", args: [] }),
                "*"
              );
            }
            return;
          } catch (_) {
            // ignore postMessage errors and fall back to src update
          }
        }
        elYoutubeFrameScout.src = buildYoutubeEmbedSrc(
          state.video.youtubeId,
          target,
          true,
          playbackCommand === "play"
        );
        return;
      }
      if (ytPlayerScout && typeof ytPlayerScout.seekTo === "function") {
        ytPlayerScout.seekTo(target, true);
        if (playbackCommand === "play" && typeof ytPlayerScout.playVideo === "function") {
          ytPlayerScout.playVideo();
        }
      } else if (elYoutubeFrameScout) {
        if (elYoutubeFrameScout.contentWindow) {
          try {
            elYoutubeFrameScout.contentWindow.postMessage(
              JSON.stringify({ event: "command", func: "seekTo", args: [target, true] }),
              "*"
            );
            if (playbackCommand !== "none") {
              elYoutubeFrameScout.contentWindow.postMessage(
                JSON.stringify({ event: "command", func: "playVideo", args: [] }),
                "*"
              );
            }
            return;
          } catch (_) {
            // ignore postMessage errors and fall back to src update
          }
        }
        elYoutubeFrameScout.src = buildYoutubeEmbedSrc(
          state.video.youtubeId,
          target,
          true,
          playbackCommand === "play"
        );
      }
      return;
    }
    if (youtubeFallback && elYoutubeFrame) {
      if (elYoutubeFrame.contentWindow) {
        try {
          elYoutubeFrame.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "seekTo", args: [target, true] }),
            "*"
          );
          if (playbackCommand !== "none") {
            elYoutubeFrame.contentWindow.postMessage(
              JSON.stringify({ event: "command", func: "playVideo", args: [] }),
              "*"
            );
          }
          return;
        } catch (_) {
          // ignore postMessage errors and fall back to src update
        }
      }
      elYoutubeFrame.src = buildYoutubeEmbedSrc(
        state.video.youtubeId,
        target,
        true,
        playbackCommand === "play"
      );
      return;
    }
    if (ytPlayer && typeof ytPlayer.seekTo === "function") {
      queueYoutubeSeek(target, playbackCommand === "play");
    } else if (elYoutubeFrame) {
      if (elYoutubeFrame.contentWindow) {
        try {
          elYoutubeFrame.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "seekTo", args: [target, true] }),
            "*"
          );
          if (playbackCommand !== "none") {
            elYoutubeFrame.contentWindow.postMessage(
              JSON.stringify({ event: "command", func: "playVideo", args: [] }),
              "*"
            );
          }
          return;
        } catch (_) {
          // ignore postMessage errors and fall back to src update
        }
      }
      elYoutubeFrame.src = buildYoutubeEmbedSrc(
        state.video.youtubeId,
        target,
        true,
        playbackCommand === "play"
      );
    }
    return;
  }
  if (preferScout && elAnalysisVideoScout) {
    try {
      const wasPaused = elAnalysisVideoScout.paused;
      elAnalysisVideoScout.currentTime = target;
      if (!preservePlayback || !wasPaused) {
        elAnalysisVideoScout.play().catch(() => {});
      }
    } catch (_) {
      // ignore errors when seeking
    }
    return;
  }
  if (!elAnalysisVideo) return;
  try {
    const wasPaused = elAnalysisVideo.paused;
    elAnalysisVideo.currentTime = target;
    if (!preservePlayback || !wasPaused) {
      elAnalysisVideo.play().catch(() => {});
    }
  } catch (_) {
    // ignore errors when seeking
  }
}
function handleVideoFileChange(file) {
  if (!file || (!elAnalysisVideo && !elAnalysisVideoScout)) return;
  clearYoutubeSource();
  try {
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
    }
  } catch (_) {
    // ignore revoke errors
  }
  const url = URL.createObjectURL(file);
  videoObjectUrl = url;
  if (elAnalysisVideo) {
    elAnalysisVideo.src = url;
  }
  if (elAnalysisVideoScout) {
    elAnalysisVideoScout.src = url;
  }
  persistLocalVideo(file);
  state.video = state.video || {
    offsetSeconds: 0,
    fileName: "",
    youtubeId: "",
    youtubeUrl: "",
    lastPlaybackSeconds: 0
  };
  state.video.fileName = file.name || "video";
  state.video.youtubeId = "";
  state.video.youtubeUrl = "";
  state.video.lastPlaybackSeconds = 0;
  saveState();
  renderYoutubePlayer(0);
  renderYoutubePlayerScout(0);
  renderVideoAnalysis();
}
function syncFirstSkillToVideo() {
  const skillEvents = getVideoSkillEvents();
  if (!skillEvents.length) {
    alert("Registra almeno una skill per poter sincronizzare.");
    return;
  }
  const selected = getSelectedRows("video");
  const selectedRow = selected.length ? selected[selected.length - 1] : null;
  if (!selectedRow) {
    alert("Seleziona una skill per sincronizzare.");
    return;
  }
  const baseMs = getVideoBaseTimeMs(skillEvents);
  const selectedTime = computeEventVideoTime(selectedRow.ev, baseMs);
  let currentVideoTime = getActiveVideoPlaybackSeconds();
  if (typeof currentVideoTime !== "number" || !isFinite(currentVideoTime)) {
    if (state.video && state.video.youtubeId) {
      alert("Apri e avvia il video YouTube per sincronizzare.");
      return;
    }
    currentVideoTime = 0;
  }
  const delta = currentVideoTime - selectedTime;
  const selectedKey = selectedRow.key;
  const selectedIdx = skillEvents.findIndex(({ ev }, idx) => getEventKey(ev, idx) === selectedKey);
  if (selectedIdx === -1) {
    alert("Skill selezionata non trovata.");
    return;
  }
  pushVideoUndoSnapshot();
  skillEvents.forEach(({ ev }, idx) => {
    if (!ev || idx < selectedIdx) return;
    const current = computeEventVideoTime(ev, baseMs);
    ev.videoTime = Math.max(0, current + delta);
  });
  saveState({ persistLocal: true });
  renderVideoAnalysis();
}
function ensureScoreOverrides() {
  const normalized = normalizeScoreOverrides(state.scoreOverrides || {});
  state.scoreOverrides = normalized;
  return state.scoreOverrides;
}
function getScoreOverrideForSet(setNum) {
  const overrides = ensureScoreOverrides();
  const entry = overrides[setNum] || { for: 0, against: 0 };
  const forVal = Number(entry.for);
  const againstVal = Number(entry.against);
  return {
    for: Number.isFinite(forVal) ? forVal : 0,
    against: Number.isFinite(againstVal) ? againstVal : 0
  };
}
function getScoreOverrideTotals(targetSet = null) {
  if (targetSet !== null && targetSet !== undefined) {
    const setNum = Math.min(5, Math.max(1, parseInt(targetSet, 10) || 1));
    return getScoreOverrideForSet(setNum);
  }
  const overrides = ensureScoreOverrides();
  return Object.keys(overrides || {}).reduce(
    (acc, key) => {
      const setNum = parseInt(key, 10);
      if (!setNum) return acc;
      const entry = getScoreOverrideForSet(setNum);
      acc.for += entry.for;
      acc.against += entry.against;
      return acc;
    },
    { for: 0, against: 0 }
  );
}
function getPointDirection(ev) {
  if (ev && ev.pendingBlockEval) return null;
  if (ev && (ev.derivedFromPassServe || ev.derivedFromBlock)) return null;
  if (ev.pointDirection === "for" || ev.pointDirection === "against") {
    return ev.pointDirection;
  }
  if (ev && ev.skillId === "serve" && ev.code === "=") {
    return "against";
  }
  if (ev && (ev.skillId === "defense" || ev.skillId === "pass") && ev.code === "/") {
    return null;
  }
  ensurePointRulesDefaults();
  const skill = ev.skillId;
  const code = ev.code;
  const cfg = normalizePointRule(skill, state.pointRules && state.pointRules[skill]);
  if (cfg.for.includes(code)) return "for";
  if (cfg.against.includes(code)) return "against";
  return null;
}
function getPointDirectionForScope(ev, scope) {
  const dir = getPointDirection(ev);
  if (!dir) return null;
  const eventScope = getTeamScopeFromEvent(ev);
  if (eventScope === scope) return dir;
  return dir === "for" ? "against" : "for";
}
function isOpponentErrorPoint(ev) {
  return !!(ev && ev.skillId === "manual" && ev.code === "opp-error");
}
function computePointsSummary(targetSet, options = {}) {
  const includeOverrides = options.includeOverrides !== false;
  const excludeOpponentErrors = !!options.excludeOpponentErrors;
  const teamScope = options.teamScope || "our";
  const target = targetSet ? parseInt(targetSet, 10) : null;
  const rotations = {};
  for (let r = 1; r <= 6; r++) {
    rotations[r] = { for: 0, against: 0 };
  }
  let totalFor = 0;
  let totalAgainst = 0;
  const filteredEvents = (state.events || []).filter(ev => {
    if (target === null) return true;
    return ev.set === target;
  });
  filteredEvents.forEach(ev => {
    if (excludeOpponentErrors && isOpponentErrorPoint(ev)) return;
    const direction = state.useOpponentTeam
      ? getPointDirectionForScope(ev, teamScope)
      : getPointDirection(ev);
    if (!direction) return;
    const value = typeof ev.value === "number" ? ev.value : 1;
    const rot = ev.rotation && ev.rotation >= 1 && ev.rotation <= 6 ? ev.rotation : 1;
    if (!rotations[rot]) {
      rotations[rot] = { for: 0, against: 0 };
    }
    if (direction === "for") {
      rotations[rot].for += value;
      totalFor += value;
    } else if (direction === "against") {
      rotations[rot].against += value;
      totalAgainst += value;
    }
  });
  const rotationList = Object.keys(rotations).map(key => {
    const rotNum = parseInt(key, 10);
    const obj = rotations[rotNum] || { for: 0, against: 0 };
    const forVal = Math.max(0, obj.for);
    const againstVal = Math.max(0, obj.against);
    return { rotation: rotNum, for: forVal, against: againstVal, delta: forVal - againstVal };
  });
  const overrideTotals = includeOverrides ? getScoreOverrideTotals(target) : { for: 0, against: 0 };
  const totalForClean = Math.max(0, totalFor + overrideTotals.for);
  const totalAgainstClean = Math.max(0, totalAgainst + overrideTotals.against);
  const hasRotationEvents = rotationList.some(r => r.for || r.against);
  const hasEvents = hasRotationEvents || overrideTotals.for !== 0 || overrideTotals.against !== 0;
  const maxDelta = rotationList.reduce((acc, r) => Math.max(acc, r.delta), -Infinity);
  const minDelta = rotationList.reduce((acc, r) => Math.min(acc, r.delta), Infinity);
  const best = hasRotationEvents ? rotationList.find(r => r.delta === maxDelta) : null;
  const worst = hasRotationEvents ? rotationList.find(r => r.delta === minDelta) : null;
  return {
    totalFor: totalForClean,
    totalAgainst: totalAgainstClean,
    rotations: rotationList,
    bestRotation: hasRotationEvents && best ? best.rotation : null,
    worstRotation: hasRotationEvents && worst ? worst.rotation : null,
    bestDelta: hasRotationEvents && best ? best.delta : null,
    worstDelta: hasRotationEvents && worst ? worst.delta : null,
    hasRotationEvents,
    overrideFor: overrideTotals.for,
    overrideAgainst: overrideTotals.against
  };
}
function computeSetScores(teamScope = "our") {
  const setMap = {};
  (state.events || []).forEach(ev => {
    const setNum = parseInt(ev.set, 10) || 1;
    const direction =
      state.useOpponentTeam ? getPointDirectionForScope(ev, teamScope) : getPointDirection(ev);
    if (!direction) return;
    const value = typeof ev.value === "number" ? ev.value : 1;
    if (!setMap[setNum]) {
      setMap[setNum] = { for: 0, against: 0 };
    }
    if (direction === "for") {
      setMap[setNum].for += value;
    } else if (direction === "against") {
      setMap[setNum].against += value;
    }
  });
  const overrideMap = ensureScoreOverrides();
  Object.keys(overrideMap || {}).forEach(key => {
    const setNum = parseInt(key, 10);
    if (!setNum) return;
    const entry = getScoreOverrideForSet(setNum);
    if (!setMap[setNum]) {
      setMap[setNum] = { for: 0, against: 0 };
    }
    setMap[setNum].for += entry.for;
    setMap[setNum].against += entry.against;
  });
  const sets = Object.keys(setMap)
    .map(k => parseInt(k, 10))
    .sort((a, b) => a - b)
    .map(setNum => {
      const entry = setMap[setNum];
      const forVal = Math.max(0, entry.for);
      const againstVal = Math.max(0, entry.against);
      return { set: setNum, for: forVal, against: againstVal, delta: forVal - againstVal };
    });
  const totalFor = sets.reduce((sum, s) => sum + s.for, 0);
  const totalAgainst = sets.reduce((sum, s) => sum + s.against, 0);
  return { sets, totalFor: Math.max(0, totalFor), totalAgainst: Math.max(0, totalAgainst) };
}
function computePlayerPointsMap(events = state.events || [], scope = "our") {
  const map = {};
  (events || []).forEach(ev => {
    if (typeof ev.playerIdx !== "number") return;
    const dir = state.useOpponentTeam ? getPointDirectionForScope(ev, scope) : getPointDirection(ev);
    if (!dir) return;
    const val = typeof ev.value === "number" ? ev.value : 1;
    if (!map[ev.playerIdx]) {
      map[ev.playerIdx] = { for: 0, against: 0 };
    }
    if (dir === "for") {
      map[ev.playerIdx].for += val;
    } else if (dir === "against") {
      map[ev.playerIdx].against += val;
    }
  });
  return map;
}
function computePlayerErrorsMap(events = state.events || []) {
  const map = {};
  (events || []).forEach(ev => {
    if (typeof ev.playerIdx !== "number") return;
    const val = typeof ev.value === "number" ? ev.value : 1;
    const isManualError = ev.skillId === "manual" && ev.code === "error";
    const isBlockError = ev.skillId === "block" && ev.code === "/";
    if (!isManualError && !isBlockError) return;
    map[ev.playerIdx] = (map[ev.playerIdx] || 0) + Math.max(0, val);
  });
  return map;
}
function computeStatsByPlayerForEvents(events, players) {
  const stats = {};
  (events || []).forEach(ev => {
    if (!ev || ev.skillId === "manual" || ev.actionType === "timeout" || ev.actionType === "substitution") {
      return;
    }
    if (typeof ev.playerIdx !== "number" || !players[ev.playerIdx]) return;
    if (!stats[ev.playerIdx]) {
      stats[ev.playerIdx] = {};
    }
    if (!stats[ev.playerIdx][ev.skillId]) {
      stats[ev.playerIdx][ev.skillId] = { "#": 0, "+": 0, "!": 0, "-": 0, "=": 0, "/": 0 };
    }
    stats[ev.playerIdx][ev.skillId][ev.code] =
      (stats[ev.playerIdx][ev.skillId][ev.code] || 0) + 1;
  });
  return stats;
}
function ensureAnalysisStatsCache() {
  const scope = getAnalysisTeamScope();
  if (analysisStatsCache && analysisStatsScope === scope) return analysisStatsCache;
  const players = getPlayersForScope(scope);
  const events = filterEventsByAnalysisTeam(state.events || []);
  analysisStatsCache = computeStatsByPlayerForEvents(events, players);
  analysisStatsScope = scope;
  return analysisStatsCache;
}
function formatDelta(value) {
  if (value === null || value === undefined || isNaN(value)) return "0";
  if (value > 0) return "+" + value;
  return String(value);
}
function renderLiveScore() {
  const summary = computePointsSummary(state.currentSet || 1);
  const totalLabel = summary.totalFor + " - " + summary.totalAgainst;
  if (elLiveScore) {
    elLiveScore.textContent = totalLabel;
    elLiveScore.classList.add("emph");
  }
  if (elLiveScoreModal) {
    elLiveScoreModal.textContent = totalLabel;
  }
  updateSetScoreDisplays();
  updateMatchStatusUI();
}
function handleAutoRotationFromEvent(eventObj, scope = "our") {
  if (!state || !state.autoRotate) {
    state.autoRotatePending = false;
    return;
  }
  const eventScope = scope || getTeamScopeFromEvent(eventObj);
  if (typeof ensurePointRulesDefaults === "function") {
    ensurePointRulesDefaults();
  }
  if (eventScope === "opponent") {
    const opponentServing = !state.isServing;
    const wasReceiving = !opponentServing || !!state.opponentAutoRotatePending;
    const ourWasReceiving = !state.isServing || !!state.autoRotatePending;
    eventObj.autoRotatePrev = wasReceiving;
    if (eventObj.skillId === "pass") {
      state.opponentAutoRotatePending = true;
      state.isServing = true;
      eventObj.autoRotateNext = true;
      saveState();
      return;
    }
    let pending = wasReceiving;
    let serving = opponentServing;
    const direction = getPointDirection(eventObj);
    if (direction === "for") {
      if (pending && typeof rotateOpponentCourt === "function") {
        rotateOpponentCourt("ccw");
        eventObj.autoRotationDirection = "ccw";
      }
      pending = false;
      serving = true;
    } else if (direction === "against") {
      pending = true;
      serving = false;
      if (ourWasReceiving && typeof rotateCourt === "function") {
        rotateCourt("ccw");
        eventObj.autoRotationDirection = "ccw";
      }
      state.autoRotatePending = false;
    } else {
      pending = pending || !serving;
    }
    state.opponentAutoRotatePending = pending;
    state.isServing = !serving;
    eventObj.autoRotateNext = pending;
    if (typeof enforceAutoLiberoForScope === "function" && state.isServing) {
      enforceAutoLiberoForScope("opponent", { skipServerOnServe: true });
    }
    saveState();
    return;
  }
  const wasReceiving = !state.isServing || !!state.autoRotatePending;
  const opponentWasReceiving = !!state.isServing || !!state.opponentAutoRotatePending;
  eventObj.autoRotatePrev = wasReceiving;
  if (eventObj.skillId === "pass") {
    state.autoRotatePending = true;
    state.isServing = false;
    eventObj.autoRotateNext = true;
    saveState();
    return;
  }
  let pending = wasReceiving;
  let serving = !!state.isServing;
  const direction = getPointDirection(eventObj);
  if (direction === "for") {
    if (pending && typeof rotateCourt === "function") {
      rotateCourt("ccw");
      eventObj.autoRotationDirection = "ccw";
    }
    pending = false;
    serving = true;
  } else if (direction === "against") {
    pending = true;
    serving = false;
    if (opponentWasReceiving && typeof rotateOpponentCourt === "function") {
      rotateOpponentCourt("ccw");
      eventObj.autoRotationDirection = "ccw";
    }
    state.opponentAutoRotatePending = false;
  } else {
    pending = pending || !serving;
  }
  state.autoRotatePending = pending;
  state.isServing = serving;
  eventObj.autoRotateNext = pending;
  if (typeof enforceAutoLiberoForScope === "function") {
    if (!state.isServing) {
      enforceAutoLiberoForScope("our", { skipServerOnServe: true });
    }
    if (state.isServing) {
      enforceAutoLiberoForScope("opponent", { skipServerOnServe: true });
    }
  }
  saveState();
  if (state.autoRolePositioning && typeof applyAutoRolePositioning === "function") {
    applyAutoRolePositioning();
  }
}
function recomputeServeFlagsFromHistory() {
  let servingScope = state.isServing ? "our" : "opponent";
  if (!state || !state.autoRotate) {
    state.isServing = servingScope === "our";
    state.autoRotatePending = false;
    return;
  }
  (state.events || []).forEach(ev => {
    if (!ev) return;
    const scope = getTeamScopeFromEvent(ev);
    if (ev.skillId === "serve") {
      servingScope = scope;
      return;
    }
    const dir = getPointDirection(ev);
    if (dir === "for") {
      servingScope = scope;
    } else if (dir === "against") {
      servingScope = getOppositeScope(scope);
    }
  });
  state.isServing = servingScope === "our";
  state.autoRotatePending = !state.isServing;
  state.opponentAutoRotatePending = state.isServing;
  if (state.useOpponentTeam && state.predictiveSkillFlow) {
    const lastFlowEvent = getLastFlowEvent(state.events || []);
    if (lastFlowEvent) {
      const next = computeTwoTeamFlowFromEvent(lastFlowEvent);
      state.flowTeamScope = next.teamScope || servingScope;
    } else {
      state.flowTeamScope = servingScope;
    }
  } else {
    state.flowTeamScope = servingScope;
  }
  if (typeof enforceAutoLiberoForState === "function") {
    enforceAutoLiberoForState({ skipServerOnServe: true });
  }
}
function addManualPoint(
  direction,
  value,
  codeLabel,
  playerIdx = null,
  playerName = "Squadra",
  errorType = null,
  scope = "our"
) {
  if (state.matchFinished) {
    alert("Partita in pausa. Riprendi per continuare lo scout.");
    return;
  }
  state.freeballPending = false;
  const event = buildBaseEventPayload({
    playerIdx,
    playerName: playerName,
    skillId: "manual",
    code: codeLabel || direction,
    pointDirection: direction,
    value: value,
    errorType: errorType || null,
    teamScope: scope
  });
  clearReceiveContext(scope);
  state.events.push(event);
  handleAutoRotationFromEvent(event, scope);
  if (state.useOpponentTeam) {
    const nextFlow = computeTwoTeamFlowFromEvent(event);
    state.flowTeamScope = nextFlow.teamScope;
  }
  saveState({ persistLocal: true });
  renderEventsLog();
  recalcAllStatsAndUpdateUI();
  renderPlayers();
  if (!state.predictiveSkillFlow) {
    renderLiveScore();
    renderScoreAndRotations(computePointsSummary());
    renderAggregatedTable();
    renderVideoAnalysis();
  }
}
function handleManualScore(direction, delta) {
  const setNum = state.currentSet || 1;
  ensureScoreOverrides();
  const baseSummary = computePointsSummary(setNum, { includeOverrides: false });
  const currentOverride = getScoreOverrideForSet(setNum);
  const key = direction === "against" ? "against" : "for";
  const next = Object.assign({}, currentOverride);
  next[key] = (next[key] || 0) + delta;
  if (key === "for") {
    next.for = Math.max(next.for, -(baseSummary.totalFor || 0));
  } else {
    next.against = Math.max(next.against, -(baseSummary.totalAgainst || 0));
  }
  state.scoreOverrides[setNum] = next;
  saveState({ persistLocal: true });
  renderLiveScore();
  renderScoreAndRotations(computePointsSummary());
  renderAggregatedTable();
  renderVideoAnalysis();
}
function handleTeamPoint(scope = "our") {
  const teamLabel = getTeamNameForScope(scope);
  addManualPoint("for", 1, "for", null, teamLabel, null, scope);
}
function handleOpponentErrorPoint() {
  state.skillFlowOverride = null;
  addManualPoint("for", 1, "opp-error", null, getTeamNameForScope("opponent"), null, "opponent");
  updateNextSkillIndicator(getPredictedSkillIdForScope("opponent"));
}
function addPlayerError(playerIdx, playerName, errorType = null, scope = "our") {
  if (state.matchFinished) {
    alert("Partita in pausa. Riprendi per continuare lo scout.");
    return;
  }
  addManualPoint("against", 1, "error", playerIdx, playerName || "Giocatrice", errorType, scope);
}
function addPlayerPoint(playerIdx, playerName, scope = "our") {
  if (state.matchFinished) {
    alert("Partita in pausa. Riprendi per continuare lo scout.");
    return;
  }
  addManualPoint("for", 1, "for", playerIdx, playerName || "Giocatrice", null, scope);
}
function handleTeamError(errorType = null, scope = "our") {
  const teamLabel = getTeamNameForScope(scope);
  addManualPoint("against", 1, "team-error", null, teamLabel, errorType, scope);
}
function handleOpponentPoint() {
  state.skillFlowOverride = null;
  addManualPoint("against", 1, "opp-point", null, getTeamNameForScope("opponent"), null, "opponent");
  updateNextSkillIndicator(getPredictedSkillIdForScope("opponent"));
}
function snapshotSkillClock() {
  ensureSkillClock();
  return {
    paused: !!state.skillClock.paused,
    pausedAtMs: state.skillClock.pausedAtMs || null,
    pausedAccumMs: state.skillClock.pausedAccumMs || 0,
    lastEffectiveMs: state.skillClock.lastEffectiveMs || null
  };
}
function restoreSkillClock(snapshot) {
  ensureSkillClock();
  if (!snapshot) return;
  state.skillClock.paused = !!snapshot.paused;
  state.skillClock.pausedAtMs = snapshot.pausedAtMs || null;
  state.skillClock.pausedAccumMs = snapshot.pausedAccumMs || 0;
  state.skillClock.lastEffectiveMs = snapshot.lastEffectiveMs || null;
}
function snapshotVideoClock() {
  ensureVideoClock();
  return {
    paused: !!state.videoClock.paused,
    pausedAtMs: state.videoClock.pausedAtMs || null,
    pausedAccumMs: state.videoClock.pausedAccumMs || 0,
    startMs: state.videoClock.startMs || Date.now(),
    currentSeconds: state.videoClock.currentSeconds || 0
  };
}
function restoreVideoClock(snapshot) {
  ensureVideoClock();
  if (!snapshot) return;
  state.videoClock.paused = !!snapshot.paused;
  state.videoClock.pausedAtMs = snapshot.pausedAtMs || null;
  state.videoClock.pausedAccumMs = snapshot.pausedAccumMs || 0;
  state.videoClock.startMs = snapshot.startMs || Date.now();
  state.videoClock.currentSeconds = snapshot.currentSeconds || 0;
}
function updateMatchStatusUI() {
  const finished = !!state.matchFinished;
  const label = finished ? "Riprendi partita" : "Pausa/Termina";
  const mainBtns = [elBtnEndMatch, elBtnEndMatchModal].filter(Boolean);
  mainBtns.forEach(btn => {
    btn.textContent = label;
    btn.classList.toggle("danger", !finished);
    btn.classList.toggle("resume-btn", finished);
    btn.classList.toggle("primary", finished);
  });
  if (!nextSetModalOpen) {
    setScoutControlsDisabled(finished);
  }
  document.body.dataset.matchFinished = finished ? "true" : "false";
}
function setScoutControlsDisabled(disabled) {
  const allowIds = new Set(["btn-end-match", "btn-end-match-modal"]);
  const scope = document.querySelector('[data-tab="scout"]');
  if (!scope) return;
  scope.querySelectorAll("button").forEach(btn => {
    if (!btn || allowIds.has(btn.id)) return;
    if (btn.closest("#next-set-inline")) return;
    btn.disabled = !!disabled;
  });
}
function recordSetAction(actionType, payload) {
  ensureSetStartSnapshot(state.currentSet || 1);
  const code = payload && payload.code ? payload.code : actionType;
  const event = buildBaseEventPayload(
    Object.assign({}, payload, {
      skillId: "manual",
      code,
      actionType
    })
  );
  clearReceiveContext();
  state.events.push(event);
}
function applySetChange(nextSet, options = {}) {
  const {
    prevSet = state.currentSet || 1,
    prevFinished = !!state.matchFinished,
    nextFinished = false,
    actionType = "set-change",
    prevClock = snapshotSkillClock(),
    prevVideoClock = snapshotVideoClock(),
    prevSetResults = null,
    nextSetResults = null,
    prevSetStarts = null,
    nextSetStarts = null
  } = options;
  if (actionType === "match-end") {
    pauseSkillClock();
    pauseVideoClock();
    state.matchFinished = true;
    setCurrentSet(nextSet);
    saveState({ persistLocal: true });
    renderEventsLog();
    renderLiveScore();
    updateMatchStatusUI();
    return;
  }
  if (nextFinished) {
    pauseSkillClock();
    pauseVideoClock();
  }
  if (!nextFinished && prevFinished) {
    resumeSkillClock();
    resumeVideoClock();
  }
  state.matchFinished = nextFinished;
  setCurrentSet(nextSet);
  if (nextSetResults) {
    state.setResults = nextSetResults;
  }
  if (nextSetStarts) {
    state.setStarts = nextSetStarts;
  }
  recordSetAction(actionType, {
    prevSet,
    nextSet,
    prevMatchFinished: prevFinished,
    nextMatchFinished: nextFinished,
    prevClock,
    nextClock: snapshotSkillClock(),
    prevVideoClock,
    nextVideoClock: snapshotVideoClock(),
    prevSetResults,
    nextSetResults,
    prevSetStarts,
    nextSetStarts
  });
  saveState({ persistLocal: true });
  renderEventsLog();
  renderLiveScore();
  updateMatchStatusUI();
}
function goToNextSet() {
  const current = state.currentSet || 1;
  const next = Math.min(5, current + 1);
  if (current === next && !state.matchFinished) return;
  applySetChange(next, {
    prevSet: current,
    nextSet: next,
    prevFinished: !!state.matchFinished,
    nextFinished: false,
    actionType: "set-change"
  });
}
function endMatch() {
  if (state.matchFinished) {
    resumeSkillClock();
    resumeVideoClock();
    state.matchFinished = false;
    if (state.matchEndSetSnapshot) {
      state.setResults = state.matchEndSetSnapshot;
      state.matchEndSetSnapshot = null;
    }
    state.matchEndSetRecorded = null;
    saveState();
    updateSetScoreDisplays();
    updateMatchStatusUI();
    return;
  }
  const current = state.currentSet || 1;
  const winner = computeSetWinner(current);
  if (winner) {
    state.matchEndSetSnapshot = cloneSetMap(state.setResults);
    state.matchEndSetRecorded = { set: current, winner };
    state.setResults = cloneSetMap(state.setResults);
    state.setResults[current] = winner;
  } else {
    state.matchEndSetSnapshot = cloneSetMap(state.setResults);
    state.matchEndSetRecorded = { set: current, winner: null };
  }
  applySetChange(current, {
    prevSet: current,
    nextSet: current,
    prevFinished: !!state.matchFinished,
    nextFinished: true,
    actionType: "match-end"
  });
}
function renderScoreAndRotations(summary, teamScope = "our") {
  const scoreSummary = summary || computePointsSummary(null, { teamScope });
  const effectiveSummary = scoreSummary;
  const totalLabel = scoreSummary.totalFor + " - " + scoreSummary.totalAgainst;
  if (elAggScore) {
    elAggScore.textContent = totalLabel;
  }
  updateSetScoreDisplays();
  if (elAggSetCards) {
    elAggSetCards.innerHTML = "";
    const setsData = computeSetScores(teamScope);
    if (!setsData.sets || setsData.sets.length === 0) {
      const span = document.createElement("div");
      span.className = "score-set-chip";
      span.textContent = "Nessun set";
      elAggSetCards.appendChild(span);
    } else {
      setsData.sets.forEach(s => {
        const chip = document.createElement("div");
        chip.className = "score-set-chip";
        chip.textContent = "S" + s.set + ": " + s.for + "-" + s.against;
        elAggSetCards.appendChild(chip);
      });
    }
  }
  const rotationSummary = scoreSummary;
  const rotationWrapper = document.querySelector(".rotation-wrapper");
  if (aggTableView.mode !== "summary") {
    if (rotationWrapper) rotationWrapper.classList.add("hidden");
    if (elRotationTableBody) {
      elRotationTableBody.innerHTML = "";
    }
    return;
  }
  if (rotationWrapper) rotationWrapper.classList.remove("hidden");
  const hasRotationEvents =
    rotationSummary.hasRotationEvents !== undefined
      ? rotationSummary.hasRotationEvents
      : rotationSummary.rotations.some(r => r.for || r.against);
  if (!elRotationTableBody) return;
  elRotationTableBody.innerHTML = "";
  const rotationLabel = rot => "P" + String(rot || 1);
  if (!hasRotationEvents) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "Registra eventi per vedere le rotazioni.";
    tr.appendChild(td);
    elRotationTableBody.appendChild(tr);
    return;
  }
  const allowHighlights = aggTableView.mode === "summary";
  const highlightEnabled =
    allowHighlights &&
    rotationSummary.bestRotation !== null &&
    rotationSummary.worstRotation !== null;
  rotationSummary.rotations.forEach(rot => {
    const tr = document.createElement("tr");
    tr.className = "rotation-row";
    if (highlightEnabled && rot.rotation === rotationSummary.bestRotation) {
      tr.classList.add("best");
    }
    if (
      highlightEnabled &&
      rot.rotation === rotationSummary.worstRotation &&
      rotationSummary.worstRotation !== rotationSummary.bestRotation
    ) {
      tr.classList.add("worst");
    }
    const cells = [
      rotationLabel(rot.rotation),
      rot.for,
      rot.against,
      formatDelta(rot.delta)
    ];
    cells.forEach(text => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    elRotationTableBody.appendChild(tr);
  });
}
const DEFAULT_SET_TYPE_OPTIONS = [
  { value: "mezza", label: "Mezza" },
  { value: "super", label: "Super" },
  { value: "quick", label: "Quick" },
  { value: "veloce", label: "Veloce" },
  { value: "fast", label: "Fast" },
  { value: "alta", label: "Alta" }
];
const SET_TYPE_SHORTCUTS = {
  mezza: "M",
  super: "S",
  quick: "Q",
  veloce: "V",
  fast: "F",
  alta: "A",
  damp: "D"
};
const DEFAULT_BASE_OPTIONS = [
  { value: "K1", label: "K1" },
  { value: "K2", label: "K2" },
  { value: "KC", label: "KC" },
  { value: "KB", label: "KB" },
  { value: "K7", label: "K7" },
  { value: "KF", label: "KF" }
];
const DEFAULT_PHASE_OPTIONS = [
  { value: "so", label: "Side-out (SO)" },
  { value: "bp", label: "Break point (BP)" }
];
const PREVIOUS_SKILL_OPTIONS = [
  { value: "any", label: "Tutte" },
  { value: "freeball-positive", label: "Freeball o ricezione positiva" },
  { value: "defense-negative", label: "Difesa + ricezione negativa" },
  { value: "freeball-only", label: "Solo freeball" },
  { value: "dig-only", label: "Solo difesa" }
];
function normalizeSetTypeValue(val) {
  if (!val) return null;
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") {
    if (val.set_type) return String(val.set_type).trim();
    if (val.setType) return String(val.setType).trim();
    if (val.type) return String(val.type).trim();
  }
  return String(val).trim();
}
function formatSetTypeLabelWithShortcut(value, label) {
  const key = normalizeSetTypeValue(value);
  const shortcut = key ? SET_TYPE_SHORTCUTS[key.toLowerCase()] : null;
  const base = label || (key ? key.charAt(0).toUpperCase() + key.slice(1) : "");
  return shortcut ? `${base} (${shortcut})` : base;
}
function renderSetTypeShortcuts() {
  const current = normalizeSetTypeValue(state.nextSetType) || "—";
  if (elSetTypeCurrent) {
    elSetTypeCurrent.textContent = current;
  }
  if (!elSetTypeShortcuts) return;
  elSetTypeShortcuts.querySelectorAll("[data-settype]").forEach(btn => {
    const value = btn.dataset.settype || "";
    const option = DEFAULT_SET_TYPE_OPTIONS.find(opt => opt.value === value);
    const label = option ? option.label : btn.textContent || value;
    btn.textContent = formatSetTypeLabelWithShortcut(value, label);
  });
  elSetTypeShortcuts.querySelectorAll("[data-clear-settype]").forEach(btn => {
    btn.textContent = "Nessuna (N)";
  });
  elSetTypeShortcuts.querySelectorAll("[data-settype]").forEach(btn => {
    const active = normalizeSetTypeValue(btn.dataset.settype) === normalizeSetTypeValue(state.nextSetType);
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}
function setNextSetType(val) {
  const normalized = normalizeSetTypeValue(val) || "";
  if (!normalized) {
    queuedSetTypeChoice = null;
  }
  state.nextSetType = normalized;
  saveState();
  renderSetTypeShortcuts();
  // Aggiorna subito le card/skill aperte per mostrare il nuovo tipo alzata
  renderPlayers();
}
function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (!tag) return false;
  const editable = el.isContentEditable;
  if (editable) return true;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return false;
}
function getActiveVideoElement() {
  if (activeTab === "video") return elAnalysisVideo || null;
  if (activeTab === "scout" && state.videoScoutMode) return elAnalysisVideoScout || null;
  return null;
}
function getActiveYoutubeController() {
  if (!state.video || !state.video.youtubeId) return null;
  const activeTab = document && document.body ? document.body.dataset.activeTab : "";
  const preferScout = !!state.videoScoutMode && activeTab !== "video";
  if (preferScout && ytPlayerScout && ytPlayerScoutReady) {
    return { player: ytPlayerScout, ready: ytPlayerScoutReady };
  }
  if (ytPlayer && ytPlayerReady) {
    return { player: ytPlayer, ready: ytPlayerReady };
  }
  return null;
}
function toggleYoutubePlayback() {
  const ctrl = getActiveYoutubeController();
  if (!ctrl || !ctrl.player) return false;
  const playing = isYoutubePlayerPlaying(ctrl.player, ctrl.ready);
  if (playing && typeof ctrl.player.pauseVideo === "function") {
    ctrl.player.pauseVideo();
    return true;
  }
  if (!playing && typeof ctrl.player.playVideo === "function") {
    ctrl.player.playVideo();
    return true;
  }
  return false;
}
function handleVideoShortcut(e) {
  if (e.defaultPrevented) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isTypingTarget(e.target)) return;
  if (elSkillModal && !elSkillModal.classList.contains("hidden")) return;
  const video = getActiveVideoElement();
  const ytCtrl = getActiveYoutubeController();
  if (!video && !ytCtrl) return;
  const duration = video && Number.isFinite(video.duration) ? video.duration : null;
  const clampTime = next => {
    if (duration == null) return Math.max(0, next);
    return Math.max(0, Math.min(duration, next));
  };
  const seekBy = delta => {
    if (ytCtrl && ytCtrl.player && typeof ytCtrl.player.getCurrentTime === "function") {
      const wasPlaying = isYoutubePlayerPlaying(ytCtrl.player, ytCtrl.ready);
      const current = ytCtrl.player.getCurrentTime();
      if (!isFinite(current)) return;
      ytCtrl.player.seekTo(Math.max(0, current + delta), true);
      if (wasPlaying && typeof ytCtrl.player.playVideo === "function") {
        ytCtrl.player.playVideo();
      }
      return;
    }
    if (!video) return;
    const wasPaused = video.paused;
    video.currentTime = clampTime(video.currentTime + delta);
    if (!wasPaused) {
      video.play().catch(() => {});
    }
  };
  if (e.code === "Space") {
    e.preventDefault();
    if (ytCtrl && toggleYoutubePlayback()) return;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    return;
  }
  if (e.shiftKey && e.key === "ArrowRight") {
    e.preventDefault();
    seekBy(1 / 30);
    return;
  }
  if (e.shiftKey && e.key === "ArrowLeft") {
    e.preventDefault();
    seekBy(-1 / 30);
    return;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    seekBy(3);
    return;
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    seekBy(-3);
    return;
  }
}
function syncMatchInfoInputs(match) {
  if (!match) return;
  const opponent = document.getElementById("match-opponent");
  const category = document.getElementById("match-category");
  const date = document.getElementById("match-date");
  const matchType = document.getElementById("match-type");
  const leg = document.getElementById("match-leg");
  if (opponent) opponent.value = match.opponent || "";
  if (category) category.value = match.category || "";
  if (date) date.value = match.date || "";
  if (matchType) matchType.value = match.matchType || "amichevole";
  if (leg) leg.value = match.leg || "";
}
function getMatchInfoFromInputs() {
  const opponent = document.getElementById("match-opponent");
  const category = document.getElementById("match-category");
  const date = document.getElementById("match-date");
  const matchType = document.getElementById("match-type");
  const leg = document.getElementById("match-leg");
  return {
    opponent: (opponent && opponent.value ? opponent.value.trim() : "") || "",
    category: (category && category.value ? category.value.trim() : "") || "",
    date: (date && date.value) || "",
    matchType: (matchType && matchType.value) || "amichevole",
    leg: (leg && leg.value) || ""
  };
}
function handleSetTypeHotkeys(e) {
  if (e.defaultPrevented) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isTypingTarget(e.target)) return;
  if (e.key === "Escape") {
    setNextSetType("");
    e.preventDefault();
    return;
  }
  const keyMap = {
    m: "mezza",
    M: "mezza",
    s: "super",
    S: "super",
    q: "quick",
    Q: "quick",
    v: "veloce",
    V: "veloce",
    f: "fast",
    F: "fast",
    d: "Damp",
    D: "Damp",
    a: "alta",
    A: "alta"
  };
  const choice = keyMap[e.key];
  if (!choice) return;
  e.preventDefault();
  queuedSetTypeChoice = choice;
  setNextSetType(choice);
}
function initSetTypeShortcuts() {
  renderSetTypeShortcuts();
  updateSetTypeVisibility(getPredictedSkillId());
  if (!elSetTypeShortcuts) return;
  elSetTypeShortcuts.addEventListener("click", e => {
    const btn = e.target.closest("[data-settype],[data-clear-settype]");
    if (!btn) return;
    if (btn.hasAttribute("data-clear-settype")) {
      setNextSetType("");
      return;
    }
    queuedSetTypeChoice = btn.dataset.settype || "";
    setNextSetType(btn.dataset.settype || "");
  });
  document.addEventListener("keydown", handleSetTypeHotkeys);
}
function normalizeBaseValue(val) {
  if (!val) return null;
  return String(val).trim().toUpperCase();
}
function normalizePhaseValue(val) {
  if (val === true || val === "true" || val === 1 || val === "1") return "bp";
  if (val === false || val === "false" || val === 0 || val === "0") return "so";
  if (typeof val === "string") {
    const upper = val.toUpperCase();
    if (upper.includes("BP") || upper.includes("BREAK")) return "bp";
    if (upper.includes("SO") || upper.includes("SIDE")) return "so";
  }
  return null;
}
function getEventPhaseValue(ev) {
  if (!ev) return null;
  let phaseVal = ev.attackBp;
  if (phaseVal === undefined || phaseVal === null) {
    phaseVal = ev.phase;
  }
  if (phaseVal === undefined || phaseVal === null) {
    phaseVal = ev.attackPhase;
  }
  return normalizePhaseValue(phaseVal);
}
function normalizeEvalCode(val) {
  if (!val) return null;
  const str = String(val).trim();
  return RESULT_CODES.includes(str) ? str : null;
}
function normalizeReceiveZone(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  return num;
}
function normalizeSetNumber(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  return num;
}
function findEventById(id) {
  if (!state.events || !Array.isArray(state.events)) return null;
  return state.events.find(e => e && e.eventId === id) || null;
}
function findPreviousEvent(ev) {
  if (!ev) return null;
  if (Array.isArray(ev.relatedEvents)) {
    for (let i = 0; i < ev.relatedEvents.length; i++) {
      const related = findEventById(ev.relatedEvents[i]);
      if (related) return related;
    }
  }
  const idx = state.events ? state.events.indexOf(ev) : -1;
  if (idx > 0) return state.events[idx - 1];
  return null;
}
function findRelatedSetEvent(ev) {
  if (!ev || !Array.isArray(ev.relatedEvents)) return null;
  for (let i = 0; i < ev.relatedEvents.length; i++) {
    const related = findEventById(ev.relatedEvents[i]);
    if (related && related.skillId === "second") return related;
  }
  return null;
}
function getSetterFromEvent(ev) {
  if (!ev) return null;
  if (typeof ev.playerIdx === "number" && ev.skillId === "second") return ev.playerIdx;
  if (typeof ev.setterIdx === "number") return ev.setterIdx;
  if (typeof ev.setterId === "number") return ev.setterId;
  const relatedSet = findRelatedSetEvent(ev);
  if (relatedSet && typeof relatedSet.playerIdx === "number") return relatedSet.playerIdx;
  return null;
}
function mergeFilterOptions(defaultOptions, extraValues, normalizeFn, labelBuilder) {
  const opts = [];
  const seen = new Set();
  defaultOptions.forEach(opt => {
    const norm = normalizeFn ? normalizeFn(opt.value) : opt.value;
    if (norm === null || norm === undefined || seen.has(norm)) return;
    seen.add(norm);
    opts.push({ value: norm, label: opt.label || String(opt.value) });
  });
  extraValues.forEach(val => {
    const norm = normalizeFn ? normalizeFn(val) : val;
    if (norm === null || norm === undefined || seen.has(norm)) return;
    seen.add(norm);
    opts.push({ value: norm, label: (labelBuilder && labelBuilder(val, norm)) || String(norm) });
  });
  return opts;
}
function buildFilterOptions(container, options, selectedSet, { asNumber = false, onChange } = {}) {
  if (!container) return;
  container.innerHTML = "";
  options.forEach(opt => {
    const val = asNumber ? Number(opt.value) : opt.value;
    const id = `${container.id}-${opt.value}`;
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = opt.value;
    input.id = id;
    input.checked = selectedSet.has(val);
    input.addEventListener("change", onChange || handleTrajectoryFilterChange);
    label.appendChild(input);
    const span = document.createElement("span");
    span.textContent = opt.label;
    label.appendChild(span);
    container.appendChild(label);
  });
}
function buildUniqueOptions(values, { asNumber = false, labelFn } = {}) {
  const seen = new Set();
  const opts = [];
  (values || []).forEach(raw => {
    if (raw === null || raw === undefined || raw === "") return;
    const val = asNumber ? Number(raw) : String(raw);
    if (asNumber && Number.isNaN(val)) return;
    if (seen.has(val)) return;
    seen.add(val);
    opts.push({
      value: val,
      label: labelFn ? labelFn(val) : String(val)
    });
  });
  return opts;
}
function toggleFilterVisibility(container, shouldShow) {
  if (!container) return;
  const wrapper = container.closest(".analysis-filter");
  if (!wrapper) return;
  wrapper.style.display = shouldShow ? "" : "none";
}
function renderDynamicFilter(container, options, selectedSet, config = {}) {
  const shouldShow = Array.isArray(options) && options.length > 0;
  if (!shouldShow) {
    if (selectedSet && typeof selectedSet.clear === "function") selectedSet.clear();
    if (container) container.innerHTML = "";
  }
  toggleFilterVisibility(container, shouldShow);
  if (shouldShow) {
    buildFilterOptions(container, options, selectedSet, config);
  }
  return shouldShow;
}
function getOptionLabel(options, value) {
  const match = (options || []).find(opt => String(opt.value) === String(value));
  if (match && match.label) return match.label;
  return String(value);
}
function getCheckedValues(container, { asNumber = false } = {}) {
  if (!container) return [];
  return Array.from(container.querySelectorAll("input[type=checkbox]:checked")).map(inp =>
    asNumber ? Number(inp.value) : inp.value
  );
}
function getCheckedRadioValue(container) {
  if (!container) return null;
  const input = container.querySelector("input[type=radio]:checked");
  return input ? input.value : null;
}
function renderAnalysisCourtSideRadios(container, selectedValue, onChange, groupName) {
  if (!container) return;
  const name = groupName || container.id || "analysis-court-side";
  const options = [
    { value: "near", label: "Vicino" },
    { value: "far", label: "Lontano" }
  ];
  container.innerHTML = "";
  options.forEach((opt, idx) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = opt.value;
    input.checked = opt.value === selectedValue;
    input.addEventListener("change", () => {
      if (typeof onChange === "function") onChange();
    });
    const span = document.createElement("span");
    span.textContent = opt.label;
    label.appendChild(input);
    label.appendChild(span);
    container.appendChild(label);
  });
}
function makeScopedIndexKey(scope, idx) {
  return `${scope}:${idx}`;
}
function matchScopedIndexFilter(selectedSet, scope, idx) {
  if (!selectedSet || selectedSet.size === 0) return true;
  const key = makeScopedIndexKey(scope, idx);
  if (selectedSet.has(key)) return true;
  if (selectedSet.has(idx)) return true;
  if (selectedSet.has(String(idx))) return true;
  return false;
}
function getTeamFilterOptions() {
  const options = [
    { value: "our", label: getTeamNameForScope("our") }
  ];
  if (state.useOpponentTeam) {
    options.push({ value: "opponent", label: getTeamNameForScope("opponent") });
  }
  return options;
}
function ensureAnalysisTeamFilterDefault() {
  if (!state.useOpponentTeam && analysisTeamFilterState.teams.size === 0) {
    analysisTeamFilterState.teams.add("our");
  }
}
function handleAnalysisTeamFilterChange(e) {
  if (!elAnalysisFilterTeams) return;
  if (e && e.target instanceof HTMLInputElement && e.target.checked) {
    elAnalysisFilterTeams.querySelectorAll("input[type=checkbox]").forEach(inp => {
      if (inp !== e.target) inp.checked = false;
    });
  }
  const values = getCheckedValues(elAnalysisFilterTeams);
  analysisTeamFilterState.teams = new Set(values);
  renderAggregatedTable();
  renderTrajectoryAnalysis();
  renderServeTrajectoryAnalysis();
  renderSecondTable();
  renderPlayerAnalysis();
}
function handleAnalysisSummarySetFilterChange() {
  if (!elAnalysisFilterSets) return;
  analysisSummaryFilterState.sets = new Set(getCheckedValues(elAnalysisFilterSets, { asNumber: true }));
  renderAggregatedTable();
}
function handleVideoTeamFilterChange(e) {
  if (!elVideoFilterTeams) return;
  const values = getCheckedValues(elVideoFilterTeams);
  videoFilterState.teams = new Set(values);
  renderVideoAnalysis();
}
function renderAnalysisTeamFilter() {
  if (!elAnalysisFilterTeams) return;
  ensureAnalysisTeamFilterDefault();
  const options = getTeamFilterOptions();
  analysisTeamFilterState.teams = new Set(
    [...analysisTeamFilterState.teams].filter(val => options.some(opt => opt.value === val))
  );
  const visible = renderDynamicFilter(elAnalysisFilterTeams, options, analysisTeamFilterState.teams, {
    onChange: handleAnalysisTeamFilterChange
  });
  toggleFilterVisibility(elAnalysisFilterTeams, visible);
}
function renderAnalysisSummarySetFilter() {
  if (!elAnalysisFilterSets) return;
  const events = filterEventsByAnalysisTeam(state.events || []);
  const setOpts = buildUniqueOptions(events.map(ev => normalizeSetNumber(ev.set)), {
    asNumber: true,
    labelFn: val => "Set " + val
  });
  analysisSummaryFilterState.sets = new Set(
    [...analysisSummaryFilterState.sets].filter(val => setOpts.some(opt => Number(opt.value) === val))
  );
  const visible = renderDynamicFilter(elAnalysisFilterSets, setOpts, analysisSummaryFilterState.sets, {
    onChange: handleAnalysisSummarySetFilterChange
  });
  toggleFilterVisibility(elAnalysisFilterSets, visible);
}
function matchesTeamFilter(ev, selectedSet) {
  if (!selectedSet || selectedSet.size === 0) return true;
  const scope = getTeamScopeFromEvent(ev);
  return selectedSet.has(scope);
}
function getAnalysisTeamScope() {
  ensureAnalysisTeamFilterDefault();
  if (analysisTeamFilterState.teams.size === 1) {
    return Array.from(analysisTeamFilterState.teams)[0];
  }
  return "our";
}
function filterEventsByAnalysisTeam(events) {
  return (events || []).filter(ev => matchesTeamFilter(ev, analysisTeamFilterState.teams));
}
function matchesSummarySetFilter(ev) {
  if (!analysisSummaryFilterState.sets || analysisSummaryFilterState.sets.size === 0) return true;
  const setNum = normalizeSetNumber(ev && ev.set);
  if (setNum === null) return false;
  return analysisSummaryFilterState.sets.has(setNum);
}
function getPointDirectionFor(scope, ev) {
  if (!ev) return null;
  if (state.useOpponentTeam) {
    return getPointDirectionForScope(ev, scope);
  }
  return getPointDirection(ev);
}
function computeRotationDeltasForEvents(events, scope) {
  const rotations = Array.from({ length: 6 }, () => ({ for: 0, against: 0 }));
  (events || []).forEach(ev => {
    const direction = getPointDirectionFor(scope, ev);
    if (!direction) return;
    const rot = ev.rotation && ev.rotation >= 1 && ev.rotation <= 6 ? ev.rotation : 1;
    const val = typeof ev.value === "number" ? ev.value : 1;
    const entry = rotations[rot - 1];
    if (direction === "for") {
      entry.for += val;
    } else if (direction === "against") {
      entry.against += val;
    }
  });
  return rotations.map(entry => entry.for - entry.against);
}
function computeAttackSplitSummary(events) {
  const summary = {
    err: 0,
    mur: 0,
    pt: 0,
    tot: 0
  };
  (events || []).forEach(ev => {
    if (!ev || ev.skillId !== "attack") return;
    summary.tot += 1;
    if (ev.code === "=") summary.err += 1;
    if (ev.code === "/") summary.mur += 1;
    if (ev.code === "#") summary.pt += 1;
  });
  return summary;
}
function formatPercentValueSafe(num, den) {
  if (!den) return "0%";
  return formatPercentValue(num, den);
}
function getSummarySetNumbers() {
  const played = getPlayedSetNumbers();
  if (!analysisSummaryFilterState.sets || analysisSummaryFilterState.sets.size === 0) return played;
  return played.filter(num => analysisSummaryFilterState.sets.has(num));
}
function filterNormalEvalOptions(options) {
  return (options || []).filter(opt => NORMAL_EVAL_CODES.has(opt.value));
}
function matchesPreviousSkill(ev, filterVal) {
  if (!filterVal || filterVal === "any") return true;
  const normalizedVal = filterVal === "dig-negative" ? "defense-negative" : filterVal;
  const prev = findPreviousEvent(ev);
  const explicitFreeball = !!(ev && ev.fromFreeball);
  const prevFreeball =
    explicitFreeball ||
    (prev && (prev.fromFreeball || prev.actionType === "freeball" || prev.skillId === "freeball"));
  const prevIsReceive = prev && prev.skillId === "pass";
  const prevIsDefense = prev && prev.skillId === "defense";
  const prevReceiveCode = prevIsReceive ? prev.code || prev.receiveEvaluation : null;
  const isPositiveReceive = prevIsReceive && (prevReceiveCode === "#" || prevReceiveCode === "+");
  const isNegativeReceive = prevIsReceive && (prevReceiveCode === "!" || prevReceiveCode === "-");
  // Se non abbiamo receive/freeball esplicita, assumiamo difesa di default
  const fallbackDefense = !prevIsReceive && !prevFreeball;
  switch (normalizedVal) {
    case "freeball-positive":
      return prevFreeball || isPositiveReceive;
    case "defense-negative":
      return isNegativeReceive || prevIsDefense || fallbackDefense;
    case "freeball-only":
      return prevFreeball;
    case "dig-only":
      return prevIsDefense || fallbackDefense;
    default:
      return true;
  }
}
function matchesAdvancedFilters(ev, filters, { includeSetter = false } = {}) {
  if (!ev || !filters) return true;
  if (includeSetter && filters.setters && filters.setters.size) {
    const setterIdx = getSetterFromEvent(ev);
    if (setterIdx === null || !filters.setters.has(setterIdx)) return false;
  }
  if (filters.setTypes && filters.setTypes.size) {
    const setType = normalizeSetTypeValue(
      ev.setType || (ev.combination && ev.combination.set_type) || (ev.combination && ev.combination.setType)
    );
    if (!setType || !filters.setTypes.has(setType)) return false;
  }
  if (filters.bases && filters.bases.size) {
    const base = normalizeBaseValue(ev.base);
    if (!base || !filters.bases.has(base)) return false;
  }
  if (filters.phases && filters.phases.size) {
    let rawPhase = ev.attackBp;
    if (rawPhase === undefined || rawPhase === null) {
      rawPhase = ev.phase !== undefined ? ev.phase : ev.attackPhase !== undefined ? ev.attackPhase : true; // default BP
    }
    const phase = normalizePhaseValue(rawPhase);
    if (phase === null || !filters.phases.has(phase)) return false;
  }
  if (filters.receiveEvaluations && filters.receiveEvaluations.size) {
    const recvEval = normalizeEvalCode(ev.receiveEvaluation);
    if (!recvEval || !filters.receiveEvaluations.has(recvEval)) return false;
  }
  if (filters.receiveZones && filters.receiveZones.size) {
    const recvZone = normalizeReceiveZone(ev.receivePosition || ev.receiveZone);
    if (recvZone === null || !filters.receiveZones.has(recvZone)) return false;
  }
  if (filters.sets && filters.sets.size) {
    const setNum = normalizeSetNumber(ev.set);
    if (setNum === null || !filters.sets.has(setNum)) return false;
  }
  if (filters.prevSkill && !matchesPreviousSkill(ev, filters.prevSkill)) return false;
  return true;
}
function matchesVideoFilters(ev, filters) {
  if (!ev || !filters) return true;
  if (filters.teams && filters.teams.size) {
    if (!matchesTeamFilter(ev, filters.teams)) return false;
  }
  if (filters.players && filters.players.size) {
    const idx = resolvePlayerIdx(ev);
    const scope = getTeamScopeFromEvent(ev);
    if (idx === -1 || !matchScopedIndexFilter(filters.players, scope, idx)) return false;
  }
  if (filters.setters && filters.setters.size) {
    const setterIdx = getSetterFromEvent(ev);
    const scope = getTeamScopeFromEvent(ev);
    if (setterIdx === null || !matchScopedIndexFilter(filters.setters, scope, setterIdx)) return false;
  }
  if (filters.skills && filters.skills.size) {
    if (!ev.skillId || !filters.skills.has(ev.skillId)) return false;
  }
  if (filters.codes && filters.codes.size) {
    if (!ev.code || !filters.codes.has(ev.code)) return false;
  }
  if (filters.sets && filters.sets.size) {
    const setNum = normalizeSetNumber(ev.set);
    if (setNum === null || !filters.sets.has(setNum)) return false;
  }
  if (filters.rotations && filters.rotations.size) {
    const rot = Number(ev.rotation);
    if (!Number.isFinite(rot) || !filters.rotations.has(rot)) return false;
  }
  if (filters.zones && filters.zones.size) {
    const zoneVal = Number(ev.zone || ev.playerPosition);
    if (!Number.isFinite(zoneVal) || !filters.zones.has(zoneVal)) return false;
  }
  if (filters.bases && filters.bases.size) {
    const base = normalizeBaseValue(ev.base);
    if (!base || !filters.bases.has(base)) return false;
  }
  if (filters.setTypes && filters.setTypes.size) {
    const setType = normalizeSetTypeValue(
      ev.setType || (ev.combination && ev.combination.set_type) || (ev.combination && ev.combination.setType)
    );
    if (!setType || !filters.setTypes.has(setType)) return false;
  }
  if (filters.phases && filters.phases.size) {
    let rawPhase = ev.attackBp;
    if (rawPhase === undefined || rawPhase === null) {
      rawPhase = ev.phase !== undefined ? ev.phase : ev.attackPhase !== undefined ? ev.attackPhase : true;
    }
    const phase = normalizePhaseValue(rawPhase);
    if (phase === null || !filters.phases.has(phase)) return false;
  }
  if (filters.receiveEvaluations && filters.receiveEvaluations.size) {
    const recvEval = normalizeEvalCode(ev.receiveEvaluation);
    if (!recvEval || !filters.receiveEvaluations.has(recvEval)) return false;
  }
  if (filters.receiveZones && filters.receiveZones.size) {
    const recvZone = normalizeReceiveZone(ev.receivePosition || ev.receiveZone);
    if (recvZone === null || !filters.receiveZones.has(recvZone)) return false;
  }
  if (filters.serveTypes && filters.serveTypes.size) {
    if (!ev.serveType || !filters.serveTypes.has(ev.serveType)) return false;
  }
  return true;
}
const trajectoryFilterState = {
  setters: new Set(),
  players: new Set(),
  sets: new Set(),
  codes: new Set(),
  zones: new Set(),
  setTypes: new Set(),
  bases: new Set(),
  phases: new Set(),
  receiveEvaluations: new Set(),
  receiveZones: new Set(),
  prevSkill: "any"
};
const analysisTeamFilterState = {
  teams: new Set()
};
const analysisSummaryFilterState = {
  sets: new Set()
};
const serveTrajectoryFilterState = {
  players: new Set(),
  sets: new Set(),
  codes: new Set(),
  zones: new Set(),
  setTypes: new Set(),
  bases: new Set(),
  phases: new Set(),
  receiveEvaluations: new Set(),
  receiveZones: new Set()
};
const playerTrajectoryFilterState = {
  sets: new Set(),
  codes: new Set(),
  zones: new Set(),
  setTypes: new Set(),
  bases: new Set(),
  phases: new Set(),
  receiveEvaluations: new Set(),
  receiveZones: new Set(),
  prevSkill: "any"
};
const playerServeTrajectoryFilterState = {
  sets: new Set(),
  codes: new Set(),
  zones: new Set(),
  setTypes: new Set(),
  bases: new Set(),
  phases: new Set(),
  receiveEvaluations: new Set(),
  receiveZones: new Set()
};
const secondFilterState = {
  setters: new Set(),
  players: new Set(),
  codes: new Set(),
  zones: new Set(),
  setTypes: new Set(),
  bases: new Set(),
  phases: new Set(),
  receiveEvaluations: new Set(),
  receiveZones: new Set(),
  sets: new Set(),
  prevSkill: "any"
};
const playerSecondFilterState = {
  setTypes: new Set(),
  bases: new Set(),
  phases: new Set(),
  receiveEvaluations: new Set(),
  receiveZones: new Set(),
  sets: new Set(),
  prevSkill: "any"
};
const videoFilterState = {
  teams: new Set(),
  players: new Set(),
  setters: new Set(),
  skills: new Set(),
  codes: new Set(),
  sets: new Set(),
  rotations: new Set(),
  zones: new Set(),
  bases: new Set(),
  setTypes: new Set(),
  phases: new Set(),
  receiveEvaluations: new Set(),
  receiveZones: new Set(),
  serveTypes: new Set()
};
const TRAJECTORY_BG_BY_ZONE = {
  1: "images/trajectory/attack_2_near.png",
  2: "images/trajectory/attack_2_near.png",
  3: "images/trajectory/attack_3_near.png",
  4: "images/trajectory/attack_4_near.png",
  5: "images/trajectory/attack_4_near.png",
  6: "images/trajectory/attack_3_near.png"
};
const TRAJECTORY_LINE_COLORS = {
  "#": "#16a34a", // verde: punto pieno
  "+": "#2563eb", // blu
  "!": "#2563eb", // blu
  "-": "#f97316", // arancione deciso
  "=": "#dc2626", // rosso
  "/": "#dc2626" // rosso
};
const TRAJECTORY_LINE_COLORS_SERVE = {
  ...TRAJECTORY_LINE_COLORS,
  "/": "#2563eb" // battuta: slash blu
};
const TRAJECTORY_LINE_WIDTH = 3;
const trajectoryBgCache = {};
let serveTrajectoryImgs = null;
function getAnalysisCourtSide(value) {
  return value === "far" ? "far" : "near";
}
function ensureCourtSideState(key) {
  const current = state[key];
  let next;
  if (current && typeof current === "object") {
    next = Object.assign({ our: "near", opponent: "far" }, current);
  } else if (typeof current === "string") {
    next = { our: getAnalysisCourtSide(current), opponent: "far" };
  } else {
    next = { our: "near", opponent: "far" };
  }
  state[key] = next;
  return next;
}
function clamp01Val(n) {
  if (n == null || isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
function syncTrajectoryFilterState() {
  trajectoryFilterState.setters = new Set(getCheckedValues(elTrajFilterSetters, { asNumber: true }));
  trajectoryFilterState.players = new Set(getCheckedValues(elTrajFilterPlayers, { asNumber: true }));
  trajectoryFilterState.sets = new Set(getCheckedValues(elTrajFilterSets, { asNumber: true }));
  trajectoryFilterState.codes = new Set(getCheckedValues(elTrajFilterCodes));
  trajectoryFilterState.zones = new Set(getCheckedValues(elTrajFilterZones, { asNumber: true }));
  trajectoryFilterState.setTypes = new Set(getCheckedValues(elTrajFilterSetTypes));
  trajectoryFilterState.bases = new Set(getCheckedValues(elTrajFilterBases));
  trajectoryFilterState.phases = new Set(getCheckedValues(elTrajFilterPhases));
  trajectoryFilterState.receiveEvaluations = new Set(getCheckedValues(elTrajFilterReceiveEvals));
  trajectoryFilterState.receiveZones = new Set(getCheckedValues(elTrajFilterReceiveZones, { asNumber: true }));
  trajectoryFilterState.prevSkill = (elTrajFilterPrev && elTrajFilterPrev.value) || "any";
}
function syncServeTrajectoryFilterState() {
  serveTrajectoryFilterState.players = new Set(getCheckedValues(elServeTrajFilterPlayers, { asNumber: true }));
  serveTrajectoryFilterState.sets = new Set(getCheckedValues(elServeTrajFilterSets, { asNumber: true }));
  serveTrajectoryFilterState.codes = new Set(getCheckedValues(elServeTrajFilterCodes));
  serveTrajectoryFilterState.zones = new Set(getCheckedValues(elServeTrajFilterZones, { asNumber: true }));
  serveTrajectoryFilterState.setTypes = new Set(getCheckedValues(elServeTrajFilterSetTypes));
  serveTrajectoryFilterState.bases = new Set(getCheckedValues(elServeTrajFilterBases));
  serveTrajectoryFilterState.phases = new Set(getCheckedValues(elServeTrajFilterPhases));
  serveTrajectoryFilterState.receiveEvaluations = new Set(getCheckedValues(elServeTrajFilterReceiveEvals));
  serveTrajectoryFilterState.receiveZones = new Set(getCheckedValues(elServeTrajFilterReceiveZones, { asNumber: true }));
}
function syncVideoFilterState() {
  const els = getVideoFilterElements();
  if (!els) return;
  videoFilterState.teams = new Set(getCheckedValues(els.teams));
  videoFilterState.players = new Set(getCheckedValues(els.players));
  videoFilterState.setters = new Set(getCheckedValues(els.setters));
  videoFilterState.skills = new Set(getCheckedValues(els.skills));
  videoFilterState.codes = new Set(getCheckedValues(els.codes));
  videoFilterState.sets = new Set(getCheckedValues(els.sets, { asNumber: true }));
  videoFilterState.rotations = new Set(getCheckedValues(els.rotations, { asNumber: true }));
  videoFilterState.zones = new Set(getCheckedValues(els.zones, { asNumber: true }));
  videoFilterState.bases = new Set(getCheckedValues(els.bases));
  videoFilterState.setTypes = new Set(getCheckedValues(els.setTypes));
  videoFilterState.phases = new Set(getCheckedValues(els.phases));
  videoFilterState.receiveEvaluations = new Set(getCheckedValues(els.receiveEvals));
  videoFilterState.receiveZones = new Set(getCheckedValues(els.receiveZones, { asNumber: true }));
  videoFilterState.serveTypes = new Set(getCheckedValues(els.serveTypes));
}
function handleTrajectoryFilterChange() {
  syncTrajectoryFilterState();
  renderTrajectoryAnalysis();
}
function handleServeTrajectoryFilterChange() {
  syncServeTrajectoryFilterState();
  renderServeTrajectoryAnalysis();
}
function handleVideoFilterChange() {
  syncVideoFilterState();
  renderVideoAnalysis();
}
function resetTrajectoryFilters() {
  trajectoryFilterState.setters.clear();
  trajectoryFilterState.players.clear();
  trajectoryFilterState.sets.clear();
  trajectoryFilterState.codes.clear();
  trajectoryFilterState.zones.clear();
  trajectoryFilterState.setTypes.clear();
  trajectoryFilterState.bases.clear();
  trajectoryFilterState.phases.clear();
  trajectoryFilterState.receiveEvaluations.clear();
  trajectoryFilterState.receiveZones.clear();
  trajectoryFilterState.prevSkill = "any";
  if (elTrajFilterPrev) elTrajFilterPrev.value = "any";
  renderTrajectoryFilters();
  renderTrajectoryAnalysis();
}
function resetServeTrajectoryFilters() {
  serveTrajectoryFilterState.players.clear();
  serveTrajectoryFilterState.sets.clear();
  serveTrajectoryFilterState.codes.clear();
  serveTrajectoryFilterState.zones.clear();
  serveTrajectoryFilterState.setTypes.clear();
  serveTrajectoryFilterState.bases.clear();
  serveTrajectoryFilterState.phases.clear();
  serveTrajectoryFilterState.receiveEvaluations.clear();
  serveTrajectoryFilterState.receiveZones.clear();
  renderServeTrajectoryFilters();
  renderServeTrajectoryAnalysis();
}
function resetVideoFilters() {
  videoFilterState.teams.clear();
  videoFilterState.players.clear();
  videoFilterState.setters.clear();
  videoFilterState.skills.clear();
  videoFilterState.codes.clear();
  videoFilterState.sets.clear();
  videoFilterState.rotations.clear();
  videoFilterState.zones.clear();
  videoFilterState.bases.clear();
  videoFilterState.setTypes.clear();
  videoFilterState.phases.clear();
  videoFilterState.receiveEvaluations.clear();
  videoFilterState.receiveZones.clear();
  videoFilterState.serveTypes.clear();
  renderVideoAnalysis();
}
function getVideoFilterElements() {
  const wrap = document.getElementById("video-filters");
  const players = document.getElementById("video-filter-players");
  if (!players) return null;
  return {
    wrap,
    teams: document.getElementById("video-filter-teams"),
    players,
    setters: document.getElementById("video-filter-setters"),
    skills: document.getElementById("video-filter-skills"),
    codes: document.getElementById("video-filter-codes"),
    sets: document.getElementById("video-filter-sets"),
    rotations: document.getElementById("video-filter-rotations"),
    zones: document.getElementById("video-filter-zones"),
    bases: document.getElementById("video-filter-bases"),
    setTypes: document.getElementById("video-filter-set-types"),
    phases: document.getElementById("video-filter-phases"),
    receiveEvals: document.getElementById("video-filter-receive-evals"),
    receiveZones: document.getElementById("video-filter-receive-zones"),
    serveTypes: document.getElementById("video-filter-serve-types"),
    reset: document.getElementById("video-filter-reset")
  };
}
function getSecondFilterElements() {
  const setters = document.getElementById("second-filter-setters");
  if (!setters) return null;
  return {
    setters,
    players: document.getElementById("second-filter-players"),
    codes: document.getElementById("second-filter-codes"),
    zones: document.getElementById("second-filter-zones"),
    setTypes: document.getElementById("second-filter-set-types"),
    bases: document.getElementById("second-filter-bases"),
    phases: document.getElementById("second-filter-phases"),
    receiveEvals: document.getElementById("second-filter-receive-evals"),
    receiveZones: document.getElementById("second-filter-receive-zones"),
    sets: document.getElementById("second-filter-sets"),
    prev: document.getElementById("second-filter-prev"),
    reset: document.getElementById("second-filter-reset")
  };
}
function renderTrajectoryFilters() {
  if (!elTrajectoryGrid) return;
  renderAnalysisTeamFilter();
  const analysisScope = getAnalysisTeamScope();
  const events = filterEventsByAnalysisTeam(state.events || []);
  const attackEvents = events.filter(ev => ev && ev.skillId === "attack");
  const trajEvents = attackEvents.filter(ev => {
    const dir = ev.attackDirection || ev.attackTrajectory;
    return dir && dir.start && dir.end;
  });
  const analysisPlayers = getPlayersForScope(analysisScope);
  const analysisNumbers = getPlayerNumbersForScope(analysisScope);
  const setterLabels = new Map();
  trajEvents.forEach(ev => {
    const setterIdx = getSetterFromEvent(ev);
    if (typeof setterIdx !== "number") return;
    const label =
      (analysisScope === "opponent"
        ? formatNameWithNumberFor(ev.setterName || analysisPlayers[setterIdx], analysisNumbers)
        : formatNameWithNumber(ev.setterName || analysisPlayers[setterIdx])) ||
      ev.setterName ||
      analysisPlayers[setterIdx] ||
      "Alzatrice " + (setterIdx + 1);
    setterLabels.set(setterIdx, label);
  });
  const setterOptsRaw = Array.from(setterLabels.entries()).map(([idx, label]) => ({
    value: idx,
    label
  }));
  const setterOpts = sortPlayerOptionsByNumberForScope(setterOptsRaw, analysisScope);
  const playersOptsRaw = buildUniqueOptions(trajEvents.map(ev => ev.playerIdx), {
    asNumber: true,
    labelFn: idx => {
      const name = analysisPlayers[idx];
      if (!name) return "—";
      return analysisScope === "opponent"
        ? formatNameWithNumberFor(name, analysisNumbers)
        : formatNameWithNumber(name);
    }
  });
  const playersOpts = sortPlayerOptionsByNumberForScope(playersOptsRaw, getAnalysisTeamScope());
  const setsOpts = buildUniqueOptions(trajEvents.map(ev => normalizeSetNumber(ev.set)), {
    asNumber: true,
    labelFn: val => "Set " + val
  });
  const codesOpts = filterNormalEvalOptions(
    buildUniqueOptions(trajEvents.map(ev => ev.code), { labelFn: val => val })
  );
  const zonesOpts = buildUniqueOptions(
    trajEvents.map(ev => {
      const traj = ev.attackDirection || ev.attackTrajectory || {};
      return ev.attackStartZone || traj.startZone || ev.zone || ev.playerPosition || null;
    }),
    { asNumber: true, labelFn: val => "Z" + val }
  );
  const setTypeOpts = buildUniqueOptions(
    trajEvents.map(ev =>
      normalizeSetTypeValue(ev.setType || (ev.combination && ev.combination.set_type) || (ev.combination && ev.combination.setType))
    ),
    { labelFn: val => getOptionLabel(DEFAULT_SET_TYPE_OPTIONS, val) }
  );
  const baseOpts = buildUniqueOptions(
    trajEvents.map(ev => normalizeBaseValue(ev.base)),
    { labelFn: val => getOptionLabel(DEFAULT_BASE_OPTIONS, val) }
  );
  const phaseOpts = buildUniqueOptions(trajEvents.map(ev => getEventPhaseValue(ev)), {
    labelFn: val => getOptionLabel(DEFAULT_PHASE_OPTIONS, val)
  });
  const recvEvalOpts = buildUniqueOptions(
    trajEvents.map(ev => normalizeEvalCode(ev.receiveEvaluation)),
    { labelFn: val => val }
  );
  const recvZoneOpts = buildUniqueOptions(
    trajEvents.map(ev => normalizeReceiveZone(ev.receivePosition || ev.receiveZone)),
    { asNumber: true, labelFn: val => "Z" + val }
  );

  trajectoryFilterState.players = new Set(
    [...trajectoryFilterState.players].filter(idx => playersOpts.some(p => Number(p.value) === idx))
  );
  trajectoryFilterState.setters = new Set(
    [...trajectoryFilterState.setters].filter(idx => setterOpts.some(p => Number(p.value) === idx))
  );
  trajectoryFilterState.sets = new Set(
    [...trajectoryFilterState.sets].filter(setNum => setsOpts.some(o => Number(o.value) === setNum))
  );
  trajectoryFilterState.codes = new Set(
    [...trajectoryFilterState.codes].filter(code => codesOpts.some(c => c.value === code))
  );
  trajectoryFilterState.zones = new Set(
    [...trajectoryFilterState.zones].filter(z => zonesOpts.some(o => Number(o.value) === z))
  );
  trajectoryFilterState.setTypes = new Set(
    [...trajectoryFilterState.setTypes].filter(val => setTypeOpts.some(o => o.value === val))
  );
  trajectoryFilterState.bases = new Set(
    [...trajectoryFilterState.bases].filter(val => baseOpts.some(o => o.value === val))
  );
  trajectoryFilterState.phases = new Set(
    [...trajectoryFilterState.phases].filter(val => phaseOpts.some(o => o.value === val))
  );
  trajectoryFilterState.receiveEvaluations = new Set(
    [...trajectoryFilterState.receiveEvaluations].filter(val => recvEvalOpts.some(o => o.value === val))
  );
  trajectoryFilterState.receiveZones = new Set(
    [...trajectoryFilterState.receiveZones].filter(val => recvZoneOpts.some(o => Number(o.value) === val))
  );
  if (!PREVIOUS_SKILL_OPTIONS.some(opt => opt.value === trajectoryFilterState.prevSkill)) {
    trajectoryFilterState.prevSkill = "any";
  }

  const visibleFilters = [];
  visibleFilters.push(
    renderDynamicFilter(elTrajFilterSetters, setterOpts, trajectoryFilterState.setters, {
      asNumber: true,
      onChange: handleTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elTrajFilterPlayers, playersOpts, trajectoryFilterState.players, {
      asNumber: true,
      onChange: handleTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elTrajFilterSets, setsOpts, trajectoryFilterState.sets, {
      asNumber: true,
      onChange: handleTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elTrajFilterSetTypes, setTypeOpts, trajectoryFilterState.setTypes, {
      onChange: handleTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elTrajFilterBases, baseOpts, trajectoryFilterState.bases, {
      onChange: handleTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elTrajFilterPhases, phaseOpts, trajectoryFilterState.phases, {
      onChange: handleTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elTrajFilterReceiveEvals, recvEvalOpts, trajectoryFilterState.receiveEvaluations, {
      onChange: handleTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elTrajFilterReceiveZones, recvZoneOpts, trajectoryFilterState.receiveZones, {
      asNumber: true,
      onChange: handleTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elTrajFilterCodes, codesOpts, trajectoryFilterState.codes, {
      onChange: handleTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elTrajFilterZones, zonesOpts, trajectoryFilterState.zones, {
      asNumber: true,
      onChange: handleTrajectoryFilterChange
    })
  );
  toggleFilterVisibility(elTrajFilterPrev, true);
  toggleFilterVisibility(elTrajFilterReset, visibleFilters.some(Boolean));
  if (elTrajFilterPrev) {
    elTrajFilterPrev.value = trajectoryFilterState.prevSkill || "any";
    if (!elTrajFilterPrev._trajPrevBound) {
      elTrajFilterPrev.addEventListener("change", handleTrajectoryFilterChange);
      elTrajFilterPrev._trajPrevBound = true;
    }
  }
  if (elTrajCourtSide) {
    const side = getAnalysisCourtSide(ensureCourtSideState("uiTrajectoryCourtSideByScope")[analysisScope]);
    renderAnalysisCourtSideRadios(elTrajCourtSide, side, () => {
      const scope = getAnalysisTeamScope();
      const nextState = ensureCourtSideState("uiTrajectoryCourtSideByScope");
      nextState[scope] = getAnalysisCourtSide(getCheckedRadioValue(elTrajCourtSide));
      saveState();
      renderTrajectoryAnalysis();
    }, "analysis-court-side");
  }
  if (elTrajFilterReset && !elTrajFilterReset._trajResetBound) {
    elTrajFilterReset.addEventListener("click", resetTrajectoryFilters);
    elTrajFilterReset._trajResetBound = true;
  }
}
function renderServeTrajectoryFilters() {
  if (!elServeTrajectoryGrid) return;
  renderAnalysisTeamFilter();
  const analysisScope = getAnalysisTeamScope();
  const events = filterEventsByAnalysisTeam(state.events || []);
  const serveEvents = events.filter(ev => ev && ev.skillId === "serve" && ev.serveStart && ev.serveEnd);
  const analysisPlayers = getPlayersForScope(analysisScope);
  const analysisNumbers = getPlayerNumbersForScope(analysisScope);
  const playersOptsRaw = buildUniqueOptions(serveEvents.map(ev => ev.playerIdx), {
    asNumber: true,
    labelFn: idx => {
      const name = analysisPlayers[idx];
      if (!name) return "—";
      return analysisScope === "opponent"
        ? formatNameWithNumberFor(name, analysisNumbers)
        : formatNameWithNumber(name);
    }
  });
  const playersOpts = sortPlayerOptionsByNumberForScope(playersOptsRaw, analysisScope);
  const setsOpts = buildUniqueOptions(serveEvents.map(ev => normalizeSetNumber(ev.set)), {
    asNumber: true,
    labelFn: val => "Set " + val
  });
  const codesOpts = filterNormalEvalOptions(
    buildUniqueOptions(serveEvents.map(ev => ev.code), { labelFn: val => val })
  );
  const zonesOpts = buildUniqueOptions(serveEvents.map(ev => getServeStartZone(ev)), {
    asNumber: true,
    labelFn: val => "Z" + val
  });
  const setTypeOpts = buildUniqueOptions(
    serveEvents.map(ev =>
      normalizeSetTypeValue(ev.setType || (ev.combination && ev.combination.set_type) || (ev.combination && ev.combination.setType))
    ),
    { labelFn: val => getOptionLabel(DEFAULT_SET_TYPE_OPTIONS, val) }
  );
  const baseOpts = buildUniqueOptions(
    serveEvents.map(ev => normalizeBaseValue(ev.base)),
    { labelFn: val => getOptionLabel(DEFAULT_BASE_OPTIONS, val) }
  );
  const phaseOpts = buildUniqueOptions(serveEvents.map(ev => getEventPhaseValue(ev)), {
    labelFn: val => getOptionLabel(DEFAULT_PHASE_OPTIONS, val)
  });
  const recvEvalOpts = buildUniqueOptions(
    serveEvents.map(ev => normalizeEvalCode(ev.receiveEvaluation)),
    { labelFn: val => val }
  );
  const recvZoneOpts = buildUniqueOptions(
    serveEvents.map(ev => normalizeReceiveZone(ev.receivePosition || ev.receiveZone)),
    { asNumber: true, labelFn: val => "Z" + val }
  );

  serveTrajectoryFilterState.players = new Set(
    [...serveTrajectoryFilterState.players].filter(idx => playersOpts.some(p => Number(p.value) === idx))
  );
  serveTrajectoryFilterState.sets = new Set(
    [...serveTrajectoryFilterState.sets].filter(setNum => setsOpts.some(o => Number(o.value) === setNum))
  );
  serveTrajectoryFilterState.codes = new Set(
    [...serveTrajectoryFilterState.codes].filter(code => codesOpts.some(c => c.value === code))
  );
  serveTrajectoryFilterState.zones = new Set(
    [...serveTrajectoryFilterState.zones].filter(z => zonesOpts.some(o => Number(o.value) === z))
  );
  serveTrajectoryFilterState.setTypes = new Set(
    [...serveTrajectoryFilterState.setTypes].filter(val => setTypeOpts.some(o => o.value === val))
  );
  serveTrajectoryFilterState.bases = new Set(
    [...serveTrajectoryFilterState.bases].filter(val => baseOpts.some(o => o.value === val))
  );
  serveTrajectoryFilterState.phases = new Set(
    [...serveTrajectoryFilterState.phases].filter(val => phaseOpts.some(o => o.value === val))
  );
  serveTrajectoryFilterState.receiveEvaluations = new Set(
    [...serveTrajectoryFilterState.receiveEvaluations].filter(val => recvEvalOpts.some(o => o.value === val))
  );
  serveTrajectoryFilterState.receiveZones = new Set(
    [...serveTrajectoryFilterState.receiveZones].filter(val => recvZoneOpts.some(o => Number(o.value) === val))
  );

  const visibleFilters = [];
  visibleFilters.push(
    renderDynamicFilter(elServeTrajFilterPlayers, playersOpts, serveTrajectoryFilterState.players, {
      asNumber: true,
      onChange: handleServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elServeTrajFilterSets, setsOpts, serveTrajectoryFilterState.sets, {
      asNumber: true,
      onChange: handleServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elServeTrajFilterSetTypes, setTypeOpts, serveTrajectoryFilterState.setTypes, {
      onChange: handleServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elServeTrajFilterBases, baseOpts, serveTrajectoryFilterState.bases, {
      onChange: handleServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elServeTrajFilterPhases, phaseOpts, serveTrajectoryFilterState.phases, {
      onChange: handleServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elServeTrajFilterReceiveEvals, recvEvalOpts, serveTrajectoryFilterState.receiveEvaluations, {
      onChange: handleServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elServeTrajFilterReceiveZones, recvZoneOpts, serveTrajectoryFilterState.receiveZones, {
      asNumber: true,
      onChange: handleServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elServeTrajFilterCodes, codesOpts, serveTrajectoryFilterState.codes, {
      onChange: handleServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elServeTrajFilterZones, zonesOpts, serveTrajectoryFilterState.zones, {
      asNumber: true,
      onChange: handleServeTrajectoryFilterChange
    })
  );
  toggleFilterVisibility(elServeTrajFilterReset, visibleFilters.some(Boolean));
  if (elServeTrajCourtSide) {
    const side = getAnalysisCourtSide(ensureCourtSideState("uiServeTrajectoryCourtSideByScope")[analysisScope]);
    renderAnalysisCourtSideRadios(elServeTrajCourtSide, side, () => {
      const scope = getAnalysisTeamScope();
      const nextState = ensureCourtSideState("uiServeTrajectoryCourtSideByScope");
      nextState[scope] = getAnalysisCourtSide(getCheckedRadioValue(elServeTrajCourtSide));
      saveState();
      renderServeTrajectoryAnalysis();
    }, "analysis-serve-court-side");
  }
  if (elServeTrajFilterReset && !elServeTrajFilterReset._serveTrajResetBound) {
    elServeTrajFilterReset.addEventListener("click", resetServeTrajectoryFilters);
    elServeTrajFilterReset._serveTrajResetBound = true;
  }
}
function syncPlayerTrajectoryFilterState() {
  playerTrajectoryFilterState.sets = new Set(getCheckedValues(elPlayerTrajFilterSets, { asNumber: true }));
  playerTrajectoryFilterState.codes = new Set(getCheckedValues(elPlayerTrajFilterCodes));
  playerTrajectoryFilterState.zones = new Set(getCheckedValues(elPlayerTrajFilterZones, { asNumber: true }));
  playerTrajectoryFilterState.setTypes = new Set(getCheckedValues(elPlayerTrajFilterSetTypes));
  playerTrajectoryFilterState.bases = new Set(getCheckedValues(elPlayerTrajFilterBases));
  playerTrajectoryFilterState.phases = new Set(getCheckedValues(elPlayerTrajFilterPhases));
  playerTrajectoryFilterState.receiveEvaluations = new Set(getCheckedValues(elPlayerTrajFilterReceiveEvals));
  playerTrajectoryFilterState.receiveZones = new Set(getCheckedValues(elPlayerTrajFilterReceiveZones, { asNumber: true }));
  playerTrajectoryFilterState.prevSkill = (elPlayerTrajFilterPrev && elPlayerTrajFilterPrev.value) || "any";
}
function handlePlayerTrajectoryFilterChange() {
  syncPlayerTrajectoryFilterState();
  renderPlayerTrajectoryAnalysis();
}
function resetPlayerTrajectoryFilters() {
  playerTrajectoryFilterState.sets.clear();
  playerTrajectoryFilterState.codes.clear();
  playerTrajectoryFilterState.zones.clear();
  playerTrajectoryFilterState.setTypes.clear();
  playerTrajectoryFilterState.bases.clear();
  playerTrajectoryFilterState.phases.clear();
  playerTrajectoryFilterState.receiveEvaluations.clear();
  playerTrajectoryFilterState.receiveZones.clear();
  playerTrajectoryFilterState.prevSkill = "any";
  if (elPlayerTrajFilterPrev) elPlayerTrajFilterPrev.value = "any";
  renderPlayerTrajectoryFilters();
  renderPlayerTrajectoryAnalysis();
}
function renderPlayerTrajectoryFilters() {
  if (!elPlayerTrajectoryGrid) return;
  const playerIdx = getPlayerAnalysisPlayerIdx();
  const events = (state.events || []).filter(ev => {
    if (!ev || ev.skillId !== "attack") return false;
    const dir = ev.attackDirection || ev.attackTrajectory;
    if (!dir || !dir.start || !dir.end) return false;
    if (playerIdx === null) return false;
    if (!matchesTeamFilter(ev, analysisTeamFilterState.teams)) return false;
    return ev.playerIdx === playerIdx;
  });
  const setsOpts = buildUniqueOptions(events.map(ev => normalizeSetNumber(ev.set)), {
    asNumber: true,
    labelFn: val => "Set " + val
  });
  const codesOpts = filterNormalEvalOptions(
    buildUniqueOptions(events.map(ev => ev.code), { labelFn: val => val })
  );
  const zonesOpts = buildUniqueOptions(
    events.map(ev => {
      const traj = ev.attackDirection || ev.attackTrajectory || {};
      return ev.attackStartZone || traj.startZone || ev.zone || ev.playerPosition || null;
    }),
    { asNumber: true, labelFn: val => "Z" + val }
  );
  const setTypeOpts = buildUniqueOptions(
    events.map(ev =>
      normalizeSetTypeValue(ev.setType || (ev.combination && ev.combination.set_type) || (ev.combination && ev.combination.setType))
    ),
    { labelFn: val => getOptionLabel(DEFAULT_SET_TYPE_OPTIONS, val) }
  );
  const baseOpts = buildUniqueOptions(
    events.map(ev => normalizeBaseValue(ev.base)),
    { labelFn: val => getOptionLabel(DEFAULT_BASE_OPTIONS, val) }
  );
  const phaseOpts = buildUniqueOptions(events.map(ev => getEventPhaseValue(ev)), {
    labelFn: val => getOptionLabel(DEFAULT_PHASE_OPTIONS, val)
  });
  const recvEvalOpts = buildUniqueOptions(
    events.map(ev => normalizeEvalCode(ev.receiveEvaluation)),
    { labelFn: val => val }
  );
  const recvZoneOpts = buildUniqueOptions(
    events.map(ev => normalizeReceiveZone(ev.receivePosition || ev.receiveZone)),
    { asNumber: true, labelFn: val => "Z" + val }
  );

  playerTrajectoryFilterState.sets = new Set(
    [...playerTrajectoryFilterState.sets].filter(setNum => setsOpts.some(o => Number(o.value) === setNum))
  );
  playerTrajectoryFilterState.codes = new Set(
    [...playerTrajectoryFilterState.codes].filter(code => codesOpts.some(c => c.value === code))
  );
  playerTrajectoryFilterState.zones = new Set(
    [...playerTrajectoryFilterState.zones].filter(z => zonesOpts.some(o => Number(o.value) === z))
  );
  playerTrajectoryFilterState.setTypes = new Set(
    [...playerTrajectoryFilterState.setTypes].filter(val => setTypeOpts.some(o => o.value === val))
  );
  playerTrajectoryFilterState.bases = new Set(
    [...playerTrajectoryFilterState.bases].filter(val => baseOpts.some(o => o.value === val))
  );
  playerTrajectoryFilterState.phases = new Set(
    [...playerTrajectoryFilterState.phases].filter(val => phaseOpts.some(o => o.value === val))
  );
  playerTrajectoryFilterState.receiveEvaluations = new Set(
    [...playerTrajectoryFilterState.receiveEvaluations].filter(val => recvEvalOpts.some(o => o.value === val))
  );
  playerTrajectoryFilterState.receiveZones = new Set(
    [...playerTrajectoryFilterState.receiveZones].filter(val => recvZoneOpts.some(o => Number(o.value) === val))
  );
  if (!PREVIOUS_SKILL_OPTIONS.some(opt => opt.value === playerTrajectoryFilterState.prevSkill)) {
    playerTrajectoryFilterState.prevSkill = "any";
  }

  const visibleFilters = [];
  visibleFilters.push(
    renderDynamicFilter(elPlayerTrajFilterSets, setsOpts, playerTrajectoryFilterState.sets, {
      asNumber: true,
      onChange: handlePlayerTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerTrajFilterSetTypes, setTypeOpts, playerTrajectoryFilterState.setTypes, {
      onChange: handlePlayerTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerTrajFilterBases, baseOpts, playerTrajectoryFilterState.bases, {
      onChange: handlePlayerTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerTrajFilterPhases, phaseOpts, playerTrajectoryFilterState.phases, {
      onChange: handlePlayerTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerTrajFilterReceiveEvals, recvEvalOpts, playerTrajectoryFilterState.receiveEvaluations, {
      onChange: handlePlayerTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerTrajFilterReceiveZones, recvZoneOpts, playerTrajectoryFilterState.receiveZones, {
      asNumber: true,
      onChange: handlePlayerTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerTrajFilterCodes, codesOpts, playerTrajectoryFilterState.codes, {
      onChange: handlePlayerTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerTrajFilterZones, zonesOpts, playerTrajectoryFilterState.zones, {
      asNumber: true,
      onChange: handlePlayerTrajectoryFilterChange
    })
  );
  toggleFilterVisibility(elPlayerTrajFilterPrev, true);
  toggleFilterVisibility(elPlayerTrajFilterReset, visibleFilters.some(Boolean));
  if (elPlayerTrajFilterPrev) {
    elPlayerTrajFilterPrev.value = playerTrajectoryFilterState.prevSkill || "any";
    if (!elPlayerTrajFilterPrev._playerTrajPrevBound) {
      elPlayerTrajFilterPrev.addEventListener("change", handlePlayerTrajectoryFilterChange);
      elPlayerTrajFilterPrev._playerTrajPrevBound = true;
    }
  }
  if (elPlayerTrajFilterReset && !elPlayerTrajFilterReset._playerTrajResetBound) {
    elPlayerTrajFilterReset.addEventListener("click", resetPlayerTrajectoryFilters);
    elPlayerTrajFilterReset._playerTrajResetBound = true;
  }
}
function getFilteredPlayerTrajectoryEvents() {
  const playerIdx = getPlayerAnalysisPlayerIdx();
  const events = (state.events || []).filter(ev => {
    if (!ev || ev.skillId !== "attack") return false;
    const dir = ev.attackDirection || ev.attackTrajectory;
    if (!dir || !dir.start || !dir.end) return false;
    if (playerIdx === null) return false;
    if (!matchesTeamFilter(ev, analysisTeamFilterState.teams)) return false;
    return ev.playerIdx === playerIdx;
  });
  return events.filter(ev => {
    const traj = ev.attackDirection || ev.attackTrajectory;
    const startZone = ev.attackStartZone || (traj && traj.startZone) || ev.zone || ev.playerPosition || null;
    if (!matchesAdvancedFilters(ev, playerTrajectoryFilterState)) return false;
    if (playerTrajectoryFilterState.sets.size && !playerTrajectoryFilterState.sets.has(ev.set)) return false;
    if (playerTrajectoryFilterState.codes.size && !playerTrajectoryFilterState.codes.has(ev.code)) return false;
    if (playerTrajectoryFilterState.zones.size && !playerTrajectoryFilterState.zones.has(startZone)) return false;
    return true;
  });
}
function renderPlayerTrajectoryAnalysis() {
  if (!elPlayerTrajectoryGrid) return;
  renderPlayerTrajectoryFilters();
  const canvases = elPlayerTrajectoryGrid.querySelectorAll("canvas[data-traj-canvas]");
  if (!canvases || canvases.length === 0) return;
  const prefs = ensurePlayerAnalysisState();
  const analysisScope = getAnalysisTeamScope();
  const isFarView = getAnalysisCourtSide(prefs.courtSideByScope[analysisScope]) === "far";
  elPlayerTrajectoryGrid.classList.toggle("is-far", isFarView);
  const events = getFilteredPlayerTrajectoryEvents();
  const grouped = {};
  events.forEach(ev => {
    const traj = ev.attackDirection || ev.attackTrajectory || {};
    const zone = ev.attackStartZone || traj.startZone || ev.zone || ev.playerPosition || null;
    if (!zone) return;
    if (!grouped[zone]) grouped[zone] = [];
    grouped[zone].push(ev);
  });
  canvases.forEach(canvas => {
    const zone = parseInt(canvas.dataset.trajCanvas, 10);
    const card = canvas.closest(".trajectory-card");
    const list = grouped[zone] || [];
    const img = getTrajectoryBg(zone, isFarView, () => renderPlayerTrajectoryAnalysis());
    const ratio = img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.65;
    const width = (canvas.parentElement && canvas.parentElement.clientWidth) || img.naturalWidth || 320;
    const height = Math.max(120, Math.round(width * ratio || width * 0.65));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, 0, 0, width, height);
    }
    if (!list.length) {
      if (card) card.classList.add("empty");
      return;
    }
    if (card) card.classList.remove("empty");
    list.forEach(ev => {
      const traj = ev.attackDirection || ev.attackTrajectory || {};
      const startRaw = traj.start || ev.attackStart;
      const endRaw = traj.end || ev.attackEnd;
      const start = isFarView && startRaw ? mirrorTrajectoryPoint(startRaw) : startRaw;
      const end = isFarView && endRaw ? mirrorTrajectoryPoint(endRaw) : endRaw;
      if (!start || !end) return;
      const sx = clamp01Val(start.x) * width;
      const sy = clamp01Val(start.y) * height;
      const ex = clamp01Val(end.x) * width;
      const ey = clamp01Val(end.y) * height;
      ctx.strokeStyle = getTrajectoryColorForCode(ev.code, "attack");
      ctx.lineWidth = TRAJECTORY_LINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    });
  });
}
function syncPlayerServeTrajectoryFilterState() {
  playerServeTrajectoryFilterState.sets = new Set(getCheckedValues(elPlayerServeTrajFilterSets, { asNumber: true }));
  playerServeTrajectoryFilterState.codes = new Set(getCheckedValues(elPlayerServeTrajFilterCodes));
  playerServeTrajectoryFilterState.zones = new Set(getCheckedValues(elPlayerServeTrajFilterZones, { asNumber: true }));
  playerServeTrajectoryFilterState.setTypes = new Set(getCheckedValues(elPlayerServeTrajFilterSetTypes));
  playerServeTrajectoryFilterState.bases = new Set(getCheckedValues(elPlayerServeTrajFilterBases));
  playerServeTrajectoryFilterState.phases = new Set(getCheckedValues(elPlayerServeTrajFilterPhases));
  playerServeTrajectoryFilterState.receiveEvaluations = new Set(getCheckedValues(elPlayerServeTrajFilterReceiveEvals));
  playerServeTrajectoryFilterState.receiveZones = new Set(getCheckedValues(elPlayerServeTrajFilterReceiveZones, { asNumber: true }));
}
function handlePlayerServeTrajectoryFilterChange() {
  syncPlayerServeTrajectoryFilterState();
  renderPlayerServeTrajectoryAnalysis();
}
function resetPlayerServeTrajectoryFilters() {
  playerServeTrajectoryFilterState.sets.clear();
  playerServeTrajectoryFilterState.codes.clear();
  playerServeTrajectoryFilterState.zones.clear();
  playerServeTrajectoryFilterState.setTypes.clear();
  playerServeTrajectoryFilterState.bases.clear();
  playerServeTrajectoryFilterState.phases.clear();
  playerServeTrajectoryFilterState.receiveEvaluations.clear();
  playerServeTrajectoryFilterState.receiveZones.clear();
  renderPlayerServeTrajectoryFilters();
  renderPlayerServeTrajectoryAnalysis();
}
function renderPlayerServeTrajectoryFilters() {
  if (!elPlayerServeTrajectoryGrid) return;
  const playerIdx = getPlayerAnalysisPlayerIdx();
  const events = (state.events || []).filter(ev => {
    if (!ev || ev.skillId !== "serve") return false;
    if (!ev.serveStart || !ev.serveEnd) return false;
    if (playerIdx === null) return false;
    if (!matchesTeamFilter(ev, analysisTeamFilterState.teams)) return false;
    return ev.playerIdx === playerIdx;
  });
  const setsOpts = buildUniqueOptions(events.map(ev => normalizeSetNumber(ev.set)), {
    asNumber: true,
    labelFn: val => "Set " + val
  });
  const codesOpts = filterNormalEvalOptions(
    buildUniqueOptions(events.map(ev => ev.code), { labelFn: val => val })
  );
  const zonesOpts = buildUniqueOptions(events.map(ev => getServeStartZone(ev)), {
    asNumber: true,
    labelFn: val => "Z" + val
  });
  const setTypeOpts = buildUniqueOptions(
    events.map(ev =>
      normalizeSetTypeValue(ev.setType || (ev.combination && ev.combination.set_type) || (ev.combination && ev.combination.setType))
    ),
    { labelFn: val => getOptionLabel(DEFAULT_SET_TYPE_OPTIONS, val) }
  );
  const baseOpts = buildUniqueOptions(
    events.map(ev => normalizeBaseValue(ev.base)),
    { labelFn: val => getOptionLabel(DEFAULT_BASE_OPTIONS, val) }
  );
  const phaseOpts = buildUniqueOptions(events.map(ev => getEventPhaseValue(ev)), {
    labelFn: val => getOptionLabel(DEFAULT_PHASE_OPTIONS, val)
  });
  const recvEvalOpts = buildUniqueOptions(
    events.map(ev => normalizeEvalCode(ev.receiveEvaluation)),
    { labelFn: val => val }
  );
  const recvZoneOpts = buildUniqueOptions(
    events.map(ev => normalizeReceiveZone(ev.receivePosition || ev.receiveZone)),
    { asNumber: true, labelFn: val => "Z" + val }
  );

  playerServeTrajectoryFilterState.sets = new Set(
    [...playerServeTrajectoryFilterState.sets].filter(setNum => setsOpts.some(o => Number(o.value) === setNum))
  );
  playerServeTrajectoryFilterState.codes = new Set(
    [...playerServeTrajectoryFilterState.codes].filter(code => codesOpts.some(c => c.value === code))
  );
  playerServeTrajectoryFilterState.zones = new Set(
    [...playerServeTrajectoryFilterState.zones].filter(z => zonesOpts.some(o => Number(o.value) === z))
  );
  playerServeTrajectoryFilterState.setTypes = new Set(
    [...playerServeTrajectoryFilterState.setTypes].filter(val => setTypeOpts.some(o => o.value === val))
  );
  playerServeTrajectoryFilterState.bases = new Set(
    [...playerServeTrajectoryFilterState.bases].filter(val => baseOpts.some(o => o.value === val))
  );
  playerServeTrajectoryFilterState.phases = new Set(
    [...playerServeTrajectoryFilterState.phases].filter(val => phaseOpts.some(o => o.value === val))
  );
  playerServeTrajectoryFilterState.receiveEvaluations = new Set(
    [...playerServeTrajectoryFilterState.receiveEvaluations].filter(val => recvEvalOpts.some(o => o.value === val))
  );
  playerServeTrajectoryFilterState.receiveZones = new Set(
    [...playerServeTrajectoryFilterState.receiveZones].filter(val => recvZoneOpts.some(o => Number(o.value) === val))
  );

  const visibleFilters = [];
  visibleFilters.push(
    renderDynamicFilter(elPlayerServeTrajFilterSets, setsOpts, playerServeTrajectoryFilterState.sets, {
      asNumber: true,
      onChange: handlePlayerServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerServeTrajFilterSetTypes, setTypeOpts, playerServeTrajectoryFilterState.setTypes, {
      onChange: handlePlayerServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerServeTrajFilterBases, baseOpts, playerServeTrajectoryFilterState.bases, {
      onChange: handlePlayerServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerServeTrajFilterPhases, phaseOpts, playerServeTrajectoryFilterState.phases, {
      onChange: handlePlayerServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(
      elPlayerServeTrajFilterReceiveEvals,
      recvEvalOpts,
      playerServeTrajectoryFilterState.receiveEvaluations,
      { onChange: handlePlayerServeTrajectoryFilterChange }
    )
  );
  visibleFilters.push(
    renderDynamicFilter(
      elPlayerServeTrajFilterReceiveZones,
      recvZoneOpts,
      playerServeTrajectoryFilterState.receiveZones,
      { asNumber: true, onChange: handlePlayerServeTrajectoryFilterChange }
    )
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerServeTrajFilterCodes, codesOpts, playerServeTrajectoryFilterState.codes, {
      onChange: handlePlayerServeTrajectoryFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerServeTrajFilterZones, zonesOpts, playerServeTrajectoryFilterState.zones, {
      asNumber: true,
      onChange: handlePlayerServeTrajectoryFilterChange
    })
  );
  toggleFilterVisibility(elPlayerServeTrajFilterReset, visibleFilters.some(Boolean));
  if (elPlayerServeTrajFilterReset && !elPlayerServeTrajFilterReset._playerServeResetBound) {
    elPlayerServeTrajFilterReset.addEventListener("click", resetPlayerServeTrajectoryFilters);
    elPlayerServeTrajFilterReset._playerServeResetBound = true;
  }
}
function getFilteredPlayerServeTrajectoryEvents() {
  const playerIdx = getPlayerAnalysisPlayerIdx();
  const events = (state.events || []).filter(ev => {
    if (!ev || ev.skillId !== "serve") return false;
    if (!ev.serveStart || !ev.serveEnd) return false;
    if (playerIdx === null) return false;
    if (!matchesTeamFilter(ev, analysisTeamFilterState.teams)) return false;
    return ev.playerIdx === playerIdx;
  });
  return events.filter(ev => {
    const startZone = getServeStartZone(ev);
    if (!matchesAdvancedFilters(ev, playerServeTrajectoryFilterState)) return false;
    if (playerServeTrajectoryFilterState.sets.size && !playerServeTrajectoryFilterState.sets.has(ev.set)) return false;
    if (playerServeTrajectoryFilterState.codes.size && !playerServeTrajectoryFilterState.codes.has(ev.code)) return false;
    if (playerServeTrajectoryFilterState.zones.size && !playerServeTrajectoryFilterState.zones.has(startZone)) return false;
    return true;
  });
}
function renderPlayerServeTrajectoryAnalysis() {
  if (!elPlayerServeTrajectoryGrid) return;
  renderPlayerServeTrajectoryFilters();
  const events = getFilteredPlayerServeTrajectoryEvents();
  const playerIdx = getPlayerAnalysisPlayerIdx();
  elPlayerServeTrajectoryGrid.innerHTML = "";
  if (playerIdx === null) return;
  const analysisScope = getAnalysisTeamScope();
  const players = getPlayersForScope(analysisScope);
  const numbers = getPlayerNumbersForScope(analysisScope);
  const card = document.createElement("div");
  card.className = "trajectory-card serve-trajectory-card";
  card.dataset.playerIdx = String(playerIdx);
  const title = document.createElement("div");
  title.className = "trajectory-card__title";
  title.textContent =
    analysisScope === "opponent"
      ? formatNameWithNumberFor(players[playerIdx], numbers) || players[playerIdx] || "—"
      : formatNameWithNumber(players[playerIdx]) || players[playerIdx] || "—";
  const canvas = document.createElement("canvas");
  canvas.dataset.serveTrajCanvas = String(playerIdx);
  const empty = document.createElement("div");
  empty.className = "trajectory-card__empty";
  empty.textContent = "Nessuna traiettoria";
  card.appendChild(title);
  card.appendChild(canvas);
  card.appendChild(empty);
  elPlayerServeTrajectoryGrid.appendChild(card);
  const prefs = ensurePlayerAnalysisState();
  const isFarView = getAnalysisCourtSide(prefs.courtSideByScope[analysisScope]) === "far";
  drawServeTrajectoryCanvas(canvas, card, events, {
    scope: analysisScope,
    isFarServe: isFarView,
    onImagesLoad: () => renderPlayerServeTrajectoryAnalysis()
  });
}
function syncPlayerSecondFilterState() {
  playerSecondFilterState.setTypes = new Set(getCheckedValues(elPlayerSecondFilterSetTypes));
  playerSecondFilterState.bases = new Set(getCheckedValues(elPlayerSecondFilterBases));
  playerSecondFilterState.phases = new Set(getCheckedValues(elPlayerSecondFilterPhases));
  playerSecondFilterState.receiveEvaluations = new Set(getCheckedValues(elPlayerSecondFilterReceiveEvals));
  playerSecondFilterState.receiveZones = new Set(getCheckedValues(elPlayerSecondFilterReceiveZones, { asNumber: true }));
  playerSecondFilterState.sets = new Set(getCheckedValues(elPlayerSecondFilterSets, { asNumber: true }));
  playerSecondFilterState.prevSkill = (elPlayerSecondFilterPrev && elPlayerSecondFilterPrev.value) || "any";
}
function handlePlayerSecondFilterChange() {
  syncPlayerSecondFilterState();
  renderPlayerSecondTable();
}
function resetPlayerSecondFilters() {
  playerSecondFilterState.setTypes.clear();
  playerSecondFilterState.bases.clear();
  playerSecondFilterState.phases.clear();
  playerSecondFilterState.receiveEvaluations.clear();
  playerSecondFilterState.receiveZones.clear();
  playerSecondFilterState.sets.clear();
  playerSecondFilterState.prevSkill = "any";
  if (elPlayerSecondFilterPrev) elPlayerSecondFilterPrev.value = "any";
  renderPlayerSecondFilters();
  renderPlayerSecondTable();
}
function renderPlayerSecondFilters() {
  if (!elPlayerSecondFilterSetTypes) return;
  const playerIdx = getPlayerAnalysisPlayerIdx();
  const attackEvents = (state.events || []).filter(ev => {
    if (!ev || ev.skillId !== "attack") return false;
    if (playerIdx === null) return false;
    if (!matchesTeamFilter(ev, analysisTeamFilterState.teams)) return false;
    return getSetterFromEvent(ev) === playerIdx;
  });
  const setTypeOpts = buildUniqueOptions(
    attackEvents.map(ev =>
      normalizeSetTypeValue(ev.setType || (ev.combination && ev.combination.set_type) || (ev.combination && ev.combination.setType))
    ),
    { labelFn: val => getOptionLabel(DEFAULT_SET_TYPE_OPTIONS, val) }
  );
  const baseOpts = buildUniqueOptions(
    attackEvents.map(ev => normalizeBaseValue(ev.base)),
    { labelFn: val => getOptionLabel(DEFAULT_BASE_OPTIONS, val) }
  );
  const phaseOpts = buildUniqueOptions(attackEvents.map(ev => getEventPhaseValue(ev)), {
    labelFn: val => getOptionLabel(DEFAULT_PHASE_OPTIONS, val)
  });
  const recvEvalOpts = buildUniqueOptions(
    attackEvents.map(ev => normalizeEvalCode(ev.receiveEvaluation)),
    { labelFn: val => val }
  );
  const recvZoneOpts = buildUniqueOptions(
    attackEvents.map(ev => normalizeReceiveZone(ev.receivePosition || ev.receiveZone)),
    { asNumber: true, labelFn: val => "Z" + val }
  );
  const setOpts = buildUniqueOptions(attackEvents.map(ev => normalizeSetNumber(ev.set)), {
    asNumber: true,
    labelFn: val => "Set " + val
  });

  playerSecondFilterState.setTypes = new Set(
    [...playerSecondFilterState.setTypes].filter(val => setTypeOpts.some(o => o.value === val))
  );
  playerSecondFilterState.bases = new Set(
    [...playerSecondFilterState.bases].filter(val => baseOpts.some(o => o.value === val))
  );
  playerSecondFilterState.phases = new Set(
    [...playerSecondFilterState.phases].filter(val => phaseOpts.some(o => o.value === val))
  );
  playerSecondFilterState.receiveEvaluations = new Set(
    [...playerSecondFilterState.receiveEvaluations].filter(val => recvEvalOpts.some(o => o.value === val))
  );
  playerSecondFilterState.receiveZones = new Set(
    [...playerSecondFilterState.receiveZones].filter(val => recvZoneOpts.some(o => Number(o.value) === val))
  );
  playerSecondFilterState.sets = new Set(
    [...playerSecondFilterState.sets].filter(val => setOpts.some(o => Number(o.value) === val))
  );
  if (!PREVIOUS_SKILL_OPTIONS.some(opt => opt.value === playerSecondFilterState.prevSkill)) {
    playerSecondFilterState.prevSkill = "any";
  }

  const visibleFilters = [];
  visibleFilters.push(
    renderDynamicFilter(elPlayerSecondFilterSetTypes, setTypeOpts, playerSecondFilterState.setTypes, {
      onChange: handlePlayerSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerSecondFilterBases, baseOpts, playerSecondFilterState.bases, {
      onChange: handlePlayerSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerSecondFilterPhases, phaseOpts, playerSecondFilterState.phases, {
      onChange: handlePlayerSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerSecondFilterReceiveEvals, recvEvalOpts, playerSecondFilterState.receiveEvaluations, {
      onChange: handlePlayerSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerSecondFilterReceiveZones, recvZoneOpts, playerSecondFilterState.receiveZones, {
      asNumber: true,
      onChange: handlePlayerSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(elPlayerSecondFilterSets, setOpts, playerSecondFilterState.sets, {
      asNumber: true,
      onChange: handlePlayerSecondFilterChange
    })
  );
  toggleFilterVisibility(elPlayerSecondFilterPrev, attackEvents.length > 0);
  toggleFilterVisibility(elPlayerSecondFilterReset, visibleFilters.some(Boolean));
  if (elPlayerSecondFilterPrev) {
    elPlayerSecondFilterPrev.value = playerSecondFilterState.prevSkill || "any";
    if (!elPlayerSecondFilterPrev._playerSecondPrevBound) {
      elPlayerSecondFilterPrev.addEventListener("change", handlePlayerSecondFilterChange);
      elPlayerSecondFilterPrev._playerSecondPrevBound = true;
    }
  }
  if (elPlayerSecondFilterReset && !elPlayerSecondFilterReset._playerSecondResetBound) {
    elPlayerSecondFilterReset.addEventListener("click", resetPlayerSecondFilters);
    elPlayerSecondFilterReset._playerSecondResetBound = true;
  }
}
function getFilteredPlayerSecondEvents() {
  const playerIdx = getPlayerAnalysisPlayerIdx();
  const events = (state.events || []).filter(ev => {
    if (!ev || ev.skillId !== "attack") return false;
    if (playerIdx === null) return false;
    if (!matchesTeamFilter(ev, analysisTeamFilterState.teams)) return false;
    return getSetterFromEvent(ev) === playerIdx;
  });
  return events.filter(ev => {
    const traj = ev.attackDirection || ev.attackTrajectory || {};
    const startZone = ev.attackStartZone || traj.startZone || ev.zone || ev.playerPosition || null;
    if (!matchesAdvancedFilters(ev, playerSecondFilterState)) return false;
    return true;
  });
}
function getFilteredPlayerAttacksForSecondDistribution() {
  return getFilteredPlayerSecondEvents().filter(ev => {
    const setType = normalizeSetTypeValue(
      ev.setType || (ev.combination && ev.combination.set_type) || (ev.combination && ev.combination.setType)
    );
    return !(setType && setType.toLowerCase() === "damp");
  });
}
function renderDistributionGrid(targetEl, events) {
  if (!targetEl) return;
  targetEl.innerHTML = "";
  const dist = computeAttackDistribution(events);
  targetEl.classList.add("distribution-grid", "distribution-grid-layout");
  const layout = [
    { key: 4, area: "r4" },
    { key: 3, area: "r3" },
    { key: 2, area: "r2" },
    { key: 5, area: "r5" },
    { key: 6, area: "r6" },
    { key: 1, area: "r1" },
    { key: "all", area: "all" }
  ];
  const zoneOrder = [4, 3, 2, 5, 6, 1];
  layout.forEach(item => {
    const rot = item.key;
    const data =
      dist[rot] ||
      {
        zones: { 1: emptyCounts(), 2: emptyCounts(), 3: emptyCounts(), 4: emptyCounts(), 5: emptyCounts(), 6: emptyCounts() },
        total: 0
      };
    const totalAttacks = data.total || 0;
    const card = document.createElement("div");
    card.className = "distribution-card";
    card.style.gridArea = item.area;
    const title = document.createElement("h4");
    title.textContent = rot === "all" ? "Tutte le rotazioni" : "P" + rot;
    card.appendChild(title);
    const court = document.createElement("div");
    court.className = "distribution-court";
    let bestVolumeZone = null;
    let bestVolumeCount = -1;
    let bestEffZone = null;
    let bestEffValue = -Infinity;
    Object.keys(data.zones).forEach(zKey => {
      const zoneNum = parseInt(zKey, 10);
      const zoneCounts = data.zones[zoneNum] || emptyCounts();
      const total = totalFromCounts(zoneCounts);
      if (total > bestVolumeCount) {
        bestVolumeCount = total;
        bestVolumeZone = zoneNum;
      }
      const metrics = computeMetrics(zoneCounts, "attack");
      const eff = metrics.eff;
      if (eff !== null && eff > bestEffValue) {
        bestEffValue = eff;
        bestEffZone = zoneNum;
      }
    });
    zoneOrder.forEach(zoneNum => {
      const counts = data.zones[zoneNum] || emptyCounts();
      const zoneTotal = totalFromCounts(counts);
      const metrics = computeMetrics(counts, "attack");
      const perc = totalAttacks ? Math.round((zoneTotal / totalAttacks) * 100) : 0;
      const cell = document.createElement("div");
      cell.className = "court-cell";
      if (bestVolumeZone === zoneNum && zoneTotal > 0 && totalAttacks > 0) {
        cell.classList.add("best-volume");
      }
      if (bestEffZone === zoneNum && zoneTotal > 0 && totalAttacks > 0) {
        cell.classList.add("best-eff");
      }
      const label = document.createElement("div");
      label.className = "cell-label";
      label.textContent = "Z" + zoneNum;
      const main = document.createElement("div");
      main.className = "cell-main";
      main.textContent = perc ? perc + "%" : "0%";
      const sub = document.createElement("div");
      sub.className = "cell-sub";
      sub.textContent = "Eff " + (metrics.eff === null ? "-" : formatPercent(metrics.eff));
      cell.appendChild(label);
      cell.appendChild(main);
      cell.appendChild(sub);
      court.appendChild(cell);
    });
    card.appendChild(court);
    targetEl.appendChild(card);
  });
}
function renderPlayerSecondTable() {
  if (!elPlayerSecondBody) return;
  elPlayerSecondBody.innerHTML = "";
  renderPlayerSecondFilters();
  const analysisScope = getAnalysisTeamScope();
  const players = getPlayersForScope(analysisScope);
  const numbers = getPlayerNumbersForScope(analysisScope);
  const playerIdx = getPlayerAnalysisPlayerIdx();
  if (playerIdx === null) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 11;
    td.textContent = "Seleziona una giocatrice per vedere la distribuzione.";
    tr.appendChild(td);
    elPlayerSecondBody.appendChild(tr);
    renderDistributionGrid(elPlayerSecondDistribution, []);
    return;
  }
  const totals = emptyCounts();
  const counts = emptyCounts();
  getFilteredPlayerSecondEvents().forEach(ev => {
    const code = normalizeEvalCode(ev.code || ev.evaluation);
    if (!code) return;
    counts[code] = (counts[code] || 0) + 1;
  });
  mergeCounts(totals, counts);
  const total = totalFromCounts(counts);
  if (!total) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 11;
    td.textContent = "Registra alzate per vedere il dettaglio.";
    tr.appendChild(td);
    elPlayerSecondBody.appendChild(tr);
    renderDistributionGrid(elPlayerSecondDistribution, getFilteredPlayerAttacksForSecondDistribution());
    return;
  }
  const metrics = computeMetrics(counts, "second");
  const tr = document.createElement("tr");
  const cells = [
    {
      text:
        analysisScope === "opponent"
          ? formatNameWithNumberFor(players[playerIdx], numbers)
          : formatNameWithNumber(players[playerIdx])
    },
    { text: total, className: "skill-col skill-second" },
    { text: counts["#"] || 0, className: "skill-col skill-second" },
    { text: counts["+"] || 0, className: "skill-col skill-second" },
    { text: counts["!"] || 0, className: "skill-col skill-second" },
    { text: counts["-"] || 0, className: "skill-col skill-second" },
    { text: counts["="] || 0, className: "skill-col skill-second" },
    { text: counts["/"] || 0, className: "skill-col skill-second" },
    { text: metrics.pos === null ? "-" : formatPercent(metrics.pos), className: "skill-col skill-second" },
    { text: metrics.prf === null ? "-" : formatPercent(metrics.prf), className: "skill-col skill-second" },
    { text: metrics.eff === null ? "-" : formatPercent(metrics.eff), className: "skill-col skill-second" }
  ];
  cells.forEach(cell => {
    const td = document.createElement("td");
    td.textContent = cell.text;
    if (cell.className) td.className = cell.className;
    tr.appendChild(td);
  });
  elPlayerSecondBody.appendChild(tr);
  renderDistributionGrid(elPlayerSecondDistribution, getFilteredPlayerAttacksForSecondDistribution());
}
function renderVideoFilters(events) {
  const els = getVideoFilterElements();
  if (!els) return;
  const list = Array.isArray(events) ? events : [];
  const filteredByTeam = videoFilterState.teams.size
    ? list.filter(ev => matchesTeamFilter(ev, videoFilterState.teams))
    : list;
  const showBothTeams = state.useOpponentTeam && videoFilterState.teams.size !== 1;
  const labelScope = filteredByTeam.length ? getTeamScopeFromEvent(filteredByTeam[0]) : getAnalysisTeamScope();
  const labelPlayers = getPlayersForScope(labelScope);
  const labelNumbers = getPlayerNumbersForScope(labelScope);
  const getPlayerLabel = (scope, idx, { setter = false, includeTeam = true } = {}) => {
    const players = getPlayersForScope(scope);
    const numbers = getPlayerNumbersForScope(scope);
    const name = players[idx];
    const baseLabel = name
      ? scope === "opponent"
        ? formatNameWithNumberFor(name, numbers)
        : formatNameWithNumber(name)
      : setter
        ? "Alzatore " + (Number(idx) + 1)
        : "#" + (Number(idx) + 1);
    if (showBothTeams && includeTeam) {
      return getTeamNameForScope(scope) + " · " + baseLabel;
    }
    return baseLabel;
  };
  const sortScopedOptionsForScope = (options, scope) => {
    const scoped = options.map(opt => {
      const key = String(opt.value);
      const idxRaw = key.includes(":") ? key.split(":")[1] : key;
      const idx = Number(idxRaw);
      const players = getPlayersForScope(scope);
      const numbers = getPlayerNumbersForScope(scope);
      const name = players[idx];
      const rawNum = numbers && name ? numbers[name] : null;
      const parsedNum = rawNum !== null && rawNum !== undefined && rawNum !== "" ? parseInt(rawNum, 10) : null;
      return {
        opt,
        idx,
        number: Number.isFinite(parsedNum) ? parsedNum : null,
        name: name || ""
      };
    });
    scoped.sort((a, b) => {
      const numA = a.number;
      const numB = b.number;
      if (numA === null && numB === null) {
        return a.name.localeCompare(b.name, "it", { sensitivity: "base" });
      }
      if (numA === null) return 1;
      if (numB === null) return -1;
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name, "it", { sensitivity: "base" });
    });
    return scoped.map(entry => entry.opt);
  };
  const buildPlayerKey = (scope, idx) =>
    showBothTeams ? makeScopedIndexKey(scope, idx) : String(idx);
  const buildPlayerOptionsForScope = (scope, { setter = false } = {}) => {
    const values = filteredByTeam
      .filter(ev => getTeamScopeFromEvent(ev) === scope)
      .map(ev => {
        const idx = setter ? getSetterFromEvent(ev) : resolvePlayerIdx(ev);
        if (idx === null || idx === -1) return null;
        return buildPlayerKey(scope, idx);
      });
    const raw = buildUniqueOptions(values, {
      labelFn: key => {
        if (!showBothTeams) {
          const idx = Number(String(key).split(":")[1] || key);
          const name = labelPlayers[idx];
          if (!name) return setter ? "Alzatore " + (Number(idx) + 1) : "#" + (Number(idx) + 1);
          return labelScope === "opponent"
            ? formatNameWithNumberFor(name, labelNumbers)
            : formatNameWithNumber(name);
        }
        const [keyScope, idxRaw] = String(key).split(":");
        return getPlayerLabel(keyScope, Number(idxRaw), { setter, includeTeam: false });
      }
    });
    return showBothTeams
      ? sortScopedOptionsForScope(raw, scope)
      : sortPlayerOptionsByNumberForScope(raw, labelScope);
  };
  const playerOptsOur = showBothTeams ? buildPlayerOptionsForScope("our") : [];
  const playerOptsOpp = showBothTeams ? buildPlayerOptionsForScope("opponent") : [];
  const setterOptsOur = showBothTeams ? buildPlayerOptionsForScope("our", { setter: true }) : [];
  const setterOptsOpp = showBothTeams ? buildPlayerOptionsForScope("opponent", { setter: true }) : [];
  const playerOptsRaw = showBothTeams
    ? playerOptsOur.concat(playerOptsOpp)
    : buildPlayerOptionsForScope(labelScope);
  const setterOptsRaw = showBothTeams
    ? setterOptsOur.concat(setterOptsOpp)
    : buildPlayerOptionsForScope(labelScope, { setter: true });
  const playerOpts = playerOptsRaw;
  const setterOpts = setterOptsRaw;
  const skillOpts = buildUniqueOptions(filteredByTeam.map(ev => ev.skillId), {
    labelFn: val => (SKILLS.find(s => s.id === val) || {}).label || val
  }).filter(opt => opt.value !== "manual");
  const codeOpts = filterNormalEvalOptions(
    buildUniqueOptions(filteredByTeam.map(ev => ev.code), { labelFn: val => val })
  );
  const setOpts = buildUniqueOptions(filteredByTeam.map(ev => normalizeSetNumber(ev.set)), {
    asNumber: true,
    labelFn: val => "Set " + val
  });
  const rotOpts = buildUniqueOptions(filteredByTeam.map(ev => ev.rotation), {
    asNumber: true,
    labelFn: val => "P" + val
  });
  const zoneOpts = buildUniqueOptions(filteredByTeam.map(ev => ev.zone || ev.playerPosition), {
    asNumber: true,
    labelFn: val => "Z" + val
  });
  const baseOpts = buildUniqueOptions(filteredByTeam.map(ev => normalizeBaseValue(ev.base)), {
    labelFn: val => val.toUpperCase()
  });
  const setTypeOpts = buildUniqueOptions(
    filteredByTeam.map(ev =>
      normalizeSetTypeValue(
        ev.setType || (ev.combination && ev.combination.set_type) || (ev.combination && ev.combination.setType)
      )
    ),
    { labelFn: val => getOptionLabel(DEFAULT_SET_TYPE_OPTIONS, val) }
  );
  const phaseOpts = buildUniqueOptions(
    filteredByTeam.map(ev => {
      let rawPhase = ev.attackBp;
      if (rawPhase === undefined || rawPhase === null) {
        rawPhase = ev.phase !== undefined ? ev.phase : ev.attackPhase !== undefined ? ev.attackPhase : null;
      }
      return normalizePhaseValue(rawPhase);
    }),
    { labelFn: val => formatAttackPhaseLabel(val) }
  );
  const recvEvalOpts = buildUniqueOptions(filteredByTeam.map(ev => normalizeEvalCode(ev.receiveEvaluation)), {
    labelFn: val => val
  });
  const recvZoneOpts = buildUniqueOptions(
    filteredByTeam.map(ev => normalizeReceiveZone(ev.receivePosition || ev.receiveZone)),
    { asNumber: true, labelFn: val => "Z" + val }
  );
  const serveTypeOpts = buildUniqueOptions(filteredByTeam.map(ev => ev.serveType), { labelFn: val => val });

  const playerOptValues = new Set(playerOpts.map(opt => opt.value));
  const setterOptValues = new Set(setterOpts.map(opt => opt.value));
  videoFilterState.players = new Set(
    [...videoFilterState.players].filter(val => playerOptValues.has(val))
  );
  videoFilterState.setters = new Set(
    [...videoFilterState.setters].filter(val => setterOptValues.has(val))
  );
  videoFilterState.skills = new Set(
    [...videoFilterState.skills].filter(val => skillOpts.some(o => o.value === val))
  );
  videoFilterState.codes = new Set(
    [...videoFilterState.codes].filter(val => codeOpts.some(o => o.value === val))
  );
  videoFilterState.sets = new Set(
    [...videoFilterState.sets].filter(val => setOpts.some(o => Number(o.value) === val))
  );
  videoFilterState.rotations = new Set(
    [...videoFilterState.rotations].filter(val => rotOpts.some(o => Number(o.value) === val))
  );
  videoFilterState.zones = new Set(
    [...videoFilterState.zones].filter(val => zoneOpts.some(o => Number(o.value) === val))
  );
  videoFilterState.bases = new Set(
    [...videoFilterState.bases].filter(val => baseOpts.some(o => o.value === val))
  );
  videoFilterState.setTypes = new Set(
    [...videoFilterState.setTypes].filter(val => setTypeOpts.some(o => o.value === val))
  );
  videoFilterState.phases = new Set(
    [...videoFilterState.phases].filter(val => phaseOpts.some(o => o.value === val))
  );
  videoFilterState.receiveEvaluations = new Set(
    [...videoFilterState.receiveEvaluations].filter(val => recvEvalOpts.some(o => o.value === val))
  );
  videoFilterState.receiveZones = new Set(
    [...videoFilterState.receiveZones].filter(val => recvZoneOpts.some(o => Number(o.value) === val))
  );
  videoFilterState.serveTypes = new Set(
    [...videoFilterState.serveTypes].filter(val => serveTypeOpts.some(o => o.value === val))
  );
  videoFilterState.teams = new Set(
    [...videoFilterState.teams].filter(val => getTeamFilterOptions().some(o => o.value === val))
  );

  renderDynamicFilter(els.teams, getTeamFilterOptions(), videoFilterState.teams, {
    onChange: handleVideoTeamFilterChange
  });
  if (showBothTeams) {
    const renderSplitFilter = (container, groups, selectedSet) => {
      if (!container) return;
      container.innerHTML = "";
      groups.forEach(group => {
        const groupEl = document.createElement("div");
        groupEl.className = "filter-scope-group";
        const title = document.createElement("div");
        title.className = "filter-scope-title";
        title.textContent = getTeamNameForScope(group.scope);
        const optionsEl = document.createElement("div");
        optionsEl.className = "analysis-filter__options";
        optionsEl.id = `${container.id}-${group.scope}`;
        buildFilterOptions(optionsEl, group.options, selectedSet, { onChange: handleVideoFilterChange });
        groupEl.appendChild(title);
        groupEl.appendChild(optionsEl);
        container.appendChild(groupEl);
      });
    };
    renderSplitFilter(
      els.players,
      [
        { scope: "our", options: playerOptsOur },
        { scope: "opponent", options: playerOptsOpp }
      ],
      videoFilterState.players
    );
    renderSplitFilter(
      els.setters,
      [
        { scope: "our", options: setterOptsOur },
        { scope: "opponent", options: setterOptsOpp }
      ],
      videoFilterState.setters
    );
    toggleFilterVisibility(els.players, playerOpts.length > 0);
    toggleFilterVisibility(els.setters, setterOpts.length > 0);
  } else {
    renderDynamicFilter(els.players, playerOpts, videoFilterState.players, {
      onChange: handleVideoFilterChange
    });
    renderDynamicFilter(els.setters, setterOpts, videoFilterState.setters, {
      onChange: handleVideoFilterChange
    });
  }
  renderDynamicFilter(els.skills, skillOpts, videoFilterState.skills, {
    onChange: handleVideoFilterChange
  });
  renderDynamicFilter(els.codes, codeOpts, videoFilterState.codes, {
    onChange: handleVideoFilterChange
  });
  renderDynamicFilter(els.sets, setOpts, videoFilterState.sets, {
    onChange: handleVideoFilterChange
  });
  renderDynamicFilter(els.rotations, rotOpts, videoFilterState.rotations, {
    onChange: handleVideoFilterChange
  });
  renderDynamicFilter(els.zones, zoneOpts, videoFilterState.zones, {
    onChange: handleVideoFilterChange
  });
  renderDynamicFilter(els.bases, baseOpts, videoFilterState.bases, {
    onChange: handleVideoFilterChange
  });
  renderDynamicFilter(els.setTypes, setTypeOpts, videoFilterState.setTypes, {
    onChange: handleVideoFilterChange
  });
  renderDynamicFilter(els.phases, phaseOpts, videoFilterState.phases, {
    onChange: handleVideoFilterChange
  });
  renderDynamicFilter(els.receiveEvals, recvEvalOpts, videoFilterState.receiveEvaluations, {
    onChange: handleVideoFilterChange
  });
  renderDynamicFilter(els.receiveZones, recvZoneOpts, videoFilterState.receiveZones, {
    onChange: handleVideoFilterChange
  });
  renderDynamicFilter(els.serveTypes, serveTypeOpts, videoFilterState.serveTypes, {
    onChange: handleVideoFilterChange
  });

  const visibleFilters = [
    playerOpts.length,
    setterOpts.length,
    skillOpts.length,
    codeOpts.length,
    setOpts.length,
    rotOpts.length,
    zoneOpts.length,
    baseOpts.length,
    setTypeOpts.length,
    phaseOpts.length,
    recvEvalOpts.length,
    recvZoneOpts.length,
    serveTypeOpts.length
  ];
  if (els.wrap) {
    els.wrap.style.display = visibleFilters.some(Boolean) ? "" : "none";
  }
  toggleFilterVisibility(els.reset, visibleFilters.some(Boolean));
  if (els.reset && !els.reset._videoResetBound) {
    els.reset.addEventListener("click", resetVideoFilters);
    els.reset._videoResetBound = true;
  }
}
function getTrajectoryBg(zone, isFarSide, cb) {
  const far = typeof isFarSide === "function" ? false : !!isFarSide;
  const onLoad = typeof isFarSide === "function" ? isFarSide : cb;
  const key = String(zone) + "-" + (far ? "far" : "near");
  if (trajectoryBgCache[key] && trajectoryBgCache[key].complete) {
    return trajectoryBgCache[key];
  }
  const img = new Image();
  img.src = getTrajectoryImageForZone(zone, far);
  if (onLoad) {
    img.onload = onLoad;
  }
  trajectoryBgCache[key] = img;
  return img;
}
function getServeTrajectoryImages(cb) {
  if (
    serveTrajectoryImgs &&
    serveTrajectoryImgs.start &&
    serveTrajectoryImgs.end &&
    serveTrajectoryImgs.startFar &&
    serveTrajectoryImgs.endFar
  ) {
    if (
      serveTrajectoryImgs.start.complete &&
      serveTrajectoryImgs.end.complete &&
      serveTrajectoryImgs.startFar.complete &&
      serveTrajectoryImgs.endFar.complete
    ) {
      return serveTrajectoryImgs;
    }
  }
  const start = new Image();
  const end = new Image();
  const startFar = new Image();
  const endFar = new Image();
  start.src = SERVE_START_IMG_NEAR;
  end.src = SERVE_END_IMG_NEAR;
  startFar.src = SERVE_START_IMG_FAR;
  endFar.src = SERVE_END_IMG_FAR;
  if (cb) {
    start.onload = cb;
    end.onload = cb;
    startFar.onload = cb;
    endFar.onload = cb;
  }
  serveTrajectoryImgs = { start, end, startFar, endFar };
  return serveTrajectoryImgs;
}
function getAttackEmptyImage(isFarSide, cb) {
  const key = isFarSide ? "attack-empty-far" : "attack-empty-near";
  if (trajectoryBgCache[key] && trajectoryBgCache[key].complete) {
    return trajectoryBgCache[key];
  }
  const img = new Image();
  img.src = isFarSide ? TRAJECTORY_IMG_FAR : TRAJECTORY_IMG_NEAR;
  if (cb) {
    img.onload = cb;
  }
  trajectoryBgCache[key] = img;
  return img;
}
function getTrajectoryColorForCode(code, variant = "attack") {
  const normalized = normalizeEvalCode(code) || String(code || "").trim();
  const palette = variant === "serve" ? TRAJECTORY_LINE_COLORS_SERVE : TRAJECTORY_LINE_COLORS;
  return palette[normalized] || "#38bdf8";
}
function getFilteredTrajectoryEvents() {
  const events = (state.events || []).filter(ev => {
    if (!ev || ev.skillId !== "attack") return false;
    const dir = ev.attackDirection || ev.attackTrajectory;
    return dir && dir.start && dir.end;
  });
  return events.filter(ev => {
    const traj = ev.attackDirection || ev.attackTrajectory;
    const startZone = ev.attackStartZone || (traj && traj.startZone) || ev.zone || ev.playerPosition || null;
    if (!matchesTeamFilter(ev, analysisTeamFilterState.teams)) return false;
    if (!matchesAdvancedFilters(ev, trajectoryFilterState)) return false;
    if (trajectoryFilterState.setters.size) {
      const setterIdx = getSetterFromEvent(ev);
      if (setterIdx === null || !trajectoryFilterState.setters.has(setterIdx)) return false;
    }
    if (trajectoryFilterState.players.size && !trajectoryFilterState.players.has(ev.playerIdx)) return false;
    if (trajectoryFilterState.sets.size && !trajectoryFilterState.sets.has(ev.set)) return false;
    if (trajectoryFilterState.codes.size && !trajectoryFilterState.codes.has(ev.code)) return false;
    if (trajectoryFilterState.zones.size && !trajectoryFilterState.zones.has(startZone)) return false;
    return true;
  });
}
function getServeStartZone(ev) {
  if (!ev || !ev.serveStart) return null;
  return getAttackZone(ev.serveStart, true);
}
function getServeTrajectoryEventsForServer(scope) {
  const serverName = getActiveServerName(scope) || (getServerPlayerForScope(scope) || {}).name || "";
  const players = getPlayersForScope(scope);
  const serverIdx = serverName ? players.indexOf(serverName) : -1;
  let events = (state.events || []).filter(ev => {
    if (!ev || ev.skillId !== "serve") return false;
    if (!ev.serveStart || !ev.serveEnd) return false;
    if (getTeamScopeFromEvent(ev) !== scope) return false;
    if (serverName && ev.playerName === serverName) return true;
    if (serverIdx >= 0 && ev.playerIdx === serverIdx) return true;
    return false;
  });
  const lastEvent = events.length ? events[events.length - 1] : null;
  const eventSwap = lastEvent && typeof lastEvent.courtSideSwapped === "boolean" ? lastEvent.courtSideSwapped : null;
  if (lastEvent && typeof lastEvent.courtSideSwapped === "boolean") {
    events = events.filter(ev => ev && ev.courtSideSwapped === lastEvent.courtSideSwapped);
  }
  return { events, serverName, eventSwap };
}
function drawServeTrajectoryCanvas(canvas, card, events, { scope, isFarServe, onImagesLoad } = {}) {
  if (!canvas || !card) return;
  const gapOverlapPx = 30;
  const imgs = getServeTrajectoryImages(onImagesLoad || (() => renderLogServeTrajectories()));
  const farFlag =
    typeof isFarServe === "boolean" ? isFarServe : scope ? isFarSideForScope(scope) : false;
  const startImg = imgs && (farFlag ? imgs.startFar : imgs.start);
  const endImg = imgs && (farFlag ? imgs.endFar : imgs.end);
  const startRatio = startImg && startImg.naturalWidth ? startImg.naturalHeight / startImg.naturalWidth : 0.65;
  const endRatio = endImg && endImg.naturalWidth ? endImg.naturalHeight / endImg.naturalWidth : 0.65;
  const width =
    (canvas.parentElement && canvas.parentElement.clientWidth) ||
    (startImg && startImg.naturalWidth) ||
    (endImg && endImg.naturalWidth) ||
    320;
  const startHeight = Math.max(80, Math.round(width * startRatio));
  const endHeight = Math.max(80, Math.round(width * endRatio));
  const gapHeight = Math.max(0, startHeight - Math.round(startHeight / 9));
  const gapCut = Math.min(gapOverlapPx, Math.max(0, gapHeight - 1));
  const effectiveGap = Math.max(0, gapHeight - gapCut);
  const height = startHeight + effectiveGap + endHeight;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  const gapImg = getAttackEmptyImage(!farFlag, () => renderLogServeTrajectories());
  const overlap = gapCut;
  if (farFlag) {
    if (startImg && startImg.complete && startImg.naturalWidth) {
      ctx.drawImage(startImg, 0, 0, width, startHeight);
    }
    if (effectiveGap > 0) {
      const gapStart = startHeight;
      if (gapImg && gapImg.complete && gapImg.naturalWidth) {
        const srcCut = Math.round((overlap / gapHeight) * gapImg.naturalHeight);
        const srcY = Math.min(srcCut, gapImg.naturalHeight - 1);
        const srcH = Math.max(1, gapImg.naturalHeight - srcY);
        const destY = gapStart;
        const destH = Math.max(1, effectiveGap);
        ctx.drawImage(gapImg, 0, srcY, gapImg.naturalWidth, srcH, 0, destY, width, destH);
      } else {
        ctx.fillStyle = "#ffb142";
        ctx.fillRect(0, gapStart, width, Math.max(1, effectiveGap));
      }
    }
    if (endImg && endImg.complete && endImg.naturalWidth) {
      ctx.drawImage(endImg, 0, startHeight + effectiveGap, width, endHeight);
    }
  } else {
    if (endImg && endImg.complete && endImg.naturalWidth) {
      ctx.drawImage(endImg, 0, 0, width, endHeight);
    }
    if (effectiveGap > 0) {
      const gapStart = endHeight;
      if (gapImg && gapImg.complete && gapImg.naturalWidth) {
        const srcCut = Math.round((overlap / gapHeight) * gapImg.naturalHeight);
        const srcH = Math.max(1, gapImg.naturalHeight - srcCut);
        const destH = Math.max(1, effectiveGap);
        ctx.drawImage(gapImg, 0, 0, gapImg.naturalWidth, srcH, 0, gapStart, width, destH);
      } else {
        ctx.fillStyle = "#ffb142";
        ctx.fillRect(0, gapStart, width, Math.max(1, effectiveGap));
      }
    }
    if (startImg && startImg.complete && startImg.naturalWidth) {
      ctx.drawImage(startImg, 0, endHeight + effectiveGap, width, startHeight);
    }
  }
  const netY = farFlag ? startHeight + effectiveGap : endHeight;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 8;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(0, netY);
  ctx.lineTo(width, netY);
  ctx.stroke();
  ctx.setLineDash([]);
  if (!events || events.length === 0) {
    card.classList.add("empty");
    return;
  }
  card.classList.remove("empty");
  events.forEach(ev => {
    const startRaw = ev.serveStart;
    const endRaw = ev.serveEnd;
    const start = farFlag && startRaw ? mirrorTrajectoryPoint(startRaw) : startRaw;
    const end = farFlag && endRaw ? mirrorTrajectoryPoint(endRaw) : endRaw;
    if (!start || !end) return;
    const sx = clamp01Val(start.x) * width;
    const sy = clamp01Val(start.y) * startHeight + (farFlag ? 0 : endHeight + effectiveGap);
    const ex = clamp01Val(end.x) * width;
    const ey = clamp01Val(end.y) * endHeight + (farFlag ? startHeight + effectiveGap : 0);
    ctx.strokeStyle = getTrajectoryColorForCode(ev.code, "serve");
    ctx.lineWidth = TRAJECTORY_LINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  });
}
function resolvePlayerIdxFromNameForScope(name, scope) {
  const players = getPlayersForScope(scope);
  if (!name || !players || !players.length) return -1;
  const directIdx = players.findIndex(p => p === name);
  if (directIdx !== -1) return directIdx;
  const raw = String(name).trim().toLowerCase();
  if (!raw) return -1;
  const normalized = raw.replace(/^[0-9]+\\s*/, "");
  return players.findIndex(p => {
    const base = String(p || "").trim().toLowerCase();
    if (!base) return false;
    return base === normalized || base === raw;
  });
}
function getServeStatsForServer(scope, serverName) {
  const players = getPlayersForScope(scope);
  const idx = resolvePlayerIdxFromNameForScope(serverName, scope);
  if (idx < 0 || !players[idx]) return null;
  const events = (state.events || []).filter(ev => getTeamScopeFromEvent(ev) === scope);
  const statsByPlayer = computeStatsByPlayerForEvents(events, players);
  const serveCounts = normalizeCounts(statsByPlayer[idx] && statsByPlayer[idx].serve);
  const serveMetrics = computeMetrics(serveCounts, "serve");
  return {
    total: totalFromCounts(serveCounts),
    ace: serveCounts["#"] || 0,
    error: serveCounts["="] || 0,
    pos: serveMetrics.pos === null ? "-" : formatPercent(serveMetrics.pos),
    eff: serveMetrics.eff === null ? "-" : formatPercent(serveMetrics.eff)
  };
}
function renderServeStatsGrid(targetEl, stats) {
  if (!targetEl) return;
  targetEl.innerHTML = "";
  if (!stats) {
    const empty = document.createElement("div");
    empty.className = "log-serve-card__stat";
    empty.textContent = "Nessun dato";
    targetEl.appendChild(empty);
    return;
  }
  const rows = [
    { label: "Tot", value: stats.total },
    { label: "#", value: stats.ace },
    { label: "=", value: stats.error },
    { label: "Pos", value: stats.pos },
    { label: "Eff", value: stats.eff }
  ];
  rows.forEach(row => {
    const item = document.createElement("div");
    item.className = "log-serve-card__stat";
    const label = document.createElement("span");
    label.textContent = row.label;
    const value = document.createElement("strong");
    value.textContent = row.value;
    item.appendChild(label);
    item.appendChild(value);
    targetEl.appendChild(item);
  });
}
function getServingScopeForLogTrajectory() {
  if (state.useOpponentTeam && state.predictiveSkillFlow) {
    const ourNext = getPredictedSkillIdForScope("our");
    const oppNext = getPredictedSkillIdForScope("opponent");
    if (ourNext === "serve") return "our";
    if (oppNext === "serve") return "opponent";
  }
  if (state.pendingServe && state.pendingServe.scope) {
    return state.pendingServe.scope;
  }
  if (isPostServeLockForScope("our")) return "our";
  if (isPostServeLockForScope("opponent")) return "opponent";
  if (serveTrajectoryScope === "our" || serveTrajectoryScope === "opponent") {
    return serveTrajectoryScope;
  }
  return null;
}
function getActiveServeSelectionScope() {
  const keys = Object.keys(selectedSkillPerPlayer || {});
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (selectedSkillPerPlayer[key] !== "serve") continue;
    if (serveMetaByPlayer && serveMetaByPlayer[key]) continue;
    const scope = key.split(":")[0];
    if (scope === "our" || scope === "opponent") return scope;
  }
  return null;
}
function renderLogServeTrajectories() {
  if (!elLogServeTrajectory) return;
  const selectionScope = getActiveServeSelectionScope();
  const servingScope = getServingScopeForLogTrajectory() || selectionScope;
  const allowOur = !!state.showServeTrajectoryLogOur;
  const allowOpp = !!state.showServeTrajectoryLogOpp;
  const canShow = !!servingScope;
  if (elServeTrajectoryLogToggleInline) {
    elServeTrajectoryLogToggleInline.checked = allowOur;
  }
  if (elServeTrajectoryLogToggleInlineOpp) {
    elServeTrajectoryLogToggleInlineOpp.checked = allowOpp;
  }
  elLogServeTrajectory.classList.toggle("hidden", !canShow);
  if (!canShow) return;
  const showOur = servingScope === "our" && allowOur;
  const showOpp = servingScope === "opponent" && state.useOpponentTeam && allowOpp;
  if (elLogServeCardOur) elLogServeCardOur.classList.toggle("hidden", !showOur);
  if (elLogServeCardOpp) elLogServeCardOpp.classList.toggle("hidden", !showOpp);
  if (showOur && elLogServeCanvasOur && elLogServeCardOur) {
    const { events, serverName } = getServeTrajectoryEventsForServer("our");
    if (elLogServeNameOur) {
      elLogServeNameOur.textContent = serverName ? formatNameWithNumber(serverName) : "—";
    }
    drawServeTrajectoryCanvas(elLogServeCanvasOur, elLogServeCardOur, events, {
      scope: "our",
      isFarServe: isFarSideForScope("our")
    });
    renderServeStatsGrid(elLogServeStatsOur, getServeStatsForServer("our", serverName));
  }
  if (showOpp && elLogServeCanvasOpp && elLogServeCardOpp) {
    const { events, serverName } = getServeTrajectoryEventsForServer("opponent");
    if (elLogServeNameOpp) {
      elLogServeNameOpp.textContent = serverName
        ? formatNameWithNumberFor(serverName, getPlayerNumbersForScope("opponent"))
        : "—";
    }
    drawServeTrajectoryCanvas(elLogServeCanvasOpp, elLogServeCardOpp, events, {
      scope: "opponent",
      isFarServe: isFarSideForScope("opponent")
    });
    renderServeStatsGrid(elLogServeStatsOpp, getServeStatsForServer("opponent", serverName));
  }
}
function initLogServeTrajectoryControls() {
  if (!elLogServeTrajectory) return;
  if (elServeTrajectoryLogToggleInline && !elServeTrajectoryLogToggleInline._bound) {
    elServeTrajectoryLogToggleInline.addEventListener("change", () => {
      state.showServeTrajectoryLogOur = !!elServeTrajectoryLogToggleInline.checked;
      saveState();
      renderLogServeTrajectories();
    });
    elServeTrajectoryLogToggleInline._bound = true;
  }
  if (elServeTrajectoryLogToggleInlineOpp && !elServeTrajectoryLogToggleInlineOpp._bound) {
    elServeTrajectoryLogToggleInlineOpp.addEventListener("change", () => {
      state.showServeTrajectoryLogOpp = !!elServeTrajectoryLogToggleInlineOpp.checked;
      saveState();
      renderLogServeTrajectories();
    });
    elServeTrajectoryLogToggleInlineOpp._bound = true;
  }
  renderLogServeTrajectories();
}
function getFilteredServeTrajectoryEvents() {
  const events = (state.events || []).filter(ev => {
    if (!ev || ev.skillId !== "serve") return false;
    return ev.serveStart && ev.serveEnd;
  });
  return events.filter(ev => {
    const startZone = getServeStartZone(ev);
    if (!matchesTeamFilter(ev, analysisTeamFilterState.teams)) return false;
    if (!matchesAdvancedFilters(ev, serveTrajectoryFilterState)) return false;
    if (serveTrajectoryFilterState.players.size && !serveTrajectoryFilterState.players.has(ev.playerIdx)) return false;
    if (serveTrajectoryFilterState.sets.size && !serveTrajectoryFilterState.sets.has(ev.set)) return false;
    if (serveTrajectoryFilterState.codes.size && !serveTrajectoryFilterState.codes.has(ev.code)) return false;
    if (serveTrajectoryFilterState.zones.size && !serveTrajectoryFilterState.zones.has(startZone)) return false;
    return true;
  });
}
function renderTrajectoryAnalysis() {
  if (!elTrajectoryGrid) return;
  renderTrajectoryFilters();
  const canvases = elTrajectoryGrid.querySelectorAll("canvas[data-traj-canvas]");
  if (!canvases || canvases.length === 0) return;
  const analysisScope = getAnalysisTeamScope();
  const courtSideState = ensureCourtSideState("uiTrajectoryCourtSideByScope");
  const isFarView = getAnalysisCourtSide(courtSideState[analysisScope]) === "far";
  elTrajectoryGrid.classList.toggle("is-far", isFarView);
  const events = getFilteredTrajectoryEvents();
  const grouped = {};
  events.forEach(ev => {
    const traj = ev.attackDirection || ev.attackTrajectory || {};
    const zone = ev.attackStartZone || traj.startZone || ev.zone || ev.playerPosition || null;
    if (!zone) return;
    if (!grouped[zone]) grouped[zone] = [];
    grouped[zone].push(ev);
  });
  canvases.forEach(canvas => {
    const zone = parseInt(canvas.dataset.trajCanvas, 10);
    const card = canvas.closest(".trajectory-card");
    const list = grouped[zone] || [];
    const img = getTrajectoryBg(zone, isFarView, () => renderTrajectoryAnalysis());
    const ratio = img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.65;
    const width = (canvas.parentElement && canvas.parentElement.clientWidth) || img.naturalWidth || 320;
    const height = Math.max(120, Math.round(width * ratio || width * 0.65));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, 0, 0, width, height);
    }
    if (!list.length) {
      if (card) card.classList.add("empty");
      return;
    }
    if (card) card.classList.remove("empty");
    list.forEach(ev => {
      const traj = ev.attackDirection || ev.attackTrajectory || {};
      const startRaw = traj.start || ev.attackStart;
      const endRaw = traj.end || ev.attackEnd;
      const start = isFarView && startRaw ? mirrorTrajectoryPoint(startRaw) : startRaw;
      const end = isFarView && endRaw ? mirrorTrajectoryPoint(endRaw) : endRaw;
      if (!start || !end) return;
      const sx = clamp01Val(start.x) * width;
      const sy = clamp01Val(start.y) * height;
      const ex = clamp01Val(end.x) * width;
      const ey = clamp01Val(end.y) * height;
      ctx.strokeStyle = getTrajectoryColorForCode(ev.code, "attack");
      ctx.lineWidth = TRAJECTORY_LINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    });
  });
}
function renderServeTrajectoryAnalysis() {
  if (!elServeTrajectoryGrid) return;
  renderServeTrajectoryFilters();
  const events = getFilteredServeTrajectoryEvents();
  const analysisScope = getAnalysisTeamScope();
  const courtSideState = ensureCourtSideState("uiServeTrajectoryCourtSideByScope");
  const isFarView = getAnalysisCourtSide(courtSideState[analysisScope]) === "far";
  const analysisPlayers = getPlayersForScope(analysisScope);
  const analysisNumbers = getPlayerNumbersForScope(analysisScope);
  const selectedPlayers = serveTrajectoryFilterState.players.size
    ? Array.from(serveTrajectoryFilterState.players)
    : Array.from(new Set(events.map(ev => ev.playerIdx))).filter(idx => typeof idx === "number");
  const playersToRender = selectedPlayers.length
    ? sortPlayerIndexesByNumberForScope(selectedPlayers, analysisScope)
    : [];
  elServeTrajectoryGrid.innerHTML = "";
  const cards = [];
  playersToRender.forEach(playerIdx => {
    const card = document.createElement("div");
    card.className = "trajectory-card serve-trajectory-card";
    card.dataset.playerIdx = String(playerIdx);
    const title = document.createElement("div");
    title.className = "trajectory-card__title";
    title.textContent =
      analysisScope === "opponent"
        ? formatNameWithNumberFor(analysisPlayers[playerIdx], analysisNumbers) ||
          analysisPlayers[playerIdx] ||
          "—"
        : formatNameWithNumber(analysisPlayers[playerIdx]) || analysisPlayers[playerIdx] || "—";
    const canvas = document.createElement("canvas");
    canvas.dataset.serveTrajCanvas = String(playerIdx);
    const empty = document.createElement("div");
    empty.className = "trajectory-card__empty";
    empty.textContent = "Nessuna traiettoria";
    card.appendChild(title);
    card.appendChild(canvas);
    card.appendChild(empty);
    elServeTrajectoryGrid.appendChild(card);
    cards.push({ card, canvas, playerIdx });
  });
  if (!cards.length) return;
  const grouped = {};
  events.forEach(ev => {
    if (typeof ev.playerIdx !== "number") return;
    if (!grouped[ev.playerIdx]) grouped[ev.playerIdx] = [];
    grouped[ev.playerIdx].push(ev);
  });
  cards.forEach(({ card, canvas, playerIdx }) => {
    let list = grouped[playerIdx] || [];
    const lastEv = list.length ? list[list.length - 1] : null;
    const lastSwap = lastEv && typeof lastEv.courtSideSwapped === "boolean" ? lastEv.courtSideSwapped : null;
    if (lastSwap !== null) {
      list = list.filter(ev => ev && ev.courtSideSwapped === lastSwap);
    }
    const farFlag = isFarView;
    drawServeTrajectoryCanvas(canvas, card, list, {
      scope: analysisScope,
      isFarServe: farFlag,
      onImagesLoad: () => renderServeTrajectoryAnalysis()
    });
  });
}
function renderAggregatedTable() {
  if (!elAggTableBody) return;
  const { table, thead } = getAggTableElements();
  ensureAggTableHeadCache(thead);
  renderAnalysisTeamFilter();
  renderAnalysisSummarySetFilter();
  const analysisScope = getAnalysisTeamScope();
  const playedSets = getSummarySetNumbers();
  const summaryColCount = 26 + playedSets.length;
  const showBothTeams =
    state.useOpponentTeam &&
    analysisTeamFilterState.teams.size === 0 &&
    aggTableView.mode === "summary";
  if (table) {
    table.classList.toggle("agg-table--double", showBothTeams);
  }
  const summaryAll = computePointsSummary(null, { teamScope: analysisScope });
  if (aggTableView.mode === "skill" && aggTableView.skillId) {
    renderAggSkillDetailTable(summaryAll);
    if (elAggSummaryExtraBody) elAggSummaryExtraBody.innerHTML = "";
    return;
  }
  if (aggTableView.mode === "player" && aggTableView.playerIdx !== null) {
    renderAggPlayerDetailTable(summaryAll);
    if (elAggSummaryExtraBody) elAggSummaryExtraBody.innerHTML = "";
    return;
  }
  if (thead) {
    renderAggSummaryHeader(thead, playedSets);
    bindSetStartHeaderClicks(thead);
    aggTableHeadCache = thead.innerHTML;
  }
  elAggTableBody.innerHTML = "";
  bindSetStartBodyHeaderClicks();
  const computeTeamTotalsForEvents = (events, scope) => {
    const totalsBySkill = {
      serve: emptyCounts(),
      pass: emptyCounts(),
      attack: emptyCounts(),
      block: emptyCounts(),
      defense: emptyCounts()
    };
    (events || []).forEach(ev => {
      if (!ev || ev.skillId === "manual" || ev.actionType === "timeout" || ev.actionType === "substitution") {
        return;
      }
      const bucket = totalsBySkill[ev.skillId];
      if (!bucket || !ev.code) return;
      bucket[ev.code] = (bucket[ev.code] || 0) + 1;
    });
    const playerPoints = computePlayerPointsMap(events, scope);
    const playerErrors = computePlayerErrorsMap(events);
    let totalFor = 0;
    let totalAgainst = 0;
    Object.values(playerPoints || {}).forEach(points => {
      totalFor += points.for || 0;
      totalAgainst += points.against || 0;
    });
    let totalErrors = 0;
    Object.values(playerErrors || {}).forEach(val => {
      totalErrors += val || 0;
    });
    return { totalsBySkill, totalFor, totalAgainst, totalErrors };
  };
  const renderSummaryExtraTable = (scopes) => {
    if (!elAggSummaryExtraBody) return;
    elAggSummaryExtraBody.innerHTML = "";
    const buildRow = (cells, { isHeader = false } = {}) => {
      const tr = document.createElement("tr");
      cells.forEach(cell => {
        const el = document.createElement(isHeader ? "th" : "td");
        el.textContent = cell.text;
        if (cell.colspan) el.setAttribute("colspan", cell.colspan);
        if (cell.className) el.className = cell.className;
        tr.appendChild(el);
      });
      elAggSummaryExtraBody.appendChild(tr);
    };
    const positiveReceiveCodes = new Set(["#", "+"]);
    const tableScopes = Array.isArray(scopes) && scopes.length ? scopes : [];
    tableScopes.forEach((scope, idx) => {
      const scopeEvents = (state.events || []).filter(
        ev => matchesTeamFilter(ev, new Set([scope])) && matchesSummarySetFilter(ev)
      );
      const teamName = getTeamNameForScope(scope);
      if (idx > 0) {
        buildRow([{ text: "", colspan: 14 }]);
      }
      buildRow([{ text: teamName, colspan: 14 }], { isHeader: true });
      buildRow(
        [
          { text: "Cambio palla", colspan: 3 },
          { text: "Attacchi su ricezione positiva", colspan: 5 },
          { text: "Attacchi su ricezione non positiva", colspan: 6 }
        ],
        { isHeader: true }
      );
      buildRow(
        [
          { text: "Ricezione" },
          { text: "CP punti" },
          { text: "%" },
          { text: "Err" },
          { text: "Mur" },
          { text: "Pt" },
          { text: "Pt%" },
          { text: "Tot" },
          { text: "Err" },
          { text: "Mur" },
          { text: "Pt" },
          { text: "Pt%" },
          { text: "Tot" },
          { text: "" }
        ],
        { isHeader: true }
      );
      const receiveEvents = scopeEvents.filter(ev => ev && ev.skillId === "pass");
      const receiveCount = receiveEvents.length;
      const sideoutAttacks = scopeEvents.filter(ev => {
        if (!ev || ev.skillId !== "attack") return false;
        if (ev.attackBp === false) return true;
        if (ev.attackBp == null && ev.receiveEvaluation) return true;
        return false;
      });
      const cpPoints = sideoutAttacks.filter(ev => ev.code === "#").length;
      const posReceiveAttacks = sideoutAttacks.filter(ev => positiveReceiveCodes.has(ev.receiveEvaluation));
      const nonPosReceiveAttacks = sideoutAttacks.filter(
        ev => !positiveReceiveCodes.has(ev.receiveEvaluation)
      );
      const posSummary = computeAttackSplitSummary(posReceiveAttacks);
      const nonPosSummary = computeAttackSplitSummary(nonPosReceiveAttacks);
      buildRow([
        { text: receiveCount },
        { text: cpPoints },
        { text: formatPercentValueSafe(cpPoints, receiveCount) },
        { text: posSummary.err },
        { text: posSummary.mur },
        { text: posSummary.pt },
        { text: formatPercentValueSafe(posSummary.pt, posSummary.tot) },
        { text: posSummary.tot },
        { text: nonPosSummary.err },
        { text: nonPosSummary.mur },
        { text: nonPosSummary.pt },
        { text: formatPercentValueSafe(nonPosSummary.pt, nonPosSummary.tot) },
        { text: nonPosSummary.tot },
        { text: "-" }
      ]);
      buildRow([{ text: "", colspan: 14 }]);
      buildRow(
        [
          { text: "Break Point", colspan: 3 },
          { text: "Contrattacchi", colspan: 5 },
          { text: "Differenza rotazione", colspan: 6 }
        ],
        { isHeader: true }
      );
      buildRow(
        [
          { text: "Battuta" },
          { text: "BP punti" },
          { text: "%" },
          { text: "Err" },
          { text: "Mur" },
          { text: "Pt" },
          { text: "Pt%" },
          { text: "Tot" },
          { text: "1" },
          { text: "2" },
          { text: "3" },
          { text: "4" },
          { text: "5" },
          { text: "6" }
        ],
        { isHeader: true }
      );
      const serveEvents = scopeEvents.filter(ev => ev && ev.skillId === "serve");
      const serveCount = serveEvents.length;
      const bpPointEvents = scopeEvents.filter(ev => {
        if (!ev) return false;
        const direction = getPointDirectionFor(scope, ev);
        if (direction !== "for") return false;
        if (ev.skillId === "serve" || ev.skillId === "block") return true;
        return ev.skillId === "attack" && ev.attackBp === true;
      });
      const bpPoints = bpPointEvents.reduce((sum, ev) => sum + (typeof ev.value === "number" ? ev.value : 1), 0);
      const counterAttacks = scopeEvents.filter(ev => ev && ev.skillId === "attack" && ev.attackBp === true);
      const counterSummary = computeAttackSplitSummary(counterAttacks);
      const rotationDeltas = computeRotationDeltasForEvents(scopeEvents, scope);
      buildRow([
        { text: serveCount },
        { text: bpPoints },
        { text: formatPercentValueSafe(bpPoints, serveCount) },
        { text: counterSummary.err },
        { text: counterSummary.mur },
        { text: counterSummary.pt },
        { text: formatPercentValueSafe(counterSummary.pt, counterSummary.tot) },
        { text: counterSummary.tot },
        {
          text: rotationDeltas[0] || 0,
          className: "rotation-delta-cell " + (rotationDeltas[0] > 0 ? "pos" : rotationDeltas[0] < 0 ? "neg" : "zero")
        },
        {
          text: rotationDeltas[1] || 0,
          className: "rotation-delta-cell " + (rotationDeltas[1] > 0 ? "pos" : rotationDeltas[1] < 0 ? "neg" : "zero")
        },
        {
          text: rotationDeltas[2] || 0,
          className: "rotation-delta-cell " + (rotationDeltas[2] > 0 ? "pos" : rotationDeltas[2] < 0 ? "neg" : "zero")
        },
        {
          text: rotationDeltas[3] || 0,
          className: "rotation-delta-cell " + (rotationDeltas[3] > 0 ? "pos" : rotationDeltas[3] < 0 ? "neg" : "zero")
        },
        {
          text: rotationDeltas[4] || 0,
          className: "rotation-delta-cell " + (rotationDeltas[4] > 0 ? "pos" : rotationDeltas[4] < 0 ? "neg" : "zero")
        },
        {
          text: rotationDeltas[5] || 0,
          className: "rotation-delta-cell " + (rotationDeltas[5] > 0 ? "pos" : rotationDeltas[5] < 0 ? "neg" : "zero")
        }
      ]);
    });
  };
  const renderAggSummaryForScope = (scope, { showHeader = false } = {}) => {
    const analysisPlayers = getPlayersForScope(scope);
    const analysisNumbers = getPlayerNumbersForScope(scope);
    const filteredEvents = (state.events || []).filter(ev => matchesTeamFilter(ev, new Set([scope])));
    const summaryEvents = filteredEvents.filter(ev => matchesSummarySetFilter(ev));
    if (showHeader) {
      const headerRow = document.createElement("tr");
      headerRow.className = "rotation-row total";
      const headerCell = document.createElement("td");
      headerCell.colSpan = summaryColCount;
      headerCell.textContent = getTeamNameForScope(scope);
      headerRow.appendChild(headerCell);
      elAggTableBody.appendChild(headerRow);
      const columnsRows = buildAggBodyHeaderRows(thead);
      columnsRows.forEach(row => {
        row.dataset.teamScope = scope;
        elAggTableBody.appendChild(row);
        const skillHeaders = row.querySelectorAll(".skill-col");
        skillHeaders.forEach(cell => {
          const skillId = getSkillIdFromHeader(cell);
          if (!skillId) return;
          cell.classList.add("agg-skill-header");
          cell.title = "Dettagli " + getSkillLabel(skillId);
          cell.addEventListener("click", () => {
            if (showBothTeams) {
              analysisTeamFilterState.teams = new Set([scope]);
            }
            aggTableView = { mode: "skill", skillId, playerIdx: null };
            renderAggregatedTable();
          });
        });
      });
    }
    if (!analysisPlayers || analysisPlayers.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = summaryColCount;
      td.textContent = "Aggiungi giocatrici per vedere il riepilogo.";
      tr.appendChild(td);
      elAggTableBody.appendChild(tr);
      return;
    }
    const statsByPlayer = {};
    summaryEvents.forEach(ev => {
      if (!ev || ev.skillId === "manual" || ev.actionType === "timeout" || ev.actionType === "substitution") {
        return;
      }
      if (typeof ev.playerIdx !== "number" || !analysisPlayers[ev.playerIdx]) return;
      if (!statsByPlayer[ev.playerIdx]) {
        statsByPlayer[ev.playerIdx] = {};
      }
      if (!statsByPlayer[ev.playerIdx][ev.skillId]) {
        statsByPlayer[ev.playerIdx][ev.skillId] = {
          "#": 0,
          "+": 0,
          "!": 0,
          "-": 0,
          "=": 0,
          "/": 0
        };
      }
      statsByPlayer[ev.playerIdx][ev.skillId][ev.code] =
        (statsByPlayer[ev.playerIdx][ev.skillId][ev.code] || 0) + 1;
    });
    if (!showBothTeams) {
      analysisStatsCache = statsByPlayer;
      analysisStatsScope = scope;
    }
    const playerPoints = computePlayerPointsMap(summaryEvents, scope);
    const playerErrors = computePlayerErrorsMap(summaryEvents);
    const totalsBySkill = {
      serve: emptyCounts(),
      pass: emptyCounts(),
      attack: emptyCounts(),
      block: emptyCounts(),
      defense: emptyCounts()
    };
    let totalErrors = 0;
    const sortedEntries =
      scope === "opponent" ? getSortedPlayerEntriesForScope(scope) : getSortedPlayerEntries();
    const startInfoList = buildSetStartInfoList(playedSets, scope);
    sortedEntries.forEach(({ name, idx }) => {
      const serveCounts = normalizeCounts(statsByPlayer[idx] && statsByPlayer[idx].serve);
      const passCounts = normalizeCounts(statsByPlayer[idx] && statsByPlayer[idx].pass);
      const attackCounts = normalizeCounts(statsByPlayer[idx] && statsByPlayer[idx].attack);
      const blockCounts = normalizeCounts(statsByPlayer[idx] && statsByPlayer[idx].block);
      const defenseCounts = normalizeCounts(statsByPlayer[idx] && statsByPlayer[idx].defense);

      const serveMetrics = computeMetrics(serveCounts, "serve");
      const passMetrics = computeMetrics(passCounts, "pass");
      const attackMetrics = computeMetrics(attackCounts, "attack");
      const defenseMetrics = computeMetrics(defenseCounts, "defense");

      mergeCounts(totalsBySkill.serve, serveCounts);
      mergeCounts(totalsBySkill.pass, passCounts);
      mergeCounts(totalsBySkill.attack, attackCounts);
      mergeCounts(totalsBySkill.block, blockCounts);
      mergeCounts(totalsBySkill.defense, defenseCounts);

      const points = playerPoints[idx] || { for: 0, against: 0 };
      const personalErrors = playerErrors[idx] || 0;
      totalErrors += personalErrors;
      const attackTotal = totalFromCounts(attackCounts);
      const row = document.createElement("tr");
      const startCells = startInfoList.map(info => {
        const key = makePlayerNameKey(name);
        const pos = info.positions ? info.positions.get(key) : null;
        const hasPos = !!pos;
        const isSubIn = !hasPos && info.subsIn && info.subsIn.has(key);
        const text = hasPos ? String(pos) : isSubIn ? "in" : "-";
        return {
          text,
          isSetter: hasPos && info.setterPos === pos,
          isStarter: hasPos
        };
      });
      const cells = [
        {
          text:
            scope === "opponent"
              ? formatNameWithNumberFor(name, analysisNumbers)
              : formatNameWithNumber(name),
          isPlayer: true,
          playerIdx: idx
        },
        ...startCells,
        { text: points.for || 0 },
        { text: points.against || 0 },
        { text: formatDelta((points.for || 0) - (points.against || 0)) },
        { text: personalErrors || 0 },

        { text: totalFromCounts(serveCounts), className: "skill-col skill-serve" },
        { text: serveCounts["="] || 0, className: "skill-col skill-serve" },
        { text: serveCounts["#"] || 0, className: "skill-col skill-serve" },
        { text: serveMetrics.eff === null ? "-" : formatPercent(serveMetrics.eff), className: "skill-col skill-serve" },
        { text: serveMetrics.pos === null ? "-" : formatPercent(serveMetrics.pos), className: "skill-col skill-serve" },

        { text: totalFromCounts(passCounts), className: "skill-col skill-pass" },
        { text: passMetrics.negativeCount || 0, className: "skill-col skill-pass" },
        { text: passMetrics.pos === null ? "-" : formatPercent(passMetrics.pos), className: "skill-col skill-pass" },
        { text: passMetrics.prf === null ? "-" : formatPercent(passMetrics.prf), className: "skill-col skill-pass" },
        { text: passMetrics.eff === null ? "-" : formatPercent(passMetrics.eff), className: "skill-col skill-pass" },

        { text: attackTotal, className: "skill-col skill-attack" },
        { text: attackCounts["="] || 0, className: "skill-col skill-attack" },
        { text: attackCounts["/"] || 0, className: "skill-col skill-attack" },
        { text: attackCounts["#"] || 0, className: "skill-col skill-attack" },
        { text: formatPercentValue(attackCounts["#"] || 0, attackTotal), className: "skill-col skill-attack" },
        { text: attackMetrics.eff === null ? "-" : formatPercent(attackMetrics.eff), className: "skill-col skill-attack" },

        { text: totalFromCounts(blockCounts), className: "skill-col skill-block" },
        { text: (blockCounts["#"] || 0) + (blockCounts["+"] || 0), className: "skill-col skill-block" },

        { text: totalFromCounts(defenseCounts), className: "skill-col skill-defense" },
        { text: defenseMetrics.negativeCount || 0, className: "skill-col skill-defense" },
        { text: defenseMetrics.eff === null ? "-" : formatPercent(defenseMetrics.eff), className: "skill-col skill-defense" }
      ];
      cells.forEach(cell => {
        const td = document.createElement("td");
        td.textContent = cell.text;
        if (cell.isStarter) td.classList.add("formation-starter-cell");
        if (cell.isSetter) td.classList.add("formation-setter-cell");
        if (cell.className) td.className = cell.className;
        if (cell.isPlayer) {
          td.classList.add("agg-player-cell");
          td.title = "Dettagli giocatrice";
          td.addEventListener("click", () => {
            if (showBothTeams) {
              analysisTeamFilterState.teams = new Set([scope]);
            }
            const prefs = ensurePlayerAnalysisState();
            prefs.playerIdx = cell.playerIdx;
            saveState();
            setActiveAggTab("player");
            renderPlayerAnalysis();
          });
        }
        row.appendChild(td);
      });
      elAggTableBody.appendChild(row);
    });
    const teamTotals = computeTeamTotalsForEvents(summaryEvents, scope);
    const serveTotalsMetrics = computeMetrics(totalsBySkill.serve, "serve");
    const passTotalsMetrics = computeMetrics(totalsBySkill.pass, "pass");
    const attackTotalsMetrics = computeMetrics(totalsBySkill.attack, "attack");
    const blockTotalsMetrics = computeMetrics(totalsBySkill.block, "block");
    const defenseTotalsMetrics = computeMetrics(totalsBySkill.defense, "defense");
    const teamAttackTotal = totalFromCounts(totalsBySkill.attack);
    const totalsRow = document.createElement("tr");
    totalsRow.className = "rotation-row total";
    const startTotalsCells = playedSets.map(() => ({ text: "-" }));
    const totalCells = [
      { text: "Totale squadra" },
      ...startTotalsCells,
      { text: teamTotals.totalFor || 0 },
      { text: teamTotals.totalAgainst || 0 },
      { text: formatDelta((teamTotals.totalFor || 0) - (teamTotals.totalAgainst || 0)) },
      { text: totalErrors || 0 },

      { text: totalFromCounts(totalsBySkill.serve), className: "skill-col skill-serve" },
      { text: totalsBySkill.serve["="] || 0, className: "skill-col skill-serve" },
      { text: totalsBySkill.serve["#"] || 0, className: "skill-col skill-serve" },
      { text: serveTotalsMetrics.eff === null ? "-" : formatPercent(serveTotalsMetrics.eff), className: "skill-col skill-serve" },
      { text: serveTotalsMetrics.pos === null ? "-" : formatPercent(serveTotalsMetrics.pos), className: "skill-col skill-serve" },

      { text: totalFromCounts(totalsBySkill.pass), className: "skill-col skill-pass" },
      { text: passTotalsMetrics.negativeCount || 0, className: "skill-col skill-pass" },
      { text: passTotalsMetrics.pos === null ? "-" : formatPercent(passTotalsMetrics.pos), className: "skill-col skill-pass" },
      { text: passTotalsMetrics.prf === null ? "-" : formatPercent(passTotalsMetrics.prf), className: "skill-col skill-pass" },
      { text: passTotalsMetrics.eff === null ? "-" : formatPercent(passTotalsMetrics.eff), className: "skill-col skill-pass" },

      { text: teamAttackTotal, className: "skill-col skill-attack" },
      { text: totalsBySkill.attack["="] || 0, className: "skill-col skill-attack" },
      { text: totalsBySkill.attack["/"] || 0, className: "skill-col skill-attack" },
      { text: totalsBySkill.attack["#"] || 0, className: "skill-col skill-attack" },
      { text: formatPercentValue(totalsBySkill.attack["#"] || 0, teamAttackTotal), className: "skill-col skill-attack" },
      { text: attackTotalsMetrics.eff === null ? "-" : formatPercent(attackTotalsMetrics.eff), className: "skill-col skill-attack" },

      { text: totalFromCounts(totalsBySkill.block), className: "skill-col skill-block" },
      { text: (totalsBySkill.block["#"] || 0) + (totalsBySkill.block["+"] || 0), className: "skill-col skill-block" },

      { text: totalFromCounts(totalsBySkill.defense), className: "skill-col skill-defense" },
      { text: defenseTotalsMetrics.negativeCount || 0, className: "skill-col skill-defense" },
      { text: defenseTotalsMetrics.eff === null ? "-" : formatPercent(defenseTotalsMetrics.eff), className: "skill-col skill-defense" }
    ];
    totalCells.forEach(cell => {
      const td = document.createElement("td");
      td.textContent = cell.text;
      if (cell.className) td.className = cell.className;
      totalsRow.appendChild(td);
    });
    elAggTableBody.appendChild(totalsRow);
    playedSets.forEach(setNum => {
      const setEvents = summaryEvents.filter(ev => normalizeSetNumber(ev.set) === setNum);
      const setTotals = computeTeamTotalsForEvents(setEvents, scope);
      const setServeMetrics = computeMetrics(setTotals.totalsBySkill.serve, "serve");
      const setPassMetrics = computeMetrics(setTotals.totalsBySkill.pass, "pass");
      const setAttackMetrics = computeMetrics(setTotals.totalsBySkill.attack, "attack");
      const setDefenseMetrics = computeMetrics(setTotals.totalsBySkill.defense, "defense");
      const setAttackTotal = totalFromCounts(setTotals.totalsBySkill.attack);
      const setRow = document.createElement("tr");
      setRow.className = "rotation-row";
      const setStartCells = playedSets.map(() => ({ text: "-" }));
      const setCells = [
        { text: "Set " + setNum },
        ...setStartCells,
        { text: setTotals.totalFor || 0 },
        { text: setTotals.totalAgainst || 0 },
        { text: formatDelta((setTotals.totalFor || 0) - (setTotals.totalAgainst || 0)) },
        { text: setTotals.totalErrors || 0 },

        { text: totalFromCounts(setTotals.totalsBySkill.serve), className: "skill-col skill-serve" },
        { text: setTotals.totalsBySkill.serve["="] || 0, className: "skill-col skill-serve" },
        { text: setTotals.totalsBySkill.serve["#"] || 0, className: "skill-col skill-serve" },
        { text: setServeMetrics.eff === null ? "-" : formatPercent(setServeMetrics.eff), className: "skill-col skill-serve" },
        { text: setServeMetrics.pos === null ? "-" : formatPercent(setServeMetrics.pos), className: "skill-col skill-serve" },

        { text: totalFromCounts(setTotals.totalsBySkill.pass), className: "skill-col skill-pass" },
        { text: setPassMetrics.negativeCount || 0, className: "skill-col skill-pass" },
        { text: setPassMetrics.pos === null ? "-" : formatPercent(setPassMetrics.pos), className: "skill-col skill-pass" },
        { text: setPassMetrics.prf === null ? "-" : formatPercent(setPassMetrics.prf), className: "skill-col skill-pass" },
        { text: setPassMetrics.eff === null ? "-" : formatPercent(setPassMetrics.eff), className: "skill-col skill-pass" },

        { text: setAttackTotal, className: "skill-col skill-attack" },
        { text: setTotals.totalsBySkill.attack["="] || 0, className: "skill-col skill-attack" },
        { text: setTotals.totalsBySkill.attack["/"] || 0, className: "skill-col skill-attack" },
        { text: setTotals.totalsBySkill.attack["#"] || 0, className: "skill-col skill-attack" },
        { text: formatPercentValue(setTotals.totalsBySkill.attack["#"] || 0, setAttackTotal), className: "skill-col skill-attack" },
        { text: setAttackMetrics.eff === null ? "-" : formatPercent(setAttackMetrics.eff), className: "skill-col skill-attack" },

        { text: totalFromCounts(setTotals.totalsBySkill.block), className: "skill-col skill-block" },
        {
          text:
            (setTotals.totalsBySkill.block["#"] || 0) + (setTotals.totalsBySkill.block["+"] || 0),
          className: "skill-col skill-block"
        },

        { text: totalFromCounts(setTotals.totalsBySkill.defense), className: "skill-col skill-defense" },
        { text: setDefenseMetrics.negativeCount || 0, className: "skill-col skill-defense" },
        { text: setDefenseMetrics.eff === null ? "-" : formatPercent(setDefenseMetrics.eff), className: "skill-col skill-defense" }
      ];
      setCells.forEach(cell => {
        const td = document.createElement("td");
        td.textContent = cell.text;
        if (cell.className) td.className = cell.className;
        setRow.appendChild(td);
      });
      elAggTableBody.appendChild(setRow);
    });
  };
  if (showBothTeams) {
    renderAggSummaryForScope("our", { showHeader: true });
    renderAggSummaryForScope("opponent", { showHeader: true });
    renderSummaryExtraTable(["our", "opponent"]);
    renderScoreAndRotations(summaryAll, "our");
    renderSecondTable();
    renderTrajectoryAnalysis();
    renderServeTrajectoryAnalysis();
    bindAggSummaryInteractions(thead);
    applyAggColumnsVisibility();
    return;
  }
  const analysisPlayers = getPlayersForScope(analysisScope);
  if (!analysisPlayers || analysisPlayers.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = summaryColCount;
    td.textContent = "Aggiungi giocatrici per vedere il riepilogo.";
    tr.appendChild(td);
    elAggTableBody.appendChild(tr);
    renderScoreAndRotations(summaryAll, analysisScope);
    renderSecondTable();
    renderTrajectoryAnalysis();
    renderServeTrajectoryAnalysis();
    applyAggColumnsVisibility();
    return;
  }
  renderAggSummaryForScope(analysisScope);
  renderSummaryExtraTable([analysisScope]);
  renderScoreAndRotations(summaryAll, analysisScope);
  renderSecondTable();
  renderTrajectoryAnalysis();
  renderServeTrajectoryAnalysis();
  bindAggSummaryInteractions(thead);
  applyAggColumnsVisibility();
}
function syncSecondFilterState() {
  const els = getSecondFilterElements();
  if (!els) return;
  secondFilterState.setters = new Set(getCheckedValues(els.setters, { asNumber: true }));
  secondFilterState.players = new Set(getCheckedValues(els.players, { asNumber: true }));
  secondFilterState.codes = new Set(getCheckedValues(els.codes));
  secondFilterState.zones = new Set(getCheckedValues(els.zones, { asNumber: true }));
  secondFilterState.setTypes = new Set(getCheckedValues(els.setTypes));
  secondFilterState.bases = new Set(getCheckedValues(els.bases));
  secondFilterState.phases = new Set(getCheckedValues(els.phases));
  secondFilterState.receiveEvaluations = new Set(getCheckedValues(els.receiveEvals));
  secondFilterState.receiveZones = new Set(getCheckedValues(els.receiveZones, { asNumber: true }));
  secondFilterState.sets = new Set(getCheckedValues(els.sets, { asNumber: true }));
  secondFilterState.prevSkill = (els.prev && els.prev.value) || "any";
}
function handleSecondFilterChange() {
  syncSecondFilterState();
  renderSecondTable();
}
function resetSecondFilters() {
  secondFilterState.setters.clear();
  secondFilterState.players.clear();
  secondFilterState.codes.clear();
  secondFilterState.zones.clear();
  secondFilterState.setTypes.clear();
  secondFilterState.bases.clear();
  secondFilterState.phases.clear();
  secondFilterState.receiveEvaluations.clear();
  secondFilterState.receiveZones.clear();
  secondFilterState.sets.clear();
  secondFilterState.prevSkill = "any";
  const els = getSecondFilterElements();
  if (els && els.prev) els.prev.value = "any";
  renderSecondFilters();
  renderSecondTable();
}
function renderSecondFilters() {
  const els = getSecondFilterElements();
  if (!els) return;
  renderAnalysisTeamFilter();
  const events = filterEventsByAnalysisTeam(state.events || []);
  const attackEvents = events.filter(ev => ev && ev.skillId === "attack");
  const analysisScope = getAnalysisTeamScope();
  const analysisPlayers = getPlayersForScope(analysisScope);
  const analysisNumbers = getPlayerNumbersForScope(analysisScope);
  const setterLabels = new Map();
  attackEvents.forEach(ev => {
    const setterIdx = getSetterFromEvent(ev);
    if (typeof setterIdx !== "number") return;
    const label =
      (analysisScope === "opponent"
        ? formatNameWithNumberFor(ev.setterName || analysisPlayers[setterIdx], analysisNumbers)
        : formatNameWithNumber(ev.setterName || analysisPlayers[setterIdx])) ||
      ev.setterName ||
      analysisPlayers[setterIdx] ||
      "Alzatrice " + (setterIdx + 1);
    setterLabels.set(setterIdx, label);
  });
  const setterOptsRaw = Array.from(setterLabels.entries()).map(([idx, label]) => ({
    value: idx,
    label
  }));
  const setterOpts = sortPlayerOptionsByNumberForScope(setterOptsRaw, analysisScope);
  const playersOptsRaw = buildUniqueOptions(attackEvents.map(ev => ev.playerIdx), {
    asNumber: true,
    labelFn: idx => {
      const name = analysisPlayers[idx];
      if (!name) return "—";
      return analysisScope === "opponent"
        ? formatNameWithNumberFor(name, analysisNumbers)
        : formatNameWithNumber(name);
    }
  });
  const playersOpts = sortPlayerOptionsByNumberForScope(playersOptsRaw, analysisScope);
  const setOpts = buildUniqueOptions(attackEvents.map(ev => normalizeSetNumber(ev.set)), {
    asNumber: true,
    labelFn: val => "Set " + val
  });
  const codesOpts = filterNormalEvalOptions(
    buildUniqueOptions(attackEvents.map(ev => ev.code), { labelFn: val => val })
  );
  const zonesOpts = buildUniqueOptions(
    attackEvents.map(ev => {
      const traj = ev.attackDirection || ev.attackTrajectory || {};
      return ev.attackStartZone || traj.startZone || ev.zone || ev.playerPosition || null;
    }),
    { asNumber: true, labelFn: val => "Z" + val }
  );
  const setTypeOpts = buildUniqueOptions(
    attackEvents.map(ev =>
      normalizeSetTypeValue(ev.setType || (ev.combination && ev.combination.set_type) || (ev.combination && ev.combination.setType))
    ),
    { labelFn: val => getOptionLabel(DEFAULT_SET_TYPE_OPTIONS, val) }
  );
  const baseOpts = buildUniqueOptions(
    attackEvents.map(ev => normalizeBaseValue(ev.base)),
    { labelFn: val => getOptionLabel(DEFAULT_BASE_OPTIONS, val) }
  );
  const phaseOpts = buildUniqueOptions(attackEvents.map(ev => getEventPhaseValue(ev)), {
    labelFn: val => getOptionLabel(DEFAULT_PHASE_OPTIONS, val)
  });
  const recvEvalOpts = buildUniqueOptions(
    attackEvents.map(ev => normalizeEvalCode(ev.receiveEvaluation)),
    { labelFn: val => val }
  );
  const recvZoneOpts = buildUniqueOptions(
    attackEvents.map(ev => normalizeReceiveZone(ev.receivePosition || ev.receiveZone)),
    { asNumber: true, labelFn: val => "Z" + val }
  );

  secondFilterState.setters = new Set(
    [...secondFilterState.setters].filter(idx => setterOpts.some(p => Number(p.value) === idx))
  );
  secondFilterState.players = new Set(
    [...secondFilterState.players].filter(idx => playersOpts.some(p => Number(p.value) === idx))
  );
  secondFilterState.codes = new Set(
    [...secondFilterState.codes].filter(val => codesOpts.some(o => o.value === val))
  );
  secondFilterState.zones = new Set(
    [...secondFilterState.zones].filter(val => zonesOpts.some(o => Number(o.value) === val))
  );
  secondFilterState.setTypes = new Set(
    [...secondFilterState.setTypes].filter(val => setTypeOpts.some(o => o.value === val))
  );
  secondFilterState.bases = new Set([...secondFilterState.bases].filter(val => baseOpts.some(o => o.value === val)));
  secondFilterState.phases = new Set([...secondFilterState.phases].filter(val => phaseOpts.some(o => o.value === val)));
  secondFilterState.receiveEvaluations = new Set(
    [...secondFilterState.receiveEvaluations].filter(val => recvEvalOpts.some(o => o.value === val))
  );
  secondFilterState.receiveZones = new Set(
    [...secondFilterState.receiveZones].filter(val => recvZoneOpts.some(o => Number(o.value) === val))
  );
  secondFilterState.sets = new Set([...secondFilterState.sets].filter(val => setOpts.some(o => Number(o.value) === val)));
  if (!PREVIOUS_SKILL_OPTIONS.some(opt => opt.value === secondFilterState.prevSkill)) {
    secondFilterState.prevSkill = "any";
  }

  const visibleFilters = [];
  visibleFilters.push(
    renderDynamicFilter(els.setters, setterOpts, secondFilterState.setters, {
      asNumber: true,
      onChange: handleSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(els.players, playersOpts, secondFilterState.players, {
      asNumber: true,
      onChange: handleSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(els.sets, setOpts, secondFilterState.sets, {
      asNumber: true,
      onChange: handleSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(els.setTypes, setTypeOpts, secondFilterState.setTypes, {
      onChange: handleSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(els.bases, baseOpts, secondFilterState.bases, {
      onChange: handleSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(els.phases, phaseOpts, secondFilterState.phases, {
      onChange: handleSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(els.receiveEvals, recvEvalOpts, secondFilterState.receiveEvaluations, {
      onChange: handleSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(els.receiveZones, recvZoneOpts, secondFilterState.receiveZones, {
      asNumber: true,
      onChange: handleSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(els.codes, codesOpts, secondFilterState.codes, {
      onChange: handleSecondFilterChange
    })
  );
  visibleFilters.push(
    renderDynamicFilter(els.zones, zonesOpts, secondFilterState.zones, {
      asNumber: true,
      onChange: handleSecondFilterChange
    })
  );
  toggleFilterVisibility(els.prev, attackEvents.length > 0);
  toggleFilterVisibility(els.reset, visibleFilters.some(Boolean));
  if (els.prev) {
    els.prev.value = secondFilterState.prevSkill || "any";
    if (!els.prev._secondPrevBound) {
      els.prev.addEventListener("change", handleSecondFilterChange);
      els.prev._secondPrevBound = true;
    }
  }
  if (els.reset && !els.reset._secondResetBound) {
    els.reset.addEventListener("click", resetSecondFilters);
    els.reset._secondResetBound = true;
  }
}
function getFilteredSecondEvents() {
  const events = (state.events || []).filter(ev => ev && ev.skillId === "attack");
  return events.filter(ev => {
    const traj = ev.attackDirection || ev.attackTrajectory || {};
    const startZone = ev.attackStartZone || traj.startZone || ev.zone || ev.playerPosition || null;
    if (!matchesTeamFilter(ev, analysisTeamFilterState.teams)) return false;
    if (!matchesAdvancedFilters(ev, secondFilterState, { includeSetter: true })) return false;
    if (secondFilterState.setters.size) {
      const setterIdx = getSetterFromEvent(ev);
      if (setterIdx === null || !secondFilterState.setters.has(setterIdx)) return false;
    }
    if (secondFilterState.players.size && !secondFilterState.players.has(ev.playerIdx)) return false;
    if (secondFilterState.sets.size && !secondFilterState.sets.has(ev.set)) return false;
    if (secondFilterState.codes.size && !secondFilterState.codes.has(ev.code)) return false;
    if (secondFilterState.zones.size && !secondFilterState.zones.has(startZone)) return false;
    return true;
  });
}
function getFilteredAttacksForSecondDistribution() {
  return getFilteredSecondEvents().filter(ev => {
    const setType = normalizeSetTypeValue(
      ev.setType || (ev.combination && ev.combination.set_type) || (ev.combination && ev.combination.setType)
    );
    return !(setType && setType.toLowerCase() === "damp");
  });
}
function renderSecondTable() {
  if (!elAggSecondBody) return;
  elAggSecondBody.innerHTML = "";
  renderSecondFilters();
  const analysisScope = getAnalysisTeamScope();
  const analysisPlayers = getPlayersForScope(analysisScope);
  const analysisNumbers = getPlayerNumbersForScope(analysisScope);
  if (!analysisPlayers || analysisPlayers.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 11;
    td.textContent = "Aggiungi giocatrici per vedere il riepilogo.";
    tr.appendChild(td);
    elAggSecondBody.appendChild(tr);
    renderSecondDistribution();
    return;
  }
  const totals = emptyCounts();
  const rows = [];
  const countsByPlayer = new Map();
  const secondEvents = (state.events || []).filter(
    ev => ev && ev.skillId === "second" && matchesTeamFilter(ev, analysisTeamFilterState.teams)
  );
  secondEvents.forEach(ev => {
    const code = normalizeEvalCode(ev.code || ev.evaluation);
    if (!code) return;
    const playerIdx = typeof ev.playerIdx === "number" ? ev.playerIdx : null;
    const key = playerIdx !== null ? "idx-" + playerIdx : ev.playerName || String(ev.playerIdx || "");
    if (!countsByPlayer.has(key)) {
      const name = playerIdx !== null && analysisPlayers[playerIdx]
        ? analysisScope === "opponent"
          ? formatNameWithNumberFor(analysisPlayers[playerIdx], analysisNumbers)
          : formatNameWithNumber(analysisPlayers[playerIdx])
        : ev.playerName || "Alzatrice";
      countsByPlayer.set(key, { name, counts: emptyCounts() });
    }
    const bucket = countsByPlayer.get(key);
    bucket.counts[code] = (bucket.counts[code] || 0) + 1;
  });
  countsByPlayer.forEach(bucket => {
    mergeCounts(totals, bucket.counts);
    rows.push({
      name: bucket.name,
      counts: bucket.counts,
      total: totalFromCounts(bucket.counts),
      metrics: computeMetrics(bucket.counts, "second")
    });
  });
  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 11;
    td.textContent = "Registra alzate per vedere il dettaglio.";
    tr.appendChild(td);
    elAggSecondBody.appendChild(tr);
    renderSecondDistribution();
    return;
  }
  rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const cells = [
      { text: row.name },
      { text: row.total, className: "skill-col skill-second" },
      { text: row.counts["#"] || 0, className: "skill-col skill-second" },
      { text: row.counts["+"] || 0, className: "skill-col skill-second" },
      { text: row.counts["!"] || 0, className: "skill-col skill-second" },
      { text: row.counts["-"] || 0, className: "skill-col skill-second" },
      { text: row.counts["="] || 0, className: "skill-col skill-second" },
      { text: row.counts["/"] || 0, className: "skill-col skill-second" },
      { text: row.metrics.pos === null ? "-" : formatPercent(row.metrics.pos), className: "skill-col skill-second" },
      { text: row.metrics.prf === null ? "-" : formatPercent(row.metrics.prf), className: "skill-col skill-second" },
      { text: row.metrics.eff === null ? "-" : formatPercent(row.metrics.eff), className: "skill-col skill-second" }
    ];
    cells.forEach(cell => {
      const td = document.createElement("td");
      td.textContent = cell.text;
      if (cell.className) td.className = cell.className;
      tr.appendChild(td);
    });
    elAggSecondBody.appendChild(tr);
  });
  const totalMetrics = computeMetrics(totals, "second");
  const totalsRow = document.createElement("tr");
  totalsRow.className = "rotation-row total";
  const totalCells = [
    { text: "Totale alzate" },
    { text: totalFromCounts(totals), className: "skill-col skill-second" },
    { text: totals["#"] || 0, className: "skill-col skill-second" },
    { text: totals["+"] || 0, className: "skill-col skill-second" },
    { text: totals["!"] || 0, className: "skill-col skill-second" },
    { text: totals["-"] || 0, className: "skill-col skill-second" },
    { text: totals["="] || 0, className: "skill-col skill-second" },
    { text: totals["/"] || 0, className: "skill-col skill-second" },
    { text: totalMetrics.pos === null ? "-" : formatPercent(totalMetrics.pos), className: "skill-col skill-second" },
    { text: totalMetrics.prf === null ? "-" : formatPercent(totalMetrics.prf), className: "skill-col skill-second" },
    { text: totalMetrics.eff === null ? "-" : formatPercent(totalMetrics.eff), className: "skill-col skill-second" }
  ];
  totalCells.forEach(cell => {
    const td = document.createElement("td");
    td.textContent = cell.text;
    if (cell.className) td.className = cell.className;
    totalsRow.appendChild(td);
  });
  elAggSecondBody.appendChild(totalsRow);
  renderSecondDistribution();
}
function computeAttackDistribution(events = state.events || []) {
  const rotations = {};
  const ensureRot = rot => {
    if (!rotations[rot]) {
      rotations[rot] = {
        zones: {
          1: emptyCounts(),
          2: emptyCounts(),
          3: emptyCounts(),
          4: emptyCounts(),
          5: emptyCounts(),
          6: emptyCounts()
        },
        total: 0
      };
    }
  };
  for (let r = 1; r <= 6; r++) ensureRot(r);
  ensureRot("all");
  (events || []).forEach(ev => {
    if (!ev || ev.skillId !== "attack") return;
    let zone = ev.zone;
    if (zone === undefined || zone === null) {
      zone = getCurrentZoneForPlayer(ev.playerIdx, null, getTeamScopeFromEvent(ev));
    }
    if (!zone || zone < 1 || zone > 6) return;
    const rot = ev.rotation && ev.rotation >= 1 && ev.rotation <= 6 ? ev.rotation : 1;
    ensureRot(rot);
    ensureRot("all");
    [rot, "all"].forEach(key => {
      const bucket = rotations[key];
      bucket.total += 1;
      bucket.zones[zone][ev.code] = (bucket.zones[zone][ev.code] || 0) + 1;
    });
  });
  return rotations;
}
function renderSecondDistribution() {
  if (!elSecondDistribution) return;
  renderDistributionGrid(elSecondDistribution, getFilteredAttacksForSecondDistribution());
}
function buildCsvString() {
  if (!state.events || state.events.length === 0) return "";
  const header = [
    "timestamp",
    "set",
    "rotation",
    "playerIdx",
    "playerName",
    "skillId",
    "code",
    "opponent",
    "category",
    "matchDate",
    "notes"
  ];
  const lines = [];
  lines.push(header.join(";"));
  state.events.forEach(ev => {
    const row = [
      ev.t,
      ev.set,
      ev.rotation || "",
      ev.playerIdx,
      '"' + (ev.playerName || "").replace(/"/g, '""') + '"',
      ev.skillId,
      ev.code,
      '"' + (state.match.opponent || "").replace(/"/g, '""') + '"',
      '"' + (state.match.category || "").replace(/"/g, '""') + '"',
      state.match.date || "",
      '"' + (state.match.notes || "").replace(/"/g, '""') + '"'
    ];
    lines.push(row.join(";"));
  });
  return lines.join("\n");
}
function safeMatchSlug() {
  const datePart = (state.match && state.match.date) || "";
  const opponentSlug = (state.match.opponent || "match").replace(/\s+/g, "_");
  return (datePart ? datePart + "_" : "") + opponentSlug;
}
function downloadCsv(csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "scout_" + safeMatchSlug() + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function exportCsv() {
  const csv = buildCsvString();
  if (!csv) {
    alert("Nessun evento da esportare.");
    return;
  }
  downloadCsv(csv);
}
function copyCsvToClipboard() {
  const csv = buildCsvString();
  if (!csv) {
    alert("Nessun evento da copiare.");
    return;
  }
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    alert("Copia negli appunti non supportata su questo dispositivo.");
    return;
  }
  navigator.clipboard
    .writeText(csv)
    .then(() => alert("CSV copiato negli appunti."))
    .catch(() => alert("Impossibile copiare negli appunti su questo dispositivo."));
}
function loadScriptOnce(url, globalCheck) {
  return new Promise((resolve, reject) => {
    if (globalCheck && globalCheck()) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src="' + url + '"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", e => reject(e));
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = e => reject(e);
    document.head.appendChild(script);
  });
}
async function ensurePdfLibs() {
  try {
    await loadScriptOnce(
      "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
      () => typeof window.html2canvas === "function"
    );
    await loadScriptOnce(
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
      () => window.jspdf && typeof window.jspdf.jsPDF === "function"
    );
    return true;
  } catch (err) {
    logError("pdf-libs", err);
    return false;
  }
}
function prepareAnalysisFiltersForPdf(container) {
  if (!container) return () => {};
  const touched = [];
  const summaries = [];
  const setAttr = (el, name, value) => {
    if (!el) return;
    touched.push({ el, name, prev: el.getAttribute(name) });
    el.setAttribute(name, value);
  };
  const buildSummary = items => {
    const wrap = document.createElement("div");
    wrap.className = "pdf-filter-summary";
    const title = document.createElement("span");
    title.className = "pdf-filter-summary__title";
    title.textContent = "Filtri attivi:";
    wrap.appendChild(title);
    items.forEach(item => {
      const chip = document.createElement("span");
      chip.className = "pdf-filter-chip";
      chip.textContent = item.label + ": " + item.values.join(", ");
      wrap.appendChild(chip);
    });
    return wrap;
  };
  const containers = container.querySelectorAll(".analysis-filters, .trajectory-filters");
  containers.forEach(filterGroup => {
    const items = [];
    const filters = filterGroup.querySelectorAll(".analysis-filter, .trajectory-filter");
    filters.forEach(filter => {
      const labelEl = filter.querySelector(".analysis-filter__label, .trajectory-filter__label");
      const label = labelEl ? labelEl.textContent.trim() : "";
      const values = [];
      const labels = filter.querySelectorAll("label");
      labels.forEach(lbl => {
        const input = lbl.querySelector("input");
        if (!input || !input.checked) return;
        const text = lbl.textContent.trim();
        if (text) values.push(text);
      });
      const select = filter.querySelector("select");
      if (select) {
        const val = (select.value || "").trim();
        const active = val !== "" && val !== "any";
        if (active) {
          const opt = select.selectedOptions && select.selectedOptions[0];
          const text = opt ? opt.textContent.trim() : val;
          values.push(text);
        }
      }
      if (values.length) {
        items.push({ label: label || "Filtro", values });
      }
    });
    if (items.length === 0) {
      setAttr(filterGroup, "data-pdf-hide", "true");
      return;
    }
    const summary = buildSummary(items);
    filterGroup.parentNode.insertBefore(summary, filterGroup);
    summaries.push(summary);
    setAttr(filterGroup, "data-pdf-hide", "true");
  });
  return () => {
    summaries.forEach(node => {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });
    touched.forEach(({ el, name, prev }) => {
      if (!el) return;
      if (prev === null) {
        el.removeAttribute(name);
      } else {
        el.setAttribute(name, prev);
      }
    });
  };
}
function waitForImages(images) {
  const pending = images
    .filter(img => img && !img.complete)
    .map(
      img =>
        new Promise(resolve => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        })
    );
  if (!pending.length) return Promise.resolve();
  return Promise.all(pending).then(() => undefined);
}
async function ensureTrajectoryAssetsLoaded(activeSubtab) {
  if (activeSubtab === "trajectory") {
    const canvases = elTrajectoryGrid ? elTrajectoryGrid.querySelectorAll("canvas[data-traj-canvas]") : [];
    const imgs = [];
    canvases.forEach(canvas => {
      const zone = parseInt(canvas.dataset.trajCanvas, 10);
      if (!isNaN(zone)) imgs.push(getTrajectoryBg(zone));
    });
    await waitForImages(imgs);
    if (typeof renderTrajectoryAnalysis === "function") {
      renderTrajectoryAnalysis();
    }
  }
  if (activeSubtab === "serve") {
    const imgs = getServeTrajectoryImages();
    await waitForImages([imgs && imgs.start, imgs && imgs.end].filter(Boolean));
    if (typeof renderServeTrajectoryAnalysis === "function") {
      renderServeTrajectoryAnalysis();
    }
  }
  if (activeSubtab === "player") {
    const canvases = elPlayerTrajectoryGrid
      ? elPlayerTrajectoryGrid.querySelectorAll("canvas[data-traj-canvas]")
      : [];
    const imgs = [];
    canvases.forEach(canvas => {
      const zone = parseInt(canvas.dataset.trajCanvas, 10);
      if (!isNaN(zone)) imgs.push(getTrajectoryBg(zone));
    });
    const serveImgs = getServeTrajectoryImages();
    imgs.push(serveImgs && serveImgs.start, serveImgs && serveImgs.end);
    await waitForImages(imgs.filter(Boolean));
    if (typeof renderPlayerTrajectoryAnalysis === "function") {
      renderPlayerTrajectoryAnalysis();
    }
    if (typeof renderPlayerServeTrajectoryAnalysis === "function") {
      renderPlayerServeTrajectoryAnalysis();
    }
  }
}
function setPrintMatchTitle() {
  const el = document.getElementById("print-match-title");
  if (!el) return;
  const label =
    (typeof buildMatchDisplayName === "function" && buildMatchDisplayName(state.match)) ||
    (state.match && state.match.opponent) ||
    "";
  el.textContent = label || "Match";
}
async function captureAnalysisAsPdf() {
  const pdfReady = await ensurePdfLibs();
  const aggPanel = document.getElementById("aggregated-panel");
  if (!aggPanel) {
    throw new Error("Pannello analisi non trovato");
  }
  const prevTab = activeTab;
  const prevAggTab = activeAggTab;
  const prevTheme = state.theme || document.body.dataset.theme || "dark";
  setActiveTab("aggregated");
  setActiveAggTab(prevAggTab || activeAggTab || "summary");
  applyTheme("light");
  document.body.classList.add("pdf-capture");
  setPrintMatchTitle();
  const captureTarget = aggPanel.querySelector(".agg-subpanel.active") || aggPanel;
  const restoreFilters = prepareAnalysisFiltersForPdf(captureTarget);
  try {
    await new Promise(res => setTimeout(res, 120));
    await ensureTrajectoryAssetsLoaded(activeAggTab);
    await new Promise(res => requestAnimationFrame(res));
    if (!pdfReady) {
      window.print();
      return;
    }
    const canvas = await window.html2canvas(captureTarget, {
      backgroundColor: "#ffffff",
      scale: 1.3,
      allowTaint: true,
      useCORS: true,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.offsetWidth,
      windowHeight: document.documentElement.offsetHeight
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.72);
    const pdf = new window.jspdf.jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 5;
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const renderWidth = pageWidth - margin * 2;
    const ratio = renderWidth / imgWidth;
    let renderHeight = imgHeight * ratio;
    if (renderHeight > pageHeight - margin * 2) {
      const ratioH = (pageHeight - margin * 2) / imgHeight;
      renderHeight = imgHeight * ratioH;
    }
    pdf.addImage(imgData, "PNG", margin, margin, renderWidth, renderHeight);
    const blob = pdf.output("blob");
    const fileName = "analisi_" + safeMatchSlug() + ".pdf";
    downloadBlob(blob, fileName);
  } finally {
    restoreFilters();
    document.body.classList.remove("pdf-capture");
    applyTheme(prevTheme);
    if (prevTab) setActiveTab(prevTab);
    if (prevAggTab) setActiveAggTab(prevAggTab);
  }
}
async function openAnalysisPrintLayout() {
  const aggPanel = document.getElementById("aggregated-panel");
  if (!aggPanel) {
    throw new Error("Pannello analisi non trovato");
  }
  const prevTab = activeTab;
  const prevAggTab = activeAggTab;
  const prevTheme = state.theme || document.body.dataset.theme || "dark";
  setActiveTab("aggregated");
  setActiveAggTab(prevAggTab || activeAggTab || "summary");
  applyTheme("light");
  document.body.classList.add("pdf-capture");
  setPrintMatchTitle();
  const captureTarget = aggPanel.querySelector(".agg-subpanel.active") || aggPanel;
  const restoreFilters = prepareAnalysisFiltersForPdf(captureTarget);
  try {
    await new Promise(res => setTimeout(res, 120));
    await ensureTrajectoryAssetsLoaded(activeAggTab);
    await new Promise(res => requestAnimationFrame(res));
    window.print();
  } finally {
    restoreFilters();
    document.body.classList.remove("pdf-capture");
    applyTheme(prevTheme);
    if (prevTab) setActiveTab(prevTab);
    if (prevAggTab) setActiveAggTab(prevAggTab);
  }
}
function buildMatchExportPayload() {
  return {
    app: "simple-volley-scout",
    version: 1,
    exportedAt: new Date().toISOString(),
    state: {
      match: state.match,
      theme: state.theme,
      currentSet: state.currentSet,
      rotation: state.rotation,
      isServing: !!state.isServing,
      autoRotatePending: !!state.autoRotatePending,
      opponentAutoRotatePending: !!state.opponentAutoRotatePending,
      skillClock: state.skillClock,
      players: state.players,
      captains: (state.captains || []).slice(0, 1),
      playerNumbers: state.playerNumbers,
      liberos: state.liberos,
      opponentStats: state.opponentStats,
      opponentPlayers: state.opponentPlayers,
      opponentPlayerNumbers: state.opponentPlayerNumbers,
      opponentLiberos: state.opponentLiberos,
      opponentCaptains: state.opponentCaptains,
      opponentCourt: state.opponentCourt,
      opponentRotation: state.opponentRotation,
      opponentCourtViewMirrored: !!state.opponentCourtViewMirrored,
      opponentAutoRoleP1American: !!state.opponentAutoRoleP1American,
      opponentAttackTrajectoryEnabled: state.opponentAttackTrajectoryEnabled !== false,
      opponentServeTrajectoryEnabled: state.opponentServeTrajectoryEnabled !== false,
      opponentSetTypePromptEnabled: state.opponentSetTypePromptEnabled !== false,
      opponentAutoLiberoBackline: state.opponentAutoLiberoBackline !== false,
      opponentAutoLiberoRole: state.opponentAutoLiberoRole,
      opponentLiberoAutoMap: state.opponentLiberoAutoMap,
      opponentPreferredLibero: state.opponentPreferredLibero,
      opponentSkillFlowOverride: state.opponentSkillFlowOverride,
      opponentSkillConfig: state.opponentSkillConfig,
      court: state.court,
      events: state.events,
      stats: state.stats,
      metricsConfig: state.metricsConfig,
      scoreOverrides: state.scoreOverrides,
      setResults: state.setResults,
      setStarts: state.setStarts,
      matchFinished: state.matchFinished,
      savedTeams: state.savedTeams,
      savedOpponentTeams: state.savedOpponentTeams || state.savedTeams,
      selectedTeam: state.selectedTeam,
      selectedOpponentTeam: state.selectedOpponentTeam,
      video: state.video,
      pointRules: state.pointRules,
      autoRotate: state.autoRotate,
      autoLiberoBackline: state.autoLiberoBackline,
      autoLiberoRole: state.autoLiberoRole,
      liberoAutoMap: state.liberoAutoMap,
      preferredLibero: state.preferredLibero,
      nextSetType: state.nextSetType,
      freeballPending: !!state.freeballPending,
      freeballPendingScope: state.freeballPendingScope,
      flowTeamScope: state.flowTeamScope,
      useOpponentTeam: !!state.useOpponentTeam,
      courtViewMirrored: !!state.courtViewMirrored,
      courtSideSwapped: !!state.courtSideSwapped
    }
  };
}
function buildDatabaseBackupPayload() {
  const payload = buildMatchExportPayload();
  payload.kind = "database-backup";
  payload.savedAt = payload.exportedAt;
  payload.state.savedMatches = loadMatchesMapFromStorage();
  payload.state.selectedMatch = state.selectedMatch || "";
  return payload;
}
async function exportMatchToFile() {
  const payload = buildMatchExportPayload();
  const json = JSON.stringify(payload, null, 2);
  const opponentSlug = safeMatchSlug();
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, "match_" + opponentSlug + ".json");
}
function encodePayloadForLink(payload) {
  try {
    const json = JSON.stringify(payload);
    return btoa(unescape(encodeURIComponent(json)));
  } catch (err) {
    logError("encode-match-link", err);
    return "";
  }
}
function decodePayloadFromLink(encoded) {
  if (!encoded) return null;
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch (err) {
    logError("decode-match-link", err);
    return null;
  }
}
function applyImportedMatch(nextState, options = {}) {
  const silent = options && options.silent;
  const fallback = () => alert("File match non valido.");
  if (!nextState || !nextState.players || !nextState.events) {
    fallback();
    return;
  }
  resetSetTypeState();
  const merged = Object.assign({}, state, nextState);
  merged.match = nextState.match || state.match || {};
  merged.playerNumbers = nextState.playerNumbers || {};
  merged.captains = normalizePlayers(Array.isArray(nextState.captains) ? nextState.captains : [])
    .filter(name => (nextState.players || []).includes(name))
    .slice(0, 1);
  merged.liberos = nextState.liberos || [];
  merged.opponentStats = nextState.opponentStats || state.opponentStats || {};
  merged.liberoAutoMap = nextState.liberoAutoMap || {};
  merged.autoLiberoBackline = nextState.autoLiberoBackline !== false;
  merged.autoLiberoRole =
    typeof nextState.autoLiberoRole === "string" ? nextState.autoLiberoRole : state.autoLiberoRole || "";
  merged.preferredLibero = typeof nextState.preferredLibero === "string" ? nextState.preferredLibero : state.preferredLibero || "";
  merged.court =
    nextState.court ||
    [{ main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }];
  merged.metricsConfig = nextState.metricsConfig || state.metricsConfig || {};
  merged.savedTeams = nextState.savedTeams || state.savedTeams || {};
  merged.savedOpponentTeams = nextState.savedOpponentTeams || nextState.savedTeams || state.savedTeams || {};
  merged.selectedTeam = nextState.selectedTeam || state.selectedTeam || "";
  merged.selectedOpponentTeam = nextState.selectedOpponentTeam || state.selectedOpponentTeam || "";
  merged.opponentPlayers = normalizePlayers(nextState.opponentPlayers || []);
  merged.opponentPlayerNumbers = nextState.opponentPlayerNumbers || {};
  merged.opponentLiberos = normalizePlayers(nextState.opponentLiberos || []);
  merged.opponentRotation = nextState.opponentRotation || state.opponentRotation || 1;
  merged.opponentCourt = nextState.opponentCourt || state.opponentCourt || [];
  merged.opponentCaptains = normalizePlayers(nextState.opponentCaptains || [])
    .filter(name => (merged.opponentPlayers || []).includes(name))
    .slice(0, 1);
  merged.rotation = nextState.rotation || 1;
  merged.isServing = !!nextState.isServing;
  merged.autoRotatePending = !!nextState.autoRotatePending;
  merged.opponentAutoRotatePending = !!nextState.opponentAutoRotatePending;
  merged.currentSet = nextState.currentSet || 1;
  merged.matchFinished = !!nextState.matchFinished;
  merged.skillClock = nextState.skillClock || { paused: false, pausedAtMs: null, pausedAccumMs: 0, lastEffectiveMs: null };
  merged.scoreOverrides = normalizeScoreOverrides(nextState.scoreOverrides || {});
  merged.setResults = nextState.setResults || state.setResults || {};
  merged.setStarts = nextState.setStarts || state.setStarts || {};
  merged.video = nextState.video || state.video || { offsetSeconds: 0, fileName: "", lastPlaybackSeconds: 0 };
  if (typeof merged.video.lastPlaybackSeconds !== "number") {
    merged.video.lastPlaybackSeconds = 0;
  }
  merged.video.youtubeId = merged.video.youtubeId || "";
  merged.video.youtubeUrl = merged.video.youtubeUrl || "";
  merged.courtViewMirrored = !!nextState.courtViewMirrored;
  merged.courtSideSwapped = !!nextState.courtSideSwapped;
  merged.useOpponentTeam = !!nextState.useOpponentTeam;
  merged.opponentSkillConfig = nextState.opponentSkillConfig || state.opponentSkillConfig || {};
  merged.freeballPending = !!nextState.freeballPending;
  merged.freeballPendingScope = nextState.freeballPendingScope || state.freeballPendingScope || "our";
  merged.flowTeamScope = nextState.flowTeamScope || state.flowTeamScope || "our";
  state = merged;
  syncOpponentPlayerNumbers(state.opponentPlayers || [], state.opponentPlayerNumbers || {});
  cleanOpponentLiberos();
  if (typeof cleanLiberoAutoMap === "function") {
    cleanLiberoAutoMap();
  }
  migrateTeamsToPersistent();
  migrateOpponentTeamsToPersistent();
  syncTeamsFromStorage();
  syncOpponentTeamsFromStorage();
  if (typeof enforceAutoLiberoForState === "function") {
    enforceAutoLiberoForState({ skipServerOnServe: true });
  }
  saveState();
  applyTheme(state.theme || "dark");
  applyMatchInfoToUI();
  applyPlayersFromStateToTextarea();
  applyOpponentPlayersFromStateToTextarea();
  renderPlayersManagerList();
  renderOpponentLiberoTags();
  renderOpponentPlayersList();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  renderLiberoTags();
  renderMetricsConfig();
  updateRotationDisplay();
  syncCurrentSetUI(state.currentSet || 1);
  initStats();
  recalcAllStatsAndUpdateUI();
  renderEventsLog();
  renderTeamsSelect();
  renderOpponentTeamsSelect();
  if (!silent) {
    alert("Match importato correttamente.");
  }
}
function applyImportedDatabase(nextState) {
  if (!nextState || !nextState.state) {
    alert("File database non valido.");
    return;
  }
  applyImportedMatch(nextState.state);
  if (nextState.state.savedMatches && typeof nextState.state.savedMatches === "object") {
    Object.entries(nextState.state.savedMatches).forEach(([name, data]) => {
      saveMatchToStorage(name, data);
    });
    syncMatchesFromStorage();
    state.selectedMatch = nextState.state.selectedMatch || "";
    renderMatchesSelect();
  }
  if (nextState.state.savedOpponentTeams && typeof nextState.state.savedOpponentTeams === "object") {
    Object.entries(nextState.state.savedOpponentTeams).forEach(([name, data]) => {
      saveOpponentTeamToStorage(name, data);
    });
  }
  syncOpponentTeamsFromStorage();
  state.selectedOpponentTeam = nextState.state.selectedOpponentTeam || "";
  renderOpponentTeamsSelect();
  alert("Database importato correttamente.");
}
function handleImportMatchFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const txt = (e.target && e.target.result) || "";
      const parsed = JSON.parse(txt);
      const nextState = parsed && parsed.state ? parsed.state : parsed;
      applyImportedMatch(nextState);
    } catch (err) {
      console.error("Import match error", err);
      alert("Errore durante l'import del match.");
    } finally {
      if (elMatchFileInput) elMatchFileInput.value = "";
    }
  };
  reader.readAsText(file);
}
function readMatchLinkParam() {
  if (typeof window === "undefined") return "";
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("match")) {
      return url.searchParams.get("match") || "";
    }
    const hash = (url.hash || "").replace(/^#/, "");
    if (hash.startsWith("match=")) {
      return hash.slice("match=".length);
    }
    const idx = hash.indexOf("match=");
    if (idx !== -1) {
      return hash.slice(idx + "match=".length);
    }
    return "";
  } catch (err) {
    logError("read-match-link", err);
    return "";
  }
}
function clearMatchLinkParam() {
  if (typeof window === "undefined" || !window.history || !window.location) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("match");
    if (url.hash && url.hash.includes("match=")) {
      url.hash = "";
    }
    const next = url.pathname + url.search + url.hash;
    window.history.replaceState({}, document.title, next);
  } catch (err) {
    logError("clear-match-link", err);
  }
}
function maybeImportMatchFromUrl() {
  const encoded = readMatchLinkParam();
  if (!encoded) return { imported: false };
  const parsed = decodePayloadFromLink(encoded);
  if (!parsed) {
    alert("Link partita non valido o corrotto.");
    clearMatchLinkParam();
    return { imported: false };
  }
  const nextState = parsed.state || parsed;
  applyImportedMatch(nextState, { silent: true });
  state.selectedMatch = buildMatchDisplayName(nextState.match || state.match);
  clearMatchLinkParam();
  return { imported: true, name: state.selectedMatch };
}
function exportDatabaseToFile() {
  const payload = buildDatabaseBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const now = new Date();
  const pad2 = num => String(num).padStart(2, "0");
  const stamp =
    now.getFullYear() +
    ":" +
    pad2(now.getMonth() + 1) +
    ":" +
    pad2(now.getDate()) +
    "-" +
    pad2(now.getHours()) +
    ":" +
    pad2(now.getMinutes());
  downloadBlob(blob, "backup_" + stamp + ".json");
}
function handleImportDatabaseFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const txt = (e.target && e.target.result) || "";
      const parsed = JSON.parse(txt);
      if (parsed && parsed.app === "simple-volley-scout" && parsed.state) {
        applyImportedDatabase(parsed);
      } else {
        applyImportedDatabase({ state: parsed });
      }
    } catch (err) {
      console.error("Import database error", err);
      alert("Errore durante l'import del database.");
    } finally {
      if (elDbFileInput) elDbFileInput.value = "";
    }
  };
  reader.readAsText(file);
}
function buildAggregatedDataForPdf() {
  const emptyCounts = () => ({ "#": 0, "+": 0, "!": 0, "-": 0, "=": 0, "/": 0 });
  const getCounts = (idx, skillId) => {
    const base =
      (state.stats[idx] && state.stats[idx][skillId]) || {
        "#": 0,
        "+": 0,
        "!": 0,
        "-": 0,
        "=": 0,
        "/": 0
      };
    return Object.assign(emptyCounts(), base);
  };
  const totalFromCounts = counts =>
    (counts["#"] || 0) +
    (counts["+"] || 0) +
    (counts["!"] || 0) +
    (counts["-"] || 0) +
    (counts["="] || 0) +
    (counts["/"] || 0);
  const totalsBySkill = {
    serve: emptyCounts(),
    pass: emptyCounts(),
    attack: emptyCounts(),
    defense: emptyCounts(),
    block: emptyCounts(),
    second: emptyCounts()
  };
  const addCounts = (target, source) => {
    RESULT_CODES.forEach(code => {
      target[code] = (target[code] || 0) + (source[code] || 0);
    });
  };
  const rows = getSortedPlayerEntries().map(({ name, idx }) => {
    const serveCounts = getCounts(idx, "serve");
    const passCounts = getCounts(idx, "pass");
    const attackCounts = getCounts(idx, "attack");
    const defenseCounts = getCounts(idx, "defense");
    const blockCounts = getCounts(idx, "block");
    const secondCounts = getCounts(idx, "second");

    const serveMetrics = computeMetrics(serveCounts, "serve");
    const passMetrics = computeMetrics(passCounts, "pass");
    const attackMetrics = computeMetrics(attackCounts, "attack");
    const defenseMetrics = computeMetrics(defenseCounts, "defense");
    const blockMetrics = computeMetrics(blockCounts, "block");
    const secondMetrics = computeMetrics(secondCounts, "second");

    addCounts(totalsBySkill.serve, serveCounts);
    addCounts(totalsBySkill.pass, passCounts);
    addCounts(totalsBySkill.attack, attackCounts);
    addCounts(totalsBySkill.defense, defenseCounts);
    addCounts(totalsBySkill.block, blockCounts);
    addCounts(totalsBySkill.second, secondCounts);

    return {
      name: formatNameWithNumber(name),
      serve: {
        tot: totalFromCounts(serveCounts),
        neg: serveMetrics.negativeCount || 0,
        pos: serveMetrics.pos === null ? "-" : formatPercent(serveMetrics.pos),
        eff: serveMetrics.eff === null ? "-" : formatPercent(serveMetrics.eff)
      },
      pass: {
        tot: totalFromCounts(passCounts),
        neg: passMetrics.negativeCount || 0,
        pos: passMetrics.pos === null ? "-" : formatPercent(passMetrics.pos),
        prf: passMetrics.prf === null ? "-" : formatPercent(passMetrics.prf)
      },
      attack: {
        tot: totalFromCounts(attackCounts),
        neg: attackMetrics.negativeCount || 0,
        pos: attackMetrics.pos === null ? "-" : formatPercent(attackMetrics.pos),
        eff: attackMetrics.eff === null ? "-" : formatPercent(attackMetrics.eff)
      },
      defense: {
        tot: totalFromCounts(defenseCounts),
        neg: defenseMetrics.negativeCount || 0,
        pos: defenseMetrics.pos === null ? "-" : formatPercent(defenseMetrics.pos),
        eff: defenseMetrics.eff === null ? "-" : formatPercent(defenseMetrics.eff)
      },
      block: {
        tot: totalFromCounts(blockCounts),
        neg: blockMetrics.negativeCount || 0,
        pos: blockMetrics.pos === null ? "-" : formatPercent(blockMetrics.pos),
        eff: blockMetrics.eff === null ? "-" : formatPercent(blockMetrics.eff)
      },
      second: {
        tot: totalFromCounts(secondCounts),
        pos: secondMetrics.pos === null ? "-" : formatPercent(secondMetrics.pos),
        prf: secondMetrics.prf === null ? "-" : formatPercent(secondMetrics.prf)
      }
    };
  });
  const totals = (() => {
    const serveMetrics = computeMetrics(totalsBySkill.serve, "serve");
    const passMetrics = computeMetrics(totalsBySkill.pass, "pass");
    const attackMetrics = computeMetrics(totalsBySkill.attack, "attack");
    const defenseMetrics = computeMetrics(totalsBySkill.defense, "defense");
    const blockMetrics = computeMetrics(totalsBySkill.block, "block");
    const secondMetrics = computeMetrics(totalsBySkill.second, "second");
    return {
      name: "Totale squadra",
      serve: {
        tot: totalFromCounts(totalsBySkill.serve),
        neg: serveMetrics.negativeCount || 0,
        pos: serveMetrics.pos === null ? "-" : formatPercent(serveMetrics.pos),
        eff: serveMetrics.eff === null ? "-" : formatPercent(serveMetrics.eff)
      },
      pass: {
        tot: totalFromCounts(totalsBySkill.pass),
        neg: passMetrics.negativeCount || 0,
        pos: passMetrics.pos === null ? "-" : formatPercent(passMetrics.pos),
        prf: passMetrics.prf === null ? "-" : formatPercent(passMetrics.prf)
      },
      attack: {
        tot: totalFromCounts(totalsBySkill.attack),
        neg: attackMetrics.negativeCount || 0,
        pos: attackMetrics.pos === null ? "-" : formatPercent(attackMetrics.pos),
        eff: attackMetrics.eff === null ? "-" : formatPercent(attackMetrics.eff)
      },
      defense: {
        tot: totalFromCounts(totalsBySkill.defense),
        neg: defenseMetrics.negativeCount || 0,
        pos: defenseMetrics.pos === null ? "-" : formatPercent(defenseMetrics.pos),
        eff: defenseMetrics.eff === null ? "-" : formatPercent(defenseMetrics.eff)
      },
      block: {
        tot: totalFromCounts(totalsBySkill.block),
        neg: blockMetrics.negativeCount || 0,
        pos: blockMetrics.pos === null ? "-" : formatPercent(blockMetrics.pos),
        eff: blockMetrics.eff === null ? "-" : formatPercent(blockMetrics.eff)
      },
      second: {
        tot: totalFromCounts(totalsBySkill.second),
        pos: secondMetrics.pos === null ? "-" : formatPercent(secondMetrics.pos),
        prf: secondMetrics.prf === null ? "-" : formatPercent(secondMetrics.prf)
      }
    };
  })();
  return { rows, totals };
}
function padCell(text, width) {
  const str = (text === null || text === undefined ? "" : String(text)).replace(/\s+/g, " ");
  if (str.length === width) return str;
  if (str.length > width) return str.slice(0, width);
  return str + " ".repeat(width - str.length);
}
function formatAggRow(row) {
  const widths = [
    16, // nome
    4, 4, 4, 4, // serve
    4, 4, 4, 4, // pass
    4, 4, 4, 4, // attack
    4, 4, 4, 4, // defense
    4, 4, 4, 4, // block
    4, 4, 4 // second
  ];
  const cells = [
    row.name || "",
    row.serve.tot,
    row.serve.neg,
    row.serve.pos,
    row.serve.eff,
    row.pass.tot,
    row.pass.neg,
    row.pass.pos,
    row.pass.prf,
    row.attack.tot,
    row.attack.neg,
    row.attack.pos,
    row.attack.eff,
    row.defense.tot,
    row.defense.neg,
    row.defense.pos,
    row.defense.eff,
    row.block.tot,
    row.block.neg,
    row.block.pos,
    row.block.eff,
    row.second.tot,
    row.second.pos,
    row.second.prf
  ];
  return cells
    .map((c, i) => padCell(c, widths[i] || 4))
    .join(" | ");
}
function buildAnalysisPdfLines() {
  const lines = [];
  const matchInfo = state.match || {};
  const setsData = computeSetScores();
  const pointsSummary = computePointsSummary();
  const aggData = buildAggregatedDataForPdf();
  lines.push("Simple Volleyball Scout - Analisi");
  const infoParts = [];
  if (matchInfo.opponent) infoParts.push("Avversario: " + matchInfo.opponent);
  if (matchInfo.category) infoParts.push("Categoria: " + matchInfo.category);
  if (matchInfo.date) infoParts.push("Data: " + matchInfo.date);
  if (infoParts.length > 0) lines.push(infoParts.join(" · "));
  lines.push("Punteggio totale: " + pointsSummary.totalFor + " - " + pointsSummary.totalAgainst);
  if (setsData && setsData.sets && setsData.sets.length > 0) {
    lines.push(
      "Set: " +
        setsData.sets
          .map(s => "S" + s.set + " " + s.for + "-" + s.against)
          .join(" | ")
    );
  }
  lines.push("Rotazioni (fatti - subiti - delta):");
  pointsSummary.rotations.forEach(r => {
    lines.push(
      "  P" +
        r.rotation +
        ": " +
        r.for +
        " - " +
        r.against +
        " (Δ " +
        formatDelta(r.delta) +
        ")"
    );
  });
  lines.push("");
  lines.push(
    formatAggRow({
      name: "Atleta",
      serve: { tot: "Tot", neg: "Neg", pos: "Pos", eff: "Eff" },
      pass: { tot: "Tot", neg: "Neg", pos: "Pos", prf: "Prf" },
      attack: { tot: "Tot", neg: "Neg", pos: "Pos", eff: "Eff" },
      defense: { tot: "Tot", neg: "Neg", pos: "Pos", eff: "Eff" },
      block: { tot: "Tot", neg: "Neg", pos: "Pos", eff: "Eff" },
      second: { tot: "Tot", pos: "Pos", prf: "Prf" }
    })
  );
  lines.push("-".repeat(140));
  aggData.rows.forEach(r => lines.push(formatAggRow(r)));
  lines.push("-".repeat(140));
  lines.push(formatAggRow(aggData.totals));
  return lines;
}
function escapePdfText(str) {
  return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function buildSimplePdf(lines, opts = {}) {
  const fontSize = opts.fontSize || 10;
  const lineHeight = opts.lineHeight || 12;
  const margin = opts.margin || 32;
  const pageWidth = opts.landscape ? 842 : 595;
  const pageHeight = opts.landscape ? 595 : 842;
  let y = pageHeight - margin;
  const contentParts = [];
  contentParts.push("BT");
  contentParts.push("/F1 " + fontSize + " Tf");
  contentParts.push(lineHeight + " TL");
  contentParts.push(margin + " " + y + " Td");
  lines.forEach(line => {
    contentParts.push("(" + escapePdfText(line) + ") Tj");
    contentParts.push("0 -" + lineHeight + " Td");
    y -= lineHeight;
  });
  contentParts.push("ET");
  const contentStream = contentParts.join("\n");
  const contentLength = new TextEncoder().encode(contentStream).length;
  const objects = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
      pageWidth +
      " " +
      pageHeight +
      "] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj"
  );
  objects.push(
    "4 0 obj\n<< /Length " +
      contentLength +
      " >>\nstream\n" +
      contentStream +
      "\nendstream\nendobj"
  );
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj");
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  let currentOffset = pdf.length;
  objects.forEach(obj => {
    offsets.push(currentOffset);
    pdf += obj + "\n";
    currentOffset = pdf.length;
  });
  const xrefStart = currentOffset;
  pdf += "xref\n0 " + (objects.length + 1) + "\n";
  pdf += "0000000000 65535 f \n";
  offsets.forEach(off => {
    pdf += String(off).padStart(10, "0") + " 00000 n \n";
  });
  pdf +=
    "trailer\n<< /Size " +
    (objects.length + 1) +
    " /Root 1 0 R >>\nstartxref\n" +
    xrefStart +
    "\n%%EOF";
  return new TextEncoder().encode(pdf);
}
function exportAnalysisPdf() {
  const hasEvents = state.events && state.events.length > 0;
  if (!hasEvents) {
    alert("Nessun evento da esportare.");
    return;
  }
  openAnalysisPrintLayout().catch(err => {
    console.error("Print layout failed", err);
    alert("Impossibile aprire il layout di stampa.");
  });
}
function resetMatch() {
  if (!confirm("Sei sicuro di voler resettare tutti i dati del match?")) return;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
  }
  if ("caches" in window) {
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key));
    });
  }
  resetSetTypeState();
  const preservedCourt = state.court ? JSON.parse(JSON.stringify(state.court)) : Array.from({ length: 6 }, () => ({ main: "" }));
  const preservedRotation = state.rotation || 1;
  const preservedServing = !!state.isServing;
  const preservedAutoRoleCourt = Array.isArray(state.autoRoleBaseCourt) ? [...state.autoRoleBaseCourt] : [];
  const preservedLiberoMap = Object.assign({}, state.liberoAutoMap || {});
  const preservedPreferredLibero = state.preferredLibero || "";
  state.events = [];
  state.court = preservedCourt;
  state.rotation = preservedRotation;
  state.autoRoleBaseCourt = preservedAutoRoleCourt;
  autoRoleBaseCourt = preservedAutoRoleCourt.length ? [...preservedAutoRoleCourt] : autoRoleBaseCourt;
  state.currentSet = 1;
  state.setResults = {};
  state.setStarts = {};
  state.scoreOverrides = {};
  state.matchFinished = false;
  state.autoRotatePending = false;
  state.opponentAutoRotatePending = false;
  state.skillFlowOverride = null;
  state.opponentSkillFlowOverride = null;
  state.freeballPending = false;
  state.freeballPendingScope = "our";
  state.flowTeamScope = "our";
  state.matchEndSetSnapshot = null;
  state.matchEndSetRecorded = null;
  Object.keys(selectedSkillPerPlayer).forEach(key => delete selectedSkillPerPlayer[key]);
  state.isServing = preservedServing;
  state.liberoAutoMap = preservedLiberoMap;
  state.preferredLibero = preservedPreferredLibero;
  if (typeof enforceAutoLiberoForState === "function") {
    enforceAutoLiberoForState({ skipServerOnServe: true });
  }
  state.skillClock = { paused: true, pausedAtMs: null, pausedAccumMs: 0, lastEffectiveMs: 0 };
  state.video = state.video || {
    offsetSeconds: 0,
    fileName: "",
    youtubeId: "",
    youtubeUrl: "",
    lastPlaybackSeconds: 0
  };
  state.video.offsetSeconds = 0;
  state.video.youtubeId = "";
  state.video.youtubeUrl = "";
  state.video.lastPlaybackSeconds = 0;
  state.videoClock = {
    paused: true,
    pausedAtMs: null,
    pausedAccumMs: 0,
    startMs: Date.now(),
    currentSeconds: 0
  };
  clearEventSelection({ clearContexts: true });
  syncYoutubeUrlInputs("");
  clearCachedLocalVideo();
  if (ytPlayer && ytPlayer.stopVideo) {
    ytPlayer.stopVideo();
  }
  if (ytPlayerScout && ytPlayerScout.stopVideo) {
    ytPlayerScout.stopVideo();
  }
  if (elAnalysisVideo) {
    elAnalysisVideo.pause();
    elAnalysisVideo.currentTime = 0;
  }
  if (elAnalysisVideoScout) {
    elAnalysisVideoScout.pause();
    elAnalysisVideoScout.currentTime = 0;
  }
  if (elYoutubeFrame) {
    elYoutubeFrame.src = "";
    elYoutubeFrame.style.display = "none";
  }
  if (elYoutubeFrameScout) {
    elYoutubeFrameScout.src = "";
    elYoutubeFrameScout.style.display = "none";
  }
  syncCurrentSetUI(1);
  initStats();
  saveState();
  recalcAllStatsAndUpdateUI();
  renderEventsLog();
  renderPlayers();
  renderBenchChips();
  updateRotationDisplay();
  setTimeout(() => {
    window.location.reload();
  }, 200);
}
function undoLastEvent() {
  if (!state.events || state.events.length === 0) {
    alert("Non ci sono eventi da annullare.");
    return;
  }
  const ev = state.events.pop();
  if (!ev) {
    saveState();
    recalcAllStatsAndUpdateUI();
    renderEventsLog();
    renderPlayers();
    renderBenchChips();
    renderLiberoChipsInline();
    renderLineupChips();
    updateRotationDisplay();
    return;
  }
  if (ev.actionType === "set-change" || ev.actionType === "match-end") {
    const prevSet = ev.prevSet || 1;
    const prevFinished = !!ev.prevMatchFinished;
    if (ev.prevSetResults) {
      state.setResults = ev.prevSetResults;
    }
    if (ev.prevSetStarts) {
      state.setStarts = ev.prevSetStarts;
    }
    state.matchFinished = prevFinished;
    setCurrentSet(prevSet, { save: false });
    saveState();
    recalcAllStatsAndUpdateUI();
    renderEventsLog();
    renderPlayers();
    renderBenchChips();
    renderLiberoChipsInline();
    renderLineupChips();
    updateRotationDisplay();
    return;
  }
  if (ev && ev.autoRotationDirection && typeof rotateCourt === "function") {
    const reverseDir = ev.autoRotationDirection === "ccw" ? "cw" : "ccw";
    rotateCourt(reverseDir);
  }
  if (ev && ev.actionType === "substitution") {
    undoSubstitutionEvent(ev);
  }
  if (ev.actionType === "match-end") {
    restoreSkillClock(ev.prevClock || null);
    restoreVideoClock(ev.prevVideoClock || null);
    state.matchFinished = !!ev.prevMatchFinished;
    updateMatchStatusUI();
    setScoutControlsDisabled(!!state.matchFinished);
  } else if (ev.actionType === "set-change") {
    restoreSkillClock(ev.prevClock || null);
    restoreVideoClock(ev.prevVideoClock || null);
    state.matchFinished = !!ev.prevMatchFinished;
    updateMatchStatusUI();
    setScoutControlsDisabled(!!state.matchFinished);
  }
  const idx = ev.playerIdx;
  const skillId = ev.skillId;
  if (
    state.stats[idx] &&
    state.stats[idx][skillId] &&
    state.stats[idx][skillId][ev.code] > 0
  ) {
    state.stats[idx][skillId][ev.code]--;
  }
  recomputeServeFlagsFromHistory();
  saveState();
  recalcAllStatsAndUpdateUI();
  renderEventsLog();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  updateRotationDisplay();
}
function deleteEventByKey(eventKey) {
  if (!eventKey) return;
  const evIndex = (state.events || []).findIndex((ev, idx) => getEventKey(ev, idx) === eventKey);
  if (evIndex === -1) return;
  const ev = state.events[evIndex];
  const label = ev
    ? (() => {
        const scope = getTeamScopeFromEvent(ev);
        const numbers = getPlayerNumbersForScope(scope);
        const nameLabel = ev.playerName ? formatNameWithNumberFor(ev.playerName, numbers) : "";
        return `${nameLabel} ${ev.skillId || ""} ${ev.code || ""}`.trim();
      })()
    : "questa skill";
  if (!confirm(`Eliminare ${label}?`)) return;
  state.events.splice(evIndex, 1);
  clearEventSelection();
  recomputeServeFlagsFromHistory();
  saveState();
  recalcAllStatsAndUpdateUI();
  renderEventsLog();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  updateRotationDisplay();
  renderTrajectoryAnalysis();
  renderServeTrajectoryAnalysis();
}
function undoSubstitutionEvent(ev) {
  if (!ev) return false;
  const playerIn = (ev.playerIn || "").trim();
  const playerOut = (ev.playerOut || "").trim();
  if (!playerIn || !playerOut) return false;
  if (typeof isLibero === "function" && (isLibero(playerIn) || isLibero(playerOut))) {
    return false;
  }
  const baseCourt = getCourtShape(state.court);
  const inIdx = baseCourt.findIndex(slot => slot && slot.main === playerIn);
  if (inIdx === -1) return false;
  const outIdx = baseCourt.findIndex(slot => slot && slot.main === playerOut);
  const nextCourt = cloneCourt(baseCourt);
  if (outIdx !== -1 && outIdx !== inIdx) {
    nextCourt[inIdx].main = playerOut;
    nextCourt[outIdx].main = playerIn;
  } else {
    nextCourt[inIdx].main = playerOut;
  }
  if (typeof commitCourtChange === "function") {
    commitCourtChange(nextCourt, { clean: true });
  } else {
    state.court = ensureCourtShapeFor(nextCourt);
    saveState();
    if (typeof renderPlayers === "function") renderPlayers();
    if (typeof renderBenchChips === "function") renderBenchChips();
    if (typeof renderLineupChips === "function") renderLineupChips();
    if (typeof updateRotationDisplay === "function") updateRotationDisplay();
  }
  return true;
}
function applyAggColumnsVisibility() {
  ensureMetricsConfigDefaults();
  Object.keys(SKILL_COLUMN_MAP).forEach(skillId => {
    const cfg = state.metricsConfig[skillId];
    const enabled = !cfg || cfg.enabled !== false;
    const selector = ".skill-col.skill-" + skillId;
    const nodes = document.querySelectorAll(selector);
    nodes.forEach(node => {
      if (enabled) {
        node.classList.remove("skill-hidden");
      } else {
        node.classList.add("skill-hidden");
      }
    });
  });
}
function registerServiceWorker() {
  const supportsSw = "serviceWorker" in navigator;
  const secureContext =
    window.isSecureContext || location.protocol === "https:" || location.hostname === "localhost";
  if (!supportsSw || !secureContext) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(reg => {
        if (reg && typeof reg.update === "function") {
          reg.update();
        }
        if (navigator.serviceWorker.controller) {
          sessionStorage.removeItem("sw-force-reload");
        }
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          const key = "sw-force-reload";
          if (sessionStorage.getItem(key) === "1") return;
          sessionStorage.setItem(key, "1");
          window.location.reload();
        });
      })
      .catch(err => console.error("SW registration failed", err));
  });
}
function setActiveAggTab(target) {
  const desired = target || "summary";
  activeAggTab = desired;
  state.uiAggTab = desired;
  if (!isLoadingMatch) saveState();
  if (document && document.body) {
    document.body.dataset.aggTab = desired;
  }
  if (elAggTabButtons && typeof elAggTabButtons.forEach === "function") {
    elAggTabButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.aggTabTarget === desired);
    });
  }
  if (elAggSubPanels && typeof elAggSubPanels.forEach === "function") {
    elAggSubPanels.forEach(panel => {
      panel.classList.toggle("active", panel.dataset.aggTab === desired);
    });
  }
  if (desired === "trajectory") {
    const refresh = () => {
      if (typeof renderTrajectoryAnalysis === "function") {
        renderTrajectoryAnalysis();
      }
      if (typeof renderServeTrajectoryAnalysis === "function") {
        renderServeTrajectoryAnalysis();
      }
    };
    requestAnimationFrame(refresh);
    setTimeout(refresh, 0);
  }
  if (desired === "serve") {
    const refreshServe = () => {
      if (typeof renderServeTrajectoryAnalysis === "function") {
        renderServeTrajectoryAnalysis();
      }
    };
    requestAnimationFrame(refreshServe);
    setTimeout(refreshServe, 0);
  }
  if (desired === "player") {
    const refreshPlayer = () => {
      if (typeof renderPlayerAnalysis === "function") {
        renderPlayerAnalysis();
      }
    };
    requestAnimationFrame(refreshPlayer);
    setTimeout(refreshPlayer, 0);
  }
}
function setActiveTab(target) {
  if (!target) return;
  const prevTab = activeTab;
  activeTab = target;
  state.uiActiveTab = target;
  if (!isLoadingMatch) saveState();
  document.body.dataset.activeTab = target;
  tabButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tabTarget === target);
  });
  tabPanels.forEach(panel => {
    panel.classList.toggle("active", panel.dataset.tab === target);
  });
  if (
    target === "aggregated" &&
    (activeAggTab === "trajectory" || activeAggTab === "serve" || activeAggTab === "player")
  ) {
    const refresh = () => {
      if (typeof renderTrajectoryAnalysis === "function" && activeAggTab === "trajectory") {
        renderTrajectoryAnalysis();
      }
      if (typeof renderServeTrajectoryAnalysis === "function" && activeAggTab === "serve") {
        renderServeTrajectoryAnalysis();
      }
      if (typeof renderPlayerAnalysis === "function" && activeAggTab === "player") {
        renderPlayerAnalysis();
      }
    };
    requestAnimationFrame(refresh);
    setTimeout(refresh, 0);
  }
  if (prevTab === "video" && target !== "video") {
    stopPlayByPlay();
  }
  if (target === "scout" && shouldOpenNextSetModal()) {
    openNextSetModal(state.currentSet || 1);
  }
}
function initTabs() {
  if (!tabButtons || !tabPanels) return;
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tabTarget;
      if (target) {
        setActiveTab(target);
      }
    });
  });
  setActiveTab("info");
}
function initSwipeTabs() {
  if (!("ontouchstart" in window)) return;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let startTarget = null;
  let startedInSwipeZone = false;
  let lastX = null;
  let lastY = null;
  const minDistance = 140;
  const maxOffset = 35;
  const maxTime = 600;
  const swipeZoneRatio = 0.25;
  const tabsOrder = ["info", "scout", "aggregated", "video"];
  const onStart = e => {
    if (!e.touches || e.touches.length === 0) {
      startedInSwipeZone = false;
      return;
    }
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    startTime = Date.now();
    startTarget = e.target;
    const height = window.innerHeight || document.documentElement.clientHeight || 0;
    const zoneTop = height * (1 - swipeZoneRatio);
    startedInSwipeZone = startY >= zoneTop;
    lastX = startX;
    lastY = startY;
  };
  const onMove = e => {
    if (!startedInSwipeZone) return;
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    lastX = t.clientX;
    lastY = t.clientY;
  };
  const onEnd = e => {
    if (elSkillModal && !elSkillModal.classList.contains("hidden")) return;
    if (!startedInSwipeZone) return;
    if (lastX === null || lastY === null) return;
    const dx = lastX - startX;
    const dy = lastY - startY;
    const dt = Date.now() - startTime;
    if (dt > maxTime) return;
    if (Math.abs(dy) > maxOffset) return;
    if (Math.abs(dx) < minDistance) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (activeTab === "aggregated" && startTarget instanceof Element) {
      const scrollable = startTarget.closest(
        ".table-wrapper, .trajectory-layout, .trajectory-grid, .serve-trajectory-grid, .video-analysis__grid, .video-table-wrapper"
      );
      if (scrollable && scrollable.scrollWidth > scrollable.clientWidth) return;
    }
    if (document.body.classList.contains("drawer-menu-open")) {
      if (dx < 0) document.body.classList.remove("drawer-menu-open");
      return;
    }
    if (document.body.classList.contains("drawer-log-open")) {
      if (dx > 0) document.body.classList.remove("drawer-log-open");
      return;
    }
    const dir = dx > 0 ? "right" : "left";
    const idx = tabsOrder.indexOf(activeTab);
    if (idx === -1) return;
    const nextIdx = dir === "left" ? Math.min(tabsOrder.length - 1, idx + 1) : Math.max(0, idx - 1);
    if (nextIdx !== idx) setActiveTab(tabsOrder[nextIdx]);
    startedInSwipeZone = false;
    lastX = null;
    lastY = null;
  };
  document.addEventListener("touchstart", onStart, { passive: true });
  document.addEventListener("touchmove", onMove, { passive: true });
  document.addEventListener("touchend", onEnd, { passive: true });
}
function setupFocusGuards() {
  const shouldBlurElement = el => {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === "button") return true;
    if (tag === "input") {
      const type = (el.type || "").toLowerCase();
      return ["checkbox", "radio", "button", "submit", "reset"].includes(type);
    }
    return el.getAttribute("role") === "button";
  };
  document.addEventListener(
    "click",
    () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        if (shouldBlurElement(active)) active.blur();
      }, 0);
    },
    true
  );
  const blurIframeFocus = () => {
    const active = document.activeElement;
    if (active && active.tagName && active.tagName.toLowerCase() === "iframe") {
      if (document.body) document.body.focus();
      active.blur();
    }
  };
  if (elYoutubeFrame) {
    elYoutubeFrame.addEventListener("pointerdown", blurIframeFocus, true);
    elYoutubeFrame.addEventListener("click", blurIframeFocus, true);
  }
  if (elYoutubeFrameScout) {
    elYoutubeFrameScout.addEventListener("pointerdown", blurIframeFocus, true);
    elYoutubeFrameScout.addEventListener("click", blurIframeFocus, true);
  }
  document.querySelectorAll("[data-youtube-guard]").forEach(guard => {
    guard.addEventListener(
      "pointerdown",
      e => {
        e.preventDefault();
        e.stopPropagation();
        if (document.body) document.body.focus();
      },
      true
    );
    guard.addEventListener(
      "click",
      e => {
        e.preventDefault();
        e.stopPropagation();
        toggleYoutubePlayback();
        if (document.body) document.body.focus();
      },
      true
    );
  });
}
function ensureBaseRotationDefault() {
  const rot = parseInt(state.rotation, 10);
  if (!rot || rot < 1 || rot > 6) {
    state.rotation = 1;
    updateRotationDisplay();
    saveState();
  }
}
async function init() {
  isLoadingMatch = true;
  if (typeof window !== "undefined") {
    window.isLoadingMatch = true;
  }
  if (typeof window !== "undefined") {
    window.openMatchManagerModal = openMatchManagerModal;
    window.closeMatchManagerModal = closeMatchManagerModal;
  }
  initTabs();
  initSwipeTabs();
  setupFocusGuards();
  initSetTypeShortcuts();
  document.addEventListener("keydown", handleVideoShortcut, true);
  document.body.dataset.activeTab = activeTab;
  setActiveAggTab(activeAggTab || "summary");
  loadState();
  if (typeof loadStateFromIndexedDb === "function") {
    await loadStateFromIndexedDb();
  }
  state.setResults = state.setResults || {};
  state.setStarts = state.setStarts || {};
  setActiveTab(state.uiActiveTab || activeTab || "info");
  setActiveAggTab(state.uiAggTab || activeAggTab || "summary");
  ensureBaseRotationDefault();
  const linkImport = maybeImportMatchFromUrl();
  renderYoutubePlayer();
  renderYoutubePlayerScout();
  restoreCachedLocalVideo();
  restoreYoutubeFromState();
  applyTheme(state.theme || "dark");
  applyMatchInfoToUI();
  updateRotationDisplay();
  applyPlayersFromStateToTextarea();
  applyOpponentPlayersFromStateToTextarea();
  renderPlayersManagerList();
  renderOpponentLiberoTags();
  renderOpponentPlayersList();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  renderLiberoTags();
  renderMetricsConfig();
  renderTeamsSelect();
  renderOpponentTeamsSelect();
  renderMatchesSelect();
  renderLiveScore();
  renderPlayers();
  initLogServeTrajectoryControls();
  const applyForceMobileLayout = enabled => {
    document.body.classList.toggle("force-mobile", !!enabled);
    renderPlayers();
    updateCourtModalPlacement();
  };
  applyForceMobileLayout(!!state.forceMobileLayout);
  updateCourtModalPlacement();
  if (!state.players || state.players.length === 0) {
    applyTemplateTeam({ askReset: false });
  } else {
    if (!state.stats || Object.keys(state.stats).length === 0) {
      initStats();
      recalcAllStatsAndUpdateUI();
    }
    renderPlayers();
    renderEventsLog();
    renderAggregatedTable();
    renderBenchChips();
    renderLiberoChipsInline();
    renderLineupChips();
    renderLiberoTags();
    renderMetricsConfig();
    renderTeamsSelect();
  }
  if (state.autoRolePositioning && typeof applyAutoRolePositioning === "function") {
    applyAutoRolePositioning();
  }
  ensureSkillClock();
  ensureVideoClock();
  updateMatchStatusUI();
  setScoutControlsDisabled(!!state.matchFinished);

  [elCurrentSet].forEach(select => {
    if (!select) return;
    select.addEventListener("change", () => setCurrentSet(select.value));
  });
  [elOpponent, elCategory, elDate, elLeg, elMatchType].forEach(input => {
    if (!input) return;
    const handler = () => {
      saveMatchInfoFromUI();
      if (typeof renderMatchesSelect === "function") renderMatchesSelect();
      if (typeof renderMatchSummary === "function") renderMatchSummary();
    };
    input.addEventListener("change", handler);
    input.addEventListener("blur", handler);
  });
  if (elThemeToggleDark && elThemeToggleLight) {
    elThemeToggleDark.addEventListener("click", () => {
      applyTheme("dark");
      saveState();
    });
    elThemeToggleLight.addEventListener("click", () => {
      applyTheme("light");
      saveState();
    });
    applyTheme(state.theme || "dark");
  }
  const elPastePlayersModal = document.getElementById("paste-players-modal");
  const closePastePlayersModal = () => {
    if (!elPastePlayersModal) return;
    elPastePlayersModal.classList.add("hidden");
    if (elTeamManagerModal && !elTeamManagerModal.classList.contains("hidden")) return;
    document.body.classList.remove("modal-open");
  };
  if (elBtnApplyPlayers) {
    elBtnApplyPlayers.addEventListener("click", () => {
      applyPlayersFromTextarea();
      closePastePlayersModal();
      if (elPlayersInput) {
        elPlayersInput.value = "";
      }
    });
  }
  if (elBtnApplyOpponentPlayers) {
    elBtnApplyOpponentPlayers.addEventListener("click", () => {
      applyOpponentPlayersFromTextarea();
    });
  }
  if (elBtnAddPlayer) {
    elBtnAddPlayer.addEventListener("click", addPlayerFromInput);
  }
  if (elBtnAddOpponentPlayer) {
    elBtnAddOpponentPlayer.addEventListener("click", addOpponentPlayerFromInput);
  }
  if (elNewPlayerInput) {
    elNewPlayerInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        addPlayerFromInput();
      }
    });
  }
  if (elNewOpponentPlayerInput) {
    elNewOpponentPlayerInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        addOpponentPlayerFromInput();
      }
    });
  }
  if (elPlayersList) {
    elPlayersList.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.classList.contains("pill-remove")) {
        const idx = parseInt(target.dataset.playerIdx, 10);
        if (!isNaN(idx)) {
          removePlayerAtIndex(idx);
        }
      }
    });
  }
  if (elBtnClearPlayers) {
    elBtnClearPlayers.addEventListener("click", () => {
      if (!state.players || state.players.length === 0) return;
      updatePlayersList([], { askReset: true });
    });
  }
  if (elBtnClearOpponentPlayers) {
    elBtnClearOpponentPlayers.addEventListener("click", clearOpponentPlayers);
  }
  if (elBtnSaveTeam) {
    elBtnSaveTeam.addEventListener("click", () => {
      const teamManagerModal = document.getElementById("team-manager-modal");
      if (teamManagerModal && !teamManagerModal.classList.contains("hidden") && typeof saveTeamManagerPayload === "function") {
        saveTeamManagerPayload({ closeModal: false });
        return;
      }
      saveCurrentTeam();
    });
  }
  if (elBtnOpenLineup) {
    elBtnOpenLineup.addEventListener("click", () => {
      openMobileLineupModal();
    });
  }
  const elBtnOpenLineupOpp = document.getElementById("btn-open-lineup-opp");
  if (elBtnOpenLineupOpp) {
    elBtnOpenLineupOpp.addEventListener("click", () => {
      openMobileLineupModal("opponent");
    });
  }
  if (elBtnSaveOpponentTeam) {
    elBtnSaveOpponentTeam.addEventListener("click", saveCurrentOpponentTeam);
  }
  if (elBtnOpenTeamManager) {
    elBtnOpenTeamManager.addEventListener("click", () => openTeamManagerModal("our"));
  }
  const elBtnNewTeam = document.getElementById("btn-new-team");
  if (elBtnNewTeam) {
    elBtnNewTeam.addEventListener("click", () => {
      if (typeof openNewTeamManager === "function") {
        openNewTeamManager();
        return;
      }
      openTeamManagerModal("our");
    });
  }
  const elBtnDuplicateTeam = document.getElementById("btn-duplicate-team");
  if (elBtnDuplicateTeam) {
    elBtnDuplicateTeam.addEventListener("click", () => {
      if (typeof duplicateSelectedTeam === "function") {
        duplicateSelectedTeam();
      }
    });
  }
  if (elBtnOpenOpponentTeamManager) {
    elBtnOpenOpponentTeamManager.addEventListener("click", () => openTeamManagerModal("opponent"));
  }
  if (elLineupModalClose) {
    elLineupModalClose.addEventListener("click", closeLineupModal);
  }
  if (elLineupModalCancel) {
    elLineupModalCancel.addEventListener("click", closeLineupModal);
  }
  if (elLineupModalSaveOverride) {
    elLineupModalSaveOverride.addEventListener("click", () => {
      saveLineupModal({ countSubstitutions: false });
    });
  }
  if (elLineupModalSaveSubstitution) {
    elLineupModalSaveSubstitution.addEventListener("click", () => {
      saveLineupModal({ countSubstitutions: true });
    });
  }
  if (elLineupModalApplyDefault) {
    elLineupModalApplyDefault.addEventListener("click", applyDefaultLineupToModal);
  }
  if (elLineupModalToggleNumbers) {
    elLineupModalToggleNumbers.addEventListener("click", () => {
      lineupNumberMode = !lineupNumberMode;
      renderLineupModal();
    });
  }
  if (elLineupModal) {
    elLineupModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.closeLineup !== undefined) {
        closeLineupModal();
      }
    });
  }
  if (elTeamManagerClose) {
    elTeamManagerClose.addEventListener("click", closeTeamManagerModal);
  }
  if (elTeamManagerCancel) {
    elTeamManagerCancel.addEventListener("click", closeTeamManagerModal);
  }
  if (elTeamManagerAdd) {
    elTeamManagerAdd.addEventListener("click", () => {
      if (!teamManagerState) {
        openTeamManagerModal(teamManagerScope || "our");
        return;
      }
      teamManagerState.players.push({
        id: typeof generatePlayerId === "function" ? generatePlayerId() : Date.now() + "_" + Math.random(),
        name: "",
        firstName: "",
        lastName: "",
        number: "",
        role: "",
        isCaptain: false,
        out: false
      });
      renderTeamManagerTable();
    });
  }
  if (elTeamManagerSave) {
    elTeamManagerSave.addEventListener("click", () => {
      saveTeamManagerPayload();
    });
  }
  if (elTeamManagerModal) {
    elTeamManagerModal.addEventListener("click", e => {
      const target = e.target;
      if (target === elTeamManagerModal || (target && target.classList && target.classList.contains("team-modal__backdrop"))) {
        closeTeamManagerModal();
      }
    });
  }
  const elBtnOpenPlayersPaste = document.getElementById("btn-open-players-paste");
  if (elBtnOpenPlayersPaste) {
    elBtnOpenPlayersPaste.addEventListener("click", () => {
      if (elPlayersInput) {
        elPlayersInput.value = "";
      }
      if (elPastePlayersModal) {
        elPastePlayersModal.classList.remove("hidden");
        document.body.classList.add("modal-open");
      }
      if (elPlayersInput) {
        elPlayersInput.focus();
      }
    });
  }
  if (elPastePlayersModal) {
    elPastePlayersModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-close-paste]")) {
        closePastePlayersModal();
      }
    });
  }
  if (elTeamManagerDup) {
    elTeamManagerDup.addEventListener("click", () => {
      if (!teamManagerState) {
        openTeamManagerModal(teamManagerScope || "our");
        return;
      }
      const clone = JSON.parse(JSON.stringify(teamManagerState.players || []));
      teamManagerState.players = clone.map(p =>
        Object.assign({}, p, {
          id: typeof generatePlayerId === "function" ? generatePlayerId() : Date.now() + "_" + Math.random(),
          name: (p.name || "").trim() + " (dup)",
          firstName: p.firstName || splitNameParts(p.name || "").firstName || "",
          lastName: p.lastName || splitNameParts(p.name || "").lastName || ""
        })
      );
      renderTeamManagerTable();
    });
  }
  if (elTeamManagerTemplate) {
    elTeamManagerTemplate.addEventListener("click", () => {
      const playersDetailed = TEMPLATE_TEAM.players.map((name, idx) => {
        const parts = splitNameParts(name);
        return {
          id: typeof generatePlayerId === "function" ? generatePlayerId() : idx + "_" + name,
          name,
          firstName: parts.firstName || "",
          lastName: parts.lastName || name,
          number: String(idx + 1),
          role: TEMPLATE_TEAM.liberos.includes(name) ? "L" : "",
          isCaptain: idx === 0,
          out: false
        };
      });
      teamManagerState = {
        name: teamManagerScope === "opponent" ? state.selectedOpponentTeam || "Avversaria" : state.selectedTeam || "Squadra",
        staff: Object.assign({}, DEFAULT_STAFF),
        players: playersDetailed,
        defaultRotation: 1,
        defaultLineup:
          typeof buildRoleBasedDefaultLineup === "function"
            ? buildRoleBasedDefaultLineup(TEMPLATE_TEAM.players)
            : TEMPLATE_TEAM.players.slice(0, 6)
      };
      renderTeamManagerTable();
    });
  }
  if (elBtnDeleteTeam) {
    elBtnDeleteTeam.addEventListener("click", deleteSelectedTeam);
  }
  if (elBtnDeleteOpponentTeam) {
    elBtnDeleteOpponentTeam.addEventListener("click", deleteSelectedOpponentTeam);
  }
  if (elBtnRenameOpponentTeam) {
    elBtnRenameOpponentTeam.addEventListener("click", renameSelectedOpponentTeam);
  }
  if (elBtnExportTeam) {
    elBtnExportTeam.addEventListener("click", exportCurrentTeamToFile);
  }
  if (elBtnExportOpponentTeam) {
    elBtnExportOpponentTeam.addEventListener("click", exportCurrentOpponentTeamToFile);
  }
  if (elBtnImportTeam && elTeamFileInput) {
    elBtnImportTeam.addEventListener("click", () => {
      elTeamFileInput.value = "";
      elTeamFileInput.click();
    });
    elTeamFileInput.addEventListener("change", e => {
      const input = e.target;
      const file = input && input.files && input.files[0];
      if (file) importTeamFromFile(file);
    });
  }
  if (elBtnImportOpponentTeam && elOpponentTeamFileInput) {
    elBtnImportOpponentTeam.addEventListener("click", () => {
      elOpponentTeamFileInput.value = "";
      elOpponentTeamFileInput.click();
    });
    elOpponentTeamFileInput.addEventListener("change", e => {
      const input = e.target;
      const file = input && input.files && input.files[0];
      if (file) importOpponentTeamFromFile(file);
    });
  }
  if (elBtnDeleteMatch) {
    elBtnDeleteMatch.addEventListener("click", deleteSelectedMatch);
  }
  if (elBtnExportDb) {
    elBtnExportDb.addEventListener("click", exportDatabaseToFile);
  }
  if (elBtnImportDb && elDbFileInput) {
    elBtnImportDb.addEventListener("click", () => {
      elDbFileInput.value = "";
      elDbFileInput.click();
    });
    elDbFileInput.addEventListener("change", e => {
      const input = e.target;
      const file = input && input.files && input.files[0];
      if (file) handleImportDatabaseFile(file);
    });
  }
  if (elBtnOpenMatchManager) {
    elBtnOpenMatchManager.addEventListener("click", openMatchManagerModal);
  }
  const elBtnOpenTeamsManager = document.getElementById("btn-open-teams-manager");
  if (elBtnOpenTeamsManager) {
    elBtnOpenTeamsManager.addEventListener("click", openTeamsManagerModal);
  }
  const elBtnOpenPlayersDb = document.getElementById("btn-open-players-db");
  if (elBtnOpenPlayersDb) {
    elBtnOpenPlayersDb.addEventListener("click", openPlayersDbModal);
  }
  if (elMatchManagerClose) {
    elMatchManagerClose.addEventListener("click", closeMatchManagerModal);
  }
  if (elPlayersDbClose) {
    elPlayersDbClose.addEventListener("click", closePlayersDbModal);
  }
  if (elPlayersDbClean) {
    elPlayersDbClean.addEventListener("click", removeOrphanPlayersFromDb);
  }
  if (elTeamsManagerClose) {
    elTeamsManagerClose.addEventListener("click", closeTeamsManagerModal);
  }
  if (elMatchManagerModal) {
    elMatchManagerModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.closeMatchManager !== undefined) {
        closeMatchManagerModal();
      }
    });
  }
  if (elPlayersDbModal) {
    elPlayersDbModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.closePlayersDb !== undefined) {
        closePlayersDbModal();
      }
    });
  }
  if (elTeamsManagerModal) {
    elTeamsManagerModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.closeTeamsManager !== undefined) {
        closeTeamsManagerModal();
      }
    });
  }
  if (elTeamsManagerDelete) {
    elTeamsManagerDelete.addEventListener("click", () => {
      const name = teamsManagerSelectedName;
      if (!name) return;
      const ok = confirm("Eliminare la squadra \"" + name + "\"?");
      if (!ok) return;
      if (typeof deleteTeamFromStorage === "function") {
        deleteTeamFromStorage(name);
      }
      if (state.selectedTeam === name) {
        state.selectedTeam = "";
      }
      if (state.selectedOpponentTeam === name) {
        state.selectedOpponentTeam = "";
      }
      if (typeof syncTeamsFromStorage === "function") syncTeamsFromStorage();
      if (typeof renderTeamsSelect === "function") renderTeamsSelect();
      if (typeof renderOpponentTeamsSelect === "function") renderOpponentTeamsSelect();
      renderTeamsManagerList();
    });
  }
  if (elTeamsManagerDuplicate) {
    elTeamsManagerDuplicate.addEventListener("click", () => {
      const name = teamsManagerSelectedName;
      if (!name) return;
      const team = typeof loadTeamFromStorage === "function" ? loadTeamFromStorage(name) : null;
      if (!team) {
        alert("Squadra non trovata o corrotta.");
        return;
      }
      let newName = prompt("Nome della nuova squadra:", name + " (copia)") || "";
      newName = newName.trim();
      if (!newName) return;
      if (newName === name) {
        alert("Scegli un nome diverso per la copia.");
        return;
      }
      const names = typeof listTeamsFromStorage === "function" ? listTeamsFromStorage() : [];
      if (names.includes(newName)) {
        const ok = confirm("Esiste già una squadra con questo nome. Sovrascrivere?");
        if (!ok) return;
      }
      if (typeof saveTeamToStorage === "function") {
        saveTeamToStorage(newName, team);
      }
      if (typeof syncTeamsFromStorage === "function") syncTeamsFromStorage();
      if (typeof renderTeamsSelect === "function") renderTeamsSelect();
      teamsManagerSelectedName = newName;
      renderTeamsManagerList();
    });
  }
  if (elTeamsManagerExport) {
    elTeamsManagerExport.addEventListener("click", () => {
      const name = teamsManagerSelectedName;
      if (!name) return;
      const team = typeof loadTeamFromStorage === "function" ? loadTeamFromStorage(name) : null;
      if (!team) {
        alert("Squadra non trovata o corrotta.");
        return;
      }
      const payload = typeof compactTeamPayload === "function" ? compactTeamPayload(team, name) : team;
      const slug = (name || "squadra").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
      if (typeof downloadBlob === "function") {
        downloadBlob(blob, "squadra_" + (slug || "export") + ".json");
      }
    });
  }
  if (elTeamsManagerImport && elTeamsManagerFileInput) {
    elTeamsManagerImport.addEventListener("click", () => {
      elTeamsManagerFileInput.value = "";
      elTeamsManagerFileInput.click();
    });
    elTeamsManagerFileInput.addEventListener("change", e => {
      const input = e.target;
      const file = input && input.files && input.files[0];
      if (file) {
        importTeamToStorageOnly(file);
      }
      renderTeamsManagerList();
    });
  }
  if (elTeamsManagerOpenPlayersDb) {
    elTeamsManagerOpenPlayersDb.addEventListener("click", openPlayersDbModal);
  }
  if (elSavedMatchesList) {
    elSavedMatchesList.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest(".match-list-open");
      if (!btn) return;
      const name = btn.dataset.matchName || "";
      if (elSavedMatchesSelect) {
        elSavedMatchesSelect.value = name;
      }
      state.selectedMatch = name;
      if (typeof renderMatchesList === "function") {
        renderMatchesList(Object.keys(state.savedMatches || {}), name);
      }
      updateMatchButtonsState();
    });
  }
  if (elBtnSaveMatchInfo) {
    elBtnSaveMatchInfo.addEventListener("click", () => {
      const selectedName = (elSavedMatchesSelect && elSavedMatchesSelect.value) || state.selectedMatch || "";
      if (selectedName) {
        state.selectedMatch = selectedName;
      }
      saveMatchInfoFromUI();
      if (typeof saveMatchToStorage === "function" && typeof buildMatchExportPayload === "function") {
        const matchInfo = getMatchInfoFromInputs();
        const desiredName =
          state.selectedMatch ||
          (typeof generateMatchName === "function" ? generateMatchName("") : "") ||
          "Match";
        const payload = buildMatchExportPayload();
        payload.name = desiredName;
        payload.state.match = Object.assign({}, payload.state.match || {}, matchInfo);
        state.match = Object.assign({}, payload.state.match);
        state.selectedMatch = desiredName;
        state.savedMatches = state.savedMatches || {};
        state.savedMatches[desiredName] = payload;
        saveMatchToStorage(desiredName, payload);
        syncMatchInfoInputs(payload.state.match);
      } else if (typeof persistCurrentMatch === "function") {
        persistCurrentMatch();
      }
      if (typeof renderMatchesSelect === "function") renderMatchesSelect();
      if (typeof renderMatchSummary === "function") renderMatchSummary();
      alert("Info match salvate.");
    });
  }
  if (elBtnNewMatch) {
    elBtnNewMatch.addEventListener("click", () => {
      if (!elSavedMatchesSelect) return;
      elSavedMatchesSelect.value = "";
      loadSelectedMatch();
    });
  }
  if (elBtnLoadMatch) {
    elBtnLoadMatch.addEventListener("click", () => {
      loadSelectedMatch();
    });
  }
  if (elTeamsSelect) {
    elTeamsSelect.addEventListener("change", handleTeamSelectChange);
  }
  if (elOpponentTeamsSelect) {
    elOpponentTeamsSelect.addEventListener("change", () => {
      handleOpponentTeamSelectChange();
    });
  }
  if (elSavedMatchesSelect) {
    elSavedMatchesSelect.addEventListener("change", () => {
      updateMatchButtonsState();
      state.selectedMatch = elSavedMatchesSelect.value || "";
      if (typeof renderMatchesList === "function") {
        renderMatchesList(Object.keys(state.savedMatches || {}), state.selectedMatch);
      }
    });
  }
  window.addEventListener("resize", () => {
    updateCourtModalPlacement();
  });
  if (elBtnRotateCw) {
    elBtnRotateCw.addEventListener("click", () => rotateCourt("cw"));
  }
  if (elBtnRotateCcw) {
    elBtnRotateCcw.addEventListener("click", () => rotateCourt("ccw"));
  }
  if (typeof elBtnRotateCwOpp !== "undefined" && elBtnRotateCwOpp) {
    elBtnRotateCwOpp.addEventListener("click", () => {
      if (typeof rotateOpponentCourt === "function") {
        rotateOpponentCourt("cw");
        return;
      }
      rotateCourt("cw");
    });
  }
  if (typeof elBtnRotateCcwOpp !== "undefined" && elBtnRotateCcwOpp) {
    elBtnRotateCcwOpp.addEventListener("click", () => {
      if (typeof rotateOpponentCourt === "function") {
        rotateOpponentCourt("ccw");
        return;
      }
      rotateCourt("ccw");
    });
  }
  if (elBtnRotateCwModal) {
    elBtnRotateCwModal.addEventListener("click", () => rotateCourt("cw"));
  }
  if (elBtnRotateCcwModal) {
    elBtnRotateCcwModal.addEventListener("click", () => rotateCourt("ccw"));
  }
  if (elRotationSelect) {
    elRotationSelect.addEventListener("change", () => setRotation(elRotationSelect.value));
  }
  if (typeof elRotationSelectOpp !== "undefined" && elRotationSelectOpp) {
    elRotationSelectOpp.addEventListener("change", () => {
      if (typeof setOpponentRotation === "function") {
        setOpponentRotation(elRotationSelectOpp.value);
        return;
      }
      setRotation(elRotationSelectOpp.value);
    });
  }
  const elAutoRotateToggleSettings = document.getElementById("auto-rotate-toggle-settings");
  if (elAutoRotateToggle) {
    elAutoRotateToggle.addEventListener("change", () => {
      setAutoRotateEnabled(elAutoRotateToggle.checked);
      if (elAutoRotateToggleSettings) {
        elAutoRotateToggleSettings.checked = elAutoRotateToggle.checked;
      }
    });
  }
  if (elAutoRotateToggleSettings) {
    elAutoRotateToggleSettings.checked = !!state.autoRotate;
    elAutoRotateToggleSettings.addEventListener("change", () => {
      setAutoRotateEnabled(elAutoRotateToggleSettings.checked);
      if (elAutoRotateToggle) {
        elAutoRotateToggle.checked = elAutoRotateToggleSettings.checked;
      }
    });
  }
  // Mobile controls rimossi
  const elAutoRoleToggle = document.getElementById("auto-role-toggle");
  const elAutoRoleToggleSettings = document.getElementById("auto-role-toggle-settings");
  if (elAutoRoleToggle) {
    elAutoRoleToggle.checked = !!state.autoRolePositioning;
    elAutoRoleToggle.addEventListener("change", () => {
      const enabled = elAutoRoleToggle.checked;
      if (elAutoRoleToggleSettings) {
        elAutoRoleToggleSettings.checked = enabled;
      }
      if (typeof setAutoRolePositioning === "function") {
        setAutoRolePositioning(enabled);
      } else {
        state.autoRolePositioning = enabled;
        saveState();
      }
      if (enabled && typeof applyAutoRolePositioning === "function") {
        applyAutoRolePositioning();
      }
    });
  }
  if (elAutoRoleToggleSettings) {
    elAutoRoleToggleSettings.checked = !!state.autoRolePositioning;
    elAutoRoleToggleSettings.addEventListener("change", () => {
      const enabled = elAutoRoleToggleSettings.checked;
      if (elAutoRoleToggle) {
        elAutoRoleToggle.checked = enabled;
      }
      if (typeof setAutoRolePositioning === "function") {
        setAutoRolePositioning(enabled);
      } else {
        state.autoRolePositioning = enabled;
        saveState();
      }
      if (enabled && typeof applyAutoRolePositioning === "function") {
        applyAutoRolePositioning();
      }
    });
  }
  const elAutoLiberoSelect = document.getElementById("auto-libero-select");
  const elAutoLiberoSelectOpp = document.getElementById("auto-libero-select-opp");
  const elAutoLiberoSelectSettings = document.getElementById("auto-libero-select-settings");
  const elSwapLibero = document.getElementById("btn-swap-libero");
  const elSwapLiberoOpp = document.getElementById("btn-swap-libero-opp");
  const elSwapLiberoSettings = document.getElementById("btn-swap-libero-settings");
  const elLiberoToBench = document.getElementById("btn-libero-to-bench");
  const syncAutoLiberoSelects = role => {
    if (elAutoLiberoSelect) elAutoLiberoSelect.value = role || "";
    if (elAutoLiberoSelectSettings) elAutoLiberoSelectSettings.value = role || "";
  };
  const syncOpponentAutoLiberoSelect = role => {
    if (elAutoLiberoSelectOpp) elAutoLiberoSelectOpp.value = role || "";
  };
  syncAutoLiberoSelects(state.autoLiberoRole || "");
  syncOpponentAutoLiberoSelect(state.opponentAutoLiberoRole || "");
  [elAutoLiberoSelect, elAutoLiberoSelectSettings].forEach(sel => {
    if (!sel) return;
    sel.addEventListener("change", () => {
      const role = sel.value || "";
      if (typeof setAutoLiberoRole === "function") {
        setAutoLiberoRole(role);
      } else {
        state.autoLiberoRole = role;
        state.autoLiberoBackline = role !== "" ? true : state.autoLiberoBackline;
        state.liberoAutoMap = {};
        saveState();
        if (typeof enforceAutoLiberoForState === "function") {
          enforceAutoLiberoForState({ skipServerOnServe: true });
        }
        renderPlayers();
        renderBenchChips();
        renderLiberoChipsInline();
        renderLineupChips();
      }
      syncAutoLiberoSelects(role);
    });
  });
  if (elAutoLiberoSelectOpp) {
    elAutoLiberoSelectOpp.addEventListener("change", () => {
      const role = elAutoLiberoSelectOpp.value || "";
      if (typeof setTeamAutoLiberoRole === "function") {
        setTeamAutoLiberoRole("opponent", role);
      } else {
        state.opponentAutoLiberoRole = role;
      }
      if (typeof setTeamAutoLiberoBackline === "function") {
        setTeamAutoLiberoBackline("opponent", role !== "");
      } else if (role !== "") {
        state.opponentAutoLiberoBackline = true;
      }
      if (typeof setTeamLiberoAutoMap === "function") {
        setTeamLiberoAutoMap("opponent", {});
      } else {
        state.opponentLiberoAutoMap = {};
      }
      if (typeof enforceAutoLiberoForScope === "function") {
        enforceAutoLiberoForScope("opponent", { skipServerOnServe: true });
      }
      saveState();
      syncOpponentAutoLiberoSelect(role);
      if (typeof renderOpponentPlayers === "function") renderOpponentPlayers();
    });
  }
  [elSwapLibero, elSwapLiberoSettings].forEach(btn => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (typeof swapPreferredLibero === "function") {
        swapPreferredLibero();
        syncAutoLiberoSelects(state.autoLiberoRole || "");
      }
    });
  });
  if (elSwapLiberoOpp) {
    elSwapLiberoOpp.addEventListener("click", () => {
      if (typeof swapPreferredLiberoForScope === "function") {
        swapPreferredLiberoForScope("opponent");
        return;
      }
      state.opponentPreferredLibero = "";
      saveState();
    });
  }
  if (elLiberoToBench) {
    elLiberoToBench.addEventListener("click", () => {
      if (typeof sendLiberoToBench === "function") {
        sendLiberoToBench();
      }
    });
  }
  const elAutoRoleP1AmericanToggle = document.getElementById("auto-role-p1american-toggle");
  const elAutoRoleP1AmericanToggleOpp = document.getElementById("auto-role-p1american-toggle-opp");
  const elAutoRoleP1AmericanToggleSettings = document.getElementById("auto-role-p1american-toggle-settings");
  if (elAutoRoleP1AmericanToggle) {
    elAutoRoleP1AmericanToggle.checked = !!state.autoRoleP1American;
    elAutoRoleP1AmericanToggle.addEventListener("change", () => {
      if (elAutoRoleP1AmericanToggleSettings) {
        elAutoRoleP1AmericanToggleSettings.checked = elAutoRoleP1AmericanToggle.checked;
      }
      if (typeof setAutoRoleP1American === "function") {
        setAutoRoleP1American(!!elAutoRoleP1AmericanToggle.checked);
      } else {
        state.autoRoleP1American = !!elAutoRoleP1AmericanToggle.checked;
        saveState();
      }
    });
  }
  if (elAutoRoleP1AmericanToggleSettings) {
    elAutoRoleP1AmericanToggleSettings.checked = !!state.autoRoleP1American;
    elAutoRoleP1AmericanToggleSettings.addEventListener("change", () => {
      if (elAutoRoleP1AmericanToggle) {
        elAutoRoleP1AmericanToggle.checked = elAutoRoleP1AmericanToggleSettings.checked;
      }
      if (typeof setAutoRoleP1American === "function") {
        setAutoRoleP1American(!!elAutoRoleP1AmericanToggleSettings.checked);
      } else {
        state.autoRoleP1American = !!elAutoRoleP1AmericanToggleSettings.checked;
        saveState();
      }
    });
  }
  if (elAutoRoleP1AmericanToggleOpp) {
    elAutoRoleP1AmericanToggleOpp.checked = !!state.opponentAutoRoleP1American;
    elAutoRoleP1AmericanToggleOpp.addEventListener("change", () => {
      state.opponentAutoRoleP1American = !!elAutoRoleP1AmericanToggleOpp.checked;
      saveState();
    });
  }
  const elPredictiveSkillToggle = document.getElementById("predictive-skill-toggle");
  const elPredictiveSkillToggleSettings = document.getElementById("predictive-skill-toggle-settings");
  if (elPredictiveSkillToggle) {
    elPredictiveSkillToggle.checked = !!state.predictiveSkillFlow;
    elPredictiveSkillToggle.addEventListener("change", () => {
      if (elPredictiveSkillToggleSettings) {
        elPredictiveSkillToggleSettings.checked = elPredictiveSkillToggle.checked;
      }
      state.predictiveSkillFlow = !!elPredictiveSkillToggle.checked;
      if (!state.predictiveSkillFlow) state.skillFlowOverride = null;
      saveState();
      renderPlayers();
    });
  }
  if (elPredictiveSkillToggleSettings) {
    elPredictiveSkillToggleSettings.checked = !!state.predictiveSkillFlow;
    elPredictiveSkillToggleSettings.addEventListener("change", () => {
      if (elPredictiveSkillToggle) {
        elPredictiveSkillToggle.checked = elPredictiveSkillToggleSettings.checked;
      }
      state.predictiveSkillFlow = !!elPredictiveSkillToggleSettings.checked;
      if (!state.predictiveSkillFlow) state.skillFlowOverride = null;
      saveState();
      renderPlayers();
    });
  }
  const elAttackTrajectoryToggle = document.getElementById("attack-trajectory-toggle");
  const elAttackTrajectoryToggleOpp = document.getElementById("attack-trajectory-toggle-opp");
  const elAttackTrajectoryToggleSettings = document.getElementById("attack-trajectory-toggle-settings");
  const elAttackTrajectorySimpleToggle = document.getElementById("attack-trajectory-simple-toggle");
  const elAttackTrajectorySimpleToggleSettings = document.getElementById("attack-trajectory-simple-toggle-settings");
  const elServeTrajectoryToggleInline = document.getElementById("serve-trajectory-toggle-inline");
  const elServeTrajectoryToggleInlineOpp = document.getElementById("serve-trajectory-toggle-inline-opp");
  if (elAttackTrajectoryToggle) {
    elAttackTrajectoryToggle.checked = !!state.attackTrajectoryEnabled;
    elAttackTrajectoryToggle.addEventListener("change", () => {
      if (elAttackTrajectoryToggleSettings) {
        elAttackTrajectoryToggleSettings.checked = elAttackTrajectoryToggle.checked;
      }
      state.attackTrajectoryEnabled = !!elAttackTrajectoryToggle.checked;
      saveState();
    });
  }
  if (elAttackTrajectoryToggleOpp) {
    elAttackTrajectoryToggleOpp.checked = !!state.opponentAttackTrajectoryEnabled;
    elAttackTrajectoryToggleOpp.addEventListener("change", () => {
      state.opponentAttackTrajectoryEnabled = !!elAttackTrajectoryToggleOpp.checked;
      saveState();
    });
  }
  if (elAttackTrajectoryToggleSettings) {
    elAttackTrajectoryToggleSettings.checked = !!state.attackTrajectoryEnabled;
    elAttackTrajectoryToggleSettings.addEventListener("change", () => {
      if (elAttackTrajectoryToggle) {
        elAttackTrajectoryToggle.checked = elAttackTrajectoryToggleSettings.checked;
      }
      state.attackTrajectoryEnabled = !!elAttackTrajectoryToggleSettings.checked;
      saveState();
    });
  }
  if (elAttackTrajectorySimpleToggle) {
    elAttackTrajectorySimpleToggle.checked = !!state.attackTrajectorySimplified;
    elAttackTrajectorySimpleToggle.addEventListener("change", () => {
      if (elAttackTrajectorySimpleToggleSettings) {
        elAttackTrajectorySimpleToggleSettings.checked = elAttackTrajectorySimpleToggle.checked;
      }
      state.attackTrajectorySimplified = !!elAttackTrajectorySimpleToggle.checked;
      saveState();
    });
  }
  if (elAttackTrajectorySimpleToggleSettings) {
    elAttackTrajectorySimpleToggleSettings.checked = !!state.attackTrajectorySimplified;
    elAttackTrajectorySimpleToggleSettings.addEventListener("change", () => {
      if (elAttackTrajectorySimpleToggle) {
        elAttackTrajectorySimpleToggle.checked = elAttackTrajectorySimpleToggleSettings.checked;
      }
      state.attackTrajectorySimplified = !!elAttackTrajectorySimpleToggleSettings.checked;
      saveState();
    });
  }
  const syncServeTrajectoryToggles = value => {
    state.serveTrajectoryEnabled = !!value;
    if (elServeTrajectoryToggleInline) elServeTrajectoryToggleInline.checked = !!value;
    saveState();
  };
  const elSetTypePromptToggleInline = document.getElementById("settype-prompt-toggle-inline");
  const elSetTypePromptToggleInlineOpp = document.getElementById("settype-prompt-toggle-inline-opp");
  const syncSetTypePromptToggle = value => {
    state.setTypePromptEnabled = !!value;
    if (elSetTypePromptToggleInline) elSetTypePromptToggleInline.checked = !!value;
    saveState();
    renderPlayers();
  };
  const syncOpponentSetTypePromptToggle = value => {
    state.opponentSetTypePromptEnabled = !!value;
    if (elSetTypePromptToggleInlineOpp) elSetTypePromptToggleInlineOpp.checked = !!value;
    saveState();
  };
  const opponentSkillToggles = [
    { id: "serve", el: elOpponentSkillServe },
    { id: "pass", el: elOpponentSkillPass },
    { id: "attack", el: elOpponentSkillAttack },
    { id: "defense", el: elOpponentSkillDefense },
    { id: "block", el: elOpponentSkillBlock },
    { id: "second", el: elOpponentSkillSecond }
  ];
  const syncOpponentSkillToggles = () => {
    state.opponentSkillConfig = state.opponentSkillConfig || {};
    opponentSkillToggles.forEach(item => {
      if (!item.el) return;
      const enabled = state.opponentSkillConfig[item.id] !== false;
      item.el.checked = enabled;
    });
  };
  const updateOpponentSkillToggle = (skillId, enabled) => {
    state.opponentSkillConfig = state.opponentSkillConfig || {};
    state.opponentSkillConfig[skillId] = !!enabled;
    saveState();
  };
  if (elSetTypePromptToggleInline) {
    elSetTypePromptToggleInline.checked = !!state.setTypePromptEnabled;
    elSetTypePromptToggleInline.addEventListener("change", () =>
      syncSetTypePromptToggle(elSetTypePromptToggleInline.checked)
    );
  }
  if (elSetTypePromptToggleInlineOpp) {
    elSetTypePromptToggleInlineOpp.checked = !!state.opponentSetTypePromptEnabled;
    elSetTypePromptToggleInlineOpp.addEventListener("change", () =>
      syncOpponentSetTypePromptToggle(elSetTypePromptToggleInlineOpp.checked)
    );
  }
  opponentSkillToggles.forEach(item => {
    if (!item.el) return;
    item.el.addEventListener("change", () => updateOpponentSkillToggle(item.id, item.el.checked));
  });
  syncOpponentSkillToggles();
  if (elServeTrajectoryToggleInline) {
    elServeTrajectoryToggleInline.checked = !!state.serveTrajectoryEnabled;
    elServeTrajectoryToggleInline.addEventListener("change", () =>
      syncServeTrajectoryToggles(elServeTrajectoryToggleInline.checked)
    );
  }
  if (elServeTrajectoryToggleInlineOpp) {
    elServeTrajectoryToggleInlineOpp.checked = !!state.opponentServeTrajectoryEnabled;
    elServeTrajectoryToggleInlineOpp.addEventListener("change", () => {
      state.opponentServeTrajectoryEnabled = !!elServeTrajectoryToggleInlineOpp.checked;
      saveState();
    });
  }
  if (elUseOpponentTeamToggle) {
    elUseOpponentTeamToggle.checked = !!state.useOpponentTeam;
    elUseOpponentTeamToggle.addEventListener("change", () => {
      state.useOpponentTeam = !!elUseOpponentTeamToggle.checked;
      saveState();
      syncOpponentSettingsUI();
    });
  }
  if (elVideoScoutToggle) {
    elVideoScoutToggle.checked = !!state.videoScoutMode;
    elVideoScoutToggle.addEventListener("change", () => {
      const nextValue = !!elVideoScoutToggle.checked;
      if (state.videoScoutMode && !nextValue) {
        updateVideoPlaybackSnapshot();
      }
      state.videoScoutMode = nextValue;
      saveState();
      updateVideoScoutModeLayout();
    });
  }
  if (elVideoPlayByPlayToggle) {
    elVideoPlayByPlayToggle.checked = !!state.videoPlayByPlay;
    elVideoPlayByPlayToggle.addEventListener("change", () => {
      state.videoPlayByPlay = !!elVideoPlayByPlayToggle.checked;
      saveState();
      if (state.videoPlayByPlay) {
        const active = document && document.body ? document.body.dataset.activeTab : "";
        if (active === "video") {
          startPlayByPlayFromSelection();
        }
      } else {
        stopPlayByPlay();
      }
    });
  }
  if (elUseOpponentTeamToggle || elOpponentTeamSettings) {
    syncOpponentSettingsUI();
  }
  const elForceMobileToggle = document.getElementById("force-mobile-toggle");
  if (elForceMobileToggle) {
    elForceMobileToggle.checked = !!state.forceMobileLayout;
    elForceMobileToggle.addEventListener("change", () => {
      state.forceMobileLayout = !!elForceMobileToggle.checked;
      applyForceMobileLayout(state.forceMobileLayout);
      saveState();
    });
  }
  const elSkillFlowButtons = document.getElementById("skill-flow-buttons");
  const elSkillFlowButtonsOpp = document.getElementById("skill-flow-buttons-opp");
  if (elSkillFlowButtons) {
    elSkillFlowButtons.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const skillId = target.dataset.forceSkill;
      if (!skillId) return;
      forceNextSkill(skillId);
    });
  }
  if (elSkillFlowButtonsOpp) {
    elSkillFlowButtonsOpp.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const skillId = target.dataset.forceSkill;
      if (!skillId) return;
      forceNextSkill(skillId, "opponent");
    });
  }
  if (elBtnFreeball) {
    elBtnFreeball.addEventListener("click", () => {
      triggerFreeballFlow();
    });
  }
  if (elBtnFreeballOpp) {
    elBtnFreeballOpp.addEventListener("click", () => {
      triggerFreeballFlow({ scope: "opponent" });
    });
  }
  if (elBtnToggleCourtView) {
    elBtnToggleCourtView.addEventListener("click", () => {
      state.courtSideSwapped = !state.courtSideSwapped;
      state.courtViewMirrored = !!state.courtSideSwapped;
      state.opponentCourtViewMirrored = !state.courtSideSwapped;
      saveState();
      syncCourtSideLayout();
      renderPlayers();
    });
  }
  if (elBtnTimeout) {
    elBtnTimeout.addEventListener("click", () => {
      recordTimeoutEvent();
    });
  }
  if (elBtnTimeoutOpp) {
    elBtnTimeoutOpp.addEventListener("click", () => {
      recordOpponentTimeoutEvent();
    });
  }
  if (elBtnOffsetSkills) {
    elBtnOffsetSkills.addEventListener("click", openOffsetModal);
  }
  if (elBtnUnifyTimes) {
    elBtnUnifyTimes.addEventListener("click", openUnifyTimesModal);
  }
  if (elBtnSkillDuration) {
    elBtnSkillDuration.addEventListener("click", openSkillDurationModal);
  }
  if (elBtnVideoUndo) {
    elBtnVideoUndo.addEventListener("click", undoLastVideoEdit);
  }
  if (elBtnOpenSettings) {
    elBtnOpenSettings.addEventListener("click", () => {
      if (typeof openSettingsModal === "function") openSettingsModal();
    });
  }
  if (elSettingsClose) {
    elSettingsClose.addEventListener("click", () => {
      if (typeof closeSettingsModal === "function") closeSettingsModal();
    });
  }
  if (elSettingsModal) {
    elSettingsModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.closeSettings !== undefined || target.classList.contains("settings-modal__backdrop")) {
        if (typeof closeSettingsModal === "function") closeSettingsModal();
      }
    });
  }
  if (elOffsetModal) {
    elOffsetModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.closeOffset !== undefined || target.classList.contains("settings-modal__backdrop")) {
        closeOffsetModal();
      }
    });
  }
  if (elUnifyTimesModal) {
    elUnifyTimesModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.closeUnifyTimes !== undefined || target.classList.contains("settings-modal__backdrop")) {
        closeUnifyTimesModal();
      }
    });
  }
  if (elSkillDurationModal) {
    elSkillDurationModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.closeSkillDuration !== undefined || target.classList.contains("settings-modal__backdrop")) {
        closeSkillDurationModal();
      }
    });
  }
  if (elOffsetClose) {
    elOffsetClose.addEventListener("click", closeOffsetModal);
  }
  if (elUnifyTimesClose) {
    elUnifyTimesClose.addEventListener("click", closeUnifyTimesModal);
  }
  if (elSkillDurationClose) {
    elSkillDurationClose.addEventListener("click", closeSkillDurationModal);
  }
  if (elOffsetApply) {
    elOffsetApply.addEventListener("click", applyOffsetsToSelectedSkills);
  }
  if (elUnifyTimesApply) {
    elUnifyTimesApply.addEventListener("click", applyUnifyTimes);
  }
  if (elSkillDurationApply) {
    elSkillDurationApply.addEventListener("click", applySkillDurationDefaults);
  }
  if (elAttackTrajectoryModal) {
    const handleCloseTrajectory = () => closeAttackTrajectoryModal(null);
    const getPos = e => {
      if (!elAttackTrajectoryCanvas) return null;
      const rect = elAttackTrajectoryCanvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
      if (clientX == null || clientY == null) return null;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const onPointerDown = e => {
      const pos = getPos(e);
      if (!pos || !elAttackTrajectoryCanvas) return;
      if (trajectoryMode === "serve-start") {
        trajectoryStart = pos;
        trajectoryEnd = null;
        trajectoryDragging = true;
        drawTrajectory();
        e.preventDefault();
        return;
      }
      if (trajectoryMode === "serve-end") {
        trajectoryStart = null;
        trajectoryEnd = pos;
        trajectoryDragging = true;
        drawTrajectory();
        e.preventDefault();
        return;
      }
      if (state.attackTrajectorySimplified) {
        if (!trajectoryStart) {
          if (!trajectoryNetPointId) {
            const defaultNetPoint = getDefaultTrajectoryNetPointId(trajectoryBaseZone, trajectorySetType);
            setTrajectoryNetPointId(defaultNetPoint);
          }
          applyTrajectoryStartFromNetPoint();
        }
        trajectoryDragging = true;
        trajectoryEnd = pos;
        drawTrajectory(pos);
        e.preventDefault();
        return;
      }
      if (!trajectoryStart || trajectoryEnd) {
        const box = getTrajectoryDisplayBox();
        const w = box ? box.width : elAttackTrajectoryCanvas.clientWidth || elAttackTrajectoryCanvas.width || 1;
        const startFromTop = trajectoryMirror || trajectoryForceFar;
        const fixedY = box
          ? box.offsetY + (startFromTop ? 0.5 : box.height - 0.5)
          : startFromTop
            ? 0.5
            : elAttackTrajectoryCanvas.height - 0.5; // partenza forzata sul bordo basso
        trajectoryStart = { x: pos.x, y: fixedY };
        trajectoryEnd = null;
        const xWithinStage = box ? pos.x - box.offsetX : pos.x;
        const third = xWithinStage < w / 3 ? 0 : xWithinStage < (2 * w) / 3 ? 1 : 2;
        const isFarSide = trajectoryForceFar;
        const leftZone = isFarSide ? 5 : 4;
        const midZone = isFarSide ? 6 : 3;
        const rightZone = isFarSide ? 1 : 2;
        const zoneFromClickRaw = startFromTop
          ? third === 0
            ? rightZone
            : third === 1
              ? midZone
              : leftZone
          : third === 0
            ? leftZone
            : third === 1
              ? midZone
              : rightZone;
        const imgSrc = getTrajectoryImageForZone(
          zoneFromClickRaw,
          trajectoryMirror || trajectoryForceFar
        ); // mostra il campo della zona front-row
        if (elAttackTrajectoryImage && elAttackTrajectoryImage.dataset.activeSrc !== imgSrc) {
          elAttackTrajectoryImage.dataset.activeSrc = imgSrc;
          elAttackTrajectoryImage.src = imgSrc;
        }
      }
      trajectoryDragging = true;
      drawTrajectory();
      e.preventDefault();
    };
    const onPointerMove = e => {
      if (!trajectoryDragging || (!trajectoryStart && !trajectoryEnd)) return;
      const pos = getPos(e);
      if (!pos) return;
      if (trajectoryMode === "serve-start") {
        trajectoryStart = pos;
        drawTrajectory();
        e.preventDefault();
        return;
      }
      if (trajectoryMode === "serve-end") {
        trajectoryEnd = pos;
        drawTrajectory();
        e.preventDefault();
        return;
      }
      drawTrajectory(pos);
      e.preventDefault();
    };
    const onPointerUp = e => {
      if (!trajectoryDragging || (!trajectoryStart && !trajectoryEnd)) return;
      const pos = getPos(e);
      trajectoryDragging = false;
      if (!pos) return;
      if (trajectoryMode === "serve-start") {
        trajectoryStart = pos;
        drawTrajectory();
        e.preventDefault();
        confirmCurrentTrajectory();
        return;
      }
      if (trajectoryMode === "serve-end") {
        trajectoryEnd = pos;
        drawTrajectory();
        e.preventDefault();
        confirmCurrentTrajectory();
        return;
      }
      trajectoryEnd = pos;
      drawTrajectory();
      e.preventDefault();
      confirmCurrentTrajectory();
    };
    if (elAttackTrajectoryCanvas) {
      elAttackTrajectoryCanvas.addEventListener("pointerdown", onPointerDown);
      elAttackTrajectoryCanvas.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }
    if (elAttackTrajectoryNetpoints) {
      const buttons = elAttackTrajectoryNetpoints.querySelectorAll("[data-net-point]");
      buttons.forEach(btn => {
        btn.addEventListener("click", () => {
          const netId = btn.dataset.netPoint || "";
          if (!netId) return;
          setTrajectoryNetPointId(netId);
          trajectoryEnd = null;
          applyTrajectoryStartFromNetPoint();
        });
      });
    }
    const confirmCurrentTrajectory = () => {
      if (trajectoryMode === "serve-start") {
        if (!trajectoryStart) return;
        const rawPoint = normalizeTrajectoryPoint(trajectoryStart);
        const mirrorForStorage = trajectoryMirror || trajectoryForceFar;
        const point = mirrorForStorage ? mirrorTrajectoryPoint(rawPoint) : rawPoint;
        closeAttackTrajectoryModal({ point, serveType: serveTrajectoryType });
        return;
      }
      if (trajectoryMode === "serve-end") {
        const pt = trajectoryEnd || trajectoryStart;
        if (!pt) return;
        const rawPoint = normalizeTrajectoryPoint(pt);
        const mirrorForStorage = trajectoryMirror || trajectoryForceFar;
        const point = mirrorForStorage ? mirrorTrajectoryPoint(rawPoint) : rawPoint;
        closeAttackTrajectoryModal({ point });
        return;
      }
      if (!trajectoryStart || !trajectoryEnd) return;
      const rawStart = normalizeTrajectoryPoint(trajectoryStart);
      const rawEnd = normalizeTrajectoryPoint(trajectoryEnd);
      const mirrorForStorage = trajectoryMirror || trajectoryForceFar;
      const start = mirrorForStorage ? mirrorTrajectoryPoint(rawStart) : rawStart;
      const end = mirrorForStorage ? mirrorTrajectoryPoint(rawEnd) : rawEnd;
      const isFar = false;
      const startZone = mapBackRowZone(getAttackZone(start, isFar), trajectoryBaseZone);
      const endZone = mapBackRowZone(getAttackZone(end, isFar), trajectoryBaseZone);
      const directionDeg = computeAttackDirectionDeg(start, end);
      closeAttackTrajectoryModal({
        start,
        end,
        startZone,
        endZone,
        directionDeg
      });
    };
    if (elAttackTrajectoryImage) {
      elAttackTrajectoryImage.addEventListener("load", resizeTrajectoryCanvas);
    }
    window.addEventListener("resize", resizeTrajectoryCanvas);
    [elAttackTrajectoryClose, elAttackTrajectoryModal.querySelector("[data-close-trajectory]")].forEach(btn => {
      if (btn) btn.addEventListener("click", handleCloseTrajectory);
    });
    if (elAttackTrajectoryCloseBtn) {
      elAttackTrajectoryCloseBtn.addEventListener("click", handleCloseTrajectory);
    }
  }
  setAutoRotateEnabled(state.autoRotate !== false);
  if (elRotationIndicator && elRotationSelect) {
    const openSelect = () => {
      elRotationSelect.focus();
      elRotationSelect.click();
    };
    elRotationIndicator.addEventListener("click", openSelect);
    elRotationIndicator.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openSelect();
      }
    });
  }
  // elementi mobile rimossi
  if (elBtnExportPdf) elBtnExportPdf.addEventListener("click", exportAnalysisPdf);
  if (elBtnExportMatch) elBtnExportMatch.addEventListener("click", exportMatchToFile);
  if (elBtnImportMatch && elMatchFileInput) {
    elBtnImportMatch.addEventListener("click", () => elMatchFileInput.click());
    elMatchFileInput.addEventListener("change", e => {
      const file = e.target && e.target.files && e.target.files[0];
      if (file) handleImportMatchFile(file);
    });
  }
  if (elBtnResetMatch) elBtnResetMatch.addEventListener("click", resetMatch);
  if (elBtnUndo) elBtnUndo.addEventListener("click", undoLastEvent);
  // pulsanti lineup mobile rimossi
  const elMobileMenuBtn = document.getElementById("btn-open-menu-mobile");
  const elMobileLogBtn = document.getElementById("btn-open-log-mobile");
  const elDrawerBackdrop = document.getElementById("scout-drawer-backdrop");
  const closeDrawers = () => {
    document.body.classList.remove("drawer-menu-open", "drawer-log-open");
  };
  if (elMobileMenuBtn) {
    elMobileMenuBtn.addEventListener("click", () => {
      document.body.classList.toggle("drawer-menu-open");
      document.body.classList.remove("drawer-log-open");
    });
  }
  if (elMobileLogBtn) {
    elMobileLogBtn.addEventListener("click", () => {
      document.body.classList.toggle("drawer-log-open");
      document.body.classList.remove("drawer-menu-open");
    });
  }
  if (elDrawerBackdrop) {
    elDrawerBackdrop.addEventListener("click", closeDrawers);
  }
  document.querySelectorAll("[data-close-drawer]").forEach(btn => {
    btn.addEventListener("click", closeDrawers);
  });
  if (elAggTabButtons && typeof elAggTabButtons.forEach === "function") {
    elAggTabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.aggTabTarget) {
          setActiveAggTab(btn.dataset.aggTabTarget);
        }
      });
    });
  }
  if (elBtnScoreForPlusModal) elBtnScoreForPlusModal.addEventListener("click", () => handleManualScore("for", 1));
  if (elBtnScoreForMinusModal) elBtnScoreForMinusModal.addEventListener("click", () => handleManualScore("for", -1));
  if (elBtnScoreAgainstPlusModal) elBtnScoreAgainstPlusModal.addEventListener("click", () => handleManualScore("against", 1));
  if (elBtnScoreAgainstMinusModal) elBtnScoreAgainstMinusModal.addEventListener("click", () => handleManualScore("against", -1));
  if (elBtnScoreTeamPointModal) {
    elBtnScoreTeamPointModal.addEventListener("click", openPointModal);
  }
  if (elVideoFileInput) {
    elVideoFileInput.addEventListener("change", e => {
      const input = e.target;
      const file = input && input.files && input.files[0];
      if (file) {
        handleVideoFileChange(file);
      }
      if (input) {
        input.value = "";
      }
    });
  }
  if (elVideoFileInputScout) {
    elVideoFileInputScout.addEventListener("change", e => {
      const input = e.target;
      const file = input && input.files && input.files[0];
      if (file) {
        handleVideoFileChange(file);
      }
      if (input) {
        input.value = "";
      }
    });
  }
  if (elBtnSyncFirstSkill) {
    elBtnSyncFirstSkill.addEventListener("click", syncFirstSkillToVideo);
  }
  if (elBtnCopyFfmpeg) {
    elBtnCopyFfmpeg.addEventListener("click", copyFfmpegFromSelection);
  }
  if (elBtnLoadYoutube) {
    elBtnLoadYoutube.addEventListener("click", () => {
      const url = (elYoutubeUrlInput && elYoutubeUrlInput.value) || "";
      handleYoutubeUrlLoad(url);
    });
  }
  if (elBtnLoadYoutubeScout) {
    elBtnLoadYoutubeScout.addEventListener("click", () => {
      const url = (elYoutubeUrlInputScout && elYoutubeUrlInputScout.value) || "";
      handleYoutubeUrlLoad(url);
    });
  }
  if (elYoutubeUrlInput) {
    elYoutubeUrlInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleYoutubeUrlLoad(elYoutubeUrlInput.value || "");
      }
    });
  }
  if (elYoutubeUrlInputScout) {
    elYoutubeUrlInputScout.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleYoutubeUrlLoad(elYoutubeUrlInputScout.value || "");
      }
    });
  }
  [elAnalysisVideo, elAnalysisVideoScout].forEach(video => {
    if (!video) return;
    ["timeupdate", "pause", "seeked", "ended"].forEach(evt => {
      video.addEventListener(evt, () => updateVideoPlaybackSnapshot(video.currentTime));
    });
  });
  if (elBtnResetMetrics) {
    elBtnResetMetrics.addEventListener("click", resetMetricsToDefault);
  }
  if (elBtnResetCodes) {
    elBtnResetCodes.addEventListener("click", resetAllActiveCodes);
  }
  if (elBtnResetPoints) {
    elBtnResetPoints.addEventListener("click", resetPointRulesToDefault);
  }
  if (elBtnScoreForPlus) {
    elBtnScoreForPlus.addEventListener("click", () => handleManualScore("for", 1));
  }
  if (elBtnScoreForMinus) {
    elBtnScoreForMinus.addEventListener("click", () => handleManualScore("for", -1));
  }
  if (elBtnScoreAgainstPlus) {
    elBtnScoreAgainstPlus.addEventListener("click", () => handleManualScore("against", 1));
  }
  if (elBtnScoreAgainstMinus) {
    elBtnScoreAgainstMinus.addEventListener("click", () => handleManualScore("against", -1));
  }
  if (elBtnScoreTeamPoint) {
    elBtnScoreTeamPoint.addEventListener("click", openPointModal);
  }
  if (elBtnScoreOppError) {
    elBtnScoreOppError.addEventListener("click", handleOpponentErrorPoint);
  }
  if (elBtnScoreTeamError) {
    elBtnScoreTeamError.addEventListener("click", openErrorModal);
  }
  if (elBtnScoreOppPoint) {
    elBtnScoreOppPoint.addEventListener("click", handleOpponentPoint);
  }
  if (elBtnNextSet) {
    elBtnNextSet.addEventListener("click", () => openNextSetModal((state.currentSet || 1) + 1));
  }
  if (elBtnEndMatch) {
    elBtnEndMatch.addEventListener("click", endMatch);
  }
  if (elBtnScoreTeamErrorModal) {
    elBtnScoreTeamErrorModal.addEventListener("click", openErrorModal);
  }
  if (elBtnNextSetModal) {
    elBtnNextSetModal.addEventListener("click", () => openNextSetModal((state.currentSet || 1) + 1));
  }
  if (elBtnEndMatchModal) {
    elBtnEndMatchModal.addEventListener("click", endMatch);
  }
  if (elNextSetDefaultOur) {
    elNextSetDefaultOur.addEventListener("click", () => {
      if (!nextSetDraft) return;
      const defaults = getRawDefaultStartForScope("our");
      if (!defaults) return;
      nextSetDraft.our = defaults;
      renderNextSetLineups();
    });
  }
  if (elNextSetRotateCwOur) {
    elNextSetRotateCwOur.addEventListener("click", () => rotateNextSetCourt("our", "cw"));
  }
  if (elNextSetRotateCcwOur) {
    elNextSetRotateCcwOur.addEventListener("click", () => rotateNextSetCourt("our", "ccw"));
  }
  if (elNextSetRotationSelectOur) {
    elNextSetRotationSelectOur.addEventListener("change", () => {
      setNextSetRotation("our", elNextSetRotationSelectOur.value);
    });
  }
  if (elNextSetDefaultOpp) {
    elNextSetDefaultOpp.addEventListener("click", () => {
      if (!nextSetDraft) return;
      const defaults = getRawDefaultStartForScope("opponent");
      if (!defaults) return;
      nextSetDraft.opponent = defaults;
      renderNextSetLineups();
    });
  }
  if (elNextSetRotateCwOpp) {
    elNextSetRotateCwOpp.addEventListener("click", () => rotateNextSetCourt("opponent", "cw"));
  }
  if (elNextSetRotateCcwOpp) {
    elNextSetRotateCcwOpp.addEventListener("click", () => rotateNextSetCourt("opponent", "ccw"));
  }
  if (elNextSetRotationSelectOpp) {
    elNextSetRotationSelectOpp.addEventListener("change", () => {
      setNextSetRotation("opponent", elNextSetRotationSelectOpp.value);
    });
  }
  if (elNextSetSwapCourt) {
    elNextSetSwapCourt.addEventListener("change", () => {
      if (nextSetDraft) {
        nextSetDraft.swapCourt = !!elNextSetSwapCourt.checked;
      }
    });
  }
  if (elNextSetSideOur) {
    elNextSetSideOur.addEventListener("change", () => {
      if (!nextSetDraft) return;
      if (elNextSetSideOur.checked) {
        nextSetDraft.swapCourt = false;
      }
    });
  }
  if (elNextSetSideOpp) {
    elNextSetSideOpp.addEventListener("change", () => {
      if (!nextSetDraft) return;
      if (elNextSetSideOpp.checked) {
        nextSetDraft.swapCourt = true;
      }
    });
  }
  if (elNextSetServeOur) {
    elNextSetServeOur.addEventListener("change", () => {
      if (nextSetDraft && elNextSetServeOur.checked) {
        nextSetDraft.isServing = true;
      }
    });
  }
  if (elNextSetServeOpp) {
    elNextSetServeOpp.addEventListener("change", () => {
      if (nextSetDraft && elNextSetServeOpp.checked) {
        nextSetDraft.isServing = false;
      }
    });
  }
  if (elNextSetStart) {
    elNextSetStart.addEventListener("click", applyNextSetDraft);
  }
  if (elNextSetCancel) {
    elNextSetCancel.addEventListener("click", closeNextSetModal);
  }
  if (elNextSetClose) {
    elNextSetClose.addEventListener("click", closeNextSetModal);
  }
  if (elNextSetInline) {
    elNextSetInline.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target === elNextSetInline) {
        e.preventDefault();
        closeNextSetModal();
      }
    });
  }
  if (elSkillModalClose) {
    elSkillModalClose.addEventListener("click", closeSkillModal);
  }
  if (elSkillModal) {
    elSkillModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const wantsClose =
        target.dataset.closeSkill ||
        !!target.closest("[data-close-skill]") ||
        target === elSkillModal;
      if (wantsClose) {
        e.preventDefault();
        closeSkillModal();
      }
    });
  }
  if (elAggSkillModalClose) {
    elAggSkillModalClose.addEventListener("click", closeAggSkillModal);
  }
  if (elAggSkillModal) {
    elAggSkillModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const wantsClose =
        target.dataset.closeAggSkill ||
        !!target.closest("[data-close-agg-skill]") ||
        target === elAggSkillModal;
      if (wantsClose) {
        e.preventDefault();
        closeAggSkillModal();
      }
    });
  }
  window.addEventListener("resize", () => {
    renderPlayers();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeSkillModal();
      closeSettingsModal();
      closeAggSkillModal();
      closeNextSetModal();
    }
  });
  document.addEventListener("mousedown", e => {
    if (currentEditCell && !currentEditCell.contains(e.target)) {
      closeCurrentEdit();
    }
  });
  document.addEventListener("keydown", e => {
    if (isEditingField(e.target)) return;
    closeCurrentEdit();
    const ctxKey = getActiveEventContextKey();
    if (!ctxKey) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(ctxKey, 1, e.shiftKey);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(ctxKey, -1, e.shiftKey);
    } else if (e.key === "[" || (e.key === "ArrowLeft" && e.altKey)) {
      e.preventDefault();
      adjustSelectedVideoTimes(-0.2);
    } else if (e.key === "]" || (e.key === "ArrowRight" && e.altKey)) {
      e.preventDefault();
      adjustSelectedVideoTimes(0.2);
    } else if (e.key === "q" || e.key === "Q") {
      e.preventDefault();
      adjustCurrentRowVideoTime(-0.5);
    } else if (e.key === "w" || e.key === "W") {
      e.preventDefault();
      adjustCurrentRowVideoTime(0.5);
    }
  });
  document.addEventListener("click", e => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const closer = target.closest("[data-close-skill]");
    if (closer && !elSkillModal?.classList.contains("hidden")) {
      e.preventDefault();
      closeSkillModal();
    }
    const aggCloser = target.closest("[data-close-agg-skill]");
    if (aggCloser && !elAggSkillModal?.classList.contains("hidden")) {
      e.preventDefault();
      closeAggSkillModal();
    }
  });
  const snapshotPlayback = () => {
    const playback = getActiveVideoPlaybackSeconds();
    updateVideoPlaybackSnapshot(playback, true);
  };
  window.addEventListener("beforeunload", snapshotPlayback);
  window.addEventListener("pagehide", snapshotPlayback);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      snapshotPlayback();
    }
  });
  startVideoPlaybackSnapshotTimer();
  updateVideoScoutModeLayout();
  renderVideoAnalysis();
  attachModalCloseHandlers();
  if (shouldOpenNextSetModal()) {
    openNextSetModal(state.currentSet || 1);
  }
  registerServiceWorker();
  isLoadingMatch = false;
  if (typeof window !== "undefined") {
    window.isLoadingMatch = false;
  }
  if (linkImport && linkImport.imported) {
    saveState();
    if (linkImport.name) {
      alert("Match importato dal link: " + linkImport.name);
    } else {
      alert("Match importato dal link.");
    }
  }
}
document.addEventListener("DOMContentLoaded", init);
