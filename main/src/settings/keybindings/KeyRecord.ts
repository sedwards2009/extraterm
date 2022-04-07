/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Key, QKeyEvent, QLineEdit, QSizePolicyPolicy, QWidget } from "@nodegui/nodegui";
import { LineEdit } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { qKeyEventToMinimalKeyboardEvent } from "../../keybindings/QKeyEventUtilities.js";
import { eventKeyNameToConfigKeyName, KeyStroke } from "../../keybindings/KeybindingsMapping.js";
import { Event, EventEmitter } from "extraterm-event-emitter";


export class KeyRecord {
  private _log: Logger = null;

  #lineEdit: QLineEdit = null;

  #onRecordCancelledEventEmitter = new EventEmitter<void>();
  onRecordCancelled: Event<void> = null;

  #onKeyPressEventEmitter = new EventEmitter<string>();
  onKeyPress: Event<string> = null;

  constructor() {
    this._log = getLogger("KeyRecord", this);

    this.onRecordCancelled = this.#onRecordCancelledEventEmitter.event;
    this.onKeyPress = this.#onKeyPressEventEmitter.event;

    this.#lineEdit = LineEdit({
      placeholderText: "Press a key to record",
      sizePolicy: {
        vertical: QSizePolicyPolicy.Fixed,
        horizontal:QSizePolicyPolicy.Expanding
      },
      onKeyPress: this.#onRecordKeyPress.bind(this),
      onFocusOut: () => {
        this.#lineEdit.releaseKeyboard();
        this.#onRecordCancelledEventEmitter.fire();
      }
    });
  }

  getWidget(): QWidget {
    return this.#lineEdit;
  }

  startRecord(): void {
    this.#lineEdit.setText("");
    this.#lineEdit.show();
    this.#lineEdit.setFocus();
    this.#lineEdit.grabKeyboard();
  }

  endRecord(): void {
    this.#lineEdit.releaseKeyboard();
  }

  #onRecordKeyPress(nativeEvent): void {
    const ev = new QKeyEvent(nativeEvent);
    this.#lineEdit.setEventProcessed(true);

    this._log.debug(`onKeyPress key: ${ev.key()}`);

    if(!this.#isFinalKey(ev.key())) {
      return;
    }

    const keyboardEvent = qKeyEventToMinimalKeyboardEvent(ev);
    const parts = [];
    if (keyboardEvent.altKey) {
      parts.push("Alt");
    }
    if (keyboardEvent.ctrlKey) {
      parts.push("Ctrl");
    }
    if (keyboardEvent.shiftKey) {
      parts.push("Shift");
    }
    if (keyboardEvent.metaKey) {
      parts.push("Meta");
    }
    parts.push(eventKeyNameToConfigKeyName(keyboardEvent.key));
    const keyCode = parts.join("-");

    this._log.debug(`keyCode: ${keyCode}`);

    const humanFormat = KeyStroke.parseConfigString(keyCode).formatHumanReadable();
    this.#onKeyPressEventEmitter.fire(humanFormat);
  }

  #isFinalKey(key: number): boolean {
    return ! [
      0,
      Key.Key_Shift,
      Key.Key_Control,
      Key.Key_Meta,
      Key.Key_Alt,
      Key.Key_AltGr,
      Key.Key_CapsLock
    ].includes(key);
  }
}

