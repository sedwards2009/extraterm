/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */
import util = require('./gui/util');
import TabWidget = require('./gui/tabwidget');
import resourceLoader = require('./resourceloader');
import CbContextMenu = require('./gui/contextmenu');
import CbMenuItem = require('./gui/menuitem');
import CbDropDown = require('./gui/dropdown');

const ID = "ExtratermMainWebUITemplate";

const ID_CONTAINER = "container";

let registered = false;

class ExtratermMainWebUI extends HTMLElement {
  
  static init(): void {
    TabWidget.init();
    CbContextMenu.init();
    CbMenuItem.init();
    CbDropDown.init();
    
    if (registered === false) {
      window.document.registerElement(ExtratermMainWebUI.TAG_NAME, {prototype: ExtratermMainWebUI.prototype});
      registered = true;
    }
  }
  
  static TAG_NAME: string = 'extraterm-mainwebui';
  
  // WARNING: Fields like this will not be initialised automatically.
  
  private _css() {
    return `
    @import '${resourceLoader.toUrl('css/font-awesome.css')}';
    @import '${resourceLoader.toUrl('css/topcoat-desktop-light.css')}';
    #${ID_CONTAINER} {
      position: absolute;
      top: 2px;
      bottom: 0;
      left: 0;
      right: 0;
    }
    
    DIV.tab_bar_rest {
      display: flex;
      margin: 1px;
      margin-right: 2px;
    }
    
    DIV.tab_bar_rest > DIV.space {
      flex-grow: 1;
    }
    `;
  }

  private _html(): string {
    return `<cb-tabwidget id="${ID_CONTAINER}" show-frame="false">
        <cb-tab>Tab 1</cb-tab>
        <div>Tab 1 contents and stuff.</div>
        
        <div class="tab_bar_rest">
          <button class="topcoat-icon-button--quiet">
            <i class="fa fa-plus"></i>
          </button>
          <div class="space"></div>
          <cb-dropdown>
              <button class="topcoat-icon-button--large--quiet"><i class="fa fa-bars"></i></button>
              <cb-contextmenu>
                  <cb-menuitem icon="wrench" name="settings">Settings</cb-menuitem>
                  <cb-menuitem icon="lightbulb-o" name="about">About</cb-menuitem>
              </cb-contextmenu>
          </cb-dropdown>
        </div>
      </cb-tabwidget>`;
  }
  
  private _initProperties(): void {
  }
  
  createdCallback(): void {
    this._initProperties(); // Initialise our properties. The constructor was not called.
    
    var shadow = util.createShadowRoot(this);
    var clone = this._createClone();
    shadow.appendChild(clone);
        
  }
  
  private _createClone(): Node {
    var template: HTMLTemplate = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = "<style>" + this._css() + "</style>\n" + this._html();
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  private _getById(id: string): HTMLElement {
    return <HTMLElement>util.getShadowRoot(this).querySelector('#'+id);
  }
}

export = ExtratermMainWebUI;
