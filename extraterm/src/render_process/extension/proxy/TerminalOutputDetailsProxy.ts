/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { InternalExtensionContext } from "../InternalTypes";
import { TerminalViewer } from "../../viewers/TerminalAceViewer";

export class TerminalOutputDetailsProxy implements ExtensionApi.TerminalOutputDetails {

  constructor(internalExtensionContext: InternalExtensionContext, private _terminalViewer: TerminalViewer) {
    this._terminalViewer.onDispose(this._handleTerminalViewerDispose.bind(this));
  }

  private _handleTerminalViewerDispose(): void {
    this._terminalViewer = null;
  }

  private _checkIsAlive(): void {
    if ( ! this.isAlive) {
      throw new Error("TerminalOutputDetails is not alive and can no longer be used.");
    }
  }

  get isAlive(): boolean {
    return this._terminalViewer != null;
  }

  get hasPty(): boolean {
    this._checkIsAlive();
    return this._terminalViewer.getEmulator() != null;
  }

  get scrollbackLength(): number {
    this._checkIsAlive();
    return this._terminalViewer.getScrollbackLength();
  }

  getScrollbackLineText(line: number): string {
    this._checkIsAlive();
    return this._terminalViewer.getScrollbackLine(line);
  }

  getScreenLineText(line: number): string {
    this._checkIsAlive();
    const emulator = this._terminalViewer.getEmulator();
    const emulatorLine = emulator.getLineText(line);
    return emulatorLine == null ? "" : emulatorLine;
  }

  get screenHeight(): number {
    this._checkIsAlive();
    return this._terminalViewer.getScreenHeight();
  }

  get screenWidth(): number {
    this._checkIsAlive();
    return this._terminalViewer.getScreenWidth();
  }

  applyScrollbackHyperlink(line: number, x: number, length: number, url: string): void {
    this._checkIsAlive();
    this._terminalViewer.applyScrollbackHyperlink(line, x, length, url);
  }

  find(needle: string, options?: ExtensionApi.FindOptions): boolean {
    this._checkIsAlive();
    return this._terminalViewer.find(needle, options);
  }

  findNext(needle: string): boolean {
    this._checkIsAlive();
    return this._terminalViewer.findNext(needle);
  }

  findPrevious(needle: string): boolean {
    this._checkIsAlive();
    return this._terminalViewer.findPrevious(needle);
  }

  hasSelection(): boolean {
    this._checkIsAlive();
    return this._terminalViewer.hasSelection();
  }

  highlight(re: RegExp): void {
    this._checkIsAlive();
    this._terminalViewer.highlight(re);
  }
}
