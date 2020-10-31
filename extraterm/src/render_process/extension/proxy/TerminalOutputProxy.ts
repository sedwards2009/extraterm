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
  }

  isLive(): boolean {
    return this._terminalViewer.getEmulator() != null;
  }

  find(needle: string, options?: ExtensionApi.FindOptions): boolean {
    return this._terminalViewer.find(needle, options);
  }

  findNext(needle: string): boolean {
    return this._terminalViewer.findNext(needle);
  }

  findPrevious(needle: string): boolean {
    return this._terminalViewer.findPrevious(needle);
  }

  hasSelection(): boolean {
    return this._terminalViewer.hasSelection();
  }

  highlight(re: RegExp): void {
    this._terminalViewer.highlight(re);
  }
}
