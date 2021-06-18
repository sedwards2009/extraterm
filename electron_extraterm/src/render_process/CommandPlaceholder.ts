/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {CustomElement} from "extraterm-web-component-decorators";

import { VirtualScrollable, SetterState } from "./VirtualScrollArea";


/**
 * An invisible element which can be placed in a terminal to mark the start of command output.
 */
@CustomElement("et-command-placeholder")
export class CommandPlaceHolder extends HTMLElement implements VirtualScrollable {

  static TAG_NAME = "ET-COMMAND-PLACEHOLDER";
  static ATTR_COMMAND_LINE = "command-line";

  /**
   * Type guard for detecting a EtCommandPlaceHolder instance.
   *
   * @param  node the node to test
   * @return      True if the node is a EtCommandPlaceHolder.
   */
  static is(node: Node): node is CommandPlaceHolder {
    return node !== null && node !== undefined && node instanceof CommandPlaceHolder;
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

  setDimensionsAndScroll(setterState: SetterState): void {
  }

  markVisible(visible: boolean): void {
  }
}
