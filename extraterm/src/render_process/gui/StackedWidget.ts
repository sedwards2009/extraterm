/*
 * Copyright 2014-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Filter, Observe, CustomElement } from "extraterm-web-component-decorators";
import { html, render, TemplateResult } from "extraterm-lit-html";

import * as ThemeTypes from "../../theme/Theme";
import { ThemeableElementBase } from "../ThemeableElementBase";


/**
 * A widget which displays one of its DIV contents at a time.
 */
@CustomElement("et-stacked-widget")
export class StackedWidget extends ThemeableElementBase {

  private _mutationObserver: MutationObserver = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open", delegatesFocus: false });
    this._render();
    this.updateThemeCss();

    this._mutationObserver = new MutationObserver( (mutations) => {
      this._applySlotsAttributes();
      if (this.currentIndex === -1) {
        this.currentIndex = 0;
      }
      if (this.currentIndex >= this.childElementCount) {
        this.currentIndex = this.childElementCount - 1;
      }
      this._render();
    });
    this._mutationObserver.observe(this, { childList: true });
  }

  protected _render(): void {
    const slots: TemplateResult[] = [];
    for (let i=0; i<this.childElementCount; i++) {
      slots.push(html`<div class=${ i === this.currentIndex ? "visible" : "hidden"}><slot name=${i}></slot></div>`);
    }

    const template = html`${this._styleTag()}
      <div id="ID_CONTAINER">${slots}</div>`;
    render(template, this.shadowRoot);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_STACKEDWIDGET];
  }

  @Attribute({default: -1}) currentIndex: number;

  @Filter("currentIndex")
  private _filterCurrentIndex(index: number): number {
    if (index < 0 || index >= this.childElementCount) {
      return undefined;
    }
    return index;
  }

  @Observe("currentIndex")
  private _observeCurrentIndex(target: string): void {
    this._render();
  }

  private _applySlotsAttributes(): void {
    for (let i=0; i<this.children.length; i++) {
      const kid = this.children.item(i);
      kid.slot = "" + i;
    }
  }
}
