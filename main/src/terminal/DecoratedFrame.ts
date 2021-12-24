/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event, EventEmitter } from "extraterm-event-emitter";
import { AlignmentFlag, Direction, QLabel, QPushButton, QResizeEvent, QSizePolicyPolicy,
  QWidget } from "@nodegui/nodegui";
import { Disposable, ViewerMetadata, ViewerPosture } from "@extraterm/extraterm-extension-api";
import { BoxLayout, Label, PushButton, repolish, setCssClasses, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { Block } from "./Block";
import { BlockFrame } from "./BlockFrame";
import { createHtmlIcon } from "../ui/Icons";
import { UiStyle } from "../ui/UiStyle";
import { HoverPushButton } from "../ui/QtConstructExtra";


const POSTURE_MAPPING = {
  [ViewerPosture.NEUTRAL]: "posture-neutral",
  [ViewerPosture.FAILURE]: "posture-failure",
  [ViewerPosture.RUNNING]: "posture-running",
  [ViewerPosture.SUCCESS]: "posture-success"
};


/**
 * A frame around a Block.
 *
 * Every block inside a terminal is held within a a `BlockFrame`. The visual
 * appearance of the `BlockFrame` can vary from invisible to a full frame
 * with title bar and surrounding visible frame.
 */
export class DecoratedFrame implements BlockFrame {
  private _log: Logger = null;
  #uiStyle: UiStyle = null;

  #block: Block = null;
  #widget: QWidget = null;
  #headerWidget: QWidget = null;

  #defaultMetadata: ViewerMetadata = null;
  #titleLabel: QLabel = null;
  #iconText: QLabel = null;

  #onMetadataChangedDisposable: Disposable = null;
  #widthPx = -1;
  #viewportTopPx = 0;
  #closeButton: QPushButton = null;

  #onCloseClickedEventEmitter = new EventEmitter<BlockFrame>();
  onCloseClicked: Event<BlockFrame> = null;

  constructor(uiStyle: UiStyle) {
    this._log = getLogger("DecoratedFrame", this);
    this.#uiStyle = uiStyle;
    this.onCloseClicked = this.#onCloseClickedEventEmitter.event;

    this.#widget = Widget({
      id: this._log.getName(),
      cssClass: "decorated-frame",
      onLayoutRequest: () => this.#layout(),
      onResize: (ev) => this.#handleResize(ev),
      sizePolicy: {
        vertical: QSizePolicyPolicy.Fixed,
        horizontal: QSizePolicyPolicy.Expanding
      }
    });
    this.#headerWidget = this.#createHeader();
    this.#headerWidget.setParent(this.#widget);
  }

  #layout(): void {
    const headerSizeHint = this.#headerWidget.sizeHint();
    const leftRightMarginPx = this.#uiStyle.getFrameMarginLeftRightPx();

    let totalHeight = headerSizeHint.height();
    if (this.#block != null) {
      const blockWidget = this.#block.getWidget();
      const blockSizeHint = blockWidget.maximumSize();
      totalHeight += blockSizeHint.height();
      totalHeight += this.#uiStyle.getDecoratedFrameMarginBottomPx();
      blockWidget.setGeometry(leftRightMarginPx, headerSizeHint.height(),
        this.#widthPx - 2 * leftRightMarginPx, blockSizeHint.height());
    }

    const headerHeight = headerSizeHint.height();
    const headerY = Math.max(0, Math.min(this.#viewportTopPx, totalHeight - headerHeight));
    this.#headerWidget.setGeometry(0, headerY, this.#widthPx, headerHeight);

    this.#widget.setFixedHeight(totalHeight);
    this.#widget.setMinimumHeight(totalHeight);
    this.#widget.updateGeometry();
  }

  #handleResize(ev): void {
    const resizeEvent = new QResizeEvent(ev);
    this.#widthPx = resizeEvent.size().width();
    this.#layout();
  }

  getBlock(): Block {
    return this.#block;
  }

  setBlock(block: Block): void {
    if (this.#onMetadataChangedDisposable != null) {
      this.#onMetadataChangedDisposable.dispose();
      this.#onMetadataChangedDisposable = null;
    }
    if (this.#block != null) {
      this.#block.getWidget().setParent(null);
    }

    this.#block = block;
    this.#onMetadataChangedDisposable = block.onMetadataChanged(() => this.#handleMetadataChanged());
    this.#updateHeaderFromMetadata(this.#getMetadata());

    const blockWidget = this.#block.getWidget();
    blockWidget.setParent(this.#widget);
    blockWidget.show();
    this.#layout();
    this.#headerWidget.raise();
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
      id: "DecoratedFrame-header",
      cssClass: "decorated-frame-header",
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        contentsMargins: [0, 0, 0, 0],
        children: [
          {
            widget: this.#iconText = Label({cssClass: "icon", text: ""}),
            stretch: 0
          },
          {
            widget: this.#titleLabel = Label({cssClass: "command-line", text: "command-line"}),
            stretch: 1,
            alignment: AlignmentFlag.AlignLeft
          },
          {
            widget: this.#closeButton = HoverPushButton({
              cssClass: "small",
              iconPair: this.#uiStyle.getToolbarButtonIconPair("fa-times-circle"),
              onClicked: () => {
                this.#onCloseClickedEventEmitter.fire(this);
              },
            }),
            stretch: 0
          }
        ]
      })
    });
  }

  #updateHeaderFromMetadata(metadata: ViewerMetadata): void {
    setCssClasses(this.#widget, ["decorated-frame", POSTURE_MAPPING[metadata.posture]]);
    setCssClasses(this.#headerWidget, ["decorated-frame-header", POSTURE_MAPPING[metadata.posture]]);

    this.#titleLabel.setText(metadata.title);
    this.#iconText.setText(createHtmlIcon(metadata.icon));

    repolish(this.#titleLabel);
    repolish(this.#iconText);
  }

  #handleMetadataChanged(): void {
    this.#updateHeaderFromMetadata(this.#getMetadata());
  }

  setViewportTop(relativeTopPx: number): void {
    if (relativeTopPx === this.#viewportTopPx) {
      return;
    }
    this.#viewportTopPx = relativeTopPx;
    this.#layout();
  }
}
