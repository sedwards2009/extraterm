/*
 * Copyright 2014-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { BulkFileMetadata, CreateSessionOptions } from '@extraterm/extraterm-extension-api';
import * as Electron from 'electron';
const ipc = Electron.ipcRenderer;

import {BulkFileIdentifier} from '../main_process/bulk_file_handling/BulkFileStorage';
import * as Messages from '../WindowMessages';
import * as config from '../Config';
import { Logger, getLogger } from "extraterm-logging";
import { ExtensionMetadata, ExtensionDesiredState } from '../ExtensionMetadata';
import { ThemeType } from '../theme/Theme';
import { LogicalKeybindingsName, CustomKeybindingsSet } from '../keybindings/KeybindingsTypes';
import { ClipboardType } from '../WindowMessages';
import * as SharedMap from "../shared_map/SharedMap";

const _log = getLogger("WebIPC");

const DEBUG = false;
const DEBUG_INCOMING = false;
const DEBUG_OUTGOING = false;

/**
 * Start IPC.
 */
export function start(): void {
  ipc.on(Messages.CHANNEL_NAME, handleAsyncIpc);
}

type ResolveFunc = (msg: Messages.Message) => void;

// This queue is used to route incoming IPC messages to expectant promise objects.
let promiseQueue: {promiseResolve: ResolveFunc, messageType: Messages.MessageType}[] = [];

export type Handler = (msg: Messages.Message) => void;
const defaultHandlers: { messageType: Messages.MessageType, handler: Handler }[] = [];

/**
 * Register a default handler for a message type
 *
 * @param type    the message type this handler should be used for.
 * @param handler the handler itself.
 */
export function registerDefaultHandler(type: Messages.MessageType, handler: Handler): void {
  defaultHandlers.push( { messageType: type, handler: handler} );
}

function handleAsyncIpc(senderInfo: any, detail: any): void {
  const msg: Messages.Message = detail;
  if (DEBUG_INCOMING) {
    _log.debug(`incoming: ${Messages.MessageType[msg.type]} => `, msg);
  }

  const matchingPromises = promiseQueue.filter( p => p.messageType === msg.type );
  const nonMatchingPromises = promiseQueue.filter( p => p.messageType !== msg.type );
  promiseQueue = nonMatchingPromises;

  matchingPromises.forEach( tup => {
    tup.promiseResolve(msg);
  });

  if (matchingPromises.length === 0) {
    // Fall back on the default handlers.
    defaultHandlers.filter( tup => tup.messageType === msg.type ).forEach( tup => {
      tup.handler(msg);
    });
  }
}

function request(msg: Messages.Message, replyType: Messages.MessageType): Promise<Messages.Message> {
  if (DEBUG_OUTGOING) {
    _log.debug("request: ${Messages.MessageType[msg.type]} => ", msg);
  }
  ipc.send(Messages.CHANNEL_NAME, msg);
  return new Promise<Messages.Message>( (resolve, cancel) => {
    promiseQueue.push( { promiseResolve: resolve, messageType: replyType } );
  });
}

export function requestConfig(key: config.ConfigKey): Promise<Messages.ConfigMessage> {
  const msg: Messages.ConfigRequestMessage = {type: Messages.MessageType.CONFIG_REQUEST, key};
  return <Promise<Messages.ConfigMessage>> request(msg, Messages.MessageType.CONFIG);
}

export function requestThemeList(): Promise<Messages.ThemeListMessage> {
  const msg: Messages.ThemeListRequestMessage = {type: Messages.MessageType.THEME_LIST_REQUEST};
  return <Promise<Messages.ThemeListMessage>> request(msg, Messages.MessageType.THEME_LIST);
}

export function requestThemeContents(themeType: ThemeType): Promise<Messages.ThemeContentsMessage> {
  if (DEBUG) {
    _log.debug("requestThemeContents(): ", themeType);
  }
  const msg: Messages.ThemeContentsRequestMessage = {
    type: Messages.MessageType.THEME_CONTENTS_REQUEST,
    themeType
  };
  return <Promise<Messages.ThemeContentsMessage>> request(msg, Messages.MessageType.THEME_CONTENTS);
}

export function rescanThemes(): void {
  const msg: Messages.ThemeRescan = {type: Messages.MessageType.THEME_RESCAN };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function requestPtyCreate(sessionUuid: string, sessionOptions: CreateSessionOptions): Promise<Messages.CreatedPtyMessage> {
  const msg: Messages.CreatePtyRequestMessage = {
    type: Messages.MessageType.PTY_CREATE,
    sessionUuid,
    sessionOptions
  };
  return <Promise<Messages.CreatedPtyMessage>> request(msg, Messages.MessageType.PTY_CREATED);
}

export function ptyInput(id: number, data: string): void {
  const msg: Messages.PtyInput = {type: Messages.MessageType.PTY_INPUT, id: id, data: data };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function ptyOutputBufferSize(id: number, size: number): void {
  const msg: Messages.PtyOutputBufferSize = {type: Messages.MessageType.PTY_OUTPUT_BUFFER_SIZE, id, size };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function ptyResize(id: number, columns: number, rows: number): void {
  const msg: Messages.PtyResize = {type: Messages.MessageType.PTY_RESIZE, id: id, columns: columns, rows: rows };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function ptyClose(id: number): void {
  const msg: Messages.PtyCloseRequest = {type: Messages.MessageType.PTY_CLOSE_REQUEST, id: id };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export async function ptyGetWorkingDirectory(id: number): Promise<string> {
  const msg: Messages.PtyGetWorkingDirectoryRequest = {
    type: Messages.MessageType.PTY_GET_WORKING_DIRECTORY_REQUEST,
    id
  };
  const response = <Messages.PtyGetWorkingDirectory> await request(msg, Messages.MessageType.PTY_GET_WORKING_DIRECTORY);
  return response.workingDirectory;
}

export function devToolsRequest(open: boolean): void {
  const msg: Messages.DevToolsRequestMessage = { type: Messages.MessageType.DEV_TOOLS_REQUEST, open: open };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function clipboardWrite(text: string): void {
  const msg: Messages.ClipboardWriteMessage = { type: Messages.MessageType.CLIPBOARD_WRITE, text: text };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function clipboardReadRequest(clipboardType=ClipboardType.DEFAULT): void {
  const msg: Messages.ClipboardReadRequestMessage = {
    type: Messages.MessageType.CLIPBOARD_READ_REQUEST,
    clipboardType
  };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function windowCloseRequest(): void {
  const msg: Messages.WindowCloseRequestMessage = { type: Messages.MessageType.WINDOW_CLOSE_REQUEST };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function sendConfig(key: config.ConfigKey, config: any): void {
  const msg: Messages.ConfigMessage = { type: Messages.MessageType.CONFIG, key, config };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function requestNewTag(): Promise<Messages.NewTagMessage> {
  const msg: Messages.NewTagRequestMessage = {type: Messages.MessageType.NEW_TAG_REQUEST, async: true};
  return <Promise<Messages.NewTagMessage>> request(msg, Messages.MessageType.NEW_TAG);
}

export function requestNewTagSync(): string {
  const msg: Messages.NewTagRequestMessage = {type: Messages.MessageType.NEW_TAG_REQUEST, async: false};
  const event = <any> ipc.sendSync(Messages.CHANNEL_NAME, msg);
  const newTagMessage = <Messages.NewTagMessage> event;
  return newTagMessage.tag;
}

export function windowMinimizeRequest(): void {
  const msg: Messages.WindowMinimizeRequestMessage = { type: Messages.MessageType.WINDOW_MINIMIZE_REQUEST };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function windowMaximizeRequest(): void {
  const msg: Messages.WindowMaximizeRequestMessage = { type: Messages.MessageType.WINDOW_MAXIMIZE_REQUEST };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function windowShowRequst(): Promise<Messages.WindowShowResponseMessage> {
  const msg: Messages.WindowShowRequestMessage = { type: Messages.MessageType.WINDOW_SHOW_REQUEST };
  return <Promise<Messages.WindowShowResponseMessage>> request(msg, Messages.MessageType.WINDOW_SHOW_RESPONSE);
}

export function windowReady(): void {
  const msg: Messages.WindowReadyMessage = { type: Messages.MessageType.WINDOW_READY };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function createBulkFileSync(metadata: BulkFileMetadata, size: number): {identifier: BulkFileIdentifier, url: string} {
  const msg: Messages.BulkFileCreateMessage = {type: Messages.MessageType.BULK_FILE_CREATE, metadata, size};
  const event = <any> ipc.sendSync(Messages.CHANNEL_NAME, msg);
  const createdBulkFileMessage = <Messages.BulkFileCreatedResponseMessage> event;
  return {identifier: createdBulkFileMessage.identifier, url: createdBulkFileMessage.url};
}

export function writeBulkFile(identifier: BulkFileIdentifier, data: Buffer): void {
  const msg: Messages.BulkFileWriteMessage = {type: Messages.MessageType.BULK_FILE_WRITE, identifier, data};
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function closeBulkFile(identifier: BulkFileIdentifier, success: boolean): void {
  const msg: Messages.BulkFileCloseMessage = {type: Messages.MessageType.BULK_FILE_CLOSE, identifier, success};
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function refBulkFile(identifier: BulkFileIdentifier): void {
  const msg: Messages.BulkFileRefMessage = {type: Messages.MessageType.BULK_FILE_REF, identifier};
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function derefBulkFile(identifier: BulkFileIdentifier): void {
  const msg: Messages.BulkFileDerefMessage = {type: Messages.MessageType.BULK_FILE_DEREF, identifier};
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function requestExtensionMetadataSync(): ExtensionMetadata[] {
  const msg: Messages.ExtensionMetadataRequestMessage = {type: Messages.MessageType.EXTENSION_METADATA_REQUEST};
  const event = <any> ipc.sendSync(Messages.CHANNEL_NAME, msg);
  const extensionMetadataMessage = <Messages.ExtensionMetadataMessage> event;
  return extensionMetadataMessage.extensionMetadata;
}

export function requestExtensionDesiredStateSync(): ExtensionDesiredState {
  const msg: Messages.ExtensionDesiredStateRequestMesssage = {type: Messages.MessageType.EXTENSION_DESIRED_STATE_REQUEST};
  const event = <any> ipc.sendSync(Messages.CHANNEL_NAME, msg);
  const extensionDesriedStateMessage = <Messages.ExtensionDesiredStateMessage> event;
  return extensionDesriedStateMessage.desiredState;
}

export function enableExtension(extensionName: string): void {
  const msg: Messages.ExtensionEnableMessage = {type: Messages.MessageType.EXTENSION_ENABLE, extensionName};
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function disableExtension(extensionName: string): void {
  const msg: Messages.ExtensionDisableMessage = {type: Messages.MessageType.EXTENSION_DISABLE, extensionName};
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function keybindingsRequestRead(name: LogicalKeybindingsName): Promise<Messages.KeybindingsReadMessage> {
  const msg: Messages.KeybindingsReadRequestMessage = {
    type: Messages.MessageType.KEYBINDINGS_READ_REQUEST,
    name
  };
  return <Promise<Messages.KeybindingsReadMessage>> request(msg, Messages.MessageType.KEYBINDINGS_READ);
}

export function customKeybindingsSetUpdate(customKeybindingsSet: CustomKeybindingsSet): void {
  const msg: Messages.KeybindingsUpdateMessage = {
    type: Messages.MessageType.KEYBINDINGS_UPDATE,
    customKeybindingsSet
  };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function enableGlobalKeybindings(enabled: boolean): void {
  const msg: Messages.GlobalKeybindingsEnableMessage = {type: Messages.MessageType.GLOBAL_KEYBINDINGS_ENABLE, enabled};
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function requestTerminalTheme(id: string): Promise<Messages.TerminalThemeMessage> {
  const msg: Messages.TerminalThemeRequestMessage = {
    type: Messages.MessageType.TERMINAL_THEME_REQUEST,
    id
  };
  return <Promise<Messages.TerminalThemeMessage>> request(msg, Messages.MessageType.TERMINAL_THEME);
}

export function requestQuitApplication(): void {
  const msg: Messages.QuitApplicationRequestMessage = {type: Messages.MessageType.QUIT_APPLICATION_REQUEST};
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function newWindow(): void {
  const msg: Messages.NewWindowMessage = { type: Messages.MessageType.NEW_WINDOW };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function commandResponse(uuid: string, result: any, exception: Error): void {
  const msg: Messages.ExecuteCommandResponseMessage = {
    type: Messages.MessageType.EXECUTE_COMMAND_RESPONSE,
    uuid,
    result,
    exception: exception?.message
  };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function sendSharedMapEvent(ev: SharedMap.ChangeEvent): void {
  const msg: Messages.SharedMapEventMessage = {
    type: Messages.MessageType.SHARED_MAP_EVENT,
    event: ev
  };
  ipc.send(Messages.CHANNEL_NAME, msg);
}
