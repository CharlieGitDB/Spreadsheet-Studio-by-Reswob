import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { getWebviewHtml, getNonce } from '../src/webviewContent';

/**
 * End-to-end-style tests that drive the *actual* webview client.
 *
 * We render the real HTML produced by getWebviewHtml(), execute its embedded
 * script inside jsdom, and exercise it through the same message protocol the
 * extension host uses (postMessage 'load') plus real DOM clicks. This catches
 * regressions in the shipped UI without needing a full VS Code Electron host.
 */

interface LoadedWebview {
  dom: JSDOM;
  window: import('jsdom').DOMWindow;
  document: Document;
  posted: any[];
}

const SAMPLE = {
  sheets: {
    Sheet1: [
      ['name', 'age', 'city'],
      ['Alice', '30', 'Paris'],
      ['Bob', '25', 'Berlin'],
    ],
  },
  sheetNames: ['Sheet1'],
  fileName: 'people.csv',
  fileExt: '.csv',
};

function bootWebview(): LoadedWebview {
  const html = getWebviewHtml(getNonce());
  const posted: any[] = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    beforeParse(window) {
      // Stub the VS Code webview API the client expects at startup.
      (window as any).acquireVsCodeApi = () => ({
        postMessage: (msg: any) => posted.push(msg),
        getState: () => undefined,
        setState: () => undefined,
      });
    },
  });
  return { dom, window: dom.window, document: dom.window.document, posted };
}

function sendLoad(view: LoadedWebview, payload: any = SAMPLE): void {
  const evt = new view.window.MessageEvent('message', { data: { type: 'load', ...payload } });
  view.window.dispatchEvent(evt);
}

function click(view: LoadedWebview, id: string): void {
  const el = view.document.getElementById(id);
  assert.ok(el, `expected element #${id} to exist`);
  el!.dispatchEvent(new view.window.MouseEvent('click', { bubbles: true }));
}

test('client posts "ready" on startup so the host knows to send data', () => {
  const view = bootWebview();
  assert.ok(view.posted.some((m) => m.type === 'ready'), 'expected a "ready" message');
});

test('loading a CSV renders the table view with all rows', () => {
  const view = bootWebview();
  sendLoad(view);

  const rows = view.document.querySelectorAll('#spreadsheet tbody tr');
  assert.equal(rows.length, 3, 'one <tr> per data row');
  assert.equal(view.document.getElementById('fileName')!.textContent, 'people.csv');
  assert.match(view.document.getElementById('spreadsheet')!.innerHTML, /Alice/);
});

test('text mode highlights each column with a CSS rainbow class (not inline styles)', () => {
  const view = bootWebview();
  sendLoad(view);
  click(view, 'btnViewText');

  const textHtml = view.document.getElementById('textContent')!.innerHTML;

  // Each of the three columns must get its own rainbow class.
  assert.match(textHtml, /class="rc0"/, 'column 0 should use .rc0');
  assert.match(textHtml, /class="rc1"/, 'column 1 should use .rc1');
  assert.match(textHtml, /class="rc2"/, 'column 2 should use .rc2');

  // One line-number marker per row.
  const lineNums = view.document.querySelectorAll('#textContent .line-num');
  assert.equal(lineNums.length, 3, 'one line number per row');

  // The actual cell values must still be present.
  assert.match(textHtml, /Alice/);
  assert.match(textHtml, /Berlin/);
});

test('text mode emits NO inline style attributes (CSP regression guard)', () => {
  const view = bootWebview();
  sendLoad(view);
  click(view, 'btnViewText');

  const textHtml = view.document.getElementById('textContent')!.innerHTML;
  // Inline `style=` attributes are blocked by the nonce-only style-src CSP and
  // were the cause of highlighting silently disappearing. Forbid them entirely.
  assert.doesNotMatch(textHtml, /style\s*=/i, 'text mode must not use inline style attributes');
});

test('toggling back to table view restores the grid', () => {
  const view = bootWebview();
  sendLoad(view);
  click(view, 'btnViewText');
  click(view, 'btnViewTable');

  assert.ok(view.document.getElementById('btnViewTable')!.classList.contains('active'));
  const rows = view.document.querySelectorAll('#spreadsheet tbody tr');
  assert.equal(rows.length, 3);
});

test('an empty sheet renders a safe placeholder in text mode', () => {
  const view = bootWebview();
  sendLoad(view, { ...SAMPLE, sheets: { Sheet1: [] } });
  click(view, 'btnViewText');

  const textHtml = view.document.getElementById('textContent')!.innerHTML;
  assert.match(textHtml, /text-empty/);
  assert.doesNotMatch(textHtml, /style\s*=/i);
});
