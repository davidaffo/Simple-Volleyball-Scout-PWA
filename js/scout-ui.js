function getEnabledSkills() {
  return SKILLS.filter(skill => {
    const cfg = state.metricsConfig[skill.id];
    return !cfg || cfg.enabled !== false;
  });
}
const selectedSkillPerPlayer = {};
function setSelectedSkill(playerIdx, skillId) {
  if (skillId) {
    selectedSkillPerPlayer[playerIdx] = skillId;
  } else {
    delete selectedSkillPerPlayer[playerIdx];
  }
}
function getSelectedSkill(playerIdx) {
  return selectedSkillPerPlayer.hasOwnProperty(playerIdx) ? selectedSkillPerPlayer[playerIdx] : null;
}
function isAnySelectedSkill(skillId) {
  return Object.values(selectedSkillPerPlayer).some(val => val === skillId);
}
function getPredictedSkillId() {
  if (!state.predictiveSkillFlow) return null;
  const ownEvents = (state.events || []).filter(ev => {
    if (!ev || !ev.skillId) return false;
    if (!ev.team) return true; // current app only tracks our team
    return ev.team !== "opponent"; // future-proof: ignore opponent skills
  });
  const last = ownEvents.slice(-1)[0] || null;
  const possessionServe = !!state.isServing;
  const fallback = possessionServe ? "serve" : "pass";
  if (!last) return fallback;
  const dir = typeof getPointDirection === "function" ? getPointDirection(last) : null;
  if (dir === "for") return "serve";
  if (dir === "against") return "pass";
  switch (last.skillId) {
    case "serve":
      return "defense"; // dopo la nostra battuta ci prepariamo a difesa/muro, non a ricevere
    case "pass":
      return "second";
    case "second":
      return "attack";
    case "attack":
      return "defense";
    case "block":
      return "defense";
    case "defense":
      return "second";
    default:
      return fallback;
  }
}
function updateNextSkillIndicator(skillId) {
  if (!elNextSkillIndicator) return;
  if (!state.predictiveSkillFlow) {
    elNextSkillIndicator.textContent = "Prossima skill: —";
    elNextSkillIndicator.classList.remove("active");
    return;
  }
  const meta = SKILLS.find(s => s.id === skillId);
  const label = meta ? meta.label : skillId || "—";
  elNextSkillIndicator.textContent = "Prossima skill: " + (label || "—");
  elNextSkillIndicator.classList.toggle("active", !!skillId);
}
let videoObjectUrl = "";
let ytPlayer = null;
let ytApiPromise = null;
let ytPlayerReady = false;
let currentYoutubeId = "";
let youtubeFallback = false;
let pendingYoutubeSeek = null;
const elNextSkillIndicator = document.getElementById("next-skill-indicator");
const LOCAL_VIDEO_CACHE = "volley-video-cache";
const LOCAL_VIDEO_REQUEST = "/__local-video__";
function buildReceiveDisplayMapping(court, rotation) {
  const base = ensureCourtShapeFor(court);
  const mapping = base.map((slot, idx) => ({ slot, idx }));
  const swap = (a, b) => {
    const tmp = mapping[a];
    mapping[a] = mapping[b];
    mapping[b] = tmp;
  };
  const rot = Math.min(6, Math.max(1, parseInt(rotation, 10) || 1));
  switch (rot) {
    case 1:
      swap(0, 1);
      break;
    case 2:
      swap(2, 4);
      break;
    case 3: {
      const old4 = mapping[3];
      const old5 = mapping[4];
      const old6 = mapping[5];
      mapping[4] = old4;
      mapping[5] = old5;
      mapping[3] = old6;
      break;
    }
    case 4: {
      const old1 = mapping[0];
      const old2 = mapping[1];
      const old5 = mapping[4];
      const old6 = mapping[5];
      mapping[4] = old2;
      mapping[5] = old5;
      mapping[0] = old6;
      mapping[1] = old1;
      break;
    }
    case 5:
      swap(2, 4);
      break;
    case 6: {
      const old4 = mapping[3];
      const old5 = mapping[4];
      const old6 = mapping[5];
      mapping[4] = old4;
      mapping[5] = old5;
      mapping[3] = old6;
      break;
    }
    default:
      break;
  }
  return mapping;
}
function getAutoRoleDisplayCourt(forSkillId = null) {
  const baseCourt =
    state.autoRolePositioning && autoRoleBaseCourt
      ? ensureCourtShapeFor(autoRoleBaseCourt)
      : ensureCourtShapeFor(state.court);
  if (forSkillId === "pass") {
    return buildReceiveDisplayMapping(baseCourt, state.rotation || 1);
  }
  return ensureCourtShapeFor(baseCourt).map((slot, idx) => ({ slot, idx }));
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
function createNumberInput(ev, field, min, max, onDone) {
  const input = document.createElement("input");
  input.type = "number";
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  input.value = ev[field] === null || ev[field] === undefined ? "" : String(ev[field]);
  input.addEventListener("change", () => {
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
function computeEventDurationMs(prevIso, nowMs) {
  if (!prevIso) return null;
  const prevMs = new Date(prevIso).getTime();
  if (isNaN(prevMs)) return null;
  return Math.max(0, nowMs - prevMs);
}
function buildBaseEventPayload(base) {
  const now = new Date();
  const nowIso = now.toISOString();
  const rotation = state.rotation || 1;
  const zone = typeof base.playerIdx === "number" ? getCurrentZoneForPlayer(base.playerIdx) : null;
  const lastEventTime = state.events && state.events.length > 0 ? state.events[state.events.length - 1].t : null;
  const durationMs = computeEventDurationMs(lastEventTime, now.getTime());
  return {
    eventId: getNextEventId(),
    t: nowIso,
    durationMs: durationMs,
    set: state.currentSet,
    rotation,
    playerIdx: base.playerIdx,
    playerName:
      base.playerName ||
      (typeof base.playerIdx === "number" ? state.players[base.playerIdx] : base.playerName) ||
      null,
    zone,
    skillId: base.skillId,
    code: base.code,
    pointDirection: base.pointDirection || null,
    value: base.value,
    autoRotationDirection: null,
    autoRotateNext: null,
    setterPosition: rotation,
    opponentSetterPosition: null,
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
    attackDirection: null,
    blockNumber: null,
    playerIn: base.playerIn || null,
    playerOut: base.playerOut || null,
    relatedEvents: base.relatedEvents || [],
    teamName: state.selectedTeam || (state.match && state.match.teamName) || null,
    homeScore: null,
    visitorScore: null
  };
}
function renderSkillChoice(playerIdx, playerName) {
  if (!elSkillModalBody) return;
  modalMode = "skill";
  modalSubPosIdx = -1;
  elSkillModalBody.innerHTML = "";
  if (elSkillModalTitle) {
    const title =
      formatNameWithNumber(playerName || state.players[playerIdx]) ||
      (playerName || "Giocatrice");
    elSkillModalTitle.textContent = title + " · scegli fondamentale";
  }
  const enabledSkills = getEnabledSkills();
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
    btn.addEventListener("click", () => renderSkillCodes(playerIdx, playerName, skill.id));
    grid.appendChild(btn);
  });
  elSkillModalBody.appendChild(grid);
  const extraRow = document.createElement("div");
  extraRow.className = "modal-skill-extra";
  const errorBtn = document.createElement("button");
  errorBtn.type = "button";
  errorBtn.className = "small event-btn danger full-width";
  errorBtn.textContent = "Errore/Fallo";
  errorBtn.addEventListener("click", () => {
    addPlayerError(playerIdx, playerName || state.players[playerIdx]);
    closeSkillModal();
  });
  extraRow.appendChild(errorBtn);
  elSkillModalBody.appendChild(extraRow);
}
function renderSkillCodes(playerIdx, playerName, skillId) {
  if (!elSkillModalBody) return;
  modalMode = "skill-codes";
  modalSubPosIdx = -1;
  elSkillModalBody.innerHTML = "";
  const skill = SKILLS.find(s => s.id === skillId);
  const title =
    formatNameWithNumber(playerName || state.players[playerIdx]) ||
    (playerName || "Giocatrice");
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
  backBtn.addEventListener("click", () => renderSkillChoice(playerIdx, playerName));
  header.appendChild(backBtn);
  elSkillModalBody.appendChild(header);

  const codesWrap = document.createElement("div");
  codesWrap.className = "modal-skill-codes";
  const codes = (state.metricsConfig[skillId]?.activeCodes || RESULT_CODES).slice();
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
    btn.dataset.playerName = playerName || state.players[playerIdx];
    btn.dataset.skillId = skillId;
    btn.dataset.code = code;
    btn.addEventListener("click", e => {
      handleEventClick(playerIdx, skillId, code, playerName, e.currentTarget);
      closeSkillModal();
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
    addPlayerError(playerIdx, playerName || state.players[playerIdx]);
    closeSkillModal();
  });
  extraRow.appendChild(errorBtn);
  elSkillModalBody.appendChild(extraRow);
}
function openSkillModal(playerIdx, playerName) {
  if (!elSkillModal || !elSkillModalBody) return;
  const idx = typeof playerIdx === "number" ? playerIdx : parseInt(playerIdx, 10);
  if (isNaN(idx) || !state.players[idx]) return;
  renderSkillChoice(idx, playerName);
  elSkillModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  document.body.classList.add("modal-open");
}
function openSubModal(posIdx) {
  if (!elSkillModal || !elSkillModalBody) return;
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
  document.body.style.overflow = "hidden";
  document.body.classList.add("modal-open");
}
function closeSkillModal() {
  if (!elSkillModal) return;
  elSkillModal.classList.add("hidden");
  document.body.style.overflow = "";
  document.body.classList.remove("modal-open");
}
// esponi per gli handler inline (fallback mobile)
window._closeSkillModal = closeSkillModal;
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
function renderSkillRows(targetEl, playerIdx, activeName, options = {}) {
  if (!targetEl) return;
  const { closeAfterAction = false, nextSkillId = null } = options;
  const getSkillColors = skillId => {
    const fallback = { bg: "#2f2f2f", text: "#e5e7eb" };
    return SKILL_COLORS[skillId] || fallback;
  };
  const enabledSkills = SKILLS.filter(skill => {
    const cfg = state.metricsConfig[skill.id];
    return !cfg || cfg.enabled !== false;
  });
  const pickedSkillId = nextSkillId || getSelectedSkill(playerIdx);
  if (!pickedSkillId) {
    if (enabledSkills.length === 0) {
      const empty = document.createElement("div");
      empty.className = "players-empty";
      empty.textContent = "Abilita almeno un fondamentale nelle impostazioni per scoutizzare.";
      targetEl.appendChild(empty);
      return;
    }
    const grid = document.createElement("div");
    grid.className = "skill-grid";
    enabledSkills.forEach(skill => {
      const colors = getSkillColors(skill.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "skill-picker-btn skill-" + skill.id;
      btn.style.backgroundColor = colors.bg;
      btn.style.color = colors.text;
      btn.textContent = skill.label;
      btn.addEventListener("click", () => {
        setSelectedSkill(playerIdx, skill.id);
        renderPlayers();
      });
      grid.appendChild(btn);
    });
    if (activeName) {
      const errBtn = document.createElement("button");
      errBtn.type = "button";
      errBtn.className = "small event-btn danger skill-error-btn";
      errBtn.textContent = "Errore/Fallo individuale";
      errBtn.addEventListener("click", () => {
        addPlayerError(playerIdx, activeName);
        setSelectedSkill(playerIdx, null);
        if (closeAfterAction) closeSkillModal();
        renderPlayers();
      });
      grid.appendChild(errBtn);
    }
    targetEl.appendChild(grid);
    return;
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
    btn.addEventListener("click", e => {
      handleEventClick(playerIdx, pickedSkillId, code, activeName, e.currentTarget);
      setSelectedSkill(playerIdx, null);
      if (closeAfterAction) closeSkillModal();
      renderPlayers();
    });
    grid.appendChild(btn);
  });
  const errBtn = document.createElement("button");
  errBtn.type = "button";
  errBtn.className = "small event-btn danger code-error-btn";
  errBtn.textContent = "Errore/Fallo individuale";
  errBtn.dataset.playerIdx = String(playerIdx);
  errBtn.addEventListener("click", () => {
    addPlayerError(playerIdx, activeName);
    setSelectedSkill(playerIdx, null);
    if (closeAfterAction) closeSkillModal();
    renderPlayers();
  });
  grid.appendChild(errBtn);
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "secondary small code-back-btn";
  backBtn.textContent = "← Scegli un altro fondamentale";
  backBtn.addEventListener("click", () => {
    setSelectedSkill(playerIdx, null);
    renderPlayers();
  });
  grid.appendChild(backBtn);
  targetEl.appendChild(grid);
}
function renderPlayers() {
  if (!elPlayersContainer) return;
  elPlayersContainer.innerHTML = "";
  elPlayersContainer.classList.add("court-layout");
  ensureCourtShape();
  ensureMetricsConfigDefaults();
  const predictedSkillId = getPredictedSkillId();
  const layoutSkill =
    state.predictiveSkillFlow && predictedSkillId
      ? predictedSkillId
      : isAnySelectedSkill("pass")
        ? "pass"
        : null;
  const displayCourt = getAutoRoleDisplayCourt(layoutSkill);
  updateNextSkillIndicator(predictedSkillId);
  const renderOrder = [3, 2, 1, 4, 5, 0]; // pos4, pos3, pos2, pos5, pos6, pos1
  renderOrder.forEach(idx => {
    const meta = POSITIONS_META[idx];
    const slotInfo = displayCourt[idx] || { slot: { main: "" }, idx: idx };
    const slot = slotInfo.slot || { main: "" };
    const posIdx = slotInfo.idx != null ? slotInfo.idx : idx;
    const activeName = slot.main;
    let playerIdx = -1;
    if (activeName) {
      playerIdx = state.players.findIndex(p => p === activeName);
    }
    const card = document.createElement("div");
    card.className = "player-card court-card pos-" + (idx + 1);
    card.dataset.posNumber = String(idx + 1);
    card.dataset.posIndex = String(posIdx);
    card.dataset.playerName = activeName || "";
    if (!activeName) {
      card.classList.add("empty");
    }
    card.dataset.dropTarget = "main";
    const header = document.createElement("div");
    header.className = "court-header" + (activeName ? " draggable" : "");
    header.draggable = !!activeName;
    header.addEventListener("dragstart", e => handleCourtDragStart(e, posIdx));
    header.addEventListener("dragend", handleCourtDragEnd);
    const tagBar = document.createElement("div");
    tagBar.className = "court-tagbar";
    const posLabel = document.createElement("span");
    posLabel.className = "court-pos-label";
    posLabel.textContent = "Pos " + (idx + 1);
    const tagLibero = document.createElement("span");
    tagLibero.className = "court-libero-pill";
    tagLibero.textContent = "Libero";
    tagLibero.style.visibility = isLibero(slot.main) ? "visible" : "hidden";
    tagBar.appendChild(posLabel);
    tagBar.appendChild(tagLibero);
    header.appendChild(tagBar);
    const nameBlock = document.createElement("div");
    nameBlock.className = "court-name-block inline";
    const nameLabel = document.createElement("div");
    nameLabel.className = "court-name";
    if (isLibero(slot.main)) {
      nameLabel.classList.add("libero-flag");
    }
    nameLabel.textContent = slot.main
      ? formatNameWithNumber(slot.main)
      : "Trascina una giocatrice qui";
    const roleTag = document.createElement("span");
    roleTag.className = "court-role-tag";
    roleTag.textContent = getRoleLabel(posIdx);
    nameBlock.appendChild(nameLabel);
    nameBlock.appendChild(roleTag);
    if (isLibero(slot.main) && slot.replaced) {
      const subText = document.createElement("div");
      subText.className = "libero-replace";
      subText.textContent = "Sostituisce: " + formatNameWithNumber(slot.replaced);
      nameBlock.appendChild(subText);
    }
    header.appendChild(nameBlock);
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "pill-remove clear-slot";
    clearBtn.textContent = "✕";
    clearBtn.addEventListener("click", () => {
      clearCourtAssignment(posIdx, "main");
    });
    header.appendChild(clearBtn);
    card.appendChild(header);

    card.addEventListener("dragenter", e => handlePositionDragOver(e, card), true);
    card.addEventListener("dragover", e => handlePositionDragOver(e, card), true);
    card.addEventListener("dragleave", () => handlePositionDragLeave(card), true);
    card.addEventListener("drop", e => handlePositionDrop(e, card), true);

    if (!activeName || playerIdx === -1) {
      elPlayersContainer.appendChild(card);
      return;
    }
    renderSkillRows(card, playerIdx, activeName, { nextSkillId: predictedSkillId });
    elPlayersContainer.appendChild(card);
  });
  recalcAllStatsAndUpdateUI();
  renderLineupChips();
}
function animateEventToLog(sourceEl, skillId, code) {
  if (!sourceEl || !elEventsLog) return;
  const src = sourceEl.getBoundingClientRect();
  const dest = elEventsLog.getBoundingClientRect();
  const flyer = document.createElement("div");
  flyer.className = "event-flyer badge";
  if (skillId) flyer.classList.add("badge-" + skillId);
  flyer.textContent = code || "";
  const startX = src.left + src.width / 2;
  const startY = src.top + src.height / 2;
  const destX = dest.left + Math.min(dest.width * 0.15, 28);
  const destY = dest.top + 12;
  flyer.style.setProperty("--sx", startX + "px");
  flyer.style.setProperty("--sy", startY + "px");
  flyer.style.setProperty("--dx", destX - startX + "px");
  flyer.style.setProperty("--dy", destY - startY + "px");
  document.body.appendChild(flyer);
  requestAnimationFrame(() => flyer.classList.add("run"));
  flyer.addEventListener("animationend", () => {
    flyer.remove();
    elEventsLog.classList.add("log-pulse");
    setTimeout(() => elEventsLog.classList.remove("log-pulse"), 320);
  });
}
function handleEventClick(playerIdxStr, skillId, code, playerName, sourceEl) {
  let playerIdx = parseInt(playerIdxStr, 10);
  if (isNaN(playerIdx) || !state.players[playerIdx]) {
    playerIdx = state.players.findIndex(p => p === playerName);
  }
  if (playerIdx === -1 || !state.players[playerIdx]) return;
  const event = buildBaseEventPayload({
    playerIdx,
    playerName: state.players[playerIdx],
    skillId,
    code
  });
  state.events.push(event);
  handleAutoRotationFromEvent(event);
  if (!state.stats[playerIdx]) {
    state.stats[playerIdx] = {};
  }
  if (!state.stats[playerIdx][skillId]) {
    state.stats[playerIdx][skillId] = { "#": 0, "+": 0, "!": 0, "-": 0, "=": 0, "/": 0 };
  }
  state.stats[playerIdx][skillId][code] =
    (state.stats[playerIdx][skillId][code] || 0) + 1;
  animateEventToLog(sourceEl, skillId, code);
  saveState();
  updateSkillStatsUI(playerIdx, skillId);
  renderPlayers();
  if (!state.predictiveSkillFlow) {
    renderLiveScore();
    renderScoreAndRotations(computePointsSummary());
    renderEventsLog();
    renderAggregatedTable();
    renderVideoAnalysis();
  }
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
function getCurrentZoneForPlayer(playerIdx) {
  if (typeof playerIdx !== "number" || !state.players || !state.players[playerIdx]) return null;
  const name = state.players[playerIdx];
  if (!state.court || !Array.isArray(state.court)) return null;
  const slotIdx = state.court.findIndex(
    slot => slot && (slot.main === name || slot.replaced === name)
  );
  if (slotIdx === -1) return null;
  return slotIdx + 1; // zone numbering 1..6
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
  renderVideoAnalysis();
}
function renderEventsLog() {
  if (elEventsLog) elEventsLog.innerHTML = "";
  let summaryText = "Nessun evento";
  let compactSummary = "";
  if (!state.events || state.events.length === 0) {
    if (elEventsLog) elEventsLog.textContent = "Nessun evento ancora registrato.";
    if (elEventsLogSummary) elEventsLogSummary.textContent = summaryText;
    if (elFloatingLogSummary) elFloatingLogSummary.textContent = "—";
    if (elUndoLastSummary) elUndoLastSummary.textContent = "—";
    return;
  }
  const recent = state.events.slice(-40).reverse();
  const latest = recent[0];
  const formatEv = ev => {
    const dateObj = new Date(ev.t);
    const timeStr = isNaN(dateObj.getTime())
      ? ""
      : dateObj.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
    const leftText =
      "[S" +
      ev.set +
      "] " +
      (ev.playerName ? formatNameWithNumber(ev.playerName) : "#" + ev.playerIdx) +
      " - " +
      ev.skillId +
      " " +
      ev.code;
    const shortSkill = getShortSkill(ev.skillId);
    const num = getPlayerNumber(ev.playerName);
    const initials = getInitials(ev.playerName);
    const compact =
      (num || initials || "#" + (typeof ev.playerIdx === "number" ? ev.playerIdx + 1 : "?")) +
      " " +
      shortSkill +
      " " +
      (ev.code || "");
    const compactClean = compact.trim();
    return { leftText, timeStr, compact: compactClean };
  };
  const latestFmt = formatEv(latest);
  summaryText = latestFmt.leftText;
  compactSummary = latestFmt.compact;
  const skillEvents = getVideoSkillEvents();
  const baseMs = getVideoBaseTimeMs(skillEvents);
  renderEventTableRows(elEventsLog, recent, { showSeek: false, showVideoTime: true, baseMs });
  if (elEventsLogSummary) {
    elEventsLogSummary.textContent = summaryText;
  }
  if (elFloatingLogSummary) {
    elFloatingLogSummary.textContent = compactSummary || "—";
  }
  if (elUndoLastSummary) {
    elUndoLastSummary.textContent = compactSummary || "—";
  }
}
function getVideoSkillEvents() {
  return (state.events || [])
    .map((ev, idx) => ({ ev, idx }))
    .filter(item => item.ev && item.ev.skillId && item.ev.skillId !== "manual");
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
  if (!isFinite(seconds)) return "0:00";
  const total = Math.max(0, seconds);
  let minutes = Math.floor(total / 60);
  let secRounded = Math.round((total - minutes * 60) * 10) / 10;
  if (secRounded >= 60) {
    minutes += 1;
    secRounded = 0;
  }
  const [secIntStr, decimals] = secRounded.toFixed(1).split(".");
  const secStr = secIntStr.padStart(2, "0");
  return minutes + ":" + secStr + "." + (decimals || "0");
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
    elYoutubeFrame.src = buildYoutubeEmbedSrc(id, start, false);
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
            elYoutubeFrame.src = buildYoutubeEmbedSrc(id, start, false);
          }
        }
      }
    });
  } catch (_) {
    youtubeFallback = true;
    pendingYoutubeSeek = null;
    elYoutubeFrame.src = buildYoutubeEmbedSrc(id, start, false);
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
  state.video = state.video || { offsetSeconds: 0, fileName: "", youtubeId: "", youtubeUrl: "" };
  state.video.youtubeId = id;
  state.video.youtubeUrl = url.trim();
  state.video.fileName = "YouTube: " + state.video.youtubeUrl;
  saveState();
  renderYoutubePlayer(0);
  renderVideoAnalysis();
}
function clearYoutubeSource() {
  if (!state.video) return;
  state.video.youtubeId = "";
  state.video.youtubeUrl = "";
  if (elYoutubeUrlInput) {
    elYoutubeUrlInput.value = "";
  }
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
}
async function clearCachedLocalVideo() {
  try {
    if (!("caches" in window)) return;
    const cache = await caches.open(LOCAL_VIDEO_CACHE);
    await cache.delete(LOCAL_VIDEO_REQUEST);
  } catch (_) {
    // ignore cache errors
  }
}
async function persistLocalVideo(file) {
  if (!file || !("caches" in window)) return;
  try {
    const cache = await caches.open(LOCAL_VIDEO_CACHE);
    await cache.put(
      LOCAL_VIDEO_REQUEST,
      new Response(file, { headers: { "Content-Type": file.type || "video/mp4" } })
    );
  } catch (_) {
    // ignore cache errors
  }
}
async function restoreCachedLocalVideo() {
  if (!elAnalysisVideo || !("caches" in window)) return;
  if (state.video && state.video.youtubeId) return;
  try {
    const cache = await caches.open(LOCAL_VIDEO_CACHE);
    const match = await cache.match(LOCAL_VIDEO_REQUEST);
    if (!match) return;
    const blob = await match.blob();
    if (videoObjectUrl) {
      try {
        URL.revokeObjectURL(videoObjectUrl);
      } catch (_) {
        // ignore
      }
    }
    const url = URL.createObjectURL(blob);
    videoObjectUrl = url;
    elAnalysisVideo.src = url;
    elAnalysisVideo.load();
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
  if (elYoutubeUrlInput && state.video.youtubeUrl) {
    elYoutubeUrlInput.value = state.video.youtubeUrl;
  }
  renderYoutubePlayer(state.video.offsetSeconds || 0);
  renderVideoAnalysis();
}
function updateVideoSyncLabel() {
  if (!elVideoSyncLabel) return;
  const offset =
    state.video && typeof state.video.offsetSeconds === "number" ? state.video.offsetSeconds : 0;
  elVideoSyncLabel.textContent =
    offset > 0 ? "Prima skill allineata a " + formatVideoTimestamp(offset) : "La prima skill parte da 0:00";
}
function resolvePlayerIdx(ev) {
  if (typeof ev.playerIdx === "number" && state.players[ev.playerIdx]) {
    return ev.playerIdx;
  }
  return state.players.findIndex(name => name === ev.playerName);
}
function refreshAfterVideoEdit(shouldRecalcStats) {
  saveState();
  if (shouldRecalcStats) {
    recalcAllStatsAndUpdateUI();
    renderEventsLog();
  }
  renderVideoAnalysis();
}
function createPlayerSelect(ev, onDone) {
  const select = document.createElement("select");
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "—";
  select.appendChild(emptyOpt);
  (state.players || []).forEach((name, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = formatNameWithNumber(name);
    select.appendChild(opt);
  });
  const playerIdx = resolvePlayerIdx(ev);
  select.value = playerIdx >= 0 ? String(playerIdx) : "";
  select.addEventListener("change", () => {
    const val = parseInt(select.value, 10);
    if (!isNaN(val) && state.players[val]) {
      ev.playerIdx = val;
      ev.playerName = state.players[val];
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
    ev.code = select.value;
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
  const fallback = getCurrentZoneForPlayer(resolvePlayerIdx(ev));
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
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "0.1";
  input.value = videoTime.toFixed(1);
  input.addEventListener("change", () => {
    const val = parseFloat(input.value || "");
    if (!isNaN(val) && val >= 0) {
      ev.videoTime = val;
      refreshAfterVideoEdit(false);
    }
  });
  input.addEventListener("blur", () => {
    if (typeof onDone === "function") onDone();
    renderVideoAnalysis();
  });
  return input;
}
function makeEditableCell(td, factory) {
  const startEdit = () => {
    if (td.dataset.editing === "true") return;
    td.dataset.editing = "true";
    td.innerHTML = "";
    const control = factory(() => {
      td.dataset.editing = "false";
    });
    td.appendChild(control);
    if (typeof control.focus === "function") {
      control.focus();
    }
  };
  td.addEventListener("click", e => {
    e.stopPropagation();
    startEdit();
  });
}
function renderEventTableRows(target, events, options = {}) {
  if (!target) return;
  target.innerHTML = "";
  const showVideoTime = options.showVideoTime;
  const showSeek = options.showSeek;
  const baseMs = options.baseMs || null;
  const targetIsTbody = target.tagName && target.tagName.toLowerCase() === "tbody";
  const table = targetIsTbody ? null : document.createElement("table");
  const tbody = targetIsTbody ? target : document.createElement("tbody");

  if (!targetIsTbody) {
    table.className = options.tableClass || "event-edit-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headers = [
      "#",
      "Giocatrice",
      "Fondamentale",
      "Codice",
      "Set",
      "Rot",
      "Zona",
      "Pos Palleggio",
      "Pos Palleggio Avv",
      "Zona Rice",
      "Base",
      "Tipo Alzata",
      "Combinazione",
      "Servizio Start",
      "Servizio End",
      "Tipo Servizio",
      "Valut Rice",
      "Valut Att",
      "Att BP",
      "Tipo Att",
      "Direzione Att",
      "Muro N",
      "In",
      "Out",
      "Dur (ms)"
    ];
    if (showVideoTime) headers.push("Video");
    if (showSeek) headers.push("Azione");
    headers.forEach(h => {
      const th = document.createElement("th");
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    table.appendChild(tbody);
  }
  events.forEach((ev, displayIdx) => {
    const tr = document.createElement("tr");
    const videoTime = showVideoTime ? computeEventVideoTime(ev, baseMs) : null;
    const zoneDisplay = ev.zone || ev.playerPosition || "";
    const cells = [
      { text: String(displayIdx + 1) },
      {
        text: formatNameWithNumber(ev.playerName || state.players[resolvePlayerIdx(ev)]) || "—",
        editable: td => makeEditableCell(td, done => createPlayerSelect(ev, done))
      },
      {
        text: (SKILLS.find(s => s.id === ev.skillId) || {}).label || ev.skillId || "",
        editable: td => makeEditableCell(td, done => createSkillSelect(ev, done))
      },
      {
        text: ev.code || "",
        editable: td => makeEditableCell(td, done => createCodeSelect(ev, done))
      },
      {
        text: ev.set || "1",
        editable: td => makeEditableCell(td, done => createSetInput(ev, done))
      },
      {
        text: ev.rotation || "-",
        editable: td => makeEditableCell(td, done => createRotationInput(ev, done))
      },
      {
        text: zoneDisplay ? String(zoneDisplay) : "",
        editable: td => makeEditableCell(td, done => createZoneInput(ev, done))
      },
      {
        text: valueToString(ev.setterPosition || ev.rotation || ""),
        editable: td => makeEditableCell(td, done => createNumberInput(ev, "setterPosition", 1, 6, done))
      },
      {
        text: valueToString(ev.opponentSetterPosition),
        editable: td => makeEditableCell(td, done => createNumberInput(ev, "opponentSetterPosition", 1, 6, done))
      },
      {
        text: valueToString(ev.receivePosition),
        editable: td => makeEditableCell(td, done => createNumberInput(ev, "receivePosition", 1, 6, done))
      },
      {
        text: valueToString(ev.base),
        editable: td => makeEditableCell(td, done => createTextInput(ev, "base", done))
      },
      {
        text: valueToString(ev.setType),
        editable: td => makeEditableCell(td, done => createTextInput(ev, "setType", done))
      },
      {
        text: valueToString(ev.combination),
        editable: td => makeEditableCell(td, done => createTextInput(ev, "combination", done))
      },
      {
        text: valueToString(ev.serveStart),
        editable: td => makeEditableCell(td, done => createTextInput(ev, "serveStart", done))
      },
      {
        text: valueToString(ev.serveEnd),
        editable: td => makeEditableCell(td, done => createTextInput(ev, "serveEnd", done))
      },
      {
        text: valueToString(ev.serveType),
        editable: td => makeEditableCell(td, done => createTextInput(ev, "serveType", done))
      },
      {
        text: valueToString(ev.receiveEvaluation),
        editable: td => makeEditableCell(td, done => createTextInput(ev, "receiveEvaluation", done))
      },
      {
        text: valueToString(ev.attackEvaluation),
        editable: td => makeEditableCell(td, done => createTextInput(ev, "attackEvaluation", done))
      },
      {
        text: valueToString(ev.attackBp),
        editable: td => makeEditableCell(td, done => createCheckboxInput(ev, "attackBp", done))
      },
      {
        text: valueToString(ev.attackType),
        editable: td => makeEditableCell(td, done => createTextInput(ev, "attackType", done))
      },
      {
        text: valueToString(ev.attackDirection),
        editable: td => makeEditableCell(td, done => createTextInput(ev, "attackDirection", done))
      },
      {
        text: valueToString(ev.blockNumber),
        editable: td => makeEditableCell(td, done => createNumberInput(ev, "blockNumber", 0, undefined, done))
      },
      {
        text: valueToString(ev.playerIn),
        editable: td => makeEditableCell(td, done => createTextInput(ev, "playerIn", done))
      },
      {
        text: valueToString(ev.playerOut),
        editable: td => makeEditableCell(td, done => createTextInput(ev, "playerOut", done))
      },
      { text: valueToString(ev.durationMs || "") }
    ];
    if (showVideoTime) {
      cells.push({
        text: formatVideoTimestamp(videoTime),
        editable: td => makeEditableCell(td, done => createVideoTimeInput(ev, videoTime, done))
      });
    }
    cells.forEach(cell => {
      const td = document.createElement("td");
      td.textContent = cell.text || "";
      if (cell.editable) {
        cell.editable(td);
      }
      tr.appendChild(td);
    });
    if (showSeek) {
      const actionTd = document.createElement("td");
      const link = document.createElement("span");
      link.className = "video-seek-link";
      link.textContent = "▶ Vai";
      link.title = "Apri al timestamp";
      link.addEventListener("click", () => seekVideoToTime(videoTime));
      actionTd.appendChild(link);
      tr.appendChild(actionTd);
      tr.addEventListener("dblclick", () => {
        seekVideoToTime(videoTime);
      });
    }
    tbody.appendChild(tr);
  });
  if (!targetIsTbody) {
    target.appendChild(table);
  }
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
  let updatedZones = false;
  skillEvents.forEach(({ ev }) => {
    const fallbackZone = getCurrentZoneForPlayer(resolvePlayerIdx(ev));
    if ((ev.zone === undefined || ev.zone === null || ev.zone === "") && fallbackZone) {
      ev.zone = fallbackZone;
      updatedZones = true;
    }
  });
  renderEventTableRows(
    elVideoSkillsContainer,
    skillEvents.map(item => item.ev),
    { showSeek: true, showVideoTime: true, baseMs, tableClass: "video-skills-table event-edit-table" }
  );
  if (updatedZones) {
    saveState();
  }
}
function seekVideoToTime(seconds) {
  if (!isFinite(seconds)) return;
  const target = Math.max(0, seconds);
  if (state.video && state.video.youtubeId) {
    if (youtubeFallback && elYoutubeFrame) {
      elYoutubeFrame.src = buildYoutubeEmbedSrc(state.video.youtubeId, target, false, true);
      return;
    }
    if (ytPlayer && typeof ytPlayer.seekTo === "function") {
      queueYoutubeSeek(target, true);
    } else if (elYoutubeFrame) {
      if (elYoutubeFrame.contentWindow) {
        try {
          elYoutubeFrame.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "seekTo", args: [target, true] }),
            "*"
          );
          elYoutubeFrame.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "playVideo", args: [] }),
            "*"
          );
          return;
        } catch (_) {
          // ignore postMessage errors and fall back to src update
        }
      }
      elYoutubeFrame.src = buildYoutubeEmbedSrc(state.video.youtubeId, target, true, true);
    }
    return;
  }
  if (!elAnalysisVideo) return;
  try {
    elAnalysisVideo.currentTime = target;
    elAnalysisVideo.play().catch(() => {});
  } catch (_) {
    // ignore errors when seeking
  }
}
function handleVideoFileChange(file) {
  if (!file || !elAnalysisVideo) return;
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
  elAnalysisVideo.src = url;
  persistLocalVideo(file);
  state.video = state.video || { offsetSeconds: 0, fileName: "", youtubeId: "", youtubeUrl: "" };
  state.video.fileName = file.name || "video";
  state.video.youtubeId = "";
  state.video.youtubeUrl = "";
  saveState();
  renderVideoAnalysis();
}
function syncFirstSkillToVideo() {
  const skillEvents = getVideoSkillEvents();
  if (!skillEvents.length) {
    alert("Registra almeno una skill per poter sincronizzare.");
    return;
  }
  const baseMs = getVideoBaseTimeMs(skillEvents);
  let currentVideoTime = 0;
  if (state.video && state.video.youtubeId) {
    if (ytPlayer && ytPlayerReady && typeof ytPlayer.getCurrentTime === "function") {
      currentVideoTime = ytPlayer.getCurrentTime() || 0;
    } else {
      alert("Apri e avvia il video YouTube per sincronizzare.");
      return;
    }
  } else if (elAnalysisVideo) {
    currentVideoTime = isFinite(elAnalysisVideo.currentTime) ? elAnalysisVideo.currentTime : 0;
  }
  state.video = state.video || { offsetSeconds: 0, fileName: "", youtubeId: "", youtubeUrl: "" };
  state.video.offsetSeconds = Math.max(0, currentVideoTime);
  const base = typeof baseMs === "number" ? baseMs : null;
  if (base !== null) {
    skillEvents.forEach(({ ev }) => {
      const evMs = new Date(ev.t).getTime();
      const delta = isNaN(evMs) ? 0 : (evMs - base) / 1000;
      ev.videoTime = Math.max(0, state.video.offsetSeconds + delta);
    });
  }
  saveState();
  renderVideoAnalysis();
}
function getPointDirection(ev) {
  if (ev.pointDirection === "for" || ev.pointDirection === "against") {
    return ev.pointDirection;
  }
  ensurePointRulesDefaults();
  const skill = ev.skillId;
  const code = ev.code;
  const cfg = normalizePointRule(skill, state.pointRules && state.pointRules[skill]);
  if (cfg.for.includes(code)) return "for";
  if (cfg.against.includes(code)) return "against";
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
function computePlayerPointsMap() {
  const map = {};
  (state.events || []).forEach(ev => {
    if (typeof ev.playerIdx !== "number") return;
    const dir = getPointDirection(ev);
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
function computePlayerErrorsMap() {
  const map = {};
  (state.events || []).forEach(ev => {
    if (typeof ev.playerIdx !== "number") return;
    const dir = getPointDirection(ev);
    if (dir !== "against") return;
    const val = typeof ev.value === "number" ? ev.value : 1;
    map[ev.playerIdx] = (map[ev.playerIdx] || 0) + Math.max(0, val);
  });
  return map;
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
  if (elLiveScoreFloating) {
    const prefix = "S" + (state.currentSet || 1) + " · ";
    elLiveScoreFloating.textContent = prefix + totalLabel;
  }
  if (elLiveScoreModal) {
    elLiveScoreModal.textContent = totalLabel;
  }
  if (elBtnOpenActionsModal) {
    elBtnOpenActionsModal.textContent = "S" + (state.currentSet || 1) + " · " + totalLabel;
  }
}
function renderMobileLineupMiniCourt() {
  if (!elMiniCourt) return;
  elMiniCourt.innerHTML = "";
  const slots = MINI_SLOT_ORDER.map(idx => mobileLineupOrder[idx] || "");
  slots.forEach((name, visualIdx) => {
    const slotIdx = MINI_SLOT_ORDER[visualIdx];
    const btn = document.createElement("button");
    btn.type = "button";
    const selectedClass =
      touchDragName &&
      touchDragFromSlot === slotIdx &&
      touchDragName === name &&
      !touchDragFromList
        ? " touch-selected"
        : "";
    const overClass = touchDragOverSlot === slotIdx ? " drop-over" : "";
    btn.className = "mini-slot" + (name ? "" : " empty") + selectedClass + overClass;
    btn.dataset.posNumber = String(slotIdx + 1);
    btn.dataset.playerName = name || "";
    btn.textContent = name ? formatNameWithNumber(name) : "";
    btn.setAttribute("aria-label", name ? formatNameWithNumber(name) : "Slot " + (slotIdx + 1));
    btn.dataset.slotIndex = String(slotIdx);
    if (name) {
      btn.draggable = true;
      btn.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", name);
        e.dataTransfer.setData("source-slot", String(slotIdx));
        e.dataTransfer.setData("source-list", "false");
        e.dataTransfer.effectAllowed = "move";
      });
      btn.addEventListener("touchstart", ev => startTouchDrag(name, slotIdx, false, ev), {
        passive: true
      });
    }
    btn.addEventListener("touchmove", handleTouchMove, { passive: false });
    btn.addEventListener("touchend", handleTouchEnd, { passive: false });
    btn.addEventListener("dragover", e => {
      e.preventDefault();
      btn.classList.add("drop-over");
    });
    btn.addEventListener("dragleave", () => btn.classList.remove("drop-over"));
    btn.addEventListener("drop", e => {
      e.preventDefault();
      btn.classList.remove("drop-over");
      const nameDropped = e.dataTransfer.getData("text/plain");
      if (!nameDropped) return;
      const fromSlot = parseInt(e.dataTransfer.getData("source-slot"), 10);
      const fromList = e.dataTransfer.getData("source-list") === "true";
      if (!canPlaceInSlot(nameDropped, slotIdx, true)) return;
      if (!fromList && !isNaN(fromSlot) && fromSlot === slotIdx) return;
      const currentOccupant = mobileLineupOrder[slotIdx] || "";
      if (!fromList && !isNaN(fromSlot) && currentOccupant) {
        if (!canPlaceInSlot(currentOccupant, fromSlot, true)) return;
      }
      if (!fromList && !isNaN(fromSlot)) {
        mobileLineupOrder[fromSlot] = "";
      }
      if (!fromList && !isNaN(fromSlot) && currentOccupant && fromSlot >= 0 && fromSlot < 6) {
        mobileLineupOrder[fromSlot] = currentOccupant;
      }
      mobileLineupOrder[slotIdx] = nameDropped;
      renderMobileLineupMiniCourt();
      renderMobileLineupList();
    });
    btn.addEventListener("click", () => {
      mobileLineupOrder[slotIdx] = "";
      renderMobileLineupMiniCourt();
      renderMobileLineupList();
    });
    elMiniCourt.appendChild(btn);
  });
}
function renderMobileLineupList() {
  if (!elMobileLineupList) return;
  elMobileLineupList.innerHTML = "";
  const used = new Set(mobileLineupOrder.filter(Boolean));
  const mobileMode = isMobileLayout();
  const liberoSet = new Set(state.liberos || []);
  const playersList = (state.players || []).filter(
    name => !(mobileMode && liberoSet.has(name))
  );
  if (!playersList || playersList.length === 0) {
    const empty = document.createElement("div");
    empty.className = "players-empty";
    empty.textContent = "Aggiungi giocatrici nella sezione gestione.";
    elMobileLineupList.appendChild(empty);
    return;
  }
  playersList.forEach(name => {
    const btn = document.createElement("button");
    btn.type = "button";
    const selectedClass =
      touchDragName && touchDragName === name && touchDragFromList ? " touch-selected" : "";
    btn.className = "mobile-lineup-chip" + (used.has(name) ? " selected" : "") + selectedClass;
    btn.textContent = formatNameWithNumber(name);
    btn.disabled = used.has(name);
    btn.draggable = !used.has(name);
    btn.addEventListener("click", () => {
      let nextIndex = -1;
      mobileLineupOrder.every((slot, idx) => {
        if (!slot && canPlaceInSlot(name, idx, false)) {
          nextIndex = idx;
          return false;
        }
        return true;
      });
      if (nextIndex === -1) {
        alert("Nessuna posizione disponibile per questa giocatrice.");
        return;
      }
      mobileLineupOrder[nextIndex] = name;
      renderMobileLineupMiniCourt();
      renderMobileLineupList();
    });
    if (!used.has(name)) {
      btn.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", name);
        e.dataTransfer.setData("source-slot", "-1");
        e.dataTransfer.setData("source-list", "true");
        e.dataTransfer.effectAllowed = "copyMove";
      });
      btn.addEventListener("touchstart", ev => startTouchDrag(name, -1, true, ev), {
        passive: true
      });
      btn.addEventListener("touchmove", handleTouchMove, { passive: false });
      btn.addEventListener("touchend", handleTouchEnd, { passive: false });
    }
    elMobileLineupList.appendChild(btn);
  });
  elMobileLineupList.ondragover = e => {
    e.preventDefault();
  };
  elMobileLineupList.ondrop = e => {
    e.preventDefault();
    const fromSlot = parseInt(e.dataTransfer.getData("source-slot"), 10);
    const fromList = e.dataTransfer.getData("source-list") === "true";
    if (!fromList && !isNaN(fromSlot) && fromSlot >= 0 && fromSlot < 6) {
      mobileLineupOrder[fromSlot] = "";
      renderMobileLineupMiniCourt();
      renderMobileLineupList();
    }
  };
  elMobileLineupList.addEventListener("touchmove", handleTouchMove, { passive: false });
  elMobileLineupList.addEventListener("touchend", handleTouchEnd, { passive: false });
}
function openMobileLineupModal() {
  if (!elMobileLineupModal) return;
  ensureCourtShape();
  mobileLineupOrder = Array.from({ length: 6 }, (_, idx) => state.court[idx]?.main || "");
  elMobileLineupModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  renderMobileLineupMiniCourt();
  renderMobileLineupList();
}
function closeMobileLineupModal() {
  if (!elMobileLineupModal) return;
  elMobileLineupModal.classList.add("hidden");
  document.body.style.overflow = "";
}
function createTouchGhost(text, x, y) {
  removeTouchGhost();
  const ghost = document.createElement("div");
  ghost.className = "touch-drag-ghost";
  ghost.textContent = text;
  ghost.style.left = x + "px";
  ghost.style.top = y + "px";
  document.body.appendChild(ghost);
  touchGhost = ghost;
}
function moveTouchGhost(x, y) {
  if (!touchGhost) return;
  touchGhost.style.left = x + "px";
  touchGhost.style.top = y + "px";
}
function removeTouchGhost() {
  if (touchGhost && touchGhost.parentNode) {
    touchGhost.parentNode.removeChild(touchGhost);
  }
  touchGhost = null;
}
function resetTouchDragState() {
  touchDragName = "";
  touchDragFromSlot = -1;
  touchDragFromList = false;
  touchDragOverSlot = -1;
  removeTouchGhost();
  renderMobileLineupMiniCourt();
  renderMobileLineupList();
}
function startTouchDrag(name, sourceSlot, fromList, e) {
  touchDragName = name;
  touchDragFromSlot = sourceSlot;
  touchDragFromList = fromList;
  touchDragOverSlot = -1;
  const t = e && e.touches && e.touches[0];
  touchStartX = t ? t.clientX : 0;
  touchStartY = t ? t.clientY : 0;
  touchStartTime = Date.now();
  createTouchGhost(formatNameWithNumber(name), touchStartX, touchStartY);
  renderMobileLineupMiniCourt();
  renderMobileLineupList();
}
function updateTouchOver(x, y) {
  const elAtPoint = document.elementFromPoint(x, y);
  const slotEl = elAtPoint && elAtPoint.closest(".mini-slot");
  if (slotEl && slotEl.dataset.slotIndex) {
    touchDragOverSlot = parseInt(slotEl.dataset.slotIndex, 10);
  } else {
    touchDragOverSlot = -1;
  }
  renderMobileLineupMiniCourt();
}
function applyTouchDrop(toSlot, dropToList) {
  if (!touchDragName) return;
  if (dropToList) {
    if (touchDragFromSlot >= 0 && touchDragFromSlot < 6) {
      mobileLineupOrder[touchDragFromSlot] = "";
    }
    resetTouchDragState();
    return;
  }
  if (toSlot === null || toSlot === undefined || toSlot < 0) {
    resetTouchDragState();
    return;
  }
  if (!canPlaceInSlot(touchDragName, toSlot, true)) {
    resetTouchDragState();
    return;
  }
  const currentOccupant = mobileLineupOrder[toSlot] || "";
  if (touchDragFromSlot >= 0 && currentOccupant) {
    if (!canPlaceInSlot(currentOccupant, touchDragFromSlot, true)) {
      resetTouchDragState();
      return;
    }
  }
  if (touchDragFromSlot >= 0 && touchDragFromSlot < 6) {
    mobileLineupOrder[touchDragFromSlot] = "";
  }
  if (touchDragFromSlot >= 0 && touchDragFromSlot < 6 && currentOccupant) {
    mobileLineupOrder[touchDragFromSlot] = currentOccupant;
  }
  mobileLineupOrder[toSlot] = touchDragName;
  resetTouchDragState();
}
function handleTouchMove(e) {
  if (!touchDragName) return;
  if (!e.touches || !e.touches[0]) return;
  const t = e.touches[0];
  updateTouchOver(t.clientX, t.clientY);
  moveTouchGhost(t.clientX, t.clientY);
  e.preventDefault();
}
function handleTouchEnd(e) {
  if (!touchDragName) return;
  const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  const x = touch ? touch.clientX : 0;
  const y = touch ? touch.clientY : 0;
  const elapsed = Date.now() - touchStartTime;
  const dist = Math.hypot(x - touchStartX, y - touchStartY);
  const isTap = dist < 10 && elapsed < 200;
  const elAtPoint = document.elementFromPoint(x, y);
  const slotEl = elAtPoint && elAtPoint.closest(".mini-slot");
  const listEl = elAtPoint && elAtPoint.closest(".mobile-lineup-list");
  if (isTap) {
    if (touchDragFromList) {
      let nextIndex = -1;
      mobileLineupOrder.every((slot, idx) => {
        if (!slot && canPlaceInSlot(touchDragName, idx, false)) {
          nextIndex = idx;
          return false;
        }
        return true;
      });
      if (nextIndex !== -1) {
        mobileLineupOrder[nextIndex] = touchDragName;
      }
    } else if (touchDragFromSlot >= 0) {
      mobileLineupOrder[touchDragFromSlot] = "";
    }
    resetTouchDragState();
    e.preventDefault();
    return;
  }
  if (slotEl && slotEl.dataset.slotIndex) {
    const targetSlot = parseInt(slotEl.dataset.slotIndex, 10);
    applyTouchDrop(targetSlot, false);
  } else if (listEl) {
    applyTouchDrop(-1, true);
  } else {
    resetTouchDragState();
  }
  e.preventDefault();
}
function handleAutoRotationFromEvent(eventObj) {
  if (!state || !state.autoRotate) {
    state.autoRotatePending = false;
    return;
  }
  eventObj.autoRotatePrev = state.autoRotatePending;
  if (typeof ensurePointRulesDefaults === "function") {
    ensurePointRulesDefaults();
  }
  if (eventObj.skillId === "pass") {
    state.autoRotatePending = true;
    state.isServing = false;
    eventObj.autoRotateNext = state.autoRotatePending;
    saveState();
    return;
  }
  const direction = getPointDirection(eventObj);
  if (direction === "for") {
    if (state.autoRotatePending && typeof rotateCourt === "function") {
      // Side-out rotation: advance in the same direction as manual CCW button
      rotateCourt("ccw");
      eventObj.autoRotationDirection = "ccw";
    }
    state.autoRotatePending = false;
    state.isServing = true;
  } else if (direction === "against") {
    state.autoRotatePending = false;
    state.isServing = false;
  }
  eventObj.autoRotateNext = state.autoRotatePending;
  saveState();
  if (state.autoRolePositioning && typeof applyAutoRolePositioning === "function") {
    applyAutoRolePositioning();
  }
}
function addManualPoint(direction, value, codeLabel, playerIdx = null, playerName = "Squadra") {
  const event = buildBaseEventPayload({
    playerIdx,
    playerName: playerName,
    skillId: "manual",
    code: codeLabel || direction,
    pointDirection: direction,
    value: value
  });
  state.events.push(event);
  handleAutoRotationFromEvent(event);
  saveState();
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
  const summary = computePointsSummary(state.currentSet || 1);
  if (delta < 0) {
    if (direction === "for" && summary.totalFor <= 0) return;
    if (direction === "against" && summary.totalAgainst <= 0) return;
  }
  const value = delta > 0 ? 1 : -1;
  addManualPoint(direction, value, direction, null, "Squadra");
}
function addPlayerError(playerIdx, playerName) {
  addManualPoint("against", 1, "error", playerIdx, playerName || "Giocatrice");
}
function handleTeamError() {
  addManualPoint("against", 1, "team-error", null, "Squadra");
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
  const summaryAll = computePointsSummary();
  if (!state.players || state.players.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 26;
    td.textContent = "Aggiungi giocatrici per vedere il riepilogo.";
    tr.appendChild(td);
    elAggTableBody.appendChild(tr);
    renderScoreAndRotations(summaryAll);
    renderSecondTable();
    applyAggColumnsVisibility();
    return;
  }
  const playerPoints = computePlayerPointsMap();
  const playerErrors = computePlayerErrorsMap();
  const totalsBySkill = {
    serve: emptyCounts(),
    pass: emptyCounts(),
    attack: emptyCounts(),
    block: emptyCounts(),
    defense: emptyCounts()
  };
  let totalErrors = 0;
  state.players.forEach((name, idx) => {
    const serveCounts = normalizeCounts(state.stats[idx] && state.stats[idx].serve);
    const passCounts = normalizeCounts(state.stats[idx] && state.stats[idx].pass);
    const attackCounts = normalizeCounts(state.stats[idx] && state.stats[idx].attack);
    const blockCounts = normalizeCounts(state.stats[idx] && state.stats[idx].block);
    const defenseCounts = normalizeCounts(state.stats[idx] && state.stats[idx].defense);

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
    const cells = [
      { text: formatNameWithNumber(name) },
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
    elAggTableBody.appendChild(row);
  });
  const serveTotalsMetrics = computeMetrics(totalsBySkill.serve, "serve");
  const passTotalsMetrics = computeMetrics(totalsBySkill.pass, "pass");
  const attackTotalsMetrics = computeMetrics(totalsBySkill.attack, "attack");
  const blockTotalsMetrics = computeMetrics(totalsBySkill.block, "block");
  const defenseTotalsMetrics = computeMetrics(totalsBySkill.defense, "defense");
  const teamAttackTotal = totalFromCounts(totalsBySkill.attack);
  const totalsRow = document.createElement("tr");
  totalsRow.className = "rotation-row total";
  const totalCells = [
    { text: "Totale squadra" },
    { text: summaryAll.totalFor || 0 },
    { text: summaryAll.totalAgainst || 0 },
    { text: formatDelta((summaryAll.totalFor || 0) - (summaryAll.totalAgainst || 0)) },
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
  renderScoreAndRotations(summaryAll);
  renderSecondTable();
  applyAggColumnsVisibility();
}
function renderSecondTable() {
  if (!elAggSecondBody) return;
  elAggSecondBody.innerHTML = "";
  if (!state.players || state.players.length === 0) {
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
  const playersWithSecond = new Set(
    (state.events || [])
      .filter(ev => ev && ev.skillId === "second" && typeof ev.playerIdx === "number")
      .map(ev => ev.playerIdx)
  );
  state.players.forEach((name, idx) => {
    const counts = normalizeCounts(state.stats[idx] && state.stats[idx].second);
    const total = totalFromCounts(counts);
    if (total <= 0 && !playersWithSecond.has(idx)) return;
    mergeCounts(totals, counts);
    const metrics = computeMetrics(counts, "second");
    rows.push({
      name: formatNameWithNumber(name),
      total,
      counts,
      metrics
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
function computeAttackDistribution() {
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
  (state.events || []).forEach(ev => {
    if (!ev || ev.skillId !== "attack") return;
    let zone = ev.zone;
    if (zone === undefined || zone === null) {
      zone = getCurrentZoneForPlayer(ev.playerIdx);
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
  elSecondDistribution.innerHTML = "";
  const dist = computeAttackDistribution();
  elSecondDistribution.classList.add("distribution-grid", "distribution-grid-layout");
  const layout = [
    { key: 4, area: "r4" },
    { key: 3, area: "r3" },
    { key: 2, area: "r2" },
    { key: 5, area: "r5" },
    { key: 6, area: "r6" },
    { key: 1, area: "r1" },
    { key: "all", area: "all" }
  ];
  const zoneOrder = [4, 3, 2, 5, 6, 1]; // layout order
  layout.forEach(item => {
    const rot = item.key;
    const data = dist[rot];
    const totalAttacks = data ? data.total : 0;
    const card = document.createElement("div");
    card.className = "distribution-card";
    card.style.gridArea = item.area;
    const title = document.createElement("h4");
    title.textContent = rot === "all" ? "Tutte le rotazioni" : "Rotazione " + rot;
    card.appendChild(title);
    const court = document.createElement("div");
    court.className = "distribution-court";
    if (!data || totalAttacks === 0) {
      const empty = document.createElement("div");
      empty.className = "distribution-empty";
      empty.textContent = "Nessun attacco registrato.";
      card.appendChild(empty);
      elSecondDistribution.appendChild(card);
      return;
    }
    // find best volume and efficiency
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
      if (bestVolumeZone === zoneNum && zoneTotal > 0) {
        cell.classList.add("best-volume");
      }
      if (bestEffZone === zoneNum && zoneTotal > 0) {
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
    elSecondDistribution.appendChild(card);
  });
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
  await loadScriptOnce(
    "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
    () => typeof window.html2canvas === "function"
  );
  await loadScriptOnce(
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    () => window.jspdf && typeof window.jspdf.jsPDF === "function"
  );
}
async function captureAnalysisAsPdf() {
  await ensurePdfLibs();
  const aggPanel = document.getElementById("aggregated-panel");
  if (!aggPanel) {
    throw new Error("Pannello analisi non trovato");
  }
  const prevTab = activeTab;
  const prevAggTab = activeAggTab;
  const prevTheme = state.theme || document.body.dataset.theme || "dark";
  setActiveTab("aggregated");
  setActiveAggTab("summary");
  applyTheme("light");
  document.body.classList.add("pdf-capture");
  try {
    await new Promise(res => setTimeout(res, 120));
    const canvas = await window.html2canvas(aggPanel, {
      backgroundColor: "#ffffff",
      scale: 1.3,
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
      players: state.players,
      captains: (state.captains || []).slice(0, 1),
      playerNumbers: state.playerNumbers,
      liberos: state.liberos,
      court: state.court,
      events: state.events,
      stats: state.stats,
      metricsConfig: state.metricsConfig,
      savedTeams: state.savedTeams,
      selectedTeam: state.selectedTeam,
      video: state.video,
      pointRules: state.pointRules,
      autoRotate: state.autoRotate
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
function buildMatchShareUrl() {
  if (typeof window === "undefined") return "";
  const payload = buildMatchExportPayload();
  const encoded = encodePayloadForLink(payload);
  if (!encoded) return "";
  const url = new URL(window.location.href);
  url.searchParams.set("match", encoded);
  url.hash = "";
  return url.toString();
}
async function shareMatchLink() {
  const url = buildMatchShareUrl();
  if (!url) {
    alert("Impossibile generare il link del match.");
    return;
  }
  const shared = await shareText("Link partita Simple Volleyball Scout", url);
  if (shared) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link partita copiato negli appunti.");
      return;
    } catch (err) {
      logError("copy-match-link", err);
    }
  }
  window.prompt("Copia il link seguente", url);
}
function applyImportedMatch(nextState, options = {}) {
  const silent = options && options.silent;
  const fallback = () => alert("File match non valido.");
  if (!nextState || !nextState.players || !nextState.events) {
    fallback();
    return;
  }
  const merged = Object.assign({}, state, nextState);
  merged.match = nextState.match || state.match || {};
  merged.playerNumbers = nextState.playerNumbers || {};
  merged.captains = normalizePlayers(Array.isArray(nextState.captains) ? nextState.captains : [])
    .filter(name => (nextState.players || []).includes(name))
    .slice(0, 1);
  merged.liberos = nextState.liberos || [];
  merged.court =
    nextState.court ||
    [{ main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }];
  merged.metricsConfig = nextState.metricsConfig || state.metricsConfig || {};
  merged.savedTeams = nextState.savedTeams || state.savedTeams || {};
  merged.selectedTeam = nextState.selectedTeam || state.selectedTeam || "";
  merged.rotation = nextState.rotation || 1;
  merged.currentSet = nextState.currentSet || 1;
  merged.video = nextState.video || state.video || { offsetSeconds: 0, fileName: "" };
  state = merged;
  saveState();
  applyTheme(state.theme || "dark");
  applyMatchInfoToUI();
  applyPlayersFromStateToTextarea();
  renderPlayersManagerList();
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
  const name = safeMatchSlug() || "database";
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, "backup_" + name + ".json");
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
  const rows = state.players.map((name, idx) => {
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
      "  Rot " +
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
  captureAnalysisAsPdf().catch(err => {
    console.error("PDF export failed", err);
    alert("Impossibile generare il PDF. Controlla la connessione o riprova.");
  });
}
function resetMatch() {
  if (!confirm("Sei sicuro di voler resettare tutti i dati del match?")) return;
  state.events = [];
  state.court = Array.from({ length: 6 }, () => ({ main: "" }));
  state.rotation = 1;
  state.currentSet = 1;
  state.autoRotatePending = false;
  state.video = state.video || { offsetSeconds: 0, fileName: "", youtubeId: "", youtubeUrl: "" };
  state.video.offsetSeconds = 0;
  state.video.youtubeId = "";
  state.video.youtubeUrl = "";
  clearCachedLocalVideo();
  if (ytPlayer && ytPlayer.stopVideo) {
    ytPlayer.stopVideo();
  }
  if (elAnalysisVideo) {
    elAnalysisVideo.pause();
    elAnalysisVideo.currentTime = 0;
  }
  if (elYoutubeFrame) {
    elYoutubeFrame.src = "";
    elYoutubeFrame.style.display = "none";
  }
  syncCurrentSetUI(1);
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
  if (ev && ev.autoRotationDirection && typeof rotateCourt === "function") {
    const reverseDir = ev.autoRotationDirection === "ccw" ? "cw" : "ccw";
    rotateCourt(reverseDir);
  }
  if (state.autoRotate) {
    if (ev && typeof ev.autoRotatePrev === "boolean") {
      state.autoRotatePending = ev.autoRotatePrev;
    } else {
      state.autoRotatePending = false;
    }
  } else {
    state.autoRotatePending = false;
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
  const supportsSw = "serviceWorker" in navigator;
  const secureContext =
    window.isSecureContext || location.protocol === "https:" || location.hostname === "localhost";
  if (!supportsSw || !secureContext) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch(err => console.error("SW registration failed", err));
  });
}
function setActiveAggTab(target) {
  const desired = target || "summary";
  activeAggTab = desired;
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
}
function setActiveTab(target) {
  if (!target) return;
  activeTab = target;
  document.body.dataset.activeTab = target;
  tabButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tabTarget === target);
  });
  tabDots.forEach(dot => {
    dot.classList.toggle("active", dot.dataset.tabTarget === target);
  });
  tabPanels.forEach(panel => {
    panel.classList.toggle("active", panel.dataset.tab === target);
  });
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
  tabDots.forEach(dot => {
    dot.addEventListener("click", () => {
      const target = dot.dataset.tabTarget;
      if (target) setActiveTab(target);
    });
  });
  setActiveTab("info");
}
function initSwipeTabs() {
  if (!("ontouchstart" in window)) return;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  const minDistance = 90;
  const maxOffset = 50;
  const maxTime = 700;
  const tabsOrder = ["info", "scout", "aggregated", "video"];
  const onStart = e => {
    const t = (e.changedTouches && e.changedTouches[0]) || e;
    startX = t.clientX;
    startY = t.clientY;
    startTime = Date.now();
  };
  const onEnd = e => {
    if (elSkillModal && !elSkillModal.classList.contains("hidden")) return;
    const t = (e.changedTouches && e.changedTouches[0]) || e;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = Date.now() - startTime;
    if (dt > maxTime) return;
    if (Math.abs(dy) > maxOffset) return;
    if (Math.abs(dx) < minDistance) return;
    const dir = dx > 0 ? "right" : "left";
    const idx = tabsOrder.indexOf(activeTab);
    if (idx === -1) return;
    const nextIdx = dir === "left" ? Math.min(tabsOrder.length - 1, idx + 1) : Math.max(0, idx - 1);
    if (nextIdx !== idx) setActiveTab(tabsOrder[nextIdx]);
  };
  document.addEventListener("touchstart", onStart, { passive: true });
  document.addEventListener("touchend", onEnd, { passive: true });
}
function init() {
  isLoadingMatch = true;
  initTabs();
  initSwipeTabs();
  document.body.dataset.activeTab = activeTab;
  setActiveAggTab(activeAggTab || "summary");
  loadState();
  const linkImport = maybeImportMatchFromUrl();
  renderYoutubePlayer();
  restoreCachedLocalVideo();
  restoreYoutubeFromState();
  applyTheme(state.theme || "dark");
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
  renderMatchesSelect();
  renderLiveScore();
  renderPlayers();
  if (state.autoRolePositioning && typeof applyAutoRolePositioning === "function") {
    applyAutoRolePositioning();
  }
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

  [elCurrentSet, elCurrentSetFloating].forEach(select => {
    if (!select) return;
    select.addEventListener("change", () => setCurrentSet(select.value));
  });
  [elOpponent, elCategory, elDate, elLeg, elMatchType].forEach(input => {
    if (!input) return;
    const handler = () => saveMatchInfoFromUI();
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
  if (elBtnApplyPlayers) {
    elBtnApplyPlayers.addEventListener("click", () => {
      applyPlayersFromTextarea();
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
  if (elBtnOpenTeamManager) {
    elBtnOpenTeamManager.addEventListener("click", openTeamManagerModal);
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
        openTeamManagerModal();
        return;
      }
      teamManagerState.players.push({
        id: Date.now() + "_" + Math.random(),
        name: "",
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
  const elTeamManagerLineup = document.getElementById("team-manager-lineup");
  if (elTeamManagerLineup) {
    elTeamManagerLineup.addEventListener("click", () => {
      saveTeamManagerPayload({
        closeModal: true,
        openLineupAfter: true,
        saveToStorage: true,
        showAlert: false,
        preserveCourt: true,
        askReset: false
      });
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
  if (elTeamManagerDup) {
    elTeamManagerDup.addEventListener("click", () => {
      if (!teamManagerState) {
        openTeamManagerModal();
        return;
      }
      const clone = JSON.parse(JSON.stringify(teamManagerState.players || []));
      teamManagerState.players = clone.map(p => Object.assign({}, p, { id: Date.now() + "_" + Math.random(), name: p.name + " (dup)" }));
      renderTeamManagerTable();
    });
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
  if (elTeamsSelect) {
    elTeamsSelect.addEventListener("change", handleTeamSelectChange);
  }
  if (elSavedMatchesSelect) {
    elSavedMatchesSelect.addEventListener("change", () => {
      updateMatchButtonsState();
      loadSelectedMatch();
    });
  }
  if (elBtnRotateCw) {
    elBtnRotateCw.addEventListener("click", () => rotateCourt("cw"));
  }
  if (elBtnRotateCcw) {
    elBtnRotateCcw.addEventListener("click", () => rotateCourt("ccw"));
  }
  if (elBtnRotateCwFloating) {
    elBtnRotateCwFloating.addEventListener("click", () => rotateCourt("cw"));
  }
  if (elBtnRotateCcwFloating) {
    elBtnRotateCcwFloating.addEventListener("click", () => rotateCourt("ccw"));
  }
  if (elBtnRotateCwModal) {
    elBtnRotateCwModal.addEventListener("click", () => rotateCourt("cw"));
  }
  if (elBtnRotateCcwModal) {
    elBtnRotateCcwModal.addEventListener("click", () => rotateCourt("ccw"));
  }
  const elAutoRotateToggleFloating = document.getElementById("auto-rotate-toggle-floating");
  if (elRotationSelect) {
    elRotationSelect.addEventListener("change", () => setRotation(elRotationSelect.value));
  }
  if (elRotationSelectFloating) {
    elRotationSelectFloating.addEventListener("change", () =>
      setRotation(elRotationSelectFloating.value)
    );
  }
  if (elAutoRotateToggle) {
    elAutoRotateToggle.addEventListener("change", () =>
      setAutoRotateEnabled(elAutoRotateToggle.checked)
    );
  }
  if (elAutoRotateToggleFloating) {
    elAutoRotateToggleFloating.addEventListener("change", () =>
      setAutoRotateEnabled(elAutoRotateToggleFloating.checked)
    );
  }
  const elAutoRoleToggle = document.getElementById("auto-role-toggle");
  if (elAutoRoleToggle) {
    elAutoRoleToggle.checked = !!state.autoRolePositioning;
    elAutoRoleToggle.addEventListener("change", () => {
      const enabled = elAutoRoleToggle.checked;
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
  const elAutoRoleP1AmericanToggle = document.getElementById("auto-role-p1american-toggle");
  if (elAutoRoleP1AmericanToggle) {
    elAutoRoleP1AmericanToggle.checked = !!state.autoRoleP1American;
    elAutoRoleP1AmericanToggle.addEventListener("change", () => {
      if (typeof setAutoRoleP1American === "function") {
        setAutoRoleP1American(elAutoRoleP1AmericanToggle.checked);
      } else {
        state.autoRoleP1American = !!elAutoRoleP1AmericanToggle.checked;
        saveState();
      }
    });
  }
  const elPredictiveSkillToggle = document.getElementById("predictive-skill-toggle");
  if (elPredictiveSkillToggle) {
    elPredictiveSkillToggle.checked = !!state.predictiveSkillFlow;
    elPredictiveSkillToggle.addEventListener("change", () => {
      state.predictiveSkillFlow = !!elPredictiveSkillToggle.checked;
      saveState();
      renderPlayers();
    });
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
  if (elRotationIndicatorFloating) {
    const openModalFromRot = () => openActionsModal();
    elRotationIndicatorFloating.addEventListener("click", openModalFromRot);
    elRotationIndicatorFloating.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModalFromRot();
      }
    });
  }
  if (elRotationIndicatorModal && elRotationSelectFloating) {
    const openSelectFloating = () => {
      elRotationSelectFloating.focus();
      elRotationSelectFloating.click();
    };
    elRotationIndicatorModal.addEventListener("click", openSelectFloating);
    elRotationIndicatorModal.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openSelectFloating();
      }
    });
  }
  if (elBtnExportCsv) elBtnExportCsv.addEventListener("click", exportCsv);
  if (elBtnCopyCsv) elBtnCopyCsv.addEventListener("click", copyCsvToClipboard);
  if (elBtnExportPdf) elBtnExportPdf.addEventListener("click", exportAnalysisPdf);
  if (elBtnShareMatchLink) elBtnShareMatchLink.addEventListener("click", shareMatchLink);
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
  if (elBtnUndoFloating) elBtnUndoFloating.addEventListener("click", undoLastEvent);
  if (elToggleLogMobile && elLogSection) {
    elToggleLogMobile.addEventListener("click", () => {
      const isOpen = elLogSection.classList.toggle("open");
      elToggleLogMobile.setAttribute("aria-expanded", String(isOpen));
      elToggleLogMobile.textContent = isOpen ? "Chiudi log eventi" : "Apri log eventi";
    });
  }
  if (elBtnOpenLineupMobile) {
    elBtnOpenLineupMobile.addEventListener("click", () => openMobileLineupModal());
  }
  if (elBtnOpenLineupMobileFloating) {
    elBtnOpenLineupMobileFloating.addEventListener("click", () => openMobileLineupModal());
  }
  if (elAggTabButtons && typeof elAggTabButtons.forEach === "function") {
    elAggTabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.aggTabTarget) {
          setActiveAggTab(btn.dataset.aggTabTarget);
        }
      });
    });
  }
  if (elMobileLineupClose) {
    elMobileLineupClose.addEventListener("click", closeMobileLineupModal);
  }
  if (elMobileLineupModal) {
    elMobileLineupModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.closeLineup !== undefined || target.classList.contains("mobile-lineup__backdrop")) {
        closeMobileLineupModal();
      }
    });
  }
  if (elMobileLineupConfirm) {
    elMobileLineupConfirm.addEventListener("click", () => {
      const filled = mobileLineupOrder.filter(Boolean);
      if (filled.length < 6) {
        alert("Inserisci 6 giocatrici per impostare la rotazione.");
        return;
      }
      ensureCourtShape();
      mobileLineupOrder.slice(0, 6).forEach((name, idx) => {
        state.court[idx] = { main: name, replaced: "" };
      });
      saveState();
      renderPlayers();
      renderBenchChips();
      renderLineupChips();
      renderLiberoChipsInline();
      updateRotationDisplay();
      closeMobileLineupModal();
    });
  }
  if (elBtnOpenActionsModal) {
    elBtnOpenActionsModal.addEventListener("click", openActionsModal);
  }
  if (elActionsClose) {
    elActionsClose.addEventListener("click", closeActionsModal);
  }
  if (elActionsModal) {
    elActionsModal.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.closeActions !== undefined || target.classList.contains("floating-actions__backdrop")) {
        closeActionsModal();
      }
    });
  }
  if (elBtnScoreForPlusModal) elBtnScoreForPlusModal.addEventListener("click", () => handleManualScore("for", 1));
  if (elBtnScoreForMinusModal) elBtnScoreForMinusModal.addEventListener("click", () => handleManualScore("for", -1));
  if (elBtnScoreAgainstPlusModal) elBtnScoreAgainstPlusModal.addEventListener("click", () => handleManualScore("against", 1));
  if (elBtnScoreAgainstMinusModal) elBtnScoreAgainstMinusModal.addEventListener("click", () => handleManualScore("against", -1));
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
  if (elBtnSyncFirstSkill) {
    elBtnSyncFirstSkill.addEventListener("click", syncFirstSkillToVideo);
  }
  if (elBtnLoadYoutube) {
    elBtnLoadYoutube.addEventListener("click", () => {
      const url = (elYoutubeUrlInput && elYoutubeUrlInput.value) || "";
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
  if (elBtnScoreTeamError) {
    elBtnScoreTeamError.addEventListener("click", handleTeamError);
  }
  if (elBtnScoreTeamErrorMobile) {
    elBtnScoreTeamErrorMobile.addEventListener("click", handleTeamError);
  }
  if (elBtnScoreTeamErrorModal) {
    elBtnScoreTeamErrorModal.addEventListener("click", handleTeamError);
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
  window.addEventListener("resize", () => {
    renderPlayers();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeSkillModal();
      closeActionsModal();
      closeMobileLineupModal();
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
  });
  renderVideoAnalysis();
  attachModalCloseHandlers();
  registerServiceWorker();
  isLoadingMatch = false;
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
