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
const elUndoLastSummary = document.getElementById("undo-last-summary");
const elEventsLogSummary = document.getElementById("events-log-summary");
const elFloatingLogSummary = document.getElementById("floating-log-summary");
const elBtnApplyPlayers = document.getElementById("btn-apply-players");
const elBtnExportCsv = document.getElementById("btn-export-csv");
const elBtnCopyCsv = document.getElementById("btn-copy-csv");
const elBtnExportPdf = document.getElementById("btn-export-pdf");
const elBtnResetMatch = document.getElementById("btn-reset-match");
const elBtnExportMatch = document.getElementById("btn-export-match");
const elBtnImportMatch = document.getElementById("btn-import-match");
const elMatchFileInput = document.getElementById("match-file-input");
const elBtnSaveInfo = document.getElementById("btn-save-info");
const elBtnUndo = document.getElementById("btn-undo");
const elBtnUndoFloating = document.getElementById("btn-undo-floating");
const elBtnOpenActionsModal = document.getElementById("btn-open-actions-modal");
const elActionsModal = document.getElementById("floating-actions-modal");
const elActionsClose = document.getElementById("floating-actions-close");
const elBtnOpenLineupMobile = document.getElementById("btn-open-lineup-mobile");
const elBtnOpenLineupMobileFloating = document.getElementById("btn-open-lineup-mobile-floating");
const elMobileLineupModal = document.getElementById("mobile-lineup-modal");
const elMobileLineupClose = document.getElementById("mobile-lineup-close");
const elMobileLineupList = document.getElementById("mobile-lineup-list");
const elMiniCourt = document.getElementById("mini-court");
const elMobileLineupConfirm = document.getElementById("mobile-lineup-confirm");
const elAggTableBody = document.getElementById("agg-table-body");
const elRotationTableBody = document.getElementById("rotation-table-body");
const elLiveScore = document.getElementById("live-score");
const elLiveScoreFloating = document.getElementById("live-score-floating");
const elLiveScoreModal = document.getElementById("live-score-modal");
const elAggScore = document.getElementById("agg-score");
const elAggSetCards = document.getElementById("agg-set-cards");
const elBtnScoreForPlus = document.getElementById("btn-score-for-plus");
const elBtnScoreForMinus = document.getElementById("btn-score-for-minus");
const elBtnScoreAgainstPlus = document.getElementById("btn-score-against-plus");
const elBtnScoreAgainstMinus = document.getElementById("btn-score-against-minus");
const elBtnScoreForPlusModal = document.getElementById("btn-score-for-plus-modal");
const elBtnScoreForMinusModal = document.getElementById("btn-score-for-minus-modal");
const elBtnScoreAgainstPlusModal = document.getElementById("btn-score-against-plus-modal");
const elBtnScoreAgainstMinusModal = document.getElementById("btn-score-against-minus-modal");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const tabDots = document.querySelectorAll(".tab-dot");
const elToggleLogMobile = document.getElementById("toggle-log-mobile");
const elLogSection = document.querySelector("[data-log-section]");
let activeTab = "info";

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
    state.theme = parsed.theme || "dark";
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
function canPlaceInSlot(name, posIdx, showAlert = true) {
  if (!name) return true;
  if (isLibero(name) && FRONT_ROW_INDEXES.has(posIdx)) {
    if (showAlert) alert("Non puoi mettere il libero in prima linea.");
    return false;
  }
  const lockedMap = getLockedMap();
  if (lockedMap[name] !== undefined && lockedMap[name] !== posIdx) {
    if (showAlert) alert("Questa giocatrice può rientrare solo nella sua posizione (sostituita dal libero).");
    return false;
  }
  return true;
}
function isMobileLayout() {
  return (
    window.matchMedia("(max-width: 900px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
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
  if (!canPlaceInSlot(name, posIdx, true)) return;
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
function syncCurrentSetUI(value) {
  const setValue = String(value || 1);
  if (elCurrentSet) {
    elCurrentSet.value = setValue;
  }
  if (elCurrentSetFloating) {
    elCurrentSetFloating.value = setValue;
  }
}
function applyMatchInfoToUI() {
  elOpponent.value = state.match.opponent || "";
  elCategory.value = state.match.category || "";
  elDate.value = state.match.date || "";
  elNotes.value = state.match.notes || "";
  syncCurrentSetUI(state.currentSet || 1);
}
function saveMatchInfoFromUI() {
  state.match.opponent = elOpponent.value.trim();
  state.match.category = elCategory.value.trim();
  state.match.date = elDate.value;
  state.match.notes = elNotes.value.trim();
  const setValue = (elCurrentSetFloating && elCurrentSetFloating.value) || (elCurrentSet && elCurrentSet.value) || 1;
  setCurrentSet(setValue, { save: false });
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
      "Caricare una nuova squadra precompilata (14 giocatrici e 2 liberi) azzererà roster e statistiche correnti. Procedere?"
    );
    if (!ok) {
      renderTeamsSelect();
      return;
    }
    applyTemplateTeam({ askReset: false });
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
const SETTINGS_RESULT_CODES = ["#", "+", "!", "-", "/", "="];
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
function buildTemplateNumbers() {
  const numbers = {};
  TEMPLATE_TEAM.players.forEach((name, idx) => {
    numbers[name] = String(idx + 1);
  });
  return numbers;
}
function applyTemplateTeam(options = {}) {
  const { askReset = true } = options;
  updatePlayersList(TEMPLATE_TEAM.players, {
    askReset,
    liberos: TEMPLATE_TEAM.liberos,
    playerNumbers: buildTemplateNumbers()
  });
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
  renderPlayers();
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
  renderPlayers();
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
  renderPlayers();
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
  renderPlayers();
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
        SETTINGS_RESULT_CODES.forEach(code => {
          const btn = document.createElement("button");
          btn.type = "button";
          const active =
            rowMeta.key === "activeCodes"
              ? state.metricsConfig[skill.id].activeCodes.includes(code)
              : state.metricsConfig[skill.id][rowMeta.key].includes(code);
          const tone = getCodeTone(skill.id, code);
          let cls = "metric-toggle";
          if (active) cls += " active code-" + tone;
          btn.className = cls;
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
  if (isMobileLayout()) {
    if (elBenchChips) elBenchChips.innerHTML = "";
    return;
  }
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
  if (isMobileLayout()) {
    if (elLiberoTagsInline) elLiberoTagsInline.innerHTML = "";
    return;
  }
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
  if (elRotationIndicatorFloating) {
    elRotationIndicatorFloating.textContent = String(state.rotation || 1);
  }
  if (elRotationSelectFloating) {
    elRotationSelectFloating.value = String(state.rotation || 1);
  }
  if (elRotationIndicatorModal) {
    elRotationIndicatorModal.textContent = String(state.rotation || 1);
  }
}
function getRoleLabel(index) {
  const offset = (state.rotation || 1) - 1;
  const roles = BASE_ROLES;
  return roles[(index - offset + 12) % 6] || roles[index] || "";
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
function openActionsModal() {
  if (!elActionsModal) return;
  elActionsModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeActionsModal() {
  if (!elActionsModal) return;
  elActionsModal.classList.add("hidden");
  document.body.style.overflow = "";
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
