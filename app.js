const STORAGE_KEY = "volleyScoutV1";
const SKILLS = [
  { id: "serve", label: "Battuta", badgeClass: "badge-serve" },
  { id: "pass", label: "Ricezione", badgeClass: "badge-pass" },
  { id: "attack", label: "Attacco", badgeClass: "badge-attack" },
  { id: "defense", label: "Difesa", badgeClass: "badge-defense" },
  { id: "block", label: "Muro", badgeClass: "badge-block" },
  { id: "second", label: "Alzata", badgeClass: "badge-second" }
];
const RESULT_CODES = ["#", "+", "!", "-", "/", "="];
const RESULT_LABELS = {
  "#": "Punto / perfetto",
  "+": "Buono",
  "!": "Ripetizione positiva",
  "-": "Errore",
  "=": "Neutro",
  "/": "Altro"
};
const METRIC_DEFAULTS = {
  serve: { positive: ["#", "+", "!", "/"], negative: ["="], activeCodes: RESULT_CODES, enabled: true },
  pass: { positive: ["#", "+"], negative: ["/", "="], activeCodes: RESULT_CODES, enabled: true },
  defense: { positive: ["#", "+", "!"], negative: ["="], activeCodes: RESULT_CODES, enabled: true },
  attack: { positive: ["#"], negative: ["/", "="], activeCodes: RESULT_CODES, enabled: true },
  block: { positive: ["#", "+"], negative: ["/", "="], activeCodes: RESULT_CODES, enabled: true },
  second: { positive: ["#"], negative: ["/", "-", "="], activeCodes: RESULT_CODES, enabled: true }
};
const POINT_RULES = {
  made: {
    serve: new Set(["#"]),
    attack: new Set(["#"]),
    block: new Set(["#"]),
    manual: new Set(["for"])
  },
  conceded: {
    attack: new Set(["=", "/"]),
    serve: new Set(["="]),
    pass: new Set(["="]),
    defense: new Set(["="]),
    block: new Set(["/", "="]),
    second: new Set(["="]),
    manual: new Set(["against", "error"])
  }
};
const PERSISTENT_DB_NAME = "Data";
const TEAM_STORE_NAME = "Teams";
const TEAM_PREFIX = PERSISTENT_DB_NAME + "/" + TEAM_STORE_NAME + "/";
const POSITIONS_META = [
  { id: 1, label: "Posizione 1 · P" },
  { id: 2, label: "Posizione 2 · S1" },
  { id: 3, label: "Posizione 3 · C2" },
  { id: 4, label: "Posizione 4 · O" },
  { id: 5, label: "Posizione 5 · S2" },
  { id: 6, label: "Posizione 6 · C1" }
];
let state = {
  match: {
    opponent: "",
    category: "",
    date: "",
    notes: "",
    leg: "",
    matchType: ""
  },
  currentSet: 1,
  players: [],
  playerNumbers: {},
  events: [],
  stats: {},
  court: [{ main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }],
  rotation: 1,
  liberos: [],
  savedTeams: {},
  selectedTeam: "",
  metricsConfig: {}
};
function logError(context, err) {
  console.error(context, err);
}
const elOpponent = document.getElementById("match-opponent");
const elCategory = document.getElementById("match-category");
const elDate = document.getElementById("match-date");
const elNotes = document.getElementById("match-notes");
const elLeg = document.getElementById("match-leg");
const elMatchType = document.getElementById("match-type");
const elCurrentSet = document.getElementById("current-set");
const elPlayersInput = document.getElementById("players-input");
const elPlayersContainer = document.getElementById("players-container");
const elPlayersList = document.getElementById("players-list");
const elNewPlayerInput = document.getElementById("new-player-name");
const elBtnAddPlayer = document.getElementById("btn-add-player");
const elBtnClearPlayers = document.getElementById("btn-clear-players");
const elTeamsSelect = document.getElementById("saved-teams");
const elBtnSaveTeam = document.getElementById("btn-save-team");
const elBtnDeleteTeam = document.getElementById("btn-delete-team");
const elBtnRenameTeam = document.getElementById("btn-rename-team");
const elBtnExportTeam = document.getElementById("btn-export-team");
const elBtnImportTeam = document.getElementById("btn-import-team");
const elTeamFileInput = document.getElementById("team-file-input");
const elLineupChips = document.getElementById("lineup-chips");
const elBenchChips = document.getElementById("bench-chips");
const elRotationIndicator = document.getElementById("rotation-indicator");
const elRotationSelect = document.getElementById("rotation-select");
const elBtnRotateCw = document.getElementById("btn-rotate-cw");
const elBtnRotateCcw = document.getElementById("btn-rotate-ccw");
const elLiberoTags = document.getElementById("libero-tags");
const elLiberoTagsInline = document.getElementById("libero-tags-inline");
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
    chip.draggable = true;
    chip.dataset.playerName = name;
    const label = document.createElement("span");
    label.textContent =
      formatNameWithNumber(name) + (lockedMap[name] !== undefined ? " (sost. libero)" : "");
    chip.appendChild(label);
    chip.addEventListener("dragstart", handleBenchDragStart);
    chip.addEventListener("dragend", handleBenchDragEnd);
    chip.addEventListener("click", () => handleBenchClick(name));
    container.appendChild(chip);
  });
}
const elMetricsConfig = document.getElementById("metrics-config");
const elBtnResetMetrics = document.getElementById("btn-reset-metrics");
const elBtnResetCodes = document.getElementById("btn-reset-codes");
let activeDropChip = null;
let draggedPlayerName = "";
let draggedFromPos = null;
let dragSourceType = "";
const BASE_ROLES = ["P", "S1", "C2", "O", "S2", "C1"];
const FRONT_ROW_INDEXES = new Set([1, 2, 3]); // pos2, pos3, pos4
const elEventsLog = document.getElementById("events-log");
const elBtnApplyPlayers = document.getElementById("btn-apply-players");
const elBtnExportCsv = document.getElementById("btn-export-csv");
const elBtnResetMatch = document.getElementById("btn-reset-match");
const elBtnSaveInfo = document.getElementById("btn-save-info");
const elBtnUndo = document.getElementById("btn-undo");
const elAggTableBody = document.getElementById("agg-table-body");
const elRotationTableBody = document.getElementById("rotation-table-body");
const elLiveScore = document.getElementById("live-score");
const elAggScore = document.getElementById("agg-score");
const elAggSetCards = document.getElementById("agg-set-cards");
const elBtnScoreForPlus = document.getElementById("btn-score-for-plus");
const elBtnScoreForMinus = document.getElementById("btn-score-for-minus");
const elBtnScoreAgainstPlus = document.getElementById("btn-score-against-plus");
const elBtnScoreAgainstMinus = document.getElementById("btn-score-against-minus");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const SKILL_COLUMN_MAP = {
  serve: [1, 2, 3, 4],
  pass: [5, 6, 7, 8],
  attack: [9, 10, 11, 12],
  defense: [13, 14, 15, 16],
  block: [17, 18, 19, 20],
  second: [21, 22, 23]
};
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    state = Object.assign(state, parsed);
    state.playerNumbers = parsed.playerNumbers || state.playerNumbers || {};
    ensureCourtShape();
    cleanCourtPlayers();
    state.rotation = parsed.rotation || 1;
    state.liberos = Array.isArray(parsed.liberos) ? parsed.liberos : [];
    state.savedTeams = parsed.savedTeams || {};
    state.selectedTeam = parsed.selectedTeam || "";
    state.metricsConfig = parsed.metricsConfig || {};
    syncPlayerNumbers(state.players || []);
    cleanLiberos();
    ensureMetricsConfigDefaults();
    migrateTeamsToPersistent();
    syncTeamsFromStorage();
  } catch (e) {
    logError("Error loading state", e);
  }
  syncTeamsFromStorage();
}
function saveState() {
  try {
    syncTeamsFromStorage();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
function replacePlayerNameEverywhere(oldName, newName, idx) {
  ensureCourtShape();
  state.court = state.court.map(slot => {
    const updated = Object.assign({}, slot);
    if (updated.main === oldName) updated.main = newName;
    if (updated.replaced === oldName) updated.replaced = newName;
    return updated;
  });
  state.liberos = (state.liberos || []).map(n => (n === oldName ? newName : n));
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
function formatNameWithNumber(name) {
  const num = getPlayerNumber(name);
  return num ? num + " - " + name : name;
}
function buildNumbersForNames(names, provided = {}) {
  const valid = value => {
    const clean = (value || "").trim();
    return clean && /^[0-9]{1,3}$/.test(clean) ? clean : "";
  };
  const prev = state.playerNumbers || {};
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
  if (!Array.isArray(state.court) || state.court.length !== 6) {
    state.court = Array.from({ length: 6 }, () => ({ main: "", replaced: "" }));
  }
}
function cleanCourtPlayers() {
  ensureCourtShape();
  const valid = new Set(state.players || []);
  state.court = state.court.map(slot => {
    const main = valid.has(slot.main) ? slot.main : "";
    const replaced = slot.replaced && valid.has(slot.replaced) ? slot.replaced : "";
    return { main, replaced };
  });
  cleanLiberos();
  ensureMetricsConfigDefaults();
}
function isLibero(name) {
  if (!name) return false;
  return (state.liberos || []).includes(name);
}
function reserveNamesInCourt(name) {
  state.court = state.court.map(slot => {
    const cleaned = Object.assign({}, slot);
    if (cleaned.main === name) cleaned.main = "";
    if (cleaned.replaced === name) cleaned.replaced = "";
    return cleaned;
  });
}
function setCourtPlayer(posIdx, target, playerName) {
  ensureCourtShape();
  const name = (playerName || "").trim();
  if (!name) return;
  const lockedMap = getLockedMap();
  if (lockedMap[name] !== undefined && lockedMap[name] !== posIdx) {
    alert("Questa giocatrice può rientrare solo nella sua posizione (sostituita dal libero).");
    return;
  }
  if ((state.liberos || []).includes(name) && FRONT_ROW_INDEXES.has(posIdx)) {
    alert("Non puoi mettere il libero in prima linea.");
    return;
  }
  reserveNamesInCourt(name);
  const slot = state.court[posIdx] || { main: "", replaced: "" };
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
  } else {
    updated.replaced = "";
  }
  releaseReplaced(name, posIdx);
  state.court[posIdx] = updated;
  cleanCourtPlayers();
  saveState();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  updateRotationDisplay();
}
function swapCourtPlayers(fromIdx, toIdx) {
  ensureCourtShape();
  if (fromIdx === toIdx) return;
  const fromSlot = state.court[fromIdx] || { main: "", replaced: "" };
  const toSlot = state.court[toIdx] || { main: "", replaced: "" };
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
  setCourtPlayer(toIdx, "main", fromName);
  if (toName) {
    setCourtPlayer(fromIdx, "main", toName);
  } else {
    clearCourtAssignment(fromIdx, "main");
  }
}
function clearCourtAssignment(posIdx, target) {
  ensureCourtShape();
  const slot = state.court[posIdx];
  if (!slot) return;
  if ((state.liberos || []).includes(slot.main) && slot.replaced) {
    slot.main = slot.replaced;
    slot.replaced = "";
  } else {
    slot.main = "";
    slot.replaced = "";
  }
  state.court[posIdx] = slot;
  saveState();
  renderPlayers();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  updateRotationDisplay();
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
function applyMatchInfoToUI() {
  elOpponent.value = state.match.opponent || "";
  elCategory.value = state.match.category || "";
  elDate.value = state.match.date || "";
  elNotes.value = state.match.notes || "";
  elCurrentSet.value = String(state.currentSet || 1);
}
function saveMatchInfoFromUI() {
  state.match.opponent = elOpponent.value.trim();
  state.match.category = elCategory.value.trim();
  state.match.date = elDate.value;
  state.match.notes = elNotes.value.trim();
  state.currentSet = parseInt(elCurrentSet.value, 10) || 1;
  saveState();
}
function applyPlayersFromStateToTextarea() {
  if (elPlayersInput) {
    elPlayersInput.value = (state.players || []).join("\n");
  }
}
function renderPlayersManagerList() {
  if (!elPlayersList) return;
  elPlayersList.innerHTML = "";
  if (!state.players || state.players.length === 0) {
    const empty = document.createElement("div");
    empty.className = "players-empty";
    empty.textContent = "Nessuna giocatrice aggiunta.";
    elPlayersList.appendChild(empty);
    return;
  }
  state.players.forEach((name, idx) => {
    const pill = document.createElement("div");
    pill.className = "player-pill";
    const view = document.createElement("div");
    view.className = "pill-view";
    const number = document.createElement("span");
    number.className = "pill-index";
    const numVal = getPlayerNumber(name) || idx + 1;
    number.textContent = "#" + numVal;
    const label = document.createElement("span");
    label.className = "pill-name";
    label.textContent = name;
    view.appendChild(number);
    view.appendChild(label);
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "pill-edit-btn";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", () => {
      pill.classList.toggle("editing");
      if (pill.classList.contains("editing")) {
        nameInput.focus();
      }
    });
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = name;
    nameInput.className = "pill-name-input";
    nameInput.addEventListener("change", () => renamePlayerAtIndex(idx, nameInput.value));
    const numInput = document.createElement("input");
    numInput.type = "number";
    numInput.min = "0";
    numInput.max = "999";
    numInput.className = "pill-number-input";
    numInput.value = getPlayerNumber(name);
    numInput.addEventListener("change", e => {
      handlePlayerNumberChange(name, numInput.value);
    });
    const editFields = document.createElement("div");
    editFields.className = "pill-edit-fields";
    editFields.appendChild(nameInput);
    editFields.appendChild(numInput);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "pill-remove";
    removeBtn.dataset.playerIdx = String(idx);
    removeBtn.textContent = "✕";
    pill.appendChild(view);
    pill.appendChild(editBtn);
    pill.appendChild(editFields);
    pill.appendChild(removeBtn);
    elPlayersList.appendChild(pill);
  });
  renderLiberoTags();
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
function saveTeamToStorage(name, data) {
  if (!name) return;
  try {
    localStorage.setItem(getTeamStorageKey(name), JSON.stringify(data));
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
function getCurrentTeamPayload(name = "") {
  const safeName = (name || state.selectedTeam || state.match.opponent || "squadra").trim();
  return {
    version: 1,
    name: safeName,
    players: [...(state.players || [])],
    liberos: [...(state.liberos || [])],
    numbers: Object.assign({}, state.playerNumbers || {})
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
  state.savedTeams = state.savedTeams || {};
  state.savedTeams[name] = payload;
  state.selectedTeam = name;
  saveTeamToStorage(name, payload);
  saveState();
  renderTeamsSelect();
  alert((existing ? "Squadra sovrascritta: " : "Squadra salvata: ") + name);
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
function exportCurrentTeamToFile() {
  if (!state.players || state.players.length === 0) {
    alert("Aggiungi almeno una giocatrice prima di esportare.");
    return;
  }
  const payload = getCurrentTeamPayload();
  const opponentSlug = (payload.name || "squadra").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "squadra_" + (opponentSlug || "export") + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function applyImportedTeamData(data) {
  const players = normalizePlayers((data && data.players) || []);
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
  const liberosRaw = Array.isArray(data && data.liberos) ? data.liberos : [];
  const liberos = normalizePlayers(liberosRaw).filter(name => players.includes(name));
  const numbersRaw = data && typeof data.numbers === "object" ? data.numbers : {};
  const numbers = {};
  const usedNumbers = new Set();
  players.forEach(name => {
    const raw = (numbersRaw && numbersRaw[name]) || "";
    const clean = String(raw).trim();
    if (clean && /^[0-9]{1,3}$/.test(clean) && !usedNumbers.has(clean)) {
      numbers[name] = clean;
      usedNumbers.add(clean);
    }
  });
  updatePlayersList(players, { askReset: false });
  state.liberos = liberos;
  state.playerNumbers = numbers;
  syncPlayerNumbers(players);
  state.selectedTeam = "";
  saveState();
  renderLiberoTags();
  renderLiberoChipsInline();
  renderPlayers();
  renderBenchChips();
  renderLineupChips();
  renderTeamsSelect();
  alert("Squadra importata dal file.");
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
      "Caricare una nuova squadra vuota azzererà roster e statistiche correnti. Procedere?"
    );
    if (!ok) {
      renderTeamsSelect();
      return;
    }
    updatePlayersList([], { askReset: false });
    state.liberos = [];
    renderLiberoTags();
    renderTeamsSelect();
    return;
  }
  const team = loadTeamFromStorage(selected);
  if (!team) {
    alert("Squadra non trovata o corrotta.");
    renderTeamsSelect();
    return;
  }
  state.liberos = team.liberos || [];
  state.playerNumbers = team.numbers || {};
  updatePlayersList(team.players || [], { askReset: true });
  renderLiberoTags();
  renderTeamsSelect();
  renderLiberoChipsInline();
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
const allowedMetricCodes = new Set(RESULT_CODES);
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
function toggleMetricAssignment(skillId, category, code) {
  ensureMetricsConfigDefaults();
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
}
function toggleActiveCode(skillId, code) {
  ensureMetricsConfigDefaults();
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
}
function toggleSkillEnabled(skillId) {
  ensureMetricsConfigDefaults();
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
}
function resetAllActiveCodes() {
  const ok = confirm("Riattivare tutte le valutazioni (codici abilitati) per ogni fondamentale?");
  if (!ok) return;
  ensureMetricsConfigDefaults();
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
}
function renderMetricsConfig() {
  if (!elMetricsConfig) return;
  ensureMetricsConfigDefaults();
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
        RESULT_CODES.forEach(code => {
          const btn = document.createElement("button");
          btn.type = "button";
          const active =
            rowMeta.key === "activeCodes"
              ? state.metricsConfig[skill.id].activeCodes.includes(code)
              : state.metricsConfig[skill.id][rowMeta.key].includes(code);
          btn.className = "metric-toggle" + (active ? " active" : "");
          btn.textContent = code;
          if (rowMeta.key === "activeCodes") {
            btn.addEventListener("click", () => toggleActiveCode(skill.id, code));
          } else {
            btn.addEventListener("click", () => toggleMetricAssignment(skill.id, rowMeta.key, code));
          }
          row.appendChild(btn);
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
    colsWrap.appendChild(colLeft);
    colsWrap.appendChild(colRight);
    block.appendChild(colsWrap);
    elMetricsConfig.appendChild(block);
  });
}
function updatePlayersList(newPlayers, options = {}) {
  const { askReset = true, liberos = null, playerNumbers = null } = options;
  const normalized = normalizePlayers(newPlayers);
  const changed = playersChanged(normalized);
  if (!changed) {
    syncPlayerNumbers(normalized);
    saveState();
    applyPlayersFromStateToTextarea();
    renderPlayersManagerList();
    return;
  }
  if (state.events.length > 0 && askReset) {
    const ok = confirm(
      "Cambiare l'elenco di giocatrici azzererà tutte le statistiche del match. Procedere?"
    );
    if (!ok) return;
  }
  state.players = normalized;
  const providedNumbers = playerNumbers && typeof playerNumbers === "object" ? playerNumbers : {};
  state.playerNumbers = buildNumbersForNames(normalized, providedNumbers);
  state.events = [];
  ensureCourtShape();
  state.court = Array.from({ length: 6 }, () => ({ main: "" }));
  state.rotation = 1;
  const providedLiberos = Array.isArray(liberos) ? liberos : [];
  state.liberos = providedLiberos.filter(name => normalized.includes(name));
  ensureMetricsConfigDefaults();
  state.savedTeams = state.savedTeams || {};
  initStats();
  saveState();
  applyPlayersFromStateToTextarea();
  renderPlayers();
  renderPlayersManagerList();
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
  if (dragSourceType === "court" && draggedFromPos !== null) {
    swapCourtPlayers(draggedFromPos, posIdx);
    resetDragState();
    return;
  }
  setCourtPlayer(posIdx, target, name);
  resetDragState();
}
function handleBenchClick(name) {
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
  return (state.players || []).filter(
    name => !used.has(name) && !libSet.has(name) && !replaced.has(name)
  );
}
function getBenchLiberos() {
  const used = getUsedNames();
  const libSet = new Set(state.liberos || []);
  const replaced = new Set(getReplacedByLiberos());
  const names = [];
  (state.players || []).forEach(name => {
    if (libSet.has(name) && !used.has(name)) {
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
function releaseReplaced(name, keepIdx) {
  state.court = state.court.map((slot, idx) => {
    if (idx === keepIdx) return slot;
    if (slot.replaced === name) {
      return Object.assign({}, slot, { replaced: "" });
    }
    return slot;
  });
}
function renderBenchChips() {
  if (!elBenchChips) return;
  elBenchChips.innerHTML = "";
  const bench = getBenchPlayers();
  const lockedMap = getLockedMap();
  renderChipList(elBenchChips, bench, lockedMap, {
    highlightLibero: false,
    emptyText: "Nessuna riserva disponibile.",
    replacedSet: new Set()
  });
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
    roleSpan.textContent = "Pos " + (idx + 1) + " · " + getRoleLabel(idx);
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
  if (elRotationIndicator) {
    elRotationIndicator.textContent = String(state.rotation || 1);
  }
  if (elRotationSelect) {
    elRotationSelect.value = String(state.rotation || 1);
  }
}
function getRoleLabel(index) {
  const offset = (state.rotation || 1) - 1;
  const roles = BASE_ROLES;
  return roles[(index - offset + 12) % 6] || roles[index] || "";
}
function setRotation(value) {
  const rot = Math.min(6, Math.max(1, parseInt(value, 10) || 1));
  state.rotation = rot;
  saveState();
  updateRotationDisplay();
  renderPlayers();
  renderLineupChips();
}
function rotateCourt(direction) {
  ensureCourtShape();
  const court = state.court;
  let rotated = [];
  if (direction === "cw") {
    rotated = [court[5], court[0], court[1], court[2], court[3], court[4]];
    state.rotation = ((state.rotation || 1) % 6) + 1;
  } else {
    rotated = [court[1], court[2], court[3], court[4], court[5], court[0]];
    state.rotation = state.rotation === 1 ? 6 : state.rotation - 1;
  }
  state.court = rotated.map(slot => Object.assign({}, slot));
  // se un libero finisce in prima linea, rientra la giocatrice sostituita
  state.court = state.court.map((slot, idx) => {
    if ((state.liberos || []).includes(slot.main) && FRONT_ROW_INDEXES.has(idx)) {
      return { main: slot.replaced || "" , replaced: "" };
    }
    return slot;
  });
  saveState();
  renderPlayers();
  renderLineupChips();
  renderBenchChips();
  updateRotationDisplay();
}
function resetDragState() {
  draggedPlayerName = "";
  draggedFromPos = null;
  dragSourceType = "";
  if (activeDropChip) {
    activeDropChip.classList.remove("drop-over");
    activeDropChip = null;
  }
}
function applyPlayersFromTextarea() {
  if (!elPlayersInput) return;
  const raw = elPlayersInput.value;
  const parsed = parseDelimitedTeamText(raw);
  if (parsed && parsed.players && parsed.players.length > 0) {
    updatePlayersList(parsed.players, {
      askReset: true,
      liberos: parsed.liberos,
      playerNumbers: parsed.numbers
    });
    return;
  }
  const lines = raw
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);
  updatePlayersList(lines, { askReset: true });
}
function renderPlayers() {
  if (!elPlayersContainer) return;
  elPlayersContainer.innerHTML = "";
  elPlayersContainer.classList.add("court-layout");
  ensureCourtShape();
  ensureMetricsConfigDefaults();
  const renderOrder = [3, 2, 1, 4, 5, 0]; // pos4, pos3, pos2, pos5, pos6, pos1
  renderOrder.forEach(idx => {
    const meta = POSITIONS_META[idx];
    const slot = state.court[idx] || { main: "" };
    const activeName = slot.main;
    const card = document.createElement("div");
    card.className = "player-card court-card pos-" + (idx + 1);
    card.dataset.posIndex = String(idx);
    card.dataset.dropTarget = "main";
    const header = document.createElement("div");
    header.className = "court-header" + (activeName ? " draggable" : "");
    header.draggable = !!activeName;
    header.addEventListener("dragstart", e => handleCourtDragStart(e, idx));
    header.addEventListener("dragend", handleCourtDragEnd);
    const posLabel = document.createElement("span");
    posLabel.className = "court-pos-label";
    posLabel.textContent =
      "Posizione " + (idx + 1) + " · " + getRoleLabel(idx);
    const nameLabel = document.createElement("span");
    nameLabel.className = "court-name";
    nameLabel.textContent = slot.main ? formatNameWithNumber(slot.main) : "Trascina una giocatrice qui";
    header.appendChild(posLabel);
    if ((state.liberos || []).includes(slot.main)) {
      nameLabel.classList.add("libero-flag");
    }
    header.appendChild(nameLabel);
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "pill-remove clear-slot";
    clearBtn.textContent = "✕";
    clearBtn.addEventListener("click", () => {
      clearCourtAssignment(idx, "main");
    });
    header.appendChild(clearBtn);
    card.appendChild(header);

    card.addEventListener("dragenter", e => handlePositionDragOver(e, card), true);
    card.addEventListener("dragover", e => handlePositionDragOver(e, card), true);
    card.addEventListener("dragleave", () => handlePositionDragLeave(card), true);
    card.addEventListener("drop", e => handlePositionDrop(e, card), true);

    if (!activeName) {
      elPlayersContainer.appendChild(card);
      return;
    }

    const playerIdx = state.players.findIndex(p => p === activeName);
    if (playerIdx === -1) {
      elPlayersContainer.appendChild(card);
      return;
    }
    const enabledSkills = SKILLS.filter(skill => {
      const cfg = state.metricsConfig[skill.id];
      return !cfg || cfg.enabled !== false;
    });
    if (enabledSkills.length === 0) {
      const empty = document.createElement("div");
      empty.className = "players-empty";
      empty.textContent = "Abilita almeno un fondamentale nelle impostazioni per scoutizzare.";
      card.appendChild(empty);
      elPlayersContainer.appendChild(card);
      return;
    }
    for (let i = 0; i < enabledSkills.length; i += 2) {
      const rowWrap = document.createElement("div");
      rowWrap.className = "skill-row-pair";
      const subset = enabledSkills.slice(i, i + 2);
      subset.forEach(skill => {
    const row = document.createElement("div");
    row.className = "skill-row skill-" + skill.id;
        row.dataset.playerIdx = String(playerIdx);
        row.dataset.playerName = activeName;
        row.dataset.skillId = skill.id;
        const header = document.createElement("div");
        header.className = "skill-header";
        const left = document.createElement("span");
        const badge = document.createElement("span");
        badge.className = "badge " + skill.badgeClass;
        badge.textContent = skill.label;
        left.appendChild(badge);
        const right = document.createElement("span");
        right.textContent = "";
        right.className = "skill-counts";
        header.appendChild(left);
        header.appendChild(right);
        row.appendChild(header);
        const buttons = document.createElement("div");
        buttons.className = "skill-buttons";
        RESULT_CODES.forEach(code => {
          const cfg = state.metricsConfig[skill.id];
          const codeActive = !cfg || (cfg.activeCodes || RESULT_CODES).includes(code);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "small event-btn" + (codeActive ? "" : " disabled-code");
          btn.disabled = !codeActive;
          btn.textContent = code;
          btn.dataset.playerIdx = String(playerIdx);
          btn.dataset.playerName = activeName;
          btn.dataset.skillId = skill.id;
          btn.dataset.code = code;
          buttons.appendChild(btn);
        });
        row.appendChild(buttons);
        const statsDiv = document.createElement("div");
        statsDiv.className = "skill-stats";
        statsDiv.textContent = "Tot: 0";
        row.appendChild(statsDiv);
        rowWrap.appendChild(row);
      });
      card.appendChild(rowWrap);
    }
    if (activeName) {
      const extraRow = document.createElement("div");
      extraRow.className = "skill-row error-row";
      const buttons = document.createElement("div");
      buttons.className = "skill-buttons";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "small event-btn danger";
      btn.textContent = "Errore/Fallo";
      btn.addEventListener("click", () => addPlayerError(idx, activeName));
      buttons.appendChild(btn);
      extraRow.appendChild(buttons);
      card.appendChild(extraRow);
    }
    elPlayersContainer.appendChild(card);
  });
  recalcAllStatsAndUpdateUI();
  renderLineupChips();
}
function handleEventClick(playerIdxStr, skillId, code, playerName) {
  let playerIdx = parseInt(playerIdxStr, 10);
  if (isNaN(playerIdx) || !state.players[playerIdx]) {
    playerIdx = state.players.findIndex(p => p === playerName);
  }
  if (playerIdx === -1 || !state.players[playerIdx]) return;
  const now = new Date();
  const timeStr = now.toISOString();
  const event = {
    t: timeStr,
    set: state.currentSet,
    rotation: state.rotation || 1,
    playerIdx: playerIdx,
    playerName: state.players[playerIdx],
    skillId: skillId,
    code: code
  };
  state.events.push(event);
  if (!state.stats[playerIdx]) {
    state.stats[playerIdx] = {};
  }
  if (!state.stats[playerIdx][skillId]) {
    state.stats[playerIdx][skillId] = { "#": 0, "+": 0, "!": 0, "-": 0, "=": 0, "/": 0 };
  }
  state.stats[playerIdx][skillId][code] =
    (state.stats[playerIdx][skillId][code] || 0) + 1;
  saveState();
  updateSkillStatsUI(playerIdx, skillId);
  renderEventsLog();
  renderAggregatedTable();
}
function computeMetrics(counts, skillId) {
  ensureMetricsConfigDefaults();
  const cfg = state.metricsConfig && state.metricsConfig[skillId];
  const total = RESULT_CODES.reduce((sum, code) => sum + (counts[code] || 0), 0);
  if (!total) {
    return { total: 0, pos: null, eff: null, prf: null, positiveCount: 0, negativeCount: 0 };
  }
  const positiveCodes = (cfg && cfg.positive) || ["#", "+"];
  const negativeCodes = (cfg && cfg.negative) || ["-"];
  const positiveCount = positiveCodes.reduce((sum, code) => sum + (counts[code] || 0), 0);
  const negativeCount = negativeCodes.reduce(
    (sum, code) => sum + (counts[code] || 0),
    0
  );
  const pos = (positiveCount / total) * 100;
  const eff = ((positiveCount - negativeCount) / total) * 100;
  const prf = ((counts["#"] || 0) / total) * 100;
  return { total, pos, eff, prf, positiveCount, negativeCount };
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
    if (ev.skillId === "manual") {
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
}
function renderEventsLog() {
  elEventsLog.innerHTML = "";
  if (!state.events || state.events.length === 0) {
    elEventsLog.textContent = "Nessun evento ancora registrato.";
    return;
  }
  const recent = state.events.slice(-40).reverse();
  recent.forEach(ev => {
    const div = document.createElement("div");
    div.className = "event-line";
    const left = document.createElement("span");
    left.className = "event-left";
    const dateObj = new Date(ev.t);
    const timeStr = isNaN(dateObj.getTime())
      ? ""
      : dateObj.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
    left.textContent =
      "[S" +
      ev.set +
      "] " +
      (ev.playerName ? formatNameWithNumber(ev.playerName) : "#" + ev.playerIdx) +
      " - " +
      ev.skillId +
      " " +
      ev.code;
    const right = document.createElement("span");
    right.className = "event-right";
    right.textContent = timeStr;
    div.appendChild(left);
    div.appendChild(right);
    elEventsLog.appendChild(div);
  });
}
function getPointDirection(ev) {
  if (ev.pointDirection === "for" || ev.pointDirection === "against") {
    return ev.pointDirection;
  }
  const skill = ev.skillId;
  const code = ev.code;
  if (POINT_RULES.made[skill] && POINT_RULES.made[skill].has(code)) return "for";
  if (POINT_RULES.conceded[skill] && POINT_RULES.conceded[skill].has(code)) return "against";
  return null;
}
function computePointsSummary(targetSet) {
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
    const direction = getPointDirection(ev);
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
  const totalForClean = Math.max(0, totalFor);
  const totalAgainstClean = Math.max(0, totalAgainst);
  const hasEvents = totalForClean + totalAgainstClean > 0;
  const maxDelta = rotationList.reduce((acc, r) => Math.max(acc, r.delta), -Infinity);
  const minDelta = rotationList.reduce((acc, r) => Math.min(acc, r.delta), Infinity);
  const best = hasEvents ? rotationList.find(r => r.delta === maxDelta) : null;
  const worst = hasEvents ? rotationList.find(r => r.delta === minDelta) : null;
  return {
    totalFor: totalForClean,
    totalAgainst: totalAgainstClean,
    rotations: rotationList,
    bestRotation: hasEvents && best ? best.rotation : null,
    worstRotation: hasEvents && worst ? worst.rotation : null,
    bestDelta: hasEvents && best ? best.delta : null,
    worstDelta: hasEvents && worst ? worst.delta : null
  };
}
function computeSetScores() {
  const setMap = {};
  (state.events || []).forEach(ev => {
    const setNum = parseInt(ev.set, 10) || 1;
    const direction = getPointDirection(ev);
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
}
function addManualPoint(direction, value, codeLabel, playerIdx = null, playerName = "Squadra") {
  const rot = state.rotation || 1;
  const event = {
    t: new Date().toISOString(),
    set: state.currentSet,
    rotation: rot,
    playerIdx: playerIdx,
    playerName: playerName,
    skillId: "manual",
    code: codeLabel || direction,
    pointDirection: direction,
    value: value
  };
  state.events.push(event);
  saveState();
  renderEventsLog();
  recalcAllStatsAndUpdateUI();
}
function handleManualScore(direction, delta) {
  const value = delta > 0 ? 1 : -1;
  addManualPoint(direction, value, direction, null, "Squadra");
}
function addPlayerError(playerIdx, playerName) {
  addManualPoint("against", 1, "error", playerIdx, playerName || "Giocatrice");
}
function renderScoreAndRotations(summary) {
  const effectiveSummary = summary || computePointsSummary();
  const totalLabel = effectiveSummary.totalFor + " - " + effectiveSummary.totalAgainst;
  if (elAggScore) {
    elAggScore.textContent = totalLabel;
  }
  if (elAggSetCards) {
    elAggSetCards.innerHTML = "";
    const setsData = computeSetScores();
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
  const hasEvents = effectiveSummary.totalFor + effectiveSummary.totalAgainst > 0;
  if (!elRotationTableBody) return;
  elRotationTableBody.innerHTML = "";
  if (!hasEvents) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "Registra eventi per vedere le rotazioni.";
    tr.appendChild(td);
    elRotationTableBody.appendChild(tr);
    return;
  }
  const highlightEnabled =
    effectiveSummary.bestRotation !== null && effectiveSummary.worstRotation !== null;
  effectiveSummary.rotations.forEach(rot => {
    const tr = document.createElement("tr");
    tr.className = "rotation-row";
    if (highlightEnabled && rot.rotation === effectiveSummary.bestRotation) {
      tr.classList.add("best");
    }
    if (
      highlightEnabled &&
      rot.rotation === effectiveSummary.worstRotation &&
      effectiveSummary.worstRotation !== effectiveSummary.bestRotation
    ) {
      tr.classList.add("worst");
    }
    const cells = [
      rot.rotation,
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
function renderAggregatedTable() {
  if (!elAggTableBody) return;
  elAggTableBody.innerHTML = "";
  if (!state.players || state.players.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 25;
    td.textContent = "Aggiungi giocatrici per vedere il riepilogo.";
    tr.appendChild(td);
    elAggTableBody.appendChild(tr);
    renderScoreAndRotations(computePointsSummary());
    return;
  }
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
    return Object.assign({ "#": 0, "+": 0, "!": 0, "-": 0, "=": 0, "/": 0 }, base);
  };
  const totalFromCounts = counts =>
    (counts["#"] || 0) +
    (counts["+"] || 0) +
    (counts["!"] || 0) +
    (counts["-"] || 0) +
    (counts["="] || 0) +
    (counts["/"] || 0);
  const addSkillClassesToRow = rowEl => {
    if (!rowEl) return;
    const tds = Array.from(rowEl.children);
    Object.keys(SKILL_COLUMN_MAP).forEach(skillId => {
      const idxs = SKILL_COLUMN_MAP[skillId] || [];
      idxs.forEach(i => {
        if (tds[i]) {
          tds[i].classList.add("skill-col", "skill-" + skillId);
        }
      });
    });
  };
  const emptyCounts = () => ({ "#": 0, "+": 0, "!": 0, "-": 0, "=": 0, "/": 0 });
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
  state.players.forEach((name, idx) => {
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

    const tr = document.createElement("tr");
    const values = [
      formatNameWithNumber(name),

      totalFromCounts(serveCounts),
      serveMetrics.negativeCount || 0,
      serveMetrics.pos === null ? "-" : formatPercent(serveMetrics.pos),
      serveMetrics.eff === null ? "-" : formatPercent(serveMetrics.eff),

      totalFromCounts(passCounts),
      passMetrics.negativeCount || 0,
      passMetrics.pos === null ? "-" : formatPercent(passMetrics.pos),
      passMetrics.prf === null ? "-" : formatPercent(passMetrics.prf),

      totalFromCounts(attackCounts),
      attackMetrics.negativeCount || 0,
      attackMetrics.pos === null ? "-" : formatPercent(attackMetrics.pos),
      attackMetrics.eff === null ? "-" : formatPercent(attackMetrics.eff),

      totalFromCounts(defenseCounts),
      defenseMetrics.negativeCount || 0,
      defenseMetrics.pos === null ? "-" : formatPercent(defenseMetrics.pos),
      defenseMetrics.eff === null ? "-" : formatPercent(defenseMetrics.eff),

      totalFromCounts(blockCounts),
      blockMetrics.negativeCount || 0,
      blockMetrics.pos === null ? "-" : formatPercent(blockMetrics.pos),
      blockMetrics.eff === null ? "-" : formatPercent(blockMetrics.eff),

      totalFromCounts(secondCounts),
      secondMetrics.pos === null ? "-" : formatPercent(secondMetrics.pos),
      secondMetrics.prf === null ? "-" : formatPercent(secondMetrics.prf)
    ];
    values.forEach(text => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    addSkillClassesToRow(tr);
    elAggTableBody.appendChild(tr);
  });
  const serveTotalsMetrics = computeMetrics(totalsBySkill.serve, "serve");
  const passTotalsMetrics = computeMetrics(totalsBySkill.pass, "pass");
  const attackTotalsMetrics = computeMetrics(totalsBySkill.attack, "attack");
  const defenseTotalsMetrics = computeMetrics(totalsBySkill.defense, "defense");
  const blockTotalsMetrics = computeMetrics(totalsBySkill.block, "block");
  const secondTotalsMetrics = computeMetrics(totalsBySkill.second, "second");
  const totalsRow = document.createElement("tr");
  totalsRow.className = "rotation-row total";
  const totalValues = [
    "Totale squadra",

    totalFromCounts(totalsBySkill.serve),
    serveTotalsMetrics.negativeCount || 0,
    serveTotalsMetrics.pos === null ? "-" : formatPercent(serveTotalsMetrics.pos),
    serveTotalsMetrics.eff === null ? "-" : formatPercent(serveTotalsMetrics.eff),

    totalFromCounts(totalsBySkill.pass),
    passTotalsMetrics.negativeCount || 0,
    passTotalsMetrics.pos === null ? "-" : formatPercent(passTotalsMetrics.pos),
    passTotalsMetrics.prf === null ? "-" : formatPercent(passTotalsMetrics.prf),

    totalFromCounts(totalsBySkill.attack),
    attackTotalsMetrics.negativeCount || 0,
    attackTotalsMetrics.pos === null ? "-" : formatPercent(attackTotalsMetrics.pos),
    attackTotalsMetrics.eff === null ? "-" : formatPercent(attackTotalsMetrics.eff),

    totalFromCounts(totalsBySkill.defense),
    defenseTotalsMetrics.negativeCount || 0,
    defenseTotalsMetrics.pos === null ? "-" : formatPercent(defenseTotalsMetrics.pos),
    defenseTotalsMetrics.eff === null ? "-" : formatPercent(defenseTotalsMetrics.eff),

    totalFromCounts(totalsBySkill.block),
    blockTotalsMetrics.negativeCount || 0,
    blockTotalsMetrics.pos === null ? "-" : formatPercent(blockTotalsMetrics.pos),
    blockTotalsMetrics.eff === null ? "-" : formatPercent(blockTotalsMetrics.eff),

    totalFromCounts(totalsBySkill.second),
    secondTotalsMetrics.pos === null ? "-" : formatPercent(secondTotalsMetrics.pos),
    secondTotalsMetrics.prf === null ? "-" : formatPercent(secondTotalsMetrics.prf)
  ];
  totalValues.forEach(text => {
    const td = document.createElement("td");
    td.textContent = text;
    totalsRow.appendChild(td);
  });
  addSkillClassesToRow(totalsRow);
  elAggTableBody.appendChild(totalsRow);
  const summaryAll = computePointsSummary();
  renderScoreAndRotations(summaryAll);
  applyAggColumnsVisibility();
}
function exportCsv() {
  if (!state.events || state.events.length === 0) {
    alert("Nessun evento da esportare.");
    return;
  }
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
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const opponentSlug = (state.match.opponent || "match").replace(/\s+/g, "_");
  a.href = url;
  a.download = "scout_" + opponentSlug + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function resetMatch() {
  if (!confirm("Sei sicuro di voler resettare tutti i dati del match?")) return;
  state.events = [];
  state.court = Array.from({ length: 6 }, () => ({ main: "" }));
  state.rotation = 1;
  initStats();
  saveState();
  recalcAllStatsAndUpdateUI();
  renderEventsLog();
  renderPlayers();
  renderBenchChips();
  updateRotationDisplay();
}
function undoLastEvent() {
  if (!state.events || state.events.length === 0) {
    alert("Non ci sono eventi da annullare.");
    return;
  }
  const ev = state.events.pop();
  const idx = ev.playerIdx;
  const skillId = ev.skillId;
  if (
    state.stats[idx] &&
    state.stats[idx][skillId] &&
    state.stats[idx][skillId][ev.code] > 0
  ) {
    state.stats[idx][skillId][ev.code]--;
  }
  saveState();
  recalcAllStatsAndUpdateUI();
  renderEventsLog();
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
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("service-worker.js")
        .catch(err => console.error("SW registration failed", err));
    });
  }
}
function initTabs() {
  if (!tabButtons || !tabPanels) return;
  const setActiveTab = target => {
    tabButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tabTarget === target);
    });
    tabPanels.forEach(panel => {
      panel.classList.toggle("active", panel.dataset.tab === target);
    });
  };
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
function init() {
  initTabs();
  loadState();
  applyMatchInfoToUI();
  updateRotationDisplay();
  applyPlayersFromStateToTextarea();
  renderPlayersManagerList();
  renderBenchChips();
  renderLiberoChipsInline();
  renderLineupChips();
  renderLiberoTags();
  renderMetricsConfig();
  renderTeamsSelect();
  renderLiveScore();
  renderPlayers();
  if (!state.players || state.players.length === 0) {
    updatePlayersList(["Piccardi", "Cimmino", "Bilamour"], { askReset: false });
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

  if (elCurrentSet) {
    elCurrentSet.addEventListener("change", () => {
      state.currentSet = parseInt(elCurrentSet.value, 10) || 1;
      saveState();
      renderLiveScore();
    });
  }
  if (elBtnSaveInfo) {
    elBtnSaveInfo.addEventListener("click", () => {
      saveMatchInfoFromUI();
      alert("Info partita salvate.");
    });
  }
  if (elBtnApplyPlayers) {
    elBtnApplyPlayers.addEventListener("click", () => {
      applyPlayersFromTextarea();
    });
  }
  if (elPlayersContainer) {
    elPlayersContainer.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("event-btn")) return;
      const playerIdx = target.dataset.playerIdx;
      const playerName = target.dataset.playerName;
      const skillId = target.dataset.skillId;
      const code = target.dataset.code;
      handleEventClick(playerIdx, skillId, code, playerName);
    });
  }
  if (elBtnAddPlayer) {
    elBtnAddPlayer.addEventListener("click", addPlayerFromInput);
  }
  if (elNewPlayerInput) {
    elNewPlayerInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        addPlayerFromInput();
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
  if (elBtnSaveTeam) {
    elBtnSaveTeam.addEventListener("click", saveCurrentTeam);
  }
  if (elBtnDeleteTeam) {
    elBtnDeleteTeam.addEventListener("click", deleteSelectedTeam);
  }
  if (elBtnRenameTeam) {
    elBtnRenameTeam.addEventListener("click", renameSelectedTeam);
  }
  if (elBtnExportTeam) {
    elBtnExportTeam.addEventListener("click", exportCurrentTeamToFile);
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
  if (elTeamsSelect) {
    elTeamsSelect.addEventListener("change", handleTeamSelectChange);
  }
  if (elBtnRotateCw) {
    elBtnRotateCw.addEventListener("click", () => rotateCourt("cw"));
  }
  if (elBtnRotateCcw) {
    elBtnRotateCcw.addEventListener("click", () => rotateCourt("ccw"));
  }
  if (elRotationSelect) {
    elRotationSelect.addEventListener("change", () => setRotation(elRotationSelect.value));
  }
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
  if (elBtnExportCsv) elBtnExportCsv.addEventListener("click", exportCsv);
  if (elBtnResetMatch) elBtnResetMatch.addEventListener("click", resetMatch);
  if (elBtnUndo) elBtnUndo.addEventListener("click", undoLastEvent);
  if (elBtnResetMetrics) {
    elBtnResetMetrics.addEventListener("click", resetMetricsToDefault);
  }
  if (elBtnResetCodes) {
    elBtnResetCodes.addEventListener("click", resetAllActiveCodes);
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
  if (elBtnScoreError) {
    elBtnScoreError.addEventListener("click", handleManualError);
  }
  registerServiceWorker();
}
document.addEventListener("DOMContentLoaded", init);
