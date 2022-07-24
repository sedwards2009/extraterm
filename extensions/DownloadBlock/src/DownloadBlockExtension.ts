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
import { AlignmentFlag, Direction, QLabel, QProgressBar, QWidget, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, Label, ProgressBar, Widget } from "qt-construct";
import { SpeedTracker } from "./SpeedTracker.js";
import { formatHumanBytes, formatHumanDuration } from "./TextUtils.js";

let log: Logger = null;
let context: ExtensionContext = null;


export function activate(_context: ExtensionContext): any {
  context = _context;
  log = context.logger;

  context.terminals.registerBlock("download-block", newDownloadBlock);
}

function newDownloadBlock(extensionBlock: ExtensionBlock): void {
  const label = new QLabel();
  label.setText("DownloadBlock extension");

  const downloadUI = new DownloadUI(extensionBlock);
  extensionBlock.contentWidget = downloadUI.getWidget();
}

class DownloadUI {

  #extensionBlock: ExtensionBlock = null;
  #filename = "";
  #topWidget: QWidget = null;
  #actionLabel: QLabel = null;
  #availableBytesLabel: QLabel = null;
  #progressBar: QProgressBar = null;
  #etaLabel: QLabel = null;
  #speedTracker: SpeedTracker = null;

  constructor(extensionBlock: ExtensionBlock) {
    this.#extensionBlock = extensionBlock;
    if (this.#extensionBlock.bulkFile.totalSize >= 0) {
      this.#speedTracker = new SpeedTracker(this.#extensionBlock.bulkFile.totalSize);
    }

    this.#filename = this.#extensionBlock.bulkFile.metadata["filename"];
    if (this.#filename === undefined) {
      this.#filename = "(unknown)";
    }

    this.#updateMetadata();

    const style = this.#extensionBlock.terminal.tab.window.style;

    this.#topWidget = Widget({
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        children: [
          this.#actionLabel = Label({
            textFormat: TextFormat.RichText,
            text: this.#formattedAction()
          }),
          this.#availableBytesLabel = Label({
            text: this.#formattedAvailableBytes(),
            alignment: AlignmentFlag.AlignRight,
            minimumWidth: style.emToPx(10)
          }),
          this.#progressBar = ProgressBar({
            minimum: 0,
            maximum: 100,
            value: 0
          }),
          this.#etaLabel = Label({
            textFormat: TextFormat.RichText,
            text: this.#formattedEta(),
            minimumWidth: style.emToPx(10)
          }),
        ]
      })
    });

    const bulkFile = this.#extensionBlock.bulkFile;
    bulkFile.onAvailableSizeChanged(this.#handleAvailableSizeChanged.bind(this));
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
        changes.title = `Completed downloading ${this.#filename}`;
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

  #handleAvailableSizeChanged(size: number): void {
    if (this.#speedTracker != null) {
      this.#speedTracker.updateProgress(size);
    }
    this.#updateValue();
  }

  getWidget(): QWidget {
    return this.#topWidget;
  }

  #handleStateChanged(): void {
    this.#updateAction();
    this.#updateMetadata();
  }

  #updateAction(): void {
    this.#actionLabel.setText(this.#formattedAction());
  }

  #formattedAction(): string {
    const style = this.#extensionBlock.terminal.tab.window.style;
    const icon = style.createHtmlIcon("fa-download");
    if (this.#extensionBlock.bulkFile.state === BulkFileState.DOWNLOADING) {
      return `${icon} Downloading ${this.#filename}`;
    } else {
      return `${icon} ${this.#filename}`;
    }
  }

  #formattedAvailableBytes(): string {
    return formatHumanBytes(this.#extensionBlock.bulkFile.availableSize);
  }

  #formattedEta(): string {
    if (this.#speedTracker != null && this.#extensionBlock.bulkFile.state === BulkFileState.DOWNLOADING) {
      const style = this.#extensionBlock.terminal.tab.window.style;
      const icon = style.createHtmlIcon("fa-hourglass-half");
      return `${icon} ${formatHumanDuration(this.#speedTracker.getETASeconds())}`;
    }
    return "";
  }

  #updateValue(): void {
    const bulkFile = this.#extensionBlock.bulkFile;
    const totalBytes = bulkFile.totalSize <= 0 ? 100 : bulkFile.totalSize;
    const transferredBytes = bulkFile.totalSize <= 0 ? 50 : bulkFile.availableSize;
    const value = Math.round(transferredBytes / totalBytes * 100);
    this.#progressBar.setValue(value);

    this.#availableBytesLabel.setText(this.#formattedAvailableBytes());
    this.#etaLabel.setText(this.#formattedEta());
  }
}
