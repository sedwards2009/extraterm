/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, Event, Style } from '@extraterm/extraterm-extension-api';
import { AlignmentFlag, Direction, QWidget } from '@nodegui/nodegui';
import { BoxLayout, PushButton, Widget } from 'qt-construct';
import { EventEmitter } from "extraterm-event-emitter";
import { TemplateEditor } from './TemplateEditor';
import { TemplateString } from "./TemplateString";

export class TerminalBorderEditor {

  #originalString = "";
  #templateString: TemplateString = null;
  #templateEditor: TemplateEditor = null;
  #widget: QWidget = null;

  #onTemplateChangedEventEmitter = new EventEmitter<string>();
  onTemplateChanged: Event<string> = null;

  #onDoneEventEmitter = new EventEmitter<void>();
  onDone: Event<void> = null;

  #log: Logger;

  constructor(templateString: TemplateString, style: Style, log: Logger) {
    this.#log = log;
    this.onTemplateChanged = this.#onTemplateChangedEventEmitter.event;
    this.onDone = this.#onDoneEventEmitter.event;

    this.#templateString = templateString;

    this.#templateEditor = new TemplateEditor(templateString, style, log);
    this.#templateEditor.onTemplateChanged((template: string) => {
      this.#onTemplateChangedEventEmitter.fire(template);
    });

    this.#widget = Widget({
      cssClass: ["background"],
      layout: BoxLayout({
        direction: Direction.LeftToRight,
        children: [
          this.#templateEditor.getWidget(),
          {
            layout: BoxLayout({
              direction: Direction.LeftToRight,
              contentsMargins: 0,
              spacing: 0,
              children: [
                {
                  widget: PushButton({
                    cssClass: ["small", "success", "group-left"],
                    icon: style.createQIcon("fa-check", style.palette.textHighlight),
                    onClicked: () => {
                      this.#onDoneEventEmitter.fire();
                    }
                  }),
                  alignment: AlignmentFlag.AlignTop
                },
                {
                  widget: PushButton({
                    cssClass: ["small", "danger", "group-right"],
                    icon: style.createQIcon("fa-times", style.palette.textHighlight),
                    onClicked: () => {
                      this.#templateEditor.setTemplateText(this.#originalString);
                      this.#onDoneEventEmitter.fire();
                    }
                  }),
                  alignment: AlignmentFlag.AlignTop
                }
              ]
            }),
            alignment: AlignmentFlag.AlignTop
          }
        ]
      })
    });
  }

  prepareToOpen(): void {
    this.#originalString = this.#templateString.getTemplateString();
  }

  getWidget(): QWidget {
    return this.#widget;
  }

  focus(): void {
    this.#templateEditor.focus();
  }
}
