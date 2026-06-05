import * as vscode from 'vscode';
import { SpreadsheetEditorProvider } from './spreadsheetEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new SpreadsheetEditorProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'reswob.spreadsheetEditor',
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('reswob.openSpreadsheet', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          'Spreadsheet Files': ['csv', 'tsv', 'xlsx', 'xls', 'ods'],
        },
      });
      if (uris && uris.length > 0) {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          uris[0],
          'reswob.spreadsheetEditor'
        );
      }
    })
  );
}

export function deactivate() {}
