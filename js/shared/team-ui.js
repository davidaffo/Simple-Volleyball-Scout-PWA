/**
 * Render a list of player pills with optional edit fields and toggles.
 * This is shared between our roster and the (future) opponent roster to avoid duplication.
 */
(function attachTeamUi(windowObj) {
  const TeamUI = {
    renderTeamPills
  };

  /**
   * @param {Object} options
   * @param {HTMLElement} options.container Where to render pills
   * @param {string[]} options.players Array of player names
   * @param {Object} options.numbers Map name -> jersey number
   * @param {string} [options.emptyMessage] Text shown when list is empty
   * @param {boolean} [options.showLiberoToggle] Enable libero checkbox per pill
   * @param {boolean} [options.showCaptainToggle] Enable captain checkbox per pill
   * @param {Set<string>} [options.liberoSet] Libero names
   * @param {Set<string>} [options.captainSet] Captain names
   * @param {Function} [options.onRename] (idx, name) => void
   * @param {Function} [options.onNumberChange] (name, number) => void
   * @param {Function} [options.onRemove] (idx) => void
   * @param {Function} [options.onToggleLibero] (name, active) => void
   * @param {Function} [options.onToggleCaptain] (name, active) => void
   * @param {Function} [options.fallbackNumber] (idx, name) => number|string
   */
  function renderTeamPills(options) {
    const {
      container,
      players,
      numbers,
      emptyMessage = "Nessuna giocatrice.",
      showLiberoToggle = false,
      showCaptainToggle = false,
      liberoSet = new Set(),
      captainSet = new Set(),
      onRename,
      onNumberChange,
      onRemove,
      onToggleLibero,
      onToggleCaptain,
      fallbackNumber
    } = options || {};

    if (!container) return;
    container.innerHTML = "";

    if (!players || players.length === 0) {
      const empty = document.createElement("div");
      empty.className = "players-empty";
      empty.textContent = emptyMessage;
      container.appendChild(empty);
      return;
    }

    players.forEach((name, idx) => {
      const pill = document.createElement("div");
      pill.className = "player-pill";

      const view = document.createElement("div");
      view.className = "pill-view";

      const number = document.createElement("span");
      number.className = "pill-index";
      const mappedNum = numbers && numbers[name];
      const fallbackNum = fallbackNumber ? fallbackNumber(idx, name) : idx + 1;
      number.textContent = "#" + (mappedNum || fallbackNum || idx + 1);

      const label = document.createElement("span");
      label.className = "pill-name";
      label.textContent = name;

      view.appendChild(number);
      view.appendChild(label);

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "pill-edit-btn";
      editBtn.textContent = "✎";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = name;
      nameInput.className = "pill-name-input";
      if (onRename) {
        nameInput.addEventListener("change", () => onRename(idx, nameInput.value));
      } else {
        nameInput.disabled = true;
      }

      const numInput = document.createElement("input");
      numInput.type = "number";
      numInput.min = "0";
      numInput.max = "999";
      numInput.className = "pill-number-input";
      numInput.value = mappedNum || "";
      if (onNumberChange) {
        numInput.addEventListener("change", () => onNumberChange(name, numInput.value));
      } else {
        numInput.disabled = true;
      }

      editBtn.addEventListener("click", () => {
        pill.classList.toggle("editing");
        if (pill.classList.contains("editing")) {
          nameInput.focus();
        }
      });

      const editFields = document.createElement("div");
      editFields.className = "pill-edit-fields";
      editFields.appendChild(nameInput);
      editFields.appendChild(numInput);

      pill.appendChild(view);
      pill.appendChild(editBtn);

      if (showLiberoToggle || showCaptainToggle) {
        const toggles = document.createElement("div");
        toggles.className = "pill-toggles";
        if (showLiberoToggle) {
          const liberoLabel = document.createElement("label");
          const liberoChk = document.createElement("input");
          liberoChk.type = "checkbox";
          liberoChk.checked = liberoSet.has(name);
          if (onToggleLibero) {
            liberoChk.addEventListener("change", () => onToggleLibero(name, liberoChk.checked));
          } else {
            liberoChk.disabled = true;
          }
          liberoLabel.appendChild(liberoChk);
          liberoLabel.appendChild(document.createTextNode("L"));
          toggles.appendChild(liberoLabel);
        }
        if (showCaptainToggle) {
          const captainLabel = document.createElement("label");
          const captainChk = document.createElement("input");
          captainChk.type = "checkbox";
          captainChk.checked = captainSet.has(name);
          if (onToggleCaptain) {
            captainChk.addEventListener("change", () => onToggleCaptain(name, captainChk.checked));
          } else {
            captainChk.disabled = true;
          }
          captainLabel.appendChild(captainChk);
          captainLabel.appendChild(document.createTextNode("C"));
          toggles.appendChild(captainLabel);
        }
        editFields.appendChild(toggles);
      }

      pill.appendChild(editFields);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "pill-remove";
      removeBtn.dataset.playerIdx = String(idx);
      removeBtn.textContent = "✕";
      if (onRemove) {
        removeBtn.addEventListener("click", () => onRemove(idx));
      } else {
        removeBtn.disabled = true;
      }
      pill.appendChild(removeBtn);

      container.appendChild(pill);
    });
  }

  windowObj.TeamUI = TeamUI;
})(window);
