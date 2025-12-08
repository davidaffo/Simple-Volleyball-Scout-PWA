/**
 * Funzioni di sola logica per gestire il lineup (nessuna dipendenza dal DOM/animazioni).
 */
(function attachLineupCore(windowObj) {
  function ensureCourtShapeFor(court) {
    if (!Array.isArray(court) || court.length !== 6) {
      return Array.from({ length: 6 }, () => ({ main: "", replaced: "" }));
    }
    return court.map(slot => ({
      main: (slot && slot.main) || "",
      replaced: (slot && slot.replaced) || ""
    }));
  }

  function cloneCourtLineup(lineup) {
    return ensureCourtShapeFor(lineup).map(slot => ({
      main: (slot && slot.main) || "",
      replaced: (slot && slot.replaced) || ""
    }));
  }

  function reserveNamesInCourt(name, court) {
    const shaped = ensureCourtShapeFor(court);
    if (!name) return shaped;
    return shaped.map(slot => {
      const cleaned = Object.assign({}, slot);
      if (cleaned.main === name) cleaned.main = "";
      if (cleaned.replaced === name) cleaned.replaced = "";
      return cleaned;
    });
  }

  function releaseReplacedFromCourt(court, name, keepIdx) {
    const shaped = ensureCourtShapeFor(court);
    return shaped.map((slot, idx) => {
      if (idx === keepIdx) return slot;
      if (slot.replaced === name) {
        return Object.assign({}, slot, { replaced: "" });
      }
      return slot;
    });
  }

  function setPlayerOnCourt(options) {
    const { court, posIdx, playerName, liberos = [] } = options || {};
    const shaped = ensureCourtShapeFor(court);
    if (typeof posIdx !== "number" || posIdx < 0 || posIdx >= shaped.length) return shaped;
    const name = (playerName || "").trim();
    if (!name) return shaped;

    const libSet = new Set(liberos);
    const reserved = reserveNamesInCourt(name, shaped);
    const slot = reserved[posIdx] || { main: "", replaced: "" };
    const prevMain = slot.main;
    const updated = Object.assign({}, slot);
    updated.main = name;
    const isIncomingLibero = libSet.has(name);
    const prevWasLibero = libSet.has(prevMain);
    if (isIncomingLibero) {
      updated.replaced = prevWasLibero ? slot.replaced || "" : prevMain || slot.replaced || "";
    } else {
      updated.replaced = "";
    }
    const released = releaseReplacedFromCourt(reserved, name, posIdx);
    released[posIdx] = updated;
    return released;
  }

  function swapCourtSlots(options) {
    const { court, fromIdx, toIdx } = options || {};
    const shaped = ensureCourtShapeFor(court);
    if (fromIdx === toIdx) return shaped;
    const next = cloneCourtLineup(shaped);
    const tmp = next[fromIdx];
    next[fromIdx] = next[toIdx];
    next[toIdx] = tmp;
    return next;
  }

  function clearCourtSlot(options) {
    const { court, posIdx, liberos = [] } = options || {};
    const shaped = ensureCourtShapeFor(court);
    if (typeof posIdx !== "number" || posIdx < 0 || posIdx >= shaped.length) return shaped;
    const slot = Object.assign({}, shaped[posIdx] || { main: "", replaced: "" });
    const libSet = new Set(liberos);
    if (libSet.has(slot.main) && slot.replaced) {
      slot.main = slot.replaced;
      slot.replaced = "";
    } else {
      slot.main = "";
      slot.replaced = "";
    }
    const next = cloneCourtLineup(shaped);
    next[posIdx] = slot;
    return next;
  }

  windowObj.LineupCore = {
    ensureCourtShapeFor,
    cloneCourtLineup,
    reserveNamesInCourt,
    releaseReplacedFromCourt,
    setPlayerOnCourt,
    swapCourtSlots,
    clearCourtSlot
  };
})(typeof window !== "undefined" ? window : self);
