
/*
 * Copyright 2017-2018 Simon Edwards <simon@simonzone.com>
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
const COMMAND_SET_TAB_WIDTH = "setTabWidth";


function textViewerCommandLister(textViewer: TextViewer): CommandEntry[] {
  return [{
    id: COMMAND_SET_SYNTAX_HIGHLIGHTING,
    label: "Syntax: " + getMimeTypeName(textViewer)
  },
  {
    id: COMMAND_SET_TAB_WIDTH,
    label: "Tab Size: " + textViewer.getTabSize()
  }];
}

async function textViewerCommandExecutor(textViewer: TextViewer, commandId: string, commandArguments?: object): Promise<any> {
  switch(commandId) {
    case COMMAND_SET_TAB_WIDTH:
      return tabCommand(textViewer);

    case COMMAND_SET_SYNTAX_HIGHLIGHTING:
      return syntaxHighlightingCommandExecutor(textViewer);

    default:
      break;
  }
}

//-------------------------------------------------------------------------

function getMimeTypeName(textViewer: TextViewer): string {
  const mimeType = textViewer.getMimeType();
  const matchingMode = extensionContext.aceModule.ModeList.getModeByMimeType(mimeType);
  return matchingMode != null ? matchingMode.friendlyName : mimeType;
}

async function syntaxHighlightingCommandExecutor(textViewer: TextViewer): Promise<any> {
  const modesByNameObject = extensionContext.aceModule.ModeList.modesByName
  const mimeList: {name: string, nameLower: string, mime: string}[] =  [];
  for (let key in modesByNameObject) {
    const mode = modesByNameObject[key];
    mimeList.push({name: mode.friendlyName, nameLower: mode.friendlyName.toLowerCase(), mime: mode.mimeTypes[0]});
  }

  sortArrayBy(mimeList, item => item.nameLower);

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

//-------------------------------------------------------------------------

async function tabCommand(textViewer: TextViewer): Promise<any> {
  const selectedTabSize = await textViewer.getTab().showNumberInput({
    title: "Tab Size",
    value: textViewer.getTabSize(),
    minimum: 0,
    maximum: 32
  });
  if (selectedTabSize !== undefined) {
    textViewer.setTabSize(selectedTabSize);
  }
}
