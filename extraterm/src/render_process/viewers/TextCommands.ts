/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import { ExtensionManager } from '../extension/InternalTypes';


export function registerCommands(extensionManager: ExtensionManager): void {
  const commands = extensionManager.getExtensionContextByName("internal-commands").commands;
  const aceCommandNames: string[] = [
    "addCursorAbove",
    "addCursorBelow",
    "backSlashesToForward",
    "backspace",
    "blockIndent",
    "blockOutdent",
    "cursorColumn",
    "del",
    "escapeShellChars",
    "forwardSlashesToBack",
    "goLineDown",
    "goLineUp",
    "gotoFileEnd",
    "gotoFileStart",
    "gotoLeft",
    "gotoLineEnd",
    "gotoLineStart",
    "gotoPageDown",
    "gotoPageUp",
    "gotoRight",
    "gotoWordLeft",
    "gotoWordRight",
    "indent",
    "outdent",
    "overwrite",
    "redo",
    "removeLines",
    "removeWordLeft",
    "removeWordRight",
    "scrollDown",
    "scrollUp",
    "selectAll",
    "selectDown",
    "selectLeft",
    "selectLineEnd",
    "selectLineStart",
    "selectMoreAfter",
    "selectPageDown",
    "selectPageUp",
    "selectRight",
    "selectUp",
    "selectWordLeft",
    "selectWordRight",
    "singleSelection",
    "splitIntoLines",
    "undo",
    "undoSelection",
    "unescapeShellChars",
    "goLineDown",
    "goLineUp"
  ];

  for (const command of aceCommandNames) {
    commands.registerCommand("extraterm:textEditor." + command,
      (args: any) => {
        extensionManager.getActiveTextEditor().executeAceCommand(command);
      });
  }
}
