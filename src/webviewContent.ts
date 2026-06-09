/**
 * Generates the full HTML document for the spreadsheet webview.
 *
 * IMPORTANT: the client script lives inside a template literal, so every
 * backslash that must reach the browser has to be doubled (e.g. '\\n' emits
 * a real newline escape in the generated script). Colors in text mode are
 * applied with CSS *classes*, never inline `style=` attributes, because the
 * Content-Security-Policy below only allows nonce'd styles — inline style
 * attributes are blocked and would silently lose all highlighting.
 */
export function getWebviewHtml(nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${nonce}">
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-panel-border, #444);
      --header-bg: var(--vscode-editorGroupHeader-tabsBackground, #252526);
      --hover: var(--vscode-list-hoverBackground, #2a2d2e);
      --selection: var(--vscode-editor-selectionBackground, #264f78);
      --input-bg: var(--vscode-input-background, #3c3c3c);
      --input-border: var(--vscode-input-border, #555);
      --input-fg: var(--vscode-input-foreground, #ccc);
      --btn-bg: var(--vscode-button-background, #0e639c);
      --btn-fg: var(--vscode-button-foreground, #fff);
      --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
      --highlight-bg: #ffe08a33;
      --highlight-strong: #ffd24d66;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
      font-size: var(--vscode-font-size, 13px);
      background: var(--bg);
      color: var(--fg);
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: var(--header-bg);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .toolbar button {
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      padding: 4px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      white-space: nowrap;
    }
    .toolbar button:hover { background: var(--btn-hover); }
    .toolbar button.active {
      outline: 2px solid var(--vscode-focusBorder, #007fd4);
    }
    .toolbar select {
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      padding: 3px 6px;
      border-radius: 3px;
      font-size: 12px;
    }
    .toolbar .separator {
      width: 1px;
      height: 20px;
      background: var(--border);
      margin: 0 4px;
    }
    .toolbar .file-name {
      font-weight: bold;
      margin-right: 8px;
      opacity: 0.8;
    }

    /* Find & Replace Panel */
    .find-replace-panel {
      display: none;
      padding: 8px 10px;
      background: var(--header-bg);
      border-bottom: 1px solid var(--border);
      gap: 6px;
      flex-shrink: 0;
    }
    .find-replace-panel.visible { display: flex; flex-wrap: wrap; align-items: center; }
    .find-replace-panel input {
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 12px;
      width: 200px;
    }
    .find-replace-panel .match-info {
      font-size: 11px;
      opacity: 0.7;
      min-width: 80px;
    }

    /* Sheet tabs */
    .sheet-tabs {
      display: flex;
      gap: 0;
      background: var(--header-bg);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      overflow-x: auto;
    }
    .sheet-tab {
      padding: 5px 14px;
      cursor: pointer;
      border-right: 1px solid var(--border);
      font-size: 12px;
      white-space: nowrap;
      opacity: 0.7;
    }
    .sheet-tab:hover { background: var(--hover); }
    .sheet-tab.active {
      opacity: 1;
      background: var(--bg);
      border-bottom: 2px solid var(--btn-bg);
    }

    /* Table container */
    .table-container {
      flex: 1;
      overflow: auto;
      position: relative;
    }
    table {
      border-collapse: collapse;
      min-width: 100%;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 4px 8px;
      text-align: left;
      white-space: nowrap;
      min-width: 80px;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
    }
    th {
      background: var(--header-bg);
      position: sticky;
      top: 0;
      z-index: 2;
      cursor: pointer;
      user-select: none;
    }
    th:hover { background: var(--hover); }
    th .sort-arrow { margin-left: 4px; opacity: 0.5; font-size: 10px; }
    th .sort-arrow.active { opacity: 1; }

    /* Row header (row numbers) */
    td.row-num {
      background: var(--header-bg);
      position: sticky;
      left: 0;
      z-index: 1;
      text-align: center;
      min-width: 50px;
      max-width: 50px;
      color: var(--fg);
      opacity: 0.6;
      font-size: 11px;
    }
    th.corner {
      position: sticky;
      left: 0;
      z-index: 3;
      min-width: 50px;
      max-width: 50px;
    }

    tr:hover td:not(.row-num) { background: var(--hover); }

    td.editing {
      padding: 0;
    }
    td.editing input {
      width: 100%;
      height: 100%;
      border: 2px solid var(--btn-bg);
      background: var(--input-bg);
      color: var(--input-fg);
      padding: 3px 7px;
      font-size: 12px;
      outline: none;
    }

    td.selected {
      outline: 2px solid var(--btn-bg);
      outline-offset: -2px;
    }

    td.highlight {
      background: var(--highlight-bg) !important;
    }

    .status-bar {
      padding: 3px 10px;
      background: var(--header-bg);
      border-top: 1px solid var(--border);
      font-size: 11px;
      opacity: 0.7;
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
    }

    /* Add row/col buttons */
    .add-btn {
      background: transparent;
      border: 1px dashed var(--border);
      color: var(--fg);
      opacity: 0.4;
      cursor: pointer;
      padding: 4px 8px;
      font-size: 12px;
    }
    .add-btn:hover { opacity: 0.8; }

    /* View mode toggle */
    .view-toggle {
      display: inline-flex;
      border: 1px solid var(--border);
      border-radius: 3px;
      overflow: hidden;
    }
    .view-toggle button {
      background: transparent;
      color: var(--fg);
      border: none;
      padding: 4px 12px;
      cursor: pointer;
      font-size: 12px;
      border-radius: 0;
      opacity: 0.6;
    }
    .view-toggle button:hover { background: var(--hover); opacity: 0.8; }
    .view-toggle button.active {
      background: var(--btn-bg);
      color: var(--btn-fg);
      opacity: 1;
      outline: none;
    }

    /* Text mode container */
    .text-container {
      flex: 1;
      overflow: auto;
      display: none;
      padding: 0;
      background: var(--bg);
    }
    .text-container.visible { display: block; }
    .text-container pre {
      margin: 0;
      padding: 10px;
      font-family: var(--vscode-editor-fontFamily, 'Consolas', 'Courier New', monospace);
      font-size: var(--vscode-editor-fontSize, 13px);
      line-height: 1.5;
      white-space: pre;
      tab-size: 4;
    }
    .text-container .line-num {
      display: inline-block;
      min-width: 45px;
      text-align: right;
      padding-right: 12px;
      opacity: 0.4;
      user-select: none;
    }
    .text-container .text-empty { opacity: 0.5; }
    /* Column separators dimmed; inherit their column color */
    .text-container .rsep { opacity: 0.5; }
    /* One block per row so an entire matched line can be tinted */
    .text-container .text-line { display: block; }
    /* Find highlighting in text mode (CSP-safe: classes, not inline styles) */
    .text-container .row-match { background: var(--highlight-bg); }
    .text-container .hl { background: var(--highlight-bg); border-radius: 2px; }
    .text-container .hl-current {
      background: var(--highlight-strong);
      outline: 2px solid var(--btn-bg);
      outline-offset: -1px;
      border-radius: 2px;
    }

    /*
     * Rainbow column colors for text mode. Applied via CSS classes (NOT inline
     * style attributes) so they survive the nonce-only style-src CSP. Dark theme
     * values are the default; VS Code adds a body class for the active theme kind.
     */
    .rc0 { color: #f87171; } /* red */
    .rc1 { color: #fb923c; } /* orange */
    .rc2 { color: #38bdf8; } /* sky */
    .rc3 { color: #4ade80; } /* green */
    .rc4 { color: #c084fc; } /* violet */
    .rc5 { color: #f472b6; } /* pink */
    .rc6 { color: #60a5fa; } /* blue */
    .rc7 { color: #fbbf24; } /* amber */
    .rc8 { color: #a78bfa; } /* purple */
    .rc9 { color: #34d399; } /* emerald */

    body.vscode-light .rc0 { color: #c41a1a; }
    body.vscode-light .rc1 { color: #b45309; }
    body.vscode-light .rc2 { color: #0e7490; }
    body.vscode-light .rc3 { color: #15803d; }
    body.vscode-light .rc4 { color: #7c3aed; }
    body.vscode-light .rc5 { color: #be185d; }
    body.vscode-light .rc6 { color: #0369a1; }
    body.vscode-light .rc7 { color: #a16207; }
    body.vscode-light .rc8 { color: #6d28d9; }
    body.vscode-light .rc9 { color: #047857; }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="file-name" id="fileName"></span>
    <div class="separator"></div>
    <div class="view-toggle">
      <button id="btnViewTable" class="active" title="Table View">Table</button>
      <button id="btnViewText" title="Text View">Text</button>
    </div>
    <div class="separator"></div>
    <button id="btnFindReplace" title="Find & Replace">Find & Replace</button>
    <button id="btnAddRow" title="Add Row">+ Row</button>
    <button id="btnAddCol" title="Add Column">+ Column</button>
    <button id="btnDeleteRow" title="Delete Selected Row">- Row</button>
    <button id="btnDeleteCol" title="Delete Selected Column">- Column</button>
    <div class="separator"></div>
    <select id="sheetSelect"></select>
  </div>

  <div class="find-replace-panel" id="findReplacePanel">
    <input type="text" id="findInput" placeholder="Find..." />
    <button id="btnFindPrev">Prev</button>
    <button id="btnFindNext">Next</button>
    <span class="match-info" id="matchInfo">0 / 0</span>
    <div class="separator"></div>
    <input type="text" id="replaceInput" placeholder="Replace..." />
    <button id="btnReplace">Replace</button>
    <button id="btnReplaceAll">Replace All</button>
    <div class="separator"></div>
    <button id="btnCloseFind">Close</button>
  </div>

  <div class="sheet-tabs" id="sheetTabs"></div>

  <div class="table-container" id="tableContainer">
    <table id="spreadsheet"></table>
  </div>

  <div class="text-container" id="textContainer">
    <pre id="textContent"></pre>
  </div>

  <div class="status-bar">
    <span id="statusLeft">Ready</span>
    <span id="statusRight"></span>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    let sheets = {};
    let sheetNames = [];
    let currentSheet = '';
    let fileExt = '';
    let sortCol = -1;
    let sortAsc = true;
    let selectedCell = null; // { row, col }
    let editingCell = null;
    let findMatches = [];
    let findIndex = -1;

    // Number of distinct rainbow column colors defined in CSS (.rc0 .. .rc9)
    const RAINBOW_COUNT = 10;

    // Widest row in the data. Computed with a loop (not Math.max(...spread)),
    // which would throw a RangeError once a sheet has more rows than the JS
    // argument limit (~10^5), breaking rendering on large files.
    function colCount(data) {
      let max = 0;
      for (let i = 0; i < data.length; i++) {
        const len = (data[i] || []).length;
        if (len > max) max = len;
      }
      return max;
    }

    // Stable key for a cell, used for O(1) match lookups during rendering.
    function cellKey(row, col) { return row + ':' + col; }

    // Elements
    const table = document.getElementById('spreadsheet');
    const container = document.getElementById('tableContainer');
    const sheetTabsEl = document.getElementById('sheetTabs');
    const sheetSelect = document.getElementById('sheetSelect');
    const fileNameEl = document.getElementById('fileName');
    const statusLeft = document.getElementById('statusLeft');
    const statusRight = document.getElementById('statusRight');
    const findReplacePanel = document.getElementById('findReplacePanel');
    const findInput = document.getElementById('findInput');
    const replaceInput = document.getElementById('replaceInput');
    const matchInfo = document.getElementById('matchInfo');

    // Tell extension we're ready
    vscode.postMessage({ type: 'ready' });

    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.type === 'load') {
        sheets = msg.sheets;
        sheetNames = msg.sheetNames;
        fileExt = msg.fileExt || '';
        fileNameEl.textContent = msg.fileName;
        currentSheet = sheetNames[0] || '';
        // Reset transient view state so a reload (e.g. after revert) starts clean.
        sortCol = -1;
        sortAsc = true;
        selectedCell = null;
        editingCell = null;
        findMatches = [];
        findIndex = -1;
        buildSheetTabs();
        render();
        statusRight.textContent = msg.fileExt.toUpperCase().slice(1) + ' file';
      }
    });

    function buildSheetTabs() {
      sheetTabsEl.innerHTML = '';
      sheetSelect.innerHTML = '';
      sheetNames.forEach((name) => {
        const tab = document.createElement('div');
        tab.className = 'sheet-tab' + (name === currentSheet ? ' active' : '');
        tab.textContent = name;
        tab.onclick = () => { currentSheet = name; buildSheetTabs(); render(); };
        sheetTabsEl.appendChild(tab);

        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        opt.selected = name === currentSheet;
        sheetSelect.appendChild(opt);
      });
    }

    sheetSelect.addEventListener('change', () => {
      currentSheet = sheetSelect.value;
      buildSheetTabs();
      render();
    });

    function getData() {
      return sheets[currentSheet] || [];
    }

    function setData(data) {
      sheets[currentSheet] = data;
    }

    function notifyEdit() {
      vscode.postMessage({ type: 'edit', sheets, sheetNames });
    }

    // Render whichever view is currently active.
    function render() {
      if (viewMode === 'text') {
        renderTextMode();
        statusLeft.textContent = getData().length + ' lines (text mode)';
      } else {
        renderTable();
      }
    }

    function renderTable() {
      const data = getData();
      if (!data.length) {
        table.innerHTML = '<tr><th>Empty sheet</th></tr>';
        statusLeft.textContent = '0 rows, 0 columns';
        return;
      }

      const maxCols = colCount(data);
      // Precompute matched cells once: avoids an O(cells × matches) scan.
      const matchSet = new Set();
      for (const m of findMatches) matchSet.add(cellKey(m.row, m.col));

      let html = '<thead><tr><th class="corner">#</th>';
      for (let c = 0; c < maxCols; c++) {
        const arrow = sortCol === c ? (sortAsc ? '▲' : '▼') : '⇅';
        const activeClass = sortCol === c ? ' active' : '';
        html += '<th data-col="' + c + '">' + colLabel(c) + ' <span class="sort-arrow' + activeClass + '">' + arrow + '</span></th>';
      }
      html += '</tr></thead><tbody>';

      for (let r = 0; r < data.length; r++) {
        html += '<tr>';
        html += '<td class="row-num">' + (r + 1) + '</td>';
        const row = data[r] || [];
        for (let c = 0; c < maxCols; c++) {
          const val = c < row.length ? row[c] : '';
          const isSelected = selectedCell && selectedCell.row === r && selectedCell.col === c;
          let cls = '';
          if (isSelected) cls += ' selected';
          if (matchSet.has(cellKey(r, c))) cls += ' highlight';
          html += '<td data-row="' + r + '" data-col="' + c + '" class="' + cls.trim() + '">' + escapeHtml(String(val)) + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody>';
      table.innerHTML = html;
      statusLeft.textContent = data.length + ' rows, ' + maxCols + ' columns';
    }

    // Event delegation: a single click/dblclick listener for the entire table,
    // bound once, instead of re-binding listeners to every cell on each render.
    // Re-binding per cell was O(cells) work and memory churn on every redraw.
    function closestEl(node, selector) {
      const el = node && node.closest ? node : (node && node.parentElement);
      return el ? el.closest(selector) : null;
    }
    table.addEventListener('click', (e) => {
      const td = closestEl(e.target, 'td[data-row]');
      if (td) { selectCell(parseInt(td.getAttribute('data-row')), parseInt(td.getAttribute('data-col'))); return; }
      const th = closestEl(e.target, 'th[data-col]');
      if (th) sortBy(parseInt(th.getAttribute('data-col')));
    });
    table.addEventListener('dblclick', (e) => {
      const td = closestEl(e.target, 'td[data-row]');
      if (td) startEditing(parseInt(td.getAttribute('data-row')), parseInt(td.getAttribute('data-col')));
    });

    function sortBy(col) {
      if (sortCol === col) { sortAsc = !sortAsc; } else { sortCol = col; sortAsc = true; }
      sortData();
      renderTable();
    }

    function selectCell(row, col) {
      if (editingCell) commitEdit();
      selectedCell = { row, col };
      // Update visual
      table.querySelectorAll('td.selected').forEach(el => el.classList.remove('selected'));
      const td = table.querySelector('td[data-row="' + row + '"][data-col="' + col + '"]');
      if (td) td.classList.add('selected');
    }

    function startEditing(row, col) {
      if (editingCell) commitEdit();
      selectedCell = { row, col };
      editingCell = { row, col };
      const td = table.querySelector('td[data-row="' + row + '"][data-col="' + col + '"]');
      if (!td) return;
      const data = getData();
      const val = (data[row] && data[row][col] !== undefined) ? String(data[row][col]) : '';
      td.classList.add('editing');
      td.innerHTML = '<input type="text" value="' + escapeAttr(val) + '" />';
      const input = td.querySelector('input');
      input.focus();
      input.select();
      input.addEventListener('blur', () => commitEdit());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { commitEdit(); e.preventDefault(); }
        if (e.key === 'Escape') { cancelEdit(); e.preventDefault(); }
        if (e.key === 'Tab') {
          e.preventDefault();
          commitEdit();
          const nextCol = e.shiftKey ? col - 1 : col + 1;
          if (nextCol >= 0) {
            selectCell(row, nextCol);
            startEditing(row, nextCol);
          }
        }
        e.stopPropagation();
      });
    }

    function commitEdit() {
      if (!editingCell) return;
      const { row, col } = editingCell;
      const td = table.querySelector('td[data-row="' + row + '"][data-col="' + col + '"]');
      if (!td) { editingCell = null; return; }
      const input = td.querySelector('input');
      if (!input) { editingCell = null; return; }
      const newVal = input.value;
      const data = getData();
      while (data.length <= row) data.push([]);
      while (data[row].length <= col) data[row].push('');
      data[row][col] = newVal;
      setData(data);
      editingCell = null;
      notifyEdit();
      renderTable();
      selectCell(row, col);
    }

    function cancelEdit() {
      if (!editingCell) return;
      const { row, col } = editingCell;
      editingCell = null;
      renderTable();
      selectCell(row, col);
    }

    function sortData() {
      const data = getData();
      if (data.length < 2 || sortCol < 0) return;
      // Sort all rows (treat first row as header? No—sort everything for simplicity)
      data.sort((a, b) => {
        const va = (a[sortCol] !== undefined ? a[sortCol] : '');
        const vb = (b[sortCol] !== undefined ? b[sortCol] : '');
        const na = Number(va), nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb) && va !== '' && vb !== '') {
          return sortAsc ? na - nb : nb - na;
        }
        const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
        return sortAsc ? cmp : -cmp;
      });
      setData(data);
      notifyEdit();
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (editingCell) return;
      // Don't intercept if find input is focused
      if (document.activeElement === findInput || document.activeElement === replaceInput) return;

      if (!selectedCell) return;
      const { row, col } = selectedCell;
      const data = getData();
      const maxRows = data.length;
      const maxCols = colCount(data);

      if (e.key === 'ArrowUp' && row > 0) { selectCell(row - 1, col); e.preventDefault(); }
      if (e.key === 'ArrowDown' && row < maxRows - 1) { selectCell(row + 1, col); e.preventDefault(); }
      if (e.key === 'ArrowLeft' && col > 0) { selectCell(row, col - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight' && col < maxCols - 1) { selectCell(row, col + 1); e.preventDefault(); }
      if (e.key === 'Enter') { startEditing(row, col); e.preventDefault(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        while (data.length <= row) data.push([]);
        while (data[row].length <= col) data[row].push('');
        data[row][col] = '';
        setData(data);
        notifyEdit();
        renderTable();
        selectCell(row, col);
        e.preventDefault();
      }
      // Start typing to edit
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        startEditing(row, col);
      }
    });

    // Find & Replace
    document.getElementById('btnFindReplace').addEventListener('click', () => {
      findReplacePanel.classList.toggle('visible');
      if (findReplacePanel.classList.contains('visible')) {
        findInput.focus();
      } else {
        clearFind();
      }
    });

    document.getElementById('btnCloseFind').addEventListener('click', () => {
      findReplacePanel.classList.remove('visible');
      clearFind();
    });

    findInput.addEventListener('input', () => {
      doFind();
    });

    document.getElementById('btnFindNext').addEventListener('click', () => {
      if (findMatches.length === 0) return;
      findIndex = (findIndex + 1) % findMatches.length;
      goToMatch();
    });

    document.getElementById('btnFindPrev').addEventListener('click', () => {
      if (findMatches.length === 0) return;
      findIndex = (findIndex - 1 + findMatches.length) % findMatches.length;
      goToMatch();
    });

    document.getElementById('btnReplace').addEventListener('click', () => {
      if (findMatches.length === 0 || findIndex < 0) return;
      const m = findMatches[findIndex];
      const data = getData();
      const val = String(data[m.row][m.col]);
      const search = findInput.value;
      data[m.row][m.col] = val.split(search).join(replaceInput.value);
      setData(data);
      notifyEdit();
      doFind();
      render();
    });

    document.getElementById('btnReplaceAll').addEventListener('click', () => {
      if (findMatches.length === 0) return;
      const data = getData();
      const search = findInput.value;
      const repl = replaceInput.value;
      for (const m of findMatches) {
        const val = String(data[m.row][m.col]);
        data[m.row][m.col] = val.split(search).join(repl);
      }
      setData(data);
      notifyEdit();
      doFind();
      render();
    });

    function doFind() {
      findMatches = [];
      findIndex = -1;
      const query = findInput.value;
      if (!query) { matchInfo.textContent = '0 / 0'; render(); return; }
      const data = getData();
      const lower = query.toLowerCase();
      for (let r = 0; r < data.length; r++) {
        const row = data[r] || [];
        for (let c = 0; c < row.length; c++) {
          if (String(row[c]).toLowerCase().includes(lower)) {
            findMatches.push({ row: r, col: c });
          }
        }
      }
      if (findMatches.length > 0) findIndex = 0;
      matchInfo.textContent = findMatches.length > 0 ? '1 / ' + findMatches.length : '0 / 0';
      render();
      if (findMatches.length > 0) goToMatch();
    }

    // Reveal the current match in whichever view is active. Only the
    // current-match marker is moved (no full re-render), so navigating between
    // matches stays cheap even on very large sheets.
    function goToMatch() {
      if (findIndex < 0 || findIndex >= findMatches.length) return;
      const m = findMatches[findIndex];
      matchInfo.textContent = (findIndex + 1) + ' / ' + findMatches.length;
      if (viewMode === 'text') {
        textContent.querySelectorAll('.hl-current').forEach(el => el.classList.remove('hl-current'));
        const el = textContent.querySelector('[data-r="' + m.row + '"][data-c="' + m.col + '"]');
        if (el) {
          el.classList.add('hl-current');
          el.scrollIntoView({ block: 'center', inline: 'center' });
        }
      } else {
        selectCell(m.row, m.col);
        const td = table.querySelector('td[data-row="' + m.row + '"][data-col="' + m.col + '"]');
        if (td) td.scrollIntoView({ block: 'center', inline: 'center' });
      }
    }

    function clearFind() {
      findMatches = [];
      findIndex = -1;
      findInput.value = '';
      replaceInput.value = '';
      matchInfo.textContent = '0 / 0';
      render();
    }

    // Add Row
    document.getElementById('btnAddRow').addEventListener('click', () => {
      const data = getData();
      const maxCols = data.length > 0 ? Math.max(colCount(data), 1) : 1;
      const insertAt = selectedCell ? selectedCell.row + 1 : data.length;
      data.splice(insertAt, 0, new Array(maxCols).fill(''));
      setData(data);
      notifyEdit();
      renderTable();
    });

    // Add Column
    document.getElementById('btnAddCol').addEventListener('click', () => {
      const data = getData();
      const insertAt = selectedCell ? selectedCell.col + 1 : (data[0] ? data[0].length : 0);
      for (const row of data) {
        while (row.length <= insertAt) row.push('');
        row.splice(insertAt, 0, '');
      }
      setData(data);
      notifyEdit();
      renderTable();
    });

    // Delete Row
    document.getElementById('btnDeleteRow').addEventListener('click', () => {
      if (!selectedCell) return;
      const data = getData();
      if (data.length <= 1) return;
      data.splice(selectedCell.row, 1);
      if (selectedCell.row >= data.length) selectedCell.row = data.length - 1;
      setData(data);
      notifyEdit();
      renderTable();
    });

    // Delete Column
    document.getElementById('btnDeleteCol').addEventListener('click', () => {
      if (!selectedCell) return;
      const data = getData();
      for (const row of data) {
        if (selectedCell.col < row.length) row.splice(selectedCell.col, 1);
      }
      const cols = colCount(data);
      if (selectedCell.col >= cols) selectedCell.col = Math.max(0, cols - 1);
      setData(data);
      notifyEdit();
      renderTable();
    });

    // Helpers
    function colLabel(n) {
      let s = '';
      while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
      return s;
    }
    function escapeHtml(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function escapeAttr(s) {
      return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ── View mode toggle ──
    let viewMode = 'table'; // 'table' | 'text'
    const tableContainer = document.getElementById('tableContainer');
    const textContainer = document.getElementById('textContainer');
    const textContent = document.getElementById('textContent');
    const btnViewTable = document.getElementById('btnViewTable');
    const btnViewText = document.getElementById('btnViewText');

    // Render the current sheet as delimited text with per-column rainbow colors.
    // Colors come from CSS classes (.rc0 .. .rc9) so they are CSP-compliant.
    function renderTextMode() {
      const data = getData();
      if (!data.length) { textContent.innerHTML = '<span class="text-empty">Empty sheet</span>'; return; }
      const maxCols = colCount(data);
      // Precompute matched cells/rows once instead of scanning findMatches per cell.
      const matchSet = new Set();
      const matchRows = new Set();
      for (const m of findMatches) { matchSet.add(cellKey(m.row, m.col)); matchRows.add(m.row); }
      const current = findIndex >= 0 ? findMatches[findIndex] : null;
      const sep = fileExt === '.tsv' ? '\\t' : ',';
      let html = '';
      for (let r = 0; r < data.length; r++) {
        const row = data[r] || [];
        let line = '<span class="line-num">' + (r + 1) + '</span>';
        for (let c = 0; c < maxCols; c++) {
          const cls = 'rc' + (c % RAINBOW_COUNT);
          if (c > 0) line += '<span class="rsep ' + cls + '">' + sep + '</span>';
          const val = c < row.length ? String(row[c]) : '';
          let cellCls = cls;
          if (matchSet.has(cellKey(r, c))) cellCls += ' hl';
          if (current && current.row === r && current.col === c) cellCls += ' hl-current';
          line += '<span data-r="' + r + '" data-c="' + c + '" class="' + cellCls + '">' + escapeHtml(val) + '</span>';
        }
        const lineCls = 'text-line' + (matchRows.has(r) ? ' row-match' : '');
        html += '<div class="' + lineCls + '">' + line + '</div>';
      }
      textContent.innerHTML = html;
    }

    function setViewMode(mode) {
      viewMode = mode;
      btnViewTable.classList.toggle('active', mode === 'table');
      btnViewText.classList.toggle('active', mode === 'text');
      tableContainer.style.display = mode === 'table' ? '' : 'none';
      textContainer.classList.toggle('visible', mode === 'text');
      // Hide table-only toolbar buttons in text mode
      document.getElementById('btnAddRow').style.display = mode === 'text' ? 'none' : '';
      document.getElementById('btnAddCol').style.display = mode === 'text' ? 'none' : '';
      document.getElementById('btnDeleteRow').style.display = mode === 'text' ? 'none' : '';
      document.getElementById('btnDeleteCol').style.display = mode === 'text' ? 'none' : '';
      document.getElementById('sheetSelect').style.display = mode === 'text' ? 'none' : '';
      render();
    }

    btnViewTable.addEventListener('click', () => setViewMode('table'));
    btnViewText.addEventListener('click', () => setViewMode('text'));
  </script>
</body>
</html>`;
}

export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
