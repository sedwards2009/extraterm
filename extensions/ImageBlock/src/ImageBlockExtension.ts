/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {
  ExtensionContext,
  Logger,
  ExtensionBlock,
  BulkFileState,
  BlockMetadataChange,
  BlockPosture
} from "@extraterm/extraterm-extension-api";
import * as http from "node:http";
import { QImage, QPainter, QPaintEvent, QWidget } from "@nodegui/nodegui";
import { Widget } from "qt-construct";

let log: Logger = null;
let context: ExtensionContext = null;


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;

  context.terminals.registerBlock("image-block", newImageBlock);
}

function newImageBlock(extensionBlock: ExtensionBlock): void {
  const imageUI = new ImageUI(extensionBlock);
  extensionBlock.contentWidget = imageUI.getWidget();
}

class ImageUI {

  #extensionBlock: ExtensionBlock = null;
  #filename = "";
  #topWidget: QWidget = null;
  #image: QImage = null;

  constructor(extensionBlock: ExtensionBlock) {
    this.#extensionBlock = extensionBlock;

    this.#filename = this.#extensionBlock.bulkFile.metadata["filename"];
    if (this.#filename === undefined) {
      this.#filename = "(unknown)";
    }

    this.#updateMetadata();

    const style = this.#extensionBlock.terminal.tab.window.style;

    this.#topWidget = Widget({
      onPaint: (nativeEvent): void => {
        this.#handlePaint(new QPaintEvent(nativeEvent));
      }
    });

    const bulkFile = this.#extensionBlock.bulkFile;
    bulkFile.onStateChanged(this.#handleStateChanged.bind(this));
  }

  #updateMetadata(): void {
    const changes: BlockMetadataChange = {};

    switch (this.#extensionBlock.bulkFile.state) {
      case BulkFileState.DOWNLOADING:
        changes.title = `Downloading ${this.#filename}`;
        changes.posture = BlockPosture.NEUTRAL;
        changes.icon = "fa-download";
        break;
      case BulkFileState.COMPLETED:
        changes.title = `${this.#filename}`;
        changes.posture = BlockPosture.SUCCESS;
        changes.icon = "fa-check";
        break;
      case BulkFileState.FAILED:
        changes.title = `Failed to download ${this.#filename}`;
        changes.posture = BlockPosture.FAILURE;
        changes.icon = "fa-times";
        break;
      default:
        break;
    }
    this.#extensionBlock.updateMetadata(changes);
  }

  #handlePaint(event: QPaintEvent): void {
    if (this.#image == null) {
      return;
    }

    const painter = new QPainter(this.#topWidget);
    painter.drawImage(0, 0, this.#image);
    painter.end();
  }

  getWidget(): QWidget {
    return this.#topWidget;
  }

  #handleStateChanged(): void {
    this.#updateMetadata();
    if (this.#extensionBlock.bulkFile.state === BulkFileState.COMPLETED) {
      this.#downloadImage();
    }
  }

  async #downloadImage(): Promise<void> {
    const imageBuffer = await downloadURL(this.#extensionBlock.bulkFile. url); 
    this.#image = new QImage();
    this.#image.loadFromData(imageBuffer);
    if (this.#image.isNull()) {
      log.warn(`Unable to load image into QImage.`);
      return;
    }
    const width = this.#image.width();
    const height = this.#image.height();
    this.#topWidget.setMinimumSize(width, height);
    this.#topWidget.setMaximumSize(width, height);
    this.#topWidget.update();
  }
}

function downloadURL(url: string): Promise<Buffer> {
  return new Promise((resolve) => {
    http.get(url, (response) => {
      const body: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        body.push(chunk);
      });
      response.on("end", () => {
        resolve(Buffer.concat(body));
      });
    })
  })
}
