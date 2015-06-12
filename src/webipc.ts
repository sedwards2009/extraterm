/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

///<reference path="typings/github-electron/github-electron-renderer.d.ts" />

import rendererIpc = require('ipc');
import Messages = require('./windowmessages');

// There are two related 'ipc' modules in Electron. A main process one and a renderer process one.
// 'ipc' tends to get the main process defs when it should be the renderer process defs.
const ipc = <GitHubElectron.InProcess> rendererIpc;

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

function handleAsyncIpc(event: any, arg: any): void {
  const msg: Messages.Message = event;
// console.log("IPC incoming: ", msg);

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
  ipc.send(Messages.CHANNEL_NAME, msg);
  return new Promise<Messages.Message>( (resolve,cancel) => {
    promiseQueue.push( { promiseResolve: resolve, messageType: replyType } );
  });
}

export function requestConfig(): Promise<Messages.ConfigMessage> {
  const msg: Messages.ConfigRequestMessage = {type: Messages.MessageType.CONFIG_REQUEST};
  return request(msg, Messages.MessageType.CONFIG);
}

export function requestThemes(): Promise<Messages.ThemesMessage> {
  const msg: Messages.ThemesRequestMessage = {type: Messages.MessageType.THEMES_REQUEST};
  return request(msg, Messages.MessageType.THEMES);
}

export function requestPtyCreate(command: string, args: string[], columns: number, rows: number,
    env: Messages.EnvironmentMap): Promise<Messages.CreatedPtyMessage> {
      
  const msg: Messages.CreatePtyRequestMessage = {
    type: Messages.MessageType.PTY_CREATE,
    command: command,
    args: args,
    columns: columns,
    rows: rows,
    env: env
  };
  return request(msg, Messages.MessageType.PTY_CREATED);
}

export function ptyInput(id: number, data: string): void {
  const msg: Messages.PtyInput = {type: Messages.MessageType.PTY_INPUT, id: id, data: data };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function ptyResize(id: number, columns: number, rows: number): void {
  const msg: Messages.PtyResize = {type: Messages.MessageType.PTY_RESIZE, id: id, columns: columns, rows: rows };
  ipc.send(Messages.CHANNEL_NAME, msg);
}

export function ptyClose(id: number): void {
  const msg: Messages.PtyClose = {type: Messages.MessageType.PTY_CLOSE, id: id };
  ipc.send(Messages.CHANNEL_NAME, msg);
}
