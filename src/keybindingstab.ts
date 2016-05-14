/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// Key bindings tab

"use strict";
import _ = require('lodash');
import ThemeTypes = require('./theme');
import ViewerElement  = require('./viewerelement');
import ThemeableElementBase = require('./themeableelementbase');
import KeyBindingManager = require('./keybindingmanager');
import Vue = require('vue');
import domutils = require('./domutils');
import configInterfaces = require('./config');
type Config = configInterfaces.Config;
import GeneralEvents = require('./generalevents');
import LogDecorator = require('./logdecorator');

var humanText = require('./keybindingstext.json');

const log = LogDecorator;

const ID_SELECTOR = "ID_SELECTOR";
const ID_KEY_BINDINGS = "ID_KEY_BINDINGS";
const CLASS_KEYCAP = "CLASS_KEYCAP";

let registered = false;

function contexts(): string[] {
  return humanText.contexts;
}

function commandName(commandCode: string): string {
  const str = humanText.commands[commandCode];
  return str || commandCode;
}

function contextHeading(contextName: string): string {
  const str = humanText.contextNames[contextName];
  return str || contextName;
}

interface ModelData {
  selectedKeyBindings: string;
  keyBindingsFiles: configInterfaces.KeyBindingInfo[];
  keyBindingsContextsStamp: any;
}

/**
 * The Extraterm Key Bindings tab.
 */
class EtKeyBindingsTab extends ViewerElement {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "ET-KEYBINDINGS-TAB";

  /**
   * Initialize the EtKeyBindingsTab class and resources.
   *
   * When EtKeyBindingsTab is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtKeyBindingsTab.TAG_NAME, {prototype: EtKeyBindingsTab.prototype});
      registered = true;
    }
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically.
  private _config: Config;
  
  private _vm: VueJSInstance<ModelData>;
  
  private _data: ModelData;

  private _initProperties(): void {
    this._config = null;
    this._vm = null;
    this._data = {
      selectedKeyBindings: "",
      keyBindingsFiles: [],
      keyBindingsContextsStamp: Date.now()
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
    return "keyboard-o";
  }
  
  get title(): string {
    return "Key Bindings";
  }

  focus(): void {
    // util.getShadowId(this, ID_CONTAINER).focus();
  }

  hasFocus(): boolean {
    return false;
  }
  
  set config(config: Config) {
    this._config = config;

    if (this._data.keyBindingsFiles.length !== config.systemConfig.keyBindingsFiles.length) {
      this._data.keyBindingsFiles = config.systemConfig.keyBindingsFiles;
    }
    if (this._data.selectedKeyBindings !== config.keyBindingsFilename) {
      this._data.selectedKeyBindings = config.keyBindingsFilename;
    }
  }
  
  protected keyBindingContextsChanged(contexts: KeyBindingManager.KeyBindingContexts): void {
    super.keyBindingContextsChanged(contexts);
    this._data.keyBindingsContextsStamp = Date.now();
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
    shadow.appendChild(themeStyle);
    
    const vueDivContainer = document.createElement('div');
    vueDivContainer.id = ID_KEY_BINDINGS;
    shadow.appendChild(vueDivContainer);
    
    Vue.config.debug = true;
    
    const elementThis: EtKeyBindingsTab = this;
    this._vm = new Vue({
      data: this._data,
      template: 
`<div className=''>
  <h1>Key Bindings</h1>
  
  <div className=''>
    <div class="form-horizontal">
      <div class="form-group">
        <label for="theme-terminal" class="col-sm-2 control-label">Key bindings style:</label>
        <div class="col-sm-3">
          <select class="form-control" id="keybindings-style" v-model="selectedKeyBindings">
            <option v-for="option in keyBindingsFiles" v-bind:value="option.filename">
              {{ option.name }}
            </option>
          </select>
        </div>
      </div>
  </div>
  
  {{{ summary }}}
</div>
`,
      computed: {
        summary: function() {
          const foo = this.keyBindingsContextsStamp;
          return formatKeyBindingsPage(elementThis.keyBindingContexts);
        }
      }
    });
    this._vm.$mount(vueDivContainer);
    this._vm.$watch('$data', this._dataChanged.bind(this), { deep: true, immediate: false, sync: false } );
    
    this.updateThemeCss();
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
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.KEY_BINDINGS_TAB];
  }
  
  @log
  private _dataChanged(newVal: ModelData): void {
    const newConfig = _.cloneDeep(this._config);
    if (newConfig.keyBindingsFilename !== newVal.selectedKeyBindings) {
      newConfig.keyBindingsFilename = newVal.selectedKeyBindings;

      const event = new CustomEvent(GeneralEvents.EVENT_CONFIG_CHANGE, { detail: {data: newConfig} });
      this.dispatchEvent(event);
    }
  }
}

function formatKeyBindingsPage(keyBindingContexts: KeyBindingManager.KeyBindingContexts): string {
  return contexts()
    .map( (contextName) => {
        return `<h2>${contextHeading(contextName)}</h2>` +  formatKeyBindingsMapping(keyBindingContexts.context(contextName));
      } ).join("");
}

function formatKeyBindingsMapping(context: KeyBindingManager.KeyBindingMapping): string {
  const bindings = _.clone(context.keyBindings);
  bindings.sort( (a,b): number => {
    const nameA = commandName(a.command);
    const nameB = commandName(b.command);
    return nameA < nameB ? -1 : ( nameA > nameB ? 1 : 0);
  });
  
  return `<table class='table'>
    <tr>
      <th class="col-md-7">Command</th>
      <th class="col-md-2">Shortcut</th>
      <th class="col-md-3">Code</th>
    </tr>` +
      bindings.map( (binding) => `<tr>
        <td class="col-md-7">${commandName(binding.command)}</td>
        <td class="col-md-2"><div class='${CLASS_KEYCAP}'><span>${binding.shortcut}</span></div></td>
        <td class="col-md-3">${binding.command}</td></tr>`).join("\n") +
      "</table>";
}

export = EtKeyBindingsTab;
