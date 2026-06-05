# Spreadsheet Viewer by Reswob

**View, edit, sort, and search spreadsheets directly inside VS Code.**

![Spreadsheet Viewer by Reswob](media/icon.png)

---

## Features

### Open Any Spreadsheet

Open CSV, TSV, Excel (`.xlsx`, `.xls`), and LibreOffice Calc (`.ods`) files as interactive tables without leaving your editor.

### Edit Cells

Double-click any cell to edit its contents. Press **Enter** to save or **Escape** to cancel. Start typing on a selected cell to immediately begin editing.

### Sort Columns

Click any column header to sort ascending or descending. Supports smart sorting — numbers sort numerically, text sorts alphabetically.

### Find & Replace

Click the **Find & Replace** button in the toolbar to search across all cells. Navigate between matches and replace one or all occurrences. No keyboard shortcut conflicts with VS Code — all functionality is toolbar-driven.

### Multi-Sheet Support

Excel and ODS files with multiple sheets display clickable sheet tabs. Switch between sheets instantly.

### Add & Remove Rows/Columns

Use the toolbar buttons to insert or delete rows and columns at the selected position.

### Keyboard Navigation

- **Arrow keys** — Move between cells
- **Enter** — Edit selected cell
- **Tab / Shift+Tab** — Move to next/previous cell while editing
- **Delete / Backspace** — Clear cell contents
- **Escape** — Cancel editing

---

## Supported File Formats

| Format | Extensions |
|---|---|
| CSV | `.csv` |
| TSV | `.tsv` |
| Excel | `.xlsx`, `.xls` |
| LibreOffice Calc | `.ods` |

---

## Getting Started

1. Install the extension from the VS Code Marketplace
2. Open any supported spreadsheet file — it will automatically open in the Reswob editor
3. Alternatively, use the command palette (`Ctrl+Shift+P`) and run **Reswob: Open Spreadsheet** to browse for a file
4. Right-click any supported file and select **Open With...** → **Reswob Spreadsheet Editor**

---

## Commands

| Command | Description |
|---|---|
| `Reswob: Open Spreadsheet` | Open a file picker to select and open a spreadsheet |

---

## Requirements

- VS Code 1.80.0 or later

## License

MIT
