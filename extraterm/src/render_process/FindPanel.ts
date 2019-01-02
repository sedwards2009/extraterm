/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import { Logger, getLogger } from "extraterm-logging";
import { WebComponent } from 'extraterm-web-component-decorators';
import * as ThemeTypes from '../theme/Theme';

import { ThemedContainerElementBase } from "./gui/ThemedContainerElementBase";
import { trimBetweenTags } from 'extraterm-trim-between-tags';


@Component(
  {
    template: trimBetweenTags(`
      <div class="gui-packed-row width-100pc">
        <label class="compact"><i class="fas fa-search"></i></label>
        <input type="text" class="char-width-20" v-model="needle" placeholder="Find" />
        <button v-on:click="findNext" class="inline">Find Next</button>
        <button v-on:click="findPrevious" class="inline">Find Previous</button>
        <span class="expand"></span>
        <button v-on:click="close" class="compact microtool danger"><i class="fa fa-times"></i></button>
      </div>`)
  })
class FindPanelUI extends Vue {
  needle: string;

  constructor() {
    super();
    this.needle = "";
  }

  findNext(): void {

  }

  findPrevious(): void {

  }
  
  close(): void {

  }
}

@WebComponent({tag: "et-find-panel"})
export class FindPanel extends ThemedContainerElementBase {

  static TAG_NAME = "et-find-panel";

  private _log: Logger;
  private _ui: FindPanelUI = null;

  constructor() {
    super();
    this._log = getLogger(FindPanel.TAG_NAME, this);

    this._ui = new FindPanelUI();
    const component = this._ui.$mount();
    this.getContainerNode().appendChild(component.$el);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [...super._themeCssFiles(), ThemeTypes.CssFile.FONT_AWESOME];
  }
}
