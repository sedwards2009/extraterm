/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as DomUtils from '../DomUtils';
import { trimBetweenTags } from 'extraterm-trim-between-tags';

export interface Options {
  delegatesFocus: boolean;
}

let templateIdCounter = 0;
const idMapping = new WeakMap<Function, string>();


export abstract class TemplatedElementBase extends ThemeableElementBase {

  constructor(options: Options) {
    super();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: options.delegatesFocus });
    const clone = this._createClone(this._html());
    shadow.appendChild(clone);
    this.updateThemeCss();
  }

  private _getTemplateId(): string {
    if ( ! idMapping.has(this.constructor)) {
      idMapping.set(this.constructor, "TemplateElementBase_" + templateIdCounter);
      templateIdCounter++;
    }
    return idMapping.get(this.constructor);
  }

  private _createClone(html: string) {
    const templateId = this._getTemplateId();
    let template = <HTMLTemplateElement>window.document.getElementById(templateId);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = templateId;

      const styleElement = document.createElement("style");
      styleElement.id = ThemeableElementBase.ID_THEME;
      template.content.appendChild(styleElement);
      template.content.appendChild(DomUtils.htmlToFragment(trimBetweenTags(html)));

      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  protected abstract _html(): string;

  protected _elementById(id: string): HTMLElement {
    return DomUtils.getShadowId(this, id);
  }
}
