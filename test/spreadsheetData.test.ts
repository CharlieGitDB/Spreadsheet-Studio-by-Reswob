import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseToSheets, serializeSheets } from '../src/spreadsheetData';
import { getWebviewHtml, getNonce } from '../src/webviewContent';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => Buffer.from(b).toString('utf-8');

test('parseToSheets reads a CSV into rows of cells', () => {
  const { sheets, sheetNames } = parseToSheets(enc('name,age\nAlice,30\nBob,25\n'), '.csv');
  assert.equal(sheetNames.length, 1);
  const rows = sheets[sheetNames[0]].map((r) => r.map(String));
  assert.deepEqual(rows, [
    ['name', 'age'],
    ['Alice', '30'],
    ['Bob', '25'],
  ]);
});

test('parseToSheets honors the tab delimiter for TSV', () => {
  const { sheets, sheetNames } = parseToSheets(enc('a\tb\n1\t2\n'), '.tsv');
  const rows = sheets[sheetNames[0]].map((r) => r.map(String));
  assert.deepEqual(rows, [
    ['a', 'b'],
    ['1', '2'],
  ]);
});

test('CSV survives a parse -> serialize round trip', () => {
  const original = 'name,age\nAlice,30\nBob,25';
  const { sheets, sheetNames } = parseToSheets(enc(original), '.csv');
  const out = dec(serializeSheets(sheets, sheetNames, '.csv'));
  assert.match(out, /name,age/);
  assert.match(out, /Alice,30/);
  assert.match(out, /Bob,25/);
});

test('the generated webview script is syntactically valid (parse regression guard)', () => {
  const html = getWebviewHtml(getNonce());
  const match = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/);
  assert.ok(match, 'expected an inline <script> block');
  // Throws SyntaxError if the embedded script does not parse — this is exactly
  // the failure mode an unescaped newline inside a string literal once caused.
  assert.doesNotThrow(() => new Function(match![1]));
});
