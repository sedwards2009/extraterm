/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */
import { Line } from "term-api";
import { ExtratermAceEditor } from "./ExtratermAceEditor";
import { TerminalCanvasEditSession } from "./TerminalCanvasEditSession";


export class TerminalCanvasAceEditor extends ExtratermAceEditor {

  setTerminalLine(row: number, line: Line): void {
    const session = <TerminalCanvasEditSession> this.sessionOrThrow();
    if (session.setTerminalLine(row, line)) {
      this.renderer.updateLines(row, row, true);
    }
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
