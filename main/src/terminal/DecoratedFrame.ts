/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { AlignmentFlag, Direction, QBoxLayout, QIcon, QLabel, QWidget } from "@nodegui/nodegui";
import { Disposable, ViewerMetadata, ViewerPosture } from "@extraterm/extraterm-extension-api";
import { BoxLayout, Label, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { Block } from "./Block";
import { BlockFrame } from "./BlockFrame";
import { createHtmlIcon } from "../ui/Icons";

/**
 * A frame around a Block.
 *
 * Every block inside a terminal is held within a a `BlockFrame`. The visual
 * appearance of the `BlockFrame` can vary from invisible to a full frame
 * with title bar and surrounding visible frame.
 */
export class DecoratedFrame implements BlockFrame {
  #block: Block = null;
  #widget: QWidget = null;
  #layout: QBoxLayout = null;

  #defaultMetadata: ViewerMetadata = null;
  #titleLabel: QLabel = null;
  #iconText: QLabel = null;

  #onMetadataChangedDisposable: Disposable = null;

  constructor(block: Block) {
    this.#block = block;

    this.#widget = Widget({
      cssClass: "decorated-frame",
      layout: this.#layout = BoxLayout({
        direction: Direction.TopToBottom,
        contentsMargins: [10, 5, 10, 5],
        children: [
          this.#createHeader(),
          block?.getWidget()
        ]
      })
    });
  }

  getBlock(): Block {
    return this.#block;
  }

  setBlock(block: Block): void {
    if (this.#onMetadataChangedDisposable != null) {
      this.#onMetadataChangedDisposable.dispose();
      this.#onMetadataChangedDisposable = null;
    }

    this.#block = block;
    this.#onMetadataChangedDisposable = block.onMetadataChanged(() => this.#handleMetadataChanged());
    this.#updateHeaderFromMetadata(this.#getMetadata());
    this.#layout.addWidget(block.getWidget());
  }

  getWidget(): QWidget {
    return this.#widget;
  }

  setDefaultMetadata(defaultMetadata: ViewerMetadata): void {
    this.#defaultMetadata = defaultMetadata;
    this.#updateHeaderFromMetadata(this.#getMetadata());
  }

  #getMetadata(): ViewerMetadata {
    let metadata: ViewerMetadata = {
      title: "",
      posture: ViewerPosture.NEUTRAL,
      icon: null,
      moveable: true,
      deleteable: true,
      toolTip: null
    };

    if (this.#block != null) {
      metadata = this.#block.getMetadata();
    } else {
      if (this.#defaultMetadata != null) {
        metadata = this.#defaultMetadata;
      }
    }
    return metadata;
  }

  #createHeader(): QWidget {
    return Widget({
      cssClass: "decorated-frame-header",
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        contentsMargins: [0, 0, 0, 0],
        children: [
          { widget: this.#iconText = Label({text: ""}), stretch: 0 },
          { widget: this.#titleLabel = Label({text: ""}), stretch: 1, alignment: AlignmentFlag.AlignLeft }
        ]
      })
    });
  }

  #updateHeaderFromMetadata(metadata: ViewerMetadata): void {
    this.#titleLabel.setText(metadata.title);
    this.#iconText.setText(createHtmlIcon(metadata.icon));
  }

  #handleMetadataChanged(): void {
    this.#updateHeaderFromMetadata(this.#getMetadata());
  }
}
