import * as vscode from "vscode";
import { revealItem } from "../utils";

export const registerActiveEditorChangeListener = (
  context: vscode.ExtensionContext
) => {
  const disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      // 处理逻辑
      setTimeout(() => revealItem(editor.document.uri, context), 300);
    }
  });

  context.subscriptions.push(disposable);
};
