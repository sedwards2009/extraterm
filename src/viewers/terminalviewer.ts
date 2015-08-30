/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import ViewerElement = require("../viewerelement");
import util = require("../gui/util");

const ID = "CbTerminalViewerTemplate";
const ID_CONTAINER = "container";
const ID_MAIN_STYLE = "main_style";
const ID_THEME_STYLE = "theme_style";

let registered = false;

class EtTerminalViewer extends ViewerElement {
  
  static TAG_NAME = "cb-terminal-viewer";

  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtTerminalViewer.TAG_NAME, {prototype: EtTerminalViewer.prototype});
      registered = true;
    }
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _mutationObserver: MutationObserver;
  private _commandLine: string;
  private _returnCode: string;
  
  private _initProperties(): void {
    this._mutationObserver = null;  
    this._commandLine = null;
    this._returnCode  =null;
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

  createdCallback(): void {
    this._initProperties();
    
    const shadow = util.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
    this._mutationObserver = new MutationObserver( (mutations) => {
      this.pullInContents();
    });
    this._mutationObserver.observe(this, { childList: true });
    this.pullInContents();
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
          white-space: normal;
        }
        
        #${ID_CONTAINER} {
          height: 100%;
          width: 100%;
          overflow: auto;
        }
        </style>
        <style id="${ID_THEME_STYLE}"></style>
        <div id="${ID_CONTAINER}" class="terminal_viewer terminal"></div>`;

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }
  
  _themeCssSet(): void {  
    const themeTag = <HTMLStyleElement> util.getShadowId(this, ID_THEME_STYLE);
    if (themeTag !== null) {
      themeTag.innerHTML = this.getThemeCss();
    }
  }
  
  private pullInContents(): void {
     const container = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
     util.nodeListToArray(this.childNodes).forEach( (node) => {
       container.appendChild(node);
     });
  }
  
  // attachedCallback(): void {
  //   const container = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
  //   const kids = this.childNodes;
  //   
  //   // Collect the raw text content.
  //   let text = "";    
  //   let i = 0;
  //   for (i=0; i<kids.length; i++) {
  //     if (kids[i].nodeName === '#text') {
  //        text = text + kids[i].textContent;
  //     }
  //   }
  //   
  //   const markdownText = markdown.toHTML(text);
  //   container.innerHTML = markdownText;
  // }
}

export = EtTerminalViewer;
