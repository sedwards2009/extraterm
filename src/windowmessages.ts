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
  THEMES
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
