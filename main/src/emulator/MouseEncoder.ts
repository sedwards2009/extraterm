/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { TerminalCoord, MouseEventOptions } from 'term-api';
import { log, Logger, getLogger } from "extraterm-logging";

// XTerm mouse events
// http://invisible-island.net/xterm/ctlseqs/ctlseqs.html#Mouse%20Tracking
// To better understand these
// the xterm code is very helpful:
// Relevant files:
//   button.c, charproc.c, misc.c
// Relevant functions in xterm/button.c:
//   BtnCode, EmitButtonCode, EditorButton, SendMousePosition


const BUTTONS_CODE_SHIFT = 16;
const BUTTONS_CODE_META = 32;
const BUTTONS_CODE_CTRL = 64;

const BUTTONS_CODE_LEFT = 0;
const BUTTONS_CODE_MIDDLE = 1;
const BUTTONS_CODE_RIGHT = 2;
const BUTTONS_CODE_RELEASE = 3;


enum ButtonState {
  Press,
  Release
}

export enum MouseProtocol {
  NONE = 0,
  ANY_EVENTS = 1003,   // Mode 1003
  DRAG_EVENTS = 1002,  // Mode 1002
  VT200 = 1000,        // Mode 1000
  X10 = 9           // Mode 9
}

export enum MouseProtocolEncoding {
  NORMAL = 0,
  SGR = 1006           // Mode 1006
}

const ProtocolMouseDownSupport: MouseProtocol[] = [
  MouseProtocol.X10,
  MouseProtocol.VT200,
  MouseProtocol.ANY_EVENTS,
  MouseProtocol.DRAG_EVENTS
];

const ProtocolMouseUpSupport: MouseProtocol[] = [
  MouseProtocol.VT200,
  MouseProtocol.ANY_EVENTS,
  MouseProtocol.DRAG_EVENTS
];

const ProtocolMouseDragSupport: MouseProtocol[] = [
  MouseProtocol.ANY_EVENTS,
  MouseProtocol.DRAG_EVENTS
];

const ProtocolMouseMoveSupport: MouseProtocol[] = [
  MouseProtocol.ANY_EVENTS
];

const ProtocolMouseWheelUpSupport : MouseProtocol[]= [
  MouseProtocol.VT200,
  MouseProtocol.ANY_EVENTS,
  MouseProtocol.DRAG_EVENTS
];

const ProtocolMouseWheelDownSupport: MouseProtocol[] = [
  MouseProtocol.VT200,
  MouseProtocol.ANY_EVENTS,
  MouseProtocol.DRAG_EVENTS
];

export class MouseEncoder {
  private _log: Logger = null;

  mouseProtocol: MouseProtocol = MouseProtocol.NONE;
  mouseEncoding: MouseProtocolEncoding = MouseProtocolEncoding.NORMAL;

  // If this is true and no other mouse mode is selected,
  // then wheel event will send cursor key up/down.
  sendCursorKeysForWheel = false;

  // The number of cursor up/down key presses to send if `sendCursorKeysForWheel` is active.
  wheelCursorKeyAcceleration = 5;

  #mouseButtonDown = false;
  #lastMovePos: TerminalCoord = null;

  constructor() {
    this._log = getLogger("MouseEncoder", this);
  }

  mouseDown(ev: MouseEventOptions): string {
    if ( ! ProtocolMouseDownSupport.includes(this.mouseProtocol)) {
      return null;
    }

    const sequence = this.#computeMouseDownSequence(ev);

    // bind events
    if (this.mouseEncoding === MouseProtocolEncoding.NORMAL) {
      this.#lastMovePos = null;
    }
    this.#mouseButtonDown = true;
    return sequence;
  }

  #computeMouseDownSequence(ev: MouseEventOptions): string {
    let button = 0;

    // no mods
    if (this.mouseProtocol === MouseProtocol.VT200) {
      const ctrlCode = ev.ctrlKey ? BUTTONS_CODE_CTRL : 0; // ctrl only
      button = this.#mouseEventOptionsToButtons(ev, ButtonState.Press) | ctrlCode;
    } else if (this.mouseEncoding !== MouseProtocolEncoding.NORMAL) {
      button = this.#mouseEventOptionsToButtons(ev, ButtonState.Press);  // no mods
    } else {
      button = this.#mouseEventOptionsToModsButtons(ev);
    }

    return this.#computeMouseSequence(button, {x: ev.column, y: ev.row}, ButtonState.Press);
  }

  mouseMove(ev: MouseEventOptions): string {
    if (this.#mouseButtonDown && !ProtocolMouseDragSupport.includes(this.mouseProtocol)) {
      return null;
    }
    if (! this.#mouseButtonDown && !ProtocolMouseMoveSupport.includes(this.mouseProtocol)) {
      return null;
    }

    if (this.#lastMovePos !== null && this.#lastMovePos.x === ev.column && this.#lastMovePos.y === ev.row) {
      return "";
    }

    const pos = {x: ev.column, y: ev.row};

    const sequence = this.#computeMouseMoveSequence(ev);
    this.#lastMovePos = pos;
    return sequence;
  }

  #computeMouseMoveSequence(ev: MouseEventOptions): string {
    const pos = {x: ev.column, y: ev.row};

    let button = 0;

    // no mods
    if (this.mouseProtocol === MouseProtocol.VT200) {
      const ctrlCode = ev.ctrlKey ? BUTTONS_CODE_CTRL : 0; // ctrl only
      button = this.#mouseEventOptionsToButtons(ev, ButtonState.Press) | ctrlCode;
    } else if (this.mouseEncoding !== MouseProtocolEncoding.NORMAL) {
      button = this.#mouseEventOptionsToButtons(ev, ButtonState.Press);  // no mods
    } else {
      button = this.#mouseEventOptionsToModsButtons(ev);
    }

    // buttons marked as motions
    // are incremented by 32
    button |= 32;

    return this.#computeMouseSequence(button, pos, ButtonState.Press);
  }

  mouseUp(ev: MouseEventOptions): string {
    if ( ! ProtocolMouseUpSupport.includes(this.mouseProtocol)) {
      this.#mouseButtonDown = false;
      return null;
    }

    if ( ! this.#mouseButtonDown) {
      return null;
    }

    if (ev === null) {
      this.#mouseButtonDown = false;
      return "";
    }

    const sequence = this.#computeMouseUpSequence(ev);
    this.#mouseButtonDown = false;
    return sequence;
  }

  #computeMouseUpSequence(ev: MouseEventOptions): string {
    let button = 0;

    // no mods
    if (this.mouseProtocol === MouseProtocol.VT200) {
      const ctrlCode = ev.ctrlKey ? BUTTONS_CODE_CTRL : 0; // ctrl only
      button = this.#mouseEventOptionsToButtons(ev, ButtonState.Release) | ctrlCode;
    } else if (this.mouseEncoding !== MouseProtocolEncoding.NORMAL) {
      button = this.#mouseEventOptionsToButtons(ev, ButtonState.Release);  // no mods
    } else {
      button = this.#mouseEventOptionsToModsButtons(ev, ButtonState.Release);
    }

    return this.#computeMouseSequence(button,  {x: ev.column, y: ev.row}, ButtonState.Release);
  }

  #mouseEventOptionsToModsButtons(ev: MouseEventOptions, buttonState=ButtonState.Press): number {
    return this.#mouseEventOptionsToMods(ev) | this.#mouseEventOptionsToButtons(ev, buttonState);
  }

  #mouseEventOptionsToButtons(ev: MouseEventOptions, buttonState=ButtonState.Press): number {
    // two low bits:
    // 0 = left
    // 1 = middle
    // 2 = right
    // 3 = release
    // wheel up/down:
    // 1, and 2 - with 64 added

    let button = 0;
    if (buttonState === ButtonState.Release) {
      if (this.mouseEncoding !== MouseProtocolEncoding.SGR) {
        button = BUTTONS_CODE_RELEASE;
      }
    } else if (ev.leftButton) {
      button = BUTTONS_CODE_LEFT;
    } else if (ev.middleButton) {
      button = BUTTONS_CODE_MIDDLE;
    } else if (ev.rightButton) {
      button = BUTTONS_CODE_RIGHT;
    }
    return button;
  }

  #mouseEventOptionsToMods(ev: MouseEventOptions): number {
    const shift = ev.shiftKey ? BUTTONS_CODE_SHIFT : 0;
    const meta = ev.metaKey ? BUTTONS_CODE_META : 0;
    const ctrl = ev.ctrlKey ? BUTTONS_CODE_CTRL : 0;
    return shift | meta | ctrl;
  }

  // encode button and
  // position to characters
  #encodeMouseData(buffer: number[], ch: number): void {
    if (ch === 255) {
      buffer.push(0);
      return;
    }
    if (ch > 127) {
      ch = 127;
    }
    buffer.push(ch);
  }

  // send a mouse event:
  // regular/utf8: ^[[M Cb Cx Cy
  // sgr: ^[[ Cb ; Cx ; Cy M/m
  // vt300: ^[[ 24(1/3/5)~ [ Cx , Cy ] \r
  // locator: CSI P e ; P b ; P r ; P c ; P p & w
  #computeMouseSequence(button: number, pos0based: TerminalCoord, buttonState: ButtonState): string {
    const pos: TerminalCoord = { x: pos0based.x + 1, y: pos0based.y + 1 };

    if (this.mouseEncoding === MouseProtocolEncoding.SGR) {
      const x = pos.x;
      const y = pos.y;
      return `\x1b[<${button};${x};${y}${buttonState === ButtonState.Release ? 'm' : 'M'}`;
    }

    const encodedData = [];
    this.#encodeMouseData(encodedData, button + 32);

    // xterm sends raw bytes and
    // starts at 32 (SP) for each.
    this.#encodeMouseData(encodedData, pos.x + 32);
    this.#encodeMouseData(encodedData, pos.y + 32);

    return '\x1b[M' + String.fromCharCode.apply(String, encodedData);
  }

  // mouseup, mousedown, mousewheel
  // left click: ^[[M 3<^[[M#3<
  // mousewheel up: ^[[M`3>

  wheelUp(ev: MouseEventOptions): string {
    if ( ! ProtocolMouseWheelUpSupport.includes(this.mouseProtocol)) {
      if (this.sendCursorKeysForWheel) {
        return DuplicateString("\x1bOA", this.wheelCursorKeyAcceleration);
      }
      return null;
    }

    const button = this.#mouseEventOptionsToWheelButtons(ev, true);
    return this.#computeMouseSequence(button,  {x: ev.column, y: ev.row}, ButtonState.Press);
  }

  #mouseEventOptionsToWheelButtons(ev: MouseEventOptions, scrollUp: boolean): number {
    return scrollUp ? 64 : 65;
  }

  wheelDown(ev: MouseEventOptions): string {
    if ( ! ProtocolMouseWheelDownSupport.includes(this.mouseProtocol)) {
      if (this.sendCursorKeysForWheel) {
        return DuplicateString("\x1bOB", this.wheelCursorKeyAcceleration);
      }
      return null;
    }
    const button = this.#mouseEventOptionsToWheelButtons(ev, false);
    return this.#computeMouseSequence(button,  {x: ev.column, y: ev.row}, ButtonState.Press);
  }
}

function DuplicateString(str: string, count: number): string {
  if (count === 1) {
    return str;
  }
  let result = "";
  for (let i=0; i<count; i++) {
    result = result + str;
  }
  return result;
}
