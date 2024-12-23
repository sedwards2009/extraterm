/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QWidget } from "@nodegui/nodegui";
import { BulkFileHandle } from "./BulkFiles.js";
import { Screen } from "./Screen.js";
import { Terminal } from "./Terminal.js";


export enum BlockPosture {
  NEUTRAL,
  RUNNING,
  SUCCESS,
  FAILURE,
}

export interface BlockMetadata {
  readonly title: string;
  readonly icon: string;
  readonly posture: BlockPosture;
  readonly moveable: boolean;
  readonly deleteable: boolean;
}

export type BlockMetadataChange = { -readonly [K in keyof BlockMetadata]?: BlockMetadata[K] };


/**
 * A block of content stacking inside a terminal.
 *
 * This includes terminal out, image viewers, frames, and other things.
 */
export interface Block {
  /**
   * Identifies this type of block.
   *
   * For terminal output and current block receiving terminal output, this
   * string will be equal to `TerminalType`, and the `details` field will
   * contain a `TerminalOutputDetails` object.
   */
  readonly type: string;

  /**
   * Type specific details and methods for this block.
   */
  readonly details: any;

  /**
   * The Terminal this block is on.
   */
  readonly terminal: Terminal;

  readonly geometry: BlockGeometry;

  readonly metadata: BlockMetadata;
}

export interface BlockGeometry {
  readonly positionTop: number
  readonly height: number;
  readonly titleBarHeight: number;
}

/**
 * Identifies a `Block` of type terminal output in the `Block.type` field.
 */
export const TerminalOutputType = "extraterm:terminal-output";

/**
 * Terminal output specific details and methods.
 *
 * This object is present in `Block.details` when a block's `type` is
 * equal to `TerminalType`.
 *
 * Some methods return row contents in the form of a normal JavaScript string.
 * Note that there isn't a simple one to one correspondence between
 * 'characters' / values in a string and cells in the terminal. JavaScript
 * strings are an array of 16bit (UTF16) values but Unicode has a 32bit range.
 * Multiple 16bit values can map to one Unicode codepoint. Also, characters
 * inside the terminal can be one cell wide or two cells wide.
 */
export interface TerminalOutputDetails {
  /**
   * True if this output viewer is connected to a live PTY and emulator.
   *
   * @return true if this output viewer is connected to a live PTY and emulator.
   */
  readonly hasPty: boolean;

  readonly scrollback: Screen;

  readonly returnCode: number | null;

  readonly commandLine: string;

  readonly hasSelection: boolean;

  /**
   * True if this block of terminal output still exists.
   */
  readonly isAlive: boolean;

  /**
   * Map a vertical position to a row number inside this block.
   *
   * The result object indicates if the position is above or below the block,
   * of maps to a row within the screen or scrollback.
   *
   * @param position Vertical position with in the whole terminal.
   * @return PositionToRowResult object.
   */
  positionToRow(position: number): PositionToRowResult;

  rowToPosition(row: number, where: RowPositionType): number;

  /**
   * Height of a row in pixels.
   */
  readonly rowHeight: number;
}

export enum RowPositionType {
  /**
   * The position is above the block.
   */
  ABOVE,

  /**
   * The position maps to a row within the scrollback inside the block.
   */
  IN_SCROLLBACK,

  /**
   * The position maps to a row within the screen being shown inside the block.
   */
  IN_SCREEN,

  /**
   * The position is completely below the block.
   */
  BELOW
}

export interface PositionToRowResult {
  /**
   * Where the position mapped to relative to the block.
   */
  where: RowPositionType;

  /**
   * The corresponding row. This is only valid if the position maps inside the block.
   */
  row: number;
}

/**
 * Interface to a Block instance for performing customization.
 *
 * When a custom block is created, its extension is provided with an instance
 * of this interface. Extensions can then use this object to set the contents
 * of the block to display, access any bulk file associated with the block,
 * etc and to generally customize the block to implement their own custom
 * block types.
 */
export interface ExtensionBlock {
  /**
   * The `QWidget` contents of the block.
   *
   * Extensions should create their own `QWidget` instance and assign it to this field.
   */
  contentWidget: QWidget;

  /**
   * The bulk file associated with this block.
   *
   * This may be null if the block was not created in response to a file download.
   */
  bulkFile: BulkFileHandle;

  /**
   * Metadata describing the block.
   *
   * This metadata is shown in the frame surrounding the block.
   */
  readonly metadata: BlockMetadata;

  /**
   * Method of modify some or all of the metadata fields.
   */
  updateMetadata(change: BlockMetadataChange): void;

  /**
   * The terminal which contains this block.
   */
  readonly terminal: Terminal;

  /**
   * An object holding custom details specific to this block.
   *
   * Extensions can create an object and assign it to this field. This object
   * will then be available to other extensions via the `details` field on the
   * `Block` interface. The object can contain any valid JavaScript value
   * including functions.
   */
  details: any;
}
