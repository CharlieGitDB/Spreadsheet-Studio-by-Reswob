import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWebviewHtml, getNonce } from '../src/webviewContent';

/**
 * Performance/scalability regressions for the webview client.
 *
 * These extract the real shipped helpers from the generated script and exercise
 * them directly, so we can verify behavior on inputs far larger than would be
 * practical to render in a DOM.
 */

const script = (() => {
  const html = getWebviewHtml(getNonce());
  const m = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/);
  assert.ok(m, 'expected an inline <script> block');
  return m![1];
})();

function extractFn(name: string): Function {
  const re = new RegExp(`(function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n {4}\\})`);
  const m = script.match(re);
  assert.ok(m, `expected to find function ${name} in the webview script`);
  return new Function(`${m![1]}; return ${name};`)();
}

test('colCount handles sheets larger than the JS spread-argument limit', () => {
  const colCount = extractFn('colCount');

  // Sanity check: the previous implementation, Math.max(...data.map(...)),
  // throws on this many rows — which is the bug colCount fixes.
  const big = Array.from({ length: 200000 }, () => [1, 2, 3]);
  assert.throws(() => Math.max(...big.map((r) => r.length)), RangeError);

  // The shipped helper must compute the width without crashing.
  assert.equal(colCount(big), 3);
});

test('colCount returns the widest row for ragged data', () => {
  const colCount = extractFn('colCount');
  assert.equal(colCount([['a'], ['x', 'y', 'z'], ['p', 'q']]), 3);
  assert.equal(colCount([]), 0);
  assert.equal(colCount([[], []]), 0);
});

test('the webview script no longer spreads row data into Math.max', () => {
  // Guard against reintroducing the RangeError-prone pattern.
  assert.doesNotMatch(script, /Math\.max\(\.\.\.data/);
  assert.match(script, /function colCount/);
});
