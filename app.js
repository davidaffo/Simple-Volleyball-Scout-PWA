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
    notes: ""
  },
  currentSet: 1,
  players: [],
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
const elLineupChips = document.getElementById("lineup-chips");
const elBenchChips = document.getElementById("bench-chips");
const elRotationIndicator = document.getElementById("rotation-indicator");
const elBtnRotateCw = document.getElementById("btn-rotate-cw");
const elBtnRotateCcw = document.getElementById("btn-rotate-ccw");
const elLiberoTags = document.getElementById("libero-tags");
const elMetricsConfig = document.getElementById("metrics-config");
const elBtnResetMetrics = document.getElementById("btn-reset-metrics");
let activeDropChip = null;
let draggedPlayerName = "";
const BASE_ROLES = ["P", "S1", "C2", "O", "S2", "C1"];
const FRONT_ROW_INDEXES = new Set([1, 2, 3]); // pos2, pos3, pos4
const elEventsLog = document.getElementById("events-log");
const elBtnApplyPlayers = document.getElementById("btn-apply-players");
const elBtnExportCsv = document.getElementById("btn-export-csv");
const elBtnResetMatch = document.getElementById("btn-reset-match");
const elBtnSaveInfo = document.getElementById("btn-save-info");
const elBtnUndo = document.getElementById("btn-undo");
const elAggTableBody = document.getElementById("agg-table-body");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    state = Object.assign(state, parsed);
    ensureCourtShape();
    cleanCourtPlayers();
    state.rotation = parsed.rotation || 1;
    state.liberos = Array.isArray(parsed.liberos) ? parsed.liberos : [];
    state.savedTeams = parsed.savedTeams || {};
    state.selectedTeam = parsed.selectedTeam || "";
    state.metricsConfig = parsed.metricsConfig || {};
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
  if ((state.liberos || []).includes(name)) {
    updated.replaced = prevMain || slot.replaced || "";
  } else {
    updated.replaced = "";
  }
  releaseReplaced(name, posIdx);
  state.court[posIdx] = updated;
  cleanCourtPlayers();
  saveState();
  renderPlayers();
  renderBenchChips();
  renderLineupChips();
  updateRotationDisplay();
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
    const number = document.createElement("span");
    number.className = "pill-index";
    number.textContent = "#" + (idx + 1);
    const label = document.createElement("span");
    label.className = "pill-name";
    label.textContent = name;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "pill-remove";
    removeBtn.dataset.playerIdx = String(idx);
    removeBtn.title = "Rimuovi giocatrice";
    removeBtn.textContent = "✕";
    pill.appendChild(number);
    pill.appendChild(label);
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
  const payload = {
    players: [...state.players],
    liberos: [...(state.liberos || [])]
  };
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
  updatePlayersList(team.players || [], { askReset: true });
  renderLiberoTags();
  renderTeamsSelect();
}
function renderLiberoTags() {
  if (!elLiberoTags) return;
  elLiberoTags.innerHTML = "";
  if (!state.players || state.players.length === 0) {
    const span = document.createElement("div");
    span.className = "players-empty";
    span.textContent = "Aggiungi giocatrici per segnare i liberi.";
    elLiberoTags.appendChild(span);
    return;
  }
  const libSet = new Set(state.liberos || []);
  state.players.forEach(name => {
    const btn = document.createElement("button");
    const active = libSet.has(name);
    btn.type = "button";
    btn.className = "libero-tag" + (active ? " active" : "");
    btn.textContent = name;
    btn.addEventListener("click", () => toggleLibero(name));
    elLiberoTags.appendChild(btn);
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
    "Ripristinare i criteri di default per tutte le metriche e i punti fatti/subiti?"
  );
  if (!ok) return;
  state.metricsConfig = {};
  ensureMetricsConfigDefaults();
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
    block.className = "metric-block" + (enabled ? "" : " disabled");
    const title = document.createElement("div");
    title.className = "metric-title";
    title.textContent = skill.label;
    block.appendChild(title);
    const helper = document.createElement("div");
    helper.className = "metric-helper";
  helper.textContent =
      "Positività: positive / totale · Efficienza: (positive - negative) / totale · Perfezione: # / totale";
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
          btn.title = (RESULT_LABELS[code] || code) + " (" + skill.label + ")";
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
  const { askReset = true } = options;
  const normalized = normalizePlayers(newPlayers);
  const changed = playersChanged(normalized);
  if (!changed) {
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
  state.events = [];
  ensureCourtShape();
  state.court = Array.from({ length: 6 }, () => ({ main: "" }));
  state.rotation = 1;
  state.liberos = [];
  ensureMetricsConfigDefaults();
  state.savedTeams = state.savedTeams || {};
  initStats();
  saveState();
  applyPlayersFromStateToTextarea();
  renderPlayers();
  renderPlayersManagerList();
  renderBenchChips();
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
  e.dataTransfer.setData("text/plain", name);
  e.dataTransfer.effectAllowed = "move";
  if (activeDropChip) {
    activeDropChip.classList.remove("drop-over");
    activeDropChip = null;
  }
}
function handleBenchDragEnd() {
  draggedPlayerName = "";
  if (activeDropChip) {
    activeDropChip.classList.remove("drop-over");
    activeDropChip = null;
  }
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
  if (!name || isNaN(posIdx)) return;
  setCourtPlayer(posIdx, target, name);
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
  return (state.players || []).filter(name => !used.has(name));
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
  if (bench.length === 0) {
    const span = document.createElement("span");
    span.className = "bench-empty";
    span.textContent = "Nessuna riserva disponibile.";
    elBenchChips.appendChild(span);
    return;
  }
  bench.forEach(name => {
    const chip = document.createElement("div");
    const classes = ["bench-chip"];
    if ((state.liberos || []).includes(name)) classes.push("libero-flag");
    if (lockedMap[name] !== undefined) classes.push("bench-locked");
    chip.className = classes.join(" ");
    chip.draggable = true;
    chip.dataset.playerName = name;
    const label = document.createElement("span");
    label.textContent =
      name + (lockedMap[name] !== undefined ? " (sost. libero)" : "");
    chip.appendChild(label);
    chip.addEventListener("dragstart", handleBenchDragStart);
    chip.addEventListener("dragend", handleBenchDragEnd);
    chip.addEventListener("click", () => handleBenchClick(name));
    elBenchChips.appendChild(chip);
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
    nameSpan.textContent = active || "—";
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
}
function getRoleLabel(index) {
  const offset = (state.rotation || 1) - 1;
  const roles = BASE_ROLES;
  return roles[(index - offset + 12) % 6] || roles[index] || "";
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
function applyPlayersFromTextarea() {
  if (!elPlayersInput) return;
  const lines = elPlayersInput.value
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
    const card = document.createElement("div");
    card.className = "player-card court-card pos-" + (idx + 1);
    card.dataset.posIndex = String(idx);
    card.dataset.dropTarget = "main";
    const header = document.createElement("div");
    header.className = "court-header";
    const posLabel = document.createElement("span");
    posLabel.className = "court-pos-label";
    posLabel.textContent =
      "Posizione " + (idx + 1) + " · " + getRoleLabel(idx);
    const nameLabel = document.createElement("span");
    nameLabel.className = "court-name";
    nameLabel.textContent = slot.main || "Trascina una giocatrice qui";
    header.appendChild(posLabel);
    if ((state.liberos || []).includes(slot.main)) {
      nameLabel.classList.add("libero-flag");
    }
    header.appendChild(nameLabel);
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "pill-remove clear-slot";
    clearBtn.title = "Togli dal campo";
    clearBtn.textContent = "✕";
    clearBtn.addEventListener("click", () => {
      clearCourtAssignment(idx, "main");
    });
    header.appendChild(clearBtn);
    card.appendChild(header);

    const activeName = slot.main;
    card.addEventListener("dragenter", e => handlePositionDragOver(e, card));
    card.addEventListener("dragover", e => handlePositionDragOver(e, card));
    card.addEventListener("dragleave", () => handlePositionDragLeave(card));
    card.addEventListener("drop", e => handlePositionDrop(e, card));

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
        row.className = "skill-row";
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
          btn.title = (RESULT_LABELS[code] || "") + " (" + activeName + ")";
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
      (ev.playerName || "#" + ev.playerIdx) +
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

    const tr = document.createElement("tr");
    const values = [
      idx + 1,
      name,

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
    elAggTableBody.appendChild(tr);
  });
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
  renderLineupChips();
  renderLiberoTags();
  renderMetricsConfig();
  renderTeamsSelect();
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
    renderLineupChips();
    renderLiberoTags();
    renderMetricsConfig();
    renderTeamsSelect();
  }
  elCurrentSet.addEventListener("change", () => {
    state.currentSet = parseInt(elCurrentSet.value, 10) || 1;
    saveState();
  });
  elBtnSaveInfo.addEventListener("click", () => {
    saveMatchInfoFromUI();
    alert("Info partita salvate.");
  });
  elBtnApplyPlayers.addEventListener("click", () => {
    applyPlayersFromTextarea();
  });
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
      if (!target.classList.contains("pill-remove")) return;
      const idx = parseInt(target.dataset.playerIdx, 10);
      if (isNaN(idx)) return;
      removePlayerAtIndex(idx);
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
  if (elTeamsSelect) {
    elTeamsSelect.addEventListener("change", handleTeamSelectChange);
  }
  if (elBtnRotateCw) {
    elBtnRotateCw.addEventListener("click", () => rotateCourt("cw"));
  }
  if (elBtnRotateCcw) {
    elBtnRotateCcw.addEventListener("click", () => rotateCourt("ccw"));
  }
  elBtnExportCsv.addEventListener("click", exportCsv);
  elBtnResetMatch.addEventListener("click", resetMatch);
  elBtnUndo.addEventListener("click", undoLastEvent);
  if (elBtnResetMetrics) {
    elBtnResetMetrics.addEventListener("click", resetMetricsToDefault);
  }
  registerServiceWorker();
}
document.addEventListener("DOMContentLoaded", init);
