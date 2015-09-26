/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import ViewerElement = require("../viewerelement");
import util = require("../gui/util");
import domutils = require("../domutils");
import CodeMirror = require('codemirror');
import EtCodeMirrorViewerTypes = require('./codemirrorviewertypes');

type TextDecoration = EtCodeMirrorViewerTypes.TextDecoration;

var simpleScrollBars = require('codemirror/addon/scroll/simplescrollbars');

const ID = "CbCodeMirrorViewerTemplate";
const ID_CONTAINER = "container";

const ID_MAIN_STYLE = "main_style";
const ID_THEME_STYLE = "theme_style";

let registered = false;

function log(msg: any, ...opts: any[]): void {
  console.log("codemirrorviewer: " + msg, ...opts);
}

class EtCodeMirrorViewer extends ViewerElement {
  
  static TAG_NAME = "et-codemirror-viewer";

  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtCodeMirrorViewer.TAG_NAME, {prototype: EtCodeMirrorViewer.prototype});
      registered = true;
    }
  }
  
  /**
   * Type guard for detecting a EtCodeMirrorViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtCodeMirrorViewer.
   */
  static is(node: Node): node is EtCodeMirrorViewer {
    return node !== null && node !== undefined && node instanceof EtCodeMirrorViewer;
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _mutationObserver: MutationObserver;
  private _commandLine: string;
  private _returnCode: string;
  private _focusable: boolean;
  private _codeMirror: CodeMirror.Editor;
  private _importLineCounter: number;
  private _maxHeight: number;
  
  private _initProperties(): void {
    this._mutationObserver = null;  
    this._commandLine = null;
    this._returnCode  =null;
    this._focusable = false;
    this._codeMirror = null;
    this._maxHeight = -1;
  }

  set commandLine(commandLine: string) {
    this._commandLine = commandLine;
  }
  
  set returnCode(returnCode: string) {
    this._returnCode = returnCode;
  }
  
  get title(): string {
    if (this._commandLine !== null) {
      return this._commandLine;
    } else {
      return "Terminal Command";
    }
  }
  
  get awesomeIcon(): string {
    return "terminal";
  }
  
  getSelectionText(): string {
    // const selection = util.getShadowRoot(this).getSelection();
    // if (selection.rangeCount !== 0 && ! selection.getRangeAt(0).collapsed) {
    //   return domutils.extractTextFromRange(selection.getRangeAt(0));
    // } else {
      return null;
    // }
  }

  focus(): void {
    this._codeMirror.focus();
  }

  hasFocus(): boolean {
    return this._codeMirror.hasFocus();
  }

  get focusable(): boolean {
    return this._focusable;
  }
  
  set focusable(value: boolean) {
    this._focusable = value;
    this._updateFocusable(value);
  }
  
  setMaxHeight(height: number): void {
    log("codemirrorviewer setMaxHeight: "+height);
    this._maxHeight = height;
    if (this.parentNode !== null) {
      this._codeMirror.setSize("100%", height);
    }
  }
  
  getHeight(): number {
    return this._maxHeight;
  }
  
  getVirtualHeight(): number {
    const info = this._codeMirror.getScrollInfo();
    return info.height;
  }
  
  scrollTo(x: number, y: number): void {
    this._codeMirror.scrollTo(x, y);
  }
  
  lineCount(): number {
    const doc = this._codeMirror.getDoc();
    return doc.lineCount();
  }
  
  setCursor(line: number, ch: number): void {
    const doc = this._codeMirror.getDoc();
    doc.setCursor( { line, ch } );
  }
  
  createdCallback(): void {
    this._initProperties();
    
    const shadow = util.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);

    const containerDiv = util.getShadowId(this, ID_CONTAINER);
    // containerDiv.addEventListener('keydown', (ev: KeyboardEvent): void => {
    //   console.log("codemirrorviewer keydown: ",ev);
    //   ev.stopPropagation();
    //   ev.preventDefault();
    // });
    // containerDiv.addEventListener('keypress', (ev: KeyboardEvent): void => {
    //   ev.stopPropagation();
    //   ev.preventDefault();
    // });
    // containerDiv.addEventListener('keyup', (ev: KeyboardEvent): void => {
    //   ev.stopPropagation();
    //   ev.preventDefault();
    // });
    
    this._updateFocusable(this._focusable);
    log("exit createdCallback");

  }
  
  attachedCallback(): void {
    log("attachedCallback");
    const containerDiv = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
    
    // Create the CodeMirror instance
    this._codeMirror = CodeMirror( (el: HTMLElement): void => {
      containerDiv.appendChild(el);
    }, {value: "", readOnly: true,  scrollbarStyle: "null"});
    
    this._importLineCounter = 0;
    
    if (this._maxHeight > 0) {
      this._codeMirror.setSize("100%", this._maxHeight);
    }
    log("exit attachedCallback");
  }

  /**
   * 
   */
  private createClone(): Node {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ID_MAIN_STYLE}">
        :host {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 50px;
          white-space: normal;
        }
        
        #${ID_CONTAINER} {
          height: 100%;
          width: 100%;
          overflow: auto;
        }
        
        #${ID_CONTAINER}:focus {
          outline: 0px;
        }
        
        </style>
        <style id="${ID_THEME_STYLE}"></style>
        <style>
        @import url('node_modules/codemirror/lib/codemirror.css');
        @import url('node_modules/codemirror/addon/scroll/simplescrollbars.css');
        @import url('themes/default/theme.css');
        </style>
        <div id="${ID_CONTAINER}" class="terminal_viewer terminal"></div>`

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }
  
  _themeCssSet(): void {  
    // const themeTag = <HTMLStyleElement> util.getShadowId(this, ID_THEME_STYLE);
    // if (themeTag !== null) {
    //   themeTag.innerHTML = this.getThemeCss();
    // }
  }
  
  appendText(text: string, decorations?: TextDecoration[]): void {
    const doc = this._codeMirror.getDoc();
    const lineOffset = this._importLineCounter === 0 ? 0 : doc.lineCount();
    
    const pos = { line: doc.lineCount(), ch: 0 };
    doc.replaceRange((this._importLineCounter === 0 ? "" : "\n") + text, pos, pos);
    this._importLineCounter++;
    
    if (decorations !== undefined && decorations.length !== 0) {
      // Apply the styles to the text.
      const len = decorations.length;
      for (let i=0; i<len; i++) {
        const style = decorations[i];
        const from = { line: style.line + lineOffset, ch: style.fromCh };
        const to = { line: style.line + lineOffset, ch: style.toCh };
        const classList = style.classList;
        for (let j=0; j<classList.length; j++) {
          doc.markText( from, to, { className: classList[j] } );
        }
      }
    }
    
    this._codeMirror.refresh();
    util.doLater( () => { this._codeMirror.refresh(); });
  }
  
  deleteLinesFrom(line: number): void {
    const doc = this._codeMirror.getDoc();
    
    
    const lastPos = { line: doc.lineCount(), ch: 0 };
    
    let startPos: { line: number; ch: number; };
    if (line > 0) {
      const previousLineString = doc.getLine(line-1);
      startPos = { line: line-1, ch: previousLineString.length };
    } else {
      startPos = { line: line, ch: 0 };
    }
    doc.replaceRange("", startPos, lastPos);
    
    this._codeMirror.refresh();
    util.doLater( () => { this._codeMirror.refresh(); });
  }

  private _updateFocusable(focusable: boolean): void {
    // const containerDiv = util.getShadowId(this, ID_CONTAINER);
    // containerDiv.setAttribute('tabIndex', focusable ? "-1" : "");
  }
  
}

export = EtCodeMirrorViewer;
