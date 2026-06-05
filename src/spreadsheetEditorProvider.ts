import * as vscode from 'vscode';
import * as XLSX from 'xlsx';
import * as path from 'path';

export class SpreadsheetEditorProvider implements vscode.CustomEditorProvider<SpreadsheetDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<SpreadsheetDocument>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<SpreadsheetDocument> {
    const data = await vscode.workspace.fs.readFile(uri);
    return new SpreadsheetDocument(uri, data);
  }

  async resolveCustomEditor(
    document: SpreadsheetDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    const sendData = () => {
      const ext = path.extname(document.uri.fsPath).toLowerCase();
      let workbook: XLSX.WorkBook;

      if (ext === '.csv' || ext === '.tsv') {
        const text = Buffer.from(document.data).toString('utf-8');
        workbook = XLSX.read(text, { type: 'string', FS: ext === '.tsv' ? '\t' : ',' });
      } else {
        workbook = XLSX.read(document.data, { type: 'array' });
      }

      const sheets: Record<string, unknown[][]> = {};
      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        sheets[name] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
      }

      webviewPanel.webview.postMessage({
        type: 'load',
        sheets,
        sheetNames: workbook.SheetNames,
        fileName: path.basename(document.uri.fsPath),
        fileExt: ext,
      });
    };

    webviewPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'ready':
          sendData();
          break;
        case 'edit': {
          const ext = path.extname(document.uri.fsPath).toLowerCase();
          const wb = XLSX.utils.book_new();
          for (const sheetName of msg.sheetNames) {
            const ws = XLSX.utils.aoa_to_sheet(msg.sheets[sheetName]);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
          }

          let output: Uint8Array;
          if (ext === '.csv') {
            const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
            output = new TextEncoder().encode(csv);
          } else if (ext === '.tsv') {
            const tsv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: '\t' });
            output = new TextEncoder().encode(tsv);
          } else {
            const buf = XLSX.write(wb, { type: 'array', bookType: ext.slice(1) as XLSX.BookType });
            output = new Uint8Array(buf);
          }

          document.data = output;
          this._onDidChangeCustomDocument.fire({ document });
          break;
        }
      }
    });
  }

  async saveCustomDocument(document: SpreadsheetDocument, cancellation: vscode.CancellationToken): Promise<void> {
    await vscode.workspace.fs.writeFile(document.uri, document.data);
  }

  async saveCustomDocumentAs(document: SpreadsheetDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
    await vscode.workspace.fs.writeFile(destination, document.data);
  }

  async revertCustomDocument(document: SpreadsheetDocument, cancellation: vscode.CancellationToken): Promise<void> {
    const data = await vscode.workspace.fs.readFile(document.uri);
    document.data = data;
  }

  async backupCustomDocument(
    document: SpreadsheetDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    await vscode.workspace.fs.writeFile(context.destination, document.data);
    return {
      id: context.destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(context.destination);
        } catch { /* ignore */ }
      },
    };
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();
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
    let sortCol = -1;
    let sortAsc = true;
    let selectedCell = null; // { row, col }
    let editingCell = null;
    let findMatches = [];
    let findIndex = -1;

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
        fileNameEl.textContent = msg.fileName;
        currentSheet = sheetNames[0] || '';
        buildSheetTabs();
        renderTable();
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
        tab.onclick = () => { currentSheet = name; buildSheetTabs(); renderTable(); };
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
      renderTable();
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

    function renderTable() {
      const data = getData();
      if (!data.length) {
        table.innerHTML = '<tr><th>Empty sheet</th></tr>';
        statusLeft.textContent = '0 rows, 0 columns';
        return;
      }

      const maxCols = Math.max(...data.map(r => (r || []).length), 0);
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
          const isMatch = findMatches.some(m => m.row === r && m.col === c);
          let cls = '';
          if (isSelected) cls += ' selected';
          if (isMatch) cls += ' highlight';
          html += '<td data-row="' + r + '" data-col="' + c + '" class="' + cls.trim() + '">' + escapeHtml(String(val)) + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody>';
      table.innerHTML = html;
      statusLeft.textContent = data.length + ' rows, ' + maxCols + ' columns';

      // Attach header sort click
      table.querySelectorAll('th[data-col]').forEach(th => {
        th.addEventListener('click', () => {
          const col = parseInt(th.getAttribute('data-col'));
          if (sortCol === col) {
            sortAsc = !sortAsc;
          } else {
            sortCol = col;
            sortAsc = true;
          }
          sortData();
          renderTable();
        });
      });

      // Attach cell click
      table.querySelectorAll('td[data-row]').forEach(td => {
        td.addEventListener('click', () => {
          const r = parseInt(td.getAttribute('data-row'));
          const c = parseInt(td.getAttribute('data-col'));
          selectCell(r, c);
        });
        td.addEventListener('dblclick', () => {
          const r = parseInt(td.getAttribute('data-row'));
          const c = parseInt(td.getAttribute('data-col'));
          startEditing(r, c);
        });
      });
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
      const maxCols = Math.max(...data.map(r => (r||[]).length), 0);

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
      renderTable();
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
      renderTable();
    });

    function doFind() {
      findMatches = [];
      findIndex = -1;
      const query = findInput.value;
      if (!query) { matchInfo.textContent = '0 / 0'; renderTable(); return; }
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
      renderTable();
      if (findMatches.length > 0) goToMatch();
    }

    function goToMatch() {
      if (findIndex < 0 || findIndex >= findMatches.length) return;
      const m = findMatches[findIndex];
      selectCell(m.row, m.col);
      matchInfo.textContent = (findIndex + 1) + ' / ' + findMatches.length;
      // Scroll into view
      const td = table.querySelector('td[data-row="' + m.row + '"][data-col="' + m.col + '"]');
      if (td) td.scrollIntoView({ block: 'center', inline: 'center' });
    }

    function clearFind() {
      findMatches = [];
      findIndex = -1;
      findInput.value = '';
      replaceInput.value = '';
      matchInfo.textContent = '0 / 0';
      renderTable();
    }

    // Add Row
    document.getElementById('btnAddRow').addEventListener('click', () => {
      const data = getData();
      const maxCols = data.length > 0 ? Math.max(...data.map(r => (r||[]).length), 1) : 1;
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

    // Rainbow colors — theme-aware with good contrast on both light and dark
    // We use HSL with medium lightness so they're visible on any background
    function getRainbowColors() {
      // Detect if theme is light by checking computed background luminance
      const bg = getComputedStyle(document.body).backgroundColor;
      const match = bg.match(/\d+/g);
      let isLight = false;
      if (match && match.length >= 3) {
        const lum = (0.299 * parseInt(match[0]) + 0.587 * parseInt(match[1]) + 0.114 * parseInt(match[2])) / 255;
        isLight = lum > 0.5;
      }
      if (isLight) {
        return [
          '#c41a1a', // red
          '#b45309', // orange
          '#0e7490', // teal
          '#15803d', // green
          '#7c3aed', // violet
          '#be185d', // pink
          '#0369a1', // blue
          '#a16207', // amber
          '#6d28d9', // purple
          '#047857', // emerald
        ];
      } else {
        return [
          '#f87171', // red
          '#fb923c', // orange
          '#38bdf8', // sky
          '#4ade80', // green
          '#c084fc', // violet
          '#f472b6', // pink
          '#60a5fa', // blue
          '#fbbf24', // amber
          '#a78bfa', // purple
          '#34d399', // emerald
        ];
      }
    }

    function renderTextMode() {
      const data = getData();
      if (!data.length) { textContent.innerHTML = '<span style="opacity:0.5">Empty sheet</span>'; return; }
      const colors = getRainbowColors();
      const maxCols = Math.max(...data.map(r => (r || []).length), 0);
      let html = '';
      for (let r = 0; r < data.length; r++) {
        const row = data[r] || [];
        html += '<span class="line-num">' + (r + 1) + '</span>';
        for (let c = 0; c < maxCols; c++) {
          if (c > 0) html += '<span style="color:' + colors[c % colors.length] + '; opacity:0.5">,</span>';
          const val = c < row.length ? String(row[c]) : '';
          const color = colors[c % colors.length];
          html += '<span style="color:' + color + '">' + escapeHtml(val) + '</span>';
        }
        html += '\n';
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
      if (mode === 'text') {
        renderTextMode();
        statusLeft.textContent = getData().length + ' lines (text mode)';
      } else {
        renderTable();
      }
    }

    btnViewTable.addEventListener('click', () => setViewMode('table'));
    btnViewText.addEventListener('click', () => setViewMode('text'));
  </script>
</body>
</html>`;
  }
}

class SpreadsheetDocument implements vscode.CustomDocument {
  public data: Uint8Array;
  constructor(
    public readonly uri: vscode.Uri,
    initialData: Uint8Array
  ) {
    this.data = initialData;
  }
  dispose(): void {}
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
