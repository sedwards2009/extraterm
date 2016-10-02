/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import ThemeableElementBase = require('../themeableelementbase');
import ThemeTypes = require('../theme');
import domutils = require('../domutils');
import util = require('./util');
import he = require('he');
import CommandPaletteTypes = require('./commandpalettetypes');

const ID = "CbContextMenuTemplate";
const ID_COVER = "ID_COVER";
const ID_CONTEXT_COVER = "ID_CONTEXT_COVER";
const ID_CONTAINER = "ID_CONTAINER";
const ID_FILTER = "ID_FILTER";
const ID_RESULTS = "ID_RESULTS";

const CLASS_RESULT_ENTRY = "CLASS_RESULT_ENTRY";
const CLASS_RESULT_ICON_LEFT = "CLASS_RESULT_ICON_LEFT";
const CLASS_RESULT_ICON_RIGHT = "CLASS_RESULT_ICON_RIGHT";
const CLASS_RESULT_LABEL = "CLASS_RESULT_LABEL";
const CLASS_RESULT_SHORTCUT = "CLASS_RESULT_SHORTCUT";
const CLASS_RESULT_SELECTED = "CLASS_RESULT_SELECTED";
const CLASS_CONTEXT_COVER_OPEN = "CLASS_CONTEXT_COVER_OPEN";
const CLASS_CONTEXT_COVER_CLOSED = "CLASS_CONTEXT_COVER_CLOSED";
const CLASS_COVER_CLOSED = "CLASS_COVER_CLOSED";
const CLASS_COVER_OPEN = "CLASS_COVER_OPEN";

const ATTR_DATA_ID = "data-id";

let registered = false;

/**
 * A context menu.
 */
class CbCommandPalette extends ThemeableElementBase {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "CB-COMMANDPALETTE";

  /**
   * Initialize the CbCommandPalette class and resources.
   *
   * When CbContextMenu is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(CbCommandPalette.TAG_NAME, {prototype: CbCommandPalette.prototype});
      registered = true;
    }
  }

  // WARNING: Fields like this will not be initialised automatically.
  private _commandEntries: CommandPaletteTypes.CommandEntry[];
  
  private _selectedId: string;
  
  private _laterHandle: domutils.LaterHandle;
  
  private _initProperties(): void {
    this._commandEntries = [];
    this._selectedId = null;
    this._laterHandle = null;
  }

  set entries(entries: CommandPaletteTypes.CommandEntry[]) {
    this._commandEntries = entries;
    this._selectedId = null;
    
    const filterInput = <HTMLInputElement> domutils.getShadowId(this, ID_FILTER);
    if (filterInput !== null) {
      filterInput.value = "";
    }
    this._updateEntries();
  }

  get entries(): CommandPaletteTypes.CommandEntry[] {
    return this._commandEntries;
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
  createdCallback() {
    this._initProperties(); // Initialise our properties. The constructor was not called.
    const shadow = domutils.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();

    const filterInput = <HTMLInputElement> domutils.getShadowId(this, ID_FILTER);
    filterInput.addEventListener('input', (ev: Event) => {
      this._updateEntries();
    });
    
    filterInput.addEventListener('keydown', (ev: KeyboardEvent) => { this.handleKeyDown(ev); });
    
    const resultsDiv = domutils.getShadowId(this, ID_RESULTS);
    resultsDiv.addEventListener('click', (ev: Event) => {
      for (let node of ev.path) {
        if (node instanceof HTMLElement) {
          const dataId = node.attributes.getNamedItem(ATTR_DATA_ID);
          if (dataId !== undefined && dataId !== null) {
            this._executeId(dataId.value);
          }
        }
      }
    });

    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
    containerDiv.addEventListener('contextmenu', (ev) => {
      this._executeId(null);
    }); 

    const coverDiv = domutils.getShadowId(this, ID_COVER);
    coverDiv.addEventListener('mousedown', (ev) => {
      this._executeId(null);
    });
  }
  
  /**
   * 
   */
  private createClone() {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>
        <div id='${ID_COVER}' class='${CLASS_COVER_CLOSED}'></div>
        <div id='${ID_CONTEXT_COVER}' class='${CLASS_CONTEXT_COVER_CLOSED}'>
          <div id='${ID_CONTAINER}'>
            <div class="form-group"><input type="text" id="${ID_FILTER}" class="form-control input-sm" /></div>
            <div id="${ID_RESULTS}"></div>
          </div>
        </div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.GUI_COMMANDPALETTE];
  }
  
  //-----------------------------------------------------------------------
  private _updateEntries(): void {
    const filterInput = <HTMLInputElement> domutils.getShadowId(this, ID_FILTER);
    const filteredEntries = filterEntries(this._commandEntries, filterInput.value);
    
    if (filteredEntries.length === 0) {
      this._selectedId = null;
    } else {
      const newSelectedIndex = filteredEntries.findIndex( (entry) => entry.id === this._selectedId);
      this._selectedId = filteredEntries[Math.max(0, newSelectedIndex)].id;
    }
    
    const html = formatEntries(filteredEntries, this._selectedId);
    domutils.getShadowId(this, ID_RESULTS).innerHTML = html;
  }

  /**
   * 
   */
  private handleKeyDown(ev: KeyboardEvent) {
    // Escape.
    if (ev.keyIdentifier === "U+001B") {
      this._executeId(null);
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    
    const isPageKey = ev.keyIdentifier === "PageUp" || ev.keyIdentifier === "PageDown";
    const isUp = ev.keyIdentifier === "PageUp" || ev.keyIdentifier === "Up" || ev.keyIdentifier === "Home";
    
    if (isPageKey || isUp || ev.keyIdentifier === "Down" || ev.keyIdentifier === "End" || ev.keyIdentifier === "Enter") {
      ev.preventDefault();
      ev.stopPropagation();
      
      const filterInput = <HTMLInputElement> domutils.getShadowId(this, ID_FILTER);
      const filteredEntries = filterEntries(this._commandEntries, filterInput.value);
      if (filteredEntries.length === 0) {
        return;
      }
  
      const selectedIndex = filteredEntries.findIndex( (entry) => entry.id === this._selectedId);
      
      if (ev.keyIdentifier === "Enter") {
        // Enter
        if (this._selectedId !== null) {
          this._executeId(this._selectedId);
        }
      } else {
        
        const resultsDiv = domutils.getShadowId(this, ID_RESULTS);
        
        // Determine the step size.
        let stepSize = 1;
        if (isPageKey) {
          const selectedElement = <HTMLElement> resultsDiv.querySelector("."+CLASS_RESULT_SELECTED);
          const selectedElementDimensions = selectedElement.getBoundingClientRect();
          
          stepSize = Math.floor(resultsDiv.clientHeight / selectedElementDimensions.height);
        }
        
        if (isUp) {
          if (ev.keyIdentifier === "Home") {
            this._selectedId = filteredEntries[0].id;
          } else {
            this._selectedId = filteredEntries[Math.max(0, selectedIndex-stepSize)].id;
          }
        } else {
          if (ev.keyIdentifier === "End") {
            this._selectedId = filteredEntries[filteredEntries.length-1].id;
          } else {
            this._selectedId = filteredEntries[Math.min(filteredEntries.length-1, selectedIndex+stepSize)].id;
          }
        }
        
        const top = resultsDiv.scrollTop;
        this._updateEntries();
        resultsDiv.scrollTop = top;
        
        const selectedElement = <HTMLElement> resultsDiv.querySelector("."+CLASS_RESULT_SELECTED);
        const selectedRelativeTop = selectedElement.offsetTop - resultsDiv.offsetTop;
        if (top > selectedRelativeTop) {
          resultsDiv.scrollTop = selectedRelativeTop;
        } else {
          const selectedElementDimensions = selectedElement.getBoundingClientRect();
          if (selectedRelativeTop + selectedElementDimensions.height > top + resultsDiv.clientHeight) {
            resultsDiv.scrollTop = selectedRelativeTop + selectedElementDimensions.height - resultsDiv.clientHeight;
          }
        }
      }
    }
  }

  /**
   * 
   */
  open(x: number, y: number, width: number, height: number): void {
    // Nuke any style like 'display: none' which can be use to prevent flicker.
    this.setAttribute('style', '');
    
    const container = <HTMLDivElement> domutils.getShadowId(this, ID_CONTEXT_COVER);
    container.classList.remove(CLASS_CONTEXT_COVER_CLOSED);
    container.classList.add(CLASS_CONTEXT_COVER_OPEN);
  
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
  
    const cover = <HTMLDivElement> domutils.getShadowId(this, ID_COVER);
    cover.classList.remove(CLASS_COVER_CLOSED);
    cover.classList.add(CLASS_COVER_OPEN);
  
    const resultsDiv = <HTMLDivElement> domutils.getShadowId(this, ID_RESULTS);
    resultsDiv.style.maxHeight = `${height/2}px`;
  
    const filterInput = <HTMLInputElement> domutils.getShadowId(this, ID_FILTER);
    filterInput.value = "";
    this._updateEntries();
    filterInput.focus();
  }

  /**
   * 
   */
  close(): void {
    const cover = <HTMLDivElement> domutils.getShadowId(this, ID_COVER);
    cover.classList.remove(CLASS_COVER_OPEN);
    cover.classList.add(CLASS_COVER_CLOSED);
  
    const container = <HTMLDivElement> domutils.getShadowId(this, ID_CONTEXT_COVER);
    container.classList.remove(CLASS_CONTEXT_COVER_OPEN);
    container.classList.add(CLASS_CONTEXT_COVER_CLOSED);
  }
  
  private _executeId(dataId: string): void {
    if (this._laterHandle === null) {
      this._laterHandle = domutils.doLater( () => {
        this._laterHandle = null;
        const event = new CustomEvent('selected', { detail: {entryId: dataId } });
        this.dispatchEvent(event);
      });
    }
  }
  
}

function filterEntries(entries: CommandPaletteTypes.CommandEntry[], filter: string): CommandPaletteTypes.CommandEntry[] {
  const lowerFilter = filter.toLowerCase();
  return entries.filter( (entry) => entry.label.toLowerCase().includes(lowerFilter) );
}

function formatEntries(entries: CommandPaletteTypes.CommandEntry[], selectedId: string): string {
  return entries.map( (entry) => formatEntry(entry, entry.id === selectedId) ).join("");
}

function formatEntry(entry: CommandPaletteTypes.CommandEntry, selected: boolean): string {
  return `<div class='${CLASS_RESULT_ENTRY} ${selected ? CLASS_RESULT_SELECTED : ""}' ${ATTR_DATA_ID}='${entry.id}'>
    <div class='${CLASS_RESULT_ICON_LEFT}'>${formatIcon(entry.iconLeft)}</div>
    <div class='${CLASS_RESULT_ICON_RIGHT}'>${formatIcon(entry.iconRight)}</div>
    <div class='${CLASS_RESULT_LABEL}'>${he.encode(entry.label)}</div>
    <div class='${CLASS_RESULT_SHORTCUT}'>${entry.shortcut !== undefined && entry.shortcut !== null ? he.encode(entry.shortcut) : ""}</div>
  </div>`;
}

function formatIcon(iconName?: string): string {
  return `<i class='fa fa-fw ${iconName !== undefined && iconName !== null ? "fa-" + iconName : ""}'></i>`;
}

export = CbCommandPalette;
