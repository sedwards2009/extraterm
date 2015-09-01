/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import ViewerElement = require("../viewerelement");
import util = require("../gui/util");
import markdownMod = require('markdown');
const markdown = markdownMod.markdown;

const ID = "CbMarkdownViewerTemplate";
const ID_CONTAINER = "container";
const ID_MAIN_STYLE = "main_style";
const ENCODING_ATTR = "encoding";

const ENCODING_PLAIN = "plain";
const ENCODING_BASE64 = "base64";

let registered = false;

class EtMarkdownViewer extends ViewerElement {
  
  static TAG_NAME = "cb-markdown-viewer";

  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtMarkdownViewer.TAG_NAME, {prototype: EtMarkdownViewer.prototype});
      registered = true;
    }
  }

  get awesomeIcon(): string {
    return "file-text-o";
  }
  
  getSelectionText(): string {
    const root = util.getShadowRoot(this);
    const selection = root.getSelection();
    if (selection !== undefined && selection !== null && selection.rangeCount !== 0 &&
        ! selection.getRangeAt(0).collapsed) {
      return selection.toString();
    } else {
      return null;
    }
  }

  focus(): void {
    util.getShadowId(this, ID_CONTAINER).focus();
  }
  
  createdCallback(): void {
    const shadow = util.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
    
    const containerDiv = util.getShadowId(this, ID_CONTAINER);
    containerDiv.addEventListener('keydown', (ev: KeyboardEvent): void => {
      console.log("markdown viewer keydown: ", ev);
      if (ev.keyCode === 9 && ev.ctrlKey) {
        ev.preventDefault();
      }
    });
  }

  attachedCallback(): void {
    const container = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
    const kids = this.childNodes;
    
    // Collect the raw text content.
    let text = "";    
    let i = 0;
    for (i=0; i<kids.length; i++) {
      if (kids[i].nodeName === '#text') {
         text = text + kids[i].textContent;
      }
    }
    
    const markdownText = markdown.toHTML(text);
    container.innerHTML = markdownText;
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
          white-space: normal;
        }
        
        #${ID_CONTAINER} {
          overflow: auto;
          height: 100%;
        }
        #${ID_CONTAINER}:focus {
          outline: 0px;
        }
        </style>
        <div tabindex='-1' id="${ID_CONTAINER}" class="markdown_viewer"></div>`;

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }
  
}

export = EtMarkdownViewer;
