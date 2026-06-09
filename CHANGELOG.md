# Changelog

All notable changes to the **Spreadsheet Studio by Reswob** extension will be documented in this file.

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
