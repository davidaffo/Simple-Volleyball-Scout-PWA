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
const TEMPLATE_TEAM = {
  players: [
    "Palleggiatore 1",
    "Palleggiatore 2",
    "Schiacciatore 1",
    "Schiacciatore 2",
    "Schiacciatore 3",
    "Schiacciatore 4",
    "Opposto 1",
    "Opposto 2",
    "Centrale 1",
    "Centrale 2",
    "Centrale 3",
    "Centrale 4",
    "Libero 1",
    "Libero 2"
  ],
  liberos: ["Libero 1", "Libero 2"]
};
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
const elCurrentSetFloating = document.getElementById("current-set-floating");
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
const elRotationIndicatorFloating = document.getElementById("rotation-indicator-floating");
const elRotationIndicatorModal = document.getElementById("rotation-indicator-modal");
const elRotationSelectFloating = document.getElementById("rotation-select-floating");
const elBtnRotateCw = document.getElementById("btn-rotate-cw");
const elBtnRotateCcw = document.getElementById("btn-rotate-ccw");
const elBtnRotateCwFloating = document.getElementById("btn-rotate-cw-floating");
const elBtnRotateCcwFloating = document.getElementById("btn-rotate-ccw-floating");
const elBtnRotateCwModal = document.getElementById("btn-rotate-cw-modal");
const elBtnRotateCcwModal = document.getElementById("btn-rotate-ccw-modal");
const elLiberoTags = document.getElementById("libero-tags");
const elLiberoTagsInline = document.getElementById("libero-tags-inline");
const elSkillModal = document.getElementById("skill-modal");
const elSkillModalBackdrop = document.querySelector(".skill-modal__backdrop");
const elSkillModalBody = document.getElementById("skill-modal-body");
const elSkillModalTitle = document.getElementById("skill-modal-title");
const elSkillModalClose = document.getElementById("skill-modal-close");
let modalMode = "skill";
let modalSubPosIdx = -1;
let mobileLineupOrder = [];
const MINI_SLOT_ORDER = [3, 2, 1, 4, 5, 0]; // visual order matches court grid (top: pos4,pos3,pos2 / bottom: pos5,pos6,pos1)
let touchDragName = "";
let touchDragFromSlot = -1;
let touchDragFromList = false;
let touchDragOverSlot = -1;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let touchGhost = null;
