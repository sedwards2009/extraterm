/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";

import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import { CustomElement } from "extraterm-web-component-decorators";

import * as ThemeTypes from "../../../theme/Theme";

import { EtTerminal, LineRangeChange } from "../../Terminal";
import { InternalExtensionContext, InternalWindow, InternalSessionSettingsEditor, InternalSessionEditor, ViewerTabDisplay } from "../InternalTypes";
import { Logger, getLogger, log } from "extraterm-logging";
import { WorkspaceSessionEditorRegistry } from "../WorkspaceSessionEditorRegistry";
import { WorkspaceViewerRegistry, ExtensionViewerBaseImpl } from "../WorkspaceViewerRegistry";
import { CommonExtensionWindowState } from "../CommonExtensionState";
import { SessionSettingsEditorFactory, SessionConfiguration, ViewerMetadata, ViewerPosture } from "@extraterm/extraterm-extension-api";
import { ViewerElement } from "../../viewers/ViewerElement";
import { WorkspaceSessionSettingsRegistry } from "../WorkspaceSessionSettingsRegistry";
import { TerminalProxy } from "../proxy/TerminalProxy";
import { ExtensionContainerElement } from "../ExtensionContainerElement";
import { ExtensionTabContribution } from "extraterm/src/ExtensionMetadata";
import { ThemeableElementBase } from "../../ThemeableElementBase";

/**
 * The implementation behind the `Window` object on the `ExtensionContext`
 * which is given to extensions when loading them.
 *
 * Each extension gets its own instance of this.
 */
export class WindowProxy implements InternalWindow {

  private _log: Logger = null;

  #internalExtensionContext: InternalExtensionContext = null;
  #commonExtensionState: CommonExtensionWindowState = null;

  #windowSessionEditorRegistry: WorkspaceSessionEditorRegistry = null;
  #windowSessionSettingsRegistry: WorkspaceSessionSettingsRegistry = null;
  #windowViewerRegistry: WorkspaceViewerRegistry = null;
  #terminalBorderWidgetFactoryMap = new Map<string, ExtensionApi.TerminalBorderWidgetFactory>();

  #onDidCreateTerminalEventEmitter = new EventEmitter<ExtensionApi.Terminal>();
  onDidCreateTerminal: ExtensionApi.Event<ExtensionApi.Terminal>;

  #allTerminals: EtTerminal[] = [];

  constructor(internalExtensionContext: InternalExtensionContext, commonExtensionState: CommonExtensionWindowState) {
    this._log = getLogger("WorkspaceProxy", this);
    this.#internalExtensionContext = internalExtensionContext;
    this. #commonExtensionState = commonExtensionState;

    this.onDidCreateTerminal = this.#onDidCreateTerminalEventEmitter.event;
    this.#windowSessionEditorRegistry = new WorkspaceSessionEditorRegistry(this.#internalExtensionContext);
    this.#windowSessionSettingsRegistry = new WorkspaceSessionSettingsRegistry(this.#internalExtensionContext);
    this.#windowViewerRegistry = new WorkspaceViewerRegistry(this.#internalExtensionContext);
    this.extensionViewerBaseConstructor = ExtensionViewerBaseImpl;
  }

  newTerminalCreated(newTerminal: EtTerminal, allTerminals: EtTerminal[]): void {
    this.#allTerminals = allTerminals;
    if (this.#onDidCreateTerminalEventEmitter.hasListeners()) {
      const terminal = this.#internalExtensionContext._proxyFactory.getTerminalProxy(newTerminal);
      this.#onDidCreateTerminalEventEmitter.fire(terminal);
    }
  }

  terminalDestroyed(deadTerminal: EtTerminal, allTerminals: EtTerminal[]): void {
    this.#allTerminals = allTerminals;
  }

  terminalAppendedViewer(terminal: EtTerminal, viewer: ViewerElement): void {
    if (this.#internalExtensionContext._proxyFactory.hasTerminalProxy(terminal)) {
      const proxy = <TerminalProxy> this.#internalExtensionContext._proxyFactory.getTerminalProxy(terminal);
      if (proxy._onDidAppendBlockEventEmitter.hasListeners()) {
        proxy._onDidAppendBlockEventEmitter.fire(this.#internalExtensionContext._proxyFactory.getBlock(viewer));
      }
    }
  }

  terminalEnvironmentChanged(terminal: EtTerminal, changeList: string[]): void {
    if (this.#internalExtensionContext._proxyFactory.hasTerminalProxy(terminal)) {
      const proxy = <TerminalProxy> this.#internalExtensionContext._proxyFactory.getTerminalProxy(terminal);
      if (proxy.environment._onChangeEventEmitter.hasListeners()) {
        proxy.environment._onChangeEventEmitter.fire(changeList);
      }
    }
  }

  terminalDidAppendScrollbackLines(terminal: EtTerminal, ev: LineRangeChange): void {
    if (this.#internalExtensionContext._proxyFactory.hasTerminalProxy(terminal)) {
      const proxy = <TerminalProxy> this.#internalExtensionContext._proxyFactory.getTerminalProxy(terminal);
      if (proxy._onDidAppendScrollbackLinesEventEmitter.hasListeners()) {
        const block = this.#internalExtensionContext._proxyFactory.getBlock(ev.viewer);
        proxy._onDidAppendScrollbackLinesEventEmitter.fire({
          block,
          startLine: ev.startLine,
          endLine: ev.endLine
        });
      }
    }
  }

  terminalDidScreenChange(terminal: EtTerminal, ev: LineRangeChange): void {
    if (this.#internalExtensionContext._proxyFactory.hasTerminalProxy(terminal)) {
      const proxy = <TerminalProxy> this.#internalExtensionContext._proxyFactory.getTerminalProxy(terminal);
      if (proxy._onDidScreenChangeEventEmitter.hasListeners()) {
        const block = this.#internalExtensionContext._proxyFactory.getBlock(ev.viewer);
        if (ev.startLine !== -1 && ev.endLine !== -1) {
          proxy._onDidScreenChangeEventEmitter.fire({
            block,
            startLine: ev.startLine,
            endLine: ev.endLine
          });
        }
      }
    }
  }

  get activeTerminal(): ExtensionApi.Terminal {
    return this.#internalExtensionContext._proxyFactory.getTerminalProxy(this.#commonExtensionState.activeTerminal);
  }

  get activeBlock(): ExtensionApi.Block {
    return this.#internalExtensionContext._proxyFactory.getBlock(this.#commonExtensionState.activeViewerElement);
  }

  get activeHyperlinkURL(): string {
    return this.#commonExtensionState.activeHyperlinkURL;
  }

  get terminals(): ExtensionApi.Terminal[] {
    return this.#allTerminals.map(t => this.#internalExtensionContext._proxyFactory.getTerminalProxy(t));
  }

  // ---- Viewers ----
  extensionViewerBaseConstructor: ExtensionApi.ExtensionViewerBaseConstructor;

  registerViewer(name: string, viewerClass: ExtensionApi.ExtensionViewerBaseConstructor): void {
    this.#windowViewerRegistry.registerViewer(name, viewerClass);
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    return this.#windowViewerRegistry.findViewerElementTagByMimeType(mimeType);
  }

  // ---- Session Editors ----
  registerSessionEditor(type: string, factory: ExtensionApi.SessionEditorFactory): void {
    this.#windowSessionEditorRegistry.registerSessionEditor(type, factory);
  }

  createSessionEditor(sessionType: string, sessionConfiguration: SessionConfiguration): InternalSessionEditor {
    return this.#windowSessionEditorRegistry.createSessionEditor(sessionType, sessionConfiguration);
  }

  // ---- Tab Title Widgets ----
  registerTabTitleWidget(name: string, factory: ExtensionApi.TabTitleWidgetFactory): void {
    this.#internalExtensionContext._registerTabTitleWidget(name, factory);
  }

  // ---- Terminal Border Widgets ----
  registerTerminalBorderWidget(name: string, factory: ExtensionApi.TerminalBorderWidgetFactory): void {
    const borderWidgetMeta = this.#internalExtensionContext._extensionMetadata.contributes.terminalBorderWidgets;
    for (const data of borderWidgetMeta) {
      if (data.name === name) {
        this.#terminalBorderWidgetFactoryMap.set(name, factory);
        return;
      }
    }

    this.#internalExtensionContext.logger.warn(
      `Unknown terminal border widget '${name}' given to registerTerminalBorderWidget().`);
  }

  getTerminalBorderWidgetFactory(name: string): ExtensionApi.TerminalBorderWidgetFactory {
    return this.#terminalBorderWidgetFactoryMap.get(name);
  }

  // ---- Session Settings editors ----
  registerSessionSettingsEditor(id: string, factory: SessionSettingsEditorFactory): void {
    this.#windowSessionSettingsRegistry.registerSessionSettingsEditor(id, factory);
  }

  createSessionSettingsEditors(sessionType: string,
      sessionConfiguration: SessionConfiguration): InternalSessionSettingsEditor[] {

    return this.#windowSessionSettingsRegistry.createSessionSettingsEditors(sessionType, sessionConfiguration);
  }

  createExtensionTab(name: string): ExtensionApi.ExtensionTab {
    const etc = this._findExtensionTabContribution(name);
    if (etc == null) {
      this.#internalExtensionContext.logger.warn(
        `Unknown extension tab '${name}' given to openExtensionTab().`);
      return null;
    }

    const extensionContainerElement = <ExtensionContainerElement> document.createElement(ExtensionContainerElement.TAG_NAME);
    extensionContainerElement._setExtensionContext(this.#internalExtensionContext);
    extensionContainerElement._setExtensionCss(etc.css);

    const extensionTabViewer = <ExtensionContainerViewer> document.createElement("et-extension-container-viewer");
    extensionTabViewer.shadowRoot.appendChild(extensionContainerElement);

    return new ExtensionTabImpl(extensionContainerElement, extensionTabViewer,
      this.#internalExtensionContext._extensionManager.getViewerTabDisplay());
  }

  private _findExtensionTabContribution(name: string): ExtensionTabContribution {
    const extensionTabs = this.#internalExtensionContext._extensionMetadata.contributes.tabs;
    for (const t of extensionTabs) {
      if (t.name === name) {
        return t;
      }
    }
    return null;
  }
}


class ExtensionTabImpl implements ExtensionApi.ExtensionTab {
  #extensionContainerElement: ExtensionContainerElement = null;
  #extensionContainerViewer: ExtensionContainerViewer = null;
  #viewerTabDisplay: ViewerTabDisplay = null;
  #isOpen = false;

  onClose: ExtensionApi.Event<void>;
  #onCloseEventEmitter = new EventEmitter<void>();

  constructor(extensionContainerElement: ExtensionContainerElement,
      extensionContainerViewer: ExtensionContainerViewer, viewerTabDisplay: ViewerTabDisplay) {

    this.#extensionContainerElement = extensionContainerElement;
    this.#extensionContainerViewer = extensionContainerViewer;
    this.#viewerTabDisplay = viewerTabDisplay;

    this.onClose = this.#onCloseEventEmitter.event;

    extensionContainerViewer.onClose(() => {
      this.#isOpen = false;
      this.#onCloseEventEmitter.fire();
    });
  }

  get containerElement(): HTMLElement {
    return this.#extensionContainerElement.getContainerElement();
  }

  open(): void {
    if ( ! this.#isOpen) {
      this.#viewerTabDisplay.openViewerTab(this.#extensionContainerViewer);
      this.#isOpen = true;
    }
    this.#viewerTabDisplay.switchToTab(this.#extensionContainerViewer);
  }

  close(): void {
    this.#viewerTabDisplay.closeViewerTab(this.#extensionContainerViewer);
    this.#isOpen = false;
  }

  get icon(): string {
    return this.#extensionContainerViewer.getIcon();
  }

  set icon(icon: string) {
    this.#extensionContainerViewer.setIcon(icon);
  }

  get title(): string {
    return this.#extensionContainerViewer.getTitle();
  }

  set title(title: string) {
    this.#extensionContainerViewer.setTitle(title);
  }
}

@CustomElement("et-extension-container-viewer")
class ExtensionContainerViewer extends ViewerElement  {

  #viewerMetadata: ViewerMetadata = null;
  onClose: ExtensionApi.Event<void>;
  #onCloseEventEmitter = new EventEmitter<void>();

  constructor() {
    super();
    this.onClose = this.#onCloseEventEmitter.event;

    this.#viewerMetadata = {
      title: "",
      icon: null,
      posture: ViewerPosture.NEUTRAL,
      moveable: true,
      deleteable: true,
      toolTip: null
    };

    const shadow = this.attachShadow({ mode: "open", delegatesFocus: false });
    const themeStyle = document.createElement("style");
    themeStyle.id = ThemeableElementBase.ID_THEME;
    shadow.appendChild(themeStyle);
    this.updateThemeCss();
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.EXTENSION_TAB];
  }

  getMetadata(): ViewerMetadata {
    return this.#viewerMetadata;
  }

  getIcon(): string {
    return this.#viewerMetadata.icon;
  }

  setIcon(icon: string): void {
    this.#viewerMetadata.icon = icon;
    this.metadataChanged();
  }

  getTitle(): string {
    return this.#viewerMetadata.title;
  }

  setTitle(title: string): void {
    this.#viewerMetadata.title = title;
    this.metadataChanged();
  }

  didClose(): void {
    super.didClose();
    this.#onCloseEventEmitter.fire();
  }
}
