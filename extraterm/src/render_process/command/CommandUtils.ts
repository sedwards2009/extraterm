import { CommonExtensionWindowState } from "../extension/CommonExtensionState";

/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
export const EVENT_CONTEXT_MENU_REQUEST = "EVENT_CONTEXT_MENU_REQUEST";
export const COMMAND_OPEN_CONTEXT_MENU = "COMMAND_OPEN_CONTEXT_MENU";

export enum ContextMenuType {
  NORMAL,
  NEW_TERMINAL_TAB,
  TERMINAL_TAB,
  WINDOW_MENU,
}

export type ExtensionContextOverride = Partial<CommonExtensionWindowState>;

export interface ContextMenuRequestEventDetail {
  x: number;
  y: number,
  menuType: ContextMenuType;
  extensionContextOverride: ExtensionContextOverride;
}

export function dispatchContextMenuRequest(element: HTMLElement, x: number, y: number,
    menuType=ContextMenuType.NORMAL, extensionContextOverride: ExtensionContextOverride=null): void {

  const detail: ContextMenuRequestEventDetail = {x, y, menuType, extensionContextOverride};
  const commandPaletteRequestEvent = new CustomEvent(EVENT_CONTEXT_MENU_REQUEST,
                                                     {bubbles: true, composed: true, detail});
  commandPaletteRequestEvent.initCustomEvent(EVENT_CONTEXT_MENU_REQUEST, true, true, detail);
  element.dispatchEvent(commandPaletteRequestEvent);
}
