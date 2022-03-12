/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QMenu, QPushButton } from "@nodegui/nodegui";
import { AbstractButtonOptions, ApplyAbstractButtonOptions } from "./AbstractButton";

export interface PushButtonOptions extends AbstractButtonOptions {
  menu?: QMenu;
}

export function PushButton(options: PushButtonOptions): QPushButton {
  const { menu } = options;
  const pushButton = new QPushButton();
  ApplyAbstractButtonOptions(pushButton, options);

  if (menu !== undefined) {
    pushButton.setMenu(menu);
  }

  return pushButton;
}
