/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { WebComponent, Attribute, Observe } from 'extraterm-web-component-decorators';
import { ViewerElement } from '../viewers/ViewerElement';
import { Logger, getLogger } from 'extraterm-logging';
import { TerminalViewer } from '../viewers/TerminalAceViewer';
import { VirtualScrollCanvas } from '../VirtualScrollCanvas';
import * as Term from '../emulator/Term';
import { VirtualScrollArea, EVENT_RESIZE, VirtualScrollable } from '../VirtualScrollArea';
import { doLater } from '../../utils/DoLater';
import { ResizeRefreshElementBase, RefreshLevel } from '../ResizeRefreshElementBase';


export const VUE_TERMINAL_ACE_VIEWER_ELEMENT_TAG = "et-vue-terminal-ace-viewer-element";

@WebComponent({tag: VUE_TERMINAL_ACE_VIEWER_ELEMENT_TAG})
export class VueTerminalAceViewerElement extends ViewerElement {

  private _log: Logger = null;
  private _terminalViewer: TerminalViewer = null;
  private _scrollCanvas: VirtualScrollCanvas = null;

  constructor() {
    super();
    this._log = getLogger(VUE_TERMINAL_ACE_VIEWER_ELEMENT_TAG, this);
  }

  connectedCallback(): void {
    super.connectedCallback();

    if (this.childElementCount === 0) {
      this._scrollCanvas = <VirtualScrollCanvas> document.createElement(VirtualScrollCanvas.TAG_NAME);

      this._terminalViewer = <TerminalViewer> document.createElement(TerminalViewer.TAG_NAME);
      this._terminalViewer.setEditable(false);
      this._terminalViewer.addEventListener(EVENT_RESIZE, this._handleVirtualScrollableResize.bind(this));

      const emulator = new Term.Emulator({platform: <Term.Platform> process.platform});
      this._terminalViewer.setEmulator(emulator);

      this._scrollCanvas.setViewerElement(this._terminalViewer);
      this.appendChild(this._scrollCanvas);

      emulator.write(demoContents());
    }
  }
  
  private _handleVirtualScrollableResize(ev: CustomEvent): void {
    doLater(() => {
      this._terminalViewer.refresh(RefreshLevel.RESIZE);
    });
  }

}

function demoContents(): string {
  const defaultFG = "\x1b[0m";
  const defaultColor = "\x1b[0m";
  const newline = "\n\r ";

  let result = newline;

  for (let i=0; i<16; i++) {
    if (i==8) {
      result += "\n\r ";
    }
    result += " ";
    if (i >= 1) {
      result += charFG(0);
    }

    result += charBG(i);
    if (i < 10) {
      result += " "
    }
    result += " " + i + " " + defaultColor;
  }

  result += charFG(0);

  result += newline + defaultFG + newline +
    " " + boldFG(4) + "dir" + defaultColor + "/         " + boldFG(2) + "script.sh" + defaultColor + "*" + newline +
    " file         " + boldFG(6) + "symbolic_link" + defaultColor + " -> something" + newline +
    " " + boldFG(5) + "image.png" + defaultColor + "    " + boldFG(1) + "shambolic_link" + defaultColor + " -> " + boldFG(1) + "nothing" + defaultColor + newline +
    " \x1b[30;42mtmp" + defaultColor + "/" + newline +
    newline +
    " " + charFG(2) +"[user@computer " + charFG(12) + "/home/user" + charFG(2) + "]$ "+ defaultColor;

  return result;
}

function boldFG(n: number): string {
  return `\x1b[1;${30+n}m`;
}

function charFG(n: number): string {
  return `\x1b[38;5;${n}m`;
}

function charBG(n: number): string {
  return `\x1b[48;5;${n}m`;
}
