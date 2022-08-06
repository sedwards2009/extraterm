/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ContextMenuPolicy, CursorShape, FocusPolicy, QIcon, QLayout, QSizePolicyPolicy, QWidget,
  WidgetAttribute, WidgetEventTypes, WindowType
} from "@nodegui/nodegui";

export interface WidgetOptions {
  attribute?: WidgetAttribute[];
  contentsMargins?: [number, number, number, number] | number;
  contextMenuPolicy?: ContextMenuPolicy.PreventContextMenu;
  cssClass?: string | string[];
  cursor?: CursorShape,
  enabled?: boolean;
  focusPolicy?: FocusPolicy;
  inlineStyle?: string;
  layout?: QLayout;
  maximumHeight?: number;
  maximumWidth?: number;
  minimumHeight?: number;
  minimumWidth?: number;
  mouseTracking?: boolean;
  objectName?: string;
  onClose?: () => void;
  onEnter?: () => void;
  onFocusIn?: () => void;
  onFocusOut?: () => void;
  onKeyPress?: (nativeEvent /* NativeQEvent */) => void;
  onLayoutRequest?: () => void;
  onLeave?: () => void;
  onMouseButtonPress?: (nativeEvent /* NativeQEvent */) => void;
  onMouseMove?: (nativeEvent /* NativeQEvent */) => void;
  onMove?: (nativeEvent /* NativeQEvent */) => void;
  onPaint?: (nativeEvent /* NativeQEvent */) => void;
  onResize?: (native /* NativeQEvent */) => void;
  onWheel?: (native /* WheelEvent */) => void;
  sizePolicy?: {horizontal: QSizePolicyPolicy, vertical: QSizePolicyPolicy};
  styleSheet?: string;
  toolTip?: string;
  visible?: boolean;
  windowFlag?: WindowType;
  windowTitle?: string;
  windowIcon?: QIcon;
}

export function ApplyWidgetOptions(widget: QWidget, options: WidgetOptions): void {
  const {
    attribute, contentsMargins, contextMenuPolicy, cursor, enabled, cssClass, focusPolicy, layout, mouseTracking,
    objectName, onClose, onEnter, onFocusIn, onFocusOut, onLayoutRequest, onLeave, onKeyPress, onMouseButtonPress,
    onMouseMove, onMove, onPaint, onResize, onWheel, sizePolicy, styleSheet, windowIcon, windowTitle, maximumHeight,
    maximumWidth, minimumHeight, minimumWidth, windowFlag, inlineStyle, toolTip, visible
  } = options;

  if (enabled !== undefined) {
    widget.setEnabled(enabled);
  }
  if (visible !== undefined) {
    widget.setVisible(visible);
  }
  if (attribute !== undefined) {
    for (const attr of attribute) {
      widget.setAttribute(attr, true);
    }
  }
  if (objectName !== undefined) {
    widget.setObjectName(objectName);
  }
  if (cursor !== undefined) {
    widget.setCursor(cursor);
  }
  if (layout !== undefined) {
    widget.setLayout(layout);
  }
  if (cssClass !== undefined) {
    widget.setProperty("cssClass", typeof cssClass === "string" ? [cssClass] : cssClass);
  }
  if (windowTitle !== undefined) {
    widget.setWindowTitle(windowTitle);
  }
  if (focusPolicy !== undefined) {
    widget.setFocusPolicy(focusPolicy);
  }
  if (mouseTracking !== undefined) {
    widget.setMouseTracking(mouseTracking);
  }
  if (onClose !== undefined) {
    widget.addEventListener(WidgetEventTypes.Close, onClose);
  }
  if (onEnter !== undefined) {
    widget.addEventListener(WidgetEventTypes.Enter, onEnter);
  }
  if (onFocusIn !== undefined) {
    widget.addEventListener(WidgetEventTypes.FocusIn, onFocusIn);
  }
  if (onFocusOut !== undefined) {
    widget.addEventListener(WidgetEventTypes.FocusOut, onFocusOut);
  }
  if (onLayoutRequest !== undefined) {
    widget.addEventListener(WidgetEventTypes.LayoutRequest, onLayoutRequest);
  }
  if (onLeave !== undefined) {
    widget.addEventListener(WidgetEventTypes.Leave, onLeave);
  }
  if (onKeyPress !== undefined) {
    widget.addEventListener(WidgetEventTypes.KeyPress, onKeyPress);
  }
  if (onMouseButtonPress !== undefined) {
    widget.addEventListener(WidgetEventTypes.MouseButtonPress, onMouseButtonPress);
  }
  if (onMouseMove !== undefined) {
    widget.addEventListener(WidgetEventTypes.MouseMove, onMouseMove);
  }
  if (onMove !== undefined) {
    widget.addEventListener(WidgetEventTypes.Move, onMove);
  }
  if (onPaint !== undefined) {
    widget.addEventListener(WidgetEventTypes.Paint, onPaint);
  }
  if (onResize !== undefined) {
    widget.addEventListener(WidgetEventTypes.Resize, onResize);
  }
  if (onWheel !== undefined) {
    widget.addEventListener(WidgetEventTypes.Wheel, onWheel);
  }
  if (contentsMargins !== undefined) {
    if (typeof contentsMargins === "number") {
      widget.setContentsMargins(contentsMargins, contentsMargins, contentsMargins, contentsMargins);
    } else {
      widget.setContentsMargins(...contentsMargins);
    }
  }
  if (windowFlag !== undefined) {
    widget.setWindowFlag(windowFlag, true);
  }
  if (windowIcon !== undefined) {
    widget.setWindowIcon(windowIcon);
  }
  if (maximumHeight !== undefined) {
    widget.setMaximumHeight(maximumHeight);
  }
  if (maximumWidth !== undefined) {
    widget.setMaximumWidth(maximumWidth);
  }
  if (minimumHeight !== undefined) {
    widget.setMinimumHeight(minimumHeight);
  }
  if (minimumWidth !== undefined) {
    widget.setMinimumWidth(minimumWidth);
  }
  if (sizePolicy !== undefined) {
    widget.setSizePolicy(sizePolicy.horizontal, sizePolicy.vertical);
  }
  if (inlineStyle !== undefined ) {
    widget.setInlineStyle(inlineStyle);
  }
  if (contextMenuPolicy !== undefined) {
    widget.setContextMenuPolicy(contextMenuPolicy);
  }
  if (toolTip !== undefined) {
    widget.setToolTip(toolTip);
  }
  if (styleSheet !== undefined) {
    widget.setStyleSheet(styleSheet, false);
  }
}

export function Widget(options: WidgetOptions): QWidget {
  const widget = new QWidget();
  ApplyWidgetOptions(widget, options);
  return widget;
}
