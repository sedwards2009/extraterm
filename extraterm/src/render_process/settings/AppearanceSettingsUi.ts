/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import * as _ from 'lodash';

import {FontInfo} from '../../Config';
import * as ThemeTypes from '../../theme/Theme';

import { ThemeSyntaxPreviewContents } from './SyntaxThemePreviewContent';
import { log } from 'extraterm-logging';


const ID_TERMINAL_FONT_SIZE = "ID_TERMINAL_FONT_SIZE";
const ID_UI_ZOOM = "ID_UI_ZOOM";

type TitleBarType = 'native' | 'theme';

interface TitleBarOption {
  id: TitleBarType;
  name: string;
}

interface SelectableOption {
  id: number;
  name: string;
}


@Component(
  {
    template: `
<div class="settings-page">
  <h2><i class="fa fa-paint-brush"></i>&nbsp;&nbsp;Appearance</h2>

  <div class="form-horizontal">

  <div class="form-group">
    <div class="col-sm-12"><h3>Terminal</h3></div>
  </div>

  <div class="form-group">
      <label for="terminal-font" class="col-sm-4 control-label">Font:</label>
      <div class="input-group col-sm-4">
        <select class="form-control" id="terminal-font" v-model="terminalFont">
          <option v-for="option in terminalFontOptions" v-bind:value="option.postscriptName">
            {{ option.name }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="titleBar != currentTitleBar" class="form-group">
      <div class="col-sm-4"></div>
      <div class="input-group col-sm-8">
        <p class="help-block">
          <i class="fa fa-info-circle"></i>
          A restart is requred before this change takes effect.
        </p>
      </div>
    </div>

    <div class="form-group">
      <label for="${ID_TERMINAL_FONT_SIZE}" class="col-sm-4 control-label">Font Size:</label>
      <div class="input-group col-sm-1">
        <input id="${ID_TERMINAL_FONT_SIZE}" type="number" class="form-control char-width-4" v-model.number="terminalFontSize" min='1'
          max='1024' debounce="100" />
        <div class="input-group-addon">pixels</div>
      </div>
    </div>

    <div class="form-group">
      <label for="theme-terminal" class="col-sm-4 control-label">Theme:</label>
      <div class="input-group col-sm-4">
        <select class="form-control" id="theme-terminal" v-model="themeTerminal">
          <option v-for="option in themeTerminalOptions" v-bind:value="option.id">
            {{ option.name }}
          </option>
        </select>
      </div>
    </div>
    <div v-if="themeTerminalComment != ''" class="form-group">
      <div class="col-sm-4"></div>
      <div class="input-group col-sm-8">
        <p class="help-block">
          <i class="fa fa-info-circle"></i>
          {{themeTerminalComment}}
        </p>
      </div>
    </div>

    <div class="form-group">
      <div class="col-sm-4"></div>
      <div class="input-group col-sm-8">
        <button v-on:click="openUserTerminalThemesDir" class="btn" title="Open user terminal theme directory in file manager">
          <i class="far fa-folder-open"></i>&nbsp;User themes
        </button>
        <button v-on:click="rescanUserTerminalThemesDir" class="btn" title="Rescan theme list"><i class="fas fa-sync-alt"></i></button>
      </div>
    </div>

    <div class="form-group">
      <div class="col-sm-12">
        <et-vue-terminal-ace-viewer-element id="terminal_theme_preview"></et-vue-terminal-ace-viewer-element>
      </div>
    </div>

    <div class="form-group">
      <div class="col-sm-12"><h3>Interface</h3></div>
    </div>

    <div class="form-group">
      <label for="theme-terminal" class="col-sm-4 control-label">Theme:</label>
      <div class="input-group col-sm-4">
        <select class="form-control" id="theme-terminal" v-model="themeGUI">
          <option v-for="option in themeGUIOptions" v-bind:value="option.id">
            {{ option.name }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="themeGUIComment != ''" class="form-group">
      <div class="col-sm-4"></div>
      <div class="input-group col-sm-8">
        <p class="help-block">
          <i class="fa fa-info-circle"></i>
          {{themeGUIComment}}
        </p>
      </div>
    </div>

    <div class="form-group">
      <label for="${ID_UI_ZOOM}" class="col-sm-4 control-label">Zoom:</label>
      <div class="input-group col-sm-8">
        <select class="form-control char-width-4" id="${ID_UI_ZOOM}" v-model="uiScalePercent">
          <option v-for="option in uiScalePercentOptions" v-bind:value="option.id">
            {{ option.name }}
          </option>          
        </select>            
      </div>
    </div>

    <div class="form-group">
      <label for="theme-terminal" class="col-sm-4 control-label">Window Title Bar:</label>
      <div class="input-group col-sm-4">
        <select class="form-control" id="title-bar" v-model="titleBar">
          <option v-for="option in titleBarOptions" v-bind:value="option.id">
            {{ option.name }}
          </option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <div class="col-sm-12"><h3>Text Viewer</h3></div>
    </div>

    <div class="form-group">
      <label for="theme-terminal" class="col-sm-4 control-label">Theme:</label>
      <div class="input-group col-sm-4">
        <select class="form-control" id="theme-terminal" v-model="themeSyntax">
          <option v-for="option in themeSyntaxOptions" v-bind:value="option.id">
            {{ option.name }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="themeSyntaxComment != ''" class="form-group">
      <div class="col-sm-4"></div>
      <div class="input-group col-sm-8">
        <p class="help-block">
          <i class="fa fa-info-circle"></i>
          {{themeSyntaxComment}}
        </p>
      </div>
    </div>

    <div class="form-group">
      <div class="col-sm-4"></div>
      <div class="input-group col-sm-8">
        <button v-on:click="openUserSyntaxThemesDir" class="btn" title="Open user syntax theme directory in file manager">
          <i class="far fa-folder-open"></i>&nbsp;User themes
        </button>
        <button v-on:click="rescanUserSyntaxThemesDir" class="btn" title="Rescan theme list"><i class="fas fa-sync-alt"></i></button>
      </div>
    </div>

    <div class="form-group">
      <div class="col-sm-12">
        <et-vue-text-ace-viewer-element
          id="syntax_theme_preview"
          :viewer-text="getThemeSyntaxPreviewText()"
          :mime-type="getThemeSyntaxPreviewMimeType()"></et-vue-text-ace-viewer-element>
      </div>
    </div>

    <div class="form-group">
      <div class="col-sm-12">
        <select class="form-control" id="syntax_theme_preview_contents" v-model="themeSyntaxPreviewContents">
          <option v-for="(option, index) in themeSyntaxPreviewContentOptions" :value="index">
            {{ option.name }}
          </option>
        </select>
      </div>
    </div>

  </div>
</div>
`
})
export class AppearanceSettingsUi extends Vue {

  terminalFontSize: number;
  themes: ThemeTypes.ThemeInfo[];

  themeTerminal: string;
  themeSyntax: string;
  themeGUI: string;

  titleBar: TitleBarType;
  currentTitleBar: TitleBarType;
  titleBarOptions: TitleBarOption[];

  terminalFont: string;
  terminalFontOptions: FontInfo[];

  uiScalePercent: number;
  uiScalePercentOptions: SelectableOption[];

  themeSyntaxPreviewContents: number;
  themeSyntaxPreviewContentOptions: ThemeSyntaxPreviewContents[];

  constructor() {
    super();
    this.terminalFontSize = 13;
    this.themes = [];
    this.themeTerminal = "";
    this.themeSyntax = "";
    this.themeGUI = "";

    this.terminalFont = "";
    this.terminalFontOptions = [];

    this.titleBar = "theme";
    this.currentTitleBar = "theme";
    this.titleBarOptions = [
      { id: "theme", name: "Theme title bar" },
      { id: "native", name: "Native title bar" }
    ];

    this.uiScalePercent = 100;
    this.uiScalePercentOptions = [
      { id: 25, name: "25%"},
      { id: 50, name: "50%"},
      { id: 65, name: "65%"},
      { id: 80, name: "80%"},
      { id: 90, name: "90%"},
      { id: 100, name: "100%"},
      { id: 110, name: "110%"},
      { id: 120, name: "120%"},
      { id: 150, name: "150%"},
      { id: 175, name: "175%"},
      { id: 200, name: "200%"},
      { id: 250, name: "250%"},
      { id: 300, name: "300%"},
    ];

    this.themeSyntaxPreviewContents = 0;
    this.themeSyntaxPreviewContentOptions = ThemeSyntaxPreviewContents;
  }

  get themeTerminalOptions(): ThemeTypes.ThemeInfo[] {
    return this.getThemesByType("terminal");
  }

  get themeSyntaxOptions(): ThemeTypes.ThemeInfo[] {
    return this.getThemesByType("syntax");
  }

  get themeGUIOptions(): ThemeTypes.ThemeInfo[] {
    return this.getThemesByType("gui");
  }

  getThemesByType(type: ThemeTypes.ThemeType): ThemeTypes.ThemeInfo[] {
    const themeTerminalOptions = this.themes.filter( themeInfo => themeInfo.type === type );
    return _.sortBy(themeTerminalOptions, (themeInfo: ThemeTypes.ThemeInfo): string => themeInfo.name );
  }

  get themeTerminalComment(): string {
    for (let option of this.themeTerminalOptions) {
      if (option.id === this.themeTerminal) {
        return option.comment;
      }
    }
    return "";
  }

  get themeSyntaxComment(): string {
    for (let option of this.themeSyntaxOptions) {
      if (option.id === this.themeSyntax) {
        return option.comment;
      }
    }
    return "";
  }

  get themeGUIComment(): string {
    for (let option of this.themeGUIOptions) {
      if (option.id === this.themeGUI) {
        return option.comment;
      }
    }
    return "";
  }

  openUserTerminalThemesDir(): void {
    this.$emit("openUserTerminalThemesDir");
  }

  rescanUserTerminalThemesDir(): void {
    this.$emit("rescanUserTerminalThemesDir");
  }

  openUserSyntaxThemesDir(): void {
    this.$emit("openUserSyntaxThemesDir");
  }

  rescanUserSyntaxThemesDir(): void {
    this.$emit("rescanUserSyntaxThemesDir");
  }

  getThemeSyntaxPreviewText(): string {
    return ThemeSyntaxPreviewContents[this.themeSyntaxPreviewContents].text;
  }

  getThemeSyntaxPreviewMimeType(): string {
    return ThemeSyntaxPreviewContents[this.themeSyntaxPreviewContents].mimeType;
  }
}
