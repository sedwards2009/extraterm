/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

import Config = require('config');

export enum MessageType {
  REQUEST_FRAME,
  FRAME_DATA,
  CONFIG
}

export interface Message {
  type: MessageType;
}

export interface MessageRequestFrame extends Message {
  frameTag: string;
}

export interface MessageFrameData extends Message {
  frameTag: string;
  frameHTML: string;
}

export interface MessageConfig extends Message {
  config: Config;
}
