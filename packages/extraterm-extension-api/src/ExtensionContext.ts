/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Sessions } from "./Sessions.js";
import { Commands } from "./Commands.js";
import { Logger } from "./Logger.js";
import { Window, Windows } from "./Windows.js";
import { Terminal, Terminals } from "./Terminal.js";
import { Block } from "./Block.js";
import { Settings } from "./Settings.js";


/**
 * Access to the system clipboard.
 */
export interface Clipboard {
  /**
   * Write some text to the clipboard.
   */
  writeText(text: string): void;

  writeBuffer(mimeType: string, buffer: Buffer): void;
}

/**
 * Holds application wide values and utility funcions.
 */
export interface Application {
  /**
   * Access to the Clipboard
   */
  readonly clipboard: Clipboard;

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

  /**
   * Extraterm's version number
   */
   readonly version: string;
}

/**
 * A way of writing and reading an opaque JSON configuration object.
 *
 * The object is stored on disk between Extraterm runs.
 */
export interface Configuration {
  /**
   * Get the stored configuration.
   *
   * @returns the previously stored configuration object .This may be `null`
   *          or `undefined` or some other random JSON compatible type.
   */
  get(): any;

  /**
   * Set and store a configuration.
   *
   * @param config the JSON compatible object to store and save .
   */
  set(config: any): void;
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

  readonly activeBlock: Block;

  /**
   * The currently active/focussed terminal.
   *
   * This may be `null`.
   */
  readonly activeTerminal: Terminal;

  readonly activeHyperlinkURL: string;

  readonly activeWindow: Window;

  readonly application: Application;

  readonly commands: Commands;

  /**
   * Configuration object which the extension can use to store its own
   * configuration data.
   */
  readonly configuration: Configuration;

  /**
   * Absolute path to where this extension is located on the file system.
   */
  readonly extensionPath: string;

  /**
   * Logger object which the extension can use.
   */
  readonly logger: Logger;

  readonly sessions: Sessions;

  readonly settings: Settings;

  readonly terminals: Terminals;

  readonly windows: Windows;
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
