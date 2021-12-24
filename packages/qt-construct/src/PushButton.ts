/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QPushButton } from "@nodegui/nodegui";
import { AbstractButtonOptions, ApplyAbstractButtonOptions } from "./AbstractButton";

export interface PushButtonOptions extends AbstractButtonOptions {
}

export function PushButton(options: PushButtonOptions): QPushButton {
  const pushButton = new QPushButton();
  ApplyAbstractButtonOptions(pushButton, options);
  return pushButton;
}
