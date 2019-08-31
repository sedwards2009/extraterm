/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
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

export class MouseEncoder {
  private _log: Logger = null;

  mouseEvents = false;

  utfMouse = false;
  decLocator = false;
  urxvtMouse = false;
  sgrMouse = false;

  normalMouse = false;
  x10Mouse = false;
  vt200Mouse = false;

  private _mouseButtonDown = false;
  private _lastMovePos: TerminalCoord = null;

  constructor() {
    this._log = getLogger("MouseEncoder", this);
  }

  mouseDown(ev: MouseEventOptions): string {
    if ( ! this.mouseEvents) {
      return null;
    }

    const sequence = this._computeMouseDownSequence(ev);

    // bind events
    if (this.normalMouse) {
      this._lastMovePos = null;
      this._mouseButtonDown = true;
    }  
    return sequence;
  }

  private _computeMouseDownSequence(  ev: MouseEventOptions): string {
    let button = this.mouseEventOptionsToButtons(ev);
    
    // no mods
    if (this.vt200Mouse) {
      button = button & ~0xc;   // ctrl only
    } else if ( ! this.normalMouse) {
      button = button & ~0x1c;  // no mods
    }
    
    const sequence = this._computeMouseSequence(button, {x: ev.column, y: ev.row});
    
    if (this.vt200Mouse) {
      return sequence + this._computeMouseSequence(3, {x: ev.column, y: ev.row}); // release button
    }
    return sequence;
  }

  mouseMove(ev: MouseEventOptions): string {
    if ( ! this.mouseEvents) {
      return null;
    }

    if ( ! this._mouseButtonDown) {
      return null;
    }
    if (this._lastMovePos !== null && this._lastMovePos.x === ev.column && this._lastMovePos.y === ev.row) {
      return "";
    }
    
    const pos = {x: ev.column, y: ev.row};

    const sequence = this._computeMouseMoveSequence(ev);
    this._lastMovePos = pos;
    return sequence;
  }

  private _computeMouseMoveSequence(ev: MouseEventOptions): string {
    const pos = {x: ev.column, y: ev.row};

    let button = this.mouseEventOptionsToButtons(ev);
    
    // no mods
    if (this.vt200Mouse) {
      button = button & ~0xc;   // ctrl only
    } else if ( ! this.normalMouse) {
      button = button & ~0x1c;  // no mods
    }
    
    // buttons marked as motions
    // are incremented by 32
    button |= 32;

    return this._computeMouseSequence(button, pos);
  }    
  mouseUp(ev: MouseEventOptions): string {
    if ( ! this.mouseEvents) {
      return null;
    }

    if ( ! this._mouseButtonDown) {
      return null;
    }
    
    if (this.x10Mouse) {
      this._mouseButtonDown = false;
      return null; // No mouse ups for x10.
    }
    
    if (ev === null) {
      this._mouseButtonDown = false;
      return "";
    }

    const sequence = this._computeMouseUpSequence(ev);
    this._mouseButtonDown = false;
    return sequence;
  }

  private _computeMouseUpSequence(ev: MouseEventOptions): string {
    let button = this.mouseEventOptionsToButtons(ev, true);
    
    // no mods
    if (this.vt200Mouse) {
      button = button & ~0xc;   // ctrl only
    } else if ( ! this.normalMouse) {
      button = button & ~0x1c;  // no mods
    }
    
    return this._computeMouseSequence(button,  {x: ev.column, y: ev.row});
  }

  private mouseEventOptionsToButtons(ev, release=false): number {
    // two low bits:
    // 0 = left
    // 1 = middle
    // 2 = right
    // 3 = release
    // wheel up/down:
    // 1, and 2 - with 64 added
    
    let button = 0;
    if (release) {
      button = 3;
    } else if (ev.leftButton) {
      button = 0;
    } else if (ev.middleButton) {
      button = 1;
    } else if (ev.rightButton) {
      button = 2;
    }
    
    const shift = ev.shiftKey ? 4 : 0;
    const meta = ev.metaKey ? 8 : 0;
    const ctrl = ev.ctrlKey ? 16 : 0;
    const mod = shift | meta | ctrl;
    
    return (mod << 2) | button;
  }

  // encode button and
  // position to characters
  private encodeMouseData(buffer: number[], ch: number): void {
    if ( ! this.utfMouse) {
      if (ch === 255) {
        buffer.push(0);
        return;
      }
      if (ch > 127) {
        ch = 127;
      }
      buffer.push(ch);
    } else {
      if (ch === 2047) {
        buffer.push(0);
      }
      if (ch < 127) {
        buffer.push(ch);
      } else {
        if (ch > 2047) {
          ch = 2047;
        }
        buffer.push(0xC0 | (ch >> 6));
        buffer.push(0x80 | (ch & 0x3F));
      }
    }
  }

  // send a mouse event:
  // regular/utf8: ^[[M Cb Cx Cy
  // urxvt: ^[[ Cb ; Cx ; Cy M
  // sgr: ^[[ Cb ; Cx ; Cy M/m
  // vt300: ^[[ 24(1/3/5)~ [ Cx , Cy ] \r
  // locator: CSI P e ; P b ; P r ; P c ; P p & w
  private _computeMouseSequence(button: number, pos0based: TerminalCoord): string {
    const pos: TerminalCoord = { x: pos0based.x + 1, y: pos0based.y + 1 };
    
    if (this.decLocator) {
      // NOTE: Unstable.
      this._log.debug("sendEvent with decLocator is not implemented!");
      
      // const x = pos.x;
      // const y = pos.y;
      // const translatedButton = {0:2, 1:4, 2:6, 3:3}[button & 3];
      // self.send('\x1b[' + translatedButton + ';' + (translatedButton === 3 ? 4 : 0) + ';' + y + ';' + x + ';' +
      //   (pos.page || 0) + '&w');
      return null;
    }

    if (this.urxvtMouse) {
      const x = pos.x;
      const y = pos.y;
      return '\x1b[' + (button+32) + ';' + x + ';' + y + 'M';
    }

    if (this.sgrMouse) {
      const x = pos.x;
      const y = pos.y;
      return  '\x1b[<' + ((button & 3) === 3 ? button & ~3 : button) + ';' + x +
        ';' + y + ((button & 3) === 3 ? 'm' : 'M');
    }

    const encodedData = [];
    this.encodeMouseData(encodedData, button+32);
    
    // xterm sends raw bytes and
    // starts at 32 (SP) for each.    
    this.encodeMouseData(encodedData, pos.x + 32);
    this.encodeMouseData(encodedData, pos.y + 32);

    return '\x1b[M' + String.fromCharCode.apply(String, encodedData);
  }
  
  // mouseup, mousedown, mousewheel
  // left click: ^[[M 3<^[[M#3<
  // mousewheel up: ^[[M`3>

}
