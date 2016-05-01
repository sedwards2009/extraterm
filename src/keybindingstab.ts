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
import domutils = require('./domutils');
var humanText = require('./keybindingstext.json');

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
  
  private _initProperties(): void {
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
    divContainer.id = ID_KEY_BINDINGS;
    divContainer.innerHTML = `<h1>Key Bindings</h1>
    <p>Summary of current key bindings</p>
  ${this._formatKeyBindingsPage(this.keyBindingContexts)}
`;

    shadow.appendChild(themeStyle);
    shadow.appendChild(divContainer);    
    
    this.updateThemeCss();
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.KEY_BINDINGS_TAB];
  }
  
  private _formatKeyBindingsPage(keyBindingContexts: KeyBindingManager.KeyBindingContexts): string {
    return contexts()
      .map( (contextName) => {
          return `<h2>${contextHeading(contextName)}</h2>` +  this._formatKeyBindingsMapping(keyBindingContexts.context(contextName));
        } ).join("");
  }
  
  private _formatKeyBindingsMapping(context: KeyBindingManager.KeyBindingMapping): string {
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

export = EtKeyBindingsTab;
