import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8')
);

const EDITOR_VIEW_TYPE = 'reswob.spreadsheetEditor';
const OPEN_WITH_COMMAND = 'reswob.openWithEditor';

test('the open-with-editor command is declared', () => {
  const commands = pkg.contributes.commands as { command: string }[];
  assert.ok(
    commands.some((c) => c.command === OPEN_WITH_COMMAND),
    `expected a "${OPEN_WITH_COMMAND}" command`
  );
});

test('the explorer context menu offers to open the file in our editor', () => {
  const items = pkg.contributes.menus?.['explorer/context'] as { command: string; when: string }[];
  assert.ok(items?.length, 'expected an explorer/context menu contribution');
  const entry = items.find((i) => i.command === OPEN_WITH_COMMAND);
  assert.ok(entry, `expected the explorer context menu to invoke ${OPEN_WITH_COMMAND}`);
});

test('the context menu is shown for every supported file type', () => {
  // The set of extensions the custom editor claims to handle.
  const selectors = pkg.contributes.customEditors.find(
    (e: any) => e.viewType === EDITOR_VIEW_TYPE
  ).selector as { filenamePattern: string }[];
  const supportedExts = selectors.map((s) => s.filenamePattern.replace('*', ''));

  const entry = (pkg.contributes.menus['explorer/context'] as { command: string; when: string }[]).find(
    (i) => i.command === OPEN_WITH_COMMAND
  )!;

  for (const ext of supportedExts) {
    assert.ok(
      entry.when.includes(`resourceExtname == ${ext}`),
      `context menu "when" clause should cover ${ext}`
    );
  }
});
