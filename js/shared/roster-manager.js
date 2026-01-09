/**
 * Roster manager riutilizzabile per team nostri/avversari.
 * Opera solo su stato e callback passati, senza dipendenze dal DOM.
 */
(function attachRosterManager(windowObj) {
  function createRosterManager(opts) {
    const {
      state,
      saveState,
      normalizePlayers,
      buildNumbersForNames,
      syncNumbersFn,
      renderList,
      renderLiberoTags,
      applyTextarea,
      allowCaptain = true,
      liberoKey = "liberos",
      captainKey = "captains",
      playersKey = "players",
      numbersKey = "playerNumbers"
    } = opts || {};

    const getPlayers = () => state[playersKey] || [];

    function updateRoster(list, options = {}) {
      const {
        liberos = state[liberoKey] || [],
        playerNumbers = state[numbersKey] || {},
        captains = state[captainKey] || []
      } = options;
      const normalized = normalizePlayers(list || []);
      state[playersKey] = normalized;
      state[numbersKey] = buildNumbersForNames(normalized, playerNumbers, state[numbersKey] || {});
      const libSet = new Set(normalizePlayers(liberos));
      state[liberoKey] = normalized.filter(name => libSet.has(name));
      if (allowCaptain) {
        state[captainKey] = normalizePlayers(captains)
          .filter(name => normalized.includes(name))
          .slice(0, 1);
      }
      saveState();
      applyTextarea();
      renderList();
      renderLiberoTags();
    }

    function addPlayer(name) {
      const clean = (name || "").trim();
      if (!clean) return;
      const existing = normalizePlayers(getPlayers());
      if (existing.includes(clean)) return;
      const next = [clean, ...existing];
      const numbers = Object.assign({}, state[numbersKey] || {});
      numbers[clean] = "";
      updateRoster(next, { playerNumbers: numbers });
    }

    function removePlayerAtIndex(idx) {
      const players = getPlayers();
      if (!players || idx < 0 || idx >= players.length) return;
      const updated = players.slice();
      const removed = updated.splice(idx, 1)[0];
      const numbers = Object.assign({}, state[numbersKey] || {});
      delete numbers[removed];
      const liberos = (state[liberoKey] || []).filter(n => n !== removed);
      const captains = (state[captainKey] || []).filter(n => n !== removed);
      updateRoster(updated, { liberos, playerNumbers: numbers, captains });
    }

    function renamePlayerAtIndex(idx, newName) {
      const players = getPlayers();
      if (!players || idx < 0 || idx >= players.length) return;
      const clean = (newName || "").trim();
      if (!clean) return;
      const next = players.slice();
      const oldName = next[idx];
      if (next.some((p, i) => i !== idx && p.toLowerCase() === clean.toLowerCase())) {
        alert("Nome già presente nel roster.");
        return;
      }
      next[idx] = clean;
      const numbers = Object.assign({}, state[numbersKey] || {});
      if (numbers[oldName]) {
        numbers[clean] = numbers[oldName];
        delete numbers[oldName];
      }
      const liberos = (state[liberoKey] || []).map(n => (n === oldName ? clean : n));
      const captains = (state[captainKey] || []).map(n => (n === oldName ? clean : n));
      updateRoster(next, { liberos, playerNumbers: numbers, captains });
    }

    function handleNumberChange(name, rawNumber) {
      const provided = Object.assign({}, state[numbersKey] || {});
      provided[name] = rawNumber;
      const numbers = syncNumbersFn(getPlayers(), provided);
      state[numbersKey] = numbers;
      saveState();
      renderList();
    }

    function toggleLibero(name, active) {
      const set = new Set(state[liberoKey] || []);
      if (active) set.add(name);
      else set.delete(name);
      state[liberoKey] = normalizePlayers(Array.from(set)).filter(n => getPlayers().includes(n));
      saveState();
      renderList();
      renderLiberoTags();
    }

    function setCaptain(name) {
      if (!allowCaptain) return;
      if (!name) {
        state[captainKey] = [];
      } else {
        const clean = normalizePlayers([name])[0];
        state[captainKey] = clean && getPlayers().includes(clean) ? [clean] : [];
      }
      saveState();
      renderList();
    }

    function clearRoster() {
      if (!getPlayers() || getPlayers().length === 0) return;
      const ok = confirm("Svuotare il roster?");
      if (!ok) return;
      updateRoster([], { liberos: [], playerNumbers: {}, captains: [] });
    }

    return {
      updateRoster,
      addPlayer,
      removePlayerAtIndex,
      renamePlayerAtIndex,
      handleNumberChange,
      toggleLibero,
      setCaptain,
      clearRoster
    };
  }

  windowObj.RosterManager = { createRosterManager };
})(typeof window !== "undefined" ? window : self);
