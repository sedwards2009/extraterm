/**
 * Copyright 2018-2020 Simon Edwards <simon@simonzone.com>
 */
import { Position } from "@extraterm/ace-ts";
import { Line } from "term-api";
import { ExtratermAceEditor } from "./ExtratermAceEditor";
import { TerminalCanvasEditSession } from "./TerminalCanvasEditSession";
import { TerminalCanvasRenderer } from "./TerminalCanvasRenderer";


export class TerminalCanvasAceEditor extends ExtratermAceEditor {

  #terminalCanvasRenderer: TerminalCanvasRenderer = null;

  constructor(renderer: TerminalCanvasRenderer | undefined, session: TerminalCanvasEditSession | undefined) {
    super(renderer, session);

    this.#terminalCanvasRenderer = renderer;
    const mouseTarget = renderer.getMouseEventTarget();
    mouseTarget.addEventListener("mousemove", this._handleMouseMove.bind(this));
    mouseTarget.addEventListener("mouseout", this._handleMouseOut.bind(this));
  }

  private _handleMouseMove(ev: MouseEvent): void {
    const coord = this.renderer.screenToTextCoordinates(ev.clientX, ev.clientY);
    this.#terminalCanvasRenderer.mouseOver(coord);
  }

  private _handleMouseOut(ev: MouseEvent): void {
    this.#terminalCanvasRenderer.mouseOver(null);
  }

  getHyperlinkAtTextCoordinates(pos: Position): string {
    return this.#terminalCanvasRenderer.getHyperlinkAtTextCoordinates(pos);
  }

  setTerminalLines(startRow: number, lines: Line[]): void {
    const session = <TerminalCanvasEditSession> this.sessionOrThrow();
    const endRow = startRow + lines.length -1;
    if (session.setTerminalLines(startRow, lines)) {
      this.renderer.updateLines(startRow, endRow, true);
    }
  }

  getTerminalLine(row: number): Line {
    const session = <TerminalCanvasEditSession> this.sessionOrThrow();
    return session.getTerminalLine(row);
  }

  appendTerminalLine(line: Line): void {
    const session = <TerminalCanvasEditSession> this.sessionOrThrow();
    session.appendTerminalLine(line);
  }
}
