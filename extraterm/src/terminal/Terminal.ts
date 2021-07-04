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
import {
  Direction,
  FocusPolicy,
  QBoxLayout,
  QKeyEvent,
  QScrollArea,
  QWidget,
  SizeConstraint,
  WidgetEventTypes,
  Shape,
  ScrollBarPolicy,
  QScrollBar,
  Orientation,
} from "@nodegui/nodegui";
const performanceNow = require('performance-now');

import * as Term from "../emulator/Term";
import { Tab } from "../Tab";
import { Block } from "./Block";
import { TerminalBlock } from "./TerminalBlock";
import { Pty } from "../pty/Pty";
import { TerminalEnvironmentImpl } from "./TerminalEnvironmentImpl";
import { TerminalVisualConfig } from "./TerminalVisualConfig";
import { qKeyEventToMinimalKeyboardEvent } from "../keybindings/QKeyEventUtilities";
import { KeybindingsIOManager } from "../keybindings/KeybindingsIOManager";
import { ExtensionManager } from "../extension/ExtensionManager";

export const EXTRATERM_COOKIE_ENV = "LC_EXTRATERM_COOKIE";


export class Terminal implements Tab, Disposable {
  private _log: Logger = null;

  #keybindingsIOManager: KeybindingsIOManager = null;
  #extensionManager: ExtensionManager = null;

  #pty: Pty = null;
  #emulator: Term.Emulator = null;
  #cookie: string = null;

  // The current size of the emulator. This is used to detect changes in size.
  #columns = -1;
  #rows = -1;

  #scrollArea: QScrollArea = null;
  #contentWidget: QWidget = null;
  #marginPx = 11;
  #verticalScrollBar: QScrollBar = null;
  #atBottom = true; // True if the terminal is scrolled to the bottom and should
                    // automatically scroll to the end as new rows arrive.

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

  constructor(extensionManager: ExtensionManager, keybindingsIOManager: KeybindingsIOManager) {
    this._log = getLogger("Terminal", this);
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;

    this.onDispose = this.#onDisposeEventEmitter.event;
    this.#cookie = crypto.randomBytes(10).toString("hex");
    this.#initEmulator(this.#cookie);
    this.#createUi();

    doLater(() => {
      this.resizeEmulatorFromTerminalSize();
    });
  }

  #createUi() : void {
    this.#scrollArea = new QScrollArea();
    this.#scrollArea.setWidgetResizable(true);
    this.#contentWidget = new QWidget();
    this.#contentWidget.setObjectName("content");
    this.#contentWidget.setFocusPolicy(FocusPolicy.ClickFocus);
    this.#contentWidget.setStyleSheet(`
    #content {
      background-color: #00ff00;
    }
    `);
    this.#contentWidget.addEventListener(WidgetEventTypes.KeyPress, (nativeEvent) => {
      this.#handleKeyPress(new QKeyEvent(nativeEvent));
    });
    this.#scrollArea.addEventListener(WidgetEventTypes.Resize, () => {
      this.#handleResize();
    });

    this.#contentLayout = new QBoxLayout(Direction.TopToBottom, this.#contentWidget);
    this.#contentLayout.setSizeConstraint(SizeConstraint.SetMinimumSize);
    this.#contentLayout.setContentsMargins(this.#marginPx, this.#marginPx, this.#marginPx, this.#marginPx);
    this.#scrollArea.setFrameShape(Shape.NoFrame);
    this.#scrollArea.setVerticalScrollBarPolicy(ScrollBarPolicy.ScrollBarAlwaysOn);
    this.#scrollArea.setWidget(this.#contentWidget);

    this.#verticalScrollBar = new QScrollBar();
    this.#verticalScrollBar.setOrientation(Orientation.Vertical);
    this.#verticalScrollBar.addEventListener("rangeChanged", (min: number, max: number) => {
      this.#handleVerticalScrollBarRangeChanged();
    });

    this.#verticalScrollBar.addEventListener("actionTriggered", (action: number) => {
      this.#handleVerticalScrollBarAction();
    });

    this.#scrollArea.setVerticalScrollBar(this.#verticalScrollBar);

    this.#contentLayout.addStretch(1);

    const terminalBlock = new TerminalBlock();
    this.appendBlock(terminalBlock);
    terminalBlock.setEmulator(this.#emulator);
  }

  #handleResize(): void {
    this.resizeEmulatorFromTerminalSize();
  }

  focus(): void {
    this.#contentWidget.setFocus();
  }

  unfocus(): void {
    this.#contentWidget.clearFocus();
  }

  computeTerminalSize(): { rows: number, columns: number } {
    if (this.#terminalVisualConfig == null) {
      return null;
    }

    const metrics = this.#terminalVisualConfig.fontMetrics;
    const maxSize = this.#scrollArea.maximumViewportSize();
    const columns = Math.floor((maxSize.width() - 2 * this.#marginPx) / metrics.widthPx);
    const rows = Math.floor((maxSize.height() - 2 * this.#marginPx) / metrics.heightPx);
    return { rows, columns };
  }

  resizeEmulatorFromTerminalSize(): void {
    const size = this.computeTerminalSize();
    if (size == null) {
      return;
    }

    const { columns, rows } = size;
    if (columns === this.#columns && rows === this.#rows) {
      return;
    }
    this.#columns = columns;
    this.#rows = rows;

    if (this.#pty != null) {
      this.#pty.resize(columns, rows);
    }

    this.#emulator.resize({rows, columns});

    this.environment.setList([
      { key: TerminalEnvironment.TERM_ROWS, value: "" + rows},
      { key: TerminalEnvironment.TERM_COLUMNS, value: "" + columns},
    ]);
  }

  #handleVerticalScrollBarAction(): void {
    this.#atBottom = this.#verticalScrollBar.sliderPosition() > (this.#verticalScrollBar.maximum() - this.#marginPx);
  }

  #handleVerticalScrollBarRangeChanged(): void {
    if (this.#atBottom) {
      this.#verticalScrollBar.setSliderPosition(this.#verticalScrollBar.maximum());
    }
  }

  #scrollToBottom(): void {
    if (this.#atBottom) {
      return;
    }
    this.#atBottom = true;
    this.#verticalScrollBar.setSliderPosition(this.#verticalScrollBar.maximum());
  }

  #handleKeyPress(event: QKeyEvent): void {
    const ev = qKeyEventToMinimalKeyboardEvent(event);

    const commands = this.#keybindingsIOManager.mapEventToCommands(ev);
    const filteredCommands = this.#extensionManager.queryCommands({
      commands,
      when: true
    });
    if (filteredCommands.length !== 0) {
      return;
    }

    this.#emulator.keyDown(ev);
    event.accept();

    this.#scrollToBottom();
  }

  setPty(pty: Pty): void {
    this.#pty = pty;

    pty.onData((text: string): void => {
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

    if (this.#pty != null) {
      this.#pty.destroy();
      this.#pty = null;
    }
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
    emulator.onData(this.#handleTermData.bind(this));

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

  #handleWriteBufferSize(event: TermApi.WriteBufferSizeEvent): void {
    if (this.#pty != null) {
      this.#pty.permittedDataSize(event.status.bufferSize);
    }
  }

  #handleTermData(event: TermApi.DataEvent): void {
    this.sendToPty(event.data);
  }
}
