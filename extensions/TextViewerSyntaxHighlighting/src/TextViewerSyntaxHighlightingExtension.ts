
/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ExtensionContext, CommandEntry, TextViewer} from 'extraterm-extension-api';

let extensionContext: ExtensionContext = null;

export function activate(context: ExtensionContext): any {
  extensionContext = context;
  context.workspace.registerCommandsOnTextViewer(textViewerCommandLister, textViewerCommandExecutor);
}

const COMMAND_SET_SYNTAX_HIGHLIGHTING = "setSyntaxHighlighting";

function textViewerCommandLister(textViewer: TextViewer): CommandEntry[] {
  return [{
    id: COMMAND_SET_SYNTAX_HIGHLIGHTING,
    label: "Syntax: " + getMimeTypeName(textViewer)
  }];
}

function getMimeTypeName(textViewer: TextViewer): string {
  const mimeType = textViewer.getMimeType();
  const matchingMimeList = extensionContext.codeMirrorModule.modeInfo.filter(info => info.mime === mimeType);
  return matchingMimeList.length !== 0 ? matchingMimeList[0].name : mimeType;
}

async function textViewerCommandExecutor(textViewer: TextViewer, commandId: string, commandArguments?: object): Promise<any> {
  const mimeList = <{mime: string, name: string}[]>extensionContext.codeMirrorModule.modeInfo;
  sortArrayBy(mimeList, item => item.name.toLowerCase());

  const items = mimeList.map(item => item.name + ' ' + item.mime);
  const mimeTypeNames = mimeList.map(item => item.name);
  const selectedItemIndex = mimeTypeNames.indexOf(getMimeTypeName(textViewer));

  const newSelectedItemIndex = await textViewer.getTab().showListPicker({
    title: "Syntax Highlighting",
    items: items,
    selectedItemIndex
  });
  if (newSelectedItemIndex !== undefined) {
    textViewer.setMimeType(mimeList[newSelectedItemIndex].mime);
  }
}

function sortArrayBy(items: any[], keyFunc: (item: any) => string): void {
  items.sort((a, b) => {
    const keyA = keyFunc(a);
    const keyB = keyFunc(b);
    if (keyA === keyB) {
      return 0;
    }
    return keyA < keyB ? -1 : 1;
  });
}
