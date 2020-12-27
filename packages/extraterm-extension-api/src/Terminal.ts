/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event } from "./Utilities";
import { Tab } from "./Tab";
import { TerminalEnvironment } from "./TerminalEnvironment";
import { SessionConfiguration } from "./Sessions";
import { Block } from "./Block";


/**
 * An active terminal with connected TTY.
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
   * Get the tab which holds this terminal.
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

  openTerminalBorderWidget(name: string): any;

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
   * Fired when a lines are added to the scrollback area of a block.
   */
  readonly onDidAppendScrollbackLines: Event<AppendScrollbackLinesDetail>;
}

/**
 * Describes a range of lines in the scrollback of a block which were just appended.
 */
export interface AppendScrollbackLinesDetail {
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
  readonly containerElement: HTMLElement;

  close(): void;

  readonly isOpen: boolean;

  onDidOpen: Event<void>;
  onDidClose: Event<void>;
}

export interface TerminalBorderWidgetFactory {
  (terminal: Terminal, widget: TerminalBorderWidget): any;
}
