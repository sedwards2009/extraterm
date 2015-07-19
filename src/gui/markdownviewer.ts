
"use strict";
import util = require("./util");
import markdownMod = require('markdown');
const markdown = markdownMod.markdown;

const ID = "CbMarkdownViewerTemplate";
const ID_CONTAINER = "container";
const ID_MAIN_STYLE = "main_style";
const ENCODING_ATTR = "encoding";

const ENCODING_PLAIN = "plain";
const ENCODING_BASE64 = "base64";

let registered = false;

class CbMarkdownViewer extends HTMLElement {
  
  static TAG_NAME = "cb-markdown-viewer";

  static init(): void {
    if (registered === false) {
      window.document.registerElement(CbMarkdownViewer.TAG_NAME, {prototype: CbMarkdownViewer.prototype});
      registered = true;
    }
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
        </style>
        <div id="${ID_CONTAINER}" class="markdown_viewer"></div>`;

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }

  createdCallback(): void {
    const shadow = util.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
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
}

export = CbMarkdownViewer;
