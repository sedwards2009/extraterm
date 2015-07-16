import im = require('immutable');
import util = require('gui/util');

import config = require('./config');
import Theme = require('theme');

const ID = "EtConfigureDialog";
const ID_DIALOG = "dialog";

let registered = false;

class EtConfigureDialog extends HTMLElement {
  
  static tagName = 'et-configure-dialog';
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement(this.tagName, {prototype: EtConfigureDialog.prototype});
      registered = true;
    }
  }
  
  // WARNING: Fields like this will not be initialised automatically.
  
  private _css() {
    return "@import url('" + requirejs.toUrl("css/topcoat-desktop-light.css") + "');\n" +
      "@import url('" + requirejs.toUrl("css/flexlayout.css") + "');\n" +
      "#dialog {\n" +
      "    position: fixed;\n" +
      "    background-color: #F4F4F4;\n" +
      "    border: 0px;\n" +
      "    border-radius: 4px;\n" +
      "    padding: 8px;\n" +
      "    min-width: 30em;\n" +
      "}\n" +
      "DIV.configure_panel {\n" +
      "    display: flex;\n" +
      "    flex-direction: column;\n" +
      "}\n";
  }

  private _html(): string {
    return "<dialog id='" + ID_DIALOG + "'>" +
      "    <div id='configure_panel' class='configure_panel gui'>\n" +
      "        <div class='configure_content flexmin'>\n" +
      "            <h1 class='gui-heading'>Configure</h1>\n" +
      "            \n" +
      "            <div class='flexhlayout'><!-- horizonal center the lot. -->\n" +
      "                <div class='flexmax'></div>\n" +
      "                \n" +
      "                <div class='flexvlayout flexmin'><!-- column to hold all widgets -->\n" +
      "                    <div class='flexhlayout flexmin'><!-- Theme -->\n" +
      "                        <div class='flex1'>Theme:</div>\n" +
      "                        <div class='flex2'><select id='theme_select'></select></div>\n" +
      "                    </div>\n" +
      "                      \n" +
      "                    <div class='flexhlayout flexmin'><!-- Blinking cursor -->\n" +
      "                        <div class='flex1'></div>\n" +
      "                        <label class='topcoat-checkbox flex2'>\n" +
      "                          <input type='checkbox' id='blinking_cursor_checkbox'>\n" +
      "                          <div class='topcoat-checkbox__checkmark'></div>Blinking cursor\n" +
      "                        </label>\n" +
      "                    </div>\n" +
      "                </div>\n" +
      "                <div class='flexmax'></div>\n" +
      "            </div>\n" +
      "            <div class='vspace'></div>\n" +
      "            <div class='flexhlayout'>\n" +
      "                <button id='ok_configure_button' class='flexmax topcoat-button--large--cta'>OK</button>\n" +
      "                <div class='flexmax'></div>\n" +
      "                <button id='close_configure_button' class='flexmax topcoat-button--large'>Cancel</button>\n" +
      "            </div>\n" +
      "        </div>\n" +
      "    </div>\n" +
      "</dialog>";
  }
  
  createdCallback(): void {
    var shadow = util.createShadowRoot(this);
    var clone = this._createClone();
    shadow.appendChild(clone);
    
    var dialog = this._getById(ID_DIALOG);
    dialog.addEventListener('cancel', () => {
      this._handleCancel();
    });
    var okButton = this._getById("ok_configure_button");
    okButton.addEventListener("click",  () => {
      this._handleOk();
    });

    var cancelButton = this._getById("close_configure_button");
    cancelButton.addEventListener("click",  () => {
      this._handleCancel();
    });
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

  /**
   * Handler for OK button clicks.
   */
  private _handleOk(): void {
    this.close();
    
    var event = new CustomEvent('ok');
    event.initCustomEvent('ok', true, true, this._guiToConfig());
    this.dispatchEvent(event);
  }

  /**
   * Handler for Cancel button clicks.
   */
  private _handleCancel(): void {
    this.close();

    var event = new CustomEvent('cancel');
    event.initCustomEvent('cancel', true, true, null);
    this.dispatchEvent(event);
  }
  
  open(config: config.Config, themes: im.Map<string, Theme>): void {
    this._loadThemeSelect(themes);
    var dialog = <HTMLDialogElement> this._getById(ID_DIALOG);
    dialog.showModal();
  }
  
  close(): void {
    var dialog = <HTMLDialogElement> this._getById(ID_DIALOG);
    dialog.close();
  }  
  
  private _loadThemeSelect(themes: im.Map<string, Theme>): void {
    var themeSelect = <HTMLSelectElement>this._getById("theme_select");
    
    while(themeSelect.length !== 0) {
      themeSelect.remove(0);
    }
    
    themes.keySeq().sort().forEach( 
      (key) => {
        var value = themes.get(key);
        var option = this.ownerDocument.createElement('option');
        option.value = key;
        option.text = value.name;
        themeSelect.add(option, null);
      });
  }
  
  /**
   * Set the GUI to reflect a configuration.
   * 
   * @param {Object} config
   */
  private _configToGui(config: config.Config): void {
    // Theme.
    var themeSelect = <HTMLSelectElement>this._getById("theme_select");
    for (var i=0; i<themeSelect.options.length; i++) {
      if (themeSelect.options[i].value === config.theme) {
        themeSelect.selectedIndex = i;
        break;
      }
    }

    // Blinking cursor.
    var blinkingCursorCheckbox = <HTMLInputElement>this._getById("blinking_cursor_checkbox");
    blinkingCursorCheckbox.checked = config.blinkingCursor;
  }
  
  /**
   * Get a config object which represents the state of the GUI.
   * 
   * @returns {Object} The new config.
   */
  private _guiToConfig(): config.Config {
    var themeSelect = <HTMLSelectElement>this._getById("theme_select");

    var blinkingCursorCheckbox = <HTMLInputElement>this._getById("blinking_cursor_checkbox");
    var blinkingCursor = blinkingCursorCheckbox.checked;

    return { theme: themeSelect.value, blinkingCursor: blinkingCursor, systemConfig: null };
  }
  
}

export = EtConfigureDialog;
