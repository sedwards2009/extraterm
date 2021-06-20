/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from "crypto";
import { getLogger, log, Logger } from "extraterm-logging";
import { EventEmitter } from "extraterm-event-emitter";

import {
  Disposable,
  Event,
  SessionConfiguration,
  TerminalEnvironment,
} from "@extraterm/extraterm-extension-api";

import { Direction, QBoxLayout, QScrollArea, QWidget, SizeConstraint } from "@nodegui/nodegui";
import { Tab } from "../Tab";
import { Block } from "./Block";
import { TerminalBlock } from "./TerminalBlock";
import { Pty } from "../pty/Pty";
import { TerminalEnvironmentImpl } from "./TerminalEnvironmentImpl";

export const EXTRATERM_COOKIE_ENV = "LC_EXTRATERM_COOKIE";


export class Terminal implements Tab, Disposable {
  private _log: Logger = null;

  #pty: Pty = null;
  #cookie: string = null;

  // The current size of the emulator. This is used to detect changes in size.
  #columns = -1;
  #rows = -1;

  #scrollArea: QScrollArea = null;
  #blocks: Block[] = [];
  #contentLayout: QBoxLayout = null;

  onDispose: Event<void>;
  #onDisposeEventEmitter = new EventEmitter<void>();

  #sessionConfiguration: SessionConfiguration = null;

  environment = new TerminalEnvironmentImpl([
    { key: TerminalEnvironment.TERM_ROWS, value: "" },
    { key: TerminalEnvironment.TERM_COLUMNS, value: "" },
    { key: TerminalEnvironment.EXTRATERM_CURRENT_COMMAND_LINE, value: "" },
    { key: TerminalEnvironment.EXTRATERM_CURRENT_COMMAND, value: "" },
    { key: TerminalEnvironment.EXTRATERM_EXIT_CODE, value: "" },
    { key: TerminalEnvironment.EXTRATERM_LAST_COMMAND_LINE, value: "" },
    { key: TerminalEnvironment.EXTRATERM_LAST_COMMAND, value: "" },
  ]);


  constructor() {
    this._log = getLogger("Terminal", this);

    this.onDispose = this.#onDisposeEventEmitter.event;
    this.#cookie = crypto.randomBytes(10).toString("hex");

    this.#scrollArea = new QScrollArea();
    this.#scrollArea.setWidgetResizable(true);
    const contentWidget = new QWidget();
    contentWidget.setObjectName("content");
    contentWidget.setStyleSheet(`
    #content {
      background-color: #00ff00;
    }
    `);
    this.#contentLayout = new QBoxLayout(Direction.TopToBottom, contentWidget);
    this.#contentLayout.setSizeConstraint(SizeConstraint.SetMinimumSize);
    this.#scrollArea.setWidget(contentWidget);
    this.#contentLayout.addStretch(1);

    this.appendBlock(new TerminalBlock());
  }

  dispose(): void {
    this.#onDisposeEventEmitter.fire();
    this.#onDisposeEventEmitter.dispose();

    this.#pty = null;
  }

  setSessionConfiguration(sessionConfiguration: SessionConfiguration): void {
    this.#sessionConfiguration = sessionConfiguration;
  }

  getSessionConfiguration(): SessionConfiguration {
    return this.#sessionConfiguration;
  }

  appendBlock(block: Block): void {
    this.#blocks.push(block);
    const geo = block.getWidget().geometry();
    this.#contentLayout.insertWidget(this.#blocks.length-1, block.getWidget());
  }

  getTitle(): string {
    return "Terminal";
  }

  getContents(): QWidget {
    return this.#scrollArea;
  }

  getPty(): Pty {
    return this.#pty;
  }

  setPty(pty: Pty): void {
    this.#pty = pty;

    // pty.onData((text: string): void => {
    //   this._emulator.write(text);
    // });

    // doLater(() => {
    //   pty.resize(this._columns, this._rows);
    // });
  }

  /**
   * Send data to the pty and process connected to the terminal.
   * @param text the data to send.
   */
  sendToPty(text: string): void {
    this.#pty.write(text);
  }

  // getEmulator(): Term.Emulator {
  //   return this._emulator;
  // }

  /**
   * The number of columns in the terminal screen.
   */
  getColumns(): number {
    return this.#columns;
  }

  /**
   * The number of rows in the terminal screen.
   */
  getRows(): number {
    return this.#rows;
  }

  getExtratermCookieValue(): string {
    return this.#cookie;
  }

  getEmulator(): any { //Term.Emulator {
    return null;
    // return this._emulator;
  }
}
