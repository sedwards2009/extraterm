/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { BrowserWindow, ipcMain as ipc, clipboard, webContents } from "electron";
import * as _ from "lodash";
import { BulkFileState } from '@extraterm/extraterm-extension-api';
import { getLogger, Logger, log } from "extraterm-logging";
import { createUuid } from 'extraterm-uuid';

import { BulkFileStorage, BufferSizeEvent, CloseEvent } from "./bulk_file_handling/BulkFileStorage";
import { GENERAL_CONFIG, GeneralConfig, ConfigDatabase } from "../Config";
import { PtyManager } from "./pty/PtyManager";
import * as ThemeTypes from "../theme/Theme";
import { ThemeManager, GlobalVariableMap } from "../theme/ThemeManager";
import * as Messages from "../WindowMessages";
import { MainExtensionManager } from "./extension/MainExtensionManager";
import { KeybindingsIOManager } from "./KeybindingsIOManager";
import { isThemeType } from "./MainConfig";
import { GlobalKeybindingsManager } from "./GlobalKeybindings";
import { MainDesktop } from "./MainDesktop";


const LOG_FINE = false;

interface PromisePairFunctions {
  resolve: (result: any) => void;
  reject: (result: any) => void;
}

/**
 * Main IPC
 *
 * Connects the different subsystems in the main process to the render
 * processes by routing messages over Electron's IPC mechanism.
 */
export class MainIpc {
  private _log: Logger = null;
  #tagCounter = 1;

  #bulkFileStorage: BulkFileStorage = null;
  #configDatabase: ConfigDatabase = null;
  #extensionManager: MainExtensionManager = null;
  #globalKeybindingsManager: GlobalKeybindingsManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;
  #mainDesktop: MainDesktop = null;
  #ptyManager: PtyManager = null;
  #themeManager: ThemeManager = null;

  #ptyToSenderMap = new Map<number, number>();
  #waitingExecuteCommands = new Map<string, PromisePairFunctions>();

  constructor(configDatabase: ConfigDatabase, bulkFileStorage: BulkFileStorage, extensionManager: MainExtensionManager,
      ptyManager: PtyManager, keybindingsIOManager: KeybindingsIOManager, mainDesktop: MainDesktop,
      themeManager: ThemeManager, globalKeybindingsManager: GlobalKeybindingsManager) {

    this._log = getLogger("MainIpc", this);
    this.#bulkFileStorage = bulkFileStorage;
    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.#globalKeybindingsManager = globalKeybindingsManager;
    this.#keybindingsIOManager = keybindingsIOManager;
    this.#mainDesktop = mainDesktop;
    this.#ptyManager = ptyManager;
    this.#themeManager = themeManager;
  }

  start(): void {
    this.setupPtyManager();
    ipc.on(Messages.CHANNEL_NAME, this._handleIpc.bind(this));
  }

  private setupPtyManager(): void {
    this.#ptyManager.onPtyData(event => {
      const senderId = this.#ptyToSenderMap.get(event.ptyId);
      if (senderId == null) {
        return;
      }
      const sender = webContents.fromId(senderId);
      if (sender == null || sender.isDestroyed()) {
        return;
      }
      const msg: Messages.PtyOutput = { type: Messages.MessageType.PTY_OUTPUT, id: event.ptyId, data: event.data };
      sender.send(Messages.CHANNEL_NAME, msg);
    });

    this.#ptyManager.onPtyExit(ptyId => {
      const senderId = this.#ptyToSenderMap.get(ptyId);
      if (senderId == null) {
        return;
      }
      const sender = webContents.fromId(senderId);
      if (sender == null || sender.isDestroyed()) {
        return;
      }

      const msg: Messages.PtyClose = { type: Messages.MessageType.PTY_CLOSE, id: ptyId };
      sender.send(Messages.CHANNEL_NAME, msg);
    });

    this.#ptyManager.onPtyAvailableWriteBufferSizeChange(event => {
      const senderId = this.#ptyToSenderMap.get(event.ptyId);
      const sender = webContents.fromId(senderId);
      if (sender != null && ! sender.isDestroyed()) {
        const msg: Messages.PtyInputBufferSizeChange = {
          type: Messages.MessageType.PTY_INPUT_BUFFER_SIZE_CHANGE,
          id: event.ptyId,
          totalBufferSize: event.bufferSizeChange.totalBufferSize,
          availableDelta:event.bufferSizeChange.availableDelta
        };
        sender.send(Messages.CHANNEL_NAME, msg);
      }
    });
  }

  cleanUpPtyWindow(webContentsId: number): void {
    const closedPtyList: number[] = [];

    for (const [ptyId, senderId] of this.#ptyToSenderMap) {
      if (webContentsId === senderId) {
        this.#ptyManager.closePty(ptyId);
        closedPtyList.push(ptyId);
      }
    }

    for (const ptyId of closedPtyList) {
      this.#ptyToSenderMap.delete(ptyId);
    }
  }

  sendBulkFileWriteBufferSizeEvent(event: BufferSizeEvent): void {
    const msg: Messages.BulkFileBufferSizeMessage = {
      type: Messages.MessageType.BULK_FILE_BUFFER_SIZE,
      identifier: event.identifier,
      totalBufferSize: event.totalBufferSize,
      availableDelta: event.availableDelta
    };
    this._sendMessageToAllWindows(msg);
  }

  sendBulkFileStateChangeEvent(event: CloseEvent): void {
    const msg: Messages.BulkFileStateMessage = {
      type: Messages.MessageType.BULK_FILE_STATE,
      identifier: event.identifier,
      state: event.success ? BulkFileState.COMPLETED : BulkFileState.FAILED
    };
    this._sendMessageToAllWindows(msg);
  }

  private _makeExtensionDesiredStateMessage(): Messages.ExtensionDesiredStateMessage {
    const msg: Messages.ExtensionDesiredStateMessage = {
      type: Messages.MessageType.EXTENSION_DESIRED_STATE,
      desiredState: this.#extensionManager.getDesiredState()
    };
    return msg;
  }

  sendExtensionDesiredStateMessage(): void {
    this._sendMessageToAllWindows(this._makeExtensionDesiredStateMessage());
  }

  sendDevToolStatus(window: Electron.BrowserWindow, open: boolean): void {
    const msg: Messages.DevToolsStatusMessage = { type: Messages.MessageType.DEV_TOOLS_STATUS, open: open };
    window.webContents.send(Messages.CHANNEL_NAME, msg);
  }

  sendCommandToAllWindows(commandName: string, args: any): void {
    const messageUuid = createUuid();
    const msg: Messages.ExecuteCommandMessage = {
      type: Messages.MessageType.EXECUTE_COMMAND_REQUEST,
      uuid: messageUuid,
      commandName,
      args
    };
    this._sendMessageToAllWindows(msg);
  }

  sendCommandToWindow(commandName: string, windowId: number, args: any): Promise<any> {
    const messageUuid = createUuid();
    const msg: Messages.ExecuteCommandMessage = {
      type: Messages.MessageType.EXECUTE_COMMAND_REQUEST,
      uuid: messageUuid,
      commandName,
      args
    };

    return new Promise((resolve, reject) => {
      const window = BrowserWindow.fromId(windowId);
      window.webContents.send(Messages.CHANNEL_NAME, msg);
      this.#waitingExecuteCommands.set(messageUuid, { resolve, reject });
    });
  }

  private _sendMessageToAllWindows(msg: Messages.Message): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (LOG_FINE) {
        this._log.debug("Broadcasting message to all windows");
      }
      window.webContents.send(Messages.CHANNEL_NAME, msg);
    }
  }

  private _handleCommandResponse(msg: Messages.ExecuteCommandResponseMessage): void {
    const promisePairFunctions = this.#waitingExecuteCommands.get(msg.uuid);

    if (msg.exception == null) {
      promisePairFunctions.resolve(msg.result);
    } else {
      promisePairFunctions.reject(msg.exception);
    }

    this.#waitingExecuteCommands.delete(msg.uuid);
  }

  private _handleIpc(event: Electron.IpcMainEvent, arg: any): void {
    const msg: Messages.Message = arg;
    let reply: Messages.Message = null;

    if (LOG_FINE) {
      this._log.debug(`Main IPC incoming: ${Messages.MessageType[msg.type]} => `,msg);
    }

    switch(msg.type) {
      case Messages.MessageType.BULK_FILE_CLOSE:
        this._handleCloseBulkFile(<Messages.BulkFileCloseMessage> msg);
        break;

      case Messages.MessageType.BULK_FILE_CREATE:
        const createBulkFileReply = this._handleCreateBulkFile(<Messages.BulkFileCreateMessage> msg);
        event.returnValue = createBulkFileReply;
        break;

      case Messages.MessageType.BULK_FILE_DEREF:
        this._handleDerefBulkFile(<Messages.BulkFileDerefMessage> msg);
        break;

      case Messages.MessageType.BULK_FILE_REF:
        this._handleRefBulkFile(<Messages.BulkFileRefMessage> msg);
        break;

      case Messages.MessageType.BULK_FILE_WRITE:
        this._handleWriteBulkFile(<Messages.BulkFileWriteMessage> msg);
        break;

      case Messages.MessageType.CLIPBOARD_READ_REQUEST:
        reply = this._handleClipboardReadRequest(<Messages.ClipboardReadRequestMessage> msg);
        break;

      case Messages.MessageType.CLIPBOARD_WRITE:
        this._handleClipboardWrite(<Messages.ClipboardWriteMessage> msg);
        break;

      case Messages.MessageType.CONFIG:
        this._handleConfig(<Messages.ConfigMessage> msg);
        break;

      case Messages.MessageType.CONFIG_REQUEST:
        reply = this._handleConfigRequest(<Messages.ConfigRequestMessage> msg);
        break;

      case Messages.MessageType.DEV_TOOLS_REQUEST:
        this._handleDevToolsRequest(event.sender, <Messages.DevToolsRequestMessage> msg);
        break;

      case Messages.MessageType.EXECUTE_COMMAND_RESPONSE:
        this._handleCommandResponse(<Messages.ExecuteCommandResponseMessage> msg);
        break;

      case Messages.MessageType.EXTENSION_DESIRED_STATE_REQUEST:
        event.returnValue = this._makeExtensionDesiredStateMessage();
        return;

      case Messages.MessageType.EXTENSION_DISABLE:
        this.#extensionManager.disableExtension((<Messages.ExtensionDisableMessage>msg).extensionName);
        break;

      case Messages.MessageType.EXTENSION_ENABLE:
        this.#extensionManager.enableExtension((<Messages.ExtensionEnableMessage>msg).extensionName);
        break;

      case Messages.MessageType.EXTENSION_METADATA_REQUEST:
        event.returnValue = this._handleExtensionMetadataRequest();
        return;

      case Messages.MessageType.FRAME_DATA_REQUEST:
        this._log.debug('Messages.MessageType.FRAME_DATA_REQUEST is not implemented.');
        break;

      case Messages.MessageType.GLOBAL_KEYBINDINGS_ENABLE:
        this._handleGlobalKeybindingsEnable(<Messages.GlobalKeybindingsEnableMessage>msg);
        break;

      case Messages.MessageType.KEYBINDINGS_READ_REQUEST:
        reply = this._handleKeybindingsReadRequest(<Messages.KeybindingsReadRequestMessage>msg);
        break;

      case Messages.MessageType.KEYBINDINGS_UPDATE:
        this._handleKeybindingsUpdate(<Messages.KeybindingsUpdateMessage>msg);
        break;

      case Messages.MessageType.NEW_TAG_REQUEST:
        const ntrm = <Messages.NewTagRequestMessage> msg;
        reply = this._handleNewTagRequest(ntrm);
        if (ntrm.async === false) {
          event.returnValue = reply;
          return;
        }
        break;

      case Messages.MessageType.NEW_WINDOW:
        this._handleNewWindow();
        break;

      case Messages.MessageType.PTY_CLOSE_REQUEST:
        this._handlePtyCloseRequest(<Messages.PtyClose> msg);
        break;

      case Messages.MessageType.PTY_CREATE:
        reply = this._handlePtyCreate(event.sender, <Messages.CreatePtyRequestMessage> msg);
        break;

      case Messages.MessageType.PTY_INPUT:
        this._handlePtyInput(<Messages.PtyInput> msg);
        break;

      case Messages.MessageType.PTY_OUTPUT_BUFFER_SIZE:
        this._handlePtyOutputBufferSize(<Messages.PtyOutputBufferSize> msg);
        break;

      case Messages.MessageType.PTY_RESIZE:
        this._handlePtyResize(<Messages.PtyResize> msg);
        break;

      case Messages.MessageType.PTY_GET_WORKING_DIRECTORY_REQUEST:
        this._handlePtyGetWorkingDirectory(<Messages.PtyGetWorkingDirectoryRequest> msg, event.sender);
        break;

      case Messages.MessageType.QUIT_APPLICATION_REQUEST:
        this.sendQuitApplicationRequest();
        break;

      case Messages.MessageType.THEME_CONTENTS_REQUEST:
        this._handleThemeContentsRequest(event.sender, <Messages.ThemeContentsRequestMessage> msg);
        break;

      case Messages.MessageType.THEME_LIST_REQUEST:
        reply = this._handleThemeListRequest();
        break;

      case Messages.MessageType.THEME_RESCAN:
        reply = this._handleThemeRescan();
        break;

      case Messages.MessageType.WINDOW_CLOSE_REQUEST:
        const window = BrowserWindow.fromWebContents(event.sender);
        window.close();
        break;

      case Messages.MessageType.WINDOW_MAXIMIZE_REQUEST:
        const mainWindow = BrowserWindow.fromWebContents(event.sender);
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        break;

      case Messages.MessageType.WINDOW_MINIMIZE_REQUEST:
        this.#mainDesktop.minimizeAllWindows();
        break;

      case Messages.MessageType.WINDOW_SHOW_REQUEST:
        this._handleWindowShowRequest(event.sender);
        break;

      case Messages.MessageType.TERMINAL_THEME_REQUEST:
        this._handleTerminalThemeRequest(event.sender, <Messages.TerminalThemeRequestMessage>msg);
        break;

      default:
        break;
    }

    if (reply !== null) {
      if (LOG_FINE) {
        this._log.debug("Replying: ", reply);
      }
      event.sender.send(Messages.CHANNEL_NAME, reply);
    }
  }

  private _handleConfig(msg: Messages.ConfigMessage): void {
    if (LOG_FINE) {
      this._log.debug("Incoming new config: ", msg);
    }
    this.#configDatabase.setConfig(msg.key, msg.config);
  }

  private _handleConfigRequest(msg: Messages.ConfigRequestMessage): Messages.ConfigMessage {
    const reply: Messages.ConfigMessage = {
      type: Messages.MessageType.CONFIG,
      key: msg.key,
      config: this.#configDatabase.getConfig(msg.key)
    };
    return reply;
  }

  sendQuitApplicationRequest(): void {
    const msg: Messages.QuitApplicationMessage = {
      type: Messages.MessageType.QUIT_APPLICATION,
    };
    this._sendMessageToAllWindows(msg);
  }

  private _handleNewWindow(): void {
    this.#mainDesktop.openWindow();
  }

  private _handleThemeListRequest(): Messages.ThemeListMessage {
    const reply: Messages.ThemeListMessage = {
      type: Messages.MessageType.THEME_LIST,
      themeInfo: this.#themeManager.getAllThemes()
    };
    return reply;
  }

  private async _handleThemeContentsRequest(webContents: Electron.WebContents,
    msg: Messages.ThemeContentsRequestMessage): Promise<void> {

    const globalVariables: GlobalVariableMap = new Map();

    const generalConfig = <GeneralConfig> this.#configDatabase.getConfig(GENERAL_CONFIG);
    globalVariables.set("extraterm-gpu-driver-workaround", generalConfig.gpuDriverWorkaround);
    globalVariables.set("extraterm-titlebar-style", generalConfig.titleBarStyle);
    globalVariables.set("extraterm-platform", process.platform);
    globalVariables.set("extraterm-margin-style", generalConfig.terminalMarginStyle);
    globalVariables.set("extraterm-window-background-mode", generalConfig.windowBackgroundMode);
    globalVariables.set("extraterm-window-background-transparency-percent",
      generalConfig.windowBackgroundTransparencyPercent);

    try {
      const renderResult = await this.#themeManager.render(msg.themeType, globalVariables);

      const themeContents = renderResult.themeContents;
      const reply: Messages.ThemeContentsMessage = {
        type: Messages.MessageType.THEME_CONTENTS,
        themeType: msg.themeType,
        themeContents: themeContents,
        success: true,
        errorMessage: renderResult.errorMessage
      };
      webContents.send(Messages.CHANNEL_NAME, reply);

    } catch(err) {
      const reply: Messages.ThemeContentsMessage = {
        type: Messages.MessageType.THEME_CONTENTS,
        themeType: msg.themeType,
        themeContents: null,
        success: false,
        errorMessage: err.message
      };
      webContents.send(Messages.CHANNEL_NAME, reply);
    }
  }

  private _handleThemeRescan(): Messages.ThemeListMessage {
    this.#themeManager.rescan();

    const userStoredConfig = this.#configDatabase.getConfigCopy(GENERAL_CONFIG);
    if ( ! isThemeType(this.#themeManager.getTheme(userStoredConfig.themeSyntax), 'syntax')) {
      userStoredConfig.themeSyntax = ThemeTypes.FALLBACK_SYNTAX_THEME;
      this.#configDatabase.setConfig(GENERAL_CONFIG, userStoredConfig);
    }

    return this._handleThemeListRequest();
  }

  private _handleTerminalThemeRequest(webContents: Electron.WebContents,
      msg: Messages.TerminalThemeRequestMessage): void {

    const terminalTheme = this.#themeManager.getTerminalTheme(msg.id);
    const reply: Messages.TerminalThemeMessage = {
      type: Messages.MessageType.TERMINAL_THEME,
      terminalTheme
    };

    webContents.send(Messages.CHANNEL_NAME, reply);
  }

  private async _handleWindowShowRequest(sender: Electron.WebContents): Promise<void> {
    const callerWindow = BrowserWindow.fromWebContents(sender);
    await this.#mainDesktop.restoreWindow(callerWindow.id);

    const reply: Messages.WindowShowResponseMessage = {
      type: Messages.MessageType.WINDOW_SHOW_RESPONSE,
    };

    sender.send(Messages.CHANNEL_NAME, reply);
  }

  private _handlePtyCreate(sender: Electron.WebContents,
      msg: Messages.CreatePtyRequestMessage): Messages.CreatedPtyMessage {

    const ptyId = this.#ptyManager.createPty(msg.sessionUuid, msg.sessionOptions);
    this._log.debug(`handlePtyCreate ptyId: ${ptyId}, sender.id: ${sender.id}`);
    this.#ptyToSenderMap.set(ptyId, sender.id);
    const reply: Messages.CreatedPtyMessage = { type: Messages.MessageType.PTY_CREATED, id: ptyId };
    return reply;
  }

  private _handlePtyInput(msg: Messages.PtyInput): void {
    this.#ptyManager.ptyInput(msg.id, msg.data);
  }

  private _handlePtyOutputBufferSize(msg: Messages.PtyOutputBufferSize): void {
    this.#ptyManager.ptyOutputBufferSize(msg.id, msg.size);
  }

  private _handlePtyResize(msg: Messages.PtyResize): void {
    this.#ptyManager.ptyResize(msg.id, msg.columns, msg.rows);
  }

  private _handlePtyCloseRequest(msg: Messages.PtyCloseRequest): void {
    this.#ptyManager.closePty(msg.id);
  }

  private async _handlePtyGetWorkingDirectory(msg: Messages.PtyGetWorkingDirectoryRequest,
      sender: Electron.WebContents): Promise<void> {

    const workingDirectory = await this.#ptyManager.ptyGetWorkingDirectory(msg.id);

    const reply: Messages.PtyGetWorkingDirectory = {
      type: Messages.MessageType.PTY_GET_WORKING_DIRECTORY,
      id: msg.id,
      workingDirectory
    };

    if (LOG_FINE) {
      this._log.debug("Replying: ", reply);
    }
    sender.send(Messages.CHANNEL_NAME, reply);
  }

  private _handleDevToolsRequest(sender: Electron.WebContents, msg: Messages.DevToolsRequestMessage): void {
    if (msg.open) {
      sender.openDevTools();
    } else {
      sender.closeDevTools();
    }
  }

  private _handleClipboardWrite(msg: Messages.ClipboardWriteMessage): void {
    if (msg.text.length !== 0) {
      clipboard.writeText(msg.text);
    }
  }

  private _handleClipboardReadRequest(msg: Messages.ClipboardReadRequestMessage): Messages.ClipboardReadMessage {
    const text = clipboard.readText(msg.clipboardType);
    const reply: Messages.ClipboardReadMessage = { type: Messages.MessageType.CLIPBOARD_READ, text: text };
    return reply;
  }

  private _handleNewTagRequest(msg: Messages.NewTagRequestMessage): Messages.NewTagMessage {
    const reply: Messages.NewTagMessage = { type: Messages.MessageType.NEW_TAG, tag: "" + this.#tagCounter };
    this.#tagCounter++;
    return reply;
  }

  private _handleCreateBulkFile(msg: Messages.BulkFileCreateMessage): Messages.BulkFileCreatedResponseMessage {
    const {identifier, url} = this.#bulkFileStorage.createBulkFile(msg.metadata, msg.size);
    const reply: Messages.BulkFileCreatedResponseMessage = {
      type: Messages.MessageType.BULK_FILE_CREATED,
      identifier,
      url
    };
    return reply;
  }

  private _handleWriteBulkFile(msg: Messages.BulkFileWriteMessage): void {
    this.#bulkFileStorage.write(msg.identifier, msg.data);
  }

  private _handleCloseBulkFile(msg: Messages.BulkFileCloseMessage): void {
    this.#bulkFileStorage.close(msg.identifier, msg.success);
  }

  private _handleRefBulkFile(msg: Messages.BulkFileRefMessage): void {
    this.#bulkFileStorage.ref(msg.identifier);
  }

  private _handleDerefBulkFile(msg: Messages.BulkFileDerefMessage): void {
    this.#bulkFileStorage.deref(msg.identifier);
  }

  private _handleExtensionMetadataRequest(): Messages.ExtensionMetadataMessage {
    return {
      type: Messages.MessageType.EXTENSION_METADATA,
      extensionMetadata: this.#extensionManager.getExtensionMetadata()
    };
  }

  private _handleKeybindingsReadRequest(msg: Messages.KeybindingsReadRequestMessage): Messages.KeybindingsReadMessage {
    const stackedKeybindingsFile = this.#keybindingsIOManager.getStackedKeybindings(msg.name);
    const reply: Messages.KeybindingsReadMessage = {
      type: Messages.MessageType.KEYBINDINGS_READ,
      stackedKeybindingsFile
    };
    return reply;
  }

  private _handleKeybindingsUpdate(msg: Messages.KeybindingsUpdateMessage): void {
    this.#keybindingsIOManager.updateCustomKeybindingsFile(msg.customKeybindingsSet);
  }

  private _handleGlobalKeybindingsEnable(msg: Messages.GlobalKeybindingsEnableMessage): void {
    this.#globalKeybindingsManager.setEnabled(msg.enabled);
  }
}
