const STORAGE_KEY = "volleyScoutV1";
const SKILLS = [
  { id: "serve", label: "Battuta", badgeClass: "badge-serve" },
  { id: "pass", label: "Ricezione", badgeClass: "badge-pass" },
  { id: "attack", label: "Attacco", badgeClass: "badge-attack" },
  { id: "defense", label: "Difesa", badgeClass: "badge-defense" },
  { id: "block", label: "Muro", badgeClass: "badge-block" },
  { id: "second", label: "Alzata", badgeClass: "badge-second" }
];
const SKILL_COLORS = {
  serve: { bg: "#1b5e20", text: "#d1fae5", soft: "rgba(27, 94, 32, 0.18)" },
  pass: { bg: "#f9a825", text: "#ffffff", soft: "rgba(249, 168, 37, 0.18)" },
  attack: { bg: "#b71c1c", text: "#ffe4e6", soft: "rgba(183, 28, 28, 0.18)" },
  defense: { bg: "#546e7a", text: "#e2e8f0", soft: "rgba(84, 110, 122, 0.18)" },
  block: { bg: "#4a148c", text: "#ede9fe", soft: "rgba(74, 20, 140, 0.18)" },
  second: { bg: "#00838f", text: "#ccfbf1", soft: "rgba(0, 131, 143, 0.18)" }
};
const THEME_TEXT = {
  dark: "#ffffff",
  light: "#0f172a"
};
const RESULT_CODES = ["#", "+", "!", "-", "=", "/"];
const POINT_RULE_DEFAULTS = {
  serve: { for: ["#"], against: ["="] },
  pass: { for: [], against: ["="] },
  defense: { for: [], against: ["="] },
  attack: { for: ["#"], against: ["=", "/"] },
  block: { for: ["#"], against: ["/", "="] },
  second: { for: [], against: ["="] },
  manual: { for: ["for"], against: ["against", "error"] }
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
const MATCH_STORE_NAME = "Matches";
const MATCH_PREFIX = PERSISTENT_DB_NAME + "/" + MATCH_STORE_NAME + "/";
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
  theme: "dark",
  currentSet: 1,
  players: [],
  isServing: false,
  autoRolePositioning: false,
  captains: [],
  playerNumbers: {},
  events: [],
  stats: {},
  court: [{ main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }],
  rotation: 1,
  liberos: [],
  savedTeams: {},
  savedMatches: {},
  selectedTeam: "",
  selectedMatch: "",
  metricsConfig: {},
  pointRules: {},
  autoRotate: true,
  autoRotatePending: false,
  predictiveSkillFlow: false,
  autoRoleP1American: false,
  freeballPending: false,
  matchFinished: false,
  skillClock: { paused: false, pausedAtMs: null, pausedAccumMs: 0, lastEffectiveMs: null },
  scoreOverrides: {},
  autoRoleBaseCourt: [],
  video: {
    offsetSeconds: 0,
    fileName: "",
    youtubeId: "",
    youtubeUrl: ""
  }
};
function canUseShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}
function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = err => reject(err);
    reader.readAsDataURL(blob);
  });
}
async function shareBlob(title, blob, fileName) {
  const file = new File([blob], fileName || "export.bin", { type: blob.type || "application/octet-stream" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title, files: [file] });
      return true;
    } catch (_) {
      // fallthrough to data URL share
    }
  }
  if (!canUseShare()) return false;
  try {
    const dataUrl = await blobToDataUrl(blob);
    await navigator.share({ title, url: dataUrl, text: fileName || "" });
    return true;
  } catch (_) {
    return false;
  }
}
async function shareText(title, text) {
  if (!canUseShare()) return false;
  try {
    await navigator.share({ title, text });
    return true;
  } catch (_) {
    return false;
  }
}
function logError(context, err) {
  console.error(context, err);
}
const elOpponent = document.getElementById("match-opponent");
const elCategory = document.getElementById("match-category");
const elDate = document.getElementById("match-date");
const elLeg = document.getElementById("match-leg");
const elMatchType = document.getElementById("match-type");
const elCurrentSet = document.getElementById("current-set");
const elCurrentSetFloating = document.getElementById("current-set-floating");
const elCurrentSetDisplay = document.getElementById("current-set-display");
const elCurrentSetFloatingDisplay = document.getElementById("current-set-floating-display");
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
const elSkillModalBackdrop = document.querySelector("#skill-modal .skill-modal__backdrop");
const elSkillModalBody = document.getElementById("skill-modal-body");
const elSkillModalTitle = document.getElementById("skill-modal-title");
const elSkillModalClose = document.getElementById("skill-modal-close");
const elErrorModal = document.getElementById("error-modal");
const elErrorModalBody = document.getElementById("error-modal-body");
const elErrorModalClose = document.getElementById("error-modal-close");
const elErrorModalBackdrop = document.querySelector("#error-modal .skill-modal__backdrop");
const elVideoFileInput = document.getElementById("video-file-input");
const elAnalysisVideo = document.getElementById("analysis-video");
const elVideoSkillsContainer = document.getElementById("video-skills-container");
const elVideoFileLabel = document.getElementById("video-file-label");
const elVideoSyncLabel = document.getElementById("video-sync-label");
const elBtnSyncFirstSkill = document.getElementById("btn-sync-first-skill");
const elBtnCopyFfmpeg = document.getElementById("btn-copy-ffmpeg");
const elYoutubeUrlInput = document.getElementById("youtube-url-input");
const elBtnLoadYoutube = document.getElementById("btn-load-youtube");
const elYoutubeFrame = document.getElementById("youtube-frame");
const elSecondDistribution = document.getElementById("second-distribution");
const elThemeToggleDark = document.getElementById("theme-dark");
const elThemeToggleLight = document.getElementById("theme-light");
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

function applySkillThemeVars() {
  const root = document.documentElement;
  Object.entries(SKILL_COLORS).forEach(([id, colors]) => {
    root.style.setProperty(`--skill-${id}-bg`, colors.bg);
    root.style.setProperty(`--skill-${id}-text`, colors.text);
    root.style.setProperty(`--skill-${id}-soft`, colors.soft || colors.bg);
  });
}
applySkillThemeVars();
