/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { TerminalBlock } from "../../terminal/TerminalBlock.js";
import { ExtensionMetadata } from "../ExtensionMetadata.js";


export class TerminalOutputDetailsImpl implements ExtensionApi.TerminalOutputDetails {

  #scrollback: ExtensionApi.Screen = null;
  #terminalBlock: TerminalBlock = null;
  #extensionMetadata: ExtensionMetadata;

  constructor(extensionMetadata: ExtensionMetadata, terminalBlock: TerminalBlock) {
    this.#extensionMetadata = extensionMetadata;
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

  find(needle: string, options?: ExtensionApi.FindOptions): boolean {
    // this._checkIsAlive();
    // return this.#terminalBlock.find(needle, options);
    return false;
  }

  findNext(needle: string): boolean {
    // this._checkIsAlive();
    // return this.#terminalBlock.findNext(needle);
    return false;
  }

  findPrevious(needle: string): boolean {
    // this._checkIsAlive();
    // return this.#terminalBlock.findPrevious(needle);
    return false;
  }

  hasSelection(): boolean {
    this.#checkIsAlive();
    return this.#terminalBlock.hasSelection();
  }

  highlight(re: RegExp): void {
    // this._checkIsAlive();
    // this.terminalBlock.highlight(re);
  }

  get commandLine(): string {
    return this.#terminalBlock.getCommandLine();
  }

  get returnCode(): number {
    return this.#terminalBlock.getReturnCode();
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

  getLineText(line: number): string {
    return this.#terminalBlock.getScrollbackLineText(line);
  }

  isLineWrapped(line: number): boolean {
    return this.#terminalBlock.isScrollbackLineWrapped(line);
  }

  applyHyperlink(line: number, x: number, length: number, url: string): void {
    const extensionName = this.#extensionMetadata.name;
    this.#terminalBlock.applyScrollbackHyperlink(line, x, length, url, extensionName);
  }

  removeHyperlinks(line: number): void {
    const extensionName = this.#extensionMetadata.name;
    this.#terminalBlock.removeHyperlinks(line, extensionName);
  }
}
