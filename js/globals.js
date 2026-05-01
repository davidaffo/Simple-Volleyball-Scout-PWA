const STORAGE_KEY = "volleyScoutV1";
const SKILLS = [
  { id: "serve", label: "Battuta", badgeClass: "badge-serve" },
  { id: "pass", label: "Ricezione", badgeClass: "badge-pass" },
  { id: "freeball", label: "Freeball", badgeClass: "badge-freeball" },
  { id: "second", label: "Alzata", badgeClass: "badge-second" },
  { id: "attack", label: "Attacco", badgeClass: "badge-attack" },
  { id: "defense", label: "Difesa", badgeClass: "badge-defense" },
  { id: "block", label: "Muro", badgeClass: "badge-block" }
];
const SKILL_COLORS = {
  serve: { bg: "#1b5e20", text: "#d1fae5", soft: "rgba(27, 94, 32, 0.18)" },
  pass: { bg: "#f9a825", text: "#ffffff", soft: "rgba(249, 168, 37, 0.18)" },
  freeball: { bg: "#c026d3", text: "#fdf4ff", soft: "rgba(192, 38, 211, 0.18)" },
  second: { bg: "#00838f", text: "#ccfbf1", soft: "rgba(0, 131, 143, 0.18)" },
  attack: { bg: "#b71c1c", text: "#ffe4e6", soft: "rgba(183, 28, 28, 0.18)" },
  defense: { bg: "#546e7a", text: "#e2e8f0", soft: "rgba(84, 110, 122, 0.18)" },
  block: { bg: "#4a148c", text: "#ede9fe", soft: "rgba(74, 20, 140, 0.18)" }
};
const THEME_TEXT = {
  dark: "#ffffff",
  light: "#0f172a"
};
const RESULT_CODES = ["#", "+", "!", "-", "=", "/"];
const PASS_LIKE_POINT_RULE_DEFAULT = { for: [], against: ["="] };
const PASS_LIKE_METRIC_DEFAULT = {
  positive: ["#", "+"],
  negative: ["/", "="],
  activeCodes: RESULT_CODES,
  enabled: true
};
const POINT_RULE_DEFAULTS = {
  serve: { for: ["#"], against: ["="] },
  pass: PASS_LIKE_POINT_RULE_DEFAULT,
  freeball: PASS_LIKE_POINT_RULE_DEFAULT,
  defense: { for: [], against: ["=", "/"] },
  attack: { for: ["#"], against: ["=", "/"] },
  block: { for: ["#"], against: ["/", "="] },
  second: { for: [], against: ["=", "/"] },
  manual: { for: ["for"], against: ["against", "error"] }
};
const METRIC_DEFAULTS = {
  serve: { positive: ["#", "+", "!", "/"], negative: ["="], activeCodes: RESULT_CODES, enabled: true },
  pass: PASS_LIKE_METRIC_DEFAULT,
  freeball: PASS_LIKE_METRIC_DEFAULT,
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
  selectedTeam: "",
  selectedOpponentTeam: "",
  selectedMatch: "",
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
    freeball: true,
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
  videoFilterPresets: [],
  uiPlayerAnalysis: {
    playerIdx: null,
    showAttack: true,
    showServe: true,
    showSecond: false
  },
  uiVideoLayout: {
    analysisHeight: 320,
    scoutHeight: 320
  },
  uiVideoAnalysisSort: {
    key: "",
    dir: ""
  },
  uiTopBarHidden: false
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
function pickImageFile(accept = "image/*") {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener(
      "change",
      () => {
        resolve((input.files && input.files[0]) || null);
      },
      { once: true }
    );
    input.click();
  });
}
function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = src;
  });
}
const elPlayerPhotoModal = document.getElementById("player-photo-modal");
const elPlayerPhotoStage = document.getElementById("player-photo-stage");
const elPlayerPhotoImage = document.getElementById("player-photo-image");
const elPlayerPhotoZoom = document.getElementById("player-photo-zoom");
const elPlayerPhotoClose = document.getElementById("player-photo-close");
const elPlayerPhotoCancel = document.getElementById("player-photo-cancel");
const elPlayerPhotoRemove = document.getElementById("player-photo-remove");
const elPlayerPhotoSave = document.getElementById("player-photo-save");
const PLAYER_PHOTO_REMOVE_RESULT = "__REMOVE_PLAYER_PHOTO__";
const PLAYER_PHOTO_EXPORT_SIZE = 320;
const playerPhotoEditorState = {
  resolve: null,
  image: null,
  sourceUrl: "",
  baseScale: 1,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  pointerId: null,
  dragStartX: 0,
  dragStartY: 0,
  dragOriginX: 0,
  dragOriginY: 0,
  allowRemove: false
};
function syncPlayerPhotoBaseScale() {
  if (!playerPhotoEditorState.image || !elPlayerPhotoStage) return;
  const cropSize = Math.max(1, elPlayerPhotoStage.clientWidth || 320);
  playerPhotoEditorState.baseScale = Math.max(
    cropSize / playerPhotoEditorState.image.naturalWidth,
    cropSize / playerPhotoEditorState.image.naturalHeight
  );
}
function setPlayerPhotoModalOpen(isOpen) {
  if (!elPlayerPhotoModal) return;
  elPlayerPhotoModal.classList.toggle("hidden", !isOpen);
}
function clampPlayerPhotoOffsets() {
  if (!playerPhotoEditorState.image || !elPlayerPhotoStage) return;
  const cropSize = Math.max(1, elPlayerPhotoStage.clientWidth || 320);
  const scale = playerPhotoEditorState.baseScale * playerPhotoEditorState.zoom;
  const imgWidth = playerPhotoEditorState.image.naturalWidth * scale;
  const imgHeight = playerPhotoEditorState.image.naturalHeight * scale;
  const maxOffsetX = Math.max(0, (imgWidth - cropSize) / 2);
  const maxOffsetY = Math.max(0, (imgHeight - cropSize) / 2);
  playerPhotoEditorState.offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, playerPhotoEditorState.offsetX));
  playerPhotoEditorState.offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, playerPhotoEditorState.offsetY));
}
function renderPlayerPhotoEditor() {
  if (!elPlayerPhotoImage || !elPlayerPhotoStage || !playerPhotoEditorState.image) return;
  syncPlayerPhotoBaseScale();
  clampPlayerPhotoOffsets();
  const scale = playerPhotoEditorState.baseScale * playerPhotoEditorState.zoom;
  elPlayerPhotoImage.style.transform =
    `translate(calc(-50% + ${playerPhotoEditorState.offsetX}px), calc(-50% + ${playerPhotoEditorState.offsetY}px)) scale(${scale})`;
}
function closePlayerPhotoEditor(result = null) {
  if (playerPhotoEditorState.sourceUrl && playerPhotoEditorState.sourceUrl.startsWith("blob:")) {
    URL.revokeObjectURL(playerPhotoEditorState.sourceUrl);
  }
  const resolve = playerPhotoEditorState.resolve;
  playerPhotoEditorState.resolve = null;
  playerPhotoEditorState.image = null;
  playerPhotoEditorState.sourceUrl = "";
  playerPhotoEditorState.baseScale = 1;
  playerPhotoEditorState.zoom = 1;
  playerPhotoEditorState.offsetX = 0;
  playerPhotoEditorState.offsetY = 0;
  playerPhotoEditorState.pointerId = null;
  playerPhotoEditorState.allowRemove = false;
  if (elPlayerPhotoRemove) {
    elPlayerPhotoRemove.classList.add("hidden");
  }
  if (elPlayerPhotoImage) {
    elPlayerPhotoImage.removeAttribute("src");
    elPlayerPhotoImage.style.transform = "";
  }
  setPlayerPhotoModalOpen(false);
  if (typeof resolve === "function") {
    resolve(result);
  }
}
function exportPlayerPhotoDataUrl(options = {}) {
  if (!playerPhotoEditorState.image || !elPlayerPhotoStage) {
    throw new Error("player-photo-not-ready");
  }
  const size = Number(options.size) > 0 ? Number(options.size) : PLAYER_PHOTO_EXPORT_SIZE;
  const quality = Number(options.quality) > 0 ? Math.min(0.9, Number(options.quality)) : 0.72;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  const cropSize = Math.max(1, elPlayerPhotoStage.clientWidth || 320);
  const img = playerPhotoEditorState.image;
  const scale = playerPhotoEditorState.baseScale * playerPhotoEditorState.zoom;
  const displayWidth = img.naturalWidth * scale;
  const displayHeight = img.naturalHeight * scale;
  const left = cropSize / 2 - displayWidth / 2 + playerPhotoEditorState.offsetX;
  const top = cropSize / 2 - displayHeight / 2 + playerPhotoEditorState.offsetY;
  const sourceX = Math.max(0, (-left / displayWidth) * img.naturalWidth);
  const sourceY = Math.max(0, (-top / displayHeight) * img.naturalHeight);
  const sourceW = Math.min(img.naturalWidth, (cropSize / displayWidth) * img.naturalWidth);
  const sourceH = Math.min(img.naturalHeight, (cropSize / displayHeight) * img.naturalHeight);
  ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", quality);
}
async function openPlayerPhotoEditor(sourceUrl, options = {}) {
  if (!sourceUrl) return null;
  if (!elPlayerPhotoModal || !elPlayerPhotoStage || !elPlayerPhotoImage || !elPlayerPhotoZoom) {
    throw new Error("player-photo-modal-missing");
  }
  const img = await loadImageElement(sourceUrl);
  playerPhotoEditorState.image = img;
  playerPhotoEditorState.sourceUrl = sourceUrl;
  playerPhotoEditorState.baseScale = 1;
  playerPhotoEditorState.zoom = 1;
  playerPhotoEditorState.offsetX = 0;
  playerPhotoEditorState.offsetY = 0;
  playerPhotoEditorState.allowRemove = !!options.allowRemove;
  if (elPlayerPhotoRemove) {
    elPlayerPhotoRemove.classList.toggle("hidden", !playerPhotoEditorState.allowRemove);
  }
  elPlayerPhotoImage.src = sourceUrl;
  elPlayerPhotoZoom.min = "1";
  elPlayerPhotoZoom.max = options.maxZoom ? String(options.maxZoom) : "3";
  elPlayerPhotoZoom.step = "0.01";
  elPlayerPhotoZoom.value = "1";
  setPlayerPhotoModalOpen(true);
  requestAnimationFrame(() => renderPlayerPhotoEditor());
  return new Promise(resolve => {
    playerPhotoEditorState.resolve = resolve;
  });
}
async function preparePlayerPhotoDataUrl(file, options = {}) {
  if (!file) return "";
  const type = String(file.type || "").toLowerCase();
  if (!type.startsWith("image/")) {
    throw new Error("invalid-image");
  }
  const sourceUrl = URL.createObjectURL(file);
  const edited = await openPlayerPhotoEditor(sourceUrl, options);
  return edited || "";
}
function handlePlayerPhotoPointerDown(ev) {
  if (!playerPhotoEditorState.image || !elPlayerPhotoStage || !(ev.target instanceof HTMLElement)) return;
  playerPhotoEditorState.pointerId = ev.pointerId;
  playerPhotoEditorState.dragStartX = ev.clientX;
  playerPhotoEditorState.dragStartY = ev.clientY;
  playerPhotoEditorState.dragOriginX = playerPhotoEditorState.offsetX;
  playerPhotoEditorState.dragOriginY = playerPhotoEditorState.offsetY;
  elPlayerPhotoStage.classList.add("dragging");
  if (elPlayerPhotoStage.setPointerCapture) {
    elPlayerPhotoStage.setPointerCapture(ev.pointerId);
  }
  ev.preventDefault();
}
function handlePlayerPhotoPointerMove(ev) {
  if (playerPhotoEditorState.pointerId !== ev.pointerId) return;
  playerPhotoEditorState.offsetX = playerPhotoEditorState.dragOriginX + (ev.clientX - playerPhotoEditorState.dragStartX);
  playerPhotoEditorState.offsetY = playerPhotoEditorState.dragOriginY + (ev.clientY - playerPhotoEditorState.dragStartY);
  renderPlayerPhotoEditor();
}
function handlePlayerPhotoPointerUp(ev) {
  if (playerPhotoEditorState.pointerId !== ev.pointerId) return;
  playerPhotoEditorState.pointerId = null;
  if (elPlayerPhotoStage && elPlayerPhotoStage.releasePointerCapture) {
    try {
      elPlayerPhotoStage.releasePointerCapture(ev.pointerId);
    } catch (_) {}
  }
  if (elPlayerPhotoStage) {
    elPlayerPhotoStage.classList.remove("dragging");
  }
}
window.addEventListener("resize", () => {
  if (elPlayerPhotoModal && !elPlayerPhotoModal.classList.contains("hidden")) {
    renderPlayerPhotoEditor();
  }
});
if (elPlayerPhotoStage && !elPlayerPhotoStage._playerPhotoBound) {
  elPlayerPhotoStage.addEventListener("pointerdown", handlePlayerPhotoPointerDown);
  elPlayerPhotoStage.addEventListener("pointermove", handlePlayerPhotoPointerMove);
  elPlayerPhotoStage.addEventListener("pointerup", handlePlayerPhotoPointerUp);
  elPlayerPhotoStage.addEventListener("pointercancel", handlePlayerPhotoPointerUp);
  elPlayerPhotoStage._playerPhotoBound = true;
}
if (elPlayerPhotoZoom && !elPlayerPhotoZoom._playerPhotoBound) {
  elPlayerPhotoZoom.addEventListener("input", () => {
    const nextZoom = parseFloat(elPlayerPhotoZoom.value);
    playerPhotoEditorState.zoom = Number.isFinite(nextZoom) ? Math.max(1, nextZoom) : 1;
    renderPlayerPhotoEditor();
  });
  elPlayerPhotoZoom._playerPhotoBound = true;
}
if (elPlayerPhotoClose && !elPlayerPhotoClose._playerPhotoBound) {
  elPlayerPhotoClose.addEventListener("click", () => closePlayerPhotoEditor(null));
  elPlayerPhotoClose._playerPhotoBound = true;
}
if (elPlayerPhotoCancel && !elPlayerPhotoCancel._playerPhotoBound) {
  elPlayerPhotoCancel.addEventListener("click", () => closePlayerPhotoEditor(null));
  elPlayerPhotoCancel._playerPhotoBound = true;
}
if (elPlayerPhotoRemove && !elPlayerPhotoRemove._playerPhotoBound) {
  elPlayerPhotoRemove.addEventListener("click", () => closePlayerPhotoEditor(PLAYER_PHOTO_REMOVE_RESULT));
  elPlayerPhotoRemove._playerPhotoBound = true;
}
if (elPlayerPhotoSave && !elPlayerPhotoSave._playerPhotoBound) {
  elPlayerPhotoSave.addEventListener("click", () => {
    try {
      closePlayerPhotoEditor(exportPlayerPhotoDataUrl());
    } catch (err) {
      logError("player-photo-export", err);
      closePlayerPhotoEditor(null);
    }
  });
  elPlayerPhotoSave._playerPhotoBound = true;
}
if (elPlayerPhotoModal && !elPlayerPhotoModal._playerPhotoBound) {
  elPlayerPhotoModal.addEventListener("click", ev => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.closePlayerPhoto !== undefined || target === elPlayerPhotoModal) {
      closePlayerPhotoEditor(null);
    }
  });
  elPlayerPhotoModal._playerPhotoBound = true;
}
window.pickImageFile = pickImageFile;
window.preparePlayerPhotoDataUrl = preparePlayerPhotoDataUrl;
window.openPlayerPhotoEditor = openPlayerPhotoEditor;
window.PLAYER_PHOTO_REMOVE_RESULT = PLAYER_PHOTO_REMOVE_RESULT;
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
const elAnalysisSkillChartMetric = document.getElementById("analysis-skill-chart-metric");
const elAnalysisSkillChartGrid = document.getElementById("analysis-skill-chart-grid");
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
const elVideoScoutControls = document.getElementById("video-scout-controls");
const elVideoAnalysisSection = document.getElementById("video-analysis-section");
const elVideoAnalysisHost = document.getElementById("video-analysis-host");
const elVideoFileInputScout = document.getElementById("video-file-input-scout");
const elAnalysisVideoScout = document.getElementById("analysis-video-scout");
const elYoutubeUrlInputScout = document.getElementById("youtube-url-input-scout");
const elBtnLoadYoutubeScout = document.getElementById("btn-load-youtube-scout");
const elYoutubeFrameScout = document.getElementById("youtube-frame-scout");
const elSecondDistribution = document.getElementById("second-distribution");
const elTrajectoryAttackSummary = document.getElementById("trajectory-attack-summary");
const elPlayerAttackSummary = document.getElementById("player-attack-summary");
const elTrajFilterAttackTypes = document.getElementById("traj-filter-attack-types");
const elPlayerTrajFilterAttackTypes = document.getElementById("player-traj-filter-attack-types");
const elPlayerAnalysisCompareEnabled = document.getElementById("player-analysis-compare-enabled");
const elPlayerAnalysisCompareFilter = document.getElementById("player-analysis-compare-filter");
const elPlayerAnalysisCompareSelect = document.getElementById("player-analysis-compare-select");
const elPlayerAnalysisTableWrap = document.getElementById("player-analysis-table-wrap");
const elPlayerAnalysisCompareView = document.getElementById("player-analysis-compare-view");
const elPlayerAnalysisChartMetric = document.getElementById("player-analysis-chart-metric");
const elPlayerAnalysisSkillChartGrid = document.getElementById("player-analysis-skill-chart-grid");
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
