/**
 * Modulo per gestire i dati di match e i form correlati (match info e roster textarea).
 * Richiede funzioni/oggetti passati in fase di creazione per evitare dipendenze dal DOM globale.
 */
(function attachMatchSettings(windowObj) {
  function createMatchSettings(deps) {
    const {
      state,
      getTodayIso,
      ensureMatchDefaults,
      setCurrentSet,
      syncCurrentSetUI,
      saveState,
      elOpponent,
      elCategory,
      elDate,
      elMatchType,
      elLeg,
      elCurrentSet,
      elPlayersInput,
      elOpponentPlayersInput
    } = deps;

    function applyMatchInfoToUI() {
      ensureMatchDefaults();
      if (elOpponent) elOpponent.value = state.match.opponent || "";
      if (elCategory) elCategory.value = state.match.category || "";
      if (elDate) elDate.value = state.match.date || "";
      if (elMatchType) elMatchType.value = state.match.matchType || "amichevole";
      if (elLeg) elLeg.value = state.match.leg || "";
      if (syncCurrentSetUI) syncCurrentSetUI(state.currentSet || 1);
    }

    function saveMatchInfoFromUI() {
      if (elOpponent) state.match.opponent = elOpponent.value.trim();
      if (elCategory) state.match.category = elCategory.value.trim();
      if (elDate) {
        state.match.date = elDate.value || getTodayIso();
        if (!elDate.value) elDate.value = state.match.date;
      }
      state.match.matchType = (elMatchType && elMatchType.value) || "amichevole";
      state.match.leg = (elLeg && elLeg.value) || "";
      const setValue = (elCurrentSet && elCurrentSet.value) || 1;
      setCurrentSet(setValue, { save: false });
      saveState();
    }

    function applyPlayersFromStateToTextarea() {
      if (elPlayersInput) {
        elPlayersInput.value = (state.players || []).join("\n");
      }
    }

    function applyOpponentPlayersFromStateToTextarea() {
      if (elOpponentPlayersInput) {
        elOpponentPlayersInput.value = (state.opponentPlayers || []).join("\n");
      }
    }

    return {
      applyMatchInfoToUI,
      saveMatchInfoFromUI,
      applyPlayersFromStateToTextarea,
      applyOpponentPlayersFromStateToTextarea
    };
  }

  windowObj.createMatchSettings = createMatchSettings;
})(typeof window !== "undefined" ? window : self);
