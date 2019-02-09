/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
export const EVENT_CONTEXT_MENU_REQUEST = "EVENT_CONTEXT_MENU_REQUEST";
export const COMMAND_OPEN_CONTEXT_MENU = "COMMAND_OPEN_CONTEXT_MENU";

export enum ContextMenuType {
  NORMAL,
  NEW_TERMINAL_TAB
}

export function dispatchContextMenuRequest(element: HTMLElement, x: number, y: number, menuType=ContextMenuType.NORMAL): void {
  const detail = {x, y, menuType};
  const commandPaletteRequestEvent = new CustomEvent(EVENT_CONTEXT_MENU_REQUEST,
                                                     {bubbles: true, composed: true, detail});
  commandPaletteRequestEvent.initCustomEvent(EVENT_CONTEXT_MENU_REQUEST, true, true, detail);
  element.dispatchEvent(commandPaletteRequestEvent);
}
