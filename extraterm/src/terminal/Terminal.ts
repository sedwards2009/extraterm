/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from "crypto";
import * as TermApi from "term-api";
import { getLogger, log, Logger } from "extraterm-logging";
import { EventEmitter } from "extraterm-event-emitter";
import { doLater } from "extraterm-later";
import {
  Disposable,
  Event,
  SessionConfiguration,
  TerminalEnvironment,
} from "@extraterm/extraterm-extension-api";
import { Direction, QBoxLayout, QScrollArea, QWidget, SizeConstraint } from "@nodegui/nodegui";
const performanceNow = require('performance-now');

import * as Term from "../emulator/Term";
import { Tab } from "../Tab";
import { Block } from "./Block";
import { TerminalBlock } from "./TerminalBlock";
import { Pty } from "../pty/Pty";
import { TerminalEnvironmentImpl } from "./TerminalEnvironmentImpl";
import { TerminalVisualConfig } from "./TerminalVisualConfig";

export const EXTRATERM_COOKIE_ENV = "LC_EXTRATERM_COOKIE";


export class Terminal implements Tab, Disposable {
  private _log: Logger = null;

  #pty: Pty = null;
  #emulator: Term.Emulator = null;

  #cookie: string = null;

  // The current size of the emulator. This is used to detect changes in size.
  #columns = 80;
  #rows = 24;

  #scrollArea: QScrollArea = null;
  #blocks: Block[] = [];
  #contentLayout: QBoxLayout = null;

  onDispose: Event<void>;
  #onDisposeEventEmitter = new EventEmitter<void>();

  #sessionConfiguration: SessionConfiguration = null;
  #terminalVisualConfig: TerminalVisualConfig = null;

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
    this.#initEmulator(this.#cookie);
    this.#createUi();
  }

  #createUi() : void {
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

    const terminalBlock = new TerminalBlock();
    this.appendBlock(terminalBlock);
    terminalBlock.setEmulator(this.#emulator);
  }

  setPty(pty: Pty): void {
    this.#pty = pty;

    pty.onData((text: string): void => {
this._log.debug(`onData: ${text}`);
      this.#emulator.write(text);
    });

    doLater(() => {
      pty.resize(this.#columns, this.#rows);
      pty.permittedDataSize(1024);
    });
  }

  setTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): void {
    this.#terminalVisualConfig = terminalVisualConfig;
    for (const block of this.#blocks) {
      if (block instanceof TerminalBlock) {
        block.setTerminalVisualConfig(terminalVisualConfig);
      }
    }
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

  /**
   * Send data to the pty and process connected to the terminal.
   * @param text the data to send.
   */
  sendToPty(text: string): void {
    this.#pty.write(text);
  }

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

  getEmulator(): Term.Emulator {
    return this.#emulator;
  }

  #initEmulator(cookie: string): void {
    const emulator = new Term.Emulator({
      platform: <Term.Platform> process.platform,
      applicationModeCookie: cookie,
      debug: true,
      performanceNowFunc: performanceNow
    });

    emulator.debug = true;
    // emulator.onTitleChange(this._handleTitle.bind(this));
    // emulator.onData(this._handleTermData.bind(this));
    emulator.onRender(this.#handleTermSize.bind(this));
    // emulator.onScreenChange(this._handleScreenChange.bind(this));

    // Application mode handlers
    // const applicationModeHandler: TermApi.ApplicationModeHandler = {
    //   start: this._handleApplicationModeStart.bind(this),
    //   data: this._handleApplicationModeData.bind(this),
    //   end: this._handleApplicationModeEnd.bind(this)
    // };
    // emulator.registerApplicationModeHandler(applicationModeHandler);
    emulator.onWriteBufferSize(this.#handleWriteBufferSize.bind(this));
    // if (this._terminalVisualConfig != null) {
    //   emulator.setCursorBlink(this._terminalVisualConfig.cursorBlink);
    // }
    this.#emulator = emulator;
    // this._initDownloadApplicationModeHandler();
  }

  #handleTermSize(event: TermApi.RenderEvent): void {
    const newColumns = event.columns;
    const newRows = event.rows;
    if (this.#columns === newColumns && this.#rows === newRows) {
      return;
    }
    this.#columns = newColumns;
    this.#rows = newRows;

    if (this.#pty != null) {
      this.#pty.resize(newColumns, newRows);

      this.environment.setList([
        { key: TerminalEnvironment.TERM_ROWS, value: "" + newRows},
        { key: TerminalEnvironment.TERM_COLUMNS, value: "" + newColumns},
      ]);
    }
  }

  #handleWriteBufferSize(event: TermApi.WriteBufferSizeEvent): void {
    this._log.debug("#handleWriteBufferSize()");
    if (this.#pty != null) {
      this.#pty.permittedDataSize(event.status.bufferSize);
    }
  }

}
