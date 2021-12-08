/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from "crypto";
import * as TermApi from "term-api";
import { getLogger, log, Logger } from "extraterm-logging";
import { EventEmitter } from "extraterm-event-emitter";
import { DeepReadonly } from "extraterm-readonly-toolbox";
import { doLater } from "extraterm-later";
import {
  Commands,
  Disposable,
  Event,
  SessionConfiguration,
  TerminalEnvironment,
  ViewerMetadata,
  ViewerPosture,
} from "@extraterm/extraterm-extension-api";
import {
  Direction,
  FocusPolicy,
  KeyboardModifier,
  MouseButton,
  Orientation,
  QApplication,
  QBoxLayout,
  QClipboardMode,
  QKeyEvent,
  QMouseEvent,
  QScrollArea,
  QScrollBar,
  QWidget,
  ScrollBarPolicy,
  Shape,
  SizeConstraint,
  SliderAction,
  WidgetEventTypes,
} from "@nodegui/nodegui";
const performanceNow = require('performance-now');

import * as Term from "../emulator/Term";
import { Tab } from "../Tab";
import { Block } from "./Block";
import { AppendScrollbackLinesDetail, TerminalBlock } from "./TerminalBlock";
import { Pty } from "../pty/Pty";
import { TerminalEnvironmentImpl } from "./TerminalEnvironmentImpl";
import { PALETTE_BG_INDEX, TerminalVisualConfig } from "./TerminalVisualConfig";
import { qKeyEventToMinimalKeyboardEvent } from "../keybindings/QKeyEventUtilities";
import { KeybindingsIOManager } from "../keybindings/KeybindingsIOManager";
import { ExtensionManager } from "../extension/ExtensionManager";
import { Color } from "extraterm-color-utilities";
import { ConfigDatabase } from "../config/ConfigDatabase";
import { CommandLineAction, MouseButtonAction } from "../config/Config";
import { computeFontMetrics } from "extraterm-char-render-canvas";
import { CommandQueryOptions } from "../InternalTypes";
import { ScreenChangeEvent } from "term-api";
import { BlockFrame } from "./BlockFrame";
import { DecoratedFrame } from "./DecoratedFrame";
import { SpacerFrame } from "./SpacerFrame";
import { UiStyle } from "../ui/UiStyle";

export const EXTRATERM_COOKIE_ENV = "LC_EXTRATERM_COOKIE";

interface TerminalSize {
  rows: number;
  columns: number;
  leftMargin: number;
  topMargin: number;
  rightMargin: number;
  bottomMargin: number;
}

export interface LineRangeChange {
  terminalBlock: TerminalBlock;
  startLine: number;
  endLine: number;
}


export interface ContextMenuEvent {
  x: number;
  y: number;
}

const MINIMUM_FONT_SIZE = -3;
const MAXIMUM_FONT_SIZE = 4;
const FONT_ADJUSTMENT_ARRAY = [0.6, 0.75, 0.89, 1, 1.2, 1.5, 2, 3];

const DEBUG_APPLICATION_MODE = false;

const enum ApplicationMode {
  APPLICATION_MODE_NONE = 0,
  APPLICATION_MODE_HTML = 1,
  APPLICATION_MODE_OUTPUT_BRACKET_START = 2,
  APPLICATION_MODE_OUTPUT_BRACKET_END = 3,
  APPLICATION_MODE_REQUEST_FRAME = 4,
  APPLICATION_MODE_SHOW_FILE = 5,
}

export class Terminal implements Tab, Disposable {
  private _log: Logger = null;

  #uiStyle: UiStyle = null;
  #configDatabase: ConfigDatabase = null;
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

  #blockFrames: BlockFrame[] = [];
  #contentLayout: QBoxLayout = null;

  onDispose: Event<void>;
  #onDisposeEventEmitter = new EventEmitter<void>();

  #onSelectionChangedEventEmitter = new EventEmitter<void>();
  onSelectionChanged: Event<void>;

  #onContextMenuEventEmitter = new EventEmitter<ContextMenuEvent>();
  onContextMenu: Event<ContextMenuEvent>;

  #onDidAppendScrollbackLinesEventEmitter = new EventEmitter<LineRangeChange>();
  onDidAppendScrollbackLines: Event<LineRangeChange>;

  #onDidScreenChangeEventEmitter = new EventEmitter<LineRangeChange>();
  onDidScreenChange: Event<LineRangeChange>;

  #blockDidAppendScrollbackLinesDisposable: Disposable = null;

  #sessionConfiguration: SessionConfiguration = null;
  #terminalVisualConfig: TerminalVisualConfig = null;
  #originalTerminalVisualConfig: TerminalVisualConfig = null;

  #fontSizeAdjustment = 0;

  private _htmlData: string = null;
  // private _fileBroker: BulkFileBroker = null;
  // private _downloadHandler: DownloadApplicationModeHandler = null;
  private _applicationMode: ApplicationMode = ApplicationMode.APPLICATION_MODE_NONE;
  private _bracketStyle: string = null;

  // The command line string of the last command started.
  private _lastCommandLine: string = null;


  environment = new TerminalEnvironmentImpl([
    { key: TerminalEnvironment.TERM_ROWS, value: "" },
    { key: TerminalEnvironment.TERM_COLUMNS, value: "" },
    { key: TerminalEnvironment.EXTRATERM_CURRENT_COMMAND_LINE, value: "" },
    { key: TerminalEnvironment.EXTRATERM_CURRENT_COMMAND, value: "" },
    { key: TerminalEnvironment.EXTRATERM_EXIT_CODE, value: "" },
    { key: TerminalEnvironment.EXTRATERM_LAST_COMMAND_LINE, value: "" },
    { key: TerminalEnvironment.EXTRATERM_LAST_COMMAND, value: "" },
  ]);

  static registerCommands(extensionManager: ExtensionManager): void {
    const commands = extensionManager.getExtensionContextByName("internal-commands").commands;

    commands.registerCommand("extraterm:terminal.scrollPageDown",
      () => extensionManager.getActiveTerminal().scrollPageDown());
    commands.registerCommand("extraterm:terminal.scrollPageUp",
      () => extensionManager.getActiveTerminal().scrollPageUp());
    commands.registerCommand("extraterm:terminal.pasteFromClipboard",
      () => extensionManager.getActiveTerminal().commandPasteFromClipboard());
    commands.registerCommand("extraterm:terminal.copyToClipboard",
      () => extensionManager.getActiveTerminal().commandCopyToClipboard());
    commands.registerCommand("extraterm:terminal.resetVT",
      () => extensionManager.getActiveTerminal().commandResetVT());
    commands.registerCommand("extraterm:terminal.increaseFontSize",
      (args: any) => extensionManager.getActiveTerminal().commandFontSizeIncrease());
    commands.registerCommand("extraterm:terminal.decreaseFontSize",
      (args: any) => extensionManager.getActiveTerminal().commandFontSizeDecrease());
    commands.registerCommand("extraterm:terminal.resetFontSize",
      (args: any) => extensionManager.getActiveTerminal().commandFontSizeReset());
  }

  constructor(configDatabase: ConfigDatabase, uiStyle: UiStyle, extensionManager: ExtensionManager,
      keybindingsIOManager: KeybindingsIOManager) {

    this._log = getLogger("Terminal", this);
    this.onSelectionChanged = this.#onSelectionChangedEventEmitter.event;
    this.onContextMenu = this.#onContextMenuEventEmitter.event;
    this.onDidAppendScrollbackLines = this.#onDidAppendScrollbackLinesEventEmitter.event;
    this.onDidScreenChange = this.#onDidScreenChangeEventEmitter.event;

    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;
    this.#uiStyle = uiStyle;

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
    this.#scrollArea.setFrameShape(Shape.NoFrame);
    this.#scrollArea.setVerticalScrollBarPolicy(ScrollBarPolicy.ScrollBarAlwaysOn);
    this.#scrollArea.addEventListener(WidgetEventTypes.Resize, () => {
      this.#handleResize();
    });

    this.#contentWidget = new QWidget();
    this.#contentWidget.setObjectName("content");
    this.#contentWidget.setFocusPolicy(FocusPolicy.ClickFocus);
    this.#contentWidget.addEventListener(WidgetEventTypes.KeyPress, (nativeEvent) => {
      this.#handleKeyPress(new QKeyEvent(nativeEvent));
    });
    this.#contentWidget.addEventListener(WidgetEventTypes.MouseButtonPress, (nativeEvent) => {
      this.#handleMouseButtonPress(new QMouseEvent(nativeEvent));
    });
    this.#contentLayout = new QBoxLayout(Direction.TopToBottom, this.#contentWidget);
    this.#contentLayout.setSizeConstraint(SizeConstraint.SetMinimumSize);
    this.#contentLayout.setContentsMargins(0, 0, 0, 0);

    this.#scrollArea.setWidget(this.#contentWidget);

    this.#scrollArea.viewport().setObjectName("viewport");

    // For some reason the viewport widget appears like small (invisible)
    // postage stamp on top of the scrollarea contents and gets in the
    // way by consuming mouse clicks etc. Here we make the problem visible
    // and then hide it which seems to work around the problem.
    this.#scrollArea.viewport().setStyleSheet(`
      QWidget {
        background-color: #0f0;
      }
    `);
    this.#scrollArea.viewport().hide();

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

    this.#appendBlockFrame(this.#createTerminalBlock());
  }

  #createTerminalBlock(): BlockFrame {
    const terminalBlock = new TerminalBlock();
    terminalBlock.setEmulator(this.#emulator);
    if (this.#terminalVisualConfig != null) {
      terminalBlock.setTerminalVisualConfig(this.#terminalVisualConfig);
    }

    terminalBlock.onSelectionChanged(() => {
      this.#onSelectionChangedEventEmitter.fire();
    });
    terminalBlock.onHyperlinkClicked((url: string): void => {
      this.#handleHyperlinkClick(url);
    });
    terminalBlock.onHyperlinkHover((url: string): void => {
      this.#handleHyperlinkHover(terminalBlock, url);
    });

    this.#blockDidAppendScrollbackLinesDisposable = terminalBlock.onDidAppendScrollbackLines(
      (e: AppendScrollbackLinesDetail) => {
        this.#onDidAppendScrollbackLinesEventEmitter.fire({ ...e, terminalBlock: terminalBlock });
      }
    );

    const spacerFrame = new SpacerFrame(this.#uiStyle);
    spacerFrame.setBlock(terminalBlock);
    return spacerFrame;
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

  #computeTerminalSize(): TerminalSize {
    if (this.#terminalVisualConfig == null) {
      return null;
    }

    const fontInfo = this.#terminalVisualConfig.fontInfo;
    const metrics = computeFontMetrics(fontInfo.family, fontInfo.style, this.#terminalVisualConfig.fontSizePx);
    const maxViewportSize = this.#scrollArea.maximumViewportSize();
    const currentMargins = this.#scrollArea.viewportMargins();

    const generalConfig = this.#configDatabase.getGeneralConfig();
    let spacing = 0;
    switch (generalConfig.terminalMarginStyle) {
      case "none":
        spacing = 0;
        break;
      case "thin":
        spacing = Math.round(generalConfig.terminalFontSize / 2);
        break;
      case "normal":
        spacing = generalConfig.terminalFontSize;
        break;
      case "thick":
        spacing = generalConfig.terminalFontSize * 2;
        break;
    }

    const maxViewportHeight = maxViewportSize.height() + currentMargins.top + currentMargins.bottom;
    const maxContentHeight = maxViewportHeight - spacing - spacing;

    const maxViewportWidth = maxViewportSize.width() + currentMargins.left + currentMargins.right;
    const maxContentWidth = maxViewportWidth - spacing - spacing - 2 * this.#uiStyle.getFrameMarginLeftRightPx();

    const columns = Math.floor(maxContentWidth / metrics.widthPx);
    const rows = Math.floor(maxContentHeight / metrics.heightPx);

    const vGap = maxContentHeight % metrics.heightPx;
    const topGap = Math.floor(vGap / 2);
    const bottomGap = vGap - topGap;

    const leftMargin = spacing;
    const topMargin = spacing + topGap;
    const rightMargin = spacing;
    const bottomMargin = spacing + bottomGap;

    return {
      rows,
      columns,
      leftMargin,
      topMargin,
      rightMargin,
      bottomMargin,
    };
  }

  resizeEmulatorFromTerminalSize(): void {
    const size = this.#computeTerminalSize();
    if (size == null) {
      return;
    }

    const { columns, rows, leftMargin, topMargin, rightMargin, bottomMargin } = size;
    this.#scrollArea.setViewportMargins(leftMargin, topMargin, rightMargin, bottomMargin);

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

  resetVT(): void {
    this.#emulator.reset();
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
    this.#verticalScrollBar.triggerAction(SliderAction.SliderToMaximum);
  }

  #handleKeyPress(event: QKeyEvent): void {
    const ev = qKeyEventToMinimalKeyboardEvent(event);

    const commands = this.#keybindingsIOManager.getCurrentKeybindingsMapping().mapEventToCommands(ev);
    const filteredCommands = this.#extensionManager.queryCommands({
      commands,
      when: true
    });
    if (filteredCommands.length !== 0) {
      return;
    }

    this.#emulator.keyDown(ev);
    event.accept();
    this.#contentWidget.setEventProcessed(true);

    if (event.text() !== "") {
      this.#scrollToBottom();
    }
  }

  #handleMouseButtonPress(mouseEvent: QMouseEvent): void {
    const key = this.#mapEventToMouseButtonActionKey(mouseEvent);
    if (key == null) {
      return;
    }

    const generalConfig = this.#configDatabase.getGeneralConfig();
    const action = <MouseButtonAction> generalConfig[key];

    switch (action) {
      case "context_menu":
        mouseEvent.accept();
        this.#onContextMenuEventEmitter.fire({ x: mouseEvent.globalX() , y: mouseEvent.globalY() });
        break;

      case "paste":
        mouseEvent.accept();
        const text = QApplication.clipboard().text();
        this.pasteText(text);
        break;

      case "paste_selection":
        mouseEvent.accept();
        const text2 = QApplication.clipboard().text(QClipboardMode.Selection);
        this.pasteText(text2);
        break;

      default:
        break;
    }
  }

  #mapEventToMouseButtonActionKey(ev: QMouseEvent): string {
    const button = ev.button();
    const isMiddleButton = button === MouseButton.MiddleButton;
    const isRightButton = button === MouseButton.RightButton;
    if ( ! isMiddleButton && ! isRightButton) {
      return null;
    }

    const modifiers = ev.modifiers();
    const buttonString = isMiddleButton ? "middle" : "right";
    const isControl = modifiers & KeyboardModifier.ControlModifier;
    const isShift = modifiers & KeyboardModifier.ShiftModifier;
    const modifierString = isControl ? "Control" : (isShift ? "Shift" : "");
    return `${buttonString}MouseButton${modifierString}Action`;
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
    this.#originalTerminalVisualConfig = terminalVisualConfig;
    this.#terminalVisualConfig = this.#computeEffectiveTerminalVisualConfig(terminalVisualConfig);
    this.#applyTerminalVisualConfig(this.#terminalVisualConfig);
  }

  #setFontSizeAdjustment(delta: number): void {
    const newAdjustment = Math.min(Math.max(this.#fontSizeAdjustment + delta, MINIMUM_FONT_SIZE), MAXIMUM_FONT_SIZE);
    if (newAdjustment !== this.#fontSizeAdjustment) {
      this.#fontSizeAdjustment = newAdjustment;
      this.#terminalVisualConfig = this.#computeEffectiveTerminalVisualConfig(this.#originalTerminalVisualConfig);
      this.#applyTerminalVisualConfig(this.#terminalVisualConfig);
    }
  }

  #resetFontSizeAdjustment(): void {
    if (this.#fontSizeAdjustment === 0) {
      return;
    }
    this.#fontSizeAdjustment = 0;
    this.#terminalVisualConfig = this.#computeEffectiveTerminalVisualConfig(this.#originalTerminalVisualConfig);
    this.#applyTerminalVisualConfig(this.#terminalVisualConfig);
  }

  #computeEffectiveTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): TerminalVisualConfig {
    const fontFactor = FONT_ADJUSTMENT_ARRAY[this.#fontSizeAdjustment-MINIMUM_FONT_SIZE];
    const fontSizePt = Math.round(terminalVisualConfig.fontSizePt * fontFactor);
    const fontSizePx = Math.round(terminalVisualConfig.fontSizePx * fontFactor);
    return {...terminalVisualConfig, fontSizePt, fontSizePx };
  }

  #applyTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): void {
    for (const blockFrame of this.#blockFrames) {
      const block = blockFrame.getBlock();
      if (block instanceof TerminalBlock) {
        block.setTerminalVisualConfig(terminalVisualConfig);
      }
    }

    const backgroundHex = new Color(terminalVisualConfig.palette[PALETTE_BG_INDEX]).toHexString();
    this.#contentWidget.setStyleSheet(`
    #content {
      background-color: ${backgroundHex};
    }
    `);
    this.#scrollArea.setStyleSheet(`
      QScrollArea {
        background-color: ${backgroundHex};
      }
    `);

    this.resizeEmulatorFromTerminalSize();
  }

  #handleHyperlinkHover(terminalBlock: TerminalBlock, url: string): void {
    this.#extensionManager.setActiveHyperlinkURL(url);
  }

  #handleHyperlinkClick(url: string): void {
    const options: CommandQueryOptions = {
      when: true,
      categories: ["hyperlink"]
    };
    const contextWindowState = this.#extensionManager.copyExtensionWindowState();
    contextWindowState.activeHyperlinkURL = url;
    const entries = this.#extensionManager.queryCommandsWithExtensionWindowState(options, contextWindowState);
    if (entries.length === 0) {
      return;
    }

    const commandName = entries[0].command;
    this.#extensionManager.executeCommandWithExtensionWindowState(contextWindowState, commandName);
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

  #appendBlockFrame(blockFrame: BlockFrame): void {
    this.#blockFrames.push(blockFrame);
    this.#contentLayout.insertWidget(this.#blockFrames.length-1, blockFrame.getWidget());
  }

  #closeLastTerminalFrame(): void {
    this.#emulator.moveRowsAboveCursorToScrollback();
    this.#emulator.flushRenderQueue();

    if (this.#blockFrames.length !== 0) {
      const lastBlockFrame = this.#blockFrames[this.#blockFrames.length-1];
      const lastTerminalBlock = lastBlockFrame.getBlock();
      if (lastTerminalBlock instanceof TerminalBlock) {
        lastTerminalBlock.setEmulator(null);
      }
    }
  }

  getTitle(): string {
    return "Terminal";
  }

  getIconName(): string {
    return null;
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
    emulator.onScreenChange(this.#handleScreenChange.bind(this));

    // Application mode handlers
    const applicationModeHandler: TermApi.ApplicationModeHandler = {
      start: this._handleApplicationModeStart.bind(this),
      data: this._handleApplicationModeData.bind(this),
      end: this._handleApplicationModeEnd.bind(this)
    };
    emulator.registerApplicationModeHandler(applicationModeHandler);
    emulator.onWriteBufferSize(this.#handleWriteBufferSize.bind(this));
    // if (this._terminalVisualConfig != null) {
    //   emulator.setCursorBlink(this._terminalVisualConfig.cursorBlink);
    // }
    this.#emulator = emulator;
    // this._initDownloadApplicationModeHandler();
  }

  #handleScreenChange(event: TermApi.ScreenChangeEvent): void {
    this.#onDidScreenChangeEventEmitter.fire({
      terminalBlock: <TerminalBlock> this.#blockFrames[0].getBlock(),
      startLine: event.refreshStartRow,
      endLine: event.refreshEndRow,
    });
  }

  #handleWriteBufferSize(event: TermApi.WriteBufferSizeEvent): void {
    if (this.#pty != null) {
      this.#pty.permittedDataSize(event.status.bufferSize);
    }
  }

  #handleTermData(event: TermApi.DataEvent): void {
    this.sendToPty(event.data);
  }

  scrollPageDown(): void {
    this.#verticalScrollBar.triggerAction(SliderAction.SliderPageStepAdd);
  }

  scrollPageUp(): void {
    this.#verticalScrollBar.triggerAction(SliderAction.SliderPageStepSub);
  }

  getSelectionText(): string {
    let text: string = null;
    for (const block of this.#blockFrames) {
      if (block instanceof TerminalBlock) {
        text = block.getSelectionText();
        if (text != null) {
          return text;
        }
      }
    }
    return null;
  }

  pasteText(text: string): void {
    if (this.#pty != null) {
      this.#pty.write(text);
    }
  }

  commandCopyToClipboard(): void {
    const terminal = this.#extensionManager.getActiveTerminal();
    if (terminal == null) {
      return;
    }
    const text = terminal.getSelectionText();
    if (text == null || text === "") {
      return;
    }
    const clipboard = QApplication.clipboard();
    clipboard.setText(text);
  }

  commandPasteFromClipboard(): void {
    const terminal = this.#extensionManager.getActiveTerminal();
    if (terminal == null) {
      return;
    }
    const clipboard = QApplication.clipboard();
    const text = clipboard.text();
    terminal.pasteText(text);
  }

  commandResetVT(): void {
    const terminal = this.#extensionManager.getActiveTerminal();
    if (terminal == null) {
      return;
    }
    terminal.resetVT();
  }

  commandFontSizeIncrease(): void {
    this.#setFontSizeAdjustment(1);
  }

  commandFontSizeDecrease(): void {
    this.#setFontSizeAdjustment(-1);
  }

  commandFontSizeReset(): void {
    this.#resetFontSizeAdjustment();
  }
  /**
   * Handle when the embedded term.js enters start of application mode.
   *
   * @param {array} params The list of parameter which were specified in the
   *     escape sequence.
   */
  private _handleApplicationModeStart(params: string[]): TermApi.ApplicationModeResponse {
    if (DEBUG_APPLICATION_MODE) {
      this._log.debug("application-mode started! ",params);
    }

    this._htmlData = "";

    // Check security cookie
    if (params.length === 0) {
      this._log.warn("Received an application mode sequence with no parameters.");
      return {action: TermApi.ApplicationModeResponseAction.ABORT};
    }

    if (params[0] !== this.#cookie) {
      this._log.warn("Received the wrong cookie at the start of an application mode sequence.");
      return {action: TermApi.ApplicationModeResponseAction.ABORT};
    }

    if (params.length === 1) {
      // Normal HTML mode.
      this._applicationMode = ApplicationMode.APPLICATION_MODE_HTML;

    } else if(params.length >= 2) {
      switch ("" + params[1]) {
        case "" + ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
          this._applicationMode = ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START;
          this._bracketStyle = params[2];
          break;

        case "" + ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
          this._applicationMode = ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END;
          if (DEBUG_APPLICATION_MODE) {
            this._log.debug("Starting APPLICATION_MODE_OUTPUT_BRACKET_END");
          }
          break;

        case "" + ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
          this._applicationMode = ApplicationMode.APPLICATION_MODE_REQUEST_FRAME;
          if (DEBUG_APPLICATION_MODE) {
            this._log.debug("Starting APPLICATION_MODE_REQUEST_FRAME");
          }
          break;

        // case "" + ApplicationMode.APPLICATION_MODE_SHOW_FILE:
        //   if (DEBUG_APPLICATION_MODE) {
        //     this._log.debug("Starting APPLICATION_MODE_SHOW_FILE");
        //   }
        //   this._applicationMode = ApplicationMode.APPLICATION_MODE_SHOW_FILE;
        //   return this._downloadHandler.handleStart(params.slice(2));

        default:
          this._log.warn("Unrecognized application escape parameters.");
          break;
      }
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  /**
   * Handle incoming data while in application mode.
   *
   * @param {string} data The new data.
   */
  private _handleApplicationModeData(data: string): TermApi.ApplicationModeResponse {
    if (DEBUG_APPLICATION_MODE) {
      this._log.debug("html-mode data!", data);
    }
    switch (this._applicationMode) {
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
      case ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
        this._htmlData = this._htmlData + data;
        break;

      // case ApplicationMode.APPLICATION_MODE_SHOW_FILE:
      //   return this._downloadHandler.handleData(data);

      default:
        break;
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  /**
   * Handle the exit from application mode.
   */
  private _handleApplicationModeEnd(): TermApi.ApplicationModeResponse {
    switch (this._applicationMode) {
      case ApplicationMode.APPLICATION_MODE_HTML:
        // el = this._getWindow().document.createElement("div");
        // el.innerHTML = this._htmlData;
        // this._appendElementToScrollArea(el);
        break;

      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
        this._handleApplicationModeBracketStart();
        break;

      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
        this._handleApplicationModeBracketEnd();
        break;

      case ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
        this.handleRequestFrame(this._htmlData);
        break;

      // case ApplicationMode.APPLICATION_MODE_SHOW_FILE:
      //   return this._downloadHandler.handleStop();

      default:
        break;
    }
    this._applicationMode = ApplicationMode.APPLICATION_MODE_NONE;

    if (DEBUG_APPLICATION_MODE) {
      this._log.debug("html-mode end!",this._htmlData);
    }
    this._htmlData = null;

    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  private _handleApplicationModeBracketStart(): void {
    // for (const element of this._terminalCanvas.getViewerElements()) {
    //   if ((EmbeddedViewer.is(element) && element.children.length === 0) || CommandPlaceHolder.is(element)) {
    //     return;  // Don't open a new frame.
    //   }
    // }

    // Fetch the command line.
    let cleanCommandLine = this._htmlData;
    if (this._bracketStyle === "bash") {
      // Bash includes the history number. Remove it.
      const trimmed = this._htmlData.trim();
      cleanCommandLine = trimmed.slice(trimmed.indexOf(" ")).trim();
    }

    if (this._commandNeedsFrame(cleanCommandLine)) {
      // Create and set up a new command-frame.
      // const el = this._createEmbeddedViewerElement();
      // const el = new DecoratedFrame(null);

      // this._appendViewerElement(el);

      this.#closeLastTerminalFrame();
      const decoratedFrame = new DecoratedFrame(this.#uiStyle);
      const defaultMetadata: ViewerMetadata = {
        title: cleanCommandLine,
        posture: ViewerPosture.RUNNING,
        icon: "fa-cog",
        moveable: false,
        deleteable: false,
        toolTip: null
      };
      decoratedFrame.setDefaultMetadata(defaultMetadata);
      this.#appendBlockFrame(decoratedFrame);

      this.#appendBlockFrame(this.#createTerminalBlock());
    } else {

      this._moveCursorToFreshLine();
      this.#emulator.moveRowsAboveCursorToScrollback();
      this.#emulator.flushRenderQueue();
this._log.debug(`_handleApplicationModeBracketStart() other frame branch`);

      // this._lastCommandTerminalLine = this._terminalViewer.bookmarkCursorLine();
      // this._lastCommandTerminalViewer = this._terminalViewer;
    }
    this._lastCommandLine = cleanCommandLine;

    const command = cleanCommandLine.split(" ")[0];

    this.environment.setList([
      { key: TerminalEnvironment.EXTRATERM_CURRENT_COMMAND_LINE, value: cleanCommandLine },
      { key: TerminalEnvironment.EXTRATERM_CURRENT_COMMAND, value: command },
      { key: TerminalEnvironment.EXTRATERM_EXIT_CODE, value: "" },
    ]);
  }

  private _moveCursorToFreshLine(): void {
    const dims = this.#emulator.getDimensions();
    if (dims.cursorX !== 0 && this.#emulator.getLineText(dims.cursorY).trim() !== "") {
      this.#emulator.newLine();
      this.#emulator.carriageReturn();
    }
  }

  private _commandNeedsFrame(commandLine: string, linesOfOutput=-1): boolean {
    if (commandLine.trim() === "" || this.#configDatabase === null) {
      return false;
    }

    const commandLineActions = this.#configDatabase.getCommandLineActionConfig() || [];
    for (const cla of commandLineActions) {
      if (this._commandLineActionMatches(commandLine, cla)) {
        switch (cla.frameRule) {
          case "always_frame":
            return true;
          case "never_frame":
            return false;
          case "frame_if_lines":
            return linesOfOutput !== -1 && linesOfOutput > cla.frameRuleLines;
        }
      }
    }

    const generalConfig = this.#configDatabase.getGeneralConfig();
    switch (generalConfig.frameRule) {
      case "always_frame":
        return true;
      case "never_frame":
        return false;
      case "frame_if_lines":
        return linesOfOutput !== -1 && linesOfOutput > generalConfig.frameRuleLines;
    }
  }

  private _commandLineActionMatches(command: string, cla: DeepReadonly<CommandLineAction>): boolean {
    const cleanCommandLine = command.trim();
    const commandParts = command.trim().split(/\s+/);

    if (cla.matchType === "name") {
      const matcherParts = cla.match.split(/\s+/);
      for (let i=0; i < matcherParts.length; i++) {
        if (i >= commandParts.length) {
          return false;
        }
        if (matcherParts[i] !== commandParts[i]) {
          return false;
        }
      }
      return true;
    } else {
      // regexp
      return (new RegExp(cla.match)).test(cleanCommandLine);
    }
  }

  private _handleApplicationModeBracketEnd(): void {
    // this._terminalCanvas.enforceScrollbackLengthAfter( () => {
    const returnCode = this._htmlData;
    this.#closeLastEmbeddedViewer(returnCode);

    const lastCommandLine = this.environment.get(TerminalEnvironment.EXTRATERM_CURRENT_COMMAND_LINE);
    const lastCommand = this.environment.get(TerminalEnvironment.EXTRATERM_CURRENT_COMMAND);
    const newVars = [
      { key: TerminalEnvironment.EXTRATERM_EXIT_CODE, value: "" },
      { key: TerminalEnvironment.EXTRATERM_CURRENT_COMMAND_LINE, value: "" },
      { key: TerminalEnvironment.EXTRATERM_CURRENT_COMMAND, value: "" },
    ];
    if (lastCommand != null) {
      newVars.push( { key: TerminalEnvironment.EXTRATERM_LAST_COMMAND_LINE, value: lastCommandLine });
      newVars.push( { key: TerminalEnvironment.EXTRATERM_LAST_COMMAND, value: lastCommand });
    }
    this.environment.setList(newVars);
    // });
  }

  #closeLastEmbeddedViewer(returnCode: string): void {
    const startFrame = this.#findEmptyDecoratedFrame();
    if (startFrame != null) {
      this.#frameWithExistingDecoratedFrame(startFrame, returnCode);
    } else {
      // this.#frameWithoutDecoratedFrame(returnCode);
    }
  }

  #findEmptyDecoratedFrame(): DecoratedFrame {
    const len = this.#blockFrames.length;
    for (let i=len-1; i !==0; i--) {
      const frame = this.#blockFrames[i];
      if (frame instanceof DecoratedFrame && frame.getBlock() == null) {
        return frame;
      }
    }
    return null;
  }

  #findLastTerminalBlockFrame(): SpacerFrame {
    const len = this.#blockFrames.length;
    for (let i=len-1; i !==0; i--) {
      const frame = this.#blockFrames[i];
      if (frame instanceof SpacerFrame) {
        const block = frame.getBlock();
        if (block instanceof TerminalBlock) {
          return frame;
        }
      }
    }
    return null;
  }

  #frameWithExistingDecoratedFrame(decoratedFrame: DecoratedFrame, returnCode: string): void {
    const terminalBlockFrame = this.#findLastTerminalBlockFrame();
    const terminalBlock = <TerminalBlock> terminalBlockFrame.getBlock();

    this.#closeLastTerminalFrame();

    this.#contentLayout.removeWidget(terminalBlockFrame.getWidget());
    terminalBlockFrame.getWidget().setParent(null);
    terminalBlockFrame.setBlock(null);

    const index = this.#blockFrames.indexOf(terminalBlockFrame);
    this.#blockFrames.splice(index, 1);

    terminalBlock.setCommandLine(this._lastCommandLine);
    terminalBlock.setReturnCode(returnCode);
    decoratedFrame.setBlock(terminalBlock);

    this.#appendBlockFrame(this.#createTerminalBlock());
  }
/*
  #frameWithoutDecoratedFrame(returnCode: string): void {
    const terminalBlock = this.#findLastTerminalBlock();

    this._moveCursorToFreshLine();

    const candidateMoveTextLines = this._lastCommandTerminalViewer.getTerminalLinesBetweenBookmarks(
      this._lastCommandTerminalLine, this._terminalViewer.bookmarkCursorLine());
    const commandShouldBeFramed = returnCode !== "0" || this._commandNeedsFrame(this._lastCommandLine, candidateMoveTextLines.length);
    if ( ! commandShouldBeFramed) {
      this._lastCommandLine = null;
      this._lastCommandTerminalViewer = null;
      return;
    }

    const viewerWithOutput = this._lastCommandTerminalViewer;

    // Close off the current terminal viewer.
    this._disconnectActiveTerminalViewer();

    const moveTextLines = viewerWithOutput.getTerminalLinesToEnd(this._lastCommandTerminalLine);
    if (candidateMoveTextLines != null && candidateMoveTextLines.length > 0) {
      viewerWithOutput.deleteLines(this._lastCommandTerminalLine);
    }
    this._lastCommandTerminalViewer = null;

    const newEmbeddedViewer = this._createEmbeddedViewerElement();
    newEmbeddedViewer.className = "extraterm_output";
    this._terminalCanvas.appendViewerElement(newEmbeddedViewer);

    // Create a terminal viewer to display the output of the last command.
    const outputTerminalViewer = this._createTerminalViewer();
    newEmbeddedViewer.setViewerElement(outputTerminalViewer);
    outputTerminalViewer.setReturnCode(returnCode);
    outputTerminalViewer.setCommandLine(this._lastCommandLine);
    outputTerminalViewer.setUseVPad(false);
    if (candidateMoveTextLines !== null && candidateMoveTextLines.length > 0) {
      outputTerminalViewer.setTerminalLines(moveTextLines);
    }
    outputTerminalViewer.setEditable(true);
    this._emitDidAppendViewer(newEmbeddedViewer);

    this._appendNewTerminalViewer();
    this._refocus();

    const activeTerminalViewer = this._terminalViewer;
    this._terminalCanvas.updateSize(activeTerminalViewer);
  }
*/
  private handleRequestFrame(frameId: string): void {
    /*
    if (this._frameFinder === null) {
      return;
    }

    const bulkFileHandle = this._frameFinder(frameId);
    if (bulkFileHandle === null) {
      this.sendToPty("#error\n");
      return;
    }

    const uploader = new BulkFileUploader(bulkFileHandle, this._pty);
    const uploadProgressBar = <UploadProgressBar> document.createElement(UploadProgressBar.TAG_NAME);

    if ("filename" in bulkFileHandle.metadata) {
      uploadProgressBar.filename = <string> bulkFileHandle.metadata["filename"];
    }

    uploadProgressBar.total = bulkFileHandle.totalSize;
    uploader.onUploadedChange(uploaded => {
      uploadProgressBar.transferred = uploaded;
    });

    const inputFilterRegistration = this._registerInputStreamFilter((input: string): string => {
      const ctrlCIndex = input.indexOf("\x03");
      if (ctrlCIndex !== -1) {
        // Abort the upload.
        uploader.abort();
        inputFilterRegistration.dispose();
        return input.substr(ctrlCIndex + 1);
      } else {
        return "";
      }
    });

    uploader.onFinished(() => {
      this._containerElement.removeChild(uploadProgressBar);
      inputFilterRegistration.dispose();
      doLater(() => {
        uploader.dispose();
      });
    });

    uploadProgressBar.hide();
    this._containerElement.appendChild(uploadProgressBar);
    uploadProgressBar.show(200);  // Show after delay

    uploader.upload();
    */
  }

}
