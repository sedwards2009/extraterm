/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QPushButton } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";


export interface PushButtonOptions extends WidgetOptions {
  text?: string;
  onClicked?: () => void;
}

export function PushButton(options: PushButtonOptions): QPushButton {
  const pushButton = new QPushButton();

  ApplyWidgetOptions(pushButton, options);
  const { text, onClicked }  = options;

  if (text !== undefined) {
    pushButton.setText(text);
  }
  if (onClicked !== undefined) {
    pushButton.addEventListener("clicked", onClicked);
  }
  return pushButton;
}
