/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */
import { Editor, Renderer, EditSession } from "ace-ts";
import { Event} from 'extraterm-extension-api';
import { EventEmitter } from "extraterm-event-emitter";

export class ExtratermAceEditor extends Editor {

  private _onCursorTopHitEventEmitter = new EventEmitter<number>();
  private _onCursorBottomHitEventEmitter = new EventEmitter<number>();

  constructor(renderer: Renderer | undefined, session: EditSession | undefined) {
    super(renderer, session);
    this.onCursorTopHit = this._onCursorTopHitEventEmitter.event;
    this.onCursorBottomHit = this._onCursorBottomHitEventEmitter.event;
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
  }
}
