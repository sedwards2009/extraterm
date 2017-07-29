/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ExtensionContext, CommandEntry, TextViewer} from 'extraterm-extension-api';

export function activate(context: ExtensionContext): any {
  context.workspace.registerCommandsOnTextViewer(textViewerCommandLister, textViewerCommandExecutor);
}

const COMMAND_SET_TAB_WIDTH = "setTabWidth";

function textViewerCommandLister(textViewer: TextViewer): CommandEntry[] {
  return [{
    id: COMMAND_SET_TAB_WIDTH,
    group: "",
    label: "Set tab width XXXX"
  }];
}

function textViewerCommandExecutor(textViewer: TextViewer, commandId: string, commandArguments?: object): void {
  console.log("TextViewerTabWidthExtension.textViewerCommandExecutor");
}
