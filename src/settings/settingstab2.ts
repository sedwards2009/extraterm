/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

// Settings tab using Vue.js

"use strict";

import _ = require('lodash');
import globalcss = require('../gui/globalcss');
import ViewerElement  = require('../viewerelement');
import domutils = require('../domutils');
import Vue = require('vue');
import config = require('../config');
import ThemeTypes = require('../theme');
import Logger = require('../logger');
import LogDecorator = require('../logdecorator');

type Config = config.Config;
type CommandLineAction = config.CommandLineAction;

let registered = false;

const log = LogDecorator;

const ID_SETTINGS = "ID_SETTINGS";
const ID_THEME = "ID_THEME";
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

// Theme management
const activeInstances: Set<EtSettingsTab> = new Set();
let themeCss = "";

class EtSettingsTab extends ViewerElement {
  
  static TAG_NAME = "et-settings-tab";
  
  static EVENT_CONFIG_CHANGE = "config-changed";

  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtSettingsTab.TAG_NAME, {prototype: EtSettingsTab.prototype});
      registered = true;
    }
  }
  
  // Static method from the ThemeTypes.Themeable interface.
  static getCssFile(): ThemeTypes.CssFile {
    return ThemeTypes.CssFile.SETTINGS_TAB;
  }
  
  // Static method from the ThemeTypes.Themeable interface.
  static setThemeCss(cssText: string): void {
    themeCss = cssText;
    activeInstances.forEach( (instance) => {
      instance._setThemeCss(themeCss);
    });
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically.
  private _log: Logger;
  
  private _vm: VueJSInstance<ModelData>;
  
  private _data: ModelData;
  
  private _initProperties(): void {
    this._log = new Logger(EtSettingsTab.TAG_NAME);
    this._vm = null;
    this._data = {
      scrollbackLines: 10000,
      commandLineActions: []
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
    // We take care to only update things which have actually changed.
    
    if (this._data.scrollbackLines !== config.scrollbackLines) {
      this._data.scrollbackLines = config.scrollbackLines;
    }
    
    const cleanCommandLineAction = _.cloneDeep(this._data.commandLineActions);
    stripIds(cleanCommandLineAction);
    
    if ( ! _.isEqual(cleanCommandLineAction, config.commandLineActions)) {
      const updateCLA = _.cloneDeep(config.commandLineActions);
      setIds(updateCLA);
      this._data.commandLineActions = updateCLA;
    }
  }

  createdCallback(): void {
    this._initProperties();
  }
  
  attachedCallback(): void {
    activeInstances.add(this);

    const shadow = domutils.createShadowRoot(this);
    const style = document.createElement('style');
    style.innerHTML = globalcss.fontAwesomeCSS();
    
    const themeStyle = document.createElement('style');
    themeStyle.id = ID_THEME;
    themeStyle.textContent = themeCss;

    const divContainer = document.createElement('div');

    shadow.appendChild(style);
    shadow.appendChild(themeStyle);
    shadow.appendChild(divContainer);
    
    this._vm = new Vue({
      data: this._data,
      template: `<div id='${ID_SETTINGS}'className='settingspane'>
        <h1 className='gui-heading'>Settings</h1>
        <div className='settingsform'>
          <div>Scrollback:</div>
          <div><input type='number' number v-model="scrollbackLines" min='1' max='1000000' debounce="500" /> pixels</div>

          <div id='${ID_COMMAND_OUTPUT_HANDLING}'>
            <h2>Command Output Handling Rules</h2>
            <table v-if="commandLineActions.length !== 0">
              <thead>
                <tr><td>Match</td><td>Command</td><td>Frame</td><td></td></tr>
              </thead>
              <tr v-for="commandLineAction in commandLineActions" track-by="id">
                <td class='${CLASS_MATCH_TYPE}'><select v-model="matchType">
                  <option value="name">Match command name</option>
                  <option value="regexp">Match regular expression</option>
                  </select></td>
                <td class='${CLASS_MATCH}'><input type="text" v-model="commandLineAction.match" debounce="500" /></td>
                <td class='${CLASS_FRAME}'><input type="checkbox" v-model="commandLineAction.frame" /> frame</td>
                <td class='${CLASS_DELETE}'><button @click="deleteCommandLineAction(commandLineAction.id);">Delete</button></td>
              </tr>
            </table>
            <button @click="addCommandLineAction">New Rule</button>
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
      }
    });
    this._vm.$mount(divContainer);
    this._vm.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false, sync: false } );
  }
  
  detachedCallback(): void {
    activeInstances.delete(this);
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
  private _setThemeCss(cssText: string): void {
    if (domutils.getShadowRoot(this) === null) {
      return;
    }
    
    (<HTMLStyleElement> domutils.getShadowId(this, ID_THEME)).textContent = cssText;
  }
  
  private _dataChanged(newVal: ModelData): void {
    const cleanVersion = _.cloneDeep(newVal);
    stripIds(cleanVersion.commandLineActions);
    const event = new CustomEvent(EtSettingsTab.EVENT_CONFIG_CHANGE, { detail: {data: cleanVersion } });
    this.dispatchEvent(event);
  }
}

// This line below acts an assertion on the constructor function.
const themeable: ThemeTypes.Themeable = EtSettingsTab;

export = EtSettingsTab;
