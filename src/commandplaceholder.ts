/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import virtualscrollarea = require('./virtualscrollarea');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;

const ID = "EtCommandPlaceHolderTemplate";

let registered = false;

class EtCommandPlaceHolder extends HTMLElement implements VirtualScrollable {
  
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
   * Type guard for detecting a EtCommandPlaceHolder instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtCommandPlaceHolder.
   */
  static is(node: Node): node is EtCommandPlaceHolder {
    return node !== null && node !== undefined && node instanceof EtCommandPlaceHolder;
  }
  
  /**
   * Callback invoked by the browser after an instance of this element has been created.
   */
  createdCallback(): void {
    
  }

  getMinHeight(): number {
    return 0;
  }

  getVirtualHeight(containerHeight: number): number {
    return 0;
  }
  
  getReserveViewportHeight(containerHeight: number): number {
    return 0;
  }
  
  setHeight(height: number): void {
  }
  
  setScrollOffset(y: number): void {
  }
}

export = EtCommandPlaceHolder;
