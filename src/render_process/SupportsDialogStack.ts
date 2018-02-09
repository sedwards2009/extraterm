/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import {Disposable} from 'extraterm-extension-api';


export interface SupportsDialogStack {
  /**
   * 
   */
  showDialog(element: HTMLElement): Disposable;
}

export function isSupportsDialogStack(el: any): el is SupportsDialogStack  {
  return (<SupportsDialogStack>el).showDialog !== undefined;
}
