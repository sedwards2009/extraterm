/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as CodeMirror from './typings/codemirror/index';


/**
 * A resource which can later be freed by calling `dispose()`.
 */
export interface Disposable {
  dispose(): void;
}


/**
 * Function which represents a specific event which you can subscribe to.
 */
export interface Event<T> {
  (listener: (e: T) => any): Disposable;
}


export interface Tab {
  /**
   * Get any terminal contained inside this tab.
   */
  getTerminal(): Terminal;

  /**
   * Show an input box requesting a number.
   * 
   * @return a promise which resolves to the entered number or undefined if
   *          it was canceled.
   */
  showNumberInput(options: NumberInputOptions): Promise<number | undefined>;

  /**
   * Show a list picker requesting an item from the list.
   * 
   * @return a promise which resolves to the selected item index or
   *          undefined if it was canceled.
   */
  showListPicker(options: ListPickerOptions): Promise<number | undefined>;
}


export interface Terminal {
  /**
   * Type a string of text into the terminal.
   * 
   * This is effectively the same as though the user typed into the terminal.
   * Note that the enter key should be represented as \r.
   */
  type(text: string): void;

  /**
   * Get a list of viewers inside this terminal.
   */
  getViewers(): Viewer[];

  /**
   * Get the tab which holds this terminal.
   */
  getTab(): Tab;

  /**
   * Get the values of the Extraterm terminal integration cookie specific to
   * this terminal.
   */
  getExtratermCookieValue(): string;

  /**
   * Get the name of the Extraterm terminal integration cookie.
   */
  getExtratermCookieName(): string;
}


export interface NumberInputOptions {
  /**
   * The title of the input box.
   */
  title: string;

  /**
   * The default value of the input box.
   */
  value: number;

  /**
   * The minimum acceptable value.
   */
  minimum?: number;

  /**
   * The maximum acceptable value.
   */
  maximum?: number;
}


export interface ListPickerOptions {
  /**
   * The title to display in the list picker.
   */
  title: string;

  /**
   * The list of text items to display.
   */
  items: string[];

  /**
   * The index of the item to select by default.
   */
  selectedItemIndex: number;
}


export interface ViewerBase {
  /**
   * Get the tab which contains this viewer.
   */
  getTab(): Tab;

  /**
   * Get the terminal which contains this viewer.
   * 
   * This may be null if the viewer is not inside a terminal.
   */
  getOwningTerminal(): Terminal;
}


export interface FrameViewer extends ViewerBase {
  viewerType: 'frame';

  /**
   * Get the viewer inside this frame.
   */
  getContents(): Viewer;
}


export interface TerminalOutputViewer extends ViewerBase {

  viewerType: 'terminal-output';

  /**
   * Returns true if this output viewer is connected to a live PTY and emulator.
   * 
   * @return true if this output viewer is connected to a live PTY and emulator.
   */
  isLive(): boolean;
}


export interface TextViewer extends ViewerBase {
  viewerType: 'text';

  /**
   * Get the configured tab size.
   */
  getTabSize(): number;

  /**
   * Set the tab size.
   */
  setTabSize(size: number): void;

  /**
   * Get the mimetype of the contents of this text viewer.
   */
  getMimeType(): string;

  /**
   * Set the mimetype of the cotnent of this text viewer.
   */
  setMimeType(mimeType: string): void;
}


export type Viewer = FrameViewer | TerminalOutputViewer | TextViewer;


/**
 * Defines a command for display in the Command Palette.
 */
export interface CommandEntry {
  /**
   * Identifier for this command. This ID is used internally and should only
   * consist of alphanumeric characters ([A-Z0-9]+). It must be unique
   * to this extension and stable between calls.
   */
  id: string;

  /**
   * Optional identifier used to grouping related commands in the command
   * palette.
   * 
   * Commands with the same group name are visually separated from the
   * surrounding commands.
   */
  group?: string;

  iconLeft?: string;
  iconRight?: string;

  /**
   * Label for this command. This string is shown in the Command Palette to
   * the user.
   */
  label: string;

   /**
    * Optional object which will be passed to the command executor when this
    * command is run.
    */
  commandArguments?: object;
}


export interface Workspace {

  getTerminals(): Terminal[];

  onDidCreateTerminal: Event<Terminal>;

  // onWillDestroyTerminal: Event<Terminal>;
  registerCommandsOnTerminal(
    commandLister: (terminal: Terminal) => CommandEntry[],
    commandExecutor: (terminal: Terminal, commandId: string, commandArguments?: object) => void): Disposable;

  registerCommandsOnTextViewer(
    commandLister: (textViewer: TextViewer) => CommandEntry[],
    commandExecutor: (textViewer: TextViewer, commandId: string, commandArguments?: object) => void): Disposable;

  extensionViewerBaseConstructor: ExtensionViewerBaseConstructor;
    // extensionViewerBaseConstructor: ExtensionViewerBaseConstructor;
  registerViewer(name: string, viewerClass: ExtensionViewerBaseConstructor, mimeTypes: string[]): void; 
}

export enum ViewerPosture {
  NEUTRAL,
  RUNNING,
  SUCCESS,
  FAILURE,
}

export interface ViewerMetadata {
  title: string;
  icon: string;
  posture: ViewerPosture;
  moveable: boolean;
  deleteable: boolean;
  toolTip: string;
}

export type ViewerMetadataChange = { [K in keyof ViewerMetadata]?: ViewerMetadata[K] };

/**
 * Extensions which implement Viewer must subclass this.
 * 
 * Note that TypeScript subclasses should not provide a constructor. Pure
 * JavaScript subclasses can have a constructor but it must pass all of
 * its arguments to the super class.
 */
export interface ExtensionViewerBase {

  /**
   * Extension writers can override method to perform set up and
   * initialisation after construction.
   */
  created(): void;

  // updateMetadata(): void;

  /**
   * Get the container element under which this Viewer's contents can be placed.
   */
  getContainerElement(): HTMLElement;

  getMetadata(): ViewerMetadata;
  updateMetadata(changes: ViewerMetadataChange): void;
}


export interface ExtensionViewerBaseConstructor {
  new(...any: any[]): ExtensionViewerBase;
}

/**
 * This interface grants the extension at load and activtion time.
 * 
 * It provides access to the whole Extraterm extension API, as well as some
 * convenience class and objects.
 */
export interface ExtensionContext {
  workspace: Workspace;
  codeMirrorModule: typeof CodeMirror;
  logger: Logger;
}


export interface Logger {
  /**
   * Log a debug message.
   * 
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  debug(msg: any, ...opts: any[]): void;
  
  /**
   * Log an info message.
   * 
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  info(msg: any, ...opts: any[]): void;
  
  /**
   * Log a warning message.
   * 
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  warn(msg: any, ...opts: any[]): void;

  /**
   * Log a severe message.
   * 
   * @param msg     the log message
   * @param ...opts extra values to log with the message
   */
  severe(msg: any, ...opts: any[]): void;
    
  /**
   * Starts timing.
   *
   * See endTime().
   *
   * @param label identifying label for this timer
   */
  startTime(label: string): void;
  
  /**
   * Ends timing.
   *
   * Prints the timing result to the log. Label should be the same as the label given to startTime().
   *
   * @param label identifying label for the timer to end
   */
  endTime(label: string): void;
}


/**
 * An extension module as viewed from Extraterm.
 */
export interface ExtensionModule {

  /**
   * Each extension module must export a functioncalled `activate()` with signature below.
   * 
   * @param context The extension context which this extension is running in.
   * @return The public API of this extension, or null or undefined.
   */
  activate(context: ExtensionContext): any;
}
