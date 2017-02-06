/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface PluginMetaData {
  name: string;
  factory: string;
}

export interface ElementListener {
  (element: HTMLElement): void;
}

export interface ExtratermApi {
  addNewTopLevelEventListener(callback: ElementListener): void;
  addNewTabEventListener(callback: ElementListener): void;
  // registerViewer(): void;
}

export interface ExtratermPluginFactory {
  (api: ExtratermApi): ExtratermPlugin;
}

export interface ExtratermPlugin {
  
}
