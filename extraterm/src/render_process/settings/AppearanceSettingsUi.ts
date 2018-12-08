/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';
import * as _ from 'lodash';

import {FontInfo, TitleBarStyle, TerminalMarginStyle} from '../../Config';
import * as ThemeTypes from '../../theme/Theme';
import { ThemeSyntaxPreviewContents } from './SyntaxThemePreviewContent';
import { trimBetweenTags } from 'extraterm-trim-between-tags';


const ID_TERMINAL_FONT_SIZE = "ID_TERMINAL_FONT_SIZE";
const ID_UI_ZOOM = "ID_UI_ZOOM";
const ID_TERMINAL_MARGIN = "ID_TERMINAL_MARGIN";

interface TitleBarOption {
  id: TitleBarStyle;
  name: string;
}

interface TerminalMarginOption {
  id: TerminalMarginStyle;
  name: string;
}

interface SelectableOption {
  id: number;
  name: string;
}


@Component(
  {
    template: trimBetweenTags(`
<div class="settings-page">
  <h2><i class="fa fa-paint-brush"></i>&nbsp;&nbsp;Appearance</h2>

  <h3>Terminal</h3>

  <div class="gui-layout cols-1-2">
    <label for="terminal-font">Font:</label>
    <select id="terminal-font" v-model="terminalFont" class="char-width-20">
      <option v-for="option in terminalFontOptions" v-bind:value="option.postscriptName">
        {{ option.name }}
      </option>
    </select>

    <label for="${ID_TERMINAL_FONT_SIZE}">Font Size:</label>
    <span class="group"><input id="${ID_TERMINAL_FONT_SIZE}" type="number" class="char-width-4"
        v-model.number="terminalFontSize" min='1' max='1024' debounce="100" /><span>pixels</span></span>

    <label for="theme-terminal">Theme:</label>
    <select id="theme-terminal" v-model="themeTerminal" class="char-width-20">
      <option v-for="option in themeTerminalOptions" v-bind:value="option.id">
        {{ option.name }}
      </option>
    </select>
    
    <template v-if="themeTerminalComment != ''">
      <label></label>
      <div>
        <p class="minor">
          <i class="fa fa-info-circle"></i>
          {{themeTerminalComment}}
        </p>
      </div>
    </template>

    <label></label>
    <span class="group"><button v-on:click="openUserTerminalThemesDir" class="inline" title="Open user terminal theme directory in file manager">
        <i class="far fa-folder-open"></i>&nbsp;User themes
      </button><button v-on:click="rescanUserTerminalThemesDir" class="inline" title="Rescan theme list"><i class="fas fa-sync-alt"></i></button></span>

    <label></label>
    <div>
      <p class="minor">{{themeTerminalFormatsMessage}}</p>
    </div>

    <label for="${ID_TERMINAL_MARGIN}">Margin:</label>
    <select class="char-width-6" id="${ID_TERMINAL_MARGIN}" v-model="terminalMarginStyle">
      <option v-for="option in terminalMarginOptions" v-bind:value="option.id">
        {{ option.name }}
      </option>          
    </select>

    <et-vue-terminal-ace-viewer-element
      id="terminal_theme_preview"
      class="full-width">
    </et-vue-terminal-ace-viewer-element>
  </div>

  <h3>Interface</h3>

  <div class="gui-layout cols-1-2">
    <label for="theme-terminal">Theme:</label>
    <select id="theme-terminal" v-model="themeGUI" class="char-width-20">
      <option v-for="option in themeGUIOptions" v-bind:value="option.id">
        {{ option.name }}
      </option>
    </select>

    <template v-if="themeGUIComment != ''">
      <label></label>
      <div>
        <p class="minor">
          <i class="fa fa-info-circle"></i>
          {{themeGUIComment}}
        </p>
      </div>
    </template>

    <label for="${ID_UI_ZOOM}">Zoom:</label>
    <select class="char-width-6" id="${ID_UI_ZOOM}" v-model="uiScalePercent">
      <option v-for="option in uiScalePercentOptions" v-bind:value="option.id">
        {{ option.name }}
      </option>          
    </select>

    <label for="theme-terminal">Window Title Bar:</label>
    <select id="title-bar" v-model="titleBarStyle" class="char-width-12">
      <option v-for="option in titleBarOptions" v-bind:value="option.id">
        {{ option.name }}
      </option>
    </select>

    <label></label>
    <span><label><input type="checkbox" v-model="showTrayIcon">Show icon in system tray</label></span>

    <template v-if="titleBarStyle != currentTitleBarStyle">
      <label></label>
      <div>
        <p class="minor">
          <i class="fa fa-info-circle"></i>
          A restart is requred before this change takes effect.
        </p>
      </div>
    </template>

  </div>

  <h3>Text Viewer</h3>

  <div class="gui-layout cols-1-2">
    <label for="theme-terminal">Theme:</label>
    <select id="theme-terminal" v-model="themeSyntax" class="char-width-20">
      <option v-for="option in themeSyntaxOptions" v-bind:value="option.id">
        {{ option.name }}
      </option>
    </select>

    <template v-if="themeSyntaxComment != ''">
      <label></label>
      <div>
        <p class="minor">
          <i class="fa fa-info-circle"></i>
          {{themeSyntaxComment}}
        </p>
      </div>
    </template>

    <label></label>
    <span class="group"><button v-on:click="openUserSyntaxThemesDir" class="inline" title="Open user syntax theme directory in file manager">
        <i class="far fa-folder-open"></i>&nbsp;User themes
      </button><button v-on:click="rescanUserSyntaxThemesDir" class="inline" title="Rescan theme list"><i class="fas fa-sync-alt"></i></button></span>

    <label></label>
    <div>
      <p class="minor">{{themeSyntaxFormatsMessage}}</p>
    </div>

    <et-vue-text-ace-viewer-element
      id="syntax_theme_preview"
      class="full-width"
      :viewer-text="getThemeSyntaxPreviewText()"
      :mime-type="getThemeSyntaxPreviewMimeType()"
      :wrap-lines="getThemeSyntaxPreviewWrapLines()"></et-vue-text-ace-viewer-element>

    <select class="char-width-20 full-width" id="syntax_theme_preview_contents" v-model="themeSyntaxPreviewContents">
      <option v-for="(option, index) in themeSyntaxPreviewContentOptions" :value="index">
        {{ option.name }}
      </option>
    </select>
  </div>
</div>
`)
})
export class AppearanceSettingsUi extends Vue {

  terminalFontSize: number;
  themes: ThemeTypes.ThemeInfo[];

  themeTerminal: string;
  themeSyntax: string;
  themeGUI: string;

  titleBarStyle: TitleBarStyle;
  currentTitleBarStyle: TitleBarStyle;
  titleBarOptions: TitleBarOption[];
  showTrayIcon: boolean;

  terminalFont: string;
  terminalFontOptions: FontInfo[];

  uiScalePercent: number;
  uiScalePercentOptions: SelectableOption[];
  terminalMarginStyle: TerminalMarginStyle;
  terminalMarginOptions: TerminalMarginOption[];

  themeSyntaxPreviewContents: number;
  themeSyntaxPreviewContentOptions: ThemeSyntaxPreviewContents[];

  themeTerminalFormatNames: string[] = [];
  themeSyntaxFormatNames: string[] = [];

  constructor() {
    super();
    this.terminalFontSize = 13;
    this.themes = [];
    this.themeTerminal = "";
    this.themeSyntax = "";
    this.themeGUI = "";

    this.terminalFont = "";
    this.terminalFontOptions = [];

    this.titleBarStyle = "theme";
    this.currentTitleBarStyle = "theme";
    this.titleBarOptions = [
      { id: "native", name: "Native" },
      { id: "theme", name: "Theme" },
      { id: "compact", name: "Compact Theme" },
    ];
    this.showTrayIcon = true;

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

    this.terminalMarginOptions = [
      { id: "none", name: "None"},
      { id: "thin", name: "Thin"},
      { id: "normal", name: "Normal"},
      { id: "thick", name: "Thick"},
    ];
    this.terminalMarginStyle = "normal";

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

  get themeTerminalFormatsMessage(): string {
    return "Supported theme formats: " + this.themeTerminalFormatNames.join(", ");
  }

  getThemeSyntaxPreviewText(): string {
    return ThemeSyntaxPreviewContents[this.themeSyntaxPreviewContents].text;
  }

  getThemeSyntaxPreviewMimeType(): string {
    return ThemeSyntaxPreviewContents[this.themeSyntaxPreviewContents].mimeType;
  }

  get themeSyntaxFormatsMessage(): string {
    return "Supported theme formats: " + this.themeSyntaxFormatNames.join(", ");
  }

  getThemeSyntaxPreviewWrapLines(): boolean {
    return this.themeSyntaxPreviewContents === 0;
  }
}
