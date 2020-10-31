/*
 * Copyright 2017-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";

import { AbstractViewerProxy } from "./AbstractViewerProxy";
import { InternalExtensionContext } from "../InternalTypes";
import { TextViewer } from"../../viewers/TextAceViewer";


export class TextViewerProxy extends AbstractViewerProxy implements ExtensionApi.TextViewer {

  viewerType: "text" = "text";

  constructor(internalExtensionContext: InternalExtensionContext, private _textViewer: TextViewer) {
    super(internalExtensionContext, _textViewer);
  }

  getTabSize(): number {
    return this._textViewer.getTabSize();
  }

  setTabSize(size: number): void {
    this._textViewer.setTabSize(size);
  }

  getMimeType():string {
    return this._textViewer.getMimeType();
  }

  setMimeType(mimeType: string): void {
    this._textViewer.setMimeType(mimeType);
  }

  getShowLineNumbers(): boolean {
    return this._textViewer.getShowLineNumbers();
  }

  setShowLineNumbers(show: boolean): void {
    this._textViewer.setShowLineNumbers(show);
  }

  getWrapLines(): boolean {
    return this._textViewer.getWrapLines();
  }

  setWrapLines(wrap: boolean): void {
    this._textViewer.setWrapLines(wrap);
  }

  find(needle: string, options?: ExtensionApi.FindOptions): boolean {
    return this._textViewer.find(needle, options);
  }

  findNext(needle: string): boolean {
    return this._textViewer.findNext(needle);
  }

  findPrevious(needle: string): boolean {
    return this._textViewer.findPrevious(needle);
  }

  hasSelection(): boolean {
    return this._textViewer.hasSelection();
  }

  highlight(re: RegExp): void {
    this._textViewer.highlight(re);
  }
}
