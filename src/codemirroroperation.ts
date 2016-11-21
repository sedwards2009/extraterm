/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import CodeMirror = require('codemirror');
import BulkDOMOperation = require("./BulkDOMOperation");

/* This little module encapsulates a way of grouping many updates to
 * CodeMirror instances in one batch which efficiently updates the DOM. 
 */

let codeMirrorInstance: CodeMirror.Editor = null;

export function bulkOperation(func: ()=>void): void {
  if (codeMirrorInstance === null) {
    const holderDiv = window.document.createElement('div');
    holderDiv.style.width = "0px";
    holderDiv.style.height = "0px";
    holderDiv.style.top = "0px";
    holderDiv.style.bottom = "0px";
    holderDiv.style.position = "absolute";
    holderDiv.style.overflow = "hidden";
    document.body.appendChild(holderDiv);

    const options = {
      value: "",
      readOnly: true,
      scrollbarStyle: "null",
      cursorScrollMargin: 0,
      showCursorWhenSelecting: false,
      mode: null,
    };

    // Create the CodeMirror instance
    codeMirrorInstance = CodeMirror( (el: HTMLElement): void => {
      holderDiv.appendChild(el);
    }, <any>options);
  }

  codeMirrorInstance.operation(func);
}

export function bulkDOMOperation(operation: BulkDOMOperation.BulkDOMOperation): void {
  BulkDOMOperation.execute(operation, bulkOperation);
}
