/*
 * Copyright 2014-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Message formats for the IPC between the main process and render processes.
 */

import { BulkFileMetadata, BulkFileState, EnvironmentMap, TerminalTheme, CreateSessionOptions } from '@extraterm/extraterm-extension-api';

import * as Config from './Config';
import {ThemeContents, ThemeInfo, ThemeType} from './theme/Theme';
import {BulkFileIdentifier} from './main_process/bulk_file_handling/BulkFileStorage';
import { ExtensionMetadata, ExtensionDesiredState } from './ExtensionMetadata';
import { CustomKeybindingsSet, LogicalKeybindingsName, StackedKeybindingsSet } from './keybindings/KeybindingsTypes';


/**
 * The name of the channel as required by Electron's ipc module calls.
 */
export const CHANNEL_NAME = "async-message";

/**
 * Every message has a `type` field which identifies the type of message. It is one of the values from this enum.
 */
export enum MessageType {
  BULK_FILE_BUFFER_SIZE,
  BULK_FILE_CLOSE,
  BULK_FILE_CREATE,
  BULK_FILE_CREATED,
  BULK_FILE_DEREF,
  BULK_FILE_REF,
  BULK_FILE_STATE,
  BULK_FILE_WRITE,
  CLIPBOARD_READ_REQUEST,
  CLIPBOARD_READ,
  CLIPBOARD_WRITE,
  CONFIG_REQUEST,
  CONFIG,
  CONFIG_BROADCAST,
  DEV_TOOLS_REQUEST,
  DEV_TOOLS_STATUS,
  EXECUTE_COMMAND,
  EXTENSION_DESIRED_STATE_REQUEST,
  EXTENSION_DESIRED_STATE,
  EXTENSION_DISABLE,
  EXTENSION_ENABLE,
  EXTENSION_METADATA_REQUEST,
  EXTENSION_METADATA,
  FRAME_DATA_REQUEST,
  FRAME_DATA,
  GLOBAL_KEYBINDINGS_ENABLE,
  KEYBINDINGS_READ_REQUEST,
  KEYBINDINGS_READ,
  KEYBINDINGS_UPDATE,
  NEW_TAG_REQUEST,
  NEW_TAG,
  NEW_WINDOW,
  PTY_CLOSE_REQUEST,
  PTY_CLOSE,
  PTY_CREATE,
  PTY_CREATED,
  PTY_INPUT_BUFFER_SIZE_CHANGE,
  PTY_INPUT,
  PTY_OUTPUT_BUFFER_SIZE,
  PTY_OUTPUT,
  PTY_RESIZE,
  QUIT_APPLICATION_REQUEST,
  QUIT_APPLICATION,
  TERMINAL_THEME_REQUEST,
  TERMINAL_THEME,
  THEME_CONTENTS_REQUEST,
  THEME_CONTENTS,
  THEME_LIST_REQUEST,
  THEME_LIST,
  THEME_RESCAN,
  WINDOW_CLOSE_REQUEST,
  WINDOW_MAXIMIZE_REQUEST,
  WINDOW_MINIMIZE_REQUEST,
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
  key: Config.ConfigKey;
}

/**
 * The current configuration.
 *
 * This message sent from the main process to a render process and is often a
 * response to a ConfigRequestMessage.
 */
export interface ConfigMessage extends Message {
  key: Config.ConfigKey;
  /**
   * The current configuration.
   */
  config: any;
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
 * Requests the rendered CSS.
 *
 * This is sent from a render process to main.
 *
 * See `ThemeContentsRequestMessage`.
 */
export interface ThemeContentsRequestMessage extends Message {
  themeType: ThemeType
}

/**
 * Rendered CSS files.
 *
 * This is a response to `ThemeContentsRequestMessage`.
 */
export interface ThemeContentsMessage extends Message {
  themeType: ThemeType;
  themeContents: ThemeContents; // is null in the case of errror.
  success: boolean;             // true if the render was successful, otherwise there was an error.
  errorMessage: string;         // contains the error message in the case of sucess=false, otherwise null.
}

export interface ThemeRescan extends Message {

}

// ********************************************************************
// Pty related messages.

/**
 * Create PTY request message.
 *
 * This is sent from a render process to main to request the creation of a new
 * PTY and to start the given executable.
 *
 * See `CreatedPtyMessage`
 */
export interface CreatePtyRequestMessage extends Message {
  sessionUuid: string;

  sessionOptions: CreateSessionOptions;
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

export interface PtyInputBufferSizeChange extends Message {
  id: number;

  totalBufferSize: number;
  availableDelta: number;
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

export interface BulkFileCreateMessage extends Message {
  metadata: BulkFileMetadata;
  size: number;
}

export interface BulkFileCreatedResponseMessage extends Message {
  identifier: BulkFileIdentifier;
  url: string;
}

export interface BulkFileWriteMessage extends Message {
  identifier: BulkFileIdentifier;
  // sequenceNumber: number;
  data: Buffer;
}

export interface BulkFileCloseMessage extends Message {
  identifier: BulkFileIdentifier;
  success: boolean;
}

export interface BulkFileBufferSizeMessage extends Message {
  identifier: BulkFileIdentifier;
  totalBufferSize: number;  // The total size of the receiving buffer for the bulk file.
  availableDelta: number;  // The change in the amount of available buffer.
}

export interface BulkFileRefMessage extends Message {
  identifier: BulkFileIdentifier;
}

export interface BulkFileDerefMessage extends Message {
  identifier: BulkFileIdentifier;
}

export interface BulkFileStateMessage extends Message {
  identifier: BulkFileIdentifier;
  state: BulkFileState;
}


export interface ExtensionMetadataRequestMessage extends Message {
}

export interface ExtensionMetadataMessage extends Message {
  extensionMetadata: ExtensionMetadata[];
}

export interface ExtensionDesiredStateRequestMesssage extends Message {
}

export interface ExtensionDesiredStateMessage extends Message {
  desiredState: ExtensionDesiredState;
}

export interface ExtensionEnableMessage extends Message {
  extensionName: string;
}

export interface ExtensionDisableMessage extends Message {
  extensionName: string;
}

//-------------------------------------------------------------------------
// Keybindings

export interface KeybindingsReadRequestMessage extends Message {
  name: LogicalKeybindingsName;
}

export interface KeybindingsReadMessage extends Message {
  stackedKeybindingsFile: StackedKeybindingsSet;
}

export interface KeybindingsUpdateMessage extends Message {
  customKeybindingsSet: CustomKeybindingsSet;
}

export interface GlobalKeybindingsEnableMessage extends Message {
  enabled: boolean;
}

//-------------------------------------------------------------------------

export interface TerminalThemeRequestMessage extends Message {
  id: string;
}

export interface TerminalThemeMessage extends Message {
  terminalTheme: TerminalTheme;
}

/**
 * Sent to the main process to indicate that the user wants to quit the whole app.
 */
export interface QuitApplicationRequestMessage extends Message {}

/**
 * Sent to each window telling it to quit and close immediately.
 */
export interface QuitApplicationMessage extends Message {}

/**
 * Sent to a window to execute a command.
 */
export interface ExecuteCommandMessage extends Message {
  commandName: string;
}

/**
 * Tell the main process to open a new window.
 */
export interface NewWindowMessage extends Message {

}
