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

      const emulator = new Term.Emulator({
        userAgent: window.navigator.userAgent
      });
      this._terminalViewer.setEmulator(emulator);

      this._scrollCanvas.setViewerElement(this._terminalViewer);
      this.appendChild(this._scrollCanvas);

      emulator.write(this._demoContents());
    }
  }
  
  private _handleVirtualScrollableResize(ev: CustomEvent): void {
    doLater(() => {
      this._terminalViewer.refresh(RefreshLevel.RESIZE);
    });
  }

  private _demoContents(): string {
    let result = "\n\r ";
    for (let i=0; i<16; i++) {
      if (i == 1) {
        result += charFG(1);
      }
      if (i==8) {
        result += "\n\r ";
      }

      result += charBG(i);
      if (i < 10) {
        result += " "
      }
      result += " " + i + " " + charBG(0) + " ";
    }

    result += charFG(0);

    result += "\n\r" + charFG(12) + "bin" + charFG(0) + "/\n\r";

    return result;
  }
}

function charFG(n: number): string {
  return `\x1b[38;5;${n}m`;
}

function charBG(n: number): string {
  return `\x1b[48;5;${n}m`;
}
