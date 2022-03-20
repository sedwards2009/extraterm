/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event, Logger } from '@extraterm/extraterm-extension-api';
import { Direction, QBoxLayout, QIcon, QWidget } from "@nodegui/nodegui";
import { BoxLayout, ToolButton, Widget } from "qt-construct";
import { EventEmitter } from "extraterm-event-emitter";

import { Segment, TemplateString } from './TemplateString';


export class TitlePreview {
  #log: Logger = null;

  #templateString: TemplateString = null;
  #widget: QWidget = null;
  #childrenLayout: QBoxLayout = null;

  #onSegmentClickedEventEmitter = new EventEmitter<Segment>();
  onSegmentClicked: Event<Segment>;

  #children: QWidget[] = [];

  constructor(templateString: TemplateString, log: Logger) {
    this.#templateString = templateString;
    this.#log = log;
    this.onSegmentClicked = this.#onSegmentClickedEventEmitter.event;

    this.#widget = Widget({
      contentsMargins: 0,
      layout: this.#childrenLayout = BoxLayout({
        direction: Direction.LeftToRight,
        spacing: 0,
        children: []
      })
    });
    this.#update();
  }

  getWidget(): QWidget {
    return this.#widget;
  }

  templateStringUpdated(): void {
    this.#update();
  }

  #update(): void {
    for (const child of this.#children) {
      child.hide();
      child.setParent(null);
    }

    const newChildren: QWidget[] = [];
    for (const segment of this.#templateString.getSegments()) {

      const formatResult = this.#templateString.formatSegment(segment);
      let icon: QIcon = null;
      let text: string = null;
      if (formatResult.icon != null) {
        icon = formatResult.icon;
      } else {
        text = formatResult.text;
      }

      const segmentWidget = ToolButton({
        text: segment.type === "error" ? segment.text : text,
        icon,
        cssClass: segment.type === "error" ? ["danger"] : [],
        toolTip: segment.text,
        onClicked: () => {
          this.#onSegmentClickedEventEmitter.fire(segment);
        }
      });
      newChildren.push(segmentWidget);
      this.#childrenLayout.addWidget(segmentWidget);
    }

    const spacerWidget = Widget({});
    newChildren.push(spacerWidget);
    this.#childrenLayout.addWidget(spacerWidget, 1);

    this.#children = newChildren;
  }
}
