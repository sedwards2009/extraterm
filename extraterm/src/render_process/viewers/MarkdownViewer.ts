/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

import {CustomElement} from 'extraterm-web-component-decorators';

import {ViewerElement} from '../viewers/ViewerElement';
import * as DomUtils from '../DomUtils';
import * as markdownMod from 'markdown';
const markdown = markdownMod.markdown;

const ID = "EtMarkdownViewerTemplate";
const ID_CONTAINER = "container";
const ID_MAIN_STYLE = "main_style";


@CustomElement("et-markdown-viewer")
class EtMarkdownViewer extends ViewerElement {

  static TAG_NAME = "ET-MARKDOWN-VIEWER";

  private _focusable = false;

  getSelectionText(): string {
    const root = DomUtils.getShadowRoot(this);
    const selection = root.getSelection();
    if (selection !== undefined && selection !== null && selection.rangeCount !== 0 &&
        ! selection.getRangeAt(0).collapsed) {
      return selection.toString();
    } else {
      return null;
    }
  }

  focus(): void {
    DomUtils.getShadowId(this, ID_CONTAINER).focus();
  }

  hasFocus(): boolean {
    const root = DomUtils.getShadowRoot(this);
    return root.activeElement !== null;
  }

  isFocusable(): boolean {
    return this._focusable;
  }

  setFocusable(value: boolean) {
    this._focusable = value;
    this._updateFocusable(value);
  }

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    const clone = this.createClone();
    shadow.appendChild(clone);

    this._updateFocusable(this._focusable);

    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    containerDiv.addEventListener('keydown', (ev: KeyboardEvent): void => {
      if (ev.keyCode === 9 && ! ev.ctrlKey) {
        ev.preventDefault();
      }
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    const container = <HTMLDivElement> DomUtils.getShadowId(this, ID_CONTAINER);
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
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
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
        <div id="${ID_CONTAINER}" class="markdown_viewer"></div>`;

      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  private _updateFocusable(focusable: boolean): void {
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    containerDiv.setAttribute('tabIndex', focusable ? "-1" : "");
  }
}

export = EtMarkdownViewer;
