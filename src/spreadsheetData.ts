import * as XLSX from 'xlsx';

export interface ParsedWorkbook {
  sheets: Record<string, unknown[][]>;
  sheetNames: string[];
}

/**
 * Parse raw file bytes into a map of sheet name -> array-of-arrays (rows of cells).
 * CSV/TSV are read as delimited text; everything else is read as a binary workbook.
 */
export function parseToSheets(data: Uint8Array, ext: string): ParsedWorkbook {
  const e = ext.toLowerCase();
  let workbook: XLSX.WorkBook;

  if (e === '.csv' || e === '.tsv') {
    const text = Buffer.from(data).toString('utf-8');
    workbook = XLSX.read(text, { type: 'string', FS: e === '.tsv' ? '\t' : ',' });
  } else {
    workbook = XLSX.read(data, { type: 'array' });
  }

  const sheets: Record<string, unknown[][]> = {};
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    sheets[name] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  }

  return { sheets, sheetNames: workbook.SheetNames };
}

/**
 * Serialize edited sheets back into file bytes, preserving the original format.
 * CSV/TSV only persist the first sheet (single-sheet formats); workbook formats keep all sheets.
 */
export function serializeSheets(
  sheets: Record<string, unknown[][]>,
  sheetNames: string[],
  ext: string
): Uint8Array {
  const e = ext.toLowerCase();
  const wb = XLSX.utils.book_new();
  for (const sheetName of sheetNames) {
    const ws = XLSX.utils.aoa_to_sheet(sheets[sheetName]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  if (e === '.csv') {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
    return new TextEncoder().encode(csv);
  } else if (e === '.tsv') {
    const tsv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: '\t' });
    return new TextEncoder().encode(tsv);
  } else {
    const buf = XLSX.write(wb, { type: 'array', bookType: e.slice(1) as XLSX.BookType });
    return new Uint8Array(buf);
  }
}
