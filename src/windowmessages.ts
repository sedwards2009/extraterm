/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

import config = require('./config');
import Theme = require('./theme');

export const CHANNEL_NAME = "async-message";

export const enum MessageType {
  CONFIG_REQUEST,
  CONFIG,
  FRAME_DATA_REQUEST,
  FRAME_DATA,
  THEMES_REQUEST,
  THEMES,
  PTY_CREATE,
  PTY_CREATED,
  PTY_RESIZE,
  PTY_OUTPUT,
  PTY_INPUT,
  PTY_CLOSE,
  PTY_CLOSE_REQUEST,
  DEV_TOOLS_REQUEST,
  DEV_TOOLS_STATUS,
  CLIPBOARD_WRITE,
  CLIPBOARD_READ_REQUEST,
  CLIPBOARD_READ,
  WINDOW_CLOSE_REQUEST,
  NEW_TAG_REQUEST,
  NEW_TAG
}

export interface Message {
  type: MessageType;
}

export interface ConfigRequestMessage extends Message {

}

export interface ConfigMessage extends Message {
  config: config.Config;
}

export interface FrameDataRequestMessage extends Message {
  frameTag: string;
}

export interface FrameDataMessage extends Message {
  frameTag: string;
  frameHTML: string;
}

export interface ThemesRequestMessage extends Message {
  
}

export interface ThemesMessage extends Message {
  themes: Theme[];

}

// ********************************************************************
// Pty related messages.
export interface EnvironmentMap {
  [key: string]: string;
}

export interface CreatePtyRequestMessage extends Message {
  command: string;
  args: string[];
  columns: number;
  rows: number;
  env: EnvironmentMap;
}

export interface CreatedPtyMessage extends Message {
  id: number;
}

export interface PtyResize extends Message {
  id: number;
  columns: number;
  rows: number;
}

export interface PtyOutput extends Message {
  id: number;
  data: string;
}

export interface PtyInput extends Message {
  id: number;
  data: string;
}

export interface PtyClose extends Message {
  id: number;
}

export interface PtyCloseRequest extends Message {
  id: number;
}
// ********************************************************************

export interface DevToolsRequestMessage extends Message {
  open: boolean;
}

export interface DevToolsStatusMessage extends Message {
  open: boolean;
}

export interface ClipboardWriteMessage extends Message {
  text: string; // Text to be placed on the clipboard.
}

export interface ClipboardReadRequestMessage extends Message {
}

export interface ClipboardReadMessage extends Message {
  text: string;
}

export interface WindowCloseRequestMessage extends Message {  
}

export interface NewTagRequestMessage extends Message {
  async: boolean;
}

export interface NewTagMessage extends Message {
  tag: string;
}
