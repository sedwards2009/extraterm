/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { Layer } from "term-api";
import { TerminalBlock } from "../../terminal/TerminalBlock.js";
import { ExtensionMetadata } from "../ExtensionMetadata.js";
import { LineImpl } from "term-api-lineimpl";
import { BlockFrame } from "../../terminal/BlockFrame.js";
import { QPoint, QWidget } from "@nodegui/nodegui";


export class TerminalOutputDetailsImpl implements ExtensionApi.TerminalOutputDetails {

  #scrollback: ExtensionApi.Screen = null;
  #blockFrame: BlockFrame = null;
  #terminalBlock: TerminalBlock = null;
  #extensionMetadata: ExtensionMetadata;

  constructor(extensionMetadata: ExtensionMetadata, blockFrame: BlockFrame, terminalBlock: TerminalBlock) {
    this.#extensionMetadata = extensionMetadata;
    this.#blockFrame = blockFrame;
    this.#terminalBlock = terminalBlock;
    // this._terminalViewer.onDispose(this.#handleTerminalViewerDispose.bind(this));
  }

  #handleTerminalViewerDispose(): void {
    this.#terminalBlock = null;
  }

  #checkIsAlive(): void {
    if ( ! this.isAlive) {
      throw new Error("TerminalOutputDetails is not alive and can no longer be used.");
    }
  }

  get isAlive(): boolean {
    return this.#terminalBlock != null;
  }

  get hasPty(): boolean {
    this.#checkIsAlive();
    return this.#terminalBlock.getEmulator() != null;
  }

  get scrollback(): ExtensionApi.Screen {
    if (this.#scrollback == null) {
      this.#scrollback = new ScrollbackImpl(this.#extensionMetadata, this.#terminalBlock);
    }
    return this.#scrollback;
  }

  get hasSelection(): boolean {
    this.#checkIsAlive();
    return this.#terminalBlock.hasSelection();
  }

  get commandLine(): string {
    return this.#terminalBlock.getCommandLine();
  }

  get returnCode(): number {
    return this.#terminalBlock.getReturnCode();
  }

  positionToRow(position: number): ExtensionApi.PositionToRowResult {
    const parent = this.#blockFrame.getWidget().parent();
    const widgetCoord = this.#terminalBlock.getWidget().mapFrom(<QWidget> parent, new QPoint(0, position));
    const cellPosition = this.#terminalBlock.pixelPointToCell(0, widgetCoord.y());
    const y = Math.max(-1, cellPosition.y);
    if (y < 0) {
      return {
        where: ExtensionApi.RowPositionType.ABOVE,
        row: -1
      };
    }
    if (y >= this.#terminalBlock.getScrollbackLength()) {
      const emulator = this.#terminalBlock.getEmulator();
      if (emulator == null) {
        return {
          where: ExtensionApi.RowPositionType.BELOW,
          row: -1
        };
      }
      const dimensions = emulator.getDimensions();
      const screenY = y - this.#terminalBlock.getScrollbackLength();
      if (screenY >= dimensions.rows) {
        return {
          where: ExtensionApi.RowPositionType.BELOW,
          row: -1
        };
      }
      return {
        where: ExtensionApi.RowPositionType.IN_SCREEN,
        row: screenY
      };
    }
    return {
      where: ExtensionApi.RowPositionType.IN_SCROLLBACK,
      row: y
    };
  }
}

class ScrollbackImpl implements ExtensionApi.Screen {

  #extensionMetadata: ExtensionMetadata;
  #terminalBlock: TerminalBlock = null;

  constructor(extensionMetadata: ExtensionMetadata, terminalViewer: TerminalBlock) {
    this.#extensionMetadata = extensionMetadata;
    this.#terminalBlock = terminalViewer;
  }

  get width(): number {
    return this.#terminalBlock.getScreenWidth();
  }

  get height(): number {
    return this.#terminalBlock.getScrollbackLength();
  }

  getRowText(rowNumber: number): string {
    return this.#terminalBlock.getScrollbackLineText(rowNumber);
  }

  isRowWrapped(rowNumber: number): boolean {
    return this.#terminalBlock.isScrollbackLineWrapped(rowNumber);
  }

  applyHyperlink(rowNumber: number, x: number, length: number, url: string): void {
    const extensionName = this.#extensionMetadata.name;
    this.#terminalBlock.applyScrollbackHyperlink(rowNumber, x, length, url, extensionName);
  }

  removeHyperlinks(rowNumber: number): void {
    const extensionName = this.#extensionMetadata.name;
    this.#terminalBlock.removeHyperlinks(rowNumber, extensionName);
  }

  getBaseRow(rowNumber: number): ExtensionApi.Row {
    if (rowNumber < 0 || rowNumber >= this.#terminalBlock.getScrollbackLength()) {
      return null;
    }
    return this.#terminalBlock.getLine(rowNumber);
  }

  hasLayerRow(rowNumber: number, name: string): boolean {
    const line = this.#terminalBlock.getScrollbackLineAtRow(rowNumber);
    if (line == null) {
      return false;
    }
    const key = `${this.#extensionMetadata.name}:${name}`;
    for (const layer of line.layers) {
      if (layer.name === key) {
        return true;
      }
    }
    return false;
  }

  getLayerRow(rowNumber: number, name: string): ExtensionApi.Row {
    const line = this.#terminalBlock.getScrollbackLineAtRow(rowNumber);
    if (line == null) {
      return null;
    }
    const key = `${this.#extensionMetadata.name}:${name}`;
    for (const layer of line.layers) {
      if (layer.name === key) {
        return layer.line;
      }
    }
    const layer: Layer = {
      name: key,
      line: new LineImpl(line.width, line.palette, 0)
    };
    line.layers.push(layer);
    return layer.line;
  }

  redraw(): void {
    this.#terminalBlock.getWidget().update();
  }
}
