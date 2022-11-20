/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QWidget } from "@nodegui/nodegui";
import { Event } from "extraterm-event-emitter";

import { Tab } from "./Tab.js";
import { TerminalEnvironment } from "./TerminalEnvironment.js";
import { SessionConfiguration } from "./Sessions.js";
import { Block, ExtensionBlock } from "./Block.js";
import { ScreenWithCursor } from "./Screen.js";
import { ListPickerOptions } from "./ListPickerOptions.js";


export type ExtensionBlockFactory = (extensionBlock: ExtensionBlock) => void;

// TODO: Rename this file to Terminals.ts

export interface Terminals {
  readonly terminals: Terminal[];

  readonly onDidCreateTerminal: Event<Terminal>;
  // onWillDestroyTerminal: Event<Terminal>;

  /**
   * Register the extension block factory for a given block name.
   *
   * @param name The name of the block type as defined in `package.json`.
   * @param factory The factory function itself.
   */
  registerBlock(name: string, factory: ExtensionBlockFactory): void;
}


/**
 * An active terminal with connected TTY.
 *
 * A Terminal is the contents of a typical terminal tab. From a terminal
 * emulation point of view the terminal consists of a `screen` which is the
 * area where terminal applications can render output to, and a scrollback
 * area where rows of text which have "scrolled off" the top of the screen
 * are kept.
 *
 * Extraterm's model for the contents of the terminal is slightly more complex
 * than traditional terminal emulators. The contents of a terminal in Extraterm
 * is a stack of "blocks" of content which can be a mix of framed terminal
 * output and "viewers" holding different data like images and downloads. The
 * `blocks` property exposes this stack. New terminal output from applications
 * appears the last terminal output block. A terminal output block contains a
 * bunch of rows in its `scrollback` property. When a terminal output block is
 * the target of emulation, the contents of the `screen` visually appear as
 * part of this block.
 *
 * In the common case where no shell integration is being used, there will be
 * just one terminal output block, much like a traditional terminal emulator.
 */
export interface Terminal {
  /**
   * Type a string of text into the terminal.
   *
   * This is effectively the same as though the user typed into the terminal.
   * Note that the enter key should be represented as `\r`.
   */
  type(text: string): void;

  /**
   * List of blocks shown inside this terminal.
   */
  readonly blocks: Block[];

  /**
   * Event fired after a block is appended to the terminal.
   *
   * The contents of the event is the new block itself.
   */
  readonly onDidAppendBlock: Event<Block>;

  /**
   * The active part of the screen/grid which the terminal emulation controls
   * and terminals applications can access and render into.
   */
  readonly screen: ScreenWithCursor;

  /**
   * Event fired when lines in the screen are changed.
   *
   * This event is fired whenever rows on the screen are changed and rendered
   * to the window. It is not fired for every change made to a row. The
   * process of updating the contents of the screen internally and the process
   * of showing that in the window to the user, are decoupled for performance
   * reasons. Many updates to the screen internally may result in just one
   * update to the window itself.
   */
  readonly onDidScreenChange: Event<LineRangeChange>;

  /**
   * Fired when a lines are added to the scrollback area of a block.
   */
  readonly onDidAppendScrollbackLines: Event<LineRangeChange>;

  /**
   * The tab which holds this terminal
   */
  readonly tab: Tab;

  /**
   * The value of the Extraterm terminal integration cookie specific to this
   * terminal.
   */
  readonly extratermCookieValue: string;

  /**
   * The name of the Extraterm terminal integration cookie.
   */
  readonly extratermCookieName: string;

  createTerminalBorderWidget(name: string): TerminalBorderWidget;

  readonly environment: TerminalEnvironment;

  /**
   * The session configuration associated with this terminal.
   *
   * Use `getSessionSettings()` to fetch extension settings.
   */
  readonly sessionConfiguration: SessionConfiguration;

  /**
   * Get the extension settings associated with this terminal.
   *
   * @param name the same `name` passed to `Window.registerSessionSettingsEditor()`.
   */
  getSessionSettings(name: string): Object;

  /**
   * True if this terminal is still open.
   *
   * Once the uesr closes a terminal tab and the tab disappears, then this will return `false`.
   */
  readonly isAlive: boolean;

  /**
   * Show a list picker at the cursor and allow an item to be selected.
   *
   * This shows the given list of strings and lets the user select one or
   * them or cancel the picker. The index of the item in the list is return
   * if an item is selected. `undefined` is returned if the user canceled the
   * picker by pressing escape, for example. The picker appears with in this
   * tab.
   *
   * See `ListPickerOptions` for more details about how to configure this.
   *
   * @return a promise which resolves to the selected item index or
   *          undefined if it was canceled.
   */
  showOnCursorListPicker(options: ListPickerOptions): Promise<number | undefined>;

  /**
   * Get the current working directory of locally running shell process
   * connected to this terminal.
   *
   * Note: This can be unreliable for certain session types and should be considered a best effort.
   *
   * @return a promise which resolves to the path of the working directory or null.
   */
  getWorkingDirectory(): Promise<string | null>;

  /**
   * True if the terminal is connected to a live TTY.
   */
  readonly isConnected: boolean;

  /**
   * Geometry of the terminal viewport shown in the window.
   */
  readonly viewport: Viewport;
}


export interface Viewport {
  /**
   * The height of the viewport in pixels.
   */
  readonly height: number;

  /**
   * The position of the top of the viewport relative to the contents.
   *
   * Setting this changes the position of the viewport.
   */
  position: number;

  /**
   * The total height of the content inside the viewport.
   */
  readonly contentHeight: number;

  /**
   * Event fired when the size or position of the viewport changes.
   */
  readonly onDidChange: Event<void>;
}

/**
 * Describes a range of lines.
 */
export interface LineRangeChange {
  /**
   * The block which received the new scrollback lines.
   *
   * Its type will be `TerminalOutputType`.
   */
  block: Block;

  /**
   * The index into the scrollback area of the first line added.
   *
   * The complete range of affected lines is from `startLine` up to but not including `endLine`.
   */
  startLine: number;

  /**
   * The index after the last affected line.
   *
   * The range of affected lines is from `startLine` up to but not including `endLine`.
   */
  endLine: number;
}

export interface TerminalBorderWidget {
  contentWidget: QWidget;

  open(): void;
  close(): void;

  readonly isOpen: boolean;
}
