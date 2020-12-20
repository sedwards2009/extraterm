/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as Ace from "@extraterm/ace-ts";

import { Terminal, TerminalBorderWidgetFactory } from "./Terminal";
import { Viewer, ExtensionViewerBaseConstructor } from "./Viewers";
import { SessionEditorFactory, SessionSettingsEditorFactory, SessionBackend } from "./Sessions";
import { Event } from "./Utilities";
import { TabTitleWidgetFactory } from "./Tab";
import { SyntaxThemeProvider } from "./SyntaxTheme";
import { Commands } from "./Commands";
import { TerminalThemeProvider } from "./TerminalTheme";
import { Logger } from "./Logger";
import { Block } from "./Block";


export interface Window {
  /**
   * The currently active/focussed terminal.
   *
   * This may be `null`.
   */
  activeTerminal: Terminal;

  activeViewer: Viewer; // FIXME remove

  activeBlock: Block;

  activeHyperlinkURL: string;

  getTerminals(): Terminal[];

  onDidCreateTerminal: Event<Terminal>;
  // onWillDestroyTerminal: Event<Terminal>;

  extensionViewerBaseConstructor: ExtensionViewerBaseConstructor;

  registerViewer(name: string, viewerClass: ExtensionViewerBaseConstructor): void;

  registerSessionEditor(type: string, factory: SessionEditorFactory): void;
  registerTabTitleWidget(name: string, factory: TabTitleWidgetFactory): void;
  registerTerminalBorderWidget(name: string, factory: TerminalBorderWidgetFactory): void;
  registerSessionSettingsEditor(id: string, factory: SessionSettingsEditorFactory): void;
}


/**
 * Extension API for extensions which need to operate in the back end process.
 */
export interface Backend {
  registerSessionBackend(name: string, backend: SessionBackend): void;
  registerSyntaxThemeProvider(name: string, provider: SyntaxThemeProvider): void;
  registerTerminalThemeProvider(name: string, provider: TerminalThemeProvider): void;
}

/**
 * Access to the system clipboard.
 */
export interface Clipboard {
  /**
   * Write some text to the clipboard.
   */
  writeText(text: string): void;
}

/**
 * Holds application wide values and utility funcions.
 */
export interface Application {
  // version: string;

  clipboard: Clipboard;

  /**
   * Open the given URL using the desktop's default application.
   *
   * @param url the url to open.
   */
  openExternal(url: string): void;
}

/**
 * Access to the Extraterm extension API
 *
 * This provides extensions access to the whole Extraterm extension API, as
 * well as some convenience classes and objects.
 *
 * An instance of this is passed to each extension's `activate()` function.
 */
export interface ExtensionContext {

  readonly commands: Commands;

  readonly application: Application;

  /**
   * Extension APIs which can be used from a front-end render process.
   */
  readonly window: Window;

  /**
   * Access to Extraterm's own Ace module.
   */
  readonly aceModule: typeof Ace;

  /**
   * True if this process is the backend process. False if it is a render process.
   */
  readonly isBackendProcess: boolean;

  /**
   * Extension APIs which may only be used from the backend process.
   */
  readonly backend: Backend;

  /**
   * Logger object which the extension can use.
   */
  readonly logger: Logger;

  /**
   * Absolute path to where this extension is located on the file system.
   */
  readonly extensionPath: string;
}

/**
 * An extension module as viewed from Extraterm.
 */
export interface ExtensionModule {

  /**
   * Each extension module must export a function called `activate()` with the signature below.
   *
   * @param context The extension context which this extension is running in.
   * @return The public API of this extension, or null or undefined.
   */
  activate(context: ExtensionContext): any;

  /**
   * Option function which is called if the extension is disabled or the application shutdown.
   *
   * @param manual True if the user manually disabled the extension.
   */
  deactivate?(manual: boolean): void;
}
