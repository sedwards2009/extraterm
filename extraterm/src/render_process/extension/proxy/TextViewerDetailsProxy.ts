/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { InternalExtensionContext } from "../InternalTypes";
import { TextViewer } from"../../viewers/TextAceViewer";


export class TextViewerDetailsProxy implements ExtensionApi.TextViewerDetails {

  constructor(internalExtensionContext: InternalExtensionContext, private _textViewer: TextViewer) {
    this._textViewer.onDispose(this._handleTextViewerDispose.bind(this));
  }

  private _checkIsAlive(): void {
    if ( ! this.isAlive()) {
      throw new Error("TextViewerDetails is not alive and can no longer be used.");
    }
  }

  private _handleTextViewerDispose(): void {
    this._textViewer = null;
  }

  isAlive(): boolean {
    return this._textViewer != null;
  }

  getTabSize(): number {
    this._checkIsAlive();
    return this._textViewer.getTabSize();
  }

  setTabSize(size: number): void {
    this._checkIsAlive();
    this._textViewer.setTabSize(size);
  }

  getMimeType():string {
    this._checkIsAlive();
    return this._textViewer.getMimeType();
  }

  setMimeType(mimeType: string): void {
    this._checkIsAlive();
    this._textViewer.setMimeType(mimeType);
  }

  getShowLineNumbers(): boolean {
    this._checkIsAlive();
    return this._textViewer.getShowLineNumbers();
  }

  setShowLineNumbers(show: boolean): void {
    this._checkIsAlive();
    this._textViewer.setShowLineNumbers(show);
  }

  getWrapLines(): boolean {
    this._checkIsAlive();
    return this._textViewer.getWrapLines();
  }

  setWrapLines(wrap: boolean): void {
    this._checkIsAlive();
    this._textViewer.setWrapLines(wrap);
  }

  find(needle: string, options?: ExtensionApi.FindOptions): boolean {
    this._checkIsAlive();
    return this._textViewer.find(needle, options);
  }

  findNext(needle: string): boolean {
    this._checkIsAlive();
    return this._textViewer.findNext(needle);
  }

  findPrevious(needle: string): boolean {
    this._checkIsAlive();
    return this._textViewer.findPrevious(needle);
  }

  hasSelection(): boolean {
    this._checkIsAlive();
    return this._textViewer.hasSelection();
  }

  highlight(re: RegExp): void {
    this._checkIsAlive();
    this._textViewer.highlight(re);
  }
}
