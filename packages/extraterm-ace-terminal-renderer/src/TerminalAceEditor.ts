import { Editor, Renderer, EditSession } from "ace-ts";
import { Line } from "term-api";
import { TerminalEditSession } from "./TerminalEditSession";

import {Disposable, Event} from 'extraterm-extension-api';
import { EventEmitter } from "extraterm-event-emitter";

export class TerminalAceEditor extends Editor {

  private _onCursorTopHitEventEmitter = new EventEmitter<number>();
  private _onCursorBottomHitEventEmitter = new EventEmitter<number>();

  constructor(renderer: Renderer | undefined, session: EditSession | undefined) {
    super(renderer, session);
    this.onCursorTopHit = this._onCursorTopHitEventEmitter.event;
    this.onCursorBottomHit = this._onCursorBottomHitEventEmitter.event;
  }

  setTerminalLine(row: number, line: Line): void {
    const session = <TerminalEditSession> this.sessionOrThrow();
    session.setTerminalLine(row, line);
  }

  getTerminalLine(row: number): Line {
    const session = <TerminalEditSession> this.sessionOrThrow();
    return session.getTerminalLine(row);
  }

  appendTerminalLine(line: Line): void {
    const session = <TerminalEditSession> this.sessionOrThrow();
    session.appendTerminalLine(line);
  }

  onCursorTopHit: Event<number> = null;

  navigateUp(times: number): void {
    this._trackTopEdgeCursorHit(() => super.navigateUp(times));
  }

  gotoPageUp(): void {
    this._trackTopEdgeCursorHit(() => super.gotoPageUp());
  }

  private _trackTopEdgeCursorHit(func: ()=>void): void {
    const selection = this.selectionOrThrow();
    const oldCursorRow = selection.getCursor().row;
    const oldCursorColumn = selection.getCursor().column;
    func();
    if (oldCursorRow === 0 && selection.getCursor().row === 0) {
      this._onCursorTopHitEventEmitter.fire(oldCursorColumn);
    }
  }

  onCursorBottomHit: Event<number> = null;

  navigateDown(times: number): void {
    this._trackBottomEdgeCursorHit(() => super.navigateDown(times));
  }

  gotoPageDown(): void {
    this._trackBottomEdgeCursorHit(() => super.gotoPageDown());
  }

  private _trackBottomEdgeCursorHit(func: ()=>void): void {
    const selection = this.selectionOrThrow();
    const oldCursorRow = selection.getCursor().row;
    const oldCursorColumn = selection.getCursor().column;

    func();
    const lastRow = this.session.getLength()-1;
    if (oldCursorRow === lastRow && selection.getCursor().row === lastRow) {
      this._onCursorBottomHitEventEmitter.fire(oldCursorColumn);
    }    
  }

  protected resetCursorStyle(): void {
    const cursorLayer = this.renderer.cursorLayer;
    if (!cursorLayer) {
        return;
    }

    cursorLayer.setSmoothBlinking(false);
    cursorLayer.isBlinking = true;
    cursorLayer.setCssClass("ace_slim-cursors", true);
  }
}
