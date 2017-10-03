/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Message formats for the IPC between the main process and render processes.
 */

import * as Config from './Config';
import * as ThemeTypes from './theme/Theme';
import {BulkFileIdentifier, Metadata} from './main_process/bulk_file_handling/BulkFileStorage';

type ThemeInfo = ThemeTypes.ThemeInfo;
type ThemeContents = ThemeTypes.ThemeContents;

/**
 * The name of the channel as required by Electron's ipc module calls.
 */
export const CHANNEL_NAME = "async-message";

/**
 * Every message has a `type` field which identifies the type of message. It is one of the values from this enum.
 */
export const enum MessageType {
  CONFIG_REQUEST,
  CONFIG,
  FRAME_DATA_REQUEST,
  FRAME_DATA,
  THEME_LIST_REQUEST,
  THEME_LIST,
  THEME_CONTENTS_REQUEST,
  THEME_CONTENTS,
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
  WINDOW_MINIMIZE_REQUEST,
  WINDOW_MAXIMIZE_REQUEST,
  NEW_TAG_REQUEST,
  NEW_TAG,
  PTY_OUTPUT_BUFFER_SIZE,

  CREATE_BULK_FILE,
  CREATED_BULK_FILE,
  WRITE_BULK_FILE,
  CLOSE_BULK_FILE
}

/**
 * Base for all message types.
 */
export interface Message {
  /**
   * Identifies this message type and the specific subinterface which it conforms to.
   */
  type: MessageType;
}

/**
 * A request from a render process to main requesting the configuration to be
 * sent. The response is a `ConfigMessage`.
 */
export interface ConfigRequestMessage extends Message {
}

/**
 * The current configuration.
 * 
 * This message sent from the main process to a render process and is often a
 * response to a ConfigRequestMessage.
 */
export interface ConfigMessage extends Message {
  /**
   * The current configuration.
   */
  config: Config.Config;
}

/**
 * Message sent from a render process to main to request the contents of a given frame.
 */
export interface FrameDataRequestMessage extends Message {
  frameTag: string;
}

/**
 * The contents of a frame.
 */
export interface FrameDataMessage extends Message {
  frameTag: string;
  frameHTML: string;
}

/**
 * Message sent from a render process to main to request the list of available themes.
 *
 * See `ThemeListRequestMessage`.
 */
export interface ThemeListRequestMessage extends Message {
  
}

/**
 * List of available themes.
 *
 * This is a response to a `ThemeListRequestMessage`.
 */
export interface ThemeListMessage extends Message {
  themeInfo: ThemeInfo[];
}

/**
 * Requests the contents of a theme.
 *
 * This is sent from a render process to main.
 *
 * See `ThemeContentsRequestMessage`.
 */
export interface ThemeContentsRequestMessage extends Message {
  themeIdList: string[];
  cssFileList: ThemeTypes.CssFile[];
}

/**
 * The contents of a theme.
 *
 * This is a response to `ThemeContentsRequestMessage`.
 */
export interface ThemeContentsMessage extends Message {
  themeIdList: string[];
  cssFileList: ThemeTypes.CssFile[];
  themeContents: ThemeContents; // is null in the case of errror.
  success: boolean;             // true if the render was successful, otherwise there was an error.
  errorMessage: string;         // contains the error message in the case of sucess=false, otherwise null.
}

// ********************************************************************
// Pty related messages.

export interface EnvironmentMap {
  [key: string]: string;
}

/**
 * Create PTY request message.
 *
 * This is sent from a render process to main to request the creation of a new
 * PTY and to start the given executable.
 *
 * See `CreatedPtyMessage`
 */
export interface CreatePtyRequestMessage extends Message {
  /**
   * The command or executable to run.
   */
  command: string;
  
  /**
   * List of string arguments which should be apssed to he command when starting it.
   */
  args: string[];
  
  /**
   * The width of the terminal screen/area in characters.
   */
  columns: number;
  
  /**
   * The height of the terminal screen/area in charactors or rows.
   */
  rows: number;
  
  /**
   * A map of key value pairs which will be used for the environment variables when starting the command.
   */
  env: EnvironmentMap;
}

/**
 * Signals the creation of a new PTY.
 */
export interface CreatedPtyMessage extends Message {
  /**
   * The ID of the new PTY.
   *
   * This ID is used to identify the PTY when sending other messages.
   */
  id: number;
}

/**
 * Signals a change of terminal screen/area size.
 *
 * Sent from a render process to main.
 */
export interface PtyResize extends Message {
  /**
   * The ID of the PTY this message refers to.
   */
  id: number;
  
  /**
   * The new number of columns in the terminal screen.
   */  
  columns: number;
  
  /**
   * The new height of the terminal screen in rows.
   */
  rows: number;
}

/**
 * Output generated from the PTY.
 *
 * This message is sent from the main process to a render process.
 */
export interface PtyOutput extends Message {
  /**
   * The ID of the PTY this message refers to.
   */
  id: number;
  
  /**
   * The output data from the PTY.
   */
  data: string;
}

/**
 * Notification regarding the amount of data from the PTY which can be accepted.
 * 
 * This message is sent from the render process to the main process. This is
 * more of an advisory than a hard limit.
 */
export interface PtyOutputBufferSize extends Message {
  /**
   * The ID of the PTY this message refers to.
   */
  id: number;

  /**
   * The size of the PTY output buffer in bytes.
   */
  size: number;
}

/**
 * Input to go to a PTY.
 *
 * This message is sent from a render process to the main process.
 */
export interface PtyInput extends Message {
  /**
   * The ID of the PTY this message refers to.
   */
  id: number;
  
  /**
   * The data to send to the PTY as input.  
   */
  data: string;
}

/**
 * Signals that a PTY has closed.
 *
 * This is sent from main to a render process.
 */
export interface PtyClose extends Message {
  /**
   * The ID of the PTY this message refers to.
   */
  id: number;
}

/**
 * Requests the closing of a PTY.
 *
 * This is sent from render process to main.
 */
export interface PtyCloseRequest extends Message {
  /**
   * The ID of the PTY this message refers to.
   */
  id: number;
}

// ********************************************************************
/**
 * Requests the opening or closing of the development tools window.
 */
export interface DevToolsRequestMessage extends Message {
  /**
   * True if the window should be open, otherwise closed.
   */
  open: boolean;
}

/**
 * Signal the status of the development tools window.
 *
 * This message is sent from the main process to a render process.
 */
export interface DevToolsStatusMessage extends Message {
  /**
   * True if the window is now open, otherwise false.
   */
  open: boolean;
}

/**
 * Write data to the clipboard.
 *
 * This is sent from a render process to main.
 */
export interface ClipboardWriteMessage extends Message {
   /**
    * Text to be placed on the clipboard.
    */
  text: string;
}

/**
 * Clipboard read request.
 *
 * This is sent from a render process to main to request the contents of the clipboard.
 * See ClipboardReadMessage.
 */
export interface ClipboardReadRequestMessage extends Message {
}

/**
 * Contents of the clipboard.
 *
 * This message is sent from the main process to a render process.
 * See `ClipboardReadRequestMessage`.
 */
export interface ClipboardReadMessage extends Message {
  /**
   * The textual contents of the clipboard.
   */
  text: string;
}

/**
 * Request the closing of a window.
 *
 * This is sent from a render process (and window) to the main process.
 */
export interface WindowCloseRequestMessage extends Message {  
}

/**
 * Request this window be minimized.
 *
 * This is sent from a render process (and window) to the main process.
 */
export interface WindowMinimizeRequestMessage extends Message {  
}

/**
 * Request this window be maximized.
 *
 * This is sent from a render process (and window) to the main process.
 */
export interface WindowMaximizeRequestMessage extends Message {  
}

/**
 * Requests a new tag value.
 *
 * Send from a render process to main. See `NewTagMessage`.
 */
export interface NewTagRequestMessage extends Message {
  /**
   * This flag is true If this message should be handled in an async way,
   * otherwise it should be replied to immediately.
   */
  async: boolean;
}

/**
 * A new tag value.
 *
 * This is in response to a `NewTagRequestMessage`.
 */
export interface NewTagMessage extends Message {
  tag: string;
}

export interface CreateBulkFileMessage extends Message {
  metadata: Metadata;
  size: number;
}

export interface CreatedBulkFileResponseMessage extends Message {
  identifier: BulkFileIdentifier;
}

export interface WriteBulkFileMessage extends Message {
  identifier: BulkFileIdentifier;
  // sequenceNumber: number;
  data: Buffer;
}

export interface CloseBulkFileMessage extends Message {
  identifier: BulkFileIdentifier;
}
