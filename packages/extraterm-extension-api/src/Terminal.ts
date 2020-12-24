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
   * This event is fired after a block is appended to the terminal.
   *
   * The contents of the event is the new block itself.
   */
  onDidAppendBlock: Event<Block>;

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

  environment: TerminalEnvironment;

  /**
   * The session configuration associated with this terminal.
   *
   * Use `getSessionSettings()` to fetch extension settings.
   */
  sessionConfiguration: SessionConfiguration;

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
