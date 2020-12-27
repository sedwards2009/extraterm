/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";

import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";

import { EtTerminal, AppendScrollbackLinesDetail } from "../../Terminal";
import { InternalExtensionContext, InternalWindow, InternalSessionSettingsEditor, InternalSessionEditor } from "../InternalTypes";
import { Logger, getLogger, log } from "extraterm-logging";
import { WorkspaceSessionEditorRegistry } from "../WorkspaceSessionEditorRegistry";
import { WorkspaceViewerRegistry, ExtensionViewerBaseImpl } from "../WorkspaceViewerRegistry";
import { CommonExtensionWindowState } from "../CommonExtensionState";
import { SessionSettingsEditorFactory, SessionConfiguration } from "@extraterm/extraterm-extension-api";
import { ViewerElement } from "../../viewers/ViewerElement";
import { WorkspaceSessionSettingsRegistry } from "../WorkspaceSessionSettingsRegistry";
import { TerminalProxy } from "../proxy/TerminalProxy";

/**
 * The implementation behind the `Window` object on the `ExtensionContext`
 * which is given to extensions when loading them.
 *
 * Each extension gets its own instance of this.
 */
export class WindowProxy implements InternalWindow {

  private _log: Logger = null;

  private _windowSessionEditorRegistry: WorkspaceSessionEditorRegistry = null;
  private _windowSessionSettingsRegistry: WorkspaceSessionSettingsRegistry = null;
  private _windowViewerRegistry: WorkspaceViewerRegistry = null;
  private _terminalBorderWidgetFactoryMap = new Map<string, ExtensionApi.TerminalBorderWidgetFactory>();

  private _onDidCreateTerminalEventEmitter = new EventEmitter<ExtensionApi.Terminal>();
  onDidCreateTerminal: ExtensionApi.Event<ExtensionApi.Terminal>;

  #allTerminals: EtTerminal[] = [];

  constructor(private _internalExtensionContext: InternalExtensionContext,
      private _commonExtensionState: CommonExtensionWindowState) {

    this._log = getLogger("WorkspaceProxy", this);
    this.onDidCreateTerminal = this._onDidCreateTerminalEventEmitter.event;
    this._windowSessionEditorRegistry = new WorkspaceSessionEditorRegistry(this._internalExtensionContext);
    this._windowSessionSettingsRegistry = new WorkspaceSessionSettingsRegistry(this._internalExtensionContext);
    this._windowViewerRegistry = new WorkspaceViewerRegistry(this._internalExtensionContext);
    this.extensionViewerBaseConstructor = ExtensionViewerBaseImpl;
  }

  newTerminalCreated(newTerminal: EtTerminal, allTerminals: EtTerminal[]): void {
    this.#allTerminals = allTerminals;
    if (this._onDidCreateTerminalEventEmitter.hasListeners()) {
      const terminal = this._internalExtensionContext._proxyFactory.getTerminalProxy(newTerminal);
      this._onDidCreateTerminalEventEmitter.fire(terminal);
    }
  }

  terminalDestroyed(deadTerminal: EtTerminal, allTerminals: EtTerminal[]): void {
    this.#allTerminals = allTerminals;
  }

  terminalAppendedViewer(terminal: EtTerminal, viewer: ViewerElement): void {
    if (this._internalExtensionContext._proxyFactory.hasTerminalProxy(terminal)) {
      const proxy = <TerminalProxy> this._internalExtensionContext._proxyFactory.getTerminalProxy(terminal);
      if (proxy._onDidAppendBlockEventEmitter.hasListeners()) {
        proxy._onDidAppendBlockEventEmitter.fire(this._internalExtensionContext._proxyFactory.getBlock(viewer));
      }
    }
  }

  terminalEnvironmentChanged(terminal: EtTerminal, changeList: string[]): void {
    if (this._internalExtensionContext._proxyFactory.hasTerminalProxy(terminal)) {
      const proxy = <TerminalProxy> this._internalExtensionContext._proxyFactory.getTerminalProxy(terminal);
      if (proxy.environment._onChangeEventEmitter.hasListeners()) {
        proxy.environment._onChangeEventEmitter.fire(changeList);
      }
    }
  }

  terminalDidAppendScrollbackLines(terminal: EtTerminal, ev: AppendScrollbackLinesDetail): void {
    if (this._internalExtensionContext._proxyFactory.hasTerminalProxy(terminal)) {
      const proxy = <TerminalProxy> this._internalExtensionContext._proxyFactory.getTerminalProxy(terminal);
      if (proxy._onDidAppendScrollbackLinesEventEmitter.hasListeners()) {
        const block = this._internalExtensionContext._proxyFactory.getBlock(ev.viewer);
        proxy._onDidAppendScrollbackLinesEventEmitter.fire({
          block,
          startLine: ev.startLine,
          endLine: ev.endLine
        });
      }
    }
  }

  get activeTerminal(): ExtensionApi.Terminal {
    return this._internalExtensionContext._proxyFactory.getTerminalProxy(this._commonExtensionState.activeTerminal);
  }

  get activeBlock(): ExtensionApi.Block {
    return this._internalExtensionContext._proxyFactory.getBlock(this._commonExtensionState.activeViewerElement);
  }

  get activeHyperlinkURL(): string {
    return this._commonExtensionState.activeHyperlinkURL;
  }

  get terminals(): ExtensionApi.Terminal[] {
    return this.#allTerminals.map(t => this._internalExtensionContext._proxyFactory.getTerminalProxy(t));
  }

  // ---- Viewers ----
  extensionViewerBaseConstructor: ExtensionApi.ExtensionViewerBaseConstructor;

  registerViewer(name: string, viewerClass: ExtensionApi.ExtensionViewerBaseConstructor): void {
    this._windowViewerRegistry.registerViewer(name, viewerClass);
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    return this._windowViewerRegistry.findViewerElementTagByMimeType(mimeType);
  }

  // ---- Session Editors ----
  registerSessionEditor(type: string, factory: ExtensionApi.SessionEditorFactory): void {
    this._windowSessionEditorRegistry.registerSessionEditor(type, factory);
  }

  createSessionEditor(sessionType: string, sessionConfiguration: SessionConfiguration): InternalSessionEditor {
    return this._windowSessionEditorRegistry.createSessionEditor(sessionType, sessionConfiguration);
  }

  // ---- Tab Title Widgets ----
  registerTabTitleWidget(name: string, factory: ExtensionApi.TabTitleWidgetFactory): void {
    this._internalExtensionContext._registerTabTitleWidget(name, factory);
  }

  // ---- Terminal Border Widgets ----
  registerTerminalBorderWidget(name: string, factory: ExtensionApi.TerminalBorderWidgetFactory): void {
    const borderWidgetMeta = this._internalExtensionContext._extensionMetadata.contributes.terminalBorderWidgets;
    for (const data of borderWidgetMeta) {
      if (data.name === name) {
        this._terminalBorderWidgetFactoryMap.set(name, factory);
        return;
      }
    }

    this._internalExtensionContext.logger.warn(
      `Unknown terminal border widget '${name}' given to registerTerminalBorderWidget().`);
  }

  getTerminalBorderWidgetFactory(name: string): ExtensionApi.TerminalBorderWidgetFactory {
    return this._terminalBorderWidgetFactoryMap.get(name);
  }

  // ---- Session Settings editors ----
  registerSessionSettingsEditor(id: string, factory: SessionSettingsEditorFactory): void {
    this._windowSessionSettingsRegistry.registerSessionSettingsEditor(id, factory);
  }

  createSessionSettingsEditors(sessionType: string,
      sessionConfiguration: SessionConfiguration): InternalSessionSettingsEditor[] {

    return this._windowSessionSettingsRegistry.createSessionSettingsEditors(sessionType, sessionConfiguration);
  }
}
