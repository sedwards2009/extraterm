/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {BulkFileHandle, Disposable, Event, ViewerMetadata, ViewerPosture} from '@extraterm/extraterm-extension-api';
import { DebouncedDoLater } from "extraterm-later";
import {ThemeableElementBase} from '../ThemeableElementBase';
import {VirtualScrollable, SetterState} from '../VirtualScrollArea';
import {Mode, VisualState, CursorMoveDetail, RefreshLevel} from './ViewerElementTypes';
import { EventEmitter } from 'extraterm-event-emitter';
import { CommonExtensionWindowState } from "../extension/CommonExtensionState";
import { KeybindingsManager } from '../keybindings/KeyBindingsManager';
import { ExtensionManager } from '../extension/InternalTypes';
import { ConfigDatabase } from "../../ConfigDatabase";


export abstract class ViewerElement extends ThemeableElementBase implements VirtualScrollable, Disposable {

  static EVENT_BEFORE_SELECTION_CHANGE = "et-viewer-element_before-selection-change"
  static EVENT_CURSOR_MOVE = "et-viewer-element_cursor-move";
  static EVENT_CURSOR_EDGE = "et-viewer-element_cursor-edge";
  static EVENT_METADATA_CHANGE = "et-viewer-element_metadata-change";

  onDispose: Event<void>;
  #onDisposeEventEmitter = new EventEmitter<void>();

  #metadataEventDoLater: DebouncedDoLater = null;

  /**
   * Type guard for detecting a ViewerElement instance.
   *
   * @param  node the node to test
   * @return      True if the node is a ViewerElement
   */
  static isViewerElement(node: Node): node is ViewerElement {
    return node !== null && node !== undefined && node instanceof ViewerElement;
  }

  constructor() {
    super();
    this.#metadataEventDoLater = new DebouncedDoLater(() => {
      const event = new CustomEvent(ViewerElement.EVENT_METADATA_CHANGE, { bubbles: true });
      this.dispatchEvent(event);
    });
    this.onDispose = this.#onDisposeEventEmitter.event;
  }

  setDependencies(configDatabase: ConfigDatabase, keybindingsManager: KeybindingsManager,
      extensionManager: ExtensionManager): void {
  }

  getMetadata(): ViewerMetadata {
    return {
      title: "ViewerElement",
      icon: "fa fa-desktop",
      posture: ViewerPosture.NEUTRAL,
      moveable: true,
      deleteable: true,
      toolTip: null
    };
  }

  metadataChanged(): void {
    this.#metadataEventDoLater.trigger();
  }

  hasFocus(): boolean {
    return false;
  }

  /**
   * Gets the selected text.
   *
   * @return the selected text or null if there is no selection.
   */
  getSelectionText(): string {
    return null;
  }

  hasSelection(): boolean {
    return false;
  }

  clearSelection(): void {
  }

  isFocusable(): boolean {
    return false;
  }

  setFocusable(value: boolean) {
  }

  getVisualState(): VisualState {
    return VisualState.AUTO;
  }

  setVisualState(state: VisualState): void {
  }

  getMode(): Mode {
    return Mode.DEFAULT;
  }

  setMode(mode: Mode): void {
  }

  getMimeType(): string {
    return null;
  }

  setMimeType(mimetype: string): void {
  }

  getEditable(): boolean {
    return false;
  }

  setEditable(editable: boolean): void {
  }

  // VirtualScrollable
  getMinHeight(): number {
    return 0;
  }

  // VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    return 0;
  }

  // VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    return 0;
  }

  // VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {
  }

  markVisible(visible: boolean): void {
  }

  getCursorPosition(): CursorMoveDetail {
    return {
      left: 0,
      top: 0,
      bottom: 0,
      viewPortTop: 0
    };
  }

  setCursorPositionBottom(x: number): boolean {
    return false;
  }

  setCursorPositionTop(x: number): boolean {
    return false;
  }

  /**
   * Set the bulk file to display in the viewer.
   *
   * @param handle the file to load and display
   * @return A promise which is resolved once the file data has been loaded.
   */
  setBulkFileHandle(handle: BulkFileHandle): Promise<void> {
    throw Error("Not implemented.");
  }

  getBulkFileHandle(): BulkFileHandle {
    return null;
  }

  dispose(): void {
    this.#onDisposeEventEmitter.fire();
  }

  refresh(level: RefreshLevel): void {

  }

  /**
   * Provide additional context state for extensions.
   */
  getPartialCommonExtensionWindowState(): Partial<CommonExtensionWindowState> {
    return null;
  }

  didClose(): void {

  }
}
