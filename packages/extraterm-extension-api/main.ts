/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as Ace from "ace-ts";


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

  openTerminalBorderWidget(name: string): any;
}

export interface TerminalBorderWidget {
  getContainerElement(): HTMLElement;
  close(): void;
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
  find(needle: string): void;
  findNext(needle: string): void;
  findPrevious(needle: string): void;
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

  /**
   * Return true if line numbers are being shown in the gutter.
   */
  getShowLineNumbers(): boolean;

  /**
   * Set whether to show line numebrs in the gutter.
   */
  setShowLineNumbers(show: boolean): void;

  /**
   * Set whether long lines should be wrapped.
   */
  setWrapLines(wrap: boolean): void;
  
  /**
   * Return true if long lines are set to be wrapped.
   */
  getWrapLines(): boolean;
}


export type Viewer = FrameViewer | TerminalOutputViewer | TextViewer;

export interface CustomizedCommand {
  title?: string;
  checked?: boolean;
}

export interface Commands {
  /**
   * Register the function to handle a command.
   * 
   * @param name the name of the command as specified in the `package.json` contributes/commands section.
   * @param commandFunc the function to execute when the command is selected.
   * @param customizer an optional function to customize the title or state of the command.
   */
  registerCommand(name: string, commandFunc: (args: any) => any, customizer?: () => (CustomizedCommand | null)): void;

  /**
   * Execute a command by name.
   * 
   * @param name the full name of the command.
   * @param args arguments for the command.
   * @returns an optional return value.
   */
  executeCommand<T>(name: string, args: any): Promise<T> | null;

  /**
   * Get a list of all available commands.
   */
  getCommands(): string[];
}

export interface TerminalBorderWidgetFactory {
  (terminal: Terminal, widget: TerminalBorderWidget): any;
}

export interface Window {
  activeTerminal: Terminal;
  activeViewer: Viewer;
  getTerminals(): Terminal[];
  onDidCreateTerminal: Event<Terminal>;
  // onWillDestroyTerminal: Event<Terminal>;

  extensionViewerBaseConstructor: ExtensionViewerBaseConstructor;
  registerViewer(name: string, viewerClass: ExtensionViewerBaseConstructor): void;

  extensionSessionEditorBaseConstructor: ExtensionSessionEditorBaseConstructor;
  registerSessionEditor(type: string, sessionEditorClass: ExtensionSessionEditorBaseConstructor): void;

  registerTerminalBorderWidget(name: string, factory: TerminalBorderWidgetFactory): void;
}


export interface BulkFileMetadata {
  readonly [index: string]: (string | number | undefined);
}


export enum BulkFileState {
  DOWNLOADING,
  COMPLETED,
  FAILED
}


/**
 * A handle for accessing a bulk file.
 */
export interface BulkFileHandle {

  getState(): BulkFileState;

  /**
   * Get a URL to the file contents.
   */
  getUrl(): string;

  /**
   * The number of bytes of the file which are available.
   * 
   * This value can change when a file is being downloaded. See the event
   * `onAvailableSizeChange`.
   */
  getAvailableSize(): number;
  onAvailableSizeChange: Event<number>;
    
  /**
   * Get the complete size of the file.
   * 
   * This may be -1 if the total size is unknown.
   */
  getTotalSize(): number;

  /**
   * Get the metadata associated with the file.
   * 
   * The keys are simply strings and are specific to the file type.
   */
  getMetadata(): BulkFileMetadata;

  /**
   * Get the first 1KB of the file contents.
   * 
   * @return The first 1KB of file or less if the available size and/or total
   *          size is less than 1024.
   */
  peek1KB(): Buffer;

  /**
   * Reference the file and increment its internal reference count.
   * 
   * Files are managed and deleted when unneeded by using a simple reference
   * counting scheme. When a file handle is held it must also be referenced
   * by calling this method. When a file handle is no longer needed, then the
   * matching `deref()` method must be called.
   * 
   * When a file's internal reference count transitions to zero, then the file
   * may be cleaned up and removed on the next process tick.
   */
  ref(): void;

  /**
   * Dereference this file.
   * 
   * See `ref()` above.
   */
  deref(): void;

  /**
   * This event is fired when the file has been completely downloaded or fails.
   */
  onStateChange: Event<BulkFileState>;
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

  /**
   * Get the container element under which this Viewer's contents can be placed.
   */
  getContainerElement(): HTMLElement;

  /**
   * Get the metadata describing this viewer.
   */
  getMetadata(): ViewerMetadata;

  /**
   * Change fields in the metadata.
   *
   * @param changes object containing the fields to change
   */
  updateMetadata(changes: ViewerMetadataChange): void;

  /**
   * Get a BulkFileHandle with the contents of this viewer.
   */
  getBulkFileHandle(): BulkFileHandle;

  /**
   *
   */
  setBulkFileHandle(handle: BulkFileHandle): Promise<void>;
}


export interface ExtensionViewerBaseConstructor {
  new(...any: any[]): ExtensionViewerBase;
}

export interface SessionConfiguration {
  uuid: string;
  name: string;             // Human readable name for the profile.
  type?: string;            // type - "cygwin", "babun" or "native" ("" means "native")
  args?: string;            // command line arguments to be passed to command
}

/**
 * Extensions which implement Session Editor must subclass this.
 * 
 * Note that TypeScript subclasses should not provide a constructor. Pure
 * JavaScript subclasses can have a constructor but it must pass all of
 * its arguments to the super class.
 */
export interface ExtensionSessionEditorBase {
  /**
   * Extension writers can override method to perform set up and
   * initialisation after construction.
   */
  created(): void;

  /**
   * Get the container element under which this Viewer's contents can be placed.
   */
  getContainerElement(): HTMLElement;

  setSessionConfiguration(sessionConfiguration: SessionConfiguration): void;

  getSessionConfiguration(): SessionConfiguration;

  updateSessionConfiguration(sessionConfigurationChange: object): void;
}

export interface ExtensionSessionEditorBaseConstructor {
  new(...any: any[]): ExtensionSessionEditorBase;
}

export interface EnvironmentMap {
  [key: string]: string;
}

export interface SessionBackend {
  defaultSessionConfigurations(): SessionConfiguration[];

  createSession(sessionConfiguration: SessionConfiguration, extraEnv: EnvironmentMap, cols: number, rows: number): Pty;
}

export interface BufferSizeChange {
  totalBufferSize: number;  // Sizes here are in 16bit characters.
  availableDelta: number;
}


/**
 * Represents a PTY.
 */
export interface Pty {
  /**
   * Write data to the pty
   *
   * @param data data to write.
   */
  write(data: string): void;

  getAvailableWriteBufferSize(): number;

  onAvailableWriteBufferSizeChange: Event<BufferSizeChange>;

  /**
   * Tell the pty that the size of the terminal has changed
   *
   * @param cols number of columns in ther terminal.
   * @param rows number of rows in the terminal.
   */
  resize(cols: number, rows: number): void;

  permittedDataSize(size: number): void;

  /**
   * Destroy the pty and shut down the attached process
   */
  destroy(): void;
  
  onData: Event<string>;
  
  onExit: Event<void>;
}

/**
 * A Terminal Theme Provider supplies terminal themes to Extraterm.
 * 
 * It exposes its list of terminal themes and a method to fetch the contents
 * of a requested theme..
 */
export interface TerminalThemeProvider {
  /**
   * Scan for themes and return a list.
   * 
   * @param paths a list of directories which may be used to scan for themes.
   * @return the list of themes found which this provider can also read.
   */
  scanThemes(paths: string[]): TerminalThemeInfo[];

  /**
   * Read in the contents of request theme.
   * 
   * @param paths a list of directories which may contain themes. This is the same list as in `scanThemes()`
   * @return the theme contents.
   */
  readTheme(paths: string[], id: string): TerminalTheme;
}

/**
 * Describes a terminal theme.
 */
export interface TerminalThemeInfo {
  /** Unique (for this provider) ID of the theme. */
  id: string;

  /**
   * Human readable name of the theme.
   */
  name: string;

  /**
   * Human readable comment regarding this theme.
   */
  comment: string;
}

export interface TerminalTheme {
  foregroundColor?: string;
  backgroundColor?: string;
  cursorForegroundColor?: string;
  cursorBackgroundColor?: string;
  selectionBackgroundColor?: string;

  [colorIndex: number]: string;
  // selectionunfocused-background-color: #404040;
}

/**
 * A Syntax Theme Provider supplies syntax themes to Extraterm.
 * 
 * It exposes its list of syntax themes and a method to fetch the contents
 * of a requested theme..
 */
export interface SyntaxThemeProvider {
  /**
   * Scan for themes and return a list.
   * 
   * @param paths a list of directories which may be used to scan for themes.
   * @return the list of themes found which this provider can also read.
   */
  scanThemes(paths: string[]): SyntaxThemeInfo[];

  /**
   * Read in the contents of request theme.
   * 
   * @param paths a list of directories which may contain themes. This is the same list as in `scanThemes()`
   * @return the theme contents.
   */
  readTheme(paths: string[], id: string): SyntaxTheme;
}

export interface SyntaxThemeInfo extends TerminalThemeInfo {

}

/**
 * The contents of a syntax theme.
 * 
 * Note: All color strings must be of the form #RRGGBB.
 */
export interface SyntaxTheme {
  /**
   * Default text foreground color.
   */
  foreground: string;

  /**
   * Default text background color.
   */
  background: string;

  /**
   * Color of the cursor.
   */
  cursor: string;

  /**
   * Color to show whitespace characters (when enabled).
   */
  invisibles: string;

  /**
   * Color of the line highlight.
   */
  lineHighlight: string;

  /**
   * Selection color.
   */
  selection: string;
  
  /**
   * List of token coloring rules.
   */
  syntaxTokenRule: SyntaxTokenRule[];
}

export interface SyntaxTokenRule {
  /**
   * Scope of the rule.
   * 
   * This string follows the naming convention for syntax token as described
   * in https://www.sublimetext.com/docs/3/scope_naming.html
   * Note that only one scope rule can be put in this field.
   */
  scope: string;

  /**
   * The text style to apply to this token.
   */
  textStyle: TextStyle;
}

/**
 * Describes a text style.
 */
export interface TextStyle {
  /**
   * Optional foreground color. Format is CSS sstyle #RRGGBB.
   */
  foregroundColor?: string;

  /**
   * Optional background color. Format is CSS sstyle #RRGGBB.
   */
  backgroundColor?: string;

  /**
   * Show as bold text.
   */
  bold?: boolean;

  /**
   * Show as italic text.
   */
  italic?: boolean;

  /**
   * Show as underline text.
   */
  underline?: boolean;
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
 * This interface grants the extension at load and activtion time.
 * 
 * It provides access to the whole Extraterm extension API, as well as some
 * convenience class and objects.
 */
export interface ExtensionContext {

  readonly commands: Commands;

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
