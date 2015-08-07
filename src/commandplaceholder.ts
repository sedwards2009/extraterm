/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

const ID = "EtCommandPlaceHolderTemplate";

let registered = false;

class EtCommandPlaceHolder extends HTMLElement {
  
  static TAG_NAME = "ET-COMMANDPLACEHOLDER";

  /**
   * 
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtCommandPlaceHolder.TAG_NAME, {prototype: EtCommandPlaceHolder.prototype});
      registered = true;
    }
  }
  
  /**
   * Callback invoked by the browser after an instance of this element has been created.
   */
  createdCallback(): void {
    
  }

}

export = EtCommandPlaceHolder;
