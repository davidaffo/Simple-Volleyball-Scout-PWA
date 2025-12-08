/**
 * Gestione roster avversario (render, stato, storage) separata dal DOM principale.
 */
(function attachOpponentSettings(windowObj) {
  function createOpponentSettings(deps) {
    const {
      state,
      saveState,
      normalizePlayers,
      parseDelimitedTeamText,
      buildNumbersForNames,
      syncOpponentPlayerNumbers,
      renderOpponentPlayersList,
      renderOpponentLiberoTags,
      applyOpponentPlayersFromStateToTextarea,
      elNewOpponentPlayerInput,
      elOpponentPlayersInput
    } = deps || {};

    const rosterManager =
      window.RosterManager &&
      typeof window.RosterManager.createRosterManager === "function" &&
      window.RosterManager.createRosterManager({
        state,
        saveState,
        normalizePlayers,
        buildNumbersForNames,
        syncNumbersFn: (names, provided) =>
          buildNumbersForNames(names, provided, state.opponentPlayerNumbers || {}),
        renderList: renderOpponentPlayersList,
        renderLiberoTags: renderOpponentLiberoTags,
        applyTextarea: applyOpponentPlayersFromStateToTextarea,
        allowCaptain: true,
        liberoKey: "opponentLiberos",
        captainKey: "opponentCaptains",
        playersKey: "opponentPlayers",
        numbersKey: "opponentPlayerNumbers"
      });

    function updateOpponentPlayersList(players, options = {}) {
      if (!rosterManager) return;
      rosterManager.updateRoster(players, options);
    }

    function addOpponentPlayer(name) {
      if (!rosterManager) return;
      rosterManager.addPlayer(name);
    }

    function addOpponentPlayerFromInput() {
      if (!elNewOpponentPlayerInput) return;
      addOpponentPlayer(elNewOpponentPlayerInput.value);
      elNewOpponentPlayerInput.value = "";
      elNewOpponentPlayerInput.focus();
    }

    function applyOpponentPlayersFromTextarea() {
      if (!elOpponentPlayersInput) return;
      const parsed = parseDelimitedTeamText(elOpponentPlayersInput.value || "");
      if (!parsed || !parsed.players || parsed.players.length === 0) {
        alert("Nessuna giocatrice avversaria valida trovata.");
        return;
      }
      updateOpponentPlayersList(parsed.players, {
        liberos: parsed.liberos || [],
        playerNumbers: parsed.numbers || {}
      });
    }

    function clearOpponentPlayers() {
      if (rosterManager) rosterManager.clearRoster();
    }

    const removeOpponentPlayerAtIndex = rosterManager ? rosterManager.removePlayerAtIndex : () => {};
    const renameOpponentPlayerAtIndex = rosterManager ? rosterManager.renamePlayerAtIndex : () => {};
    const handleOpponentNumberChange = rosterManager ? rosterManager.handleNumberChange : () => {};
    const toggleOpponentLibero = rosterManager ? rosterManager.toggleLibero : () => {};
    const setOpponentCaptain = rosterManager ? rosterManager.setCaptain : () => {};

    return {
      updateOpponentPlayersList,
      addOpponentPlayer,
      addOpponentPlayerFromInput,
      applyOpponentPlayersFromTextarea,
      clearOpponentPlayers,
      handleOpponentNumberChange,
      renameOpponentPlayerAtIndex,
      removeOpponentPlayerAtIndex,
      toggleOpponentLibero,
      setOpponentCaptain
    };
  }

  windowObj.OpponentSettings = { createOpponentSettings };
})(typeof window !== "undefined" ? window : self);
