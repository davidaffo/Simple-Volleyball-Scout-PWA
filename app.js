const STORAGE_KEY = "volleyScoutV1";
const SKILLS = [
  { id: "serve", label: "Battuta", badgeClass: "badge-serve" },
  { id: "pass", label: "Ricezione", badgeClass: "badge-pass" },
  { id: "attack", label: "Attacco", badgeClass: "badge-attack" },
  { id: "block", label: "Muro", badgeClass: "badge-block" },
  { id: "second", label: "2° tocco alzata", badgeClass: "badge-second" }
];
const RESULT_CODES = ["#", "+", "-", "=", "/"];
const RESULT_LABELS = {
  "#": "Punto / perfetto",
  "+": "Buono",
  "-": "Errore",
  "=": "Neutro",
  "/": "Altro"
};
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
  stats: {}
};
const elOpponent = document.getElementById("match-opponent");
const elCategory = document.getElementById("match-category");
const elDate = document.getElementById("match-date");
const elNotes = document.getElementById("match-notes");
const elCurrentSet = document.getElementById("current-set");
const elSetIndicator = document.getElementById("set-indicator");
const elPlayersInput = document.getElementById("players-input");
const elPlayersContainer = document.getElementById("players-container");
const elEventsLog = document.getElementById("events-log");
const elBtnApplyPlayers = document.getElementById("btn-apply-players");
const elBtnExportCsv = document.getElementById("btn-export-csv");
const elBtnResetMatch = document.getElementById("btn-reset-match");
const elBtnSaveInfo = document.getElementById("btn-save-info");
const elBtnUndo = document.getElementById("btn-undo");
const elAggTableBody = document.getElementById("agg-table-body");
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    state = Object.assign(state, parsed);
  } catch (e) {
    console.error("Error loading state", e);
  }
}
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Error saving state", e);
  }
}
function initStats() {
  state.stats = {};
  state.players.forEach((_, idx) => {
    state.stats[idx] = {};
    SKILLS.forEach(skill => {
      state.stats[idx][skill.id] = {
        "#": 0,
        "+": 0,
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
  elSetIndicator.textContent = "Set " + state.currentSet;
}
function saveMatchInfoFromUI() {
  state.match.opponent = elOpponent.value.trim();
  state.match.category = elCategory.value.trim();
  state.match.date = elDate.value;
  state.match.notes = elNotes.value.trim();
  state.currentSet = parseInt(elCurrentSet.value, 10) || 1;
  elSetIndicator.textContent = "Set " + state.currentSet;
  saveState();
}
function applyPlayersFromStateToTextarea() {
  elPlayersInput.value = state.players.join("\n");
}
function applyPlayersFromTextarea() {
  const lines = elPlayersInput.value
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);
  state.players = lines;
  state.events = [];
  initStats();
  saveState();
  renderPlayers();
  renderEventsLog();
}
function renderPlayers() {
  elPlayersContainer.innerHTML = "";
  if (!state.players || state.players.length === 0) return;
  state.players.forEach((name, idx) => {
    const card = document.createElement("div");
    card.className = "player-card";
    const title = document.createElement("div");
    title.className = "player-name";
    title.textContent = name;
    card.appendChild(title);
    SKILLS.forEach(skill => {
      const row = document.createElement("div");
      row.className = "skill-row";
      row.dataset.playerIdx = String(idx);
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
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "small event-btn";
        btn.textContent = code;
        btn.title = RESULT_LABELS[code] || "";
        btn.dataset.playerIdx = String(idx);
        btn.dataset.skillId = skill.id;
        btn.dataset.code = code;
        buttons.appendChild(btn);
      });
      row.appendChild(buttons);
      const statsDiv = document.createElement("div");
      statsDiv.className = "skill-stats";
      statsDiv.textContent = "Tot: 0";
      row.appendChild(statsDiv);
      card.appendChild(row);
    });
    elPlayersContainer.appendChild(card);
  });
  recalcAllStatsAndUpdateUI();
}
function handleEventClick(playerIdxStr, skillId, code) {
  const playerIdx = parseInt(playerIdxStr, 10);
  if (isNaN(playerIdx) || !state.players[playerIdx]) return;
  const now = new Date();
  const timeStr = now.toISOString();
  const event = {
    t: timeStr,
    set: state.currentSet,
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
    state.stats[playerIdx][skillId] = { "#": 0, "+": 0, "-": 0, "=": 0, "/": 0 };
  }
  state.stats[playerIdx][skillId][code] =
    (state.stats[playerIdx][skillId][code] || 0) + 1;
  saveState();
  updateSkillStatsUI(playerIdx, skillId);
  renderEventsLog();
}
function computeMetrics(counts, skillId) {
  const total =
    (counts["#"] || 0) +
    (counts["+"] || 0) +
    (counts["-"] || 0) +
    (counts["="] || 0) +
    (counts["/"] || 0);
  if (!total) {
    return { total: 0, pos: null, eff: null, prf: null };
  }
  let pos = null;
  let eff = null;
  let prf = null;
  const sharp = counts["#"] || 0;
  const plus = counts["+"] || 0;
  const minus = counts["-"] || 0;
  if (skillId === "pass" || skillId === "second") {
    prf = (sharp / total) * 100;
    pos = ((sharp + plus) / total) * 100;
  } else {
    pos = ((sharp + plus) / total) * 100;
    eff = ((sharp - minus) / total) * 100;
  }
  return { total, pos, eff, prf };
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
    td.colSpan = 11;
    td.textContent = "Aggiungi giocatrici per vedere il riepilogo.";
    tr.appendChild(td);
    elAggTableBody.appendChild(tr);
    return;
  }
  state.players.forEach((name, idx) => {
    SKILLS.forEach(skill => {
      const counts =
        (state.stats[idx] && state.stats[idx][skill.id]) || {
          "#": 0,
          "+": 0,
          "-": 0,
          "=": 0,
          "/": 0
        };
      const metrics = computeMetrics(counts, skill.id);
      const tr = document.createElement("tr");
      const values = [
        name,
        skill.label,
        counts["#"] + counts["+"] + counts["-"] + counts["="] + counts["/"],
        counts["#"],
        counts["+"],
        counts["-"],
        counts["="],
        counts["/"],
        metrics.pos === null ? "-" : formatPercent(metrics.pos),
        metrics.eff === null ? "-" : formatPercent(metrics.eff),
        metrics.prf === null ? "-" : formatPercent(metrics.prf)
      ];
      values.forEach(text => {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      });
      elAggTableBody.appendChild(tr);
    });
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
  initStats();
  saveState();
  recalcAllStatsAndUpdateUI();
  renderEventsLog();
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
function init() {
  loadState();
  applyMatchInfoToUI();
  applyPlayersFromStateToTextarea();
  if (!state.players || state.players.length === 0) {
    elPlayersInput.value = "Piccardi\nCimmino\nBilamour";
    applyPlayersFromTextarea();
  } else {
    if (!state.stats || Object.keys(state.stats).length === 0) {
      initStats();
      recalcAllStatsAndUpdateUI();
    }
    renderPlayers();
    renderEventsLog();
  }
  elCurrentSet.addEventListener("change", () => {
    state.currentSet = parseInt(elCurrentSet.value, 10) || 1;
    elSetIndicator.textContent = "Set " + state.currentSet;
    saveState();
  });
  elBtnSaveInfo.addEventListener("click", () => {
    saveMatchInfoFromUI();
    alert("Info partita salvate.");
  });
  elBtnApplyPlayers.addEventListener("click", () => {
    if (state.events.length > 0) {
      const ok = confirm(
        "Cambiare l'elenco di giocatrici azzererà tutte le statistiche del match. Procedere?"
      );
      if (!ok) return;
    }
    applyPlayersFromTextarea();
  });
  elPlayersContainer.addEventListener("click", e => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("event-btn")) return;
    const playerIdx = target.dataset.playerIdx;
    const skillId = target.dataset.skillId;
    const code = target.dataset.code;
    handleEventClick(playerIdx, skillId, code);
  });
  elBtnExportCsv.addEventListener("click", exportCsv);
  elBtnResetMatch.addEventListener("click", resetMatch);
  elBtnUndo.addEventListener("click", undoLastEvent);
  registerServiceWorker();
}
document.addEventListener("DOMContentLoaded", init);
