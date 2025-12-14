// Mappa rotazioni -> permutazioni di ricezione allineata a IntelliScout (team.receive_lineup)
const INTELLISCOUT_RECEIVE_ASSIGNMENTS = Object.freeze({
  1: [
    [0, 1],
    [1, 0]
  ],
  2: [
    [2, 4],
    [4, 2]
  ],
  3: [
    [4, 3],
    [5, 4],
    [3, 5]
  ],
  4: [
    [4, 1],
    [5, 4],
    [0, 5],
    [1, 0]
  ],
  5: [
    [2, 4],
    [4, 2]
  ],
  6: [
    [4, 3],
    [5, 4],
    [3, 5]
  ]
});

/**
 * Logica auto-role/autoposizionamento indipendente dal DOM.
 */
(function attachAutoRole(windowObj) {
  function createAutoRole(config) {
    const baseRoles = config.baseRoles || ["P", "S1", "C2", "O", "S2", "C1"];
    const frontRowIndexes = config.frontRowIndexes || new Set([1, 2, 3]);
    const ensureCourtShapeFor =
      config.ensureCourtShapeFor ||
      (court =>
        Array.isArray(court) && court.length === 6
          ? court.map(slot => ({ main: slot.main || "", replaced: slot.replaced || "" }))
          : Array.from({ length: 6 }, () => ({ main: "", replaced: "" })));

    const clampRot = rot => Math.min(6, Math.max(1, parseInt(rot, 10) || 1));

    function applyAssignments(list, pairs) {
      if (!Array.isArray(list) || !Array.isArray(pairs)) return;
      const snapshot = list.slice();
      pairs.forEach(([targetIdx, sourceIdx]) => {
        if (targetIdx === undefined || sourceIdx === undefined) return;
        if (targetIdx < 0 || targetIdx >= snapshot.length) return;
        list[targetIdx] = snapshot[sourceIdx] || list[targetIdx];
      });
    }

    function buildRoleItems(lineup, rotation) {
      const rot = clampRot(rotation);
      const offset = rot - 1;
      return (lineup || []).map((item, idx) => ({
        idx,
        role: baseRoles[(idx - offset + 12) % 6] || "",
        entry: item
      }));
    }

    function buildP1AmericanReceive(lineup, rotation, enabled) {
      if (rotation !== 1 || !enabled) return null;
      const roleItems = buildRoleItems(lineup, rotation);
      const opposite = roleItems.find(r => r.role === "O");
      const outsides = roleItems.filter(r => r.role === "S1" || r.role === "S2");
      if (!opposite || outsides.length === 0) return null;
      const targetOutside =
        outsides.find(r => frontRowIndexes.has(r.idx)) ||
        outsides[0];
      const used = new Set();
      const placeEntry = (targetIdx, entry, acc) => {
        if (!entry) return;
        const names = [entry.slot.main, entry.slot.replaced].filter(Boolean);
        if (names.some(n => used.has(n))) return;
        acc[targetIdx] = entry;
        names.forEach(n => used.add(n));
      };
      const base = lineup.slice();
      const next = Array.from({ length: 6 }, () => ({
        slot: { main: "", replaced: "" },
        idx: -1
      }));
      placeEntry(1, opposite.entry, next); // OP in pos2
      placeEntry(3, targetOutside.entry, next); // OH in pos4
      base.forEach((entry, idx) => {
        if (!entry || !entry.slot) return;
        const names = [entry.slot.main, entry.slot.replaced].filter(Boolean);
        if (names.some(n => used.has(n))) return;
        if (!next[idx] || (!next[idx].slot.main && !next[idx].slot.replaced)) {
          next[idx] = entry;
          names.forEach(n => used.add(n));
        } else {
          const freeIdx = next.findIndex(item => item && !item.slot.main && !item.slot.replaced);
          if (freeIdx !== -1) {
            next[freeIdx] = entry;
            names.forEach(n => used.add(n));
          }
        }
      });
      return next.map((entry, idx) => {
        if (entry && entry.slot) return entry;
        return { slot: { main: "", replaced: "" }, idx };
      });
    }

    function applyReceivePattern(lineup, rotation, options = {}) {
      const american = buildP1AmericanReceive(lineup, rotation, options.autoRoleP1American);
      if (american) return american;
      const rot = clampRot(rotation);
      applyAssignments(lineup, (INTELLISCOUT_RECEIVE_ASSIGNMENTS[rot] || []).slice());
      return lineup;
    }

    function applySwitchPattern(lineup, rotation, isServing) {
      const rot = clampRot(rotation);
      const assignments = [];
      if (rot === 4) {
        assignments.push([4, 5], [5, 4], [1, 3], [3, 1]);
      } else if (rot === 1 && !isServing) {
        assignments.push([4, 5], [5, 4]);
      } else if (rot === 1 && isServing) {
        assignments.push([3, 1], [1, 3], [4, 5], [5, 4]);
      } else if (rot === 2 || rot === 5) {
        assignments.push([3, 2], [2, 3], [4, 0], [0, 4]);
      } else if (rot === 3 || rot === 6) {
        assignments.push([2, 1], [1, 2], [5, 0], [0, 5]);
      }
      applyAssignments(lineup, assignments);
      return lineup;
    }

    function buildAutoRolePermutation(options) {
      const {
        baseLineup,
        rotation,
        phase,
        isServing,
        autoRoleP1American = false
      } = options || {};
      const base = ensureCourtShapeFor(baseLineup);
      const working = base.map((slot, idx) => ({
        slot,
        idx
      }));
      const phaseKey = phase === "receive" ? "receive" : "attack";
      if (phaseKey === "receive") {
        return applyReceivePattern(working, rotation, { autoRoleP1American });
      }
      return applySwitchPattern(working, rotation, !!isServing);
    }

    function applyPhasePermutation(options) {
      const {
        lineup,
        rotation,
        phase,
        isServing = false,
        liberos = []
      } = options || {};
      const permuted = buildAutoRolePermutation({
        baseLineup: lineup,
        rotation,
        phase,
        isServing,
        autoRoleP1American: options.autoRoleP1American
      });
      const libSet = new Set(liberos || []);
      const sanitized = permuted.map(item => ({
        main: (item && item.slot && item.slot.main) || "",
        replaced: (item && item.slot && item.slot.replaced) || ""
      }));
      return sanitized.map((slot, idx) => {
        if (libSet.has(slot.main) && frontRowIndexes.has(idx)) {
          if (slot.replaced) {
            return { main: slot.replaced, replaced: slot.main };
          }
        }
        return slot;
      });
    }

    return {
      buildAutoRolePermutation,
      applyPhasePermutation
    };
  }

  windowObj.AutoRole = { createAutoRole };
})(typeof window !== "undefined" ? window : self);
