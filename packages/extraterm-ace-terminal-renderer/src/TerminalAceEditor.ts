import { Editor } from "ace-ts";
import { Line } from "term-api";
import { TerminalEditSession } from "./TerminalEditSession";

export class TerminalAceEditor extends Editor {

  setTerminalLine(lineNumber: number, line: Line): void {
    const session = <TerminalEditSession> this.sessionOrThrow();
    session.setTerminalLine(lineNumber, line);
  }

  appendTerminalLine(line: Line): void {
    const session = <TerminalEditSession> this.sessionOrThrow();
    session.appendTerminalLine(line);
  }
}
