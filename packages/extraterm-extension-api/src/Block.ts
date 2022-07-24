/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
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
   * contain a `TerminalDetails` object.
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

  hasSelection(): boolean;

  /**
   * True if this block of terminal output still exists.
   */
  readonly isAlive: boolean;
}

/**
 *
 *
 */
export interface ExtensionBlock {
  contentWidget: QWidget;
  bulkFile: BulkFileHandle;

  readonly metadata: BlockMetadata;
  updateMetadata(change: BlockMetadataChange): void;

  readonly terminal: Terminal;
  //details: any;
  // TODO: A way of exposing methods to on a block to other extensions/commands.
}
