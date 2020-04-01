import { Document, Position, RangeBasic } from "@extraterm/ace-ts";

export class TerminalDocument extends Document {

  replace(range: RangeBasic, newText: string): Position {
    const isEmpty = range.start.row === range.end.row && range.start.column === range.end.column;
    if (newText.length === 0 && isEmpty) {
      // If the range is empty then the range.start and range.end will be the same.
      return range.end;
    }

    this.remove(range);

    return this.insert(range.start, newText);
  }

}
