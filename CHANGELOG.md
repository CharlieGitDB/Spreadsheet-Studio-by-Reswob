# Changelog

All notable changes to the **Spreadsheet Studio by Reswob** extension will be documented in this file.

## [1.0.4] - 2026-06-09

### Added

- Right-click a supported spreadsheet file (`.csv`, `.tsv`, `.xlsx`, `.xls`, `.ods`) in the Explorer to open it directly in the editor via the new **Open with Spreadsheet Studio** context-menu entry.

### Fixed

- Find & Replace now works in text view: searching tints the matching line, emphasizes and scrolls to the current match, and replacements update the text immediately.

## [1.0.3] - 2026-06-09

### Fixed

- Text view now correctly shows rainbow syntax highlighting per column. Colors were previously applied with inline style attributes that the webview's Content-Security-Policy blocked, so highlighting silently disappeared. Colors are now driven by nonce'd CSS classes with light/dark theme variants.

### Internal

- Extracted the data parsing/serialization and webview HTML into dedicated modules.
- Added end-to-end webview tests (jsdom) and data round-trip tests, runnable via `npm test`.

## [1.0.2] - 2026-06-09

### Fixed

- Fixed a fatal syntax error in the webview script that prevented files from loading and all toolbar buttons/interactions from working. A previous change removed required backslash escapes inside the webview template literal, producing an unterminated string literal in the generated script.

## [1.0.0] - 2026-06-05

### Added

- Open and view CSV, TSV, Excel (.xlsx/.xls), and LibreOffice (.ods) spreadsheet files directly in VS Code
- Full cell editing with double-click or keyboard entry
- Column sorting (ascending/descending) by clicking column headers — supports numeric and text sorting
- Find & Replace functionality accessible via toolbar button (no keyboard shortcut conflicts with VS Code)
- Add and delete rows and columns
- Multi-sheet support with sheet tabs for Excel and ODS files
- Keyboard navigation (arrow keys, Tab, Enter, Delete)
- Inline cell editing with Enter to confirm and Escape to cancel
- Status bar showing row/column counts and file type
- Native VS Code theme integration (respects light/dark themes)
- Custom editor registration — spreadsheet files can be opened with Reswob from the "Open With" menu
- Command palette support via "Reswob: Open Spreadsheet"
