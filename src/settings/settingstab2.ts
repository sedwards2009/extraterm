/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

// Settings tab using Vue.js

"use strict";

import _ = require('lodash');
import ThemeableElementBase = require('../themeableelementbase');
import ViewerElement  = require('../viewerelement');
import domutils = require('../domutils');
import Vue = require('vue');
import config = require('../config');
import ThemeTypes = require('../theme');
import Logger = require('../logger');
import LogDecorator = require('../logdecorator');
import GeneralEvents = require('../generalevents');

type Config = config.Config;
type CommandLineAction = config.CommandLineAction;
type FontInfo = config.FontInfo;

let registered = false;

const log = LogDecorator;

const ID_SETTINGS = "ID_SETTINGS";
const ID_SCROLLBACK = "ID_SCROLLBACK";
const ID_TERMINAL_FONT_SIZE = "ID_TERMINAL_FONT_SIZE";
const ID_COMMAND_OUTPUT_HANDLING = "ID_COMMAND_OUTPUT_HANDLING";
const CLASS_MATCH_TYPE = "CLASS_MATCH_TYPE";
const CLASS_MATCH = "CLASS_MATCH";
const CLASS_FRAME = "CLASS_FRAME";
const CLASS_DELETE = "CLASS_DELETE";

interface Identifiable {
  id?: string;
}

interface IdentifiableCommandLineAction extends CommandLineAction, Identifiable {
}

interface ModelData {
  scrollbackLines: number;
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
}

let idCounter = 0;
function nextId(): string {
  idCounter++;
  return "" + idCounter;
}

function setIds(list: Identifiable[]): void {
  list.forEach( (idable) => {
    if (idable.id === undefined) {
      idable.id = nextId();
    }
  });
}

function stripIds(list: Identifiable[]): void {
  list.forEach( (idable) => {
    if (idable.id !== undefined) {
      delete idable.id;
    }
  });  
}

class EtSettingsTab extends ViewerElement {
  
  static TAG_NAME = "et-settings-tab";
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtSettingsTab.TAG_NAME, {prototype: EtSettingsTab.prototype});
      registered = true;
    }
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically.
  private _log: Logger;
  
  private _vm: VueJSInstance<ModelData>;
  
  private _data: ModelData;
  
  private _config: Config;
  
  private _themes: ThemeTypes.ThemeInfo[];

  private _fontOptions: FontInfo[];

  private _initProperties(): void {
    this._log = new Logger(EtSettingsTab.TAG_NAME);
    this._vm = null;
    this._themes = [];
    this._config = null;
    this._fontOptions = [];
    this._data = {
      scrollbackLines: 10000,
      terminalFontSize: 12,
      commandLineActions: [],
      themeTerminal: "",
      themeTerminalOptions: [],
      
      themeSyntax: "",
      themeSyntaxOptions: [],
      
      themeGUI: "",
      themeGUIOptions: [],
      
      terminalFont: "",
      terminalFontOptions: []
    };
  }
  
  //-----------------------------------------------------------------------
  //
  // ######                                
  // #     # #    # #####  #      #  ####  
  // #     # #    # #    # #      # #    # 
  // ######  #    # #####  #      # #      
  // #       #    # #    # #      # #      
  // #       #    # #    # #      # #    # 
  // #        ####  #####  ###### #  ####  
  //
  //-----------------------------------------------------------------------

  get awesomeIcon(): string {
    return "wrench";
  }
  
  get title(): string {
    return "Settings";
  }

  focus(): void {
  }

  hasFocus(): boolean {
    // const root = util.getShadowRoot(this);
    // return root.activeElement !== null;
    return false;
  }
  
  set config(config: Config) {
    this._config = config;

    // We take care to only update things which have actually changed.
    if (this._data.scrollbackLines !== config.scrollbackLines) {
      this._data.scrollbackLines = config.scrollbackLines;
    }
    
    if (this._data.terminalFontSize !== config.terminalFontSize) {
      this._data.terminalFontSize = config.terminalFontSize;
    }
    
    if (this._data.terminalFont !== config.terminalFont) {
      this._data.terminalFont = config.terminalFont;
    }
    
    const newFontOptions = [...config.systemConfig.availableFonts];
    newFontOptions.sort( (a,b) => {
      if (a.name === b.name) {
        return 0;
      }
      return a.name < b.name ? -1 : 1;
    });
    
    if ( ! _.isEqual(this._fontOptions, newFontOptions)) {
      this._fontOptions = newFontOptions;
      this._data.terminalFontOptions = newFontOptions;
    }
  
    const cleanCommandLineAction = _.cloneDeep(this._data.commandLineActions);
    stripIds(cleanCommandLineAction);
    
    this._data.themeTerminal = config.themeTerminal;
    this._data.themeSyntax = config.themeSyntax;
    this._data.themeGUI = config.themeGUI;
    
    if ( ! _.isEqual(cleanCommandLineAction, config.commandLineActions)) {
      const updateCLA = _.cloneDeep(config.commandLineActions);
      setIds(updateCLA);
      this._data.commandLineActions = updateCLA;
    }
  }

  set themes(themes: ThemeTypes.ThemeInfo[]) {
    this._themes = themes;

    const getThemesByType = (type: ThemeTypes.ThemeType): ThemeTypes.ThemeInfo[] => {
      const themeTerminalOptions = this._themes
        .filter( (themeInfo) => themeInfo.type.indexOf(type) !== -1 );
      return _.sortBy(themeTerminalOptions, (themeInfo: ThemeTypes.ThemeInfo): string => themeInfo.name );
    };
    
    this._data.themeTerminalOptions = getThemesByType('terminal');
    this._data.themeSyntaxOptions = getThemesByType('syntax');
    this._data.themeGUIOptions = getThemesByType('gui');
  }

  //-----------------------------------------------------------------------
  //
  //   #                                                         
  //   #       # ###### ######  ####  #   #  ####  #      ###### 
  //   #       # #      #      #    #  # #  #    # #      #      
  //   #       # #####  #####  #        #   #      #      #####  
  //   #       # #      #      #        #   #      #      #      
  //   #       # #      #      #    #   #   #    # #      #      
  //   ####### # #      ######  ####    #    ####  ###### ###### 
  //
  //-----------------------------------------------------------------------

  /**
   * Custom Element 'created' life cycle hook.
   */
  createdCallback(): void {
    this._initProperties();
  }
  
  /**
   * Custom Element 'attached' life cycle hook.
   */
  attachedCallback(): void {
    super.attachedCallback();

    const shadow = domutils.createShadowRoot(this);
    const themeStyle = document.createElement('style');
    themeStyle.id = ThemeableElementBase.ID_THEME;

    const divContainer = document.createElement('div');

    shadow.appendChild(themeStyle);
    shadow.appendChild(divContainer);
    
    this.updateThemeCss();
    
    this._vm = new Vue({
      data: this._data,
      template: 
`<div id='${ID_SETTINGS}' className='settingspane'>
  <h2>Settings</h2>
  <div className='settingsform'>
  
    <div class="form-horizontal">
      <div class="form-group">
        <label for="terminal-font" class="col-sm-2 control-label">Terminal Font:</label>
        <div class="col-sm-4">
          <select class="col-sm-4 form-control" id="terminal-font" v-model="terminalFont">
            <option v-for="option in terminalFontOptions" v-bind:value="option.postscriptName">
              {{ option.name }}
            </option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="${ID_TERMINAL_FONT_SIZE}" class="col-sm-2 control-label">Terminal Font Size:</label>
        <div class="input-group col-sm-2">
          <input id="${ID_TERMINAL_FONT_SIZE}" type="number" class="form-control" number v-model="terminalFontSize" min='1'
            max='1024' debounce="100" />
          <div class="input-group-addon">pixels</div>
        </div>
      </div>

      <div class="form-group">
        <label for="${ID_SCROLLBACK}" class="col-sm-2 control-label">Scrollback:</label>
        <div class="input-group col-sm-2">
          <input id="${ID_SCROLLBACK}" type="number" class="form-control" number v-model="scrollbackLines" min='1'
            max='1000000' debounce="500" />
          <div class="input-group-addon">pixels</div>
        </div>
      </div>
    </div>

    <div class="form-horizontal">
      <h2>Theme</h2>
      <div class="form-group">
        <label for="theme-terminal" class="col-sm-2 control-label">Terminal Theme:</label>
        <div class="col-sm-3">
          <select class="form-control" id="theme-terminal" v-model="themeTerminal">
            <option v-for="option in themeTerminalOptions" v-bind:value="option.id">
              {{ option.name }}
            </option>
          </select>
        </div>
        <div class="col-sm-7">
          <p v-if="themeTerminalComment != ''" class="help-block">
            <i class="fa fa-info-circle"></i>
            {{themeTerminalComment}}
          </p>
        </div>
      </div>
      
      <div class="form-group">
        <label for="theme-terminal" class="col-sm-2 control-label">Text &amp; Syntax Theme:</label>
        <div class="col-sm-3">
          <select class="form-control" id="theme-terminal" v-model="themeSyntax">
            <option v-for="option in themeSyntaxOptions" v-bind:value="option.id">
              {{ option.name }}
            </option>
          </select>
        </div>
        <div class="col-sm-7">
          <p v-if="themeSyntaxComment != ''" class="help-block">
            <i class="fa fa-info-circle"></i>
            {{themeSyntaxComment}}
          </p>
        </div>
      </div>

      <div class="form-group">
        <label for="theme-terminal" class="col-sm-2 control-label">Interface Theme:</label>
        <div class="col-sm-3">
          <select class="form-control" id="theme-terminal" v-model="themeGUI">
            <option v-for="option in themeGUIOptions" v-bind:value="option.id">
              {{ option.name }}
            </option>
          </select>
        </div>
        <div class="col-sm-7">
          <p v-if="themeGUIComment != ''" class="help-block">
            <i class="fa fa-info-circle"></i>
            {{themeGUIComment}}
          </p>
        </div>
      </div>

    </div>

    <div id='${ID_COMMAND_OUTPUT_HANDLING}'>
      <h2>Command Output Handling Rules</h2>
      <table class="table" v-if="commandLineActions.length !== 0">
        <thead>
          <tr><th>Match</th><th>Command</th><th>Frame</th><th></th></tr>
        </thead>
        <tr v-for="commandLineAction in commandLineActions" track-by="id">
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
      </table>
      </div>
    </div>

  </div>
</div>
`,
      methods: {
        addCommandLineAction: (): void => {
          const emptyAction: IdentifiableCommandLineAction = { match: "", matchType: 'name', frame: true, id: nextId() };
          this._data.commandLineActions.push(emptyAction);
        },
        deleteCommandLineAction: (id: string): void => {
          const index = this._data.commandLineActions.findIndex( (cla) => cla.id === id);
          if (index !== -1) {
            this._data.commandLineActions.splice(index, 1);
          }
        }
      },
      computed: {
        themeTerminalComment: function() {
          const model = <ModelData> this;
          for (let option of model.themeTerminalOptions) {
            if (option.id === model.themeTerminal) {
              return option.comment;
            }
          }
          return "";
        },
        themeSyntaxComment: function() {
          const model = <ModelData> this;
          for (let option of model.themeSyntaxOptions) {
            if (option.id === model.themeSyntax) {
              return option.comment;
            }
          }
          return "";
        },
        themeGUIComment: function() {
          const model = <ModelData> this;
          for (let option of model.themeGUIOptions) {
            if (option.id === model.themeGUI) {
              return option.comment;
            }
          }
          return "";
        },
      }
    });
    this._vm.$mount(divContainer);
    this._vm.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false, sync: false } );
  }
  
  /**
   * Custom Element 'detached' life cycle hook.
   */
  detachedCallback(): void {
    super.detachedCallback();
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.SETTINGS_TAB];
  }

  //-----------------------------------------------------------------------
  //
  // ######                                      
  // #     # #####  # #    #   ##   ##### ###### 
  // #     # #    # # #    #  #  #    #   #      
  // ######  #    # # #    # #    #   #   #####  
  // #       #####  # #    # ######   #   #      
  // #       #   #  #  #  #  #    #   #   #      
  // #       #    # #   ##   #    #   #   ###### 
  //
  //-----------------------------------------------------------------------
  private _dataChanged(newVal: ModelData): void {
    const newConfig = _.cloneDeep(this._config);
    const model = _.cloneDeep(newVal);
    stripIds(model.commandLineActions);
    
    newConfig.scrollbackLines = model.scrollbackLines;
    newConfig.terminalFontSize = model.terminalFontSize;
    newConfig.terminalFont = model.terminalFont;
    newConfig.commandLineActions = model.commandLineActions;
    newConfig.themeTerminal = model.themeTerminal;
    newConfig.themeSyntax = model.themeSyntax;
    newConfig.themeGUI = model.themeGUI;

    const event = new CustomEvent(GeneralEvents.EVENT_CONFIG_CHANGE, { detail: {data: newConfig} });
    this.dispatchEvent(event);
  }
}

export = EtSettingsTab;
