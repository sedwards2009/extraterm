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
  Modifier,
  Key,
  Shape,
  ScrollBarPolicy
} from "@nodegui/nodegui";
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
  #columns = -1;
  #rows = -1;

  #scrollArea: QScrollArea = null;
  #marginPx = 11;

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

    doLater(() => {
      this.resizeEmulatorFromTerminalSize();
    });
  }

  #createUi() : void {
    this.#scrollArea = new QScrollArea();
    this.#scrollArea.setWidgetResizable(true);
    const contentWidget = new QWidget();
    contentWidget.setObjectName("content");
    contentWidget.setFocusPolicy(FocusPolicy.ClickFocus);
    contentWidget.setStyleSheet(`
    #content {
      background-color: #00ff00;
    }
    `);
    contentWidget.addEventListener(WidgetEventTypes.KeyPress, (nativeEvent) => {
      this.#handleKeyPress(new QKeyEvent(nativeEvent));
    });
    this.#scrollArea.addEventListener(WidgetEventTypes.Resize, () => {
      this.#handleResize();
    });

    this.#contentLayout = new QBoxLayout(Direction.TopToBottom, contentWidget);
    this.#contentLayout.setSizeConstraint(SizeConstraint.SetMinimumSize);
    this.#contentLayout.setContentsMargins(this.#marginPx, this.#marginPx, this.#marginPx, this.#marginPx);
    this.#scrollArea.setFrameShape(Shape.NoFrame);
    this.#scrollArea.setVerticalScrollBarPolicy(ScrollBarPolicy.ScrollBarAlwaysOn);
    this.#scrollArea.setWidget(contentWidget);

    this.#contentLayout.addStretch(1);

    const terminalBlock = new TerminalBlock();
    this.appendBlock(terminalBlock);
    terminalBlock.setEmulator(this.#emulator);
  }

  #handleResize(): void {
    this.resizeEmulatorFromTerminalSize();
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

  #handleKeyPress(event: QKeyEvent): void {
    const modifiers = event.modifiers();
    const altKey = (modifiers & Modifier.ALT) !== 0;
    const ctrlKey = (modifiers & Modifier.CTRL) !== 0;
    const metaKey = (modifiers & Modifier.META) !== 0;
    const shiftKey = (modifiers & Modifier.SHIFT) !== 0;

    const ev: TermApi.MinimalKeyboardEvent = {
      altKey,
      ctrlKey,
      metaKey,
      shiftKey,
      key: mapQKeyEventToDOMKey(event),
      isComposing: false,
    };
    this.#emulator.keyDown(ev);
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

const qkeyToDOMMapping = new Map<number, string>();
qkeyToDOMMapping.set(Key.Key_Alt, "Alt");
qkeyToDOMMapping.set(Key.Key_AltGr, "AltGraph");
qkeyToDOMMapping.set(Key.Key_Mode_switch, "AltGraph");
qkeyToDOMMapping.set(Key.Key_CapsLock, "CapsLock");
qkeyToDOMMapping.set(Key.Key_Control, "Control");
qkeyToDOMMapping.set(Key.Key_Meta, "Hyper");
qkeyToDOMMapping.set(Key.Key_NumLock, "NumLock");
qkeyToDOMMapping.set(Key.Key_ScrollLock, "ScrollLock");
qkeyToDOMMapping.set(Key.Key_Shift, "Shift");
qkeyToDOMMapping.set(Key.Key_Super_L, "Super");
qkeyToDOMMapping.set(Key.Key_Super_R, "Super");
qkeyToDOMMapping.set(Key.Key_Return, "Enter");
qkeyToDOMMapping.set(Key.Key_Enter, "Enter");
qkeyToDOMMapping.set(Key.Key_Tab, "Tab");
qkeyToDOMMapping.set(Key.Key_Space, " ");
qkeyToDOMMapping.set(Key.Key_Down, "ArrowDown");
qkeyToDOMMapping.set(Key.Key_Up, "ArrowUp");
qkeyToDOMMapping.set(Key.Key_Left, "ArrowLeft");
qkeyToDOMMapping.set(Key.Key_Right, "ArrowRight");
qkeyToDOMMapping.set(Key.Key_End, "End");
qkeyToDOMMapping.set(Key.Key_Home, "Home");
qkeyToDOMMapping.set(Key.Key_PageDown, "PageDown");
qkeyToDOMMapping.set(Key.Key_PageUp, "PageUp");
qkeyToDOMMapping.set(Key.Key_Backspace, "Backspace");
qkeyToDOMMapping.set(Key.Key_Clear, "Clear");
qkeyToDOMMapping.set(Key.Key_Copy, "Copy");
qkeyToDOMMapping.set(Key.Key_Cut, "Cut");
qkeyToDOMMapping.set(Key.Key_Delete, "Delete");
qkeyToDOMMapping.set(Key.Key_Insert, "Insert");
qkeyToDOMMapping.set(Key.Key_Paste, "Paste");
qkeyToDOMMapping.set(Key.Key_Menu, "ContextMenu");
qkeyToDOMMapping.set(Key.Key_Escape, "Escape");
qkeyToDOMMapping.set(Key.Key_Help, "Help");
qkeyToDOMMapping.set(Key.Key_Pause, "Pause");
qkeyToDOMMapping.set(Key.Key_Play, "Play");
qkeyToDOMMapping.set(Key.Key_ZoomIn, "ZoomIn");
qkeyToDOMMapping.set(Key.Key_ZoomOut, "ZoomOut");
qkeyToDOMMapping.set(Key.Key_MonBrightnessDown, "BrightnessDown");
qkeyToDOMMapping.set(Key.Key_MonBrightnessUp, "BrightnessUp");
qkeyToDOMMapping.set(Key.Key_Eject, "Eject");
qkeyToDOMMapping.set(Key.Key_LogOff, "LogOff");
qkeyToDOMMapping.set(Key.Key_PowerDown, "PowerOff");
qkeyToDOMMapping.set(Key.Key_PowerOff, "PowerOff");
qkeyToDOMMapping.set(Key.Key_Print, "PrintScreen");
qkeyToDOMMapping.set(Key.Key_SysReq, "PrintScreen");
qkeyToDOMMapping.set(Key.Key_Hibernate, "Hibernate");
qkeyToDOMMapping.set(Key.Key_Standby, "Standby");
qkeyToDOMMapping.set(Key.Key_Suspend, "Standby");
qkeyToDOMMapping.set(Key.Key_Sleep, "Standby");
qkeyToDOMMapping.set(Key.Key_WakeUp, "WakeUp");
qkeyToDOMMapping.set(Key.Key_MultipleCandidate, "AllCandidates");
qkeyToDOMMapping.set(Key.Key_Eisu_Shift, "Alphanumeric");
qkeyToDOMMapping.set(Key.Key_Eisu_toggle, "Alphanumeric");
qkeyToDOMMapping.set(Key.Key_Codeinput, "CodeInput");
qkeyToDOMMapping.set(Key.Key_Multi_key, "Compose");
qkeyToDOMMapping.set(Key.Key_Henkan, "Convert");
qkeyToDOMMapping.set(Key.Key_Mode_switch, "ModeChange");
qkeyToDOMMapping.set(Key.Key_Muhenkan, "NonConvert");
qkeyToDOMMapping.set(Key.Key_PreviousCandidate, " PreviousCandidate");
qkeyToDOMMapping.set(Key.Key_SingleCandidate, "SingleCandidate");
qkeyToDOMMapping.set(Key.Key_F1, "F1");
qkeyToDOMMapping.set(Key.Key_F2, "F2");
qkeyToDOMMapping.set(Key.Key_F3, "F3");
qkeyToDOMMapping.set(Key.Key_F4, "F4");
qkeyToDOMMapping.set(Key.Key_F5, "F5");
qkeyToDOMMapping.set(Key.Key_F6, "F6");
qkeyToDOMMapping.set(Key.Key_F7, "F7");
qkeyToDOMMapping.set(Key.Key_F8, "F8");
qkeyToDOMMapping.set(Key.Key_F9, "F9");
qkeyToDOMMapping.set(Key.Key_F10, "F10");
qkeyToDOMMapping.set(Key.Key_F11, "F11");
qkeyToDOMMapping.set(Key.Key_F12, "F12");
qkeyToDOMMapping.set(Key.Key_F13, "F13");
qkeyToDOMMapping.set(Key.Key_F14, "F14");
qkeyToDOMMapping.set(Key.Key_F15, "F15");
qkeyToDOMMapping.set(Key.Key_F16, "F16");
qkeyToDOMMapping.set(Key.Key_F17, "F17");
qkeyToDOMMapping.set(Key.Key_F18, "F18");
qkeyToDOMMapping.set(Key.Key_F19, "F19");
qkeyToDOMMapping.set(Key.Key_F20, "F20");
qkeyToDOMMapping.set(Key.Key_Context1, "Soft1");
qkeyToDOMMapping.set(Key.Key_Context2, "Soft2");
qkeyToDOMMapping.set(Key.Key_Context3, "Soft3");
qkeyToDOMMapping.set(Key.Key_Context4, "Soft4");
qkeyToDOMMapping.set(Key.Key_ChannelDown, "ChannelDown");
qkeyToDOMMapping.set(Key.Key_ChannelUp, "ChannelUp");
qkeyToDOMMapping.set(Key.Key_AudioForward, "MediaFastForward");
qkeyToDOMMapping.set(Key.Key_MediaPause, "MediaPause");
qkeyToDOMMapping.set(Key.Key_MediaTogglePlayPause, "MediaPlayPause");
qkeyToDOMMapping.set(Key.Key_MediaRecord, "MediaRecord");
qkeyToDOMMapping.set(Key.Key_AudioRewind, "MediaRewind");
qkeyToDOMMapping.set(Key.Key_MediaStop, "MediaStop");
qkeyToDOMMapping.set(Key.Key_MediaNext, "MediaTrackNext");
qkeyToDOMMapping.set(Key.Key_MediaPrevious, "MediaTrackPrevious");
qkeyToDOMMapping.set(Key.Key_VolumeDown, "AudioVolumeDown");
qkeyToDOMMapping.set(Key.Key_VolumeMute, "AudioVolumeMute");
qkeyToDOMMapping.set(Key.Key_VolumeUp, "AudioVolumeUp");
qkeyToDOMMapping.set(Key.Key_MicVolumeDown, "MicrophoneVolumeDown");
qkeyToDOMMapping.set(Key.Key_MicMute, "MicrophoneVolumeMute");
qkeyToDOMMapping.set(Key.Key_MicVolumeUp, "MicrophoneVolumeUp");
qkeyToDOMMapping.set(Key.Key_Exit, "Exit");
qkeyToDOMMapping.set(Key.Key_Guide, "Guide");
qkeyToDOMMapping.set(Key.Key_Info, "Info");
qkeyToDOMMapping.set(Key.Key_AudioCycleTrack, "MediaAudioTrack");
qkeyToDOMMapping.set(Key.Key_MediaLast, "MediaLast");
qkeyToDOMMapping.set(Key.Key_TopMenu, "MediaTopMenu");
qkeyToDOMMapping.set(Key.Key_Settings, "Settings");
qkeyToDOMMapping.set(Key.Key_SplitScreen, "SplitScreenToggle");
qkeyToDOMMapping.set(Key.Key_Zoom, "ZoomToggle");
qkeyToDOMMapping.set(Key.Key_Close, "Close");
qkeyToDOMMapping.set(Key.Key_New, "New");
qkeyToDOMMapping.set(Key.Key_Open, "Open");
qkeyToDOMMapping.set(Key.Key_Print, "Print");
qkeyToDOMMapping.set(Key.Key_Save, "Save");
qkeyToDOMMapping.set(Key.Key_Spell, "SpellCheck");
qkeyToDOMMapping.set(Key.Key_MailForward, "MailForward");
qkeyToDOMMapping.set(Key.Key_Reply, "MailReply");
qkeyToDOMMapping.set(Key.Key_Calculator, "LaunchCalculator");
qkeyToDOMMapping.set(Key.Key_Calendar, "LaunchCalendar");
qkeyToDOMMapping.set(Key.Key_LaunchMail, "LaunchMail");
qkeyToDOMMapping.set(Key.Key_LaunchMedia, "LaunchMediaPlayer");
qkeyToDOMMapping.set(Key.Key_Music, "LaunchMusicPlayer");
qkeyToDOMMapping.set(Key.Key_Phone, "LaunchPhone");
qkeyToDOMMapping.set(Key.Key_ScreenSaver, "LaunchScreenSaver");
qkeyToDOMMapping.set(Key.Key_Excel, "LaunchSpreadsheet");
qkeyToDOMMapping.set(Key.Key_WWW, "LaunchWebBrowser");
qkeyToDOMMapping.set(Key.Key_WebCam, "LaunchWebCam");
qkeyToDOMMapping.set(Key.Key_Word, "LaunchWordProcessor");
qkeyToDOMMapping.set(Key.Key_Launch0, "LaunchApplication1");
qkeyToDOMMapping.set(Key.Key_Launch1, "LaunchApplication2");
qkeyToDOMMapping.set(Key.Key_Launch2, "LaunchApplication3");
qkeyToDOMMapping.set(Key.Key_Launch3, "LaunchApplication4");
qkeyToDOMMapping.set(Key.Key_Launch4, "LaunchApplication5");
qkeyToDOMMapping.set(Key.Key_Launch5, "LaunchApplication6");
qkeyToDOMMapping.set(Key.Key_Launch6, "LaunchApplication7");
qkeyToDOMMapping.set(Key.Key_Launch7, "LaunchApplication8");
qkeyToDOMMapping.set(Key.Key_Launch8, "LaunchApplication9");
qkeyToDOMMapping.set(Key.Key_Launch9, "LaunchApplication10");
qkeyToDOMMapping.set(Key.Key_LaunchA, "LaunchApplication11");
qkeyToDOMMapping.set(Key.Key_LaunchB, "LaunchApplication12");
qkeyToDOMMapping.set(Key.Key_LaunchC, "LaunchApplication13");
qkeyToDOMMapping.set(Key.Key_LaunchD, "LaunchApplication14");
qkeyToDOMMapping.set(Key.Key_LaunchE, "LaunchApplication15");
qkeyToDOMMapping.set(Key.Key_LaunchF, "LaunchApplication16");
qkeyToDOMMapping.set(Key.Key_Back, "BrowserBack");
qkeyToDOMMapping.set(Key.Key_Favorites, "BrowserFavorites");
qkeyToDOMMapping.set(Key.Key_Forward, "BrowserForward");
qkeyToDOMMapping.set(Key.Key_HomePage, "BrowserHome");
qkeyToDOMMapping.set(Key.Key_Reload, "BrowserRefresh");
qkeyToDOMMapping.set(Key.Key_Search, "BrowserSearch");
qkeyToDOMMapping.set(Key.Key_Search, "BrowserStop");

function mapQKeyEventToDOMKey(ev: QKeyEvent): string {
  const key = ev.key();
  if (qkeyToDOMMapping.has(key)) {
    return qkeyToDOMMapping.get(key);
  }
  const text = ev.text();
  if ((text.charCodeAt(0) <= 31) && (key < 256)) {
    return String.fromCodePoint(key);
  }
  return text;
}
