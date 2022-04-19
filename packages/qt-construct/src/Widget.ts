/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ContextMenuPolicy, CursorShape, FocusPolicy, NodeLayout, NodeWidget, QSizePolicyPolicy, QWidget,
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
  layout?: NodeLayout<any>;
  maximumHeight?: number;
  maximumWidth?: number;
  minimumHeight?: number;
  minimumWidth?: number;
  mouseTracking?: boolean;
  objectName?: string;
  onEnter?: () => void;
  onFocusOut?: () => void;
  onKeyPress?: (nativeEvent /* NativeQEvent */) => void;
  onLayoutRequest?: () => void;
  onLeave?: () => void;
  onMouseButtonPress?: (nativeEvent /* NativeQEvent */) => void;
  onMouseMove?: (nativeEvent /* NativeQEvent */) => void;
  onMove?: (nativeEvent /* NativeQEvent */) => void;
  onResize?: (native /* NativeQEvent */) => void;
  sizePolicy?: {horizontal: QSizePolicyPolicy, vertical: QSizePolicyPolicy};
  styleSheet?: string;
  toolTip?: string;
  visible?: boolean;
  windowFlag?: WindowType;
  windowTitle?: string;
}

export function ApplyWidgetOptions(widget: NodeWidget<any>, options: WidgetOptions): void {
  const {
    attribute, contentsMargins, contextMenuPolicy, cursor, enabled, cssClass, focusPolicy, layout, mouseTracking,
    objectName, onEnter, onFocusOut, onLayoutRequest, onLeave, onKeyPress, onMouseButtonPress, onMouseMove, onMove,
    onResize, sizePolicy, styleSheet, windowTitle, maximumHeight, maximumWidth, minimumHeight, minimumWidth,
    windowFlag, inlineStyle, toolTip, visible
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
  if (onKeyPress !== undefined) {
    widget.addEventListener(WidgetEventTypes.KeyPress, onKeyPress);
  }
  if (onEnter !== undefined) {
    widget.addEventListener(WidgetEventTypes.Enter, onEnter);
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
  if (onMouseButtonPress !== undefined) {
    widget.addEventListener(WidgetEventTypes.MouseButtonPress, onMouseButtonPress);
  }
  if (onMouseMove !== undefined) {
    widget.addEventListener(WidgetEventTypes.MouseMove, onMouseMove);
  }
  if (onMove !== undefined) {
    widget.addEventListener(WidgetEventTypes.Move, onMove);
  }
  if (onResize !== undefined) {
    widget.addEventListener(WidgetEventTypes.Resize, onResize);
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
