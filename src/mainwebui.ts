/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */
import util = require('./gui/util');
import TabWidget = require('./gui/tabwidget');
import resourceLoader = require('./resourceloader');
import EtTerminal = require('./terminal');
import CbTab = require('./gui/tab');

const ID = "ExtratermMainWebUITemplate";

const ID_CONTAINER = "container";
const ID_REST_DIV = "rest";

let registered = false;

interface TerminalTab {
  id: number;
  terminalDiv: HTMLDivElement;
  cbTab: CbTab;
  terminal: EtTerminal;
};

let terminalIdCounter = 1;

class ExtratermMainWebUI extends HTMLElement {
  
  static init(): void {
    TabWidget.init();
    EtTerminal.init();
    
    if (registered === false) {
      window.document.registerElement(ExtratermMainWebUI.TAG_NAME, {prototype: ExtratermMainWebUI.prototype});
      registered = true;
    }
  }
  
  static TAG_NAME: string = 'extraterm-mainwebui';

  // WARNING: Fields like this will not be initialised automatically.
  private _terminalTabs: TerminalTab[];
  
  
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
    
    DIV.terminal_holder {
      height: 100%;
      width: 100%;
    }
    et-terminal {
      height: 100%;
      width: 100%;
    }
    `;
  }

  private _html(): string {
    return `<cb-tabwidget id="${ID_CONTAINER}" show-frame="false">
        <div id="${ID_REST_DIV}"><content></content></div>
      </cb-tabwidget>`;
  }
  
  private _initProperties(): void {
    this._terminalTabs = [];
  }
  
  createdCallback(): void {
    this._initProperties(); // Initialise our properties. The constructor was not called.
    
    var shadow = util.createShadowRoot(this);
    var clone = this._createClone();
    shadow.appendChild(clone);
    this.newTerminalTab();
  }
  
  /**
   * Create a new terminal tab
   *
   * @return ID of the new terminal.
   */
  newTerminalTab(): number {
    const newId = terminalIdCounter;
    terminalIdCounter++;
    const newCbTab = <CbTab> document.createElement(CbTab.TAG_NAME);
    newCbTab.innerHTML = "" + newId;
    
    const newDiv = document.createElement('div');
    newDiv.classList.add('terminal_holder');
    
    const newTerminal = <EtTerminal> document.createElement(EtTerminal.TAG_NAME);
    newDiv.appendChild(newTerminal);
    this._terminalTabs.push( { id: newId, terminalDiv: newDiv, cbTab: newCbTab, terminal: newTerminal } );
    
    const restDiv = this._getById(ID_REST_DIV);
    const containerDiv = this._getById(ID_CONTAINER);
    containerDiv.insertBefore(newCbTab, restDiv);
    containerDiv.insertBefore(newDiv, restDiv);
    
    return newId;
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
