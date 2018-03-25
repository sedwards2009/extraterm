/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

import {FontInfo, CommandLineAction, ShowTipsStrEnum, ConfigDistributor} from '../../Config';
import * as ThemeTypes from '../../theme/Theme';
import { APPEARANCE_SETTINGS_TAG } from './AppearanceSettings';

const ID_SCROLLBACK = "ID_SCROLLBACK";
const ID_SETTINGS = "ID_SETTINGS";
const ID_TERMINAL_FONT_SIZE = "ID_TERMINAL_FONT_SIZE";
const ID_UI_ZOOM = "ID_UI_ZOOM";
const ID_SCROLLBACK_FRAMES = "ID_SCROLLBACK_FRAMES";
const ID_COMMAND_OUTPUT_HANDLING = "ID_COMMAND_OUTPUT_HANDLING";
const CLASS_DELETE = "CLASS_DELETE";
const CLASS_FRAME = "CLASS_FRAME";
const CLASS_MATCH = "CLASS_MATCH";
const CLASS_MATCH_TYPE = "CLASS_MATCH_TYPE";


type TitleBarType = 'native' | 'theme';

export interface Identifiable {
  id?: string;
}

export interface IdentifiableCommandLineAction extends CommandLineAction, Identifiable {
}

interface UiScalePercentOption {
  id: number;
  name: string;
}

interface TitleBarOption {
  id: TitleBarType;
  name: string;
}

let idCounter = 0;
export function nextId(): string {
  idCounter++;
  return "" + idCounter;
}

for (const el of [APPEARANCE_SETTINGS_TAG]) {
  if (Vue.config.ignoredElements.indexOf(el) === -1) {
    Vue.config.ignoredElements.push(el);
  }
}


@Component(
  {
    template: `
<div id='${ID_SETTINGS}'>
  <section>
  It should appear here:
    <et-appearance-settings v-bind:configDistributor.prop="getConfigDistributor()"></et-appearance-settings>
  </section>
  <section>
    <h2>Settings</h2>
    <div className='settingsform'>
    
      <div class="form-horizontal">
        <div class="form-group">
          <label for="tips" class="col-sm-3 control-label">Show Tips:</label>
          <div class="input-group col-sm-4">
            <select class="form-control" id="tips" v-model="showTips">
              <option v-for="option in showTipsOptions" v-bind:value="option.id">
                {{ option.name }}
              </option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label for="terminal-font" class="col-sm-3 control-label">Terminal Font:</label>
          <div class="input-group col-sm-4">
            <select class="form-control" id="terminal-font" v-model="terminalFont">
              <option v-for="option in terminalFontOptions" v-bind:value="option.postscriptName">
                {{ option.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="${ID_TERMINAL_FONT_SIZE}" class="col-sm-3 control-label">Terminal Font Size:</label>
          <div class="input-group col-sm-2">
            <input id="${ID_TERMINAL_FONT_SIZE}" type="number" class="form-control" v-model.number="terminalFontSize" min='1'
              max='1024' debounce="100" />
            <div class="input-group-addon">pixels</div>
          </div>
        </div>

        <div class="form-group">
          <label for="${ID_UI_ZOOM}" class="col-sm-3 control-label">Interface Zoom:</label>
          <div class="input-group col-sm-1">
            <select class="form-control" id="${ID_UI_ZOOM}" v-model="uiScalePercent">
              <option v-for="option in uiScalePercentOptions" v-bind:value="option.id">
                {{ option.name }}
              </option>          
            </select>            
          </div>
        </div>

        <div class="form-group">
          <label for="${ID_SCROLLBACK}" class="col-sm-3 control-label">Maximum Scrollback Lines:</label>
          <div class="input-group col-sm-2">
            <input id="${ID_SCROLLBACK}" type="number" class="form-control" v-model.number="maxScrollbackLines" min="1"
              max="10000000" debounce="500" />
            <div class="input-group-addon">lines</div>
          </div>
        </div>

        <div class="form-group">
          <label for="${ID_SCROLLBACK_FRAMES}" class="col-sm-3 control-label">Maximum Scrollback Frames:</label>
          <div class="input-group col-sm-2">
            <input id="${ID_SCROLLBACK_FRAMES}" type="number" class="form-control" v-model.number="maxScrollbackFrames" min="1"
              max="1000" debounce="500" />
            <div class="input-group-addon">frames</div>
          </div>
        </div>
        
      </div>
    </div>
  </section>
    
  <section>
    <h2>Theme</h2>
    <div class="form-horizontal">
      <div class="form-group">
        <label for="theme-terminal" class="col-sm-3 control-label">Terminal Theme:</label>
        <div class="input-group col-sm-3">
          <select class="form-control" id="theme-terminal" v-model="themeTerminal">
            <option v-for="option in themeTerminalOptions" v-bind:value="option.id">
              {{ option.name }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="themeTerminalComment != ''" class="form-group">
        <div class="col-sm-3"></div>
        <div class="input-group col-sm-3">
          <p class="help-block">
            <i class="fa fa-info-circle"></i>
            {{themeTerminalComment}}
          </p>
        </div>
      </div>
      
      <div class="form-group">
        <label for="theme-terminal" class="col-sm-3 control-label">Text &amp; Syntax Theme:</label>
        <div class="input-group col-sm-3">
          <select class="form-control" id="theme-terminal" v-model="themeSyntax">
            <option v-for="option in themeSyntaxOptions" v-bind:value="option.id">
              {{ option.name }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="themeSyntaxComment != ''" class="form-group">
        <div class="col-sm-3"></div>
        <div class="input-group col-sm-3">
          <p class="help-block">
            <i class="fa fa-info-circle"></i>
            {{themeSyntaxComment}}
          </p>
        </div>
      </div>

      <div class="form-group">
        <label for="theme-terminal" class="col-sm-3 control-label">Interface Theme:</label>
        <div class="input-group col-sm-3">
          <select class="form-control" id="theme-terminal" v-model="themeGUI">
            <option v-for="option in themeGUIOptions" v-bind:value="option.id">
              {{ option.name }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="themeGUIComment != ''" class="form-group">
        <div class="col-sm-3"></div>
        <div class="input-group col-sm-3">
          <p class="help-block">
            <i class="fa fa-info-circle"></i>
            {{themeGUIComment}}
          </p>
        </div>
      </div>

      <div class="form-group">
        <label for="theme-terminal" class="col-sm-3 control-label">Window Title Bar:</label>
        <div class="input-group col-sm-3">
          <select class="form-control" id="title-bar" v-model="titleBar">
            <option v-for="option in titleBarOptions" v-bind:value="option.id">
              {{ option.name }}
            </option>
          </select>
        </div>
      </div>
      
      <div v-if="titleBar != currentTitleBar" class="form-group">
        <div class="col-sm-3"></div>
        <div class="input-group col-sm-3">
          <p class="help-block">
            <i class="fa fa-info-circle"></i>
            A restart is requred before this change takes effect.
          </p>
        </div>
      </div>

    </div>
  </section>

  <section id='${ID_COMMAND_OUTPUT_HANDLING}'>
    <h2>Command Output Handling Rules</h2>
    <table class="table">
      <thead v-if="commandLineActions.length !== 0">
        <tr><th>Match</th><th>Command</th><th>Frame</th><th></th></tr>
      </thead>
      <tbody>
      <tr v-if="commandLineActions.length !== 0" v-for="commandLineAction in commandLineActions" track-by="id">
        <td class='${CLASS_MATCH_TYPE}'><select v-model="commandLineAction.matchType" class="form-control">
          <option value="name">Match command name</option>
          <option value="regexp">Match regular expression</option>
          </select></td>
        <td class='${CLASS_MATCH}'><input type="text" class="form-control" v-model="commandLineAction.match" debounce="500" /></td>
        <td class='${CLASS_FRAME}'>
          <div class="checkbox">
            <label>
              <input type="checkbox" v-model="commandLineAction.frame" />
              Show frame
            </label>
          </div>
        </td>
        <td class='${CLASS_DELETE}'><button @click="deleteCommandLineAction(commandLineAction.id);" class="btn btn-danger btn-sm">Delete</button></td>
      </tr>
      
      <tr>
        <td colspan="4">
          <button @click="addCommandLineAction" class="btn btn-default">New Rule</button>
        </td>
      </tr>
      </tbody>
    </table>
  </section>
</div>
`
})
export class SettingsUi extends Vue {
  private __configDistributor: ConfigDistributor = null;

  showTips: ShowTipsStrEnum;
  showTipsOptions:{ id: ShowTipsStrEnum, name: string; }[];
  
  maxScrollbackLines: number;
  maxScrollbackFrames: number;
  commandLineActions: IdentifiableCommandLineAction[];
  terminalFontSize: number;
  
  themeTerminal: string;
  themeTerminalOptions: ThemeTypes.ThemeInfo[];
  
  themeSyntax: string;
  themeSyntaxOptions: ThemeTypes.ThemeInfo[];
  
  themeGUI: string;
  themeGUIOptions: ThemeTypes.ThemeInfo[];
  
  terminalFont: string;
  terminalFontOptions: FontInfo[];

  uiScalePercent: number;
  uiScalePercentOptions: UiScalePercentOption[];

  titleBar: TitleBarType;
  currentTitleBar: TitleBarType;
  titleBarOptions: TitleBarOption[];

  constructor() {
    super();
    this.showTips = 'always';
    this.showTipsOptions = [ { id: 'always', name: 'Everytime' }, { id: 'daily', name: 'Daily'}, { id: 'never', name: 'Never'} ];
    this.maxScrollbackLines = 500000;
    this.maxScrollbackFrames = 100;
    this.terminalFontSize = 12;
    this.commandLineActions = [];
    this.themeTerminal = "";
    this.themeTerminalOptions = [];

    this.themeSyntax = "";
    this.themeSyntaxOptions = [];

    this.themeGUI = "";
    this.themeGUIOptions = [];

    this.terminalFont = "";
    this.terminalFontOptions = [];

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

    this.titleBar = "theme";
    this.currentTitleBar = "theme";
    this.titleBarOptions = [
      { id: "theme", name: "Theme title bar" },
      { id: "native", name: "Native title bar" }
    ];
  }

  addCommandLineAction(): void {
    const emptyAction: IdentifiableCommandLineAction = { match: "", matchType: 'name', frame: true, id: nextId() };
    this.commandLineActions.push(emptyAction);
  }

  deleteCommandLineAction(id: string): void {
    const index = this.commandLineActions.findIndex(cla => cla.id === id);
    if (index !== -1) {
      this.commandLineActions.splice(index, 1);
    }
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

  setConfigDistributor(configDistributor: ConfigDistributor) {
    this.__configDistributor = configDistributor;
    this.$forceUpdate();
  }

  getConfigDistributor(): ConfigDistributor {
    return this.__configDistributor;
  }
}
