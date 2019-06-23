/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */
import { Line } from "term-api";
import { ExtratermAceEditor } from "./ExtratermAceEditor";
import { TerminalEditSession } from "./TerminalEditSession";
import { log, Logger, getLogger } from "extraterm-logging";
import { Renderer, EditSession } from "ace-ts";


export class TerminalAceEditor extends ExtratermAceEditor {
  
  private _log: Logger = null;

  constructor(renderer: Renderer | undefined, session: EditSession | undefined) {
    super(renderer, session);
    this._log = getLogger("TerminalAceEditor", this);
  }

  setTerminalLine(row: number, line: Line): void {
    const session = <TerminalEditSession> this.sessionOrThrow();
    if ( ! session.setTerminalLine(row, line)) {
      this.renderer.updateLines(row, row, true);
    }
  }

  getTerminalLine(row: number): Line {
    const session = <TerminalEditSession> this.sessionOrThrow();
    return session.getTerminalLine(row);
  }

  appendTerminalLine(line: Line): void {
    const session = <TerminalEditSession> this.sessionOrThrow();
    session.appendTerminalLine(line);
  }
}
