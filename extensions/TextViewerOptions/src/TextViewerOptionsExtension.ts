/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ExtensionContext, TextViewerType, CustomizedCommand, TextViewerDetails, Block } from '@extraterm/extraterm-extension-api';

let extensionContext: ExtensionContext = null;

export function activate(context: ExtensionContext): any {
  extensionContext = context;

  const ifTextViewer = function<R>(func: (textViewer: TextViewerDetails, block: Block) => R): () => R {
    return (): R | null => {
      const block = context.window.activeBlock;
      if (block == null) {
        return null;
      }
      if (block.type !== TextViewerType) {
        return null;
      }
      return func(block.details, block);
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

function getSetSyntaxHighlightingTitle(textViewerDetails: TextViewerDetails, block: Block): CustomizedCommand {
  return {
    title: "Syntax: " + getMimeTypeName(textViewerDetails)
  };
}

function getMimeTypeName(textViewerDetails: TextViewerDetails): string {
  const mimeType = textViewerDetails.getMimeType();
  const matchingMode = extensionContext.aceModule.ModeList.getModeByMimeType(mimeType);
  return matchingMode != null ? matchingMode.friendlyName : mimeType;
}

async function syntaxHighlightingCommandExecutor(textViewerDetails: TextViewerDetails, block: Block): Promise<any> {
  const modesByNameObject = extensionContext.aceModule.ModeList.modesByName;
  const mimeList: {name: string, nameLower: string, mime: string}[] =  [];
  for (const key in modesByNameObject) {
    const mode = modesByNameObject[key];
    mimeList.push({name: mode.friendlyName, nameLower: mode.friendlyName.toLowerCase(), mime: mode.mimeTypes[0]});
  }

  sortArrayBy(mimeList, item => item.nameLower);

  const items = mimeList.map(item => item.name + ' ' + item.mime);
  const mimeTypeNames = mimeList.map(item => item.name);
  const selectedItemIndex = mimeTypeNames.indexOf(getMimeTypeName(textViewerDetails));

  const newSelectedItemIndex = await block.tab.showListPicker({
    title: "Syntax Highlighting",
    items: items,
    selectedItemIndex
  });
  if (newSelectedItemIndex !== undefined) {
    textViewerDetails.setMimeType(mimeList[newSelectedItemIndex].mime);
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

function getTabCommandTitle(textViewerDetails: TextViewerDetails, block: Block): CustomizedCommand {
  return {
    title: "Tab Size: " + textViewerDetails.getTabSize(),
  };
}

async function tabCommand(textViewerDetails: TextViewerDetails, block: Block): Promise<any> {
  const selectedTabSize = await block.tab.showNumberInput({
    title: "Tab Size",
    value: textViewerDetails.getTabSize(),
    minimum: 0,
    maximum: 32
  });
  if (selectedTabSize !== undefined) {
    textViewerDetails.setTabSize(selectedTabSize);
  }
}

//-------------------------------------------------------------------------
function getToggleLineNumbersTitle(textViewerDetails: TextViewerDetails, block: Block): CustomizedCommand {
  return {
    checked: textViewerDetails.getShowLineNumbers()
  };
}

async function toggleLineNumbers(textViewerDetails: TextViewerDetails, block: Block): Promise<any> {
  textViewerDetails.setShowLineNumbers( ! textViewerDetails.getShowLineNumbers());
}
