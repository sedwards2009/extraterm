/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { EventEmitter } from "extraterm-event-emitter";
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { Direction, QLayout, QSizePolicyPolicy, QWidget, QWidgetSignals } from "@nodegui/nodegui";
import { BoxLayout, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";

import { BulkFile } from "../../bulk_file_handling/BulkFile.js";
import { Block } from "../../terminal/Block.js";
import { InternalExtensionContext } from "../../InternalTypes.js";


type Writeable<T> = { -readonly [P in keyof T]: T[P] };


export class ExtensionBlockImpl implements Block {
  private _log: Logger = null;

  #parent: any = null;
  #internalExtensionContext: InternalExtensionContext;
  #blockTypeName: string = null;
  #extensionBlockBlock: ExtensionBlockBlock = null;
  #details: any = null;
  #bulkFile: BulkFile = null;
  #widget: QWidget = null;
  #layout: QLayout = null;
  #contentWidget: QWidget = null;

  #metadata: Writeable<ExtensionApi.BlockMetadata> = {
    title: "ExtensionBlock",
    icon: "fa-check",
    posture: ExtensionApi.BlockPosture.SUCCESS,
    moveable: true,
    deleteable: true
  };
  #metadataChangedEventEmitter = new EventEmitter<void>();
  onMetadataChanged: ExtensionApi.Event<void>;

  #bulkFileWrapper: BulkFileWrapper = null;

  constructor(internalExtensionContext: InternalExtensionContext, blockTypeName: string, bulkFile: BulkFile) {
    this._log = getLogger("ExtensionBlockImpl", this);

    this.#internalExtensionContext = internalExtensionContext;
    this.#blockTypeName = blockTypeName;
    this.onMetadataChanged = this.#metadataChangedEventEmitter.event;
    this.#bulkFile = bulkFile;
    if (this.#bulkFile != null) {
      bulkFile.ref();
    }
    this.#bulkFileWrapper = new BulkFileWrapper(bulkFile);
    this.#extensionBlockBlock = new ExtensionBlockBlock(this, this.#bulkFileWrapper);

    this.#widget = Widget({
      contentsMargins: 0,
      sizePolicy: {
        vertical: QSizePolicyPolicy.Minimum,
        horizontal: QSizePolicyPolicy.Maximum,
      },
      layout: this.#layout = BoxLayout({
        contentsMargins: 0,
        direction: Direction.TopToBottom,
        children: []
      })
    });
  }

  dispose(): void {
    if (this.#bulkFile != null) {
      this.#bulkFile.deref();
      this.#bulkFile = null;
    }
  }

  getBlockTypeName(): string {
    return this.#blockTypeName;
  }

  getInternalExtensionContext(): InternalExtensionContext {
    return this.#internalExtensionContext;
  }

  setParent(parent: any): void {
    this.#parent = parent;
  }

  getParent(): any {
    return this.#parent;
  }

  setContentWidget(widget: QWidget): void {
    if (this.#contentWidget != null) {
      this.#contentWidget.hide();
      this.#contentWidget.setParent(null);
    }
    this.#contentWidget = widget;
    this.#layout.addWidget(this.#contentWidget);
  }

  getWidget(): QWidget<QWidgetSignals> {
    return this.#widget;
  }

  getMetadata(): ExtensionApi.BlockMetadata {
    return this.#metadata;
  }

  updateMetadata(change: ExtensionApi.BlockMetadataChange): void {
    this.#metadata = {...this.#metadata, ...change};
    this.#metadataChangedEventEmitter.fire();
  }

  getBulkFile(): BulkFile {
    return this.#bulkFile;
  }

  getExtensionBlock(): ExtensionApi.ExtensionBlock {
    return this.#extensionBlockBlock;
  }

  getTerminal(): ExtensionApi.Terminal {
    return this.#internalExtensionContext.wrapTerminal(this.#parent);
  }

  getDetails(): any {
    return this.#details;
  }

  setDetails(details: any): void {
    this.#details = details;
  }
}

class BulkFileWrapper implements ExtensionApi.BulkFileHandle {

  #bulkFile: BulkFile = null;

  #onStateChangedEventEmitter = new EventEmitter<ExtensionApi.BulkFileState>();
  onStateChanged: ExtensionApi.Event<ExtensionApi.BulkFileState>;

  #onAvailableSizeChangedEventEmitter = new EventEmitter<number>();
  onAvailableSizeChanged: ExtensionApi.Event<number>;

  constructor(bulkFile: BulkFile) {
    this.#bulkFile = bulkFile;
    this.onStateChanged = this.#onStateChangedEventEmitter.event;
    this.onAvailableSizeChanged = this.#onAvailableSizeChangedEventEmitter.event;
    this.#bulkFile.onAvailableSizeChanged(this.#handleOnAvailableSizeChanged.bind(this));
    this.#bulkFile.onStateChanged(this.#handleOnStateChanged.bind(this));
  }

  #handleOnAvailableSizeChanged(availableSize: number): void {
    this.#onAvailableSizeChangedEventEmitter.fire(availableSize);
  }

  #handleOnStateChanged(state: ExtensionApi.BulkFileState): void {
    this.#onStateChangedEventEmitter.fire(state);
  }

  get state(): ExtensionApi.BulkFileState {
    return this.#bulkFile.getState();
  }

  get url(): string {
    return this.#bulkFile.getUrl();
  }

  get availableSize(): number {
    return this.#bulkFile.getByteCount();
  }

  get totalSize(): number {
    return this.#bulkFile.getTotalSize();
  }

  get metadata(): ExtensionApi.BulkFileMetadata {
    return this.#bulkFile.getMetadata();
  }

  peek1KB(): Buffer {
    return this.#bulkFile.getPeekBuffer();
  }

  ref(): void {
    this.#bulkFile.ref();
  }

  deref(): void {
    this.#bulkFile.deref();
  }
}

class ExtensionBlockBlock implements ExtensionApi.ExtensionBlock {

  #bulkFileHandle: ExtensionApi.BulkFileHandle = null;
  #details: any = null;
  #extensionBlockImpl: ExtensionBlockImpl = null;

  constructor(extensionBlockImpl: ExtensionBlockImpl, bulkFileHandle: ExtensionApi.BulkFileHandle) {
    this.#extensionBlockImpl = extensionBlockImpl;
    this.#bulkFileHandle = bulkFileHandle;
  }

  set contentWidget(widget: QWidget) {
    this.#extensionBlockImpl.setContentWidget(widget);
  }

  get bulkFile(): ExtensionApi.BulkFileHandle {
    return this.#bulkFileHandle;
  }

  get metadata(): ExtensionApi.BlockMetadata {
    return this.#extensionBlockImpl.getMetadata();
  }

  get terminal(): ExtensionApi.Terminal {
    return this.#extensionBlockImpl.getTerminal();
  }

  updateMetadata(change: ExtensionApi.BlockMetadataChange): void {
    this.#extensionBlockImpl.updateMetadata(change);
  }

  set details(details: any) {
    this.#extensionBlockImpl.setDetails(details);
  }

  get details(): any {
    return this.#extensionBlockImpl.getDetails();
  }
}
