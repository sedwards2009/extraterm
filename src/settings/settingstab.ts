/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

"use strict";

import ViewerElement  = require("../viewerelement");
import util = require("../gui/util");

let registered = false;

class EtSettingsTab extends ViewerElement {
  
  static TAG_NAME = "et-settings-tab";

  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtSettingsTab.TAG_NAME, {prototype: EtSettingsTab.prototype});
      registered = true;
    }
  }
    
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
  
  createdCallback(): void {
    const shadow = util.createShadowRoot(this);
    const style = document.createElement('style');
    style.innerHTML = `
    .settingswebview {
      width: 100%;
      height: 100%;
    }
    `;
    const divContainer = document.createElement('div');
    divContainer.innerHTML = "<webview class='settingswebview' nodeintegration disablewebsecurity " +
      " experimental-features src='settings/settingsbootstrap.html'></webview>";
    const webView = <any> divContainer.childNodes[0]; // Should be BrowserWindow

    shadow.appendChild(style);
    shadow.appendChild(webView);
    
    webView.addEventListener("dom-ready", function() {
      webView.openDevTools();
    });    
  }
}

export = EtSettingsTab;
