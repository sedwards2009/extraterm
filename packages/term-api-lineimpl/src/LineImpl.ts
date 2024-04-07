/**
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 */
import { EmbeddedImage, EmbeddedImageMap } from "extraterm-char-render-canvas";
import { TextLineImpl } from "text-term-api-lineimpl";
import { AspectRatioMode, QImage, QSize, TransformationMode } from "@nodegui/nodegui";


/**
 * An implementation of Term API's `Line` with support for images.
  */
export class LineImpl extends TextLineImpl {

  #embeddedImageMap: EmbeddedImageMap = null;

  addImage(imageId: number, image: QImage, cellWidthPx: number, cellHeightPx: number): void {
    if (this.#embeddedImageMap == null) {
      this.#embeddedImageMap = new Map<number, EmbeddedImage>();
    } else {
      this.#garbageCollectLineImages();
      // Note: Ideally this would happen *after* the line is updated with the
      // new image. So we might be hanging onto images longer than strictly
      // necessary. But in the case of an image being constantly overwritten
      // (i.e. animation or live updates) this is good enough.
    }
    this.#embeddedImageMap.set(imageId, {
      sourceImage: image,
      sourceCellWidthPx: cellWidthPx,
      sourceCellHeightPx: cellHeightPx,
      image: image,
      cellWidthPx: cellWidthPx,
      cellHeightPx: cellHeightPx,
    });
  }

  /**
   * Identify image IDs in a line which are not used and garbage
   * collect the images.
   */
  #garbageCollectLineImages(): void {
    const imageMap = this.#embeddedImageMap;
    const ids = Array.from(imageMap.keys());
    const cols = this.width;
    for (const id of ids) {
      let found = false;
      for (let x=0; x<cols; x++) {
        if (this.getImageID(x) === id) {
          found = true;
          break;
        }
      }
      if (! found) {
        imageMap.delete(id);
      }
    }
  }

  getEmbeddedImageMap(newCellWidthPx: number, newCellHeightPx: number): EmbeddedImageMap {
    if (this.#embeddedImageMap == null) {
      return null;
    }

    for (const [_, imageEntry] of this.#embeddedImageMap) {
      if (imageEntry.cellWidthPx !== newCellWidthPx || imageEntry.cellHeightPx !== newCellHeightPx) {
        if (imageEntry.sourceCellHeightPx === newCellWidthPx && imageEntry.sourceCellHeightPx === newCellHeightPx) {
          imageEntry.image = imageEntry.sourceImage;
          imageEntry.cellWidthPx =  newCellWidthPx;
          imageEntry.cellHeightPx =  newCellHeightPx;
        } else {
          const sourceImage = imageEntry.sourceImage;
          const scaledWidthPx = sourceImage.width() * newCellWidthPx / imageEntry.sourceCellWidthPx;
          const scaledHeightPx = sourceImage.height() * newCellHeightPx / imageEntry.sourceCellHeightPx;
          imageEntry.image = imageEntry.sourceImage.scaled(new QSize(scaledWidthPx, scaledHeightPx), AspectRatioMode.IgnoreAspectRatio,
            TransformationMode.SmoothTransformation);

        }
        imageEntry.cellWidthPx =  newCellWidthPx;
        imageEntry.cellHeightPx =  newCellHeightPx;
      }
    }
    return this.#embeddedImageMap;
  }
}
