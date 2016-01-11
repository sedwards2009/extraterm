/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

// Settings tab using Vue.js

"use strict";

import ViewerElement  = require('../viewerelement');
import domutils = require('../domutils');
import Vue = require('vue');
import config = require('../config');

type Config = config.Config;

let registered = false;

interface ModelData {
  scrollbackLines: number;
  noFrameCommands: string[];
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
  private _vm: VueJSInstance<ModelData>;
  
  private _data: ModelData;
  
  private _initProperties(): void {
    this._vm = null;
    this._data = {
      scrollbackLines: 10000,
      noFrameCommands: []
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
    // util.getShadowId(this, ID_CONTAINER).focus();
  }

  hasFocus(): boolean {
    // const root = util.getShadowRoot(this);
    // return root.activeElement !== null;
    return false;
  }
  
  set config(config: Config) {
    this._data.scrollbackLines = config.scrollbackLines;
    this._data.noFrameCommands = config.noFrameCommands != null ? [...config.noFrameCommands] : [];
  }

  createdCallback(): void {
    this._initProperties();
  }
  
  attachedCallback(): void {
    const shadow = domutils.createShadowRoot(this);
    const style = document.createElement('style');
    style.innerHTML = `
    `;
    const divContainer = document.createElement('div');
    // divContainer.innerHTML = ;

    shadow.appendChild(style);
    shadow.appendChild(divContainer);
    
    this._vm = new Vue({
      data: this._data,
      template: `<div className='settingspane'>
        <h1 className='gui-heading'>Settings</h1>
        <div className='settingsform'>
          <div></div>
          <div>
            <label className='topcoat-checkbox flex2'>
              <input type='checkbox' checked='true' />
              <div className='topcoat-checkbox__checkmark'></div>Blinking cursor  
            </label>
          </div>
        
          <div>Scrollback:</div>
          <div><input type='number' number :value="scrollbackLines" min='1' max='10000' />lines</div>
          
          <div>Suppress Output Framing</div>
          <p>Commands which match these regular expressions will not have their output framed.</p>
          <div>
            <div v-for="pattern in noFrameCommands" track-by="$index">
              <input type="text" :value="pattern" /><button @click="deleteNoFrameCommand($index);">Delete</button>
            </div>
            <button @click="addNoFrameCommand">Add</button>
          </div>
          
        </div>
      </div>
`,
      methods: {
        addNoFrameCommand: (): void => {
          this._data.noFrameCommands.push("");
        },
        deleteNoFrameCommand: (index: number): void => {
          this._data.noFrameCommands.splice(index, 1);
        }
      }
    });
    this._vm.$mount(divContainer);
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
  
}

export = EtSettingsTab;
