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


export interface TempFindPanelViewer_FIXME {
  find(needle: string): void;
  findNext(needle: string): void;
  findPrevious(needle: string): void;
}

export interface TempFindPanelTerminal_FIXME {
  getViewers(): TempFindPanelViewer_FIXME[];
}


@Component(
  {
    template: trimBetweenTags(`
      <div class="gui-packed-row width-100pc">
        <label class="compact"><i class="fas fa-search"></i></label>
        <input ref="needle" type="text" class="char-width-20"
          v-model="needle"
          placeholder="Find"
          v-on:keydown.capture="onNeedleKeyDown"
          v-on:keypress.capture="onNeedleKeyPress"
          />
        <button v-on:click="$emit('findNext')" class="inline"><i class="fas fa-arrow-up"></i> Find Next</button>
        <button v-on:click="$emit('findPrevious')" class="inline"><i class="fas fa-arrow-down"></i> Find Previous</button>
        <span class="expand"></span>
        <button v-on:click="$emit('close')" class="compact microtool danger"><i class="fa fa-times"></i></button>
      </div>`)
  })
class FindPanelUI extends Vue {
  needle: string;

  constructor() {
    super();
    this.needle = "";
  }

  focus(): void {
    if (this.$refs.needle != null) {
      (<HTMLInputElement> this.$refs.needle).focus();
    }
  }

  onNeedleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      this.$emit("close");
    }
  }
  onNeedleKeyPress(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      this.$emit("findNext");
    }
  }
}

@WebComponent({tag: "et-find-panel"})
export class FindPanel extends ThemedContainerElementBase {

  static TAG_NAME = "et-find-panel";

  private _log: Logger;
  private _ui: FindPanelUI = null;
  private _terminal: TempFindPanelTerminal_FIXME = null;

  constructor() {
    super();
    this._log = getLogger(FindPanel.TAG_NAME, this);

    this._ui = new FindPanelUI();
    this._ui.$on("find", () => {
      this._find();
    });
    this._ui.$on("findNext", () => {
      this._findNext();
    });
    this._ui.$on("findPrevious", () => {
      this._findPrevious();
    });
    this._ui.$on("close", () => {
      this._close();
    });

    const component = this._ui.$mount();
    this.getContainerNode().appendChild(component.$el);
  }

  focus(): void {
    this._ui.focus();
  }

  setTerminal(terminal: TempFindPanelTerminal_FIXME): void {
    this._terminal = terminal;
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [...super._themeCssFiles(), ThemeTypes.CssFile.FONT_AWESOME];
  }

  private _find(): void {
// FIXME
    for (const viewer of this._terminal.getViewers()) {
      viewer.find(this._ui.needle);
    }
  }

  private _findNext(): void {
    for (const viewer of this._terminal.getViewers()) {
      viewer.findNext(this._ui.needle);
    }
  }

  private _findPrevious(): void {
    for (const viewer of this._terminal.getViewers()) {
      viewer.findPrevious(this._ui.needle);
    }
  }

  private _close(): void {
    const closeRequestEvent = new CustomEvent("close", {bubbles: true, composed: false});
    closeRequestEvent.initCustomEvent("close", true, true, null);
    this.dispatchEvent(closeRequestEvent);  
  }
}
