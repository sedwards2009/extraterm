/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import * as _ from 'lodash';
import Logger from './Logger';
import * as he from 'he';
import * as DomUtils from './DomUtils';
import * as CodeMirror from 'codemirror';
import {ExtensionLoader, ExtensionMetadata} from './ExtensionLoader';
import * as CommandPaletteRequestTypes from './CommandPaletteRequestTypes';
import * as ExtensionApi from 'extraterm-extension-api';
import {EtTerminal} from './Terminal';
import {ViewerElement} from './ViewerElement';
import {TextViewer} from'./viewers/TextViewer';
import OwnerTrackingList from './utils/OwnerTrackingList';
import {PopDownListPicker} from './gui/PopDownListPicker';
import {PopDownNumberDialog} from './gui/PopDownNumberDialog';


interface ActiveExtension {
  extensionMetadata: ExtensionMetadata;
  extensionContextImpl: ExtensionContextImpl;
  extensionPublicApi: any;
}


export class ExtensionManager {

  private _log: Logger = null;

  private _extensionLoader: ExtensionLoader = null;

  private _activeExtensions: ActiveExtension[] = [];

  private _extensionBridge: ExtensionBridge = null;

  constructor() {
    PopDownNumberDialog.init();

    this._log = new Logger("ExtensionManager", this);
    this._extensionLoader = new ExtensionLoader([path.join(__dirname, "../extensions" )]);
    this._extensionBridge = new ExtensionBridge();
  }

  startUp(): void {
    this._extensionLoader.scan();

    for (const extensionInfo of this._extensionLoader.getExtensions()) {
      this._startExtension(extensionInfo);
    }
  }

  getExtensionBridge(): ExtensionBridge {
    return this._extensionBridge;
  }

  private _startExtension(extensionMetadata: ExtensionMetadata): void {
    if (this._extensionLoader.load(extensionMetadata)) {
      try {
        const extensionContextImpl = this._extensionBridge.createExtensionSpecificContext(extensionMetadata);
        const extensionPublicApi = (<ExtensionApi.ExtensionModule> extensionMetadata.module).activate(extensionContextImpl);
        this._activeExtensions.push({extensionMetadata, extensionPublicApi, extensionContextImpl});
      } catch(ex) {
        this._log.warn(`Exception occurred while starting extensions ${extensionMetadata.name}. ${ex}`);
      }
    }
  }
}


export class ExtensionBridge {

  private _log: Logger = null;

  private _numberInputDialog: PopDownNumberDialog = null;

  private _listPicker: PopDownListPicker<IdLabelPair> = null;

  constructor() {
    this._log = new Logger("ExtensionBridge", this);
  }

  createExtensionSpecificContext(extensionMetadata: ExtensionMetadata): ExtensionContextImpl {
    return new ExtensionContextImpl(this, extensionMetadata);
  }

  workspaceGetTerminals(): EtTerminal[] {
return [];
  }

  workspaceOnDidCreateTerminal = new OwnerTrackingEventListenerList<ExtensionApi.Terminal>();

  workspaceRegisterCommandsOnTextViewer = new OwnerTrackingList<ExtensionContextImpl, CommandRegistration<ExtensionApi.TextViewer>>();

  getWorkspaceTextViewerCommands(textViewer: TextViewer): CommandPaletteRequestTypes.CommandEntry[] {
    return _.flatten(this.workspaceRegisterCommandsOnTextViewer.mapWithOwner(
      (ownerExtensionContext, registration): CommandPaletteRequestTypes.CommandEntry[] => {
        const textViewerImpl = ownerExtensionContext.getTextViewerProxy(textViewer);
        const rawCommands = registration.commandLister(textViewerImpl);
        
        const target: CommandPaletteRequestTypes.CommandExecutor = {
          executeCommand(commandId: string, options?: object): void {
            const commandIdWithoutPrefix = commandId.slice(ownerExtensionContext.extensionMetadata.name.length+1);
            registration.commandExecutor(textViewerImpl, commandIdWithoutPrefix, options);
          }
        };
        
        const commands: CommandPaletteRequestTypes.CommandEntry[] = [];
        for (const rawCommand of rawCommands) {
          commands.push({
            id: ownerExtensionContext.extensionMetadata.name + '.' + rawCommand.id,
            group: rawCommand.group,
            iconLeft: rawCommand.iconLeft,
            iconRight: rawCommand.iconRight,
            label: rawCommand.label,
            shortcut: '',
            commandExecutor: target,
            commandArguments: rawCommand.commandArguments
          });
        }

        return commands;
      }));
  }

  showNumberInput(terminal: EtTerminal, options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    let lastFocus: HTMLElement = currentDeepFocusedViewerElement();
    if (lastFocus == null) {
      lastFocus = terminal;
    }

    if (this._numberInputDialog == null) {
      this._numberInputDialog = <PopDownNumberDialog> window.document.createElement(PopDownNumberDialog.TAG_NAME);
      window.document.body.appendChild(this._numberInputDialog);
    }
    this._numberInputDialog.setTitlePrimary(options.title);
    this._numberInputDialog.setMinimum(options.minimum !== undefined ? options.minimum : Number.MIN_SAFE_INTEGER);
    this._numberInputDialog.setMaximum(options.maximum !== undefined ? options.maximum : Number.MAX_SAFE_INTEGER);
    this._numberInputDialog.setValue(options.value);

    const rect = terminal.getBoundingClientRect();
    this._numberInputDialog.open(rect.left, rect.top, rect.width, rect.height);
    this._numberInputDialog.focus();

    return new Promise((resolve, reject) => {
      const selectedHandler = (ev: CustomEvent): void => {
        this._numberInputDialog.removeEventListener('selected', selectedHandler);
        resolve(ev.detail.value == null ? undefined : ev.detail.value);
        lastFocus.focus();
      };

      this._numberInputDialog.addEventListener('selected', selectedHandler);
    });
  }

  showListPicker(terminal: EtTerminal, options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    let lastFocus: HTMLElement = currentDeepFocusedViewerElement();
    if (lastFocus == null) {
      lastFocus = terminal;
    }

    if (this._listPicker == null) {
      this._listPicker = <PopDownListPicker<IdLabelPair>> window.document.createElement(PopDownListPicker.TAG_NAME);
      this._listPicker.setFormatEntriesFunc( (filteredEntries: IdLabelPair[], selectedId: string, filterInputValue: string): string => {
        return filteredEntries.map( (entry): string => {
          return `<div class='CLASS_RESULT_ENTRY ${entry.id === selectedId ? PopDownListPicker.CLASS_RESULT_SELECTED : ""}' ${PopDownListPicker.ATTR_DATA_ID}='${entry.id}'>
            ${he.encode(entry.label)}
          </div>`;
        }).join("");
      });

      this._listPicker.setFilterAndRankEntriesFunc(this._listPickerFilterAndRankEntries.bind(this));

      window.document.body.appendChild(this._listPicker);
    }

    this._listPicker.setTitlePrimary(options.title);

    const convertedItems = options.items.map((item, index) => ({id: "" + index, label: item}));
    this._listPicker.setEntries(convertedItems);
    this._listPicker.setSelected("" + options.selectedItemIndex);

    const rect = terminal.getBoundingClientRect();
    this._listPicker.open(rect.left, rect.top, rect.width, rect.height);
    this._listPicker.focus();

    return new Promise((resolve, reject) => {
      const selectedHandler = (ev: CustomEvent): void => {
        this._listPicker.removeEventListener('selected', selectedHandler);
        resolve(ev.detail.selected == null ? undefined : parseInt(ev.detail.selected, 10));
        lastFocus.focus();
      };

      this._listPicker.addEventListener('selected', selectedHandler);
    });
  }
      
  _listPickerFilterAndRankEntries(entries: IdLabelPair[], filterText: string): IdLabelPair[] {
    const lowerFilterText = filterText.toLowerCase().trim();
    const filtered = entries.filter( (entry: IdLabelPair): boolean => {
      return entry.label.toLowerCase().indexOf(lowerFilterText) !== -1;
    });

    const rankFunc = (entry: IdLabelPair, lowerFilterText: string): number => {
      const lowerName = entry.label.toLowerCase();
      if (lowerName === lowerFilterText) {
        return 1000;
      }

      const pos = lowerName.indexOf(lowerFilterText);
      if (pos !== -1) {
        return 500 - pos; // Bias it for matches at the front of  the text.
      }

      return 0;
    };

    filtered.sort( (a: IdLabelPair,b: IdLabelPair): number => rankFunc(b, lowerFilterText) - rankFunc(a, lowerFilterText));

    return filtered;
  }
}

function currentDeepFocusedViewerElement(): ViewerElement {
  const elements = DomUtils.activeNestedElements();
  const viewerElements = <ViewerElement[]> elements.filter(el => el instanceof ViewerElement);
  return viewerElements.length === 0 ? null : viewerElements[0];
}

interface IdLabelPair {
  id: string;
  label: string;
}


class OwnerTrackingEventListenerList<E> extends OwnerTrackingList<ExtensionContextImpl, (e: E) => any> {
  emit(e: E): void {
    this.forEach(thing => thing(e));
  }
}


class ExtensionContextImpl implements ExtensionApi.ExtensionContext {

  workspace: WorkspaceProxy = null;

  codeMirrorModule: typeof CodeMirror = CodeMirror;

  private _terminalProxyMap = new WeakMap<EtTerminal, ExtensionApi.Terminal>();
  
  private _textViewerProxyMap = new WeakMap<TextViewer, ExtensionApi.TextViewer>();

  constructor(public extensionBridge: ExtensionBridge, public extensionMetadata: ExtensionMetadata) {
    this.workspace = new WorkspaceProxy(this);
  }

  getTerminalProxy(terminal: EtTerminal): ExtensionApi.Terminal {
    if ( ! this._terminalProxyMap.has(terminal)) {
      this._terminalProxyMap.set(terminal, new TerminalProxy(this, terminal));
    }
    return this._terminalProxyMap.get(terminal);
  }

  getTextViewerProxy(textViewer: TextViewer): ExtensionApi.TextViewer {
    if ( ! this._textViewerProxyMap.has(textViewer)) {
      this._textViewerProxyMap.set(textViewer, new TextViewerProxy(this, textViewer));
    }
    return this._textViewerProxyMap.get(textViewer);
  }
}


export interface CommandRegistration<V> {
  commandLister: (viewer: V) => ExtensionApi.CommandEntry[];
  commandExecutor: (viewer: V, commandId: string, commandArguments?: object) => void;
}


class WorkspaceProxy implements ExtensionApi.Workspace {

  constructor(private _extensionContextImpl: ExtensionContextImpl) {
  }

  getTerminals(): ExtensionApi.Terminal[] {
    return this._extensionContextImpl.extensionBridge.workspaceGetTerminals()
      .map(terminal => this._extensionContextImpl.getTerminalProxy(terminal));
  }

  onDidCreateTerminal(listener: (e: ExtensionApi.Terminal) => any): ExtensionApi.Disposable {
    return this._extensionContextImpl.extensionBridge.workspaceOnDidCreateTerminal.add(this._extensionContextImpl, listener);
  }

  registerCommandsOnTextViewer(
      commandLister: (textViewer: ExtensionApi.TextViewer) => ExtensionApi.CommandEntry[],
      commandExecutor: (textViewer: ExtensionApi.TextViewer, commandId: string, commandArguments?: object) => void
    ): ExtensionApi.Disposable {

    return this._extensionContextImpl.extensionBridge.workspaceRegisterCommandsOnTextViewer.add(this._extensionContextImpl,
      {commandLister, commandExecutor});
  }
}


class TerminalProxy implements ExtensionApi.Terminal {

  constructor(private _extensionContextImpl: ExtensionContextImpl, private _terminal: EtTerminal) {
  }

  type(text: string): void {
    this._terminal.send(text);
  }

  showNumberInput(options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    return this._extensionContextImpl.extensionBridge.showNumberInput(this._terminal, options);
  }

  showListPicker(options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    return this._extensionContextImpl.extensionBridge.showListPicker(this._terminal, options);
  }

}


class ViewerProxy implements ExtensionApi.Viewer {
  constructor(public _extensionContextImpl: ExtensionContextImpl, public _viewer: ViewerElement) {
  }

  getOwningTerminal(): ExtensionApi.Terminal {
    const path = DomUtils.nodePathToRoot(this._viewer);
    for (const node of path) {
      if (node instanceof EtTerminal) {
        return this._extensionContextImpl.getTerminalProxy(node);
      }
    }
    return null;
  }
}


class TextViewerProxy extends ViewerProxy implements ExtensionApi.TextViewer {
  constructor(_extensionContextImpl: ExtensionContextImpl, private _textViewer: TextViewer) {
    super(_extensionContextImpl, _textViewer);
  }
  
  getTabSize(): number {
    return this._textViewer.getTabSize();
  }

  setTabSize(size: number): void {
    this._textViewer.setTabSize(size);
  }

  getMimeType():string {
    return this._textViewer.getMimeType();
  }

  setMimeType(mimeType: string): void {
    this._textViewer.setMimeType(mimeType);
  }
}
