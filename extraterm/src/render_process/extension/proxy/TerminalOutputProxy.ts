/*
 * Copyright 2017-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";

import { AbstractViewerProxy } from "./AbstractViewerProxy";
import { InternalExtensionContext } from "../InternalTypes";
import { TerminalViewer } from "../../viewers/TerminalAceViewer";


export class TerminalOutputProxy extends AbstractViewerProxy implements ExtensionApi.TerminalOutputViewer {

  viewerType: "terminal-output" = "terminal-output";

  constructor(internalExtensionContext: InternalExtensionContext, private _terminalViewer: TerminalViewer) {
    super(internalExtensionContext, _terminalViewer);
    this._terminalViewer.onDispose(this._handleTerminalViewerDispose.bind(this));
  }

  private _checkIsAlive(): void {
    if ( ! this.isAlive()) {
      throw new Error("TerminalOutputViewer is not alive and can no longer be used.");
    }
  }

  private _handleTerminalViewerDispose(): void {
    this._terminalViewer = null;
  }

  isAlive(): boolean {
    return this._terminalViewer != null;
  }

  isLive(): boolean {
    this._checkIsAlive();
    return this._terminalViewer.getEmulator() != null;
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
