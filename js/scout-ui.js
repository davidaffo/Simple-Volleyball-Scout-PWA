function openSkillModal(playerIdx, playerName) {
  if (!elSkillModal || !elSkillModalBody) return;
  const idx = typeof playerIdx === "number" ? playerIdx : parseInt(playerIdx, 10);
  if (isNaN(idx) || !state.players[idx]) return;
  modalMode = "skill";
  modalSubPosIdx = -1;
  elSkillModalBody.innerHTML = "";
  const title =
    formatNameWithNumber(playerName || state.players[idx]) || (playerName || "Giocatrice");
  if (elSkillModalTitle) {
    elSkillModalTitle.textContent = title;
  }
  renderSkillRows(elSkillModalBody, idx, state.players[idx], {
    stacked: false,
    columns: 3,
    closeAfterAction: true
  });
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
function setupInstallPrompt() {
  let deferredPrompt = null;
  if (!elInstallBtn) return;
  const showInstall = () => elInstallBtn.classList.add("visible");
  const hideInstall = () => elInstallBtn.classList.remove("visible");

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstall();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideInstall();
  });
  elInstallBtn.addEventListener("click", async () => {
    if (!deferredPrompt) {
      hideInstall();
      return;
    }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    hideInstall();
    if (choice && choice.outcome === "dismissed") {
      // keep button hidden until next prompt event
    }
  });
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
  const { stacked = false, closeAfterAction = false, columns = 2 } = options;
  const getSkillColors = skillId => {
    const fallback = { bg: "#2f2f2f", text: "#e5e7eb" };
    return SKILL_COLORS[skillId] || fallback;
  };
  const enabledSkills = SKILLS.filter(skill => {
    const cfg = state.metricsConfig[skill.id];
    return !cfg || cfg.enabled !== false;
  });
  if (enabledSkills.length === 0) {
    const empty = document.createElement("div");
    empty.className = "players-empty";
    empty.textContent = "Abilita almeno un fondamentale nelle impostazioni per scoutizzare.";
    targetEl.appendChild(empty);
    return;
  }
  const chunkSize = stacked ? 1 : columns;
  for (let i = 0; i < enabledSkills.length; i += chunkSize) {
    const rowWrap = document.createElement("div");
    rowWrap.className = "skill-row-pair" + (stacked ? " stacked" : "");
    const subset = enabledSkills.slice(i, i + chunkSize);
    subset.forEach(skill => {
    const row = document.createElement("div");
    row.className = "skill-row skill-" + skill.id;
    row.dataset.playerIdx = String(playerIdx);
    row.dataset.playerName = activeName;
    row.dataset.skillId = skill.id;
    const header = document.createElement("div");
    header.className = "skill-header";
    const title = document.createElement("span");
    title.className = "skill-title skill-" + skill.id;
    const colors = getSkillColors(skill.id);
    title.textContent = skill.label;
    title.style.backgroundColor = colors.bg;
    title.style.color = colors.text;
    header.appendChild(title);
    const btns = document.createElement("div");
    btns.className = "skill-buttons";
      const codes = (state.metricsConfig[skill.id]?.activeCodes || RESULT_CODES).slice();
      if (!codes.includes("/")) codes.push("/");
      if (!codes.includes("=")) codes.push("=");
      const ordered = codes.filter(c => c !== "/" && c !== "=").concat("/", "=");
      ordered.forEach(code => {
        const btn = document.createElement("button");
        btn.type = "button";
        const tone = typeof getCodeTone === "function" ? getCodeTone(skill.id, code) : "neutral";
        btn.className = "event-btn code-" + tone;
        btn.textContent = code;
        btn.dataset.playerIdx = String(playerIdx);
        btn.dataset.playerName = activeName;
        btn.dataset.skillId = skill.id;
        btn.dataset.code = code;
        btn.addEventListener("click", e => {
          handleEventClick(playerIdx, skill.id, code, activeName, e.currentTarget);
          if (closeAfterAction) closeSkillModal();
        });
        btns.appendChild(btn);
      });
      row.appendChild(header);
      row.appendChild(btns);
      rowWrap.appendChild(row);
    });
    targetEl.appendChild(rowWrap);
  }
  if (activeName) {
    const extraRow = document.createElement("div");
    extraRow.className = "skill-row error-row";
    const lbl = document.createElement("div");
    lbl.className = "skill-header";
    lbl.textContent = "Altri";
    const buttons = document.createElement("div");
    buttons.className = "skill-buttons";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "small event-btn danger";
    btn.textContent = "Errore/Fallo";
    btn.addEventListener("click", () => {
      addPlayerError(playerIdx, activeName);
      if (closeAfterAction) closeSkillModal();
    });
    buttons.appendChild(btn);
    extraRow.appendChild(lbl);
    extraRow.appendChild(buttons);
    targetEl.appendChild(extraRow);
  }
}
function renderPlayers() {
  if (!elPlayersContainer) return;
  elPlayersContainer.innerHTML = "";
  elPlayersContainer.classList.add("court-layout");
  ensureCourtShape();
  ensureMetricsConfigDefaults();
  const mobileMode = isMobileLayout();
  const renderOrder = [3, 2, 1, 4, 5, 0]; // pos4, pos3, pos2, pos5, pos6, pos1
  renderOrder.forEach(idx => {
    const meta = POSITIONS_META[idx];
    const slot = state.court[idx] || { main: "" };
    const activeName = slot.main;
    let playerIdx = -1;
    if (activeName) {
      playerIdx = state.players.findIndex(p => p === activeName);
    }
    const card = document.createElement("div");
    card.className = "player-card court-card pos-" + (idx + 1);
    card.dataset.posNumber = String(idx + 1);
    if (!activeName) {
      card.classList.add("empty");
    }
    card.dataset.posIndex = String(idx);
    card.dataset.dropTarget = "main";
    const header = document.createElement("div");
    header.className = "court-header" + (activeName ? " draggable" : "");
    header.draggable = !!activeName;
    header.addEventListener("dragstart", e => handleCourtDragStart(e, idx));
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
    roleTag.textContent = getRoleLabel(idx);
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
      clearCourtAssignment(idx, "main");
    });
    header.appendChild(clearBtn);
    card.appendChild(header);

    card.addEventListener("dragenter", e => handlePositionDragOver(e, card), true);
    card.addEventListener("dragover", e => handlePositionDragOver(e, card), true);
    card.addEventListener("dragleave", () => handlePositionDragLeave(card), true);
    card.addEventListener("drop", e => handlePositionDrop(e, card), true);

    if (mobileMode) {
      card.classList.add("mobile-card");
      const openBtn = document.createElement("button");
      openBtn.type = "button";
    const isLib = isLibero(activeName);
    const replacedText =
      isLib && slot.replaced ? " (sost. " + formatNameWithNumber(slot.replaced) + ")" : "";
    const roleText = getRoleLabel(idx);
    openBtn.className = "open-skill-btn mobile-full-btn" + (isLib ? " libero-btn" : "");
    openBtn.textContent = activeName
      ? formatNameWithNumber(activeName) +
        (roleText ? " · " + roleText : "") +
        (isLib ? " · Libero" : "") +
        replacedText
      : "Pos " + (idx + 1) + " · Nessuna";
      openBtn.disabled = !activeName;
      openBtn.addEventListener("click", () => openSkillModal(playerIdx, activeName));
      card.appendChild(openBtn);
      elPlayersContainer.appendChild(card);
      return;
    }

    if (!activeName || playerIdx === -1) {
      elPlayersContainer.appendChild(card);
      return;
    }
    renderSkillRows(card, playerIdx, activeName);
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
  animateEventToLog(sourceEl, skillId, code);
  saveState();
  updateSkillStatsUI(playerIdx, skillId);
  renderLiveScore();
  renderScoreAndRotations(computePointsSummary());
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
  if (elEventsLog) {
    elEventsLog.innerHTML = "";
  }
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
  recent.forEach(ev => {
    if (!elEventsLog) return;
    const div = document.createElement("div");
    div.className = "event-line";
    const left = document.createElement("span");
    left.className = "event-left";
    const fmt = formatEv(ev);
    left.textContent = fmt.leftText;
    const right = document.createElement("span");
    right.className = "event-right";
    right.textContent = fmt.timeStr;
    div.appendChild(left);
    div.appendChild(right);
    elEventsLog.appendChild(div);
  });
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
  if (!state.players || state.players.length === 0) {
    const empty = document.createElement("div");
    empty.className = "players-empty";
    empty.textContent = "Aggiungi giocatrici nella sezione gestione.";
    elMobileLineupList.appendChild(empty);
    return;
  }
  state.players.forEach(name => {
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
function downloadCsv(csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
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
function exportCsv() {
  const csv = buildCsvString();
  if (!csv) {
    alert("Nessun evento da esportare.");
    return;
  }
  if (navigator.share) {
    navigator
      .share({
        title: "Simple Volleyball Scout - CSV",
        text: csv
      })
      .catch(() => downloadCsv(csv));
  } else {
    downloadCsv(csv);
  }
}
function copyCsvToClipboard() {
  const csv = buildCsvString();
  if (!csv) {
    alert("Nessun evento da copiare.");
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(csv)
      .then(() => alert("CSV copiato negli appunti."))
      .catch(() => fallbackCopy(csv));
  } else {
    fallbackCopy(csv);
  }
}
function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  alert("CSV copiato negli appunti.");
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
  const prevTheme = state.theme || document.body.dataset.theme || "dark";
  setActiveTab("aggregated");
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
    const opponentSlug = (state.match.opponent || "match").replace(/\s+/g, "_");
    const fileName = "analisi_" + opponentSlug + ".pdf";
    const shared = await shareBlob("Simple Volleyball Scout - PDF", blob, fileName);
    if (!shared) {
      downloadBlob(blob, fileName);
    }
  } finally {
    document.body.classList.remove("pdf-capture");
    applyTheme(prevTheme);
    if (prevTab) setActiveTab(prevTab);
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
      playerNumbers: state.playerNumbers,
      liberos: state.liberos,
      court: state.court,
      events: state.events,
      stats: state.stats,
      metricsConfig: state.metricsConfig,
      savedTeams: state.savedTeams,
      selectedTeam: state.selectedTeam
    }
  };
}
async function exportMatchToFile() {
  const payload = buildMatchExportPayload();
  const json = JSON.stringify(payload, null, 2);
  const opponentSlug = (state.match.opponent || "match").replace(/\s+/g, "_");
  const shared = await shareText("Simple Volleyball Scout - Match", json);
  if (!shared) {
    const blob = new Blob([json], { type: "application/json" });
    downloadBlob(blob, "match_" + opponentSlug + ".json");
  }
}
function applyImportedMatch(nextState) {
  const fallback = () => alert("File match non valido.");
  if (!nextState || !nextState.players || !nextState.events) {
    fallback();
    return;
  }
  const merged = Object.assign({}, state, nextState);
  merged.match = nextState.match || state.match || {};
  merged.playerNumbers = nextState.playerNumbers || {};
  merged.liberos = nextState.liberos || [];
  merged.court =
    nextState.court ||
    [{ main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }, { main: "" }];
  merged.metricsConfig = nextState.metricsConfig || state.metricsConfig || {};
  merged.savedTeams = nextState.savedTeams || state.savedTeams || {};
  merged.selectedTeam = nextState.selectedTeam || state.selectedTeam || "";
  merged.rotation = nextState.rotation || 1;
  merged.currentSet = nextState.currentSet || 1;
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
  alert("Match importato correttamente.");
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
  const tabsOrder = ["info", "scout", "aggregated"];
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
  initTabs();
  initSwipeTabs();
  document.body.dataset.activeTab = activeTab;
  loadState();
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
  renderLiveScore();
  renderPlayers();
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
  if (elBtnSaveInfo) {
    elBtnSaveInfo.addEventListener("click", () => {
      saveMatchInfoFromUI();
      alert("Info partita salvate.");
    });
  }
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
  if (elRotationSelect) {
    elRotationSelect.addEventListener("change", () => setRotation(elRotationSelect.value));
  }
  if (elRotationSelectFloating) {
    elRotationSelectFloating.addEventListener("change", () =>
      setRotation(elRotationSelectFloating.value)
    );
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
  attachModalCloseHandlers();
  setupInstallPrompt();
  registerServiceWorker();
}
document.addEventListener("DOMContentLoaded", init);
