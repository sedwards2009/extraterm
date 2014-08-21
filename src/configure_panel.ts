/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
///<reference path='chrome_lib.d.ts'/>
///<reference path='./typings/lodash/lodash.d.ts'/>
///<reference path="./typings/node/node.d.ts" />
import _ = require('lodash');

declare var nodeRequire: (s:string) => any;
var events = nodeRequire('events');
interface NewEventEmitter {
  new(): NodeJS.EventEmitter;
}
var EventEmitter = <NewEventEmitter>events.EventEmitter;

/**
 * Configure Panel.
 * 
 * Emits event 'ok' with 1 parameter the config object when the OK button
 * is clicked. When the Cancel button is clicked, event 'cancel' is emitted.
 * 
 * @param {Object} options Object with format 'element', 'themes'
 * @returns {ConfigurePanel} The configuration panel.
 */
class ConfigurePanel {
  
  private _element: Node;
  
  private _themes: any; // FIXME
  
  event: NodeJS.EventEmitter = new EventEmitter();
  
  constructor(options: { element: Node; themes: any[]; }) {
    _.bindAll(this);

    this._element = options.element;
    var doc = this._element.ownerDocument;

    this._themes = options.themes;

    var okButton = doc.getElementById("ok_configure_button");
    okButton.addEventListener("click", this._handleOk);

    var cancelButton = doc.getElementById("close_configure_button");
    cancelButton.addEventListener("click", this._handleCancel);

    var themeSelect = <HTMLSelectElement>doc.getElementById("theme_select");
    _.sortBy(_.keys(this._themes), (a) => this._themes[a].name)
      .forEach( (key) => {
        var value = this._themes[key];
        var option = doc.createElement('option');
        option.value = key;
        option.text = value.name;
        themeSelect.add(option, null);
      });
  }

  /**
   * Open the configure panel and show the configuration.
   * 
   * @param {Object} config The configuration to show.
   */
  open(config: any): void {
    var doc = this._element.ownerDocument;
    var panel = doc.getElementById("configure_panel");

    this._configToGui(config);

    panel.classList.remove("configure_panel");
    panel.classList.add("configure_panel_open");
  }

  /**
   * Set the GUI to reflect a configuration.
   * 
   * @param {Object} config
   */
  _configToGui(config: any): void {
    var doc = this._element.ownerDocument;

    // Theme.
    var themeSelect = <HTMLSelectElement>doc.getElementById("theme_select");
    for (var i=0; i<themeSelect.options.length; i++) {
      if (themeSelect.options[i].value === config.theme) {
        themeSelect.selectedIndex = i;
        break;
      }
    }

    // Blinking cursor.
    var blinkingCursorCheckbox = <HTMLInputElement>doc.getElementById("blinking_cursor_checkbox");
    blinkingCursorCheckbox.checked = config.blinkingCursor;
  }

  /**
   * Get a config object which represents the state of the GUI.
   * 
   * @returns {Object} The new config.
   */
  _guiToConfig() {
    var doc = this._element.ownerDocument;
    var themeSelect = <HTMLSelectElement>doc.getElementById("theme_select");

    var blinkingCursorCheckbox = <HTMLInputElement>doc.getElementById("blinking_cursor_checkbox");
    var blinkingCursor = blinkingCursorCheckbox.checked;

    return { theme: themeSelect.value, blinkingCursor: blinkingCursor };
  }

  /**
   * Handler for OK button clicks.
   */
  _handleOk(): void {
    this._close();
    this.event.emit('ok', this._guiToConfig());
  }

  /**
   * Handler for Cancel button clicks.
   */
  _handleCancel(): void {
    this._close();
    this.event.emit('cancel');
  }

  /**
   * Close the dialog.
   */
  _close(): void {
    var doc = this._element.ownerDocument;
    var panel = doc.getElementById("configure_panel");

    panel.classList.remove("configure_panel_open");
    panel.classList.add("configure_panel");
  }
}
