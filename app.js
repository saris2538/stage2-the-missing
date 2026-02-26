const STORAGE_KEY = "stage2_casefiles_progress_v3";

const NAMES = ["Mr.B","Mr.F","Mr.G","Mr.A","Mr.H","Mr.C","Mr.D","Mr.E"];

const ANSWER = {
  "Mr.B": { A:"FALSE", B:"FALSE", C:"FALSE", D:"TRUE",  M:"Missing" },
  "Mr.F": { A:"TRUE",  B:"FALSE", C:"FALSE", D:"FALSE", M:"Not Missing" },
  "Mr.G": { A:"FALSE", B:"FALSE", C:"TRUE",  D:"FALSE", M:"Not Missing" },
  "Mr.A": { A:"TRUE",  B:"FALSE", C:"TRUE",  D:"FALSE", M:"Missing" },
  "Mr.H": { A:"TRUE",  B:"TRUE",  C:"TRUE",  D:"FALSE", M:"Missing" },
  "Mr.C": { A:"TRUE",  B:"TRUE",  C:"FALSE", D:"FALSE", M:"Not Missing" },
  "Mr.D": { A:"FALSE", B:"TRUE",  C:"TRUE",  D:"FALSE", M:"Not Missing" },
  "Mr.E": { A:"FALSE", B:"TRUE",  C:"FALSE", D:"FALSE", M:"Not Missing" },
};

// DOM
const tbody = document.getElementById("tbody");
const statusBox = document.getElementById("statusBox");
const statusText = document.getElementById("statusText");
const exportBtn = document.getElementById("exportBtn");
const resetBtn = document.getElementById("resetBtn");
const card = document.getElementById("card");

// Restore modal
const restoreBackdrop = document.getElementById("restoreBackdrop");
const confirmRestoreBtn = document.getElementById("confirmRestoreBtn");
const discardRestoreBtn = document.getElementById("discardRestoreBtn");

// -------- build selects --------
function makeBoolSelect() {
  const sel = document.createElement("select");
  sel.innerHTML = `
    <option value="">--</option>
    <option value="TRUE">True</option>
    <option value="FALSE">False</option>
  `;
  return sel;
}

function makeMissingSelect() {
  const sel = document.createElement("select");
  sel.innerHTML = `
    <option value="">--</option>
    <option value="Missing">Missing</option>
    <option value="Not Missing">Not Missing</option>
  `;
  return sel;
}

function updateBoolColor(td, val) {
  td.classList.remove("cell-true", "cell-false");
  if (val === "TRUE") td.classList.add("cell-true");
  if (val === "FALSE") td.classList.add("cell-false");
}

function updateMissingColor(td, val) {
  td.classList.remove("cell-missing", "cell-notmissing");
  if (val === "Missing") td.classList.add("cell-missing");
  if (val === "Not Missing") td.classList.add("cell-notmissing");
}

function buildRow(name) {
  const tr = document.createElement("tr");

  const th = document.createElement("th");
  th.textContent = name;
  tr.appendChild(th);

  ["A","B","C","D"].forEach((k) => {
    const td = document.createElement("td");
    td.classList.add("bool-cell");

    const sel = makeBoolSelect();
    sel.dataset.name = name;
    sel.dataset.col = k;

    sel.addEventListener("change", () => {
      updateBoolColor(td, sel.value);
      autoSave();
      validateIfComplete();
    });

    td.appendChild(sel);
    tr.appendChild(td);
  });

  // Missing column
  {
    const td = document.createElement("td");
    td.classList.add("missing-cell");

    const sel = makeMissingSelect();
    sel.dataset.name = name;
    sel.dataset.col = "M";

    sel.addEventListener("change", () => {
      updateMissingColor(td, sel.value);
      autoSave();
      validateIfComplete();
    });

    td.appendChild(sel);
    tr.appendChild(td);
  }

  return tr;
}

NAMES.forEach(n => tbody.appendChild(buildRow(n)));

// -------- read table state --------
function getAllInputs() {
  const data = {};
  tbody.querySelectorAll("select").forEach(sel => {
    const name = sel.dataset.name;
    const col = sel.dataset.col;
    data[name] ??= {};
    data[name][col] = sel.value;
  });
  return data;
}

function isComplete(data) {
  return NAMES.every(n =>
    data[n] && ["A","B","C","D","M"].every(k => data[n][k] && data[n][k] !== "")
  );
}

function isCorrect(data) {
  return NAMES.every(n => {
    const a = ANSWER[n];
    const d = data[n];
    return d.A === a.A && d.B === a.B && d.C === a.C && d.D === a.D && d.M === a.M;
  });
}

function setStatus(kind, text) {
  statusBox.classList.remove("ok","bad");
  if (kind === "ok") statusBox.classList.add("ok");
  if (kind === "bad") statusBox.classList.add("bad");
  statusText.textContent = text;
}

function validateIfComplete() {
  const data = getAllInputs();

  if (!isComplete(data)) {
    exportBtn.disabled = true;
    setStatus(null, "Fill in every cell. The system will validate automatically.");
    return;
  }

  if (isCorrect(data)) {
    exportBtn.disabled = false;
    setStatus("ok", "✅ Correct! Click “Export as Image (PNG)” to save your table.");
  } else {
    exportBtn.disabled = true;
    setStatus("bad", "❌ Something is still incorrect. Please fix it and try again.");
  }
}

// -------- autosave / restore --------
function autoSave() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getAllInputs()));
  } catch (e) {
    console.warn("localStorage save failed:", e);
  }
}

function loadSavedProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearSavedProgress() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function hasAnyValue(data) {
  if (!data || typeof data !== "object") return false;
  return NAMES.some(n => {
    const row = data[n];
    if (!row) return false;
    return ["A","B","C","D","M"].some(k => row[k] && row[k] !== "");
  });
}

function applyProgress(data) {
  tbody.querySelectorAll("select").forEach(sel => {
    const name = sel.dataset.name;
    const col = sel.dataset.col;
    const val = data?.[name]?.[col] ?? "";
    sel.value = val;

    const td = sel.closest("td");
    if (!td) return;
    if (col === "M") updateMissingColor(td, val);
    else updateBoolColor(td, val);
  });

  validateIfComplete();
}

function openRestoreModal() {
  restoreBackdrop.classList.add("show");
  restoreBackdrop.setAttribute("aria-hidden", "false");
}
function closeRestoreModal() {
  restoreBackdrop.classList.remove("show");
  restoreBackdrop.setAttribute("aria-hidden", "true");
}

// -------- export (fix text cropping by replacing <select> in clone) --------
async function exportTablePNG() {
  if (typeof html2canvas !== "function") {
    alert("html2canvas is not loaded. Check the CDN script tag in index.html.");
    return;
  }

  const tableArea = document.getElementById("tableArea");

  // ✅ Read current values from the REAL table first
  const currentData = getAllInputs();

  // Clone tableArea
  const clone = tableArea.cloneNode(true);

  // Replace selects in clone with plain text blocks (using REAL values)
  const cloneSelects = clone.querySelectorAll("select");
  cloneSelects.forEach(sel => {
    const td = sel.closest("td");
    const name = sel.dataset.name;
    const col = sel.dataset.col;

    const rawVal = currentData?.[name]?.[col] ?? "";
    const displayVal =
      rawVal === "" ? "--" :
      rawVal === "TRUE" ? "True" :
      rawVal === "FALSE" ? "False" :
      rawVal; // "Missing" / "Not Missing"

    const block = document.createElement("div");
    block.textContent = displayVal;

    // Make it match full-cell style + ensure visible text
    block.style.width = "100%";
    block.style.height = "100%";
    block.style.minHeight = "60px";
    block.style.display = "flex";
    block.style.alignItems = "center";
    block.style.justifyContent = "center";
    block.style.fontWeight = "800";
    block.style.fontSize = "16px";
    block.style.lineHeight = "1.2";
    block.style.padding = "14px 12px";
    block.style.background = "transparent";
    block.style.color = "#111"; // ✅ ensure text not invisible

    sel.replaceWith(block);

    // Ensure full background fill
    if (td) td.style.padding = "0";
  });

  // Put clone offscreen so html2canvas can render it
  const sandbox = document.createElement("div");
  sandbox.style.position = "fixed";
  sandbox.style.left = "-99999px";
  sandbox.style.top = "0";
  sandbox.style.background = "#ffffff";
  sandbox.appendChild(clone);
  document.body.appendChild(sandbox);

  // Hide UI on real card during export
  card.classList.add("exporting");
  await new Promise(r => setTimeout(r, 50));

  const canvas = await html2canvas(clone, {
    backgroundColor: "#ffffff",
    scale: 2
  });

  card.classList.remove("exporting");
  document.body.removeChild(sandbox);

  const link = document.createElement("a");
  link.download = "case-files-summary.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// -------- reset --------
function resetAll() {
  tbody.querySelectorAll("select").forEach(sel => {
    sel.value = "";
    const td = sel.closest("td");
    if (!td) return;
    td.classList.remove("cell-true","cell-false","cell-missing","cell-notmissing");
  });
  clearSavedProgress();
  exportBtn.disabled = true;
  setStatus(null, "Fill in every cell. The system will validate automatically.");
}

// Bind buttons
exportBtn.addEventListener("click", exportTablePNG);
resetBtn.addEventListener("click", resetAll);

// Init restore flow
(function initRestoreFlow() {
  const saved = loadSavedProgress();
  if (saved && hasAnyValue(saved)) {
    openRestoreModal();

    confirmRestoreBtn.onclick = () => {
      applyProgress(saved);
      closeRestoreModal();
    };

    discardRestoreBtn.onclick = () => {
      clearSavedProgress();
      closeRestoreModal();
      validateIfComplete();
    };
  } else {
    validateIfComplete();
  }
})();