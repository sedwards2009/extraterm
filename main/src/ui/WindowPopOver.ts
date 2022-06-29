/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger, log, getLogger } from "extraterm-logging";
import { Event, EventEmitter } from "extraterm-event-emitter";
import { Direction, QBoxLayout, QRect, QResizeEvent, QSizePolicyPolicy, QSizePolicyPolicyFlag, QWidget, WidgetAttribute, WindowType } from "@nodegui/nodegui";
import { BoxLayout, Widget } from "qt-construct";
import { Window } from "../Window.js";


export interface WindowPopOverOptions {
  containingRect?: QRect;
  aroundRect?: QRect;
}

export enum Orientation {
  Above,
  Below
}

export class WindowPopOver {
  private _log: Logger = null;
  #popUp: QWidget = null;
  #leftPaddingWidget: QWidget = null;
  #rightPaddingWidget: QWidget = null;

  #window: Window = null;
  #contentsLayout: QBoxLayout = null;
  #horizLayout: QBoxLayout = null;

  #child: QWidget;
  #onCloseEventEmitter = new EventEmitter<void>();
  onClose: Event<void> = null;

  #orientation = Orientation.Above;
  #onOrientationChangedEventEmitter = new EventEmitter<Orientation>();
  onOrientationChanged: Event<Orientation> = null;

  constructor(child: QWidget) {
    this._log = getLogger("WindowPopOver", this);
    this.onClose = this.#onCloseEventEmitter.event;
    this.onOrientationChanged = this.#onOrientationChangedEventEmitter.event;
    this.#child = child;
    this.#createPopUp();
  }

  getWidget(): QWidget {
    return this.#popUp;
  }

  #createPopUp(): void {
    this.#popUp = Widget({
      cssClass: ["transparent"],
      windowFlag: WindowType.Popup | WindowType.FramelessWindowHint,
      attribute: [
        WidgetAttribute.WA_NoSystemBackground,
        WidgetAttribute.WA_WindowPropagation,
        WidgetAttribute.WA_X11NetWmWindowTypePopupMenu,
        WidgetAttribute.WA_TranslucentBackground
      ],
      contentsMargins: 0,
      layout: this.#horizLayout = BoxLayout({
        direction: Direction.LeftToRight,
        contentsMargins: 0,
        spacing: 0,
        children: [
          {
            widget: this.#leftPaddingWidget = Widget({
              onMouseButtonPress: this.#close.bind(this)
            }),
            stretch: 1
          },
          {
            layout: this.#contentsLayout = BoxLayout({
              direction: Direction.TopToBottom,
              contentsMargins: 0,
              spacing: 0,
              children: [
                {
                  widget: this.#child,
                  stretch: 0
                },
                {
                  widget: Widget({
                    onMouseButtonPress: this.#close.bind(this)
                  }),
                  stretch: 1
                }
              ]
            }),
            stretch: 0
          },
          {
            widget: this.#rightPaddingWidget = Widget({
              onMouseButtonPress: this.#close.bind(this)
            }),
            stretch: 1
          }
        ]
      }),
      onClose: this.#onClose.bind(this),
    });
    this.#popUp.hide();
  }

  #close(): void {
    this.#popUp.hide();
  }

  #onClose(): void {
    this.#onCloseEventEmitter.fire();
  }

  #positionWithinContainingRect(window: Window, containingRect: QRect): Orientation {
    this.#popUp.setGeometry(containingRect.left(), containingRect.top(), containingRect.width(),
      containingRect.height());
    this.#setOrientation(Orientation.Below);
    this.#setCenteredMode();
    return Orientation.Below;
  }

  #positionAroundRect(window: Window, aroundRect: QRect): Orientation {
    const screen = window.getWidget().windowHandle().screen();
    const screenGeometry = screen.geometry();
    const spaceBelowAroundRect = screenGeometry.height() - (aroundRect.top() + aroundRect.height());

    const maxHeight = Math.floor((screenGeometry.height() - aroundRect.height()) /2 );

    this.#orientation = maxHeight > spaceBelowAroundRect ? Orientation.Above : Orientation.Below;

    if (this.#orientation === Orientation.Above) {
      this.#popUp.setGeometry(screenGeometry.left(), screenGeometry.top(),
        screenGeometry.width(), aroundRect.top());
    } else {
      const aroundRectBottom = aroundRect.top() + aroundRect.height();
      this.#popUp.setGeometry(screenGeometry.left(), aroundRectBottom,
        screenGeometry.width(), screenGeometry.height() - aroundRectBottom);
    }
    this.#setOrientation(this.#orientation);
    this.#setPaddingMode(screenGeometry.left() + aroundRect.left());
    return this.#orientation;
  }

  #setCenteredMode(): void {
    this.#rightPaddingWidget.setSizePolicy(QSizePolicyPolicy.Preferred, QSizePolicyPolicy. Preferred);
    this.#leftPaddingWidget.setMaximumWidth(16777215);
    this.#horizLayout.setStretch(2, 1);
  }

  #setPaddingMode(leftPadding: number): void {
    this.#leftPaddingWidget.setSizePolicy(QSizePolicyPolicy.Preferred, QSizePolicyPolicy. Preferred);
    this.#leftPaddingWidget.setMaximumWidth(leftPadding);

    this.#rightPaddingWidget.setSizePolicy(QSizePolicyPolicy.MinimumExpanding, QSizePolicyPolicy. Preferred);
    this.#horizLayout.setStretch(2, 0);
  }

  #setOrientation(orientation: Orientation): void {
    this.#contentsLayout.setDirection(orientation === Orientation.Above ? Direction.BottomToTop
                                                                        : Direction.TopToBottom);
  }

  position(window: Window, options: WindowPopOverOptions): Orientation {
    this.#window = window;

    if (options.aroundRect != null) {
      return this.#positionAroundRect(window, options.aroundRect);
    } else {
      let containingRect: QRect;
      if (options?.containingRect != null) {
        containingRect = options.containingRect;
      } else {
        containingRect = window.getWidget().geometry();
      }
      containingRect = options.containingRect;

      return this.#positionWithinContainingRect(this.#window, containingRect);
    }
  }

  show(): void {
    this.#popUp.raise();
    this.#popUp.show();
  }

  hide(): void {
    this.#popUp.hide();
  }
}
