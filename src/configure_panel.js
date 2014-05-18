/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
var _ = require('lodash-node');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * Configure Panel.
 * 
 * Emits event 'ok' with 1 parameter the config object when the OK button
 * is clicked. When the Cancel button is clicked, event 'cancel' is emitted.
 * 
 * @param {Object} options Object with format 'element', 'themes'
 * @returns {ConfigurePanel} The configuration panel.
 */
function ConfigurePanel(options) {
  var okButton;
  var cancelButton;
  var doc;
  var self = this;
  var themeSelect;
  
  if (!(this instanceof ConfigurePanel)) {
    throw new Error("Call ConfigurePanel using the new keyword.");
  }

  _.bindAll(this);
  
  this._element = options.element;
  doc = this._element.ownerDocument;
  
  this._themes = options.themes;

  okButton = doc.getElementById("ok_configure_button");
  okButton.addEventListener("click", this._handleOk);
  
  cancelButton = doc.getElementById("close_configure_button");
  cancelButton.addEventListener("click", this._handleCancel);
  
  themeSelect = doc.getElementById("theme_select");
  _.sortBy(_.keys(this._themes), function(a) {
    return this._themes[a].name;
  }, this).forEach(function(key) {
    var value = self._themes[key];
    var option = doc.createElement('option');
    option.value = key;
    option.text = value.name;
    themeSelect.add(option, null);
  });
  
}
util.inherits(ConfigurePanel, EventEmitter);

/**
 * Open the configure panel and show the configuration.
 * 
 * @param {Object} config The configuration to show.
 */
ConfigurePanel.prototype.open = function(config) {
  var doc = this._element.ownerDocument;
  var panel = doc.getElementById("configure_panel");
  
  this._configToGui(config);

  panel.classList.remove("configure_panel");
  panel.classList.add("configure_panel_open");
};

/**
 * Set the GUI to reflect a configuration.
 * 
 * @param {Object} config
 */
ConfigurePanel.prototype._configToGui = function(config) {
  var i;
  var doc = this._element.ownerDocument;
  var themeSelect;
  var blinkingCursorCheckbox;
  
  // Theme.
  themeSelect = doc.getElementById("theme_select");
  for (i=0; i<themeSelect.options.length; i++) {
    if (themeSelect.options[i].value === config.theme) {
      themeSelect.selectedIndex = i;
      break;
    }
  }
  
  // Blinking cursor.
  blinkingCursorCheckbox = doc.getElementById("blinking_cursor_checkbox");
  blinkingCursorCheckbox.checked = config.blinkingCursor;
};

/**
 * Get a config object which represents the state of the GUI.
 * 
 * @returns {Object} The new config.
 */
ConfigurePanel.prototype._guiToConfig = function() {
  var doc = this._element.ownerDocument;
  var themeSelect = doc.getElementById("theme_select");
  
  var blinkingCursorCheckbox = doc.getElementById("blinking_cursor_checkbox");
  var blinkingCursor = blinkingCursorCheckbox.checked;
  
  return { theme: themeSelect.value, blinkingCursor: blinkingCursor };
};

/**
 * Handler for OK button clicks.
 */
ConfigurePanel.prototype._handleOk = function() {
  this._close();
  this.emit('ok', this._guiToConfig());
};

/**
 * Handler for Cancel button clicks.
 */
ConfigurePanel.prototype._handleCancel = function() {
  this._close();
  this.emit('cancel');
};

/**
 * Close the dialog.
 */
ConfigurePanel.prototype._close = function() {
  var doc = this._element.ownerDocument;
  var panel = doc.getElementById("configure_panel");

  panel.classList.remove("configure_panel_open");
  panel.classList.add("configure_panel");
};

exports.ConfigurePanel = ConfigurePanel;
