import * as vscode from 'vscode';
import * as path from 'path';
import { parseToSheets, serializeSheets } from './spreadsheetData';
import { getWebviewHtml, getNonce } from './webviewContent';

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
    webviewPanel.webview.html = getWebviewHtml(getNonce());

    const sendData = () => {
      const ext = path.extname(document.uri.fsPath).toLowerCase();
      const { sheets, sheetNames } = parseToSheets(document.data, ext);

      webviewPanel.webview.postMessage({
        type: 'load',
        sheets,
        sheetNames,
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
          document.data = serializeSheets(msg.sheets, msg.sheetNames, ext);
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
