/**
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 */

import { Disposable } from 'extraterm-extension-api';
import {WebComponent} from 'extraterm-web-component-decorators';
import Vue from 'vue';
import Component from 'vue-class-component';
import * as DomUtils from '../DomUtils';

import {BulkFileHandle} from '../bulk_file_handling/BulkFileHandle';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import {SimpleViewerElement} from '../viewers/SimpleViewerElement';
import {ViewerElementMetadata} from './ViewerElement';


@Component(
{
  template: `<div class="body container-fluid"">
  <div class="row">
    <div v-if="!finished" class="col-sm-6">{{name}}</div>
    <div v-if="finished" class="col-sm-6">Downloading {{name}}</div>
    <div class="col-sm-6">{{formattedHumanAvailableBytes}} &nbsp; ({{formattedExactAvailableBytes}} bytes)</div>
  </div>
</div>`
})
class DownloadUI extends Vue {
  name: string = "-";
  totalSize: number = 0;
  availableSize: number = 0;
  finished: boolean = false;

  get formattedExactAvailableBytes(): string {
    return this.availableSize.toLocaleString("en-US");
  }

  get formattedHumanAvailableBytes(): string {
    return formatHumanBytes(this.availableSize);
  }
}

function formatHumanBytes(numberBytes: number): string {
  const kibibytes = numberBytes / 1024;
  const mebibytes = numberBytes / (1024 * 1024);
  const gibibytes = numberBytes / (1024 * 1024 * 1024);
  let displayNumber = 0;
  let units = "";
  if (gibibytes > 1) {
    displayNumber = gibibytes;
    units = " GiB";
  } else if (mebibytes > 1) {
    displayNumber = mebibytes;
    units = " MiB";
  } else if (kibibytes > 1) {
    displayNumber = kibibytes;
    units = " KiB";
  } else {
    displayNumber = numberBytes;
    units = " b";
  }
  return displayNumber.toLocaleString("en-US", {maximumFractionDigits: 1}) + units;
}

@WebComponent({tag: "et-download-viewer"})
export class DownloadViewer extends SimpleViewerElement {

  static TAG_NAME = "et-download-viewer";

  private _log: Logger;
  private _bulkFileHandle: BulkFileHandle = null;
  private _ui: DownloadUI = null;
  private _onAvailableSizeChangeDisposable: Disposable = null;
  private _onStateChangeDisposable: Disposable = null;
  private _laterHandle: DomUtils.LaterHandle = null;

  constructor() {
    super();
    this._log = getLogger("et-download-viewer", this);

    this._ui = new DownloadUI();
    const component = this._ui.$mount();
    this.getContainerNode().appendChild(component.$el);
  }

  getMetadata(): ViewerElementMetadata {
    const metadata = super.getMetadata();
    metadata.title = "Download";
    metadata.icon = "download";
    return metadata;
  }

  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    return ["application/octet-stream"].indexOf(mimeType) !== -1;
  }

  getBulkFileHandle(): BulkFileHandle {
    return this._bulkFileHandle;
  }

  setBulkFileHandle(handle: BulkFileHandle): void {
    this._releaseBulkFileHandle();

    this._bulkFileHandle = handle;
    handle.ref();

    this._onAvailableSizeChangeDisposable = this._bulkFileHandle.onAvailableSizeChange(
      () => this._scheduleAvailableSizeUpdate());
    this._onStateChangeDisposable = this._bulkFileHandle.onStateChange(() => {
      this._ui.finished = true;
    });
    this._ui.availableSize = handle.getAvailableSize();
    this._ui.totalSize = handle.getTotalSize()

    const metadata = handle.getMetadata();
    if (metadata["filename"] !== undefined) {
      this._ui.name = <string> metadata["filename"];
    }
  }

  private _scheduleAvailableSizeUpdate(): void {
    if (this._laterHandle === null) {
      this._laterHandle = DomUtils.doLater(() => {
        this._ui.availableSize = this._bulkFileHandle.getAvailableSize();
        this._laterHandle = null;
      }, 500);
    }
  }

  private _releaseBulkFileHandle(): void {    
    if (this._bulkFileHandle !== null) {
      this._onAvailableSizeChangeDisposable.dispose();
      this._onStateChangeDisposable.dispose();
      this._bulkFileHandle.deref();
    }
    this._bulkFileHandle = null;
  }

  dispose(): void {
    this._releaseBulkFileHandle();
    if (this._laterHandle !== null) {
      this._laterHandle.cancel();
      this._laterHandle = null;
    }
    super.dispose();
  }
}
