/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from "node:crypto";
import * as TermApi from "term-api";
import { getLogger, log, Logger } from "extraterm-logging";
import { computeFontMetrics } from "extraterm-char-render-canvas";
import { Color } from "extraterm-color-utilities";
import { EventEmitter } from "extraterm-event-emitter";
import { DeepReadonly } from "extraterm-readonly-toolbox";
import { DebouncedDoLater, doLater } from "extraterm-timeoutqt";
import { BoxLayout, repolish, ScrollBar, Widget } from "qt-construct";
import {
  Disposable,
  Event,
  SessionConfiguration,
  TerminalEnvironment,
  BlockMetadata,
  BlockPosture,
} from "@extraterm/extraterm-extension-api";
import {
  Direction,
  InputMethodHint,
  InputMethodQuery,
  KeyboardModifier,
  MouseButton,
  QApplication,
  QBoxLayout,
  QClipboardMode,
  QDragEnterEvent,
  QDropEvent,
  QInputMethodEvent,
  QInputMethodQueryEvent,
  QKeyEvent,
  QLabel,
  QMouseEvent,
  QPoint,
  QRect,
  QScrollBar,
  QSizePolicyPolicy,
  QWidget,
  WidgetAttribute,
  WidgetEventTypes
} from "@nodegui/nodegui";
import { performance } from "node:perf_hooks";

import * as Term from "../emulator/Term.js";
import * as TextTerm from "../emulator/TextTerm.js";
import { Tab } from "../Tab.js";
import { AppendScrollbackLinesDetail, TerminalBlock } from "./TerminalBlock.js";
import { Pty } from "../pty/Pty.js";
import { TerminalEnvironmentImpl } from "./TerminalEnvironmentImpl.js";
import { PALETTE_BG_INDEX, TerminalVisualConfig } from "./TerminalVisualConfig.js";
import { qKeyEventToMinimalKeyboardEvent } from "../keybindings/QKeyEventUtilities.js";
import { KeybindingsIOManager } from "../keybindings/KeybindingsIOManager.js";
import { ExtensionManager } from "../extension/ExtensionManager.js";
import { ConfigDatabase } from "../config/ConfigDatabase.js";
import { CommandLineAction, MouseButtonAction } from "../config/Config.js";
import { CommandQueryOptions } from "../InternalTypes.js";
import { BlockFrame } from "./BlockFrame.js";
import { DecoratedFrame } from "./DecoratedFrame.js";
import { SpacerFrame } from "./SpacerFrame.js";
import { UiStyle } from "../ui/UiStyle.js";
import { BorderDirection } from "../extension/ExtensionMetadata.js";
import { QtTimeout } from "../utils/QtTimeout.js";
import { FontAtlasCache } from "./FontAtlasCache.js";
import { TerminalScrollArea, ViewportChange } from "../ui/TerminalScrollArea.js";
import { ContextMenuEvent } from "../ContextMenuEvent.js";
import { DisposableHolder } from "../utils/DisposableUtils.js";
import { FrameFinder } from "./FrameFinderType.js";
import { BulkFileUploader } from "../bulk_file_handling/BulkFileUploader.js";
import { UploadProgressBar } from "../ui/UploadProgressBar.js";
import { DownloadApplicationModeHandler } from "./DownloadApplicationModeHandler.js";
import { BulkFileStorage } from "../bulk_file_handling/BulkFileStorage.js";
import { BulkFile } from "../bulk_file_handling/BulkFile.js";
import * as BulkFileUtils from "../bulk_file_handling/BulkFileUtils.js";
import { Block } from "./Block.js";
import { QEvent } from "@nodegui/nodegui/dist/lib/QtGui/QEvent/QEvent.js";
import { CommonExtensionWindowState } from "../extension/CommonExtensionState.js";
import { TerminalEmbeddedImages } from "./TerminalEmbeddedImages.js";

export const EXTRATERM_COOKIE_ENV = "LC_EXTRATERM_COOKIE";

interface TerminalSize {
  rows: number;
  columns: number;
  leftMargin: number;
  topMargin: number;
  rightMargin: number;
  bottomMargin: number;
  cellHeightPx: number;
  cellWidthPx: number;
}

export interface LineRangeChange {
  terminalBlock: TerminalBlock;
  blockFrame: BlockFrame;
  startLine: number;
  endLine: number;
}

interface BlockPlumbing {
  frame: BlockFrame;
  disposableHolder: DisposableHolder;
}

const MINIMUM_FONT_SIZE = -3;
const MAXIMUM_FONT_SIZE = 4;
const FONT_ADJUSTMENT_ARRAY = [0.6, 0.75, 0.89, 1, 1.2, 1.5, 2, 3];

const DEBUG_APPLICATION_MODE = false;

const enum ApplicationMode {
  APPLICATION_MODE_NONE = 0,
  APPLICATION_MODE_OUTPUT_BRACKET_START = 2,
  APPLICATION_MODE_OUTPUT_BRACKET_END = 3,
  APPLICATION_MODE_REQUEST_FRAME = 4,
  APPLICATION_MODE_SHOW_FILE = 5,
}

type InputStreamFilter = (input: string) => string;


export interface RowLayers {
  layers: Map<string, TermApi.Line>;
}

/**
 * Controls the state machine for terminal blocks and framing command output.
 */
enum BlockState {
  START,          // Initial state: no terminal blocks/frames at all.
  PLAIN,          // Scrollback may contain different frames. There is a terminal block receiving output,
                  // but there is no frame open and waiting for output to finish.
  FRAME_OPEN,     // Scrollback may contain different frames. There is a "decorated frame" in the "running"
                  // state and a terminal block receiving output.
  BOOKMARK_OPEN   // Scrollback may contain different frames. The row of the start of the output has been
                  // bookmarked / recorded in the last terminal block, but there is no open "decorated frame".
                  // If the output stops and a frame is needed, then the frame will be made and the output rows
                  // moved into this frame.
}

interface TerminalPositionBookmark {
  isLive: boolean;
  row: number;
  column: number;
}


export class Terminal implements Tab, Disposable {
  private _log: Logger = null;

  #uiStyle: UiStyle = null;
  #configDatabase: ConfigDatabase = null;
  #keybindingsIOManager: KeybindingsIOManager = null;
  #extensionManager: ExtensionManager = null;
  #fontAtlasCache: FontAtlasCache = null;
  #applicationVersion: string = null;
  #parent: any = null;

  #blockState = BlockState.START;

  #nextTag: () => number = null;
  #frameFinder: FrameFinder = null;
  #uploadProgressBar: UploadProgressBar = null;

  #pty: Pty = null;
  #inputStreamFilters: InputStreamFilter[] = [];
  #emulator: Term.Emulator = null;
  #cookie: string = null;

  #qtTimeout: QtTimeout = null;

  // The current size of the emulator. This is used to detect changes in size.
  #columns = -1;
  #rows = -1;

  #windowTitle = "Extraterm Qt";
  #onWindowTitleChangedEventEmitter = new EventEmitter<string>();
  onWindowTitleChanged: Event<string> = null;

  #topContents: QWidget = null;
  scrollArea: TerminalScrollArea = null;
  #contentAreaWidget: QWidget = null;
  #resizeGuard = false;

  #contentWidget: QWidget = null;
  #borderWidgetLayout: {north: QBoxLayout, south: QBoxLayout, east: QBoxLayout, west: QBoxLayout} = {
    north: null,
    south: null,
    east: null,
    west: null
  };
  #tabTitleWidget: QWidget = null;
  #tabTitleLabelWidgets: QLabel[] = null;

  #verticalScrollBar: QScrollBar = null;
  #blockFrames: BlockPlumbing[] = [];
  #disposableHolder = new DisposableHolder();

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

  #enforceScrollbackSizeLater: DebouncedDoLater = null;

  #onPopOutClickedEventEmitter = new EventEmitter<{frame: DecoratedFrame, terminal: Terminal}>();
  onPopOutClicked: Event<{frame: DecoratedFrame, terminal: Terminal}> = null;

  #applicationModeData: string = null;
  #downloadHandler: DownloadApplicationModeHandler = null;
  #applicationMode: ApplicationMode = ApplicationMode.APPLICATION_MODE_NONE;
  #bulkFileStorage: BulkFileStorage = null;

  #bracketStyle: string = null;

  #allTerminalBookmarks: TerminalPositionBookmark[] = [];

  // The command line string of the last command started.
  #lastCommandLine: string = null;
  #frameStartBookmark: TerminalPositionBookmark = { isLive: false, row: 0, column: 0 };
  #latestTerminalFrame: SpacerFrame = null;
  #openDecoratedFrame: DecoratedFrame = null;

  #promptEndBookmark: TerminalPositionBookmark = { isLive: false, row: 0, column: 0 };

  environment = new TerminalEnvironmentImpl([
    { key: TerminalEnvironment.TERM_ROWS, value: "" },
    { key: TerminalEnvironment.TERM_COLUMNS, value: "" },
    { key: TerminalEnvironment.EXTRATERM_CURRENT_COMMAND_LINE, value: "" },
    { key: TerminalEnvironment.EXTRATERM_CURRENT_COMMAND, value: "" },
    { key: TerminalEnvironment.EXTRATERM_EXIT_CODE, value: "" },
    { key: TerminalEnvironment.EXTRATERM_LAST_COMMAND_LINE, value: "" },
    { key: TerminalEnvironment.EXTRATERM_LAST_COMMAND, value: "" },
    { key: TerminalEnvironment.EXTRATERM_TERMINAL_HEIGHT_PIXELS, value: "" },
    { key: TerminalEnvironment.EXTRATERM_TERMINAL_WIDTH_PIXELS, value: "" },
  ]);

  static registerCommands(extensionManager: ExtensionManager): void {
    const commands = extensionManager.getExtensionContextByName("internal-commands").commands;
    commands.registerCommand("extraterm:terminal.deleteLastFrame",
      async (state: CommonExtensionWindowState) => state.activeTerminal.commandDeleteLastFrame());
    commands.registerCommand("extraterm:terminal.scrollPageDown",
      async (state: CommonExtensionWindowState) => state.activeTerminal.scrollPageDown());
    commands.registerCommand("extraterm:terminal.scrollPageUp",
      async (state: CommonExtensionWindowState) => state.activeTerminal.scrollPageUp());
    commands.registerCommand("extraterm:terminal.pasteFromClipboard",
      async (state: CommonExtensionWindowState) => state.activeTerminal.commandPasteFromClipboard());
    commands.registerCommand("extraterm:terminal.copyToClipboard",
      async (state: CommonExtensionWindowState) => state.activeTerminal.commandCopyToClipboard());
    commands.registerCommand("extraterm:terminal.goToNextFrame",
      async (state: CommonExtensionWindowState) => state.activeTerminal.commandGoToNextFrame());
    commands.registerCommand("extraterm:terminal.goToPreviousFrame",
      async (state: CommonExtensionWindowState) => state.activeTerminal.commandGoToPreviousFrame());
    commands.registerCommand("extraterm:terminal.resetVT",
      async (state: CommonExtensionWindowState) => state.activeTerminal.commandResetVT());
    commands.registerCommand("extraterm:terminal.clearScrollback",
      async (state: CommonExtensionWindowState) => state.activeTerminal.commandClearScrollback());
    commands.registerCommand("extraterm:terminal.increaseFontSize",
      async (state: CommonExtensionWindowState, args: any) => state.activeTerminal.commandFontSizeIncrease());
    commands.registerCommand("extraterm:terminal.decreaseFontSize",
      async (state: CommonExtensionWindowState, args: any) => state.activeTerminal.commandFontSizeDecrease());
    commands.registerCommand("extraterm:terminal.resetFontSize",
      async (state: CommonExtensionWindowState, args: any) => state.activeTerminal.commandFontSizeReset());
  }

  constructor(configDatabase: ConfigDatabase, uiStyle: UiStyle, extensionManager: ExtensionManager,
      keybindingsIOManager: KeybindingsIOManager, fontAtlasCache: FontAtlasCache, nextTag: () => number,
      frameFinder: FrameFinder, bulkFileStorage: BulkFileStorage, applicationVersion: string) {

    this._log = getLogger("Terminal", this);

    this.#allTerminalBookmarks.push(this.#frameStartBookmark);
    this.#allTerminalBookmarks.push(this.#promptEndBookmark);

    this.onContextMenu = this.#onContextMenuEventEmitter.event;
    this.onDidAppendScrollbackLines = this.#onDidAppendScrollbackLinesEventEmitter.event;
    this.onDidScreenChange = this.#onDidScreenChangeEventEmitter.event;
    this.onPopOutClicked = this.#onPopOutClickedEventEmitter.event;
    this.onSelectionChanged = this.#onSelectionChangedEventEmitter.event;
    this.onWindowTitleChanged = this.#onWindowTitleChangedEventEmitter.event;

    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#keybindingsIOManager = keybindingsIOManager;
    this.#uiStyle = uiStyle;
    this.#qtTimeout = new QtTimeout();
    this.#fontAtlasCache = fontAtlasCache;
    this.#nextTag = nextTag;
    this.#frameFinder = frameFinder;
    this.#bulkFileStorage = bulkFileStorage;
    this.#applicationVersion = applicationVersion;

    this.onDispose = this.#onDisposeEventEmitter.event;
    this.#cookie = crypto.randomBytes(10).toString("hex");
    this.#initEmulator(this.#cookie);
    this.#createUi();

    doLater(() => {
      this.resizeTerminalArea();
    });
  }

  #createUi() : void {
    this.scrollArea = new TerminalScrollArea({
      objectName: "content",
      onInputMethod: (nativeEvent) => {
        this.#handleInputMethod(new QInputMethodEvent(nativeEvent));
      },
      onInputMethodQuery: (nativeEvent) => {
        this.#handleInputMethodQuery(new QInputMethodQueryEvent(nativeEvent));
      },
      onKeyPress: (nativeEvent) => {
        this.#handleKeyPress(new QKeyEvent(nativeEvent));
      },
      onMouseButtonPress: (nativeEvent) => {
        this.#handleMouseButtonPress(new QMouseEvent(nativeEvent));
      },
      onFocusOut: () => {
        this.#emulator.blur();
      },
      onFocusIn: () => {
        this.#emulator.focus();
      }

    });
    this.scrollArea.getContentWidget().setAttribute(WidgetAttribute.WA_InputMethodEnabled, true);

    const scrollAreaWidget = this.scrollArea.getWidget();
    scrollAreaWidget.addEventListener(WidgetEventTypes.Resize, () => {
      this.#handleResize();
    });
    scrollAreaWidget.addEventListener(WidgetEventTypes.MouseButtonPress, (nativeEvent) => {
      this.#handleMouseButtonPressBelowFrames(new QMouseEvent(nativeEvent));
    });

    this.#installDragDropHanlders(scrollAreaWidget);

    this.#contentWidget = this.scrollArea.getContentWidget();

    this.#topContents = Widget({
      contentsMargins: 0,
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        contentsMargins: 0,
        spacing: 0,

        children: [
          Widget({
            objectName: "border.west",
            contentsMargins: 0,
            layout: this.#borderWidgetLayout.west = BoxLayout({
              direction: Direction.LeftToRight,
              contentsMargins: 0,
              spacing: 0,
              children: []
            })
          }),

          // Middle vertical stack of north-border, main contents, south-border
          {
            layout: BoxLayout({
              direction: Direction.TopToBottom,
              contentsMargins: 0,
              spacing: 0,
              children: [
                Widget({
                  objectName: "border.north",
                  contentsMargins: 0,
                  layout: this.#borderWidgetLayout.north = BoxLayout({
                    direction: Direction.TopToBottom,
                    contentsMargins: 0,
                    spacing: 1,
                    children: []
                  })
                }),
                this.#contentAreaWidget = Widget({
                  objectName: "content-area",
                  contentsMargins: 0,
                  layout: BoxLayout({
                    direction: Direction.LeftToRight,
                    contentsMargins: 0,
                    spacing: 0,
                    children: [
                      this.scrollArea.getWidget(),
                      this.#verticalScrollBar = ScrollBar({
                        maximum: 0,
                        value: 0,
                      })
                    ]
                  }),
                  onLayoutRequest: this.#handleContentAreaWidgetLayoutRequest.bind(this)
                }),
                Widget({
                  objectName: "border.south",
                  contentsMargins: 0,
                  layout: this.#borderWidgetLayout.south = BoxLayout({
                    direction: Direction.TopToBottom,
                    contentsMargins: 0,
                    spacing: 0,
                    children: []
                  })
                }),
              ]
            })
          },

          Widget({
            objectName: "border.east",
            contentsMargins: 0,
            layout: this.#borderWidgetLayout.east = BoxLayout({
              direction: Direction.LeftToRight,
              contentsMargins: 0,
              spacing: 0,
              children: []
            })
          })
        ]
      })
    });

    this.scrollArea.onViewportChanged((viewportChange: ViewportChange) => {
      if (viewportChange.range !== undefined) {
        this.#verticalScrollBar.setMaximum(viewportChange.range);
      }
      if (viewportChange.pageSize !== undefined) {
        this.#verticalScrollBar.setPageStep(viewportChange.pageSize);
      }
      if (viewportChange.position !== undefined) {
        this.#verticalScrollBar.setValue(viewportChange.position);
      }
    });

    this.#verticalScrollBar.addEventListener("valueChanged", (value: number) => {
      this.scrollArea.setScrollPosition(value);
    });

  }

  #installDragDropHanlders(widget: QWidget): void {
    widget.setAcceptDrops(true);
    widget.addEventListener(WidgetEventTypes.Drop, (native) => {
      const ev = new QDropEvent(native);
      const mimeData = ev.mimeData();
      if (mimeData.hasUrls()) {
        const formattedUrls: string[] = [];
        for (const url of mimeData.urls()) {
          let urlString = url.toString();
          if (urlString.startsWith("file://")) {
            urlString = urlString.slice(7);
          }
          formattedUrls.push(urlString);
        }
        this.pasteText(formattedUrls.join(" "));
      }
    });
    widget.addEventListener(WidgetEventTypes.DragEnter, (native) => {
      const ev = new QDragEnterEvent(native);
      const mimeData = ev.mimeData();
      if (mimeData.hasUrls()) {
        ev.accept();
      }
    });
  }

  start(): void {
    this.#appendNewTerminalBlock();
    this.#enterBlockStatePlain();
  }

  #createTabTitleWidget(): void {
    this.#tabTitleLabelWidgets = this.#extensionManager.createTabTitleWidgets(this);
    this.#tabTitleWidget = Widget({
      cssClass: ["tab-title"],
      contentsMargins: [8, 0, 0, 0],
      sizePolicy: {
        horizontal: QSizePolicyPolicy.Expanding,
        vertical: QSizePolicyPolicy.Fixed,
      },
      layout: BoxLayout({
        contentsMargins: 0,
        spacing: 0,
        direction: Direction.LeftToRight,
        children: this.#tabTitleLabelWidgets
      })
    });
  }

  #createTerminalBlock(frame: BlockFrame, emulator: Term.Emulator): TerminalBlock {
    const terminalBlock = new TerminalBlock(this.#fontAtlasCache);
    if (emulator != null) {
      terminalBlock.setEmulator(emulator);
    }
    if (this.#terminalVisualConfig != null) {
      terminalBlock.setTerminalVisualConfig(this.#terminalVisualConfig);
    }

    terminalBlock.onSelectionChanged(() => {
      this.#handleSelectionChanged(terminalBlock);
    });
    terminalBlock.onHyperlinkClicked((url: string): void => {
      this.#handleHyperlinkClick(url);
    });
    terminalBlock.onHyperlinkHover((url: string): void => {
      this.#handleHyperlinkHover(terminalBlock, url);
    });

    this.#blockDidAppendScrollbackLinesDisposable = terminalBlock.onDidAppendScrollbackLines(
      (e: AppendScrollbackLinesDetail) => {
        this.#onDidAppendScrollbackLinesEventEmitter.fire({
          ...e,
          blockFrame: frame,
          terminalBlock
        });
        const config = this.#configDatabase.getGeneralConfig();
        this.#enforceScrollbackLinesSize(config.scrollbackMaxLines);
      }
    );
    return terminalBlock;
  }

  #handleSelectionChanged(terminalBlock: TerminalBlock): void {
    for (const blockFrame of this.#blockFrames) {
      const block = blockFrame.frame.getBlock();
      if (block instanceof TerminalBlock && block !== terminalBlock) {
        block.clearSelection();
      }
    }
    this.#onSelectionChangedEventEmitter.fire();
  }

  #createSpacerFramedTerminalBlock(): SpacerFrame {
    const spacerFrame = new SpacerFrame(this.#uiStyle);
    const terminalBlock = this.#createTerminalBlock(spacerFrame, this.#emulator);
    spacerFrame.setBlock(terminalBlock);
    return spacerFrame;
  }

  #handleResize(): void {
    this.resizeTerminalArea();
    this.#updateViewportTopOnFrames();
  }

  setParent(parent: any): void {
    this.#parent = parent;
  }

  getParent(): any {
    return this.#parent;
  }

  setIsCurrent(isCurrent: boolean): void {
    if (this.#tabTitleLabelWidgets != null) {
      for (const labelWidget of this.#tabTitleLabelWidgets) {
        labelWidget.setProperty("cssClass", isCurrent ? ["tab-title", "tab-title-selected"] : ["tab-title"]);
        repolish(labelWidget);
      }
    }
  }

  focus(): void {
    this.#contentWidget.setFocus();
  }

  unfocus(): void {
    this.#contentWidget.clearFocus();
  }

  getWindowTitle(): string {
    return this.#windowTitle;
  }

  setWindowTitle(title: string): void {
    this.#windowTitle = title;
    this.#onWindowTitleChangedEventEmitter.fire(title);
  }

  getBlockFrames(): BlockFrame[] {
    return this.#blockFrames.map(pb => pb.frame);
  }

  redrawScreen(): void {
    this.#blockFrames[this.#blockFrames.length-1].frame.getWidget().update();
  }

  #computeTerminalSize(): TerminalSize {
    if (this.#terminalVisualConfig == null) {
      return null;
    }

    const fontInfo = this.#terminalVisualConfig.fontInfo;
    const metrics = computeFontMetrics(fontInfo.family, fontInfo.style, this.#terminalVisualConfig.fontSizePx);
    const maxViewportSize = this.scrollArea.getMaximumViewportSize();
    const currentMargins = this.scrollArea.getViewportMargins();

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

    const maxViewportHeight = this.scrollArea.getWidget().geometry().height();
    const maxContentHeight = maxViewportHeight - spacing - spacing;

    const maxViewportWidth = maxViewportSize.width() + currentMargins.left + currentMargins.right;
    const maxContentWidth = maxViewportWidth - spacing - spacing - 2 * this.#uiStyle.getFrameMarginLeftRightPx();

    const dpr = this.#topContents.devicePixelRatio();
    const columns = Math.floor(maxContentWidth  / (metrics.widthPx / dpr));
    const rows = Math.floor(maxContentHeight / (metrics.heightPx / dpr));

    const vGap = maxContentHeight % (metrics.heightPx / dpr);
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
      cellWidthPx: metrics.widthPx,
      cellHeightPx: metrics.heightPx,
    };
  }

  resizeTerminalArea(): void {
    if (this.#resizeGuard) {
      return;
    }
    this.#resizeGuard = true;
    this.#internalResizeTerminalArea();
    this.#resizeGuard = false;
  }

  #internalResizeTerminalArea(): void {
    const size = this.#computeTerminalSize();
    if (size == null || size.rows === 0 || size.columns === 0) {
      return;
    }

    const { columns, rows, leftMargin, topMargin, rightMargin, bottomMargin } = size;
    this.scrollArea.setViewportMargins(leftMargin, topMargin, rightMargin, bottomMargin);

    if (columns === this.#columns && rows === this.#rows) {
      return;
    }
    this.#columns = columns;
    this.#rows = rows;

    if (this.#pty != null) {
      this.#pty.resize(columns, rows);
    }

    this.#emulator.resize({rows, columns, cellWidthPixels: size.cellWidthPx, cellHeightPixels: size.cellHeightPx});

    const heightPx = size.rows * size.cellHeightPx;
    const widthPx = size.columns * size.cellWidthPx;

    this.environment.setList([
      { key: TerminalEnvironment.TERM_ROWS, value: "" + rows},
      { key: TerminalEnvironment.TERM_COLUMNS, value: "" + columns},
      { key: TerminalEnvironment.EXTRATERM_TERMINAL_HEIGHT_PIXELS, value: "" + heightPx},
      { key: TerminalEnvironment.EXTRATERM_TERMINAL_WIDTH_PIXELS, value: "" + widthPx},
    ]);
  }

  resetVT(): void {
    this.#emulator.reset();
  }

  #scrollToBottom(): void {
    this.scrollArea.scrollToMaximum();
  }

  #handleKeyPress(event: QKeyEvent): void {
    const ev = qKeyEventToMinimalKeyboardEvent(event);
    this.#handleTermKeyboardEvent(event, ev);
  }

  #handleTermKeyboardEvent(event: QEvent, ev: TermApi.MinimalKeyboardEvent): void {
    const commands = this.#keybindingsIOManager.getCurrentKeybindingsMapping().mapEventToCommands(ev);
    const filteredCommands = this.#extensionManager.queryCommands({
      commands,
      when: true
    });
    if (filteredCommands.length !== 0) {
      return;
    }

    const emulatorHandled = this.#emulator.keyDown(ev);

    event.accept();
    this.#contentWidget.setEventProcessed(true);

    if (emulatorHandled) {
      this.#scrollToBottom();
    }
  }

  #handleInputMethod(event: QInputMethodEvent): void {
    this.scrollArea.getContentWidget().updateMicroFocus();
    if (event.commitString() !== "") {
      const termEvent: TermApi.MinimalKeyboardEvent = {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        key: event.commitString(),
      };
      this.#handleTermKeyboardEvent(event, termEvent);

      if (this.#latestTerminalFrame != null) {
        const terminalBlock = <TerminalBlock> this.#latestTerminalFrame.getBlock();
        terminalBlock.setPreeditString(null);
      }
    } else {
      if (this.#latestTerminalFrame != null) {
        const terminalBlock = <TerminalBlock> this.#latestTerminalFrame.getBlock();
        terminalBlock.setPreeditString(event.preeditString());
      }
    }
  }

  #handleInputMethodQuery(event: QInputMethodQueryEvent): void {
    const query = event.queries();
    if (query & InputMethodQuery.ImEnabled) {
      event.setValue(InputMethodQuery.ImEnabled, true);
    }
    if (query & InputMethodQuery.ImCursorRectangle) {
      const rect = this.#getCursorContentWidgetGeometry();
      event.setValue(InputMethodQuery.ImCursorRectangle, rect);
    }
    if (query & InputMethodQuery.ImReadOnly) {
      event.setValue(InputMethodQuery.ImReadOnly, false);
    }
    if (query & InputMethodQuery.ImHints) {
      event.setValue(InputMethodQuery.ImHints, InputMethodHint.ImhSensitiveData | InputMethodHint.ImhNoAutoUppercase);
    }
    event.accept();
  }

  #handleMouseButtonPressBelowFrames(mouseEvent: QMouseEvent): void {
    if (this.#blockFrames.length === 0) {
      return;
    }
    const mappedPoint = this.scrollArea.getContentWidget().mapFrom(this.scrollArea.getWidget(),
      new QPoint(mouseEvent.x(), mouseEvent.y()));
    const isBelow = this.scrollArea.isYBelowLastFrame(mappedPoint.y());
    if (! isBelow) {
      return;
    }
    const lastBlockFrame = this.#blockFrames[this.#blockFrames.length-1].frame;
    this.#processMouseButtonPress(mouseEvent, lastBlockFrame);
  }

  #handleMouseButtonPress(mouseEvent: QMouseEvent): void {
    const blockFrame = this.scrollArea.getBlockFrameAt(mouseEvent.x(), mouseEvent.y());
    this.#processMouseButtonPress(mouseEvent, blockFrame);
  }

  #processMouseButtonPress(mouseEvent: QMouseEvent, blockFrame: BlockFrame): void {
    const key = this.#mapEventToMouseButtonActionKey(mouseEvent);
    if (key == null) {
      return;
    }

    const generalConfig = this.#configDatabase.getGeneralConfig();
    const action = <MouseButtonAction> generalConfig[key];

    switch (action) {
      case "context_menu":
        mouseEvent.accept();

        this.#onContextMenuEventEmitter.fire({
          x: mouseEvent.globalX(),
          y: mouseEvent.globalY(),
          blockFrame,
          terminal: this
        });
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
      const block = blockFrame.frame.getBlock();
      if (block instanceof TerminalBlock) {
        block.setTerminalVisualConfig(terminalVisualConfig);
      }
    }

    const backgroundHex = new Color(terminalVisualConfig.palette[PALETTE_BG_INDEX]).toHexString();
    this.#contentWidget.setStyleSheet(`
    #content {
      background-color: ${backgroundHex};
    }
    `, false);

    this.resizeTerminalArea();
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
    // ^ Let any Promise here run to completion by itself.
  }

  dispose(): void {
    for (const blockPlumbing of this.#blockFrames) {
      const block = blockPlumbing.frame.getBlock();
      if (block != null) {
        block.dispose();
      }
    }
    this.#enforceScrollbackSizeLater.cancel();
    this.#onDisposeEventEmitter.fire();
    this.#onDisposeEventEmitter.dispose();

    if (this.#pty != null) {
      this.#pty.destroy();
      this.#pty = null;
    }
    this.#disposableHolder.dispose();
  }

  setSessionConfiguration(sessionConfiguration: SessionConfiguration): void {
    this.#sessionConfiguration = sessionConfiguration;
  }

  getSessionConfiguration(): SessionConfiguration {
    return this.#sessionConfiguration;
  }

  appendBlockFrame(blockFrame: BlockFrame): void {
    const disposableHolder = new DisposableHolder();
    if (blockFrame instanceof DecoratedFrame) {
      disposableHolder.add(blockFrame.onCloseClicked((frame) => this.#handleBlockCloseClicked(frame)));
      disposableHolder.add(blockFrame.onPopOutClicked((frame) => this.#handleBlockPopOutClicked(frame)));
    }
    this.#blockFrames.push({ frame: blockFrame, disposableHolder });
    const block = blockFrame.getBlock();
    if (block != null) {
      block.setParent(this);
    }
    this.scrollArea.appendBlockFrame(blockFrame);
  }

  #disconnectLastTerminalFrameFromEmulator(): void {
    this.#emulator.moveRowsAboveCursorToScrollback();
    this.#emulator.flushRenderQueue();

    if (this.#latestTerminalFrame != null) {
      const lastTerminalBlock = this.#latestTerminalFrame.getBlock();
      if (lastTerminalBlock instanceof TerminalBlock) {
        lastTerminalBlock.setEmulator(null);
      }
    }
  }

  #handleBlockCloseClicked(frame: BlockFrame): void {
    this.destroyFrame(frame);
  }

  #handleBlockPopOutClicked(frame: DecoratedFrame): void {
    this.#onPopOutClickedEventEmitter.fire({frame, terminal: this});
  }

  getTitle(): string {
    return null;
  }

  getIconName(): string {
    return null;
  }

  getContents(): QWidget {
    return this.#topContents;
  }

  getTabWidget(): QWidget {
    if (this.#tabTitleWidget == null) {
      this.#createTabTitleWidget();
    }
    return this.#tabTitleWidget;
  }

  getPty(): Pty {
    return this.#pty;
  }

  /**
   * Send data to the pty and process connected to the terminal.
   * @param text the data to send.
   */
  sendToPty(text: string): void {
    if (this.#pty == null) {
      return;
    }
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
      platform: <TextTerm.Platform> process.platform,
      applicationModeCookie: cookie,
      debug: true,
      performanceNowFunc: () => performance.now(),

      setTimeout: this.#qtTimeout.setTimeout.bind(this.#qtTimeout),
      clearTimeout: this.#qtTimeout.clearTimeout.bind(this.#qtTimeout),

      termProgram: "Extraterm",
      termVersion: this.#applicationVersion
    });

    emulator.debug = true;
    emulator.onTitleChange(this.#handleTitle.bind(this));
    emulator.onData(this.#handleTermData.bind(this));
    emulator.onScreenChange(this.#handleScreenChange.bind(this));

    // Application mode handlers
    const applicationModeHandler: TermApi.ApplicationModeHandler = {
      start: this.#handleApplicationModeStart.bind(this),
      data: this.#handleApplicationModeData.bind(this),
      end: this.#handleApplicationModeEnd.bind(this)
    };
    emulator.registerApplicationModeHandler(applicationModeHandler);

    emulator.onPromptStart(() => {
      this.#handleVSCodePromptStart();
    });
    emulator.onPromptEnd(() => {
      this.#handleVSCodePromptEnd();
    });
    emulator.onPreexecution(() => {
      this.#handleVSCodePreexecution();
    });
    emulator.onEndExecution((returnCode: string): void => {
      this.#handleVSCodeEndExecution(returnCode);
    });
    emulator.onCommandLineSet((commandLine: string): void => {
      this.#handleVSCodeCommandLineSet(commandLine);
    });

    emulator.onWriteBufferSize(this.#handleWriteBufferSize.bind(this));
    // if (this._terminalVisualConfig != null) {
    //   emulator.setCursorBlink(this._terminalVisualConfig.cursorBlink);
    // }

    this.#enforceScrollbackSizeLater = new DebouncedDoLater(() => {
      this.#laterEnforceScrollbackSize();
    }, 1500);
    emulator.onRender(() => {
      this.#enforceScrollbackSizeLater.trigger();
    });

    this.#emulator = emulator;
    this.#initDownloadApplicationModeHandler();
  }

  #initDownloadApplicationModeHandler(): void {
    this.#downloadHandler = new DownloadApplicationModeHandler(this.#emulator, this.#bulkFileStorage);
    this.#downloadHandler.onCreatedBulkFile(this.#handleShowFile.bind(this));
  }

  getCursorGlobalGeometry(): QRect | null {
    return this.#getCursorGeometry(true);
  }

  #getCursorContentWidgetGeometry(): QRect | null {
    return this.#getCursorGeometry(false);
  }

  #getCursorGeometry(global: boolean): QRect | null {
    if (this.#latestTerminalFrame == null) {
      return new QRect(0, 0, 1, 1);
    }

    const block = <TerminalBlock> this.#latestTerminalFrame.getBlock();
    const geo = block.getCursorGeometry();
    if (geo == null) {
      return null;
    }

    let pos: QPoint;
    if (global) {
      pos = block.getWidget().mapToGlobal(new QPoint(geo.left(), geo.top()));
    } else {
      pos = block.getWidget().mapTo(this.scrollArea.getContentWidget(), new QPoint(geo.left(), geo.top()));
    }
    return new QRect(pos.x(), pos.y(), geo.width(), geo.height());
  }

  #handleScreenChange(event: TermApi.ScreenChangeEvent): void {
    if (this.#latestTerminalFrame == null) {
      return;
    }

    const blockFrame = this.#latestTerminalFrame;
    this.#onDidScreenChangeEventEmitter.fire({
      blockFrame,
      terminalBlock: <TerminalBlock> blockFrame.getBlock(),
      startLine: event.refreshStartRow,
      endLine: event.refreshEndRow,
    });
  }

  #handleWriteBufferSize(event: TermApi.WriteBufferSizeEvent): void {
    if (this.#pty != null) {
      this.#pty.permittedDataSize(event.status.bufferSize);
    }
  }

  #handleTitle(ev: TermApi.TitleChangeEvent): void {
    this.environment.set(TerminalEnvironment.TERM_TITLE, ev.title);
  }

  #handleTermData(event: TermApi.DataEvent): void {
    // Apply the input filters
    let filteredData = event.data;
    for (const filter of this.#inputStreamFilters) {
      filteredData = filter(filteredData);
    }

    if (filteredData !== "") {
      this.sendToPty(filteredData);
    }
  }

  #registerInputStreamFilter(filter: InputStreamFilter): Disposable {
    this.#inputStreamFilters.push(filter);
    return {
      dispose: () => {
        this.#inputStreamFilters = this.#inputStreamFilters.filter(f => f !== filter);
      }
    };
  }

  scrollPageDown(): void {
    this.scrollArea.scrollPageDown();
  }

  scrollPageUp(): void {
    this.scrollArea.scrollPageUp();
  }

  getSelectionText(): string {
    let text: string = null;
    for (const blockFrame of this.#blockFrames) {
      const block = blockFrame.frame.getBlock();
      if (block instanceof TerminalBlock && block.hasSelection()) {
        text = block.getSelectionText();
        if (text != null) {
          return text;
        }
      }
    }
    return null;
  }

  pasteText(text: string): void {
    if (this.#emulator != null) {
      this.#emulator.pasteText(text);
    }
  }

  #removeFrameFromScrollArea(frame: BlockFrame): void {
    this.scrollArea.removeBlockFrame(frame);

    frame.getWidget().hide();
    frame.getWidget().setParent(null);
    const index = this.#blockFrames.findIndex(bf => bf.frame === frame);
    const block = frame.getBlock();
    if (block != null) {
      block.setParent(null);
    }
    this.#blockFrames[index].disposableHolder.dispose();
    this.#blockFrames.splice(index, 1);
  }

  destroyFrame(frame: BlockFrame): void {
    this.#removeFrameFromScrollArea(frame);
    if (frame.getBlock() != null) {
      frame.getBlock().dispose();
    }
    this.#contentWidget.update();
    this.#contentWidget.setFocus();
  }

  commandCopyToClipboard(): void {
    const text = this.getSelectionText();
    if (text == null || text === "") {
      return;
    }
    const clipboard = QApplication.clipboard();
    clipboard.setText(text);
  }

  commandDeleteLastFrame(): void {
    for (let i = this.#blockFrames.length-1; i >= 0 ; i--) {
      const bf = this.#blockFrames[i].frame;
      if (bf instanceof DecoratedFrame) {
        this.destroyFrame(bf);
        return;
      }
    }
  }

  commandGoToNextFrame(): void {
    const viewportTop = this.scrollArea.getScrollPosition();
    for (const bf of this.#blockFrames) {
      const geo = bf.frame.getWidget().geometry();
      if (geo.top() > viewportTop) {
        this.scrollArea.setScrollPosition(geo.top());
        return;
      }
    }
  }

  commandGoToPreviousFrame(): void {
    const viewportTop = this.scrollArea.getScrollPosition();
    for (let i = this.#blockFrames.length-1; i >= 0 ; i--) {
      const bf = this.#blockFrames[i];
      const geo = bf.frame.getWidget().geometry();
      if (geo.top() < viewportTop) {
        this.scrollArea.setScrollPosition(geo.top());
        return;
      }
    }
  }

  commandPasteFromClipboard(): void {
    const clipboard = QApplication.clipboard();
    const text = clipboard.text();
    this.pasteText(text);
  }

  commandResetVT(): void {
    this.resetVT();
  }

  commandClearScrollback(): void {
    this.#enforceScrollbackLinesSize(0);
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

  #updateViewportTopOnFrames(): void {
    const value = this.scrollArea.getScrollPosition();
    for (const bf of this.#blockFrames) {
      const widget = bf.frame.getWidget();
      const geo = widget.geometry();
      const offset = value - geo.top();
      bf.frame.setViewportTop(offset);
    }
  }

  #appendNewTerminalBlock(): void {
    this.#latestTerminalFrame = this.#createSpacerFramedTerminalBlock();
    this.appendBlockFrame(this.#latestTerminalFrame);
  }

  #enterBlockStatePlain(): void {
    this.#blockState = BlockState.PLAIN;
  }

  #enterBlockStateFrameOpen(commandLine: string): void {
    this.#disconnectLastTerminalFrameFromEmulator();
    this.#openDecoratedFrame = new DecoratedFrame(this.#uiStyle, this.#nextTag());
    const defaultMetadata: BlockMetadata = {
      title: commandLine,
      posture: BlockPosture.RUNNING,
      icon: "fa-cog",
      moveable: false,
      deleteable: false
    };
    this.#openDecoratedFrame.setDefaultMetadata(defaultMetadata);
    this.appendBlockFrame(this.#openDecoratedFrame);

    this.#appendNewTerminalBlock();

    this.#lastCommandLine = commandLine;

    this.#updateEnvironmentWithCommandLine(commandLine);
    this.#blockState = BlockState.FRAME_OPEN;
  }

  #exitBlockStateFrameOpen(returnCode: string): void {
    this.#disconnectLastTerminalFrameFromEmulator();

    const terminalBlockFrame = this.#latestTerminalFrame;
    this.#latestTerminalFrame = null;
    const terminalBlock = <TerminalBlock> terminalBlockFrame.getBlock();

    this.scrollArea.removeBlockFrame(terminalBlockFrame);
    terminalBlockFrame.getWidget().hide();
    terminalBlockFrame.getWidget().setParent(null);
    terminalBlockFrame.getBlock().setParent(null);
    terminalBlockFrame.setBlock(null);

    const index = this.#blockFrames.findIndex(bf => bf.frame === terminalBlockFrame);
    this.#blockFrames.splice(index, 1);

    terminalBlock.setCommandLine(this.#lastCommandLine);
    const returnCodeInt = Number.parseInt(returnCode, 10);
    terminalBlock.setReturnCode(returnCodeInt);

    this.#openDecoratedFrame.setBlock(terminalBlock);
    this.#openDecoratedFrame = null;

    this.#updateEnvironmentWithOldCommandLine();
  }

  #enterBlockStateBookmarkOpen(commandLine: string): void {
    this.#moveCursorToFreshLine();
    this.#emulator.moveRowsAboveCursorToScrollback();
    this.#emulator.flushRenderQueue();

    this.#frameStartBookmark.row = (<TerminalBlock>this.#latestTerminalFrame.getBlock())
                                      .getScrollbackLength();
    this.#frameStartBookmark.isLive = true;
    this.#lastCommandLine = commandLine;

    this.#updateEnvironmentWithCommandLine(commandLine);

    this.#blockState = BlockState.BOOKMARK_OPEN;
  }

  #exitBlockStateBookmarkOpen(returnCode: string): boolean {
    this.#moveCursorToFreshLine();

    const terminalBlock = <TerminalBlock> this.#latestTerminalFrame.getBlock();
    const scrollbackOutputLength = terminalBlock.getScrollbackLength() - this.#frameStartBookmark.row;
    const effectiveScreenLength = this.#emulator.getCursorRow();

    const isSuccess = returnCode === "0" || returnCode === "";
    const commandShouldBeFramed = !isSuccess || this.#commandNeedsFrame(this.#lastCommandLine,
      scrollbackOutputLength + effectiveScreenLength);
    if (commandShouldBeFramed) {
      this.#disconnectLastTerminalFrameFromEmulator();

      const decoratedFrame = new DecoratedFrame(this.#uiStyle, this.#nextTag());

      const newTerminalBlock = this.#createTerminalBlock(decoratedFrame, null);
      decoratedFrame.setBlock(newTerminalBlock);

      const scrollbackLines = terminalBlock.takeScrollbackFrom(this.#frameStartBookmark.row);
      newTerminalBlock.setScrollbackLines(scrollbackLines);
      const returnCodeInt = Number.parseInt(returnCode, 10);
      newTerminalBlock.setReturnCode(returnCodeInt);
      newTerminalBlock.setCommandLine(this.#lastCommandLine);

      this.appendBlockFrame(decoratedFrame);

      this.#latestTerminalFrame = null;
    }

    this.#frameStartBookmark.isLive = false;

    this.#updateEnvironmentWithOldCommandLine();
    return commandShouldBeFramed;
  }

  #updateEnvironmentWithCommandLine(commandLine: string): void {
    const command = commandLine.split(" ")[0];
    this.environment.setList([
      { key: TerminalEnvironment.EXTRATERM_CURRENT_COMMAND_LINE, value: commandLine },
      { key: TerminalEnvironment.EXTRATERM_CURRENT_COMMAND, value: command },
      { key: TerminalEnvironment.EXTRATERM_EXIT_CODE, value: "" },
    ]);
  }

  #updateEnvironmentWithOldCommandLine(): void {
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
  }

  /**
   * Handle when the embedded term.js enters start of application mode.
   *
   * @param {array} params The list of parameter which were specified in the
   *     escape sequence.
   */
  #handleApplicationModeStart(params: string[]): TermApi.ApplicationModeResponse {
    if (DEBUG_APPLICATION_MODE) {
      this._log.debug("application-mode started! ",params);
    }

    this.#applicationModeData = "";

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
      this._log.warn("Received the wrong number of parameters at the start of an application mode sequence.");
      return {action: TermApi.ApplicationModeResponseAction.ABORT};

    } else if(params.length >= 2) {
      switch (params[1]) {
        case "" + ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
          this.#applicationMode = ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START;
          this.#bracketStyle = params[2];
          break;

        case "" + ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
          this.#applicationMode = ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END;
          if (DEBUG_APPLICATION_MODE) {
            this._log.debug("Starting APPLICATION_MODE_OUTPUT_BRACKET_END");
          }
          break;

        case "" + ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
          this.#applicationMode = ApplicationMode.APPLICATION_MODE_REQUEST_FRAME;
          if (DEBUG_APPLICATION_MODE) {
            this._log.debug("Starting APPLICATION_MODE_REQUEST_FRAME");
          }
          break;

        case "" + ApplicationMode.APPLICATION_MODE_SHOW_FILE:
          if (DEBUG_APPLICATION_MODE) {
            this._log.debug("Starting APPLICATION_MODE_SHOW_FILE");
          }
          this.#applicationMode = ApplicationMode.APPLICATION_MODE_SHOW_FILE;
          return this.#downloadHandler.handleStart(params.slice(2));

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
  #handleApplicationModeData(data: string): TermApi.ApplicationModeResponse {
    if (DEBUG_APPLICATION_MODE) {
      this._log.debug("html-mode data!", data);
    }
    switch (this.#applicationMode) {
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
      case ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
        this.#applicationModeData = this.#applicationModeData + data;
        break;
      case ApplicationMode.APPLICATION_MODE_SHOW_FILE:
        return this.#downloadHandler.handleData(data);
      default:
        break;
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  /**
   * Handle the exit from application mode.
   */
  #handleApplicationModeEnd(): TermApi.ApplicationModeResponse {
    switch (this.#applicationMode) {
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
        this.#handleApplicationModeBracketStart();
        break;

      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
        this.#handleApplicationModeBracketEnd();
        break;

      case ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
        this.#handleRequestFrame(this.#applicationModeData);
        break;

      case ApplicationMode.APPLICATION_MODE_SHOW_FILE:
        return this.#downloadHandler.handleStop();

      default:
        break;
    }
    this.#applicationMode = ApplicationMode.APPLICATION_MODE_NONE;

    if (DEBUG_APPLICATION_MODE) {
      this._log.debug("Application mode end!", this.#applicationModeData);
    }
    this.#applicationModeData = null;

    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  #handleApplicationModeBracketStart(): void {
    const commandLine = this.#getBracketCommandLine();
    if (commandLine === "") {
      return;
    }
    this.#handleCommandOutputStart(commandLine);
  }

  #handleCommandOutputStart(commandLine: string): void {
    const needsFrame = this.#commandNeedsFrame(commandLine);

    switch (this.#blockState) {
      case BlockState.START:
        return;

      case BlockState.PLAIN:
        break;

      case BlockState.FRAME_OPEN:
        this.#exitBlockStateFrameOpen("");
        if ( ! needsFrame) {
          this.#appendNewTerminalBlock();
        }
        break;

      case BlockState.BOOKMARK_OPEN:
        const wasFramed = this.#exitBlockStateBookmarkOpen("");
        if (wasFramed && ! needsFrame) {
          this.#appendNewTerminalBlock();
        }
        break;
    }

    if (needsFrame) {
      this.#enterBlockStateFrameOpen(commandLine);
    } else {
      this.#enterBlockStateBookmarkOpen(commandLine);
    }
  }

  #handleApplicationModeBracketEnd(): void {
    const returnCode = this.#applicationModeData;
    this.#handleCommandOutputEnd(returnCode);
  }

  #handleCommandOutputEnd(returnCode: string): void {
    switch (this.#blockState) {
      case BlockState.START:
      case BlockState.PLAIN:
        break;

      case BlockState.FRAME_OPEN:
        this.#exitBlockStateFrameOpen(returnCode);
        this.#appendNewTerminalBlock();
        this.#enterBlockStatePlain();
        break;

      case BlockState.BOOKMARK_OPEN:
        const wasFramed = this.#exitBlockStateBookmarkOpen(returnCode);
        if (wasFramed) {
          this.#appendNewTerminalBlock();
        }
        this.#enterBlockStatePlain();
        break;
    }
  }

  #handleVSCodePromptStart(): void {
    this.#promptEndBookmark.isLive = false;
  }

  #handleVSCodePromptEnd(): void {
    const dim = this.#emulator.getDimensions();

    const terminalBlock = <TerminalBlock> this.#latestTerminalFrame.getBlock();
    this.#promptEndBookmark.row = dim.cursorY + terminalBlock.getScrollbackLength();
    this.#promptEndBookmark.column = dim.cursorX;
    this.#promptEndBookmark.isLive = true;
  }

  #handleVSCodePreexecution(): void {
    let commandLine = "";
    if (this.#promptEndBookmark.isLive) {
      const dim = this.#emulator.getDimensions();

      const terminalBlock = <TerminalBlock> this.#latestTerminalFrame.getBlock();
      commandLine = terminalBlock.getTextRange({
        x: this.#promptEndBookmark.column,
        y: this.#promptEndBookmark.row,
      },
      {
        x: dim.cursorX,
        y: dim.cursorY + terminalBlock.getScrollbackLength()
      });
      commandLine = commandLine ?? "";
      commandLine = commandLine.replaceAll("\n", "").trim();
    }
    this.#handleCommandOutputStart(commandLine);
  }

  #handleVSCodeEndExecution(returnCode: string): void {
    this.#handleCommandOutputEnd(returnCode);
  }

  #handleVSCodeCommandLineSet(commandLine: string): void {
    switch (this.#blockState) {
      case BlockState.START:
      case BlockState.PLAIN:
        this.#handleCommandOutputStart(commandLine);
        break;

      case BlockState.FRAME_OPEN:
        const defaultMetadata: BlockMetadata = {
          title: commandLine,
          posture: BlockPosture.RUNNING,
          icon: "fa-cog",
          moveable: false,
          deleteable: false
        };
        this.#openDecoratedFrame.setDefaultMetadata(defaultMetadata);
        break;

      case BlockState.BOOKMARK_OPEN:
        this.#lastCommandLine = commandLine;
        break;
    }
  }

  #getBracketCommandLine(): string {
    let cleanCommandLine = this.#applicationModeData;
    if (this.#bracketStyle === "bash") {
      // Bash includes the history number. Remove it.
      const trimmed = this.#applicationModeData.trim();
      cleanCommandLine = trimmed.slice(trimmed.indexOf(" ")).trim();
    }
    return cleanCommandLine;
  }

  #handleShowFile(bulkFile: BulkFile): void {
    const isDownload = bulkFile.getMetadata()["download"] === "true";
    const {mimeType, charset} = BulkFileUtils.guessMimetype(bulkFile);
    const blockMimeType = mimeType == null || isDownload ? "application/octet-stream" : mimeType;
    this.#appendExtensionBlockWithBulkFile(blockMimeType, bulkFile);
  }

  appendExtensionBlockByName(extensionName: string, blockName: string, args?: any): BlockFrame {
    const newExtensionBlock = this.#extensionManager.createExtensionBlockByName(this, extensionName, blockName, args);
    return this.#appendExtensionBlock(newExtensionBlock);
  }

  #appendExtensionBlockWithBulkFile(blockMimeType: string, bulkFile: BulkFile): void {
    const newExtensionBlock = this.#extensionManager.createExtensionBlockWithBulkFile(this, blockMimeType, bulkFile);
    this.#appendExtensionBlock(newExtensionBlock);
  }

  #appendExtensionBlock(newExtensionBlock: Block): BlockFrame {
    let decoratedFrame: DecoratedFrame = null;
    const appendExtensionBlock = () => {
      decoratedFrame = new DecoratedFrame(this.#uiStyle, this.#nextTag());
      decoratedFrame.setBlock(newExtensionBlock);
      this.appendBlockFrame(decoratedFrame);
    };

    switch (this.#blockState) {
      case BlockState.START:
        appendExtensionBlock();
        break;

      case BlockState.PLAIN:
        this.#disconnectLastTerminalFrameFromEmulator();
        appendExtensionBlock();
        this.#appendNewTerminalBlock();
        this.#enterBlockStatePlain();
        break;

      case BlockState.FRAME_OPEN:
        this.#exitBlockStateFrameOpen("");
        this.#disconnectLastTerminalFrameFromEmulator();
        appendExtensionBlock();
        this.#appendNewTerminalBlock();
        this.#enterBlockStatePlain();
        break;

      case BlockState.BOOKMARK_OPEN:
        this.#exitBlockStateBookmarkOpen("");
        this.#disconnectLastTerminalFrameFromEmulator();
        appendExtensionBlock();
        this.#appendNewTerminalBlock();
        this.#enterBlockStatePlain();
        break;
    }
    return decoratedFrame;
  }

  getFrameContents(frameId: number): BulkFile {
    for (const bf of this.#blockFrames) {
      if (bf.frame.getTag() === frameId) {
        if (bf.frame.getBlock() == null) {
          return null;
        }
        return bf.frame.getBlock().getBulkFile();
      }
    }
    return null;
  }

  #moveCursorToFreshLine(): void {
    const dims = this.#emulator.getDimensions();
    if (dims.cursorX !== 0 && this.#emulator.getLineText(dims.cursorY).trim() !== "") {
      this.#emulator.newLine();
      this.#emulator.carriageReturn();
    }
  }

  #commandNeedsFrame(commandLine: string, linesOfOutput=-1): boolean {
    if (commandLine == null || commandLine.trim() === "" || this.#configDatabase === null) {
      return false;
    }

    const commandLineActions = this.#configDatabase.getCommandLineActionConfig() || [];
    for (const cla of commandLineActions) {
      if (this.#commandLineActionMatches(commandLine, cla)) {
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

  #commandLineActionMatches(command: string, cla: DeepReadonly<CommandLineAction>): boolean {
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

  findLastDecoratedFrame(): DecoratedFrame {
    const len = this.#blockFrames.length;
    for (let i=len-1; i !==0; i--) {
      const frame = this.#blockFrames[i].frame;
      if (frame instanceof DecoratedFrame && frame.getBlock() != null) {
        return frame;
      }
    }
    return null;
  }

  #findLastBareTerminalBlockFrame(): SpacerFrame {
    const len = this.#blockFrames.length;
    for (let i=len-1; i >= 0; i--) {
      const frame = this.#blockFrames[i].frame;
      if (frame instanceof SpacerFrame) {
        const block = frame.getBlock();
        if (block instanceof TerminalBlock) {
          return frame;
        }
      }
    }
    return null;
  }

  appendBorderWidget(widget: QWidget, border: BorderDirection): void {
    this.#borderWidgetLayout[border].addWidget(widget);
    widget.show();
  }

  removeBorderWidget(widget: QWidget, border: BorderDirection): void {
    widget.hide();
    this.#borderWidgetLayout[border].removeWidget(widget);
    widget.hide();
    widget.setParent(null);
  }

  #laterEnforceScrollbackSize(): void {
    if (this.#configDatabase != null) {
      const config = this.#configDatabase.getGeneralConfig();
      this.#enforceScrollbackFrameSize(config.scrollbackMaxFrames);
    }
  }

  #enforceScrollbackFrameSize(maxScrollbackFrames: number): void {
    const size = this.#computeTerminalSize();
    if (size == null) {
      return;
    }

    // Skip past any blocks which might be visible in the window.
    let blockIndex = this.#blockFrames.length - 1;
    let currentHeight = 0;
    while (blockIndex > 0 && currentHeight < size.rows) {
      const block = this.#blockFrames[blockIndex].frame.getBlock();
      if (block instanceof TerminalBlock) {
        currentHeight += block.getScrollbackLength();
      }
      blockIndex--;
    }

    if (blockIndex > maxScrollbackFrames) {
      let chopCount = blockIndex - maxScrollbackFrames;
      while (chopCount > 0) {
        const targetFrame = this.#blockFrames[0].frame;
        this.#removeFrameFromScrollArea(targetFrame);
        if (targetFrame.getBlock() != null) {
          targetFrame.getBlock().dispose();
        }
        chopCount--;
      }
    }
  }

  #enforceScrollbackLinesSize(maxScrollbackLines: number): void {
    const size = this.#computeTerminalSize();
    if (size == null) {
      return;
    }

    // Skip past any blocks which might be visible in the window.
    let blockIndex = this.#blockFrames.length - 1;
    let currentHeight = -size.rows;
    while (blockIndex >= 0 && currentHeight < maxScrollbackLines) {
      const block = this.#blockFrames[blockIndex].frame.getBlock();
      if (block instanceof TerminalBlock) {
        currentHeight += block.getScrollbackLength();
      }
      blockIndex--;
    }

    if (currentHeight < maxScrollbackLines) {
      return;
    }

    blockIndex++;
    const block = this.#blockFrames[blockIndex].frame.getBlock();
    if (block instanceof TerminalBlock) {
      const lineCount = currentHeight - maxScrollbackLines;
      block.deleteTopLines(lineCount);
      this.scrollArea.preMoveScrollPosition(- lineCount * size.cellHeightPx);

      // The mark for the start of the last command output may
      // need to be adjusted if we chopped its block.
      const isLastBlock = blockIndex === this.#blockFrames.length -1;
      if (isLastBlock) {
        for (const bookmark of this.#allTerminalBookmarks) {
          if (bookmark.isLive) {
            bookmark.row = Math.max(0, bookmark.row - lineCount);
          }
        }
      }
    }
    blockIndex--;

    while (blockIndex >= 0) {
      const targetFrame = this.#blockFrames[0].frame;
      this.#removeFrameFromScrollArea(targetFrame);
      blockIndex--;
    }
  }

  #handleContentAreaWidgetLayoutRequest(): void {
    if (this.#uploadProgressBar == null) {
      return;
    }
    const geo = this.#contentAreaWidget.geometry();
    this.#uploadProgressBar.getWidget().setGeometry(0, 0, geo.width(), geo.height());
  }

  #initUploadProgressBar(): void {
    if (this.#uploadProgressBar == null) {
      this.#uploadProgressBar = new UploadProgressBar();
      const progressBarWidget = this.#uploadProgressBar.getWidget();
      progressBarWidget.setParent(this.#contentAreaWidget);
      progressBarWidget.setGeometry(0, 0, 300, 200);
    }
  }

  #handleRequestFrame(frameId: string): void {
    if (this.#frameFinder === null) {
      return;
    }

    const bulkFile = this.#frameFinder(frameId);
    if (bulkFile === null) {
      this.sendToPty("#error\n");
      return;
    }

    const uploader = new BulkFileUploader(bulkFile, this.#pty);
    this.#initUploadProgressBar();

    if ("filename" in bulkFile.getMetadata()) {
      this.#uploadProgressBar.setFilename(<string> bulkFile.getMetadata()["filename"]);
    }

    this.#uploadProgressBar.setTotal(bulkFile.getTotalSize());
    uploader.onUploadedChange(uploaded => {
      this.#uploadProgressBar.setTransferred(uploaded);
    });

    const inputFilterRegistration = this.#registerInputStreamFilter((input: string): string => {
      const ctrlCIndex = input.indexOf("\x03");
      if (ctrlCIndex !== -1) {
        // Abort the upload.
        uploader.abort();
        inputFilterRegistration.dispose();
        return input.substring(ctrlCIndex + 1);
      } else {
        return "";
      }
    });

    uploader.onFinished(() => {
      this.#uploadProgressBar.hide();
      inputFilterRegistration.dispose();
      doLater(() => {
        uploader.dispose();
      });
    });

    this.#uploadProgressBar.showDelayed();

    uploader.upload();
  }
}
