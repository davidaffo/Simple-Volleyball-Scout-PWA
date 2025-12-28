function renderChipList(container, names, lockedMap, options = {}) {
  if (!container) return;
  container.innerHTML = "";
  const {
    isLiberoColumn = false,
    highlightLibero = false,
    emptyText = "Nessuna riserva disponibile.",
    replacedSet = new Set()
  } = options;
  if (!names || names.length === 0) {
    const span = document.createElement("span");
    span.className = "bench-empty";
    span.textContent = emptyText;
    container.appendChild(span);
    return;
  }
  const libSet = new Set(state.liberos || []);
  names.forEach(name => {
    const chip = document.createElement("div");
    const classes = ["bench-chip"];
    if (isLiberoColumn || (highlightLibero && libSet.has(name))) {
      classes.push("libero-flag");
    }
    if (replacedSet.has(name)) {
      classes.push("replaced-chip");
    }
    if (lockedMap[name] !== undefined) classes.push("bench-locked");
    chip.className = classes.join(" ");
    const isLiberoPlayer = libSet.has(name);
    const allowDirect = isLiberoColumn || isLiberoPlayer;
    chip.draggable = allowDirect;
    chip.dataset.playerName = name;
    const label = document.createElement("span");
    label.textContent =
      formatNameWithNumber(name) + (lockedMap[name] !== undefined ? " (sost. libero)" : "");
    chip.appendChild(label);
    if (allowDirect) {
      chip.addEventListener("dragstart", handleBenchDragStart);
      chip.addEventListener("dragend", handleBenchDragEnd);
      chip.addEventListener("click", () => handleBenchClick(name));
      chip.addEventListener("pointerdown", ev => handleBenchPointerDown(ev, name));
      chip.addEventListener("touchstart", ev => handleBenchTouchStart(ev, name), {
        passive: false
      });
      chip.addEventListener("touchmove", handleBenchTouchMove, { passive: false });
      chip.addEventListener("touchend", handleBenchTouchEnd, { passive: false });
      chip.addEventListener("touchcancel", handleBenchTouchCancel, { passive: false });
    } else {
      chip.title = "Usa Imposta formazione per cambiare le titolari.";
      chip.setAttribute("aria-disabled", "true");
    }
    container.appendChild(chip);
  });
}
const elMetricsConfig = document.getElementById("metrics-config");
const elBtnResetMetrics = document.getElementById("btn-reset-metrics");
const elBtnResetCodes = document.getElementById("btn-reset-codes");
const elBtnResetPoints = document.getElementById("btn-reset-points");
let activeDropChip = null;
let draggedPlayerName = "";
let draggedFromPos = null;
let dragSourceType = "";
let benchDropZoneInitialized = false;
let touchBenchName = "";
let touchBenchOverPos = -1;
let touchBenchGhost = null;
let touchBenchStart = { x: 0, y: 0 };
let benchTouchListenersAttached = false;
let touchBenchPointerId = null;
const BASE_ROLES = ["P", "S1", "C2", "O", "S2", "C1"];
const FRONT_ROW_INDEXES = new Set([1, 2, 3]); // pos2, pos3, pos4
const BACK_ROW_INDEXES = new Set([0, 4, 5]); // pos1, pos5, pos6
const AUTO_LIBERO_ROLE_OPTIONS = ["", "P", "S", "C", "O"];
let isLoadingMatch = false;
if (typeof window !== "undefined" && typeof window.isLoadingMatch !== "undefined") {
  isLoadingMatch = !!window.isLoadingMatch;
}
const lineupCore = (typeof window !== "undefined" && window.LineupCore) || null;
const autoRoleCore =
  (typeof window !== "undefined" &&
    window.AutoRole &&
    typeof window.AutoRole.createAutoRole === "function" &&
    window.AutoRole.createAutoRole({
      ensureCourtShapeFor,
      frontRowIndexes: FRONT_ROW_INDEXES,
      baseRoles: BASE_ROLES
    })) ||
  null;
const buildAutoRolePermutation =
  (autoRoleCore && autoRoleCore.buildAutoRolePermutation) || (() => []);
const applyPhasePermutation =
  (autoRoleCore && autoRoleCore.applyPhasePermutation) || (() => []);
// Export per moduli legacy (es. scout-ui) che si aspettano funzioni globali
window.buildAutoRolePermutation = buildAutoRolePermutation;
window.applyPhasePermutation = applyPhasePermutation;
const elEventsLog = document.getElementById("events-log");
const elUndoLastSummary = document.getElementById("undo-last-summary");
const elEventsLogSummary = document.getElementById("events-log-summary");
const elBtnApplyPlayers = document.getElementById("btn-apply-players");
const elBtnApplyOpponentPlayers = document.getElementById("btn-apply-opponent-players");
const elOpponentPlayersInput = document.getElementById("opponent-players-input");
const elOpponentPlayersList = document.getElementById("opponent-players-list");
const elNewOpponentPlayerInput = document.getElementById("new-opponent-player-name");
const elBtnAddOpponentPlayer = document.getElementById("btn-add-opponent-player");
const elBtnClearOpponentPlayers = document.getElementById("btn-clear-opponent-players");
const elOpponentTeamsSelect = document.getElementById("saved-opponent-teams");
const elBtnSaveOpponentTeam = document.getElementById("btn-save-opponent-team");
const elBtnDeleteOpponentTeam = document.getElementById("btn-delete-opponent-team");
const elBtnRenameOpponentTeam = document.getElementById("btn-rename-opponent-team");
const elBtnExportOpponentTeam = document.getElementById("btn-export-opponent-team");
const elBtnImportOpponentTeam = document.getElementById("btn-import-opponent-team");
const elOpponentTeamFileInput = document.getElementById("opponent-team-file-input");
const elBtnOpenOpponentTeamManager = document.getElementById("btn-open-opponent-team-manager");
const elOpponentLiberoTags = document.getElementById("opponent-libero-tags");
const elBtnExportCsv = document.getElementById("btn-export-csv");
const elBtnCopyCsv = document.getElementById("btn-copy-csv");
const elBtnExportPdf = document.getElementById("btn-export-pdf");
const elBtnResetMatch = document.getElementById("btn-reset-match");
const elBtnCopyMatchCode = document.getElementById("btn-copy-match-code");
const elBtnExportMatch = document.getElementById("btn-export-match");
const elBtnImportMatch = document.getElementById("btn-import-match");
const elMatchFileInput = document.getElementById("match-file-input");
const elMatchCodeInput = document.getElementById("match-code-input");
const elBtnImportMatchCode = document.getElementById("btn-import-match-code");
const elBtnShowMatchQr = document.getElementById("btn-show-match-qr");
const elBtnScanMatchQr = document.getElementById("btn-scan-match-qr");
const elSavedMatchesSelect = document.getElementById("saved-matches");
const elSavedMatchesList = document.getElementById("saved-matches-list");
const elBtnDeleteMatch = document.getElementById("btn-delete-match");
const elBtnNewMatch = document.getElementById("btn-new-match");
const elBtnOpenMatchManager = document.getElementById("btn-open-match-manager");
const elMatchManagerModal = document.getElementById("match-manager-modal");
const elMatchManagerClose = document.getElementById("match-manager-close");
const elBtnSaveMatchInfo = document.getElementById("btn-save-match-info");
const elMatchSummary = document.getElementById("match-summary");
const elBtnOpenTeamManager = document.getElementById("btn-open-team-manager");
const elTeamManagerModal = document.getElementById("team-manager-modal");
const elTeamManagerClose = document.getElementById("team-manager-close");
const elTeamManagerBody = document.getElementById("team-manager-body");
const elTeamManagerAdd = document.getElementById("team-manager-add");
const elTeamManagerSave = document.getElementById("team-manager-save");
const elTeamManagerCancel = document.getElementById("team-manager-cancel");
const elTeamMetaName = document.getElementById("team-meta-name");
const elTeamMetaHead = document.getElementById("team-meta-head");
const elTeamMetaAssistant = document.getElementById("team-meta-assistant");
const elTeamMetaManager = document.getElementById("team-meta-manager");
const elTeamManagerDup = document.getElementById("team-manager-duplicate");
const elTeamManagerTemplate = document.getElementById("team-manager-template");
const DEFAULT_STAFF = { headCoach: "", assistantCoach: "", manager: "" };
let teamManagerState = null;
let teamManagerScope = "our";
const elBtnExportDb = document.getElementById("btn-export-db");
const elBtnImportDb = document.getElementById("btn-import-db");
const elDbFileInput = document.getElementById("db-file-input");
const elBtnUndo = document.getElementById("btn-undo");
const elBtnOpenSettings = document.getElementById("btn-open-settings");
const elSettingsModal = document.getElementById("settings-modal");
const elSettingsClose = document.getElementById("settings-close");
const elAutoRotateToggle = document.getElementById("auto-rotate-toggle");
const elAutoRoleToggle = document.getElementById("auto-role-toggle");
const elAutoRoleP1AmericanToggle = document.getElementById("auto-role-p1american-toggle");
const elAttackTrajectoryToggle = document.getElementById("attack-trajectory-toggle");
const elPredictiveSkillToggle = document.getElementById("predictive-skill-toggle");
const elSkillFlowButtons = document.getElementById("skill-flow-buttons");
const elAggTableBody = document.getElementById("agg-table-body");
const elAggSecondBody = document.getElementById("agg-second-body");
const elTrajectoryGrid = document.getElementById("trajectory-grid");
const elServeTrajectoryGrid = document.getElementById("serve-trajectory-grid");
const elTrajFilterPlayers = document.getElementById("traj-filter-players");
const elTrajFilterSets = document.getElementById("traj-filter-sets");
const elTrajFilterCodes = document.getElementById("traj-filter-codes");
const elTrajFilterSetTypes = document.getElementById("traj-filter-set-types");
const elTrajFilterBases = document.getElementById("traj-filter-bases");
const elTrajFilterPhases = document.getElementById("traj-filter-phases");
const elTrajFilterReceiveEvals = document.getElementById("traj-filter-receive-evals");
const elTrajFilterReceiveZones = document.getElementById("traj-filter-receive-zones");
const elTrajFilterPrev = document.getElementById("traj-filter-prev");
const elTrajFilterZones = document.getElementById("traj-filter-zones");
const elTrajFilterReset = document.getElementById("traj-filter-reset");
const elServeTrajFilterPlayers = document.getElementById("serve-traj-filter-players");
const elServeTrajFilterSets = document.getElementById("serve-traj-filter-sets");
const elServeTrajFilterCodes = document.getElementById("serve-traj-filter-codes");
const elServeTrajFilterSetTypes = document.getElementById("serve-traj-filter-set-types");
const elServeTrajFilterBases = document.getElementById("serve-traj-filter-bases");
const elServeTrajFilterPhases = document.getElementById("serve-traj-filter-phases");
const elServeTrajFilterReceiveEvals = document.getElementById("serve-traj-filter-receive-evals");
const elServeTrajFilterReceiveZones = document.getElementById("serve-traj-filter-receive-zones");
const elServeTrajFilterZones = document.getElementById("serve-traj-filter-zones");
const elServeTrajFilterReset = document.getElementById("serve-traj-filter-reset");
const elSecondFilterSetters = document.getElementById("second-filter-setters");
const elSecondFilterSetTypes = document.getElementById("second-filter-set-types");
const elSecondFilterBases = document.getElementById("second-filter-bases");
const elSecondFilterPhases = document.getElementById("second-filter-phases");
const elSecondFilterReceiveEvals = document.getElementById("second-filter-receive-evals");
const elSecondFilterReceiveZones = document.getElementById("second-filter-receive-zones");
const elSecondFilterSets = document.getElementById("second-filter-sets");
const elSecondFilterPrev = document.getElementById("second-filter-prev");
const elSecondFilterReset = document.getElementById("second-filter-reset");
const elVideoFilters = document.getElementById("video-filters");
const elVideoFilterPlayers = document.getElementById("video-filter-players");
const elVideoFilterSkills = document.getElementById("video-filter-skills");
const elVideoFilterCodes = document.getElementById("video-filter-codes");
const elVideoFilterSets = document.getElementById("video-filter-sets");
const elVideoFilterRotations = document.getElementById("video-filter-rotations");
const elVideoFilterZones = document.getElementById("video-filter-zones");
const elVideoFilterBases = document.getElementById("video-filter-bases");
const elVideoFilterSetTypes = document.getElementById("video-filter-set-types");
const elVideoFilterPhases = document.getElementById("video-filter-phases");
const elVideoFilterReceiveEvals = document.getElementById("video-filter-receive-evals");
const elVideoFilterReceiveZones = document.getElementById("video-filter-receive-zones");
const elVideoFilterServeTypes = document.getElementById("video-filter-serve-types");
const elVideoFilterReset = document.getElementById("video-filter-reset");
const elRotationTableBody = document.getElementById("rotation-table-body");
const elLiveScore = document.getElementById("live-score");
const elLiveScoreModal = document.getElementById("live-score-modal");
const elAggScore = document.getElementById("agg-score");
const elAggSetCards = document.getElementById("agg-set-cards");
const elBtnScoreForPlus = document.getElementById("btn-score-for-plus");
const elBtnScoreForMinus = document.getElementById("btn-score-for-minus");
const elBtnScoreAgainstPlus = document.getElementById("btn-score-against-plus");
const elBtnScoreAgainstMinus = document.getElementById("btn-score-against-minus");
const elBtnScoreTeamError = document.getElementById("btn-score-team-error");
const elBtnScoreTeamPoint = document.getElementById("btn-score-team-point");
const elBtnScoreOppError = document.getElementById("btn-score-opp-error");
const elBtnScoreOppPoint = document.getElementById("btn-score-opp-point");
const elBtnNextSet = document.getElementById("btn-next-set");
const elBtnEndMatch = document.getElementById("btn-end-match");
const elBtnScoreForPlusModal = document.getElementById("btn-score-for-plus-modal");
const elBtnScoreForMinusModal = document.getElementById("btn-score-for-minus-modal");
const elBtnScoreAgainstPlusModal = document.getElementById("btn-score-against-plus-modal");
const elBtnScoreAgainstMinusModal = document.getElementById("btn-score-against-minus-modal");
const elBtnScoreTeamErrorModal = document.getElementById("btn-score-team-error-modal");
const elBtnScoreTeamPointModal = document.getElementById("btn-score-team-point-modal");
const elBtnNextSetModal = document.getElementById("btn-next-set-modal");
const elBtnEndMatchModal = document.getElementById("btn-end-match-modal");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const elLogSection = document.querySelector("[data-log-section]");
const elAggTabButtons = document.querySelectorAll("[data-agg-tab-target]");
const elAggSubPanels = document.querySelectorAll("[data-agg-tab]");
let autoRolePhaseApplied = "";
let autoRoleRotationApplied = null;
let autoRoleBaseCourt = null;
let autoRoleRenderedCourt = null;
let activeTab = "info";
let activeAggTab = "summary";
function getTodayIso() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}
function formatUsDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { timeZone: "UTC" });
}
function ensureMatchDefaults() {
  state.match = state.match || {};
  if (!state.match.date) {
    state.match.date = getTodayIso();
  }
  if (!state.match.matchType) {
    state.match.matchType = "amichevole";
  }
  if (typeof state.match.leg !== "string") {
    state.match.leg = "";
  }
}
function buildMatchDisplayName(matchObj) {
  const m = matchObj || state.match || {};
  const dateIso = m.date || getTodayIso();
  const datePart = formatUsDate(dateIso);
  const teamName = (state.match && state.match.teamName) || (state.selectedTeam || "").trim();
  const typeLabels = {
    amichevole: "Amichevole",
    campionato: "Campionato",
    torneo: "Torneo",
    playoff: "Playoff",
    playout: "Playout",
    coppa: "Coppa"
  };
  const legLabels = {
    andata: "Andata",
    ritorno: "Ritorno",
    "gara-1": "Gara 1",
    "gara-2": "Gara 2",
    "gara-3": "Gara 3"
  };
  const parts = [
    datePart || getTodayIso(),
    teamName || "Squadra",
    m.opponent || "Match",
    m.category || "",
    typeLabels[m.matchType] || m.matchType || "",
    legLabels[m.leg] || m.leg || ""
  ].filter(Boolean);
  return parts.join(" - ") || "Match";
}

function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = next;
  state.theme = next;
  const textColor = (THEME_TEXT && THEME_TEXT[next]) || "#ffffff";
  document.documentElement.style.setProperty("--text-color", textColor);
  if (elThemeToggleDark && elThemeToggleLight) {
    const isLight = next === "light";
    elThemeToggleLight.classList.toggle("active", isLight);
    elThemeToggleDark.classList.toggle("active", !isLight);
    elThemeToggleLight.setAttribute("aria-pressed", String(isLight));
    elThemeToggleDark.setAttribute("aria-pressed", String(!isLight));
  }
}
const SKILL_COLUMN_MAP = {
  serve: [4, 5, 6, 7, 8],
  pass: [9, 10, 11, 12, 13],
  attack: [14, 15, 16, 17, 18, 19],
  block: [20, 21],
  defense: [22, 23, 24],
  second: []
};
function applyStateSnapshot(parsed, options = {}) {
  if (!parsed || typeof parsed !== "object") return false;
  const { skipStorageSync = false } = options;
  state = Object.assign(state, parsed);
  state.theme = parsed.theme || "dark";
  state.playerNumbers = parsed.playerNumbers || state.playerNumbers || {};
  state.captains = normalizePlayers(Array.isArray(parsed.captains) ? parsed.captains : []).slice(0, 1);
  ensureCourtShape();
  cleanCourtPlayers();
  state.captains = (state.captains || []).filter(name => (state.players || []).includes(name)).slice(0, 1);
  state.autoRolePositioning = !!parsed.autoRolePositioning;
  state.isServing = !!parsed.isServing;
  state.rotation = parsed.rotation || 1;
  state.matchFinished = !!parsed.matchFinished;
  state.attackTrajectoryEnabled = !!parsed.attackTrajectoryEnabled;
  state.setTypePromptEnabled = !!parsed.setTypePromptEnabled;
  state.videoScoutMode = !!parsed.videoScoutMode;
  state.videoPlayByPlay = !!parsed.videoPlayByPlay;
  state.nextSetType = parsed.nextSetType || "";
  state.forceMobileLayout = !!parsed.forceMobileLayout;
  state.liberos = Array.isArray(parsed.liberos) ? parsed.liberos : [];
  state.liberoAutoMap = parsed.liberoAutoMap || {};
  state.savedTeams = parsed.savedTeams || {};
  state.savedOpponentTeams = parsed.savedOpponentTeams || state.savedTeams || {};
  state.savedMatches = parsed.savedMatches || {};
  state.scoreOverrides = normalizeScoreOverrides(parsed.scoreOverrides);
  state.selectedTeam = parsed.selectedTeam || "";
  state.selectedOpponentTeam = parsed.selectedOpponentTeam || "";
  state.opponentPlayers = normalizePlayers(parsed.opponentPlayers || state.opponentPlayers || []);
  state.opponentPlayerNumbers = parsed.opponentPlayerNumbers || {};
  state.opponentLiberos = Array.isArray(parsed.opponentLiberos) ? normalizePlayers(parsed.opponentLiberos) : [];
  state.opponentCaptains = normalizePlayers(
    Array.isArray(parsed.opponentCaptains) ? parsed.opponentCaptains : []
  ).slice(0, 1);
  state.selectedMatch = parsed.selectedMatch || "";
  if ((!state.captains || state.captains.length === 0) && state.selectedTeam && state.savedTeams) {
    const selectedTeamData = state.savedTeams[state.selectedTeam];
    if (selectedTeamData) {
      const roster = extractRosterFromTeam(selectedTeamData);
      state.captains = normalizePlayers(roster.captains || []).filter(name =>
        (state.players || []).includes(name)
      ).slice(0, 1);
    }
  }
  state.opponentCaptains = (state.opponentCaptains || [])
    .filter(name => (state.opponentPlayers || []).includes(name))
    .slice(0, 1);
  state.metricsConfig = parsed.metricsConfig || {};
  state.video =
    parsed.video ||
    state.video || {
      offsetSeconds: 0,
      fileName: "",
      youtubeId: "",
      youtubeUrl: "",
      lastPlaybackSeconds: 0
    };
  if (typeof state.video.offsetSeconds !== "number") {
    state.video.offsetSeconds = 0;
  }
  state.video.fileName = state.video.fileName || "";
  state.video.youtubeId = state.video.youtubeId || "";
  state.video.youtubeUrl = state.video.youtubeUrl || "";
  if (typeof state.video.lastPlaybackSeconds !== "number") {
    state.video.lastPlaybackSeconds = 0;
  }
  state.autoRotate = parsed.autoRotate !== false;
  state.autoLiberoBackline = parsed.autoLiberoBackline !== false;
  const parsedLiberoRole = typeof parsed.autoLiberoRole === "string" ? parsed.autoLiberoRole : "";
  state.autoLiberoRole = AUTO_LIBERO_ROLE_OPTIONS.includes(parsedLiberoRole)
    ? parsedLiberoRole
    : "";
  state.preferredLibero = typeof parsed.preferredLibero === "string" ? parsed.preferredLibero : "";
  state.autoRoleP1American = !!parsed.autoRoleP1American;
  state.courtViewMirrored = !!parsed.courtViewMirrored;
  state.predictiveSkillFlow = !!parsed.predictiveSkillFlow;
  state.autoRotatePending = false;
  state.freeballPending = !!parsed.freeballPending;
  state.autoRoleBaseCourt = Array.isArray(parsed.autoRoleBaseCourt) ? ensureCourtShapeFor(parsed.autoRoleBaseCourt) : [];
  state.skillClock = parsed.skillClock || { paused: false, pausedAtMs: null, pausedAccumMs: 0, lastEffectiveMs: null };
  autoRoleBaseCourt =
    state.autoRoleBaseCourt && state.autoRoleBaseCourt.length === 6
      ? cloneCourtLineup(state.autoRoleBaseCourt)
      : null;
  state.pointRules = parsed.pointRules || state.pointRules || {};
  ensureMatchDefaults();
  syncPlayerNumbers(state.players || []);
  syncOpponentPlayerNumbers(state.opponentPlayers || [], state.opponentPlayerNumbers || {});
  cleanOpponentLiberos();
  cleanLiberos();
  ensureMetricsConfigDefaults();
  ensurePointRulesDefaults();
  if (!skipStorageSync) {
    migrateTeamsToPersistent();
    migrateOpponentTeamsToPersistent();
    migrateMatchesToPersistent();
    syncTeamsFromStorage();
    syncOpponentTeamsFromStorage();
    syncMatchesFromStorage();
  }
  enforceAutoLiberoForState({ skipServerOnServe: true });
  return true;
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return applyStateSnapshot(parsed);
  } catch (e) {
    logError("Error loading state", e);
  }
  return false;
}
async function loadStateFromIndexedDb() {
  try {
    const parsed = await readStateFromIndexedDb();
    if (!parsed) return false;
    return applyStateSnapshot(parsed, { skipStorageSync: true });
  } catch (e) {
    logError("Error loading state from indexeddb", e);
  }
  return false;
}
function saveState(options = {}) {
  const { persistLocal = false } = options || {};
  try {
    if (persistLocal) {
      syncTeamsFromStorage();
      syncOpponentTeamsFromStorage();
    }
    writeStateToIndexedDb(state);
    const shouldPersistLocal = persistLocal || typeof indexedDB === "undefined";
    if (shouldPersistLocal) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    const loading =
      typeof window !== "undefined" && typeof window.isLoadingMatch !== "undefined"
        ? !!window.isLoadingMatch
        : isLoadingMatch;
    if (!loading && shouldPersistLocal) {
      persistCurrentMatch();
    }
  } catch (e) {
    logError("Error saving state", e);
  }
}
function normalizePlayers(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const names = [];
  list.forEach(name => {
    const clean = (name || "").trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      names.push(clean);
    }
  });
  return names;
}
function splitNameParts(fullName = "") {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { lastName: "", firstName: "" };
  }
  const lastName = parts[0] || "";
  const firstName = parts.slice(1).join(" ");
  return { lastName, firstName };
}
function buildFullName(lastName = "", firstName = "") {
  return [lastName, firstName].map(s => (s || "").trim()).filter(Boolean).join(" ").trim();
}
function enforceSingleCaptainFlag(players, preferredName = "") {
  if (!Array.isArray(players)) return [];
  let chosenIdx = -1;
  const preferred = (preferredName || "").toLowerCase();
  if (preferred) {
    players.forEach((player, idx) => {
      if (!player || !player.name) return;
      if (player.name.toLowerCase() === preferred && chosenIdx === -1) {
        chosenIdx = idx;
      }
    });
  }
  if (chosenIdx === -1) {
    players.forEach((player, idx) => {
      if (player && player.isCaptain && chosenIdx === -1) {
        chosenIdx = idx;
      }
    });
  }
  players.forEach((player, idx) => {
    if (!player) return;
    player.isCaptain = idx === chosenIdx && chosenIdx !== -1;
  });
  return players;
}
function replacePlayerNameEverywhere(oldName, newName, idx) {
  ensureCourtShape();
  state.court = state.court.map(slot => {
    const updated = Object.assign({}, slot);
    if (updated.main === oldName) updated.main = newName;
    if (updated.replaced === oldName) updated.replaced = newName;
    return updated;
  });
  state.liberos = (state.liberos || []).map(n => (n === oldName ? newName : n));
  state.captains = (state.captains || []).map(n => (n === oldName ? newName : n));
  if (state.liberoAutoMap) {
    const updatedMap = {};
    Object.entries(state.liberoAutoMap).forEach(([replaced, libero]) => {
      const nextReplaced = replaced === oldName ? newName : replaced;
      const nextLibero = libero === oldName ? newName : libero;
      updatedMap[nextReplaced] = nextLibero;
    });
    state.liberoAutoMap = updatedMap;
  }
  (state.events || []).forEach(ev => {
    if (ev.playerIdx === idx || ev.playerName === oldName) {
      ev.playerName = newName;
    }
  });
}
function renamePlayerAtIndex(idx, nextNameRaw) {
  if (!state.players || !state.players[idx]) return;
  const normalized = normalizePlayers([nextNameRaw])[0];
  if (!normalized) {
    alert("Inserisci un nome valido.");
    renderPlayersManagerList();
    return;
  }
  const duplicate = state.players.some(
    (p, i) => i !== idx && p.toLowerCase() === normalized.toLowerCase()
  );
  if (duplicate) {
    alert("Nome già presente nella lista.");
    renderPlayersManagerList();
    return;
  }
  const oldName = state.players[idx];
  if (oldName === normalized) return;
  state.players[idx] = normalized;
  state.playerNumbers = state.playerNumbers || {};
  const oldNumber = state.playerNumbers[oldName];
  delete state.playerNumbers[oldName];
  if (oldNumber) {
    state.playerNumbers[normalized] = oldNumber;
  }
  replacePlayerNameEverywhere(oldName, normalized, idx);
  saveState();
  applyPlayersFromStateToTextarea();
  renderPlayersManagerList();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  renderLiberoTags();
  renderAggregatedTable();
  renderEventsLog();
}
function getPlayerNumber(name) {
  if (!name || !state.playerNumbers) return "";
  return state.playerNumbers[name] || "";
}
function isCaptain(name) {
  if (!name) return false;
  const caps = state.captains || [];
  return caps.some(c => c.toLowerCase() === name.toLowerCase());
}
function formatNameWithNumber(name, options = {}) {
  const num = getPlayerNumber(name);
  const compactCourt = !!options.compactCourt;
  const nameParts = splitNameParts(name);
  const surname = nameParts.lastName || "";
  const given = nameParts.firstName || "";
  const initial = given ? given.trim()[0]?.toUpperCase() + "." : "";
  let baseName = name || "";
  if (surname && initial) {
    baseName = `${surname} ${initial}`.trim();
  } else if (surname) {
    baseName = surname;
  }
  if (compactCourt) {
    baseName = baseName || name || "";
  }
  const base = num ? num + " - " + baseName : baseName;
  const includeCaptain = options.includeCaptain !== false;
  if (includeCaptain && isCaptain(name)) {
    return base + " (K)";
  }
  return base;
}
const SKILL_SHORT_LABELS = {
  serve: "BA",
  pass: "RI",
  attack: "AT",
  defense: "DF",
  block: "MU",
  second: "AL",
  manual: "MN"
};
function getShortSkill(id) {
  if (!id) return "";
  return SKILL_SHORT_LABELS[id] || id.slice(0, 2).toUpperCase();
}
function getInitials(name) {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join("");
}
function buildNumbersForNames(names, provided = {}, previous = state.playerNumbers || {}) {
  const valid = value => {
    const clean = (value || "").trim();
    return clean && /^[0-9]{1,3}$/.test(clean) ? clean : "";
  };
  const prev = previous || {};
  const used = new Set();
  const numbers = {};
  names.forEach(name => {
    const candidates = [valid(provided[name]), valid(prev[name])].filter(Boolean);
    let chosen = "";
    for (const candidate of candidates) {
      if (!used.has(candidate)) {
        chosen = candidate;
        break;
      }
    }
    if (!chosen) {
      let candidate = 1;
      while (used.has(String(candidate))) candidate++;
      chosen = String(candidate);
    }
    numbers[name] = chosen;
    used.add(chosen);
  });
  return numbers;
}
function syncPlayerNumbers(names) {
  state.playerNumbers = buildNumbersForNames(names, {});
}
function syncOpponentPlayerNumbers(names, provided = {}) {
  const numbers = buildNumbersForNames(names, provided, state.opponentPlayerNumbers || {});
  state.opponentPlayerNumbers = numbers;
  return numbers;
}
function cleanOpponentLiberos() {
  const set = new Set(state.opponentPlayers || []);
  state.opponentLiberos = normalizePlayers(state.opponentLiberos || []).filter(name => set.has(name));
}
function applyDefaultLineup(names = []) {
  ensureCourtShape();
  const lineup = Array.isArray(names) ? names.filter(Boolean) : [];
  state.court = Array.from({ length: 6 }, (_, idx) => ({ main: lineup[idx] || "" }));
  state.rotation = 1;
  autoRoleBaseCourt = null;
  state.autoRoleBaseCourt = null;
  resetAutoRoleCache();
}
function setAutoRolePositioning(enabled) {
  const next = !!enabled;
  const prev = !!state.autoRolePositioning;
  state.autoRolePositioning = next;
  if (!next && prev) {
    const restored = restoreAutoRoleBaseCourt();
    saveState();
    if (restored) {
      renderPlayers();
      renderBenchChips();
      renderLiberoChipsInline();
      renderLineupChips();
      updateRotationDisplay();
    }
    return;
  }
  if (next && !prev) {
    cacheAutoRoleBaseCourt();
    applyAutoRolePositioning();
  }
  saveState();
}
function setAutoRoleP1American(enabled) {
  state.autoRoleP1American = !!enabled;
  saveState();
  if (state.autoRolePositioning && typeof applyAutoRolePositioning === "function") {
    applyAutoRolePositioning();
  }
  syncAutoRoleP1AmericanToggle();
}
function setIsServing(flag) {
  state.isServing = !!flag;
  saveState();
}
function setAutoLiberoBackline(enabled) {
  state.autoLiberoBackline = !!enabled;
  if (!enabled) {
    state.autoLiberoRole = "";
  }
  enforceAutoLiberoForState({ skipServerOnServe: true });
  saveState();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
}
function setAutoLiberoRole(role) {
  if (typeof role !== "string") return;
  const sanitized = AUTO_LIBERO_ROLE_OPTIONS.includes(role) ? role : "";
  state.autoLiberoRole = sanitized;
  state.autoLiberoBackline = sanitized !== "" ? true : state.autoLiberoBackline;
  // Cambiando ruolo, azzera i vecchi abbinamenti per forzare la nuova sostituzione
  state.autoLiberoMap = {};
  enforceAutoLiberoForState({ skipServerOnServe: true });
  saveState();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
}
function getLastOwnEvent() {
  const list = (state.events || []).filter(ev => {
    if (!ev || !ev.skillId || ev.skillId === "manual") return false;
    if (!ev.team) return true;
    return ev.team !== "opponent";
  });
  return list.length > 0 ? list[list.length - 1] : null;
}
function getCurrentPhase() {
  const last = getLastOwnEvent();
  if (last && last.skillId) {
    if (["pass", "second", "attack", "block", "defense"].includes(last.skillId)) {
      return "attack";
    }
    const dir = typeof getPointDirection === "function" ? getPointDirection(last) : null;
    if (dir === "against") return "receive";
    if (dir === "for" && state.isServing) return "attack";
  }
  return state.isServing ? "attack" : "receive";
}
function handlePlayerNumberChange(name, value) {
  if (!name) return;
  const clean = (value || "").trim();
  if (clean && !/^[0-9]{1,3}$/.test(clean)) {
    alert("Inserisci un numero di 1-3 cifre.");
    renderPlayersManagerList();
    return;
  }
  const dup = Object.entries(state.playerNumbers || {}).find(
    ([otherName, num]) => otherName !== name && num && num === clean
  );
  if (dup) {
    alert("Numero già assegnato a " + dup[0]);
    renderPlayersManagerList();
    return;
  }
  state.playerNumbers = state.playerNumbers || {};
  state.playerNumbers[name] = clean;
  saveState();
  renderPlayersManagerList();
  renderPlayers();
  renderBenchChips();
  renderLineupChips();
  renderAggregatedTable();
  renderEventsLog();
}
function playersChanged(nextPlayers) {
  const normalizedNext = normalizePlayers(nextPlayers);
  const normalizedCurrent = normalizePlayers(state.players || []);
  if (normalizedNext.length !== normalizedCurrent.length) return true;
  return normalizedNext.some((name, idx) => name !== normalizedCurrent[idx]);
}
function ensureCourtShape() {
  state.court = ensureCourtShapeFor(state.court);
}
function ensureCourtShapeFor(court) {
  if (lineupCore && typeof lineupCore.ensureCourtShapeFor === "function") {
    return lineupCore.ensureCourtShapeFor(court);
  }
  if (!Array.isArray(court) || court.length !== 6) {
    return Array.from({ length: 6 }, () => ({ main: "", replaced: "" }));
  }
  return court.map(slot => ({
    main: (slot && slot.main) || "",
    replaced: (slot && slot.replaced) || ""
  }));
}
function cloneCourtLineup(lineup = state.court) {
  if (lineupCore && typeof lineupCore.cloneCourtLineup === "function") {
    return lineupCore.cloneCourtLineup(lineup);
  }
  ensureCourtShape();
  return (lineup || []).map(slot => ({
    main: (slot && slot.main) || "",
    replaced: (slot && slot.replaced) || ""
  }));
}
function cacheAutoRoleBaseCourt() {
  updateAutoRoleBaseCourtCache(state.court);
}
function restoreAutoRoleBaseCourt() {
  if (!autoRoleBaseCourt || autoRoleBaseCourt.length !== 6) {
    if (state.autoRoleBaseCourt && state.autoRoleBaseCourt.length === 6) {
      autoRoleBaseCourt = cloneCourtLineup(state.autoRoleBaseCourt);
    }
  }
  if (!autoRoleBaseCourt || autoRoleBaseCourt.length !== 6) return false;
  const restored = cloneCourtLineup(autoRoleBaseCourt);
  state.court = restored;
  updateAutoRoleBaseCourtCache(restored);
  resetAutoRoleCache();
  return true;
}
function cleanCourtPlayers(target = state.court) {
  ensureCourtShape();
  const valid = new Set(state.players || []);
  state.captains = (state.captains || []).filter(name => valid.has(name)).slice(0, 1);
  const cleaned = ensureCourtShapeFor(target).map(slot => {
    const main = valid.has(slot.main) ? slot.main : "";
    const replaced = slot.replaced && valid.has(slot.replaced) ? slot.replaced : "";
    return { main, replaced };
  });
  if (target === state.court) {
    state.court = cleaned;
  } else {
    cleaned.forEach((slot, idx) => (target[idx] = slot));
  }
  cleanLiberos();
  ensureMetricsConfigDefaults();
  return cleaned;
}
function registerLiberoPair(replacedName, liberoName) {
  if (!replacedName || !liberoName) return;
  if (!isLibero(liberoName)) return;
  state.liberoAutoMap = state.liberoAutoMap || {};
  state.liberoAutoMap[replacedName] = liberoName;
  if (!state.preferredLibero) {
    state.preferredLibero = liberoName;
  }
}
function removeLiberosAndRestore(baseCourt) {
  const shaped = ensureCourtShapeFor(baseCourt).map(slot => Object.assign({}, slot));
  shaped.forEach((slot, idx) => {
    if (isLibero(slot.main)) {
      if (slot.replaced) {
        shaped[idx] = { main: slot.replaced, replaced: "" };
      } else {
        shaped[idx] = { main: "", replaced: "" };
      }
    }
  });
  return shaped;
}
function roleToAutoCategory(roleLabel = "") {
  const r = (roleLabel || "").toUpperCase();
  if (r.startsWith("P")) return "P";
  if (r.startsWith("O")) return "O";
  if (r.startsWith("C")) return "C";
  if (r.startsWith("S")) return "S";
  return "";
}
function swapPreferredLibero() {
  const libs = (state.liberos || []).filter(n => (state.players || []).includes(n));
  if (libs.length < 2) return;
  const current = libs.includes(state.preferredLibero) ? state.preferredLibero : libs[0];
  const next = libs[(libs.indexOf(current) + 1) % libs.length];
  state.preferredLibero = next;
  state.liberoAutoMap = {};
  enforceAutoLiberoForState({ skipServerOnServe: true });
  saveState();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
}
function restorePlayerFromLibero(posIdx) {
  ensureCourtShape();
  const idx = typeof posIdx === "number" ? posIdx : parseInt(posIdx, 10);
  if (isNaN(idx) || idx < 0 || idx >= state.court.length) return;
  const slot = state.court[idx] || { main: "", replaced: "" };
  if (!isLibero(slot.main) || !slot.replaced) return;
  state.court[idx] = { main: slot.replaced, replaced: "" };
  state.liberoAutoMap = {};
  state.preferredLibero = (state.liberos || [])[0] || "";
  if (state.autoRolePositioning) {
    updateAutoRoleBaseCourtCache(state.court);
    resetAutoRoleCache();
  }
  saveState();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
}
function applyAutoLiberoSubstitutionToCourt(baseCourt, options = {}) {
  const { skipServerOnServe = true } = options;
  if (!state.autoLiberoBackline) return cloneCourtLineup(baseCourt);
  if (!state.autoLiberoRole) return cloneCourtLineup(baseCourt);
  cleanLiberoAutoMap();
  const libSet = new Set(state.liberos || []);
  if (libSet.size === 0) return cloneCourtLineup(baseCourt);
  const liberoList = (state.liberos || []).filter(n => libSet.has(n));
  const mapping = state.liberoAutoMap || {};
  const shaped = removeLiberosAndRestore(baseCourt).map(slot => Object.assign({}, slot));
  let primaryLibero = (state.preferredLibero && libSet.has(state.preferredLibero)) ? state.preferredLibero : null;
  // normalizza eventuali doppi liberi già presenti
  for (let i = 0; i < shaped.length; i++) {
    const slot = shaped[i];
    if (libSet.has(slot.main)) {
      if (!primaryLibero) {
        primaryLibero = slot.main;
        if (slot.replaced) {
          registerLiberoPair(slot.replaced, slot.main);
        }
      } else {
        // secondo libero: rimuovilo e rimetti la titolare se nota
        if (slot.replaced) {
          shaped[i] = { main: slot.replaced, replaced: "" };
        } else {
          shaped[i] = { main: "", replaced: "" };
        }
      }
    }
  }
  if (!primaryLibero) {
    primaryLibero = liberoList[0] || null;
    state.preferredLibero = primaryLibero || "";
  }
  if (!primaryLibero) return shaped;
  const selCat = (state.autoLiberoRole || "").toUpperCase();
  let targetIdx = -1;
  BACK_ROW_INDEXES.forEach(idx => {
    if (targetIdx !== -1) return;
    if (skipServerOnServe && state.isServing && idx === 0) return;
    const roleHere = roleToAutoCategory(getRoleLabel(idx + 1)); // usa il ruolo corrente (ruotato)
    if (selCat === roleHere && !isLibero(shaped[idx].main)) {
      targetIdx = idx;
    }
  });
  if (targetIdx === -1) return shaped;
  const slot = shaped[targetIdx] || { main: "", replaced: "" };
  const liberoName =
    (mapping[slot.main] && libSet.has(mapping[slot.main]) && mapping[slot.main]) || primaryLibero;
  if (!liberoName) return shaped;
  shaped[targetIdx] = { main: liberoName, replaced: slot.main || "" };
  registerLiberoPair(slot.main || "", liberoName);
  state.preferredLibero = liberoName;
  return shaped;
}
function enforceAutoLiberoForState(options = {}) {
  if (!state.autoLiberoBackline) return;
  ensureCourtShape();
  let base =
    state.autoRolePositioning && autoRoleBaseCourt && autoRoleBaseCourt.length === 6
      ? cloneCourtLineup(autoRoleBaseCourt)
      : cloneCourtLineup(state.court);
  base = removeLiberosAndRestore(base);
  const adjusted = applyAutoLiberoSubstitutionToCourt(base, options);
  state.court = cloneCourtLineup(adjusted);
  if (state.autoRolePositioning) {
    updateAutoRoleBaseCourtCache(cloneCourtLineup(adjusted));
    resetAutoRoleCache();
  }
}
function isLibero(name) {
  if (!name) return false;
  return (state.liberos || []).includes(name);
}
function canPlaceInSlot(name, posIdx, showAlert = true) {
  if (!name) return true;
  ensureCourtShape();
  const targetSlot = state.court[posIdx] || { main: "", replaced: "" };
  // Se esiste un libero in campo che sostituisce questa giocatrice, può rientrare solo lì (ma sempre consentito su quello slot)
  const libSlotIdx = (state.court || []).findIndex(
    slot => isLibero(slot.main) && slot.replaced === name
  );
  if (libSlotIdx !== -1) {
    if (libSlotIdx !== posIdx) {
      if (showAlert) alert("Questa giocatrice può rientrare solo nello slot del libero che la sta sostituendo.");
      return false;
    }
    return true;
  }
  if (isLibero(name) && FRONT_ROW_INDEXES.has(posIdx)) {
    if (showAlert) alert("Non puoi mettere il libero in prima linea.");
    return false;
  }
  if (isLibero(name)) {
    const anotherLiberoIdx = (state.court || []).findIndex(
      slot => slot.main && slot.main !== name && isLibero(slot.main)
    );
    if (anotherLiberoIdx !== -1 && anotherLiberoIdx !== posIdx) {
      if (showAlert) alert("Puoi avere solo un libero in campo alla volta.");
      return false;
    }
  }
  const lockedMap = getLockedMap();
  // se la giocatrice è proprio quella sostituita dal libero in questo slot, consentiamo il rientro qui
  if (lockedMap[name] !== undefined && lockedMap[name] !== posIdx && targetSlot.replaced !== name) {
    if (showAlert) alert("Questa giocatrice può rientrare solo nella sua posizione (sostituita dal libero).");
    return false;
  }
  return true;
}
function reserveNamesInCourt(name, court = state.court) {
  if (lineupCore && typeof lineupCore.reserveNamesInCourt === "function") {
    const next = lineupCore.reserveNamesInCourt(name, court);
    if (court === state.court) {
      state.court = next;
    } else {
      next.forEach((slot, idx) => (court[idx] = slot));
    }
    return next;
  }
  return court.map(slot => {
    const cleaned = Object.assign({}, slot);
    if (cleaned.main === name) cleaned.main = "";
    if (cleaned.replaced === name) cleaned.replaced = "";
    return cleaned;
  });
}
function resetAutoRoleCache() {
  autoRolePhaseApplied = "";
  autoRoleRotationApplied = null;
  autoRoleRenderedCourt = null;
}
function updateAutoRoleBaseCourtCache(base) {
  const shaped = cloneCourtLineup(base);
  autoRoleBaseCourt = shaped;
  state.autoRoleBaseCourt = shaped;
}
function commitCourtChange(baseCourt, options = {}) {
  const { clean = true } = options;
  if (clean) cleanCourtPlayers(baseCourt);
  resetAutoRoleCache();
  if (state.autoRolePositioning) {
    updateAutoRoleBaseCourtCache(baseCourt);
    state.court = ensureCourtShapeFor(baseCourt); // manteniamo il lineup base aggiornato
    enforceAutoLiberoForState({ skipServerOnServe: true });
    applyAutoRolePositioning();
    return;
  }
  state.court = ensureCourtShapeFor(baseCourt);
  enforceAutoLiberoForState({ skipServerOnServe: true });
  saveState();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  updateRotationDisplay();
}
function setCourtPlayer(posIdx, target, playerName) {
  ensureCourtShape();
  const baseCourt = ensureCourtShapeFor(state.court); // opera sempre sul lineup visibile
  const name = (playerName || "").trim();
  if (!name) return;
  if (!canPlaceInSlot(name, posIdx, true)) return;
  const slotState = state.court[posIdx] || { main: "", replaced: "" };
  const slotBase = baseCourt[posIdx] || slotState;
  const isLiberoHere = isLibero(slotState.main) || isLibero(slotBase.main);
  const replacedName = slotState.replaced || slotBase.replaced || "";
  const prevMain = slotBase.main || "";
  const benchPlayers = new Set(getBenchPlayers());
  const shouldRecordSub =
    prevMain &&
    prevMain !== name &&
    !isLibero(prevMain) &&
    !isLibero(name) &&
    benchPlayers.has(name);
  // Caso speciale: rientro titolare al posto del libero che la sostituisce
  if (isLiberoHere && replacedName === name && !isLibero(name)) {
    const next = cloneCourtLineup(baseCourt);
    next[posIdx] = { main: name, replaced: "" };
    commitCourtChange(next);
    return;
  }
  let nextCourt = null;
  if (lineupCore && typeof lineupCore.setPlayerOnCourt === "function") {
    nextCourt = lineupCore.setPlayerOnCourt({
      court: baseCourt,
      posIdx,
      playerName: name,
      liberos: state.liberos || []
    });
  } else {
    const reserved = reserveNamesInCourt(name, baseCourt);
    reserved.forEach((slot, idx) => (baseCourt[idx] = slot));
    const slot = baseCourt[posIdx] || { main: "", replaced: "" };
    const prevMain = slot.main;
    const updated = Object.assign({}, slot);
    updated.main = name;
    const isIncomingLibero = (state.liberos || []).includes(name);
    const prevWasLibero = (state.liberos || []).includes(prevMain);
    if (isIncomingLibero) {
      if (prevWasLibero) {
        // mantieni l'aggancio alla titolare originale se stai sostituendo un libero con un altro libero
        updated.replaced = slot.replaced || "";
      } else {
        updated.replaced = prevMain || slot.replaced || "";
      }
      if (updated.replaced) {
        registerLiberoPair(updated.replaced, name);
      }
    } else {
      updated.replaced = "";
    }
    releaseReplaced(name, posIdx, baseCourt);
    baseCourt[posIdx] = updated;
    nextCourt = baseCourt;
  }
  const placedSlot = nextCourt && nextCourt[posIdx];
  if (placedSlot && isLibero(placedSlot.main) && placedSlot.replaced) {
    registerLiberoPair(placedSlot.replaced, placedSlot.main);
    state.preferredLibero = placedSlot.main;
    const roleCat = roleToAutoCategory(getRoleLabel(posIdx + 1)); // ruolo corrente della posizione
    if (roleCat) {
      state.autoLiberoRole = roleCat;
      state.autoLiberoBackline = true;
    }
  }
  commitCourtChange(nextCourt);
  if (shouldRecordSub && typeof recordSubstitutionEvent === "function") {
    recordSubstitutionEvent({ playerIn: name, playerOut: prevMain });
  }
}
function swapCourtPlayers(fromIdx, toIdx) {
  ensureCourtShape();
  const baseCourt =
    state.autoRolePositioning && autoRoleBaseCourt
      ? ensureCourtShapeFor(autoRoleBaseCourt)
      : ensureCourtShapeFor(state.court);
  if (fromIdx === toIdx) return;
  const fromSlot = baseCourt[fromIdx] || { main: "", replaced: "" };
  const toSlot = baseCourt[toIdx] || { main: "", replaced: "" };
  const fromName = fromSlot.main;
  if (!fromName) return;
  const toName = toSlot.main;
  if (isLibero(fromName) && FRONT_ROW_INDEXES.has(toIdx)) {
    alert("Non puoi spostare il libero in prima linea.");
    return;
  }
  if (isLibero(toName) && FRONT_ROW_INDEXES.has(fromIdx)) {
    alert("Non puoi spostare il libero in prima linea.");
    return;
  }
  let nextCourt = null;
  if (lineupCore && typeof lineupCore.swapCourtSlots === "function") {
    nextCourt = lineupCore.swapCourtSlots({ court: baseCourt, fromIdx, toIdx });
  } else {
    const cloned = cloneCourtLineup(baseCourt);
    cloned[toIdx] = fromSlot;
    cloned[fromIdx] = toSlot;
    nextCourt = cloned;
  }
  commitCourtChange(nextCourt);
}
function clearCourtAssignment(posIdx, target) {
  ensureCourtShape();
  const baseCourt =
    state.autoRolePositioning && autoRoleBaseCourt
      ? ensureCourtShapeFor(autoRoleBaseCourt)
      : ensureCourtShapeFor(state.court);
  const slot = baseCourt[posIdx];
  if (!slot) return;
  let nextCourt = null;
  if (lineupCore && typeof lineupCore.clearCourtSlot === "function") {
    nextCourt = lineupCore.clearCourtSlot({ court: baseCourt, posIdx, liberos: state.liberos || [] });
  } else {
    const updated = Object.assign({}, slot);
    if ((state.liberos || []).includes(slot.main) && slot.replaced) {
      updated.main = slot.replaced;
      updated.replaced = "";
    } else {
      updated.main = "";
      updated.replaced = "";
    }
    const cloned = cloneCourtLineup(baseCourt);
    cloned[posIdx] = updated;
    nextCourt = cloned;
  }
  commitCourtChange(nextCourt);
}
function initStats() {
  state.stats = {};
  state.players.forEach((_, idx) => {
    state.stats[idx] = {};
    SKILLS.forEach(skill => {
      state.stats[idx][skill.id] = {
        "#": 0,
        "+": 0,
        "!": 0,
        "-": 0,
        "=": 0,
        "/": 0
      };
    });
  });
}
function syncCurrentSetUI(value) {
  const setValue = String(value || 1);
  if (elCurrentSet) {
    elCurrentSet.value = setValue;
  }
  if (typeof document !== "undefined") {
    const label = "Set " + setValue;
    const display = document.getElementById("current-set-display");
    if (display) display.textContent = label;
  }
}
const matchSettings = (typeof window !== "undefined" &&
  typeof window.createMatchSettings === "function" &&
  window.createMatchSettings({
    state,
    getTodayIso,
    ensureMatchDefaults,
    setCurrentSet,
    syncCurrentSetUI,
    saveState,
    elOpponent,
    elCategory,
    elDate,
    elMatchType,
    elLeg,
    elCurrentSet,
    elPlayersInput,
    elOpponentPlayersInput
  })) || {
  applyMatchInfoToUI: () => {},
  saveMatchInfoFromUI: () => {},
  applyPlayersFromStateToTextarea: () => {},
  applyOpponentPlayersFromStateToTextarea: () => {}
};
const {
  applyMatchInfoToUI,
  saveMatchInfoFromUI,
  applyPlayersFromStateToTextarea,
  applyOpponentPlayersFromStateToTextarea
} = matchSettings;
// Esporta su window per i moduli che usano ancora i nomi globali (es. scout-ui).
window.applyMatchInfoToUI = applyMatchInfoToUI;
window.saveMatchInfoFromUI = saveMatchInfoFromUI;
window.applyPlayersFromStateToTextarea = applyPlayersFromStateToTextarea;
window.applyOpponentPlayersFromStateToTextarea = applyOpponentPlayersFromStateToTextarea;
window.renderMatchSummary = renderMatchSummary;

const opponentSettings =
  (typeof window !== "undefined" &&
    window.OpponentSettings &&
    typeof window.OpponentSettings.createOpponentSettings === "function" &&
    window.OpponentSettings.createOpponentSettings({
      state,
      saveState,
      normalizePlayers,
      parseDelimitedTeamText,
      buildNumbersForNames,
      syncOpponentPlayerNumbers,
      renderOpponentPlayersList,
      renderOpponentLiberoTags,
      applyOpponentPlayersFromStateToTextarea,
      elNewOpponentPlayerInput,
      elOpponentPlayersInput
    })) || {
    updateOpponentPlayersList: () => {},
    addOpponentPlayer: () => {},
    addOpponentPlayerFromInput: () => {},
    applyOpponentPlayersFromTextarea: () => {},
    clearOpponentPlayers: () => {},
    handleOpponentNumberChange: () => {},
    renameOpponentPlayerAtIndex: () => {},
    removeOpponentPlayerAtIndex: () => {},
    toggleOpponentLibero: () => {},
    setOpponentCaptain: () => {}
  };
const {
  updateOpponentPlayersList,
  addOpponentPlayer,
  addOpponentPlayerFromInput,
  applyOpponentPlayersFromTextarea,
  clearOpponentPlayers,
  handleOpponentNumberChange,
  renameOpponentPlayerAtIndex,
  removeOpponentPlayerAtIndex,
  toggleOpponentLibero,
  setOpponentCaptain
} = opponentSettings;
function renderPlayersManagerList() {
  if (!elPlayersList || !window.TeamUI) return;
  window.TeamUI.renderTeamPills({
    container: elPlayersList,
    players: state.players || [],
    numbers: state.playerNumbers || {},
    emptyMessage: "Nessuna giocatrice aggiunta.",
    fallbackNumber: (idx, name) => getPlayerNumber(name) || idx + 1,
    onRename: renamePlayerAtIndex,
    onNumberChange: handlePlayerNumberChange,
    onRemove: removePlayerAtIndex
  });
  renderLiberoTags();
}
function renderOpponentPlayersList() {
  if (!elOpponentPlayersList || !window.TeamUI) return;
  window.TeamUI.renderTeamPills({
    container: elOpponentPlayersList,
    players: state.opponentPlayers || [],
    numbers: state.opponentPlayerNumbers || {},
    emptyMessage: "Nessuna giocatrice avversaria aggiunta.",
    fallbackNumber: (idx, name) =>
      (state.opponentPlayerNumbers && state.opponentPlayerNumbers[name]) || idx + 1,
    showLiberoToggle: true,
    showCaptainToggle: true,
    liberoSet: new Set(state.opponentLiberos || []),
    captainSet: new Set(state.opponentCaptains || []),
    onRename: renameOpponentPlayerAtIndex,
    onNumberChange: handleOpponentNumberChange,
    onRemove: removeOpponentPlayerAtIndex,
    onToggleLibero: toggleOpponentLibero,
    onToggleCaptain: (name, active) => setOpponentCaptain(active ? name : "")
  });
  renderOpponentLiberoTags();
}
function getTeamStorageKey(name) {
  return TEAM_PREFIX + name;
}
function listTeamsFromStorage() {
  const names = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(TEAM_PREFIX)) {
        names.push(key.slice(TEAM_PREFIX.length));
      }
    }
  } catch (e) {
    logError("Error listing teams", e);
  }
  return names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
function loadTeamFromStorage(name) {
  if (!name) return null;
  try {
    const raw = localStorage.getItem(getTeamStorageKey(name));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    logError("Error loading team " + name, e);
    return null;
  }
}
function normalizeTeamPayload(raw, fallbackName = "") {
  if (!raw) return null;
  const name = raw.name || fallbackName || "";
  const staff = raw.staff || Object.assign({}, DEFAULT_STAFF);
  const makeId = () => {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
    } catch (e) {
      /* noop */
    }
    return Date.now() + "_" + Math.random();
  };
  if ((raw.version === 2 || raw.version === 3) && Array.isArray(raw.playersDetailed)) {
    const playersDetailed = enforceSingleCaptainFlag(
      raw.playersDetailed.map(p => {
        const parts = splitNameParts(p.name || "");
        return {
          id: p.id || makeId(),
          name: p.name || buildFullName(p.lastName, p.firstName),
          firstName: p.firstName || parts.firstName || "",
          lastName: p.lastName || parts.lastName || "",
          number: p.number || "",
          role: p.role === "L" ? "L" : "",
          isCaptain: !!p.isCaptain,
          out: !!p.out
        };
      }),
      (raw.captains && raw.captains[0]) || ""
    );
    const numbers = raw.numbers || {};
    const liberos = raw.liberos || playersDetailed.filter(p => p.role === "L" && !p.out).map(p => p.name);
    const captains = playersDetailed.filter(p => p.isCaptain && !p.out).map(p => p.name).slice(0, 1);
    return {
      version: 2,
      name,
      staff,
      playersDetailed,
      liberos,
      numbers,
      players: raw.players || playersDetailed.map(p => p.name),
      captains
    };
  }
  const legacyPlayers = raw.players || [];
  const liberos = raw.liberos || [];
  const numbers = raw.numbers || {};
  const playersDetailed = legacyPlayers.map((n, idx) => ({
    id: idx + "_" + n,
    name: n,
    ...splitNameParts(n),
    number: numbers[n] || "",
    role: liberos.includes(n) ? "L" : "",
    isCaptain: false,
    out: false
  }));
  const captains = [];
  return {
    version: 2,
    name,
    staff,
    playersDetailed,
    liberos,
    numbers,
    players: legacyPlayers,
    captains
  };
}
function loadTeamNormalized(name) {
  const raw = loadTeamFromStorage(name);
  return normalizeTeamPayload(raw, name);
}
function compactTeamPayload(data, fallbackName = "") {
  const normalized = normalizeTeamPayload(data, fallbackName);
  if (!normalized) return null;
  const playersDetailed =
    normalized.playersDetailed && normalized.playersDetailed.length > 0
      ? normalized.playersDetailed.map(p => {
          const parts = splitNameParts(p.name || buildFullName(p.lastName, p.firstName));
          return {
            id: p.id || parts.id || Date.now() + "_" + Math.random(),
            firstName: p.firstName || parts.firstName || "",
            lastName: p.lastName || parts.lastName || "",
            number: p.number || "",
            role: p.role === "L" ? "L" : "",
            isCaptain: !!p.isCaptain,
            out: !!p.out
          };
        })
      : [];
  return {
    version: 3,
    name: normalized.name || fallbackName,
    staff: normalized.staff || Object.assign({}, DEFAULT_STAFF),
    playersDetailed
  };
}
function saveTeamToStorage(name, data) {
  if (!name) return;
  try {
    const compact = compactTeamPayload(data, name);
    localStorage.setItem(getTeamStorageKey(name), JSON.stringify(compact));
  } catch (e) {
    logError("Error saving team " + name, e);
  }
}
function deleteTeamFromStorage(name) {
  if (!name) return;
  try {
    localStorage.removeItem(getTeamStorageKey(name));
  } catch (e) {
    logError("Error deleting team " + name, e);
  }
}
function loadTeamsMapFromStorage() {
  const map = {};
  listTeamsFromStorage().forEach(name => {
    const data = loadTeamFromStorage(name);
    if (data) map[name] = data;
  });
  return map;
}
function migrateTeamsToPersistent() {
  if (!state.savedTeams || Object.keys(state.savedTeams).length === 0) return;
  Object.entries(state.savedTeams).forEach(([name, data]) => {
    if (!localStorage.getItem(getTeamStorageKey(name))) {
      saveTeamToStorage(name, data);
    }
  });
}
function syncTeamsFromStorage() {
  state.savedTeams = loadTeamsMapFromStorage();
  state.savedOpponentTeams = state.savedTeams;
}
function migrateOpponentTeamsIntoTeams() {
  const opponentNames = listOpponentTeamsFromStorage();
  opponentNames.forEach(name => {
    const data = loadOpponentTeamFromStorage(name);
    if (data && !localStorage.getItem(getTeamStorageKey(name))) {
      saveTeamToStorage(name, data);
    }
  });
}
function extractRosterFromTeam(team) {
  const normalized = normalizeTeamPayload(team);
  if (!normalized)
    return { players: [], liberos: [], numbers: {}, staff: DEFAULT_STAFF, playersDetailed: [], captains: [] };
  const captainCandidates = []
    .concat(Array.isArray(normalized.captains) ? normalized.captains : [])
    .concat(
      (normalized.playersDetailed || [])
        .filter(p => p.isCaptain && !p.out)
        .map(p => p.name)
    );
  const captains = normalizePlayers(captainCandidates).filter(name =>
    (normalized.playersDetailed || []).some(p => p.name === name && !p.out)
  ).slice(0, 1);
  return {
    players: (normalized.playersDetailed || []).filter(p => !p.out).map(p => p.name),
    liberos:
      normalized.liberos && normalized.liberos.length > 0
        ? normalized.liberos
        : (normalized.playersDetailed || []).filter(p => p.role === "L" && !p.out).map(p => p.name),
    numbers: normalized.numbers || {},
    staff: normalized.staff || DEFAULT_STAFF,
    playersDetailed: normalized.playersDetailed || [],
    captains
  };
}
function getOpponentTeamStorageKey(name) {
  return OPPONENT_TEAM_PREFIX + name;
}
function listOpponentTeamsFromStorage() {
  // use the same pool as main teams
  return listTeamsFromStorage();
}
function loadOpponentTeamFromStorage(name) {
  return loadTeamFromStorage(name);
}
function saveOpponentTeamToStorage(name, data) {
  return saveTeamToStorage(name, data);
}
function deleteOpponentTeamFromStorage(name) {
  if (!name) return;
  try {
    localStorage.removeItem(getTeamStorageKey(name));
  } catch (e) {
    logError("Error deleting opponent team " + name, e);
  }
}
function loadOpponentTeamsMapFromStorage() {
  return loadTeamsMapFromStorage();
}
function migrateOpponentTeamsToPersistent() {
  // legacy: copy opponent-prefixed teams into main pool
  migrateOpponentTeamsIntoTeams();
  state.savedOpponentTeams = state.savedTeams;
}
function syncOpponentTeamsFromStorage() {
  state.savedOpponentTeams = loadOpponentTeamsMapFromStorage();
  // mantieni sincronizzati i due riferimenti
  state.savedTeams = state.savedOpponentTeams;
}
function getMatchStorageKey(name) {
  return MATCH_PREFIX + name;
}
function listMatchesFromStorage() {
  return Object.keys(localStorage)
    .filter(k => k.startsWith(MATCH_PREFIX))
    .map(k => k.replace(MATCH_PREFIX, ""));
}
function loadMatchFromStorage(name) {
  if (!name) return null;
  try {
    const raw = localStorage.getItem(getMatchStorageKey(name));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    logError("Error loading match " + name, e);
    return null;
  }
}
function saveMatchToStorage(name, data) {
  if (!name) return;
  try {
    localStorage.setItem(getMatchStorageKey(name), JSON.stringify(data));
  } catch (e) {
    logError("Error saving match " + name, e);
  }
}
function deleteMatchFromStorage(name) {
  if (!name) return;
  try {
    localStorage.removeItem(getMatchStorageKey(name));
  } catch (e) {
    logError("Error deleting match " + name, e);
  }
}
function loadMatchesMapFromStorage() {
  const map = {};
  listMatchesFromStorage().forEach(name => {
    const data = loadMatchFromStorage(name);
    if (data) map[name] = data;
  });
  return map;
}
function migrateMatchesToPersistent() {
  if (!state.savedMatches || Object.keys(state.savedMatches).length === 0) return;
  Object.entries(state.savedMatches).forEach(([name, data]) => {
    if (!localStorage.getItem(getMatchStorageKey(name))) {
      saveMatchToStorage(name, data);
    }
  });
}
function syncMatchesFromStorage() {
  state.savedMatches = loadMatchesMapFromStorage();
}
function renderTeamsSelect() {
  if (!elTeamsSelect) return;
  syncTeamsFromStorage();
  const names = Object.keys(state.savedTeams || {});
  const prev = elTeamsSelect.value || state.selectedTeam || "";
  elTeamsSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Nuova squadra (vuota)";
  elTeamsSelect.appendChild(placeholder);
  names.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    elTeamsSelect.appendChild(opt);
  });
  if (prev && names.includes(prev)) {
    elTeamsSelect.value = prev;
    state.selectedTeam = prev;
  } else {
    elTeamsSelect.value = "";
    state.selectedTeam = "";
  }
  updateTeamButtonsState();
}
function renderOpponentTeamsSelect() {
  if (!elOpponentTeamsSelect) return;
  syncOpponentTeamsFromStorage();
  const names = Object.keys(state.savedTeams || {});
  const prev = elOpponentTeamsSelect.value || state.selectedOpponentTeam || "";
  elOpponentTeamsSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Nuova avversaria (vuota)";
  elOpponentTeamsSelect.appendChild(placeholder);
  names
    .filter(name => name !== state.selectedTeam) // non mostrare la stessa squadra
    .forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      elOpponentTeamsSelect.appendChild(opt);
    });
  if (prev && names.includes(prev) && prev !== state.selectedTeam) {
    elOpponentTeamsSelect.value = prev;
    state.selectedOpponentTeam = prev;
  } else {
    elOpponentTeamsSelect.value = "";
    state.selectedOpponentTeam = "";
  }
  // se non ci sono squadre disponibili, proponi roster di default
  if (names.length === 0) {
    applyTemplateRoster("opponent", { askReset: false });
  }
  updateOpponentTeamButtonsState();
}
function renderMatchesSelect() {
  if (!elSavedMatchesSelect) return;
  syncMatchesFromStorage();
  const names = Object.keys(state.savedMatches || {});
  const prev = elSavedMatchesSelect.value || state.selectedMatch || "";
  elSavedMatchesSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Nuovo match (vuoto)";
  elSavedMatchesSelect.appendChild(placeholder);
  names.forEach(name => {
    const payload = state.savedMatches && state.savedMatches[name];
    const label =
      payload && payload.state && payload.state.match
        ? buildMatchDisplayName(payload.state.match)
        : name;
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = label || name;
    elSavedMatchesSelect.appendChild(opt);
  });
  if (prev && names.includes(prev)) {
    elSavedMatchesSelect.value = prev;
    state.selectedMatch = prev;
  } else {
    elSavedMatchesSelect.value = "";
    state.selectedMatch = "";
  }
  renderMatchesList(names, elSavedMatchesSelect.value || "");
  renderMatchSummary();
  updateMatchButtonsState();
}
function renderMatchesList(names, selected) {
  if (!elSavedMatchesList) return;
  elSavedMatchesList.innerHTML = "";
  if (!names || names.length === 0) {
    const empty = document.createElement("div");
    empty.className = "match-list-empty";
    empty.textContent = "Nessun match salvato.";
    elSavedMatchesList.appendChild(empty);
    return;
  }
  names.forEach(name => {
    const payload = state.savedMatches && state.savedMatches[name];
    const label =
      payload && payload.state && payload.state.match
        ? buildMatchDisplayName(payload.state.match)
        : name;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "match-list-item match-list-open" + (name === selected ? " active" : "");
    btn.dataset.matchName = name;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", name === selected ? "true" : "false");
    btn.textContent = label || name;
    elSavedMatchesList.appendChild(btn);
  });
}
function renderMatchSummary() {
  if (!elMatchSummary) return;
  const label = buildMatchDisplayName(state.match);
  elMatchSummary.textContent = label || "—";
}
function getCurrentTeamPayload(name = "") {
  const safeName = (name || state.selectedTeam || state.match.opponent || "squadra").trim();
  const existing = safeName ? loadTeamNormalized(safeName) : null;
  const staff = existing?.staff || Object.assign({}, DEFAULT_STAFF);
  const detailed = existing?.playersDetailed || [];
  const captainSet = new Set(state.captains || []);
  const playersDetailed =
    detailed.length > 0
      ? detailed.map(p => {
          const currentNumber = (state.playerNumbers && state.playerNumbers[p.name]) || p.number || "";
          const isLib = (state.liberos || []).includes(p.name) || p.role === "L";
          return Object.assign({}, p, {
            number: currentNumber,
            role: isLib ? "L" : "",
            isCaptain: captainSet.has(p.name) || !!p.isCaptain,
            out: !!p.out
          });
        })
      : (state.players || []).map((pName, idx) => ({
          id: idx + "_" + pName,
          name: pName,
          number: (state.playerNumbers && state.playerNumbers[pName]) || "",
          role: (state.liberos || []).includes(pName) ? "L" : "",
          isCaptain: captainSet.has(pName),
          out: false
        }));
  enforceSingleCaptainFlag(playersDetailed, state.captains && state.captains[0]);
  const liberos = playersDetailed.filter(p => p.role === "L" && !p.out).map(p => p.name);
  const numbers = {};
  playersDetailed.forEach(p => {
    if (p.number !== undefined && p.number !== null && p.number !== "") {
      numbers[p.name] = String(p.number);
    }
  });
  const players = playersDetailed.filter(p => !p.out).map(p => p.name);
  const captains = playersDetailed.filter(p => p.isCaptain && !p.out).map(p => p.name).slice(0, 1);
  return {
    version: 2,
    name: safeName,
    staff,
    playersDetailed,
    players,
    liberos,
    numbers,
    captains
  };
}
function getCurrentOpponentPayload(name = "") {
  const safeName = (name || state.selectedOpponentTeam || state.match.opponent || "avversaria").trim();
  const players = normalizePlayers(state.opponentPlayers || []);
  const numbers = {};
  players.forEach(p => {
    const num = state.opponentPlayerNumbers && state.opponentPlayerNumbers[p];
    if (num !== undefined && num !== null && num !== "") {
      numbers[p] = String(num);
    }
  });
  const liberos = normalizePlayers(state.opponentLiberos || []).filter(n => players.includes(n));
  const captains = normalizePlayers(state.opponentCaptains || []).filter(n => players.includes(n)).slice(0, 1);
  const playersDetailed =
    players.length > 0
      ? players.map((p, idx) => ({
          id: idx + "_" + p,
          name: p,
          ...splitNameParts(p),
          number: numbers[p] || "",
          role: liberos.includes(p) ? "L" : "",
          isCaptain: captains.includes(p),
          out: false
        }))
      : [];
  enforceSingleCaptainFlag(playersDetailed, captains[0] || "");
  return {
    version: 2,
    name: safeName,
    staff: DEFAULT_STAFF,
    playersDetailed,
    players,
    liberos,
    numbers,
    captains
  };
}
function saveCurrentTeam() {
  if (!state.players || state.players.length === 0) {
    alert("Aggiungi almeno una giocatrice prima di salvare.");
    return;
  }
  const existing = state.selectedTeam;
  let name = existing;
  if (!name) {
    name = prompt("Nome della squadra da salvare:", state.match.opponent || "");
    if (!name) return;
    name = name.trim();
  }
  if (!name) return;
  const payload = getCurrentTeamPayload(name);
  const compact = compactTeamPayload(payload, name);
  state.savedTeams = state.savedTeams || {};
  state.savedTeams[name] = compact;
  state.selectedTeam = name;
  saveTeamToStorage(name, compact);
  saveState();
  renderTeamsSelect();
  alert((existing ? "Squadra sovrascritta: " : "Squadra salvata: ") + name);
}
function saveCurrentOpponentTeam() {
  if (!state.opponentPlayers || state.opponentPlayers.length === 0) {
    alert("Aggiungi almeno una giocatrice avversaria prima di salvare.");
    return;
  }
  const existing = state.selectedOpponentTeam;
  let name = existing;
  if (!name) {
    name = prompt("Nome della squadra avversaria da salvare:", state.match.opponent || "");
    if (!name) return;
    name = name.trim();
  }
  if (!name) return;
  if (name === state.selectedTeam) {
    alert("Non puoi impostare come avversaria la stessa squadra selezionata.");
    return;
  }
  const payload = getCurrentOpponentPayload(name);
  const compact = compactTeamPayload(payload, name);
  state.savedOpponentTeams = state.savedOpponentTeams || {};
  state.savedOpponentTeams[name] = compact;
  state.selectedOpponentTeam = name;
  if (!state.match.opponent) {
    state.match.opponent = name;
    applyMatchInfoToUI();
  }
  saveOpponentTeamToStorage(name, compact);
  saveState();
  renderOpponentTeamsSelect();
  alert((existing ? "Avversaria sovrascritta: " : "Avversaria salvata: ") + name);
}
function deleteSelectedTeam() {
  if (!elTeamsSelect) return;
  const name = elTeamsSelect.value;
  if (!name) return;
  const ok = confirm("Eliminare la squadra \"" + name + "\"?");
  if (!ok) return;
  deleteTeamFromStorage(name);
  syncTeamsFromStorage();
  state.selectedTeam = "";
  renderTeamsSelect();
}
function deleteSelectedOpponentTeam() {
  if (!elOpponentTeamsSelect) return;
  const name = elOpponentTeamsSelect.value;
  if (!name) return;
  const ok = confirm("Eliminare l'avversaria \"" + name + "\"?");
  if (!ok) return;
  deleteOpponentTeamFromStorage(name);
  syncOpponentTeamsFromStorage();
  state.selectedOpponentTeam = "";
  renderOpponentTeamsSelect();
}
function getCurrentMatchPayload(name = "") {
  const safeName = (name || state.selectedMatch || state.match.opponent || "match").trim();
  const payload = buildMatchExportPayload();
  payload.name = safeName;
  return payload;
}
function saveCurrentMatch() {
  persistCurrentMatch();
}
function applyMatchPayload(payload, opts = {}) {
  if (!payload || !payload.state) return;
  applyImportedMatch(payload.state, { silent: opts.silent });
  state.selectedMatch = opts.selectedName || payload.name || "";
  saveState();
  renderMatchesSelect();
}
function loadSelectedMatch() {
  if (!elSavedMatchesSelect) return;
  const name = elSavedMatchesSelect.value;
  if (!name) {
    const ok =
      !state.events || state.events.length === 0
        ? true
        : confirm("Creare un nuovo match? I dati correnti verranno azzerati.");
    if (!ok) {
      renderMatchesSelect();
      return;
    }
    state.selectedMatch = generateMatchName();
    resetMatchState();
    persistCurrentMatch();
    return;
  }
  const data = loadMatchFromStorage(name);
  if (!data) {
    alert("Match non trovato o corrotto.");
    return;
  }
  isLoadingMatch = true;
  if (typeof window !== "undefined") {
    window.isLoadingMatch = true;
  }
  applyMatchPayload(data, { selectedName: name, silent: true });
  isLoadingMatch = false;
  if (typeof window !== "undefined") {
    window.isLoadingMatch = false;
  }
}
function deleteSelectedMatch() {
  if (!elSavedMatchesSelect && !elSavedMatchesList) return;
  const name = elSavedMatchesSelect ? elSavedMatchesSelect.value : "";
  if (!name) return;
  const ok = confirm('Eliminare il match "' + name + '"?');
  if (!ok) return;
  deleteMatchFromStorage(name);
  syncMatchesFromStorage();
  state.selectedMatch = "";
  renderMatchesSelect();
}
function renameSelectedMatch() {
  // intentionally no-op: naming is automatic from match info
}
function resetMatchState() {
  const preservedCourt = state.court ? JSON.parse(JSON.stringify(state.court)) : Array.from({ length: 6 }, () => ({ main: "" }));
  const preservedRotation = state.rotation || 1;
  const preservedServing = !!state.isServing;
  const preservedAutoRoleCourt = Array.isArray(state.autoRoleBaseCourt) ? [...state.autoRoleBaseCourt] : [];
  const preservedLiberoMap = Object.assign({}, state.liberoAutoMap || {});
  const preservedPreferredLibero = state.preferredLibero || "";
  if (typeof resetSetTypeState === "function") {
    resetSetTypeState();
  }
  state.match = {
    opponent: "",
    category: "",
    date: getTodayIso(),
    leg: "",
    matchType: "amichevole"
  };
  state.events = [];
  state.stats = {};
  state.court = preservedCourt;
  autoRoleBaseCourt = preservedAutoRoleCourt.length ? [...preservedAutoRoleCourt] : null;
  state.autoRoleBaseCourt = preservedAutoRoleCourt;
  state.rotation = preservedRotation;
  state.isServing = preservedServing;
  state.currentSet = 1;
  state.matchFinished = false;
  state.scoreOverrides = {};
  state.autoRotatePending = false;
  state.liberoAutoMap = preservedLiberoMap;
  state.preferredLibero = preservedPreferredLibero;
  state.skillClock = { paused: true, pausedAtMs: null, pausedAccumMs: 0, lastEffectiveMs: 0 };
  state.video = state.video || { offsetSeconds: 0, fileName: "", youtubeId: "", youtubeUrl: "" };
  state.video.offsetSeconds = 0;
  state.video.youtubeId = "";
  state.video.youtubeUrl = "";
  state.videoClock = {
    paused: true,
    pausedAtMs: null,
    pausedAccumMs: 0,
    startMs: Date.now(),
    currentSeconds: 0
  };
  if (typeof clearEventSelection === "function") {
    clearEventSelection({ clearContexts: true });
  }
  if (typeof clearCachedLocalVideo === "function") {
    clearCachedLocalVideo();
  }
  if (typeof ytPlayer !== "undefined" && ytPlayer && ytPlayer.stopVideo) {
    ytPlayer.stopVideo();
  }
  if (typeof elAnalysisVideo !== "undefined" && elAnalysisVideo) {
    elAnalysisVideo.pause();
    elAnalysisVideo.currentTime = 0;
  }
  if (typeof elYoutubeFrame !== "undefined" && elYoutubeFrame) {
    elYoutubeFrame.src = "";
    elYoutubeFrame.style.display = "none";
  }
  enforceAutoLiberoForState({ skipServerOnServe: true });
  initStats();
  saveState();
  recalcAllStatsAndUpdateUI();
  renderEventsLog();
  renderPlayers();
  renderBenchChips();
  updateRotationDisplay();
  applyMatchInfoToUI();
  renderMatchesSelect();
}
function renameSelectedTeam() {
  if (!elTeamsSelect) return;
  const oldName = elTeamsSelect.value;
  if (!oldName) {
    alert("Seleziona una squadra da rinominare.");
    return;
  }
  const currentData = loadTeamFromStorage(oldName);
  if (!currentData) {
    alert("Squadra non trovata o corrotta.");
    return;
  }
  let newName = prompt("Nuovo nome per la squadra:", oldName) || "";
  newName = newName.trim();
  if (!newName) return;
  if (newName === oldName) return;
  const names = listTeamsFromStorage();
  const exists = names.includes(newName);
  if (exists) {
    const overwrite = confirm(
      "Esiste già una squadra con questo nome. Sovrascrivere con la squadra corrente?"
    );
    if (!overwrite) return;
  }
  saveTeamToStorage(newName, currentData);
  deleteTeamFromStorage(oldName);
  syncTeamsFromStorage();
  state.selectedTeam = newName;
  renderTeamsSelect();
  alert("Squadra rinominata in \"" + newName + "\".");
}
function renameSelectedOpponentTeam() {
  if (!elOpponentTeamsSelect) return;
  const oldName = elOpponentTeamsSelect.value;
  if (!oldName) {
    alert("Seleziona una squadra avversaria da rinominare.");
    return;
  }
  const currentData = loadOpponentTeamFromStorage(oldName);
  if (!currentData) {
    alert("Squadra avversaria non trovata o corrotta.");
    return;
  }
  let newName = prompt("Nuovo nome per l'avversaria:", oldName) || "";
  newName = newName.trim();
  if (!newName) return;
  if (newName === oldName) return;
  const names = listOpponentTeamsFromStorage();
  const exists = names.includes(newName);
  if (exists) {
    const overwrite = confirm(
      "Esiste già una squadra avversaria con questo nome. Sovrascrivere con il roster corrente?"
    );
    if (!overwrite) return;
  }
  saveOpponentTeamToStorage(newName, currentData);
  deleteOpponentTeamFromStorage(oldName);
  syncOpponentTeamsFromStorage();
  state.selectedOpponentTeam = newName;
  renderOpponentTeamsSelect();
  alert("Avversaria rinominata in \"" + newName + "\".");
}
async function exportCurrentTeamToFile() {
  if (!state.players || state.players.length === 0) {
    alert("Aggiungi almeno una giocatrice prima di esportare.");
    return;
  }
  const payload = compactTeamPayload(getCurrentTeamPayload());
  const opponentSlug = (payload.name || "squadra").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8;"
  });
  downloadBlob(blob, "squadra_" + (opponentSlug || "export") + ".json");
}
async function exportCurrentOpponentTeamToFile() {
  if (!state.opponentPlayers || state.opponentPlayers.length === 0) {
    alert("Aggiungi almeno una giocatrice avversaria prima di esportare.");
    return;
  }
  const payload = compactTeamPayload(getCurrentOpponentPayload());
  const slug = (payload.name || "avversaria").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  downloadBlob(blob, "avversaria_" + (slug || "export") + ".json");
}
function applyImportedTeamData(data) {
  const normalizedTeam = normalizeTeamPayload(data || {});
  const roster = extractRosterFromTeam(normalizedTeam);
  const players = roster.players || [];
  if (!players || players.length === 0) {
    alert("Il file non contiene giocatrici valide.");
    return;
  }
  if (state.events.length > 0) {
    const ok = confirm(
      "Importare una squadra da file azzera statistiche e sostituisce il roster corrente. Procedere?"
    );
    if (!ok) return;
  }
  updatePlayersList(players, {
    askReset: false,
    liberos: roster.liberos || [],
    playerNumbers: roster.numbers || {},
    captains: roster.captains || [],
    setDefaultLineup: true,
    defaultLineupNames:
      roster.playersDetailed && roster.playersDetailed.length > 0
        ? roster.playersDetailed.filter(p => !p.out).map(p => p.name)
        : players
  });
  state.selectedTeam = normalizedTeam && normalizedTeam.name ? normalizedTeam.name : "";
  if (state.selectedTeam) {
    saveTeamToStorage(state.selectedTeam, normalizedTeam);
    syncTeamsFromStorage();
    renderTeamsSelect();
  }
  saveState();
  renderLiberoTags();
  renderOpponentLiberoTags();
  renderLiberoChipsInline();
  renderPlayers();
  renderBenchChips();
  renderLineupChips();
  alert("Squadra importata dal file.");
}
function applyImportedOpponentTeamData(data) {
  const normalizedTeam = normalizeTeamPayload(data || {});
  const roster = extractRosterFromTeam(normalizedTeam);
  const players = roster.players || [];
  if (!players || players.length === 0) {
    alert("Il file non contiene giocatrici valide.");
    return;
  }
  updateOpponentPlayersList(players, {
    liberos: roster.liberos || [],
    playerNumbers: roster.numbers || {},
    captains: roster.captains || []
  });
  state.selectedOpponentTeam = (normalizedTeam && normalizedTeam.name) || "";
  if (state.selectedOpponentTeam) {
    saveOpponentTeamToStorage(state.selectedOpponentTeam, normalizedTeam);
    syncOpponentTeamsFromStorage();
    renderOpponentTeamsSelect();
    if (!state.match.opponent) {
      state.match.opponent = state.selectedOpponentTeam;
      applyMatchInfoToUI();
    }
  }
  saveState();
  renderOpponentPlayersList();
  renderOpponentLiberoTags();
  alert("Squadra avversaria importata dal file.");
}
function parseDelimitedTeamText(text) {
  if (!text || typeof text !== "string") return null;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const players = [];
  const numbers = {};
  const liberos = [];
  lines.forEach(rawLine => {
    let name = "";
    let number = "";
    let liberoFlag = "";
    const parts = rawLine.split(/[\t;,]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      name = parts[0];
      number = parts[1];
      liberoFlag = parts[2] || "";
    } else {
      const match = rawLine.match(/^(.+?)\s+([0-9]{1,3})(?:\s+([Ll]))?$/);
      if (match) {
        name = match[1].trim();
        number = match[2].trim();
        liberoFlag = (match[3] || "").trim();
      }
    }
    const cleanName = normalizePlayers([name])[0];
    if (!cleanName) return;
    players.push(cleanName);
    if (number && /^[0-9]{1,3}$/.test(number)) {
      numbers[cleanName] = number;
    }
    if (liberoFlag && liberoFlag.toLowerCase() === "l") {
      liberos.push(cleanName);
    }
  });
  if (players.length === 0) return null;
  return { players, numbers, liberos };
}
function importOpponentTeamFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const text = (e.target && e.target.result) || "";
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        data = parseDelimitedTeamText(text);
      }
      applyImportedOpponentTeamData(data);
    } catch (err) {
      logError("Errore importazione avversaria", err);
      alert("File squadra avversaria non valido.");
    }
    if (elOpponentTeamFileInput) {
      elOpponentTeamFileInput.value = "";
    }
  };
  reader.readAsText(file);
}
function importTeamFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const text = (e.target && e.target.result) || "";
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        data = parseDelimitedTeamText(text);
      }
      applyImportedTeamData(data);
    } catch (err) {
      logError("Errore importazione squadra", err);
      alert("File squadra non valido.");
    }
    if (elTeamFileInput) {
      elTeamFileInput.value = "";
    }
  };
  reader.readAsText(file);
}
function handleTeamSelectChange() {
  if (!elTeamsSelect) return;
  const selected = elTeamsSelect.value;
  state.selectedTeam = selected;
  updateTeamButtonsState();
  if (!selected) {
    const ok = confirm(
      "Caricare una nuova squadra precompilata (14 giocatrici e 2 liberi) azzererà roster e statistiche correnti. Procedere?"
    );
    if (!ok) {
      renderTeamsSelect();
      return;
    }
    applyTemplateRoster("our", { askReset: false });
    renderTeamsSelect();
    return;
  }
  const team = loadTeamFromStorage(selected);
  if (!team) {
    alert("Squadra non trovata o corrotta.");
    renderTeamsSelect();
    return;
  }
  const roster = extractRosterFromTeam(team);
  updatePlayersList(roster.players || [], {
    askReset: true,
    liberos: roster.liberos || [],
    playerNumbers: roster.numbers || {},
    captains: roster.captains || [],
    setDefaultLineup: true,
    defaultLineupNames:
      roster.playersDetailed && roster.playersDetailed.length > 0
        ? roster.playersDetailed.filter(p => !p.out).map(p => p.name)
        : roster.players || []
  });
  renderLiberoTags();
  renderTeamsSelect();
  renderLiberoChipsInline();
}
function handleOpponentTeamSelectChange() {
  if (!elOpponentTeamsSelect) return;
  const selected = elOpponentTeamsSelect.value;
  if (selected && selected === state.selectedTeam) {
    alert("Non puoi selezionare la stessa squadra come avversaria.");
    elOpponentTeamsSelect.value = "";
    state.selectedOpponentTeam = "";
    return;
  }
  state.selectedOpponentTeam = selected;
  updateOpponentTeamButtonsState();
  if (!selected) {
    const ok = confirm(
      "Caricare una nuova squadra avversaria precompilata (14 giocatrici e 2 liberi)?"
    );
    if (ok) {
      applyTemplateRoster("opponent", { askReset: false });
    }
    renderOpponentTeamsSelect();
    return;
  }
  const team = loadOpponentTeamFromStorage(selected);
  if (!team) {
    alert("Squadra avversaria non trovata o corrotta.");
    renderOpponentTeamsSelect();
    return;
  }
  const roster = extractRosterFromTeam(team);
  updateOpponentPlayersList(roster.players || [], {
    liberos: roster.liberos || [],
    playerNumbers: roster.numbers || {},
    captains: roster.captains || []
  });
  if (!state.match.opponent) {
    state.match.opponent = selected;
    applyMatchInfoToUI();
  }
  renderOpponentTeamsSelect();
}
function renderLiberoTags() {
  const mainContainers = [elLiberoTags].filter(Boolean);
  const inlineContainers = [elLiberoTagsInline].filter(Boolean);
  [...mainContainers, ...inlineContainers].forEach(container => {
    container.innerHTML = "";
  });
  if (!state.players || state.players.length === 0) {
    [...mainContainers].forEach(container => {
      const span = document.createElement("div");
      span.className = "players-empty";
      span.textContent = "Aggiungi giocatrici per segnare i liberi.";
      container.appendChild(span);
    });
    inlineContainers.forEach(container => {
      const span = document.createElement("div");
      span.className = "players-empty";
      span.textContent = "Nessun libero selezionato.";
      container.appendChild(span);
    });
    return;
  }
  const libSet = new Set(state.liberos || []);
  // Impostazioni: mostra tutte le giocatrici, evidenziando i liberi
  mainContainers.forEach(container => {
    state.players.forEach(name => {
      const btn = document.createElement("button");
      const active = libSet.has(name);
      btn.type = "button";
      btn.className = "libero-tag" + (active ? " active" : "");
      btn.textContent = formatNameWithNumber(name);
      btn.addEventListener("click", () => toggleLibero(name));
      container.appendChild(btn);
    });
  });
  // Inline: lista drag dei liberi disponibili (anche se in campo, marcati come bloccati)
  inlineContainers.forEach(container => {
    const used = getUsedNames();
    if (libSet.size === 0) {
      const span = document.createElement("div");
      span.className = "players-empty";
      span.textContent = "Nessun libero selezionato.";
      container.appendChild(span);
      return;
    }
    state.players.forEach(name => {
      if (!libSet.has(name)) return;
      const chip = document.createElement("div");
      const classes = ["bench-chip", "libero-flag"];
      const isUsed = used.has(name);
      if (isUsed) classes.push("bench-locked");
      chip.className = classes.join(" ");
      chip.draggable = !isUsed;
      chip.dataset.playerName = name;
      const label = document.createElement("span");
      label.textContent = formatNameWithNumber(name) + (isUsed ? " (in campo)" : "");
      chip.appendChild(label);
      if (!isUsed) {
        chip.addEventListener("dragstart", handleBenchDragStart);
        chip.addEventListener("dragend", handleBenchDragEnd);
        chip.addEventListener("click", () => handleBenchClick(name));
      }
      container.appendChild(chip);
    });
  });
}
function renderOpponentLiberoTags() {
  if (!elOpponentLiberoTags) return;
  elOpponentLiberoTags.innerHTML = "";
  if (!state.opponentPlayers || state.opponentPlayers.length === 0) {
    const span = document.createElement("div");
    span.className = "players-empty";
    span.textContent = "Aggiungi giocatrici avversarie per segnare i liberi.";
    elOpponentLiberoTags.appendChild(span);
    return;
  }
  const libSet = new Set(state.opponentLiberos || []);
  state.opponentPlayers.forEach(name => {
    const btn = document.createElement("button");
    const active = libSet.has(name);
    btn.type = "button";
    btn.className = "libero-tag" + (active ? " active" : "");
    btn.textContent = formatNameWithNumber(name);
    btn.addEventListener("click", () => toggleOpponentLibero(name, !active));
    elOpponentLiberoTags.appendChild(btn);
  });
}
const allowedMetricCodes = new Set(RESULT_CODES);
const SETTINGS_RESULT_CODES = ["#", "+", "!", "-", "/", "="];
const allowedPointCodes = new Set([...SETTINGS_RESULT_CODES, "for", "against", "error"]);
function normalizeMetricConfig(skillId, cfg) {
  const def = METRIC_DEFAULTS[skillId] || METRIC_DEFAULTS.serve;
  const uniq = list =>
    Array.from(new Set((list || []).filter(code => allowedMetricCodes.has(code))));
  const positive = uniq((cfg && cfg.positive) || def.positive || ["#", "+"]);
  const negative = uniq((cfg && cfg.negative) || def.negative || ["-"]);
  const neutral = RESULT_CODES.filter(code => !positive.includes(code) && !negative.includes(code));
  const activeCodes = uniq((cfg && cfg.activeCodes) || def.activeCodes || RESULT_CODES);
  const enabled = cfg && typeof cfg.enabled === "boolean" ? cfg.enabled : def.enabled !== false;
  return { positive, neutral, negative, activeCodes, enabled };
}
function normalizePointRule(skillId, cfg) {
  const def = POINT_RULE_DEFAULTS[skillId] || { for: [], against: [] };
  const uniq = list =>
    Array.from(new Set((list || []).filter(code => allowedPointCodes.has(code))));
  const made = uniq((cfg && cfg.for) || def.for || []);
  const conceded = uniq((cfg && cfg.against) || def.against || []);
  return { for: made, against: conceded };
}
function normalizeScoreOverrides(raw) {
  const cleaned = {};
  if (!raw || typeof raw !== "object") return cleaned;
  Object.keys(raw).forEach(key => {
    const setNum = parseInt(key, 10);
    if (!setNum || setNum < 1 || setNum > 5) return;
    const entry = raw[key] || {};
    const forVal = Number(entry.for);
    const againstVal = Number(entry.against);
    cleaned[setNum] = {
      for: Number.isFinite(forVal) ? forVal : 0,
      against: Number.isFinite(againstVal) ? againstVal : 0
    };
  });
  return cleaned;
}
function ensurePointRulesDefaults() {
  state.pointRules = state.pointRules || {};
  SKILLS.forEach(skill => {
    state.pointRules[skill.id] = normalizePointRule(skill.id, state.pointRules[skill.id]);
  });
}
function getCodeTone(skillId, code) {
  ensureMetricsConfigDefaults();
  const cfg = normalizeMetricConfig(skillId, state.metricsConfig[skillId]);
  if (cfg.positive.includes(code)) return "positive";
  if (cfg.negative.includes(code)) return "negative";
  return "neutral";
}
function ensureMetricsConfigDefaults() {
  state.metricsConfig = state.metricsConfig || {};
  SKILLS.forEach(skill => {
    state.metricsConfig[skill.id] = normalizeMetricConfig(skill.id, state.metricsConfig[skill.id]);
  });
}
function updateTeamButtonsState() {
  if (!elTeamsSelect) return;
  const selected = elTeamsSelect.value || "";
  if (elBtnSaveTeam) {
    elBtnSaveTeam.textContent = selected ? "Sovrascrivi" : "Salva squadra";
  }
  if (elBtnDeleteTeam) {
    elBtnDeleteTeam.disabled = !selected;
  }
  if (elBtnRenameTeam) {
    elBtnRenameTeam.disabled = !selected;
  }
}
function updateOpponentTeamButtonsState() {
  if (!elOpponentTeamsSelect) return;
  const selected = elOpponentTeamsSelect.value || "";
  if (elBtnSaveOpponentTeam) {
    elBtnSaveOpponentTeam.textContent = selected ? "Sovrascrivi" : "Salva avversaria";
  }
  if (elBtnDeleteOpponentTeam) {
    elBtnDeleteOpponentTeam.disabled = !selected;
  }
  if (elBtnRenameOpponentTeam) {
    elBtnRenameOpponentTeam.disabled = !selected;
  }
}
function updateMatchButtonsState() {
  if (!elSavedMatchesSelect && !elSavedMatchesList) return;
  const selected = elSavedMatchesSelect ? elSavedMatchesSelect.value || "" : "";
  if (elBtnDeleteMatch) {
    elBtnDeleteMatch.disabled = !selected;
  }
}
const STATE_DB_NAME = "volleyScoutStateDb";
const STATE_DB_VERSION = 1;
const STATE_DB_STORE = "state";
let stateDbPromise = null;
function getStateDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (stateDbPromise) return stateDbPromise;
  stateDbPromise = new Promise(resolve => {
    const request = indexedDB.open(STATE_DB_NAME, STATE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STATE_DB_STORE)) {
        db.createObjectStore(STATE_DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return stateDbPromise;
}
function readStateFromIndexedDb() {
  return getStateDb().then(db => {
    if (!db) return null;
    return new Promise(resolve => {
      const tx = db.transaction(STATE_DB_STORE, "readonly");
      const store = tx.objectStore(STATE_DB_STORE);
      const request = store.get(STORAGE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  });
}
function writeStateToIndexedDb(snapshot) {
  return getStateDb().then(db => {
    if (!db) return false;
    return new Promise(resolve => {
      const tx = db.transaction(STATE_DB_STORE, "readwrite");
      const store = tx.objectStore(STATE_DB_STORE);
      store.put(snapshot, STORAGE_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  });
}
function generateMatchName(base = "") {
  if (base) return base;
  return buildMatchDisplayName(state.match);
}
function persistCurrentMatch() {
  if (typeof buildMatchExportPayload !== "function") return;
  state.savedMatches = state.savedMatches || {};
  const currentName = (state.selectedMatch || "").trim();
  const desiredName = currentName || generateMatchName(state.selectedMatch);
  const payload = getCurrentMatchPayload(desiredName);
  state.selectedMatch = desiredName;
  state.savedMatches[desiredName] = payload;
  saveMatchToStorage(desiredName, payload);
  updateMatchButtonsState();
  renderMatchesSelect();
}
function buildTemplateNumbers() {
  const numbers = {};
  TEMPLATE_TEAM.players.forEach((name, idx) => {
    numbers[name] = String(idx + 1);
  });
  return numbers;
}
function buildRoleBasedDefaultLineup(names = []) {
  const normalized = normalizePlayers(names);
  const buckets = { P: [], O: [], S: [], C: [], other: [] };
  normalized.forEach(name => {
    const lower = name.toLowerCase();
    if (lower.includes("libero")) {
      return; // libero non in campo base
    } else if (lower.includes("palleggi")) {
      buckets.P.push(name);
    } else if (lower.includes("oppost")) {
      buckets.O.push(name);
    } else if (lower.includes("schiacci")) {
      buckets.S.push(name);
    } else if (lower.includes("centr")) {
      buckets.C.push(name);
    } else {
      buckets.other.push(name);
    }
  });
  const used = new Set();
  const pick = list => {
    const found = list.find(n => !used.has(n));
    if (found) used.add(found);
    return found || "";
  };
  const lineup = Array(6).fill("");
  lineup[0] = pick(buckets.P) || pick(buckets.S) || pick(buckets.other); // P
  lineup[3] = pick(buckets.O) || pick(buckets.S) || pick(buckets.other); // O
  lineup[1] = pick(buckets.S) || pick(buckets.other); // S1
  lineup[4] = pick(buckets.S) || pick(buckets.other); // S2
  lineup[5] = pick(buckets.C) || pick(buckets.other); // C1
  lineup[2] = pick(buckets.C) || pick(buckets.other); // C2
  const leftovers = normalized.filter(n => !used.has(n));
  lineup.forEach((name, idx) => {
    if (!name && leftovers.length > 0) {
      const next = leftovers.shift();
      used.add(next);
      lineup[idx] = next;
    }
  });
  return lineup;
}
function applyTemplateTeam(options = {}) {
  const { askReset = true } = options;
  updatePlayersList(TEMPLATE_TEAM.players, {
    askReset,
    liberos: TEMPLATE_TEAM.liberos,
    playerNumbers: buildTemplateNumbers(),
    captains: [],
    setDefaultLineup: true,
    defaultLineupNames: buildRoleBasedDefaultLineup(TEMPLATE_TEAM.players)
  });
}
function applyTemplateRoster(scope = "our", options = {}) {
  if (scope === "opponent") {
    updateOpponentPlayersList(TEMPLATE_TEAM.players, {
      liberos: TEMPLATE_TEAM.liberos,
      playerNumbers: buildTemplateNumbers(),
      captains: []
    });
    return;
  }
  applyTemplateTeam(options);
}
function buildTeamManagerStateFromSource(source, scope = "our") {
  const isOpponent = scope === "opponent";
  const normalized = source ? normalizeTeamPayload(source) : null;
  const captainSet = new Set(isOpponent ? state.opponentCaptains || [] : state.captains || []);
  const basePlayers = isOpponent ? state.opponentPlayers || [] : state.players || [];
  const baseNumbers = isOpponent ? state.opponentPlayerNumbers || {} : state.playerNumbers || {};
  const baseLiberos = isOpponent ? state.opponentLiberos || [] : state.liberos || [];
  const playersDetailed =
    normalized && normalized.playersDetailed && normalized.playersDetailed.length > 0
      ? normalized.playersDetailed.map(p => {
          const parts = splitNameParts(p.name || buildFullName(p.lastName, p.firstName));
          const fullName = p.name || buildFullName(p.lastName, p.firstName);
          const isLib = baseLiberos.includes(fullName) || p.role === "L";
          return Object.assign(
            {},
            p,
            {
              firstName: p.firstName || parts.firstName || "",
              lastName: p.lastName || parts.lastName || "",
              name: fullName,
              role: isLib ? "L" : ""
            }
          );
        })
      : basePlayers.map((name, idx) => ({
          id: idx + "_" + name,
          name,
          ...splitNameParts(name),
          number: baseNumbers[name] || "",
          role: baseLiberos.includes(name) ? "L" : "",
          isCaptain: captainSet.has(name),
          out: false
        }));
  enforceSingleCaptainFlag(
    playersDetailed,
    (isOpponent ? state.opponentCaptains : state.captains) &&
      (isOpponent ? state.opponentCaptains : state.captains)[0]
  );
  return {
    name:
      (normalized && normalized.name) ||
      (isOpponent ? state.selectedOpponentTeam : state.selectedTeam) ||
      state.match.opponent ||
      (isOpponent ? "Avversaria" : "Squadra"),
    staff: (normalized && normalized.staff) || Object.assign({}, DEFAULT_STAFF),
    players: playersDetailed
  };
}
function renderTeamManagerTable() {
  if (!elTeamManagerBody || !teamManagerState) return;
  elTeamManagerBody.innerHTML = "";
  const isEmpty = !teamManagerState.players || teamManagerState.players.length === 0;
  if (elTeamManagerTemplate) {
    elTeamManagerTemplate.classList.toggle("hidden", !isEmpty);
  }
  teamManagerState.players.forEach((p, idx) => {
    const tr = document.createElement("tr");
    const numberInput = document.createElement("input");
    numberInput.type = "number";
    numberInput.min = "0";
    numberInput.max = "99";
    numberInput.value = p.number || "";
    numberInput.addEventListener("change", () => {
      p.number = numberInput.value;
    });
    const lastNameInput = document.createElement("input");
    lastNameInput.type = "text";
    lastNameInput.placeholder = "Cognome";
    lastNameInput.value = p.lastName || splitNameParts(p.name).lastName || "";
    const firstNameInput = document.createElement("input");
    firstNameInput.type = "text";
    firstNameInput.placeholder = "Nome";
    firstNameInput.value = p.firstName || splitNameParts(p.name).firstName || "";
    const syncFullName = () => {
      p.lastName = lastNameInput.value.trim();
      p.firstName = firstNameInput.value.trim();
      p.name = buildFullName(p.lastName, p.firstName);
    };
    syncFullName();
    lastNameInput.addEventListener("change", () => {
      syncFullName();
    });
    firstNameInput.addEventListener("change", () => {
      syncFullName();
    });
    let liberoChk = null;
    const captainChk = document.createElement("input");
    captainChk.type = "checkbox";
    captainChk.checked = !!p.isCaptain;
    captainChk.addEventListener("change", () => {
      p.isCaptain = captainChk.checked;
      enforceSingleCaptainFlag(teamManagerState.players, p.isCaptain ? p.name : "");
      renderTeamManagerTable();
    });
    liberoChk = document.createElement("input");
    liberoChk.type = "checkbox";
    liberoChk.checked = p.role === "L";
    liberoChk.addEventListener("change", () => {
      p.role = liberoChk.checked ? "L" : "";
    });
    const outChk = document.createElement("input");
    outChk.type = "checkbox";
    outChk.checked = !!p.out;
    outChk.addEventListener("change", () => {
      p.out = outChk.checked;
    });
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "small danger";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", () => {
      teamManagerState.players.splice(idx, 1);
      renderTeamManagerTable();
    });
    [
      numberInput,
      lastNameInput,
      firstNameInput,
      captainChk,
      outChk
    ].forEach(control => control.classList.add("team-manager-input"));

    const tds = [
      numberInput,
      lastNameInput,
      firstNameInput,
      captainChk,
      liberoChk,
      outChk,
      delBtn
    ];
    tds.forEach(el => {
      const td = document.createElement("td");
      if (el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "BUTTON")) {
        td.appendChild(el);
      } else {
        td.textContent = el;
      }
      tr.appendChild(td);
    });
    elTeamManagerBody.appendChild(tr);
  });
}
function openTeamManagerModal(scope = "our") {
  teamManagerScope = scope;
  const isOpponent = scope === "opponent";
  const selected = isOpponent ? state.selectedOpponentTeam : state.selectedTeam;
  const source = selected
    ? isOpponent
      ? loadOpponentTeamFromStorage(selected)
      : loadTeamFromStorage(selected)
    : null;
  teamManagerState = buildTeamManagerStateFromSource(source, scope);
  if (elTeamMetaName) elTeamMetaName.value = teamManagerState.name || "";
  if (elTeamMetaHead) elTeamMetaHead.value = teamManagerState.staff.headCoach || "";
  if (elTeamMetaAssistant) elTeamMetaAssistant.value = teamManagerState.staff.assistantCoach || "";
  if (elTeamMetaManager) elTeamMetaManager.value = teamManagerState.staff.manager || "";
  renderTeamManagerTable();
  if (elTeamManagerModal) {
    elTeamManagerModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }
  const title = document.querySelector("#team-manager-modal h3");
  if (title) {
    title.textContent = isOpponent ? "Gestione squadra avversaria" : "Gestione squadra";
  }
}
function closeTeamManagerModal() {
  if (elTeamManagerModal) {
    elTeamManagerModal.classList.add("hidden");
  }
  document.body.classList.remove("modal-open");
}
function collectTeamManagerPayload() {
  if (!teamManagerState) return null;
  const name = elTeamMetaName && elTeamMetaName.value ? elTeamMetaName.value.trim() : teamManagerState.name;
  const staff = {
    headCoach: (elTeamMetaHead && elTeamMetaHead.value) || "",
    assistantCoach: (elTeamMetaAssistant && elTeamMetaAssistant.value) || "",
    manager: (elTeamMetaManager && elTeamMetaManager.value) || ""
  };
  const playersDetailed = enforceSingleCaptainFlag(
    teamManagerState.players
      .filter(p => (p.name || "").trim() !== "")
      .map((p, idx) => ({
        id: p.id || idx + "_" + p.name,
        name: buildFullName(p.lastName, p.firstName) || p.name.trim(),
        firstName: p.firstName || splitNameParts(p.name).firstName || "",
        lastName: p.lastName || splitNameParts(p.name).lastName || "",
        number: p.number || "",
        role: p.role === "L" ? "L" : "",
        isCaptain: !!p.isCaptain,
        out: !!p.out
      })),
    (teamManagerScope === "opponent" ? state.opponentCaptains : state.captains) &&
      (teamManagerScope === "opponent" ? state.opponentCaptains : state.captains)[0]
  );
  const liberos = playersDetailed.filter(p => p.role === "L" && !p.out).map(p => p.name);
  const numbers = {};
  playersDetailed.forEach(p => {
    if (p.number !== undefined && p.number !== null && p.number !== "") {
      numbers[p.name] = String(p.number);
    }
  });
  const players = playersDetailed.filter(p => !p.out).map(p => p.name);
  const captains = playersDetailed.filter(p => p.isCaptain && !p.out).map(p => p.name).slice(0, 1);
  return {
    version: 3,
    name,
    staff,
    playersDetailed,
    players,
    liberos,
    numbers,
    captains
  };
}
function saveTeamManagerPayload(options = {}) {
  const {
    closeModal = true,
    openLineupAfter = false,
    saveToStorage = true,
    showAlert = true,
    preserveCourt = false
  } = options;
  const payload = collectTeamManagerPayload();
  if (!payload || !payload.name) {
    alert("Inserisci un nome squadra valido.");
    return;
  }
  const isOpponent = teamManagerScope === "opponent";
  if (saveToStorage) {
    if (isOpponent) {
      const compact = compactTeamPayload(payload, payload.name);
      saveOpponentTeamToStorage(payload.name, compact);
      syncOpponentTeamsFromStorage();
      state.selectedOpponentTeam = payload.name;
      renderOpponentTeamsSelect();
      if (!state.match.opponent) {
        state.match.opponent = payload.name;
        applyMatchInfoToUI();
      }
    } else {
      const compact = compactTeamPayload(payload, payload.name);
      saveTeamToStorage(payload.name, compact);
      syncTeamsFromStorage();
      state.selectedTeam = payload.name;
      renderTeamsSelect();
    }
  } else {
    if (isOpponent) {
      state.selectedOpponentTeam = payload.name;
    } else {
      state.selectedTeam = payload.name;
    }
  }
  const roster = extractRosterFromTeam(payload);
  if (isOpponent) {
    updateOpponentPlayersList(roster.players, {
      liberos: roster.liberos,
      playerNumbers: roster.numbers,
      captains: roster.captains
    });
  } else {
    updatePlayersList(roster.players, {
      askReset: !preserveCourt,
      liberos: roster.liberos,
      playerNumbers: roster.numbers,
      captains: roster.captains,
      setDefaultLineup: !preserveCourt,
      defaultLineupNames:
        roster.playersDetailed && roster.playersDetailed.length > 0
          ? roster.playersDetailed.filter(p => !p.out).map(p => p.name)
          : roster.players
    });
  }
  saveState();
  if (closeModal) closeTeamManagerModal();
  if (showAlert) alert((isOpponent ? "Avversaria salvata: " : "Squadra salvata: ") + payload.name);
}
function toggleMetricAssignment(skillId, category, code) {
  ensureMetricsConfigDefaults();
  ensurePointRulesDefaults();
  const cfg = normalizeMetricConfig(skillId, state.metricsConfig[skillId]);
  const posSet = new Set(cfg.positive);
  const negSet = new Set(cfg.negative);
  if (category === "positive") {
    if (posSet.has(code)) {
      posSet.delete(code);
    } else {
      posSet.add(code);
      negSet.delete(code);
    }
  } else if (category === "negative") {
    if (negSet.has(code)) {
      negSet.delete(code);
    } else {
      negSet.add(code);
      posSet.delete(code);
    }
  } else {
    posSet.delete(code);
    negSet.delete(code);
  }
  state.metricsConfig[skillId] = normalizeMetricConfig(skillId, {
    positive: Array.from(posSet),
    negative: Array.from(negSet),
    activeCodes: cfg.activeCodes,
    enabled: cfg.enabled
  });
  saveState();
  renderMetricsConfig();
  recalcAllStatsAndUpdateUI();
  renderPlayers();
}
function togglePointRule(skillId, category, code) {
  ensurePointRulesDefaults();
  const cfg = normalizePointRule(skillId, state.pointRules[skillId]);
  const forSet = new Set(cfg.for);
  const againstSet = new Set(cfg.against);
  if (category === "for") {
    if (forSet.has(code)) {
      forSet.delete(code);
    } else {
      forSet.add(code);
      againstSet.delete(code);
    }
  } else if (category === "against") {
    if (againstSet.has(code)) {
      againstSet.delete(code);
    } else {
      againstSet.add(code);
      forSet.delete(code);
    }
  } else {
    forSet.delete(code);
    againstSet.delete(code);
  }
  state.pointRules[skillId] = normalizePointRule(skillId, {
    for: Array.from(forSet),
    against: Array.from(againstSet)
  });
  saveState();
  renderMetricsConfig();
  recalcAllStatsAndUpdateUI();
  renderPlayers();
}
function toggleActiveCode(skillId, code) {
  ensureMetricsConfigDefaults();
  ensurePointRulesDefaults();
  const cfg = normalizeMetricConfig(skillId, state.metricsConfig[skillId]);
  const activeSet = new Set(cfg.activeCodes);
  if (activeSet.has(code)) {
    activeSet.delete(code);
  } else {
    activeSet.add(code);
  }
  state.metricsConfig[skillId] = normalizeMetricConfig(skillId, {
    positive: cfg.positive,
    negative: cfg.negative,
    activeCodes: Array.from(activeSet),
    enabled: cfg.enabled
  });
  saveState();
  renderMetricsConfig();
  recalcAllStatsAndUpdateUI();
  renderPlayers();
}
function toggleSkillEnabled(skillId) {
  ensureMetricsConfigDefaults();
  ensurePointRulesDefaults();
  const cfg = normalizeMetricConfig(skillId, state.metricsConfig[skillId]);
  state.metricsConfig[skillId] = normalizeMetricConfig(skillId, {
    positive: cfg.positive,
    negative: cfg.negative,
    activeCodes: cfg.activeCodes,
    enabled: !cfg.enabled
  });
  saveState();
  renderMetricsConfig();
  renderPlayers();
}
function resetMetricsToDefault() {
  const ok = confirm(
    "Ripristinare solo i criteri (positivo/negativo) ai valori di default? Le valutazioni restano invariate."
  );
  if (!ok) return;
  ensureMetricsConfigDefaults();
  ensurePointRulesDefaults();
  SKILLS.forEach(skill => {
    const current = normalizeMetricConfig(skill.id, state.metricsConfig[skill.id]);
    const defaults = normalizeMetricConfig(skill.id, METRIC_DEFAULTS[skill.id]);
    state.metricsConfig[skill.id] = normalizeMetricConfig(skill.id, {
      positive: defaults.positive,
      negative: defaults.negative,
      activeCodes: current.activeCodes,
      enabled: current.enabled
    });
  });
  saveState();
  renderMetricsConfig();
  recalcAllStatsAndUpdateUI();
  renderPlayers();
}
function resetAllActiveCodes() {
  const ok = confirm("Riattivare tutte le valutazioni (codici abilitati) per ogni fondamentale?");
  if (!ok) return;
  ensureMetricsConfigDefaults();
  ensurePointRulesDefaults();
  SKILLS.forEach(skill => {
    const current = normalizeMetricConfig(skill.id, state.metricsConfig[skill.id]);
    state.metricsConfig[skill.id] = normalizeMetricConfig(skill.id, {
      positive: current.positive,
      negative: current.negative,
      activeCodes: [...RESULT_CODES],
      enabled: current.enabled
    });
  });
  saveState();
  renderMetricsConfig();
  recalcAllStatsAndUpdateUI();
  renderPlayers();
}
function resetPointRulesToDefault() {
  const ok = confirm("Ripristinare le regole punti ai valori di default?");
  if (!ok) return;
  ensurePointRulesDefaults();
  SKILLS.forEach(skill => {
    state.pointRules[skill.id] = normalizePointRule(skill.id, POINT_RULE_DEFAULTS[skill.id]);
  });
  saveState();
  renderMetricsConfig();
  recalcAllStatsAndUpdateUI();
  renderPlayers();
}
function renderMetricsConfig() {
  if (!elMetricsConfig) return;
  ensureMetricsConfigDefaults();
  ensurePointRulesDefaults();
  elMetricsConfig.innerHTML = "";
  SKILLS.forEach(skill => {
    const block = document.createElement("div");
    const enabled = state.metricsConfig[skill.id].enabled;
    block.className = "metric-block skill-" + skill.id + (enabled ? "" : " disabled");
    const title = document.createElement("div");
    title.className = "metric-title";
    title.textContent = skill.label;
    block.appendChild(title);
    const helper = document.createElement("div");
    helper.className = "metric-helper";
    helper.textContent = "";
    block.appendChild(helper);
  const colsWrap = document.createElement("div");
  colsWrap.className = "metric-cols";
  const colLeft = document.createElement("div");
  colLeft.className = "metric-col";
  const colRight = document.createElement("div");
  colRight.className = "metric-col";
  const colPoints = document.createElement("div");
  colPoints.className = "metric-col metrics-points";
  const buildMetricToggle = (tone, active, code, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button";
    let cls = "metric-toggle";
    if (tone) cls += " code-" + tone;
    if (active) cls += " active";
    btn.className = cls;
    btn.textContent = code;
    if (typeof onClick === "function") {
      btn.addEventListener("click", onClick);
    }
    return btn;
  };
  const makeRow = rowMeta => {
    const row = document.createElement("div");
    row.className = "metric-row";
    const label = document.createElement("span");
    label.className = "metric-label";
      label.textContent = rowMeta.label;
      row.appendChild(label);
      if (rowMeta.type === "toggle") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "metric-toggle toggle-skill " +
          (enabled ? "toggle-on" : "toggle-off");
        btn.textContent = enabled ? "ON" : "OFF";
        btn.addEventListener("click", () => toggleSkillEnabled(skill.id));
        row.appendChild(btn);
      } else {
        SETTINGS_RESULT_CODES.forEach(code => {
          const active =
            rowMeta.key === "activeCodes"
              ? state.metricsConfig[skill.id].activeCodes.includes(code)
              : state.metricsConfig[skill.id][rowMeta.key].includes(code);
          const tone = getCodeTone(skill.id, code);
          const handler =
            rowMeta.key === "activeCodes"
              ? () => toggleActiveCode(skill.id, code)
              : () => toggleMetricAssignment(skill.id, rowMeta.key, code);
          row.appendChild(buildMetricToggle(tone, active, code, handler));
        });
      }
      return row;
    };
    [ { key: "enabled", label: "Scout attivo?", type: "toggle" },
      { key: "activeCodes", label: "Codici abilitati", type: "active" } ].forEach(meta => {
      colLeft.appendChild(makeRow(meta));
    });
    [ { key: "positive", label: "Positivo" },
      { key: "neutral", label: "Neutro" },
      { key: "negative", label: "Negativo" } ].forEach(meta => {
      colRight.appendChild(makeRow(meta));
    });
    const pointCfg = normalizePointRule(skill.id, state.pointRules[skill.id]);
    const pointRow = meta => {
      const row = document.createElement("div");
      row.className = "metric-row";
      const label = document.createElement("span");
      label.className = "metric-label";
      label.textContent = meta.label;
      row.appendChild(label);
      SETTINGS_RESULT_CODES.forEach(code => {
        const active =
          meta.key === "for"
            ? pointCfg.for.includes(code)
            : meta.key === "against"
              ? pointCfg.against.includes(code)
              : !pointCfg.for.includes(code) && !pointCfg.against.includes(code);
        const tone = meta.key === "for" ? "positive" : meta.key === "against" ? "negative" : "neutral";
        const handler = () => togglePointRule(skill.id, meta.key, code);
        row.appendChild(buildMetricToggle(tone, active, code, handler));
      });
      return row;
    };
    [ { key: "for", label: "Punto" },
      { key: "against", label: "Punto subito" },
      { key: "neutral", label: "Neutro (no punto)" } ].forEach(meta => {
      colPoints.appendChild(pointRow(meta));
    });
    colsWrap.appendChild(colLeft);
    colsWrap.appendChild(colRight);
    colsWrap.appendChild(colPoints);
    block.appendChild(colsWrap);
    elMetricsConfig.appendChild(block);
  });
  try {
    syncSkillFlowButtons();
  } catch (e) {
    if (typeof console !== "undefined" && console.error) {
      console.error("Skill flow buttons sync failed", e);
    }
  }
}
function updatePlayersList(newPlayers, options = {}) {
  const {
    askReset = true,
    liberos = null,
    playerNumbers = null,
    captains = null,
    setDefaultLineup = false,
    defaultLineupNames = null,
    preserveCourt = false
  } = options;
  const normalized = normalizePlayers(newPlayers);
  const providedNumbers = playerNumbers && typeof playerNumbers === "object" ? playerNumbers : null;
  const providedLiberos = Array.isArray(liberos) ? liberos : null;
  const candidateCaptains = Array.isArray(captains) ? captains : state.captains || [];
  const normalizedCaptains = normalizePlayers(candidateCaptains).filter(name => normalized.includes(name));
  const chosenCaptain = normalizedCaptains[0] || "";
  const nextCaptains = chosenCaptain ? [chosenCaptain] : [];
  const changed = playersChanged(normalized);
  const nextNumbers = buildNumbersForNames(normalized, providedNumbers || state.playerNumbers || {});
  const nextLiberos = (providedLiberos || state.liberos || []).filter(name => normalized.includes(name));
  const lineupNames =
    Array.isArray(defaultLineupNames) && defaultLineupNames.length > 0
      ? normalizePlayers(defaultLineupNames).filter(name => normalized.includes(name))
      : normalized;

  if (!changed) {
    state.playerNumbers = nextNumbers;
    state.liberos = nextLiberos;
    state.captains = nextCaptains;
    if (setDefaultLineup) {
      applyDefaultLineup(lineupNames);
    }
    saveState();
    applyPlayersFromStateToTextarea();
    renderPlayersManagerList();
  } else {
    if (state.events.length > 0 && askReset) {
      const ok = confirm(
        "Cambiare l'elenco di giocatrici azzererà tutte le statistiche del match. Procedere?"
      );
      if (!ok) return;
    }
    if (typeof resetSetTypeState === "function") {
      resetSetTypeState();
    }
    state.players = normalized;
    state.playerNumbers = nextNumbers;
    if (!preserveCourt) {
      state.events = [];
      ensureCourtShape();
      state.court = Array.from({ length: 6 }, () => ({ main: "" }));
      state.rotation = 1;
    } else {
      ensureCourtShape();
      cleanCourtPlayers();
    }
    state.liberos = nextLiberos;
    state.captains = nextCaptains;
    if (setDefaultLineup) {
      applyDefaultLineup(lineupNames);
    }
    state.autoRoleBaseCourt = null;
    autoRoleBaseCourt = null;
    resetAutoRoleCache();
    ensureMetricsConfigDefaults();
    state.savedTeams = state.savedTeams || {};
    initStats();
    saveState();
    applyPlayersFromStateToTextarea();
    renderPlayersManagerList();
  }

  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  renderLiberoTags();
  renderMetricsConfig();
  renderTeamsSelect();
  updateRotationDisplay();
  renderEventsLog();
  renderAggregatedTable();
}
function addPlayerFromInput() {
  if (!elNewPlayerInput) return;
  const rawName = elNewPlayerInput.value.trim();
  const normalizedName = normalizePlayers([rawName])[0];
  if (!normalizedName) {
    alert("Inserisci un nome per aggiungere una giocatrice.");
    return;
  }
  const exists = (state.players || []).some(
    p => p.toLowerCase() === normalizedName.toLowerCase()
  );
  if (exists) {
    alert("Questa giocatrice è già presente nella lista.");
    return;
  }
  updatePlayersList([...(state.players || []), normalizedName], {
    askReset: true
  });
  elNewPlayerInput.value = "";
  elNewPlayerInput.focus();
}
function removePlayerAtIndex(idx) {
  if (!state.players || !state.players[idx]) return;
  const newList = state.players.filter((_, i) => i !== idx);
  updatePlayersList(newList, { askReset: true });
}
function handleBenchDragStart(e) {
  const target = e.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  const name = target.dataset.playerName;
  if (!name || !e.dataTransfer) return;
  if (!isLibero(name)) return;
  draggedPlayerName = name;
  draggedFromPos = null;
  dragSourceType = "bench";
  e.dataTransfer.setData("text/plain", name);
  e.dataTransfer.effectAllowed = "move";
  if (activeDropChip) {
    activeDropChip.classList.remove("drop-over");
    activeDropChip = null;
  }
}
function handleBenchDragEnd() {
  resetDragState();
}
function handleLiberoReplacedDragStart(e, name) {
  if (!name || !e.dataTransfer) return;
  draggedPlayerName = name;
  draggedFromPos = null;
  dragSourceType = "libero-return";
  e.dataTransfer.setData("text/plain", name);
  e.dataTransfer.effectAllowed = "move";
  if (activeDropChip) {
    activeDropChip.classList.remove("drop-over");
    activeDropChip = null;
  }
}
function handleBenchDropZoneOver(e) {
  if (dragSourceType !== "court" || draggedFromPos === null) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  if (elBenchChips) elBenchChips.classList.add("bench-drop-over");
}
function handleBenchDropZoneLeave() {
  if (elBenchChips) elBenchChips.classList.remove("bench-drop-over");
}
function handleBenchDropZoneDrop(e) {
  e.preventDefault();
  if (dragSourceType === "court" && draggedFromPos !== null) {
    clearCourtAssignment(draggedFromPos, "main");
  }
  handleBenchDropZoneLeave();
  resetDragState();
}
function ensureBenchTouchListeners() {
  if (benchTouchListenersAttached) return;
  document.addEventListener("touchmove", handleBenchTouchMove, { passive: false });
  document.addEventListener("touchend", handleBenchTouchEnd, { passive: false });
  document.addEventListener("touchcancel", handleBenchTouchCancel, { passive: false });
  document.addEventListener("pointermove", handleBenchPointerMove, { passive: false });
  document.addEventListener("pointerup", handleBenchPointerUp, { passive: false });
  document.addEventListener("pointercancel", handleBenchPointerCancel, { passive: false });
  benchTouchListenersAttached = true;
}
function createBenchTouchGhost(text, x, y) {
  if (touchBenchGhost && touchBenchGhost.parentNode) {
    touchBenchGhost.parentNode.removeChild(touchBenchGhost);
  }
  const ghost = document.createElement("div");
  ghost.className = "touch-drag-ghost";
  ghost.textContent = text;
  ghost.style.left = x + "px";
  ghost.style.top = y + "px";
  document.body.appendChild(ghost);
  touchBenchGhost = ghost;
}
function moveBenchTouchGhost(x, y) {
  if (!touchBenchGhost) return;
  touchBenchGhost.style.left = x + "px";
  touchBenchGhost.style.top = y + "px";
}
function clearBenchTouch() {
  const prev = document.querySelector(".court-card.drop-over");
  if (prev) prev.classList.remove("drop-over");
  if (touchBenchGhost && touchBenchGhost.parentNode) {
    touchBenchGhost.parentNode.removeChild(touchBenchGhost);
  }
  touchBenchGhost = null;
  touchBenchName = "";
  touchBenchOverPos = -1;
  touchBenchPointerId = null;
  document.body.style.overflow = "";
}
function updateBenchTouchOver(x, y) {
  const elAt = document.elementFromPoint(x, y);
  const card = elAt && elAt.closest(".court-card");
  const prev = document.querySelector(".court-card.drop-over");
  if (prev) prev.classList.remove("drop-over");
  if (!card || !card.dataset.posIndex) {
    touchBenchOverPos = -1;
    return;
  }
  const posIdx = parseInt(card.dataset.posIndex, 10);
  if (isNaN(posIdx) || !canPlaceInSlot(touchBenchName, posIdx, false)) {
    touchBenchOverPos = -1;
    return;
  }
  touchBenchOverPos = posIdx;
  card.classList.add("drop-over");
}
function handleBenchTouchStart(e, name) {
  const t = e.touches && e.touches[0];
  if (!t) return;
  ensureBenchTouchListeners();
  touchBenchName = name;
  touchBenchStart = { x: t.clientX, y: t.clientY };
  createBenchTouchGhost(formatNameWithNumber(name), t.clientX, t.clientY);
  updateBenchTouchOver(t.clientX, t.clientY);
  document.body.style.overflow = "hidden";
  e.stopPropagation();
  e.preventDefault();
}
function handleBenchTouchMove(e) {
  if (!touchBenchName) return;
  const t = e.touches && e.touches[0];
  if (!t) return;
  moveBenchTouchGhost(t.clientX, t.clientY);
  updateBenchTouchOver(t.clientX, t.clientY);
  e.stopPropagation();
  e.preventDefault();
}
function handleBenchTouchEnd(e) {
  if (!touchBenchName) return;
  const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  const endX = t ? t.clientX : touchBenchStart.x;
  const endY = t ? t.clientY : touchBenchStart.y;
  const dist = Math.hypot(endX - touchBenchStart.x, endY - touchBenchStart.y);
  if (dist < 8) {
    handleBenchClick(touchBenchName);
    clearBenchTouch();
    return;
  }
  if (touchBenchOverPos >= 0 && canPlaceInSlot(touchBenchName, touchBenchOverPos, true)) {
    setCourtPlayer(touchBenchOverPos, "main", touchBenchName);
  }
  e.stopPropagation();
  clearBenchTouch();
}
function handleBenchTouchCancel() {
  clearBenchTouch();
}
function handleBenchPointerDown(e, name) {
  if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
  ensureBenchTouchListeners();
  touchBenchPointerId = e.pointerId;
  touchBenchName = name;
  touchBenchStart = { x: e.clientX, y: e.clientY };
  createBenchTouchGhost(formatNameWithNumber(name), e.clientX, e.clientY);
  updateBenchTouchOver(e.clientX, e.clientY);
  document.body.style.overflow = "hidden";
  if (e.target && typeof e.target.setPointerCapture === "function") {
    e.target.setPointerCapture(e.pointerId);
  }
  e.stopPropagation();
  e.preventDefault();
}
function handleBenchPointerMove(e) {
  if (touchBenchPointerId === null || e.pointerId !== touchBenchPointerId) return;
  if (!touchBenchName) return;
  moveBenchTouchGhost(e.clientX, e.clientY);
  updateBenchTouchOver(e.clientX, e.clientY);
  e.stopPropagation();
  e.preventDefault();
}
function handleBenchPointerUp(e) {
  if (touchBenchPointerId === null || e.pointerId !== touchBenchPointerId) return;
  if (e.target && typeof e.target.releasePointerCapture === "function") {
    e.target.releasePointerCapture(e.pointerId);
  }
  handleBenchPointerDrop(e);
}
function handleBenchPointerCancel(e) {
  if (touchBenchPointerId === null || e.pointerId !== touchBenchPointerId) return;
  if (e.target && typeof e.target.releasePointerCapture === "function") {
    e.target.releasePointerCapture(e.pointerId);
  }
  clearBenchTouch();
  touchBenchPointerId = null;
}
function handleBenchPointerDrop(e) {
  if (!touchBenchName) {
    clearBenchTouch();
    touchBenchPointerId = null;
    return;
  }
  const dist = Math.hypot(e.clientX - touchBenchStart.x, e.clientY - touchBenchStart.y);
  if (dist < 8) {
    handleBenchClick(touchBenchName);
  } else if (
    touchBenchOverPos >= 0 &&
    canPlaceInSlot(touchBenchName, touchBenchOverPos, true)
  ) {
    setCourtPlayer(touchBenchOverPos, "main", touchBenchName);
  }
  e.stopPropagation();
  e.preventDefault();
  clearBenchTouch();
  touchBenchPointerId = null;
}
function handleCourtDragStart(e, posIdx) {
  const slot = state.court[posIdx] || { main: "" };
  if (!slot.main || !e.dataTransfer) return;
  draggedPlayerName = slot.main;
  draggedFromPos = posIdx;
  dragSourceType = "court";
  e.dataTransfer.setData("text/plain", slot.main);
  e.dataTransfer.effectAllowed = "move";
  if (activeDropChip) {
    activeDropChip.classList.remove("drop-over");
    activeDropChip = null;
  }
}
function handleCourtDragEnd() {
  resetDragState();
}
function handlePositionDragOver(e, card) {
  const name =
    (e.dataTransfer && e.dataTransfer.getData("text/plain")) || draggedPlayerName;
  if (!name) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  if (activeDropChip && activeDropChip !== card) {
    activeDropChip.classList.remove("drop-over");
  }
  activeDropChip = card;
  card.classList.add("drop-over");
}
function handlePositionDragLeave(card) {
  card.classList.remove("drop-over");
  if (activeDropChip === card) {
    activeDropChip = null;
  }
}
function handlePositionDrop(e, card) {
  e.preventDefault();
  const name =
    (e.dataTransfer && e.dataTransfer.getData("text/plain")) || draggedPlayerName;
  const posIdx = parseInt(card.dataset.posIndex, 10);
  const target = card.dataset.dropTarget || "main";
  card.classList.remove("drop-over");
  if (!name || isNaN(posIdx)) {
    resetDragState();
    return;
  }
  const targetSlot = state.court[posIdx] || { main: "", replaced: "" };
  if (isLibero(targetSlot.main) && targetSlot.replaced === name) {
    setCourtPlayer(posIdx, target, name);
    resetDragState();
    return;
  }
  if (dragSourceType === "court" && draggedFromPos !== null) {
    if (!isLibero(name)) {
      resetDragState();
      return;
    }
    if (draggedFromPos === posIdx) {
      resetDragState();
      return;
    }
    if (!canPlaceInSlot(name, posIdx, true)) {
      resetDragState();
      return;
    }
    const baseCourt = ensureCourtShapeFor(state.court);
    const originSlot = baseCourt[draggedFromPos] || { main: "", replaced: "" };
    if (originSlot.main === name) {
      baseCourt[draggedFromPos] = originSlot.replaced
        ? { main: originSlot.replaced, replaced: "" }
        : { main: "", replaced: "" };
    }
    let nextCourt = null;
    if (lineupCore && typeof lineupCore.setPlayerOnCourt === "function") {
      nextCourt = lineupCore.setPlayerOnCourt({
        court: baseCourt,
        posIdx,
        playerName: name,
        liberos: state.liberos || []
      });
    } else {
      const reserved = reserveNamesInCourt(name, baseCourt);
      const slot = reserved[posIdx] || { main: "", replaced: "" };
      const prevMain = slot.main;
      const updated = Object.assign({}, slot, { main: name });
      const prevWasLibero = isLibero(prevMain);
      updated.replaced = prevWasLibero ? slot.replaced || "" : prevMain || slot.replaced || "";
      releaseReplaced(name, posIdx, reserved);
      reserved[posIdx] = updated;
      nextCourt = reserved;
    }
    commitCourtChange(nextCourt);
    resetDragState();
    return;
  }
  if (dragSourceType === "libero-return") {
    setCourtPlayer(posIdx, target, name);
    resetDragState();
    return;
  }
  if (!isLibero(name)) {
    resetDragState();
    return;
  }
  setCourtPlayer(posIdx, target, name);
  resetDragState();
}
function handleBenchClick(name) {
  if (!isLibero(name)) return;
  ensureCourtShape();
  const lockedMap = getLockedMap();
  const targetPos =
    lockedMap[name] !== undefined
      ? lockedMap[name]
      : state.court.findIndex(slot => !slot.main);
  if (targetPos === -1 || targetPos === undefined) {
    alert("Trascina la riserva sulla posizione da sostituire.");
    return;
  }
  setCourtPlayer(targetPos, "main", name);
}
function getUsedNames() {
  ensureCourtShape();
  const used = new Set();
  state.court.forEach(slot => {
    if (slot.main) used.add(slot.main);
  });
  return used;
}
function getBenchPlayers() {
  const used = getUsedNames();
  const libSet = new Set(state.liberos || []);
  const replaced = new Set(getReplacedByLiberos());
  return (state.players || []).filter(name => {
    if (used.has(name)) return false; // già in campo
    if (libSet.has(name)) return false; // i liberi stanno nella colonna dedicata
    // se è la titolare sostituita dal libero, deve comparire
    if (replaced.has(name)) return true;
    return true;
  });
}
function getBenchLiberos() {
  const used = getUsedNames();
  const libSet = new Set(state.liberos || []);
  const replaced = new Set(getReplacedByLiberos());
  const names = [];
  (state.players || []).forEach(name => {
    if (libSet.has(name) && (!used.has(name) || replaced.has(name))) {
      names.push(name);
    }
  });
  replaced.forEach(name => {
    if (!used.has(name)) names.push(name);
  });
  return Array.from(new Set(names));
}
function getReplacedByLiberos() {
  ensureCourtShape();
  const list = [];
  state.court.forEach(slot => {
    if (slot.main && (state.liberos || []).includes(slot.main) && slot.replaced) {
      list.push(slot.replaced);
    }
  });
  return list;
}
function cleanLiberos() {
  const valid = new Set(state.players || []);
  state.liberos = (state.liberos || []).filter(n => valid.has(n));
  cleanLiberoAutoMap();
}
function cleanLiberoAutoMap() {
  const validPlayers = new Set(state.players || []);
  const libSet = new Set(state.liberos || []);
  const map = state.liberoAutoMap || {};
  const cleaned = {};
  Object.entries(map).forEach(([replaced, libero]) => {
    if (validPlayers.has(replaced) && libSet.has(libero)) {
      cleaned[replaced] = libero;
    }
  });
  state.liberoAutoMap = cleaned;
}
function toggleLibero(name) {
  if (!name) return;
  const set = new Set(state.liberos || []);
  if (set.has(name)) {
    set.delete(name);
  } else {
    set.add(name);
  }
  state.liberos = Array.from(set);
  saveState();
  renderBenchChips();
  renderLiberoTags();
  renderLiberoChipsInline();
  renderPlayers();
}
function getLockedMap() {
  const map = {};
  state.court.forEach((slot, idx) => {
    if (slot.replaced) {
      map[slot.replaced] = idx;
    }
  });
  return map;
}
function releaseReplaced(name, keepIdx, court = state.court) {
  if (lineupCore && typeof lineupCore.releaseReplacedFromCourt === "function") {
    const updated = lineupCore.releaseReplacedFromCourt(court, name, keepIdx);
    if (court === state.court) {
      state.court = updated;
    } else {
      updated.forEach((slot, idx) => (court[idx] = slot));
    }
    return;
  }
  const shaped = ensureCourtShapeFor(court);
  const updated = shaped.map((slot, idx) => {
    if (idx === keepIdx) return slot;
    if (slot.replaced === name) {
      return Object.assign({}, slot, { replaced: "" });
    }
    return slot;
  });
  if (court === state.court) {
    state.court = updated;
  } else {
    updated.forEach((slot, idx) => (court[idx] = slot));
  }
}
function renderBenchChips() {
  ensureBenchDropZone();
  if (!elBenchChips) return;
  elBenchChips.innerHTML = "";
  const bench = getBenchPlayers();
  const lockedMap = getLockedMap();
  renderChipList(elBenchChips, bench, lockedMap, {
    highlightLibero: true,
    isLiberoColumn: false,
    emptyText: "Nessuna riserva disponibile.",
    replacedSet: new Set(getReplacedByLiberos())
  });
}
function ensureBenchDropZone() {
  if (!elBenchChips || benchDropZoneInitialized) return;
  elBenchChips.addEventListener("dragenter", handleBenchDropZoneOver, true);
  elBenchChips.addEventListener("dragover", handleBenchDropZoneOver, true);
  elBenchChips.addEventListener("dragleave", handleBenchDropZoneLeave, true);
  elBenchChips.addEventListener("drop", handleBenchDropZoneDrop, true);
  benchDropZoneInitialized = true;
}
function renderLiberoChipsInline() {
  if (!elLiberoTagsInline) return;
  elLiberoTagsInline.innerHTML = "";
  const liberos = getBenchLiberos();
  const lockedMap = getLockedMap();
  renderChipList(elLiberoTagsInline, liberos, lockedMap, {
    isLiberoColumn: true,
    emptyText: "Nessun libero disponibile.",
    replacedSet: new Set(getReplacedByLiberos())
  });
}
function renderLineupChips() {
  if (!elLineupChips) return;
  elLineupChips.innerHTML = "";
  ensureCourtShape();
  const renderOrder = [3, 2, 1, 4, 5, 0];
  renderOrder.forEach(idx => {
    const meta = POSITIONS_META[idx];
    const slot = state.court[idx] || { main: "" };
    const chip = document.createElement("div");
    chip.className = "lineup-chip";
    const roleSpan = document.createElement("span");
    roleSpan.className = "chip-role";
    roleSpan.textContent = "Pos " + (idx + 1) + " · " + getRoleLabel(idx + 1);
    const nameSpan = document.createElement("span");
    nameSpan.className = "chip-name";
    const active = slot.main;
    nameSpan.textContent = active ? formatNameWithNumber(active) : "—";
    if (!active) chip.classList.add("chip-empty");
    chip.appendChild(roleSpan);
    chip.appendChild(nameSpan);
    elLineupChips.appendChild(chip);
  });
}
function updateRotationDisplay() {
  const rotationLabel = rot => "P" + String(parseInt(rot, 10) || 1);
  if (elRotationIndicator) {
    elRotationIndicator.textContent = rotationLabel(state.rotation || 1);
  }
  if (elRotationSelect) {
    elRotationSelect.value = String(state.rotation || 1);
  }
  syncAutoRotateToggle();
  syncAutoRoleToggle();
  syncAutoRoleP1AmericanToggle();
  syncPredictiveSkillToggle();
  if (typeof syncAttackTrajectoryToggle === "function") {
    syncAttackTrajectoryToggle();
  }
}
function getRoleLabel(index) {
  const offset = (state.rotation || 1) - 1; // numero rotazioni effettuate
  const roles = BASE_ROLES;
  const idx0 = ((index - 1) % 6 + 6) % 6; // 0-based
  return roles[(idx0 - offset + 6) % 6] || roles[idx0] || "";
}
function syncAutoRotateToggle() {
  if (elAutoRotateToggle) {
    elAutoRotateToggle.checked = !!state.autoRotate;
  }
}
function setAutoRotateEnabled(enabled) {
  state.autoRotate = !!enabled;
  if (!state.autoRotate) {
    state.autoRotatePending = false;
  }
  saveState();
  syncAutoRotateToggle();
}
function syncAutoRoleToggle() {
  if (elAutoRoleToggle) {
    elAutoRoleToggle.checked = !!state.autoRolePositioning;
  }
}
function syncPredictiveSkillToggle() {
  if (elPredictiveSkillToggle) {
    elPredictiveSkillToggle.checked = !!state.predictiveSkillFlow;
  }
}
function syncAttackTrajectoryToggle() {
  if (elAttackTrajectoryToggle) {
    elAttackTrajectoryToggle.checked = !!state.attackTrajectoryEnabled;
  }
}
function syncSkillFlowButtons() {
  if (!elSkillFlowButtons) return;
  if (typeof normalizeMetricConfig !== "function") return;
  ensureMetricsConfigDefaults();
  Array.from(elSkillFlowButtons.querySelectorAll("[data-force-skill]")).forEach(btn => {
    const skillId = btn.dataset.forceSkill;
    if (!skillId) return;
    const cfg =
      (state.metricsConfig && normalizeMetricConfig(skillId, state.metricsConfig[skillId])) || null;
    const enabled = cfg ? cfg.enabled !== false : true;
    btn.style.display = enabled ? "" : "none";
  });
}
function forceNextSkill(skillId) {
  if (!skillId) return;
  state.predictiveSkillFlow = true;
  state.skillFlowOverride = skillId;
  syncPredictiveSkillToggle();
  saveState();
  renderPlayers();
  if (typeof updateNextSkillIndicator === "function") {
    updateNextSkillIndicator(skillId);
  }
}
function syncAutoRoleP1AmericanToggle() {
  if (elAutoRoleP1AmericanToggle) {
    elAutoRoleP1AmericanToggle.checked = !!state.autoRoleP1American;
  }
}
function setCurrentSet(value, options = {}) {
  const setNum = Math.min(5, Math.max(1, parseInt(value, 10) || 1));
  state.currentSet = setNum;
  syncCurrentSetUI(setNum);
  if (options.save !== false) {
    saveState();
  }
  renderLiveScore();
}
function setRotation(value) {
  const rot = Math.min(6, Math.max(1, parseInt(value, 10) || 1));
  state.rotation = rot;
  saveState();
  updateRotationDisplay();
  renderPlayers();
  renderLineupChips();
  if (state.autoRolePositioning && typeof applyAutoRolePositioning === "function") {
    applyAutoRolePositioning();
  }
}
function captureRects(selector, keyBuilder) {
  const map = new Map();
  document.querySelectorAll(selector).forEach(node => {
    if (!(node instanceof HTMLElement)) return;
    const key = keyBuilder(node);
    if (!key) return;
    map.set(key, node.getBoundingClientRect());
  });
  return map;
}
function animateFlip(prevRects, selector, keyBuilder) {
  if (!prevRects || prevRects.size === 0) return;
  const nodes = document.querySelectorAll(selector);
  nodes.forEach(node => {
    if (!(node instanceof HTMLElement)) return;
    const key = keyBuilder(node);
    if (!key || !prevRects.has(key)) return;
    const prev = prevRects.get(key);
    const next = node.getBoundingClientRect();
    const dx = prev.left - next.left;
    const dy = prev.top - next.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    node.style.transition = "none";
    node.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      node.style.transition = "transform 360ms ease, opacity 360ms ease";
      node.style.transform = "translate(0px, 0px)";
    });
  });
}
function applyAutoRolePositioning() {
  if (!state.autoRolePositioning) return;
  ensureCourtShape();
  enforceAutoLiberoForState({ skipServerOnServe: true });
  const phase = getCurrentPhase();
  const rot = state.rotation || 1;
  if (autoRolePhaseApplied === phase && autoRoleRotationApplied === rot) return;
  if (!autoRoleBaseCourt) {
    if (state.autoRoleBaseCourt && state.autoRoleBaseCourt.length === 6) {
      autoRoleBaseCourt = cloneCourtLineup(state.autoRoleBaseCourt);
    } else {
      updateAutoRoleBaseCourtCache(state.court);
    }
  }
  const baseLineup =
    autoRoleBaseCourt && autoRoleBaseCourt.length === 6
      ? cloneCourtLineup(autoRoleBaseCourt)
      : ensureCourtShapeFor(state.court);
  const permuted = applyPhasePermutation({
    lineup: baseLineup,
    rotation: rot,
    phase,
    isServing: state.isServing,
    liberos: state.liberos || [],
    autoRoleP1American: !!state.autoRoleP1American
  });
  autoRoleRenderedCourt = permuted; // overlay per la vista, non alteriamo il base
  autoRolePhaseApplied = phase;
  autoRoleRotationApplied = rot;
  saveState();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  updateRotationDisplay();
}
function rotateCourt(direction) {
  const prevCourtRects = captureRects(".court-card", el => {
    const name = el.dataset.playerName || "";
    const pos = el.dataset.posIndex || "";
    return name || "pos-" + pos;
  });
  const prevMiniRects = captureRects(".mini-slot", el => {
    const name = el.dataset.playerName || "";
    const pos = el.dataset.slotIndex || "";
    return name || "mini-" + pos;
  });
  ensureCourtShape();
  const court =
    state.autoRolePositioning && autoRoleBaseCourt
      ? ensureCourtShapeFor(autoRoleBaseCourt)
      : ensureCourtShapeFor(state.court);
  let rotated = [];
  if (direction === "cw") {
    rotated = [court[5], court[0], court[1], court[2], court[3], court[4]];
    state.rotation = ((state.rotation || 1) % 6) + 1;
  } else {
    rotated = [court[1], court[2], court[3], court[4], court[5], court[0]];
    state.rotation = state.rotation === 1 ? 6 : state.rotation - 1;
  }
  const rotatedClean = rotated.map(slot => Object.assign({}, slot));
  const rotatedBase = rotatedClean.map((slot, idx) => {
    if ((state.liberos || []).includes(slot.main) && FRONT_ROW_INDEXES.has(idx)) {
      return { main: slot.replaced || "" , replaced: "" };
    }
    return slot;
  });
  const withLibero = applyAutoLiberoSubstitutionToCourt(rotatedBase, { skipServerOnServe: true });
  // Aggiorna sempre il lineup base ruotato
  state.court = withLibero;
  if (state.autoRolePositioning) {
    updateAutoRoleBaseCourtCache(withLibero);
    resetAutoRoleCache();
    applyAutoRolePositioning();
  } else {
    state.court = withLibero;
    resetAutoRoleCache();
  }
  saveState();
  renderPlayers();
  renderLineupChips();
  renderBenchChips();
  updateRotationDisplay();
  animateFlip(prevCourtRects, ".court-card", el => {
    const name = el.dataset.playerName || "";
    const pos = el.dataset.posIndex || "";
    return name || "pos-" + pos;
  });
  animateFlip(prevMiniRects, ".mini-slot", el => {
    const name = el.dataset.playerName || "";
    const pos = el.dataset.slotIndex || "";
    return name || "mini-" + pos;
  });
}
function openSettingsModal() {
  if (!elSettingsModal) return;
  elSettingsModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  document.body.classList.add("modal-open");
}
function closeSettingsModal() {
  if (!elSettingsModal) return;
  elSettingsModal.classList.add("hidden");
  document.body.style.overflow = "";
  document.body.classList.remove("modal-open");
}
function resetDragState() {
  draggedPlayerName = "";
  draggedFromPos = null;
  dragSourceType = "";
  handleBenchDropZoneLeave();
  if (activeDropChip) {
    activeDropChip.classList.remove("drop-over");
    activeDropChip = null;
  }
}
