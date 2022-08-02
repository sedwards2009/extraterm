/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import he from "he";
import { Direction, QLabel, QProgressBar, QSizePolicyPolicy, QWidget, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, Label, ProgressBar, Widget } from "qt-construct";
import { formatHumanDuration } from "../utils/TextUtils.js";
import { createHtmlIcon } from "./Icons.js";


const SHOW_DELAY_MS = 500;

export class UploadProgressBar {

  #widget: QWidget = null;
  #delayedShowTimeout: NodeJS.Timeout = null;

  #filename: string = "";
  #actionLabel: QLabel = null;
  #progressBar: QProgressBar = null;
  #etaSeconds: number = 0;
  #etaLabel: QLabel = null;

  #transferredBytes = 0;
  #totalBytes = 0;

  constructor() {
    this.#widget = this.#createWidget();
  }

  #createWidget(): QWidget {
    const widget = Widget({
      cssClass: ["transparent"],
      contentsMargins: 0,
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        contentsMargins: 0,
        children: [
          {
            layout: BoxLayout({
              direction: Direction.LeftToRight,
              contentsMargins: 0,
              children: [
                {
                  widget: Widget({}),
                  stretch: 1
                },
                {
                  widget: Widget({
                    cssClass: ["list-picker"],
                    sizePolicy: {
                      horizontal: QSizePolicyPolicy.Expanding,
                      vertical: QSizePolicyPolicy.Fixed
                    },
                    layout: BoxLayout({
                      direction: Direction.LeftToRight,
                      children: [
                        this.#actionLabel = Label({
                          textFormat: TextFormat.RichText,
                          text: this.#formattedAction()
                        }),
                        this.#progressBar = ProgressBar({
                          minimum: 0,
                          maximum: 100,
                          value: 0
                        }),
                        this.#etaLabel = Label({
                          textFormat: TextFormat.RichText,
                          text: this.#formattedEta()
                        }),
                      ]
                    })
                  }),
                  stretch: 1
                },
                {
                  widget: Widget({}),
                  stretch: 1
                }
              ]
            }),
            stretch: 0
          },
          {
            widget: Widget({}),
            stretch: 1
          }
        ]
      })
    });
    return widget;
  }

  getWidget(): QWidget {
    return this.#widget;
  }

  setFilename(filename: string): void {
    this.#filename = filename;
    this.#actionLabel.setText(this.#formattedAction());
  }

  #formattedAction(): string {
    return `${createHtmlIcon("fa-upload")} Uploading ${he.encode(this.#filename)}`;
  }

  setEtaSeconds(seconds: number): void {
    this.#etaSeconds = seconds;
    this.#etaLabel.setText(this.#formattedEta());
  }

  #formattedEta(): string {
    return `${createHtmlIcon("fa-hourglass-half")} ${formatHumanDuration(this.#etaSeconds)}`;
  }

  setTotal(totalBytes: number): void {
    this.#totalBytes = totalBytes;
    this.#updateValue();
  }

  setTransferred(transferredBytes: number): void {
    this.#transferredBytes = transferredBytes;
    this.#updateValue();
  }

  #updateValue(): void {
    const totalBytes = this.#totalBytes === 0 ? 100 : this.#totalBytes;
    const transferredBytes = this.#totalBytes === 0 ? 50 : this.#transferredBytes;
    this.#progressBar.setValue(Math.round(transferredBytes / totalBytes * 100));
  }

  showDelayed(): void {
    if (this.#delayedShowTimeout != null) {
      return;
    }
    this.#delayedShowTimeout = setTimeout(() => {
      this.#delayedShowTimeout = null;
      this.#widget.raise();
      this.#widget.show();
    }, SHOW_DELAY_MS);
  }

  hide(): void {
    if (this.#delayedShowTimeout != null) {
      clearTimeout(this.#delayedShowTimeout);
      this.#delayedShowTimeout = null;
    }
    this.#widget.hide();
  }
}
