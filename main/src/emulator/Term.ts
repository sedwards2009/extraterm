/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {
  EmulatorApi,
  ImageAddedEvent,
} from 'term-api';
import { Logger, getLogger } from "extraterm-logging";
import { Event, EventEmitter } from "extraterm-event-emitter";

import { Options, TextEmulator } from "./TextTerm.js";
import { ITermParameters } from "./ITermParameters.js";
import { AspectRatioMode, QImage, QSize, TransformationMode } from "@nodegui/nodegui";
import { TextLineImpl } from "text-term-api-lineimpl";
import { LineImpl } from "term-api-lineimpl";


export const MAX_WRITE_BUFFER_SIZE = 1024 * 100;  // 100 KB


export class Emulator extends TextEmulator implements EmulatorApi {
  protected _log: Logger = null;

  #imageIDCounter = 1;

  onImageAdded: Event<ImageAddedEvent>;
  protected _onImageAddedEventEmitter = new EventEmitter<ImageAddedEvent>();


  constructor(options: Options) {
    super(options);
    this._log = getLogger("Emulator", this);

    this.onImageAdded = this._onImageAddedEventEmitter.event;
  }

  protected _newLineImpl(newCols: number): TextLineImpl {
    return new LineImpl(newCols);
  }

  protected _executeITerm(itermParameters: ITermParameters): void {
    const buffer = itermParameters.getPayload();
    let qimage = new QImage();
    if ( ! qimage.loadFromData(buffer)) {
      this._log.warn(`Error occured while loading image from ITerm.`);
      return;
    }

    const isAutoSized = itermParameters.getWidth() === "auto" || itermParameters.getHeight() === "auto";
    if (! isAutoSized) {
      const screenWidthPx = this._cols *this._cellWidthPixels;
      const screenHeightPx = this._rows * this._cellHeightPixels;

      const targetWidth = this.#convertITermSizeToPx(itermParameters.getWidth(), this._cellWidthPixels,
        screenWidthPx, qimage.width());
      const targetHeight = this.#convertITermSizeToPx(itermParameters.getHeight(), this._cellHeightPixels,
        screenHeightPx, qimage.height());

      if (itermParameters.getPreserveAspectRatio()) {
        qimage = qimage.scaled(new QSize(targetWidth, targetHeight), AspectRatioMode.KeepAspectRatio, TransformationMode.SmoothTransformation);
      } else {
        qimage = qimage.scaled(new QSize(targetWidth, targetHeight), AspectRatioMode.IgnoreAspectRatio, TransformationMode.SmoothTransformation);
      }
    }

    const widthInCells = Math.ceil(qimage.width() / this._cellWidthPixels);
    const heightInCells = Math.ceil(qimage.height() / this._cellHeightPixels);

    const currentID = this.#imageIDCounter;
    const imageAddedEvent: ImageAddedEvent = {
      id: currentID,
      image: qimage,
      line: null,
    };
    this.#imageIDCounter++;

    const cursorX = this._x;
    const maxX = Math.min(cursorX + widthInCells, this._cols) - cursorX;

    const endY = this._y + heightInCells - 1;

    for (let j=0; j<heightInCells; j++) {
      const line = this._getRow(this._y + j);

      imageAddedEvent.line = line;
      this._onImageAddedEventEmitter.fire(imageAddedEvent);

      for (let i=0; i<maxX; i++) {
        line.setImageIDXY(i + cursorX, currentID, i, j);
      }
      this._markRowForRefresh(this._y);
      if (this._y+1 > this._scrollBottom) {
        this._scroll();
      }
    }

    if (cursorX + widthInCells >= this._cols) {
      this._scroll();
      this._setCursorY(endY + 1);
      this._x = 0;
    } else {
      this._x = cursorX + widthInCells;
      this._setCursorY(endY);
    }
  }

  #convertITermSizeToPx(itermSize: string, cellSize: number, screenSize: number, imageSize: number): number {
    if (itermSize.endsWith("%")) {
      // Percent of screen size
      const size = Number.parseInt(itermSize.slice(0, itermSize.length-1), 10);
      if (isNaN(size)) {
        return imageSize;
      }
      return screenSize * Math.min(size, 100) / 100;
    }

    if (itermSize.endsWith("px")) {
      // Straight up pixel dimensions
      const sizePx = Number.parseInt(itermSize.slice(0, itermSize.length-2), 10);
      if (isNaN(sizePx)) {
        return imageSize;
      }
      return sizePx;
    }

    // $x cells big
    const sizeCells = Number.parseInt(itermSize, 10);
    if (isNaN(sizeCells)) {
      return imageSize;
    }

    return sizeCells * cellSize;
  }
}