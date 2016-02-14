/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import virtualscrollarea = require('./virtualscrollarea');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;

const ID = "EtCommandPlaceHolderTemplate";

let registered = false;

/**
 * An invisible element which can be placed in a terminal to mark the start of command output.
 */
class EtCommandPlaceHolder extends HTMLElement implements VirtualScrollable {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "ET-COMMANDPLACEHOLDER";
  
  static ATTR_COMMAND_LINE = "command-line";

  /**
   * Initialize the EtCommandPlaceHolder class and resources.
   *
   * When EtCommandPlaceHolder is imported into a render process, this static
   * method must be called before an instances may be created. This is can be
   * safely called multiple times.
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
    
  }

  //-----------------------------------------------------------------------

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
