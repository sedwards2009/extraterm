/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

import Config = require('config');
import Theme = require('theme');

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
  PTY_CLOSE
}

export interface Message {
  type: MessageType;
}

export interface ConfigRequestMessage extends Message {

}

export interface ConfigMessage extends Message {
  config: Config;
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

