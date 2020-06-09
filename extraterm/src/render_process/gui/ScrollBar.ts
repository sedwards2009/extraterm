/*
 * Copyright 2014-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { html, render } from "extraterm-lit-html";
import { Attribute, Filter, Observe, CustomElement } from "extraterm-web-component-decorators";

import { log, Logger, getLogger } from "extraterm-logging";
import * as DomUtils from "../DomUtils";
import * as ThemeTypes from "../../theme/Theme";
import { ThemeableElementBase } from "../ThemeableElementBase";

const ID_AREA = "ID_AREA";
const ID_CONTAINER = "ID_CONTAINER";

/**
 * A scrollbar.
 */
@CustomElement("et-scroll-bar")
export class ScrollBar extends ThemeableElementBase {

  private _log: Logger;
  private _lastSetPosition = 0;

  constructor() {
    super();
    this._log = getLogger("et-scroll-bar", this);
    this._handleContainerScroll = this._handleContainerScroll.bind(this);

    this.attachShadow({ mode: "open", delegatesFocus: false });
    this.updateThemeCss();
    this._render();

    this._updateLengthNumber("length");
    this._updatePosition("position");
  }

  private _handleContainerScroll(ev: Event): void {
    const container = DomUtils.getShadowId(this, ID_CONTAINER);
    const top = container.scrollTop;

    if (top === this._lastSetPosition) {
      // Prevent emitting an event due to the position being set via API and not the user.
      return;
    }
    this.position = top;

    const event = new CustomEvent('scroll',
        { detail: {
          position: top,
          isTop: top === 0,
          isBottom: (container.scrollHeight - container.clientHeight) === top } });
    this.dispatchEvent(event);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._updatePosition("position");
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_SCROLLBAR];
  }

  protected _render(): void {
    const template = html`${this._styleTag()}
      <div
        id=${ID_CONTAINER}
        @scroll=${this._handleContainerScroll}
      ><div id='ID_AREA'></div></div>`;
    render(template, this.shadowRoot);
  }

  @Attribute({default: 1}) length = 1;

  @Filter("length")
  private _sanitizeLength(value: number): number {
    if (value == null) {
      return undefined;
    }

    if (isNaN(value)) {
      console.warn("Value '" + value + "'to scrollbar attribute 'length' was NaN.");
      return undefined;
    }

    return Math.max(0, value);
  }

  @Observe("length")
  private _updateLengthNumber(target: string): void {
    const areaElement = DomUtils.getShadowId(this, ID_AREA);
    areaElement.style.height = this.length + "px";
  }

  @Attribute({default: 0}) position = 0;

  @Filter("position")
  private _sanitizePosition(value: number): number {
    const container = DomUtils.getShadowId(this, ID_CONTAINER);
    const cleanValue = Math.min(container.scrollHeight-container.clientHeight, Math.max(0, value));
    return cleanValue !== this.position ? cleanValue : undefined;
  }

  @Observe("position")
  private _updatePosition(target: string): void {
    const containerElement = DomUtils.getShadowId(this, ID_CONTAINER);
    containerElement.scrollTop = this.position;
    this._lastSetPosition = containerElement.scrollTop;
  }

  @Attribute({default: 0}) thumbSize = 0;
}
