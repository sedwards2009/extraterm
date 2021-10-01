/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { CheckState, QCheckBox } from "@nodegui/nodegui";

export interface CheckBoxOptions {
  tristate?: boolean;
  checkState?: boolean | CheckState;
  onStateChanged?: (state: number) => void;
  text?: string;
}

export function CheckBox(options: CheckBoxOptions): QCheckBox {
  const checkBox = new QCheckBox();
  const { checkState, onStateChanged, text, tristate } = options;
  if (checkState !== undefined) {
    if (typeof checkState === "boolean") {
      checkBox.setCheckState(checkState ? CheckState.Checked : CheckState.Unchecked);
    } else {
      checkBox.setCheckState(checkState);
    }
  }

  if (tristate !== undefined) {
    checkBox.setTristate(tristate);
  }

  if (text !== undefined) {
    checkBox.setText(text);
  }

  if (onStateChanged !== undefined) {
    checkBox.addEventListener("stateChanged", onStateChanged);
  }
  return checkBox;
}
