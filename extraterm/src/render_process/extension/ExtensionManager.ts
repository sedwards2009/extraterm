/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import * as _ from 'lodash';
import * as ExtensionApi from 'extraterm-extension-api';
import * as he from 'he';

import {Logger, getLogger} from '../../logging/Logger';
import * as DomUtils from '../DomUtils';
import * as CodeMirror from 'codemirror';
import {ExtensionLoader, ExtensionMetadata} from './ExtensionLoader';
import * as CommandPaletteRequestTypes from '../CommandPaletteRequestTypes';
import {EtTerminal} from '../Terminal';
import {ViewerElement} from '../viewers/ViewerElement';
import {TextViewer} from'../viewers/TextViewer';
import OwnerTrackingList from '../../utils/OwnerTrackingList';
import {PopDownListPicker} from '../gui/PopDownListPicker';
import {PopDownNumberDialog} from '../gui/PopDownNumberDialog';
import {EmbeddedViewer} from '../viewers/EmbeddedViewer';
import {TerminalViewer} from '../viewers/TerminalViewer';
import {ExtensionManager, ExtensionBridge, InternalExtensionContext, InternalWorkspace} from './InternalInterfaces';
import {FrameViewerProxy, TerminalOutputProxy, TextViewerProxy} from './ViewerProxies';
import {TerminalProxy, TerminalTabProxy, WorkspaceProxy} from './Proxies';


interface ActiveExtension {
  extensionMetadata: ExtensionMetadata;
  extensionContextImpl: InternalExtensionContext;
  extensionPublicApi: any;
}


export class ExtensionManagerImpl implements ExtensionManager {
  private _log: Logger = null;
  private _extensionLoader: ExtensionLoader = null;
  private _activeExtensions: ActiveExtension[] = [];
  private _extensionBridge: ExtensionBridge = null;

  constructor() {
    this._log = getLogger("ExtensionManager", this);
    this._extensionLoader = new ExtensionLoader([path.join(__dirname, "../../../../extensions" )]);
    this._extensionBridge = new ExtensionBridgeImpl();
  }

  startUp(): void {
    this._extensionLoader.scan();

    for (const extensionInfo of this._extensionLoader.getExtensions()) {
      this._startExtension(extensionInfo);
    }
  }

  getWorkspaceTerminalCommands(terminal: EtTerminal): CommandPaletteRequestTypes.CommandEntry[] {
    return _.flatten(
      this._activeExtensions.map(activeExtension => {
        const ownerExtensionContext = activeExtension.extensionContextImpl;
        const terminalProxy = ownerExtensionContext.getTerminalProxy(terminal);
        return activeExtension.extensionContextImpl.internalWorkspace.getTerminalCommands(
          activeExtension.extensionMetadata.name, terminalProxy);
      }));
  }

  getWorkspaceTextViewerCommands(textViewer: TextViewer): CommandPaletteRequestTypes.CommandEntry[] {
    return _.flatten(
      this._activeExtensions.map(activeExtension => {
        const extensionContext = activeExtension.extensionContextImpl;
        const textViewerProxy = <ExtensionApi.TextViewer> extensionContext.getViewerProxy(textViewer);
        return extensionContext.internalWorkspace.getTextViewerCommands(
          activeExtension.extensionMetadata.name, textViewerProxy);
      }));
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    for (let extension of this._activeExtensions) {
      const tag = extension.extensionContextImpl.findViewerElementTagByMimeType(mimeType);
      if (tag !== null) {
        return tag;
      }
    }
    return null;
  }

  private _startExtension(extensionMetadata: ExtensionMetadata): void {
    if (this._extensionLoader.load(extensionMetadata)) {
      try {
        const extensionContextImpl = new InternalExtensionContextImpl(this._extensionBridge, extensionMetadata);
        const extensionPublicApi = (<ExtensionApi.ExtensionModule> extensionMetadata.module).activate(extensionContextImpl);
        this._activeExtensions.push({extensionMetadata, extensionPublicApi, extensionContextImpl});
      } catch(ex) {
        this._log.warn(`Exception occurred while starting extensions ${extensionMetadata.name}. ${ex}`);
      }
    }
  }
}


export class ExtensionBridgeImpl implements ExtensionBridge {

  private _log: Logger = null;
  private _numberInputDialog: PopDownNumberDialog = null;
  private _listPicker: PopDownListPicker<IdLabelPair> = null;

  constructor() {
    this._log = getLogger("ExtensionBridge", this);
  }

  workspaceGetTerminals(): EtTerminal[] {
return [];
  }

  showNumberInput(terminal: EtTerminal, options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    let lastFocus: HTMLElement = currentDeepFocusedViewerElement();
    if (lastFocus == null) {
      lastFocus = terminal;
    }

    if (this._numberInputDialog == null) {
      this._numberInputDialog = <PopDownNumberDialog> window.document.createElement(PopDownNumberDialog.TAG_NAME);
    }
    this._numberInputDialog.titlePrimary = options.title;
    this._numberInputDialog.setMinimum(options.minimum !== undefined ? options.minimum : Number.MIN_SAFE_INTEGER);
    this._numberInputDialog.setMaximum(options.maximum !== undefined ? options.maximum : Number.MAX_SAFE_INTEGER);
    this._numberInputDialog.setValue(options.value);

    const dialogDisposable = terminal.showDialog(this._numberInputDialog);
    this._numberInputDialog.open();
    this._numberInputDialog.focus();

    return new Promise((resolve, reject) => {
      const selectedHandler = (ev: CustomEvent): void => {
        dialogDisposable.dispose();
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
    }

    this._listPicker.titlePrimary = options.title;

    const convertedItems = options.items.map((item, index) => ({id: "" + index, label: item}));
    this._listPicker.setEntries(convertedItems);
    this._listPicker.selected = "" + options.selectedItemIndex;

    const dialogDisposable = terminal.showDialog(this._listPicker);
    this._listPicker.open();
    this._listPicker.focus();

    return new Promise((resolve, reject) => {
      const selectedHandler = (ev: CustomEvent): void => {
        dialogDisposable.dispose();
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


class OwnerTrackingEventListenerList<E> extends OwnerTrackingList<InternalExtensionContext, (e: E) => any> {
  emit(e: E): void {
    this.forEach(thing => thing(e));
  }
}


class InternalExtensionContextImpl implements InternalExtensionContext {
  workspace: InternalWorkspace = null;
  internalWorkspace: InternalWorkspace;
  codeMirrorModule: typeof CodeMirror = CodeMirror;
  logger: ExtensionApi.Logger;
  private _tabProxyMap = new WeakMap<EtTerminal, ExtensionApi.Tab>();
  private _terminalProxyMap = new WeakMap<EtTerminal, ExtensionApi.Terminal>();
  private _viewerProxyMap = new WeakMap<ViewerElement, ExtensionApi.Viewer>();

  constructor(public extensionBridge: ExtensionBridge, public extensionMetadata: ExtensionMetadata) {
    this.workspace = new WorkspaceProxy(this);
    this.internalWorkspace = this.workspace;
    this.logger = getLogger(extensionMetadata.name);
  }

  getTabProxy(terminal: EtTerminal): ExtensionApi.Tab {
    if ( ! this._tabProxyMap.has(terminal)) {
      this._tabProxyMap.set(terminal, new TerminalTabProxy(this, terminal));
    }
    return this._tabProxyMap.get(terminal);
  }

  getTerminalProxy(terminal: EtTerminal): ExtensionApi.Terminal {
    if ( ! this._terminalProxyMap.has(terminal)) {
      this._terminalProxyMap.set(terminal, new TerminalProxy(this, terminal));
    }
    return this._terminalProxyMap.get(terminal);
  }

  getViewerProxy(viewer: ViewerElement): ExtensionApi.Viewer {
    if ( ! this._viewerProxyMap.has(viewer)) {
      const proxy = this._createViewerProxy(viewer);
      if (proxy === null) {
        return null;
      }
      this._viewerProxyMap.set(viewer, proxy);
    }
    return this._viewerProxyMap.get(viewer);
  }

  private _createViewerProxy(viewer: ViewerElement): ExtensionApi.Viewer {
      if (viewer instanceof TerminalViewer) {
        return new TerminalOutputProxy(this, viewer);
      }
      if (viewer instanceof TextViewer) {
        return new TextViewerProxy(this, viewer);
      }
      if (viewer instanceof EmbeddedViewer) {
        return new FrameViewerProxy(this, viewer);
      }
      return null;
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    return this.internalWorkspace.findViewerElementTagByMimeType(mimeType);
  }
}
