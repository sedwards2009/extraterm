/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { EtTerminal } from '../Terminal';
import { TextEditor } from '../viewers/TextEditorType';
import { TabWidget } from '../gui/TabWidget';
import { ViewerElement } from '../viewers/ViewerElement';

// This is a way of passing through all of the state which is common across all extension contexts.

export interface CommonExtensionWindowState {
  activeTabContent: HTMLElement;
  activeTerminal: EtTerminal;
  focusTerminal: EtTerminal;
  activeTextEditor: TextEditor;
  focusTextEditor: TextEditor;
  activeTabsWidget: TabWidget;
  activeViewerElement: ViewerElement;
  focusViewerElement: ViewerElement;
}
