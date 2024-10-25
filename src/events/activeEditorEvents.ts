import * as vscode from "vscode";
import { revealItem } from "../utils";

export const registerActiveEditorChangeListener = (
  context: vscode.ExtensionContext
) => {
  const disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      // 处理逻辑
      revealItem(editor.document.uri, context);
    }
  });

  context.subscriptions.push(disposable);
};
