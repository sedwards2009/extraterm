/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ExtensionContext, TextViewer, CustomizedCommand, Viewer} from 'extraterm-extension-api';

let extensionContext: ExtensionContext = null;

export function activate(context: ExtensionContext): any {
  extensionContext = context;

  const ifTextViewer = function<R>(func: (textViewer: TextViewer) => R): () => R {
    return (): R | null => {
      const viewer = context.window.activeViewer;
      if (viewer == null) {
        return null;
      }
      if (viewer.viewerType !== "text") {
        return null;
      }
      return func(viewer);
    };
  };

  const commands = context.commands;
  commands.registerCommand("text-viewer-options:setSyntaxHighlighting",
    ifTextViewer(syntaxHighlightingCommandExecutor),
    ifTextViewer(getSetSyntaxHighlightingTitle));

  commands.registerCommand("text-viewer-options:setTabWidth",
    ifTextViewer(tabCommand),
    ifTextViewer(getTabCommandTitle));

  commands.registerCommand("text-viewer-options:showLineNumbers",
    ifTextViewer(toggleLineNumbers),
    ifTextViewer(getToggleLineNumbersTitle));
}

//-------------------------------------------------------------------------

function getSetSyntaxHighlightingTitle(textViewer: TextViewer): CustomizedCommand {
  return {
    title: "Syntax: " + getMimeTypeName(textViewer)
  };
}

function getMimeTypeName(textViewer: TextViewer): string {
  const mimeType = textViewer.getMimeType();
  const matchingMode = extensionContext.aceModule.ModeList.getModeByMimeType(mimeType);
  return matchingMode != null ? matchingMode.friendlyName : mimeType;
}

async function syntaxHighlightingCommandExecutor(textViewer: TextViewer): Promise<any> {
  const modesByNameObject = extensionContext.aceModule.ModeList.modesByName;
  const mimeList: {name: string, nameLower: string, mime: string}[] =  [];
  for (const key in modesByNameObject) {
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

function getTabCommandTitle(textViewer: TextViewer): CustomizedCommand {
  return {
    title: "Tab Size: " + textViewer.getTabSize(),
  };
}

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

//-------------------------------------------------------------------------
function getToggleLineNumbersTitle(textViewer: TextViewer): CustomizedCommand {
  return {
    checked: textViewer.getShowLineNumbers()
  };
}

async function toggleLineNumbers(textViewer: TextViewer): Promise<any> {
  textViewer.setShowLineNumbers( ! textViewer.getShowLineNumbers());
}
