import { CommonExtensionWindowState } from "../extension/CommonExtensionState";

/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
export const EVENT_CONTEXT_MENU_REQUEST = "EVENT_CONTEXT_MENU_REQUEST";

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

export const EVENT_HYPERLINK_CLICK = "EVENT_HYPERLINK_CLICK";

export interface HyperlinkEventDetail {
  url: string;
}

export function dispatchHyperlinkClick(element: HTMLElement, url: string): void {
  const detail: HyperlinkEventDetail = { url };
  const hyperlinkClickEvent = new CustomEvent(EVENT_HYPERLINK_CLICK, {bubbles: true, composed: true, detail});
  hyperlinkClickEvent.initCustomEvent(EVENT_HYPERLINK_CLICK, true, true, detail);
  element.dispatchEvent(hyperlinkClickEvent);
}
