/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as Ace from "@extraterm/ace-ts";
import { Event } from "extraterm-event-emitter";

import { Terminal, TerminalBorderWidgetFactory } from "./Terminal";
import { ExtensionViewerBaseConstructor } from "./Viewers";
import { SessionEditorFactory, SessionSettingsEditorFactory, SessionBackend } from "./Sessions";
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

  activeBlock: Block;

  activeHyperlinkURL: string;

  readonly terminals: Terminal[];

  onDidCreateTerminal: Event<Terminal>;
  // onWillDestroyTerminal: Event<Terminal>;

  extensionViewerBaseConstructor: ExtensionViewerBaseConstructor;

  registerViewer(name: string, viewerClass: ExtensionViewerBaseConstructor): void;

  registerSessionEditor(type: string, factory: SessionEditorFactory): void;
  registerTabTitleWidget(name: string, factory: TabTitleWidgetFactory): void;

  registerTerminalBorderWidget(name: string, factory: TerminalBorderWidgetFactory): void; // FIXME: this should go away

  registerSessionSettingsEditor(id: string, factory: SessionSettingsEditorFactory): void;

  /**
   * Create a blank instance of tab
   *
   * Extension tabs are defined and named in the extension's `package.json`.
   */
  createExtensionTab(name: string): ExtensionTab;
}

/**
 * Extensions use an instance of this to build thier own tab.
 *
 * Instances of this are created via `Window.createExtensionTab()`.
 *
 * `open()` must be called before the tab is visible in the GUI.
 */
export interface ExtensionTab {
  /**
   * Container element under which this editor's DOM contents can be placed.
   *
   * The CSS specified in the extension's `package.json` will be automatically
   * applied to the contents of this element.
   */
  readonly containerElement: HTMLElement;

  /**
   * Fired when the tab is closed
   */
  onClose: Event<void>;

  /**
   * Make the tab visible and give it the focus
   *
   * If the tab is already open then it will be made visible and receive the
   * focus.
   */
  open(): void;

  /**
   * Close the tab by removing it from the GUI
   *
   * A closed tab can be reopened with `open()`.
   */
  close(): void;

  /**
   * Icon to display next to the title
   *
   * Extraterm ships with the free Font Awesome 5 icons. Icons and thier
   * names can be found at https://fontawesome.com/icons?d=gallery&p=2&m=free
   * The value for `icon` should be that shown in the `class` attribute in
   * the icon example HTML. For example: `fas fa-bolt` or 'far fa-lightbulb'.
   */
  icon: string;

  /**
   * Title to display for this tab at the top
   */
  title: string;
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
   * True if Extraterm is running Linux
   */
  readonly isLinux: boolean;

  /**
   * True if Extraterm is running on MacOS
   */
  readonly isMacOS: boolean;

  /**
   * True if Extraterm is running on Windows.
   */
  readonly isWindows: boolean;

  /**
   * Open the given URL using the desktop's default application.
   *
   * @param url the url to open.
   */
  openExternal(url: string): void;

  /**
   * Show the given path in the system's file manager application.
   *
   * @param path the path of the file or directory to show.
   */
  showItemInFileManager(path: string): void;
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
