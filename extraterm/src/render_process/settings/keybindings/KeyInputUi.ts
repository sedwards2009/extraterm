/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { eventKeyNameToConfigKeyName } from '../../keybindings/KeyBindingsManager';

const modifierKeys = [
  "alt",
  "shift",
  "control",
  "meta",
  "cmd",
  "capslock"
];

export const EVENT_CANCELED = "canceled";
export const EVENT_SELECTED = "selected";


@Component({
  props: {
    commandHumanName: String
  },
  template: `<input
    ref="input"
    class="form-control"
    placeholder="Type a key"
    v-on:keypress.capture="onKey"
    v-on:keydown.capture="onKey"
    v-on:blur="onCancel" />`
})
export class KeybindingsKeyInput extends Vue {
  private _emitted = false;

  mounted(): void {
    this.$nextTick(() => (<HTMLInputElement>this.$refs.input).focus());
  }

  onCancel(): void {
    if (this._emitted) {
      return;
    }

    this.$emit(EVENT_CANCELED);
  }

  onKey(event: KeyboardEvent): void {
    event.preventDefault();

    let key = "";
    if (event.key.length === 1 && event.key.charCodeAt(0) <= 31) {
      // Chrome on Windows sends us control codes directly in ev.key.
      // Turn them back into normal characters.
      if (event.keyCode === 13) {
        key = "Enter";
      } else {
        key = String.fromCharCode(event.keyCode | 0x40);
      }
    } else {
      if (event.key.charCodeAt(0) === 160) { // nbsp to space on the Mac
        key = " ";
      } else {        
        key = event.key;
      }
    }

    if (modifierKeys.indexOf(key.toLowerCase()) !== -1) {
      // Skip modifief key presses.
      return;
    }

    const parts = [];
    if (event.altKey) {
      parts.push("Alt");
    }
    if (event.ctrlKey) {
      parts.push("Ctrl");
    }
    if (event.shiftKey) {
      parts.push("Shift");
    }
    if (event.metaKey) {
      parts.push("Meta");
    }
    parts.push(eventKeyNameToConfigKeyName(key));
    const keyCode = parts.join("-");

    this._emitted = true;
    this.$emit(EVENT_SELECTED, keyCode);
  }
}
