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
  pass: { for: [], against: ["=", "/"] },
  defense: { for: [], against: ["=", "/"] },
  attack: { for: ["#"], against: ["=", "/"] },
  block: { for: ["#"], against: ["/", "="] },
  second: { for: [], against: ["=", "/"] },
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
const OPPONENT_TEAM_STORE_NAME = "OpponentTeams";
const OPPONENT_TEAM_PREFIX = PERSISTENT_DB_NAME + "/" + OPPONENT_TEAM_STORE_NAME + "/";
const PLAYER_STORE_NAME = "Players";
const PLAYER_PREFIX = PERSISTENT_DB_NAME + "/" + PLAYER_STORE_NAME;
const MATCH_STORE_NAME = "Matches";
const MATCH_PREFIX = PERSISTENT_DB_NAME + "/" + MATCH_STORE_NAME + "/";
const TRAINING_STORE_NAME = "Trainings";
const TRAINING_PREFIX = PERSISTENT_DB_NAME + "/" + TRAINING_STORE_NAME + "/";
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
  { id: 1, label: "Posizione 1 · P", gridArea: "pos1" },
  { id: 2, label: "Posizione 2 · S1", gridArea: "pos2" },
  { id: 3, label: "Posizione 3 · C2", gridArea: "pos3" },
  { id: 4, label: "Posizione 4 · O", gridArea: "pos4" },
  { id: 5, label: "Posizione 5 · S2", gridArea: "pos5" },
  { id: 6, label: "Posizione 6 · C1", gridArea: "pos6" }
];
let state = {
  sessionType: "match",
  match: {
    opponent: "",
    category: "",
    date: "",
    notes: "",
    leg: "",
    matchType: ""
  },
  training: {
    title: "",
    date: "",
    notes: ""
  },
  trainingCourt: [{ main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }],
  trainingSkillId: "pass",
  trainingBoardPlayers: [],
  trainingBoardPositions: {},
  uiTrainingTab: "info",
  theme: "dark",
  currentSet: 1,
  players: [],
  isServing: false,
  autoRolePositioning: true,
  captains: [],
  playerNumbers: {},
  events: [],
  stats: {},
  court: [{ main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }],
  rotation: 1,
  liberos: [],
  liberoAutoMap: {},
  autoLiberoRole: "",
  preferredLibero: "",
  playersDb: {},
  savedTeams: {},
  savedOpponentTeams: {},
  savedMatches: {},
  savedTrainings: {},
  selectedTeam: "",
  selectedOpponentTeam: "",
  selectedMatch: "",
  selectedTraining: "",
  opponentPlayers: [],
  opponentPlayerNumbers: {},
  opponentLiberos: [],
  opponentCaptains: [],
  opponentCourt: [],
  opponentRotation: 1,
  opponentCourtViewMirrored: false,
  opponentAutoRoleP1American: false,
  opponentAttackTrajectoryEnabled: true,
  opponentServeTrajectoryEnabled: true,
  opponentSetTypePromptEnabled: true,
  opponentAutoLiberoBackline: true,
  opponentAutoLiberoRole: "",
  opponentLiberoAutoMap: {},
  opponentPreferredLibero: "",
  opponentSkillFlowOverride: null,
  opponentStats: {},
  showServeTrajectoryLogOur: true,
  showServeTrajectoryLogOpp: true,
  metricsConfig: {},
  pointRules: {},
  autoRotate: true,
  autoRotatePending: false,
  opponentAutoRotatePending: false,
  autoLiberoBackline: true,
  predictiveSkillFlow: true,
  autoRoleP1American: false,
  attackTrajectoryEnabled: true,
  attackTrajectorySimplified: true,
  serveTrajectoryEnabled: true,
  videoScoutMode: false,
  useOpponentTeam: false,
  opponentSkillConfig: {
    serve: true,
    pass: true,
    attack: true,
    defense: true,
    block: true,
    second: true
  },
  videoPlayByPlay: false,
  defaultSetType: "",
  setTypePromptEnabled: true,
  nextSetType: "",
  freeballPending: false,
  freeballPendingScope: "our",
  flowTeamScope: "our",
  forceSkillActive: false,
  forceSkillScope: null,
  pendingServe: null,
  matchFinished: false,
  forceMobileLayout: false,
  courtViewMirrored: false,
  courtSideSwapped: false,
  skillClock: { paused: false, pausedAtMs: null, pausedAccumMs: 0, lastEffectiveMs: null },
  scoreOverrides: {},
  autoRoleBaseCourt: [],
  video: {
    offsetSeconds: 0,
    fileName: "",
    youtubeId: "",
    youtubeUrl: "",
    lastPlaybackSeconds: 0
  },
  uiPlayerAnalysis: {
    playerIdx: null,
    showAttack: true,
    showServe: true,
    showSecond: false
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
const elCurrentSetDisplay = document.getElementById("current-set-display");
const elPlayersInput = document.getElementById("players-input");
const elPlayersContainer = document.getElementById("players-container");
const elPlayersList = document.getElementById("players-list");
const elNewPlayerInput = document.getElementById("new-player-name");
const elBtnAddPlayer = document.getElementById("btn-add-player");
const elBtnClearPlayers = document.getElementById("btn-clear-players");
const elBtnOpenLineup = document.getElementById("btn-open-lineup");
const elTeamsSelect = document.getElementById("saved-teams");
const elBtnSaveTeam = document.getElementById("btn-save-team");
const elBtnDeleteTeam = document.getElementById("btn-delete-team");
const elBtnDuplicateTeam = document.getElementById("btn-duplicate-team");
const elBtnExportTeam = document.getElementById("btn-export-team");
const elBtnImportTeam = document.getElementById("btn-import-team");
const elTeamFileInput = document.getElementById("team-file-input");
const elLineupChips = document.getElementById("lineup-chips");
const elBenchChips = document.getElementById("bench-chips");
const elRotationIndicator = document.getElementById("rotation-indicator");
const elRotationSelect = document.getElementById("rotation-select");
const elRotationSelectOpp = document.getElementById("rotation-select-opp");
const elBtnRotateCw = document.getElementById("btn-rotate-cw");
const elBtnRotateCcw = document.getElementById("btn-rotate-ccw");
const elBtnRotateCwOpp = document.getElementById("btn-rotate-cw-opp");
const elBtnRotateCcwOpp = document.getElementById("btn-rotate-ccw-opp");
const elBtnRotateCwModal = document.getElementById("btn-rotate-cw-modal");
const elBtnRotateCcwModal = document.getElementById("btn-rotate-ccw-modal");
const elLiberoTags = document.getElementById("libero-tags");
const elLiberoTagsInline = document.getElementById("libero-tags-inline");
const elLiberoTagsInlineOpp = document.getElementById("libero-tags-inline-opp");
const elSkillModal = document.getElementById("skill-modal");
const elSkillModalBackdrop = document.querySelector("#skill-modal .skill-modal__backdrop");
const elSkillModalBody = document.getElementById("skill-modal-body");
const elSkillModalTitle = document.getElementById("skill-modal-title");
const elSkillModalCancel = document.getElementById("skill-modal-cancel");
const elSkillModalClose = document.getElementById("skill-modal-close");
const elAggSkillModal = document.getElementById("agg-skill-modal");
const elAggSkillModalBackdrop = document.querySelector("#agg-skill-modal .skill-modal__backdrop");
const elAggSkillModalBody = document.getElementById("agg-skill-modal-body");
const elAggSkillModalTitle = document.getElementById("agg-skill-modal-title");
const elAggSkillModalClose = document.getElementById("agg-skill-modal-close");
const elBulkEditModal = document.getElementById("bulk-edit-modal");
const elBulkEditBody = document.getElementById("bulk-edit-body");
const elBulkEditTitle = document.getElementById("bulk-edit-title");
const elBulkEditHint = document.getElementById("bulk-edit-hint");
const elBulkEditClose = document.getElementById("bulk-edit-close");
const elBulkEditCancel = document.getElementById("bulk-edit-cancel");
const elBulkEditApply = document.getElementById("bulk-edit-apply");
const elBulkEditBackdrop = document.querySelector("#bulk-edit-modal .skill-modal__backdrop");
const elErrorModal = document.getElementById("error-modal");
const elErrorModalBody = document.getElementById("error-modal-body");
const elErrorModalClose = document.getElementById("error-modal-close");
const elErrorModalBackdrop = document.querySelector("#error-modal .skill-modal__backdrop");
const elPointModal = document.getElementById("point-modal");
const elPointModalBody = document.getElementById("point-modal-body");
const elPointModalClose = document.getElementById("point-modal-close");
const elPointModalBackdrop = document.querySelector("#point-modal .skill-modal__backdrop");
const elVideoFileInput = document.getElementById("video-file-input");
const elAnalysisVideo = document.getElementById("analysis-video");
const elVideoSkillsContainer = document.getElementById("video-skills-container");
const elVideoFileLabel = document.getElementById("video-file-label");
const elVideoSyncLabel = document.getElementById("video-sync-label");
const elBtnSyncFirstSkill = document.getElementById("btn-sync-first-skill");
const elBtnCopyFfmpeg = document.getElementById("btn-copy-ffmpeg");
const elBtnVideoFramePrev = document.getElementById("btn-video-frame-prev");
const elBtnVideoFrameNext = document.getElementById("btn-video-frame-next");
const elVideoSelectionCount = document.getElementById("video-selection-count");
const elVideoPlayByPlayToggle = document.getElementById("video-playbyplay-toggle");
const elBtnClearVideo = document.getElementById("btn-clear-video");
const elYoutubeUrlInput = document.getElementById("youtube-url-input");
const elBtnLoadYoutube = document.getElementById("btn-load-youtube");
const elYoutubeFrame = document.getElementById("youtube-frame");
const elVideoScoutToggle = document.getElementById("video-scout-toggle");
const elVideoScoutContainer = document.getElementById("video-scout-container");
const elVideoAnalysisSection = document.getElementById("video-analysis-section");
const elVideoAnalysisHost = document.getElementById("video-analysis-host");
const elVideoFileInputScout = document.getElementById("video-file-input-scout");
const elAnalysisVideoScout = document.getElementById("analysis-video-scout");
const elYoutubeUrlInputScout = document.getElementById("youtube-url-input-scout");
const elBtnLoadYoutubeScout = document.getElementById("btn-load-youtube-scout");
const elYoutubeFrameScout = document.getElementById("youtube-frame-scout");
const elSecondDistribution = document.getElementById("second-distribution");
const elThemeToggleDark = document.getElementById("theme-dark");
const elThemeToggleLight = document.getElementById("theme-light");
let modalMode = "skill";
let modalSubPosIdx = -1;

function applySkillThemeVars() {
  const root = document.documentElement;
  Object.entries(SKILL_COLORS).forEach(([id, colors]) => {
    root.style.setProperty(`--skill-${id}-bg`, colors.bg);
    root.style.setProperty(`--skill-${id}-text`, colors.text);
    root.style.setProperty(`--skill-${id}-soft`, colors.soft || colors.bg);
  });
}
applySkillThemeVars();
