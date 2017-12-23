/**
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 */

import { Disposable } from 'extraterm-extension-api';
import {WebComponent} from 'extraterm-web-component-decorators';
import Vue from 'vue';
import Component from 'vue-class-component';
import * as DomUtils from '../DomUtils';

import {BulkFileHandle, BulkFileState} from '../bulk_file_handling/BulkFileHandle';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import {SimpleViewerElement} from '../viewers/SimpleViewerElement';
import * as ThemeTypes from '../../theme/Theme';
import {ViewerElementMetadata, ViewerElement, ViewerElementPosture} from './ViewerElement';


@Component(
{
  template: `<div class="body container-fluid"">
  <div class="row">
    <div class="col-sm-6"><i class='fa fa-download'></i> {{name}}</div>
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

  private _updateLater: DomUtils.DebouncedDoLater = null;

  constructor() {
    super();
    this._log = getLogger("et-download-viewer", this);

    this._updateLater = new DomUtils.DebouncedDoLater(this._updateLaterCallback.bind(this), 500);

    this._ui = new DownloadUI();
    const component = this._ui.$mount();
    this.getContainerNode().appendChild(component.$el);
  }

  getMetadata(): ViewerElementMetadata {
    const metadata = super.getMetadata();
    metadata.title = "Download";
    metadata.icon = "download";
    if (this._bulkFileHandle != null) {
      const fileMetadata = this._bulkFileHandle.getMetadata()
      const filename = fileMetadata["filename"] != null ? fileMetadata["filename"] : "(unknown)";

      switch (this._bulkFileHandle.getState()) {
        case BulkFileState.DOWNLOADING:
          metadata.title = `Downloading ${filename}`;
          metadata.posture = ViewerElementPosture.NEUTRAL;
          metadata.icon = "cog";
          break;

        case BulkFileState.COMPLETED:
          metadata.title = `Completed downloading ${filename}`;
          metadata.posture = ViewerElementPosture.SUCCESS;
          metadata.icon = "check";
          break;

        case BulkFileState.FAILED:
          metadata.title = `Failed to download ${filename}`;
          metadata.posture = ViewerElementPosture.FAILURE;
          metadata.icon = "times";
          break;
      }
    }
    
    return metadata;
  }

  private _updateLaterCallback(): void {
    this._ui.availableSize = this._bulkFileHandle.getAvailableSize();
    
    const event = new CustomEvent(ViewerElement.EVENT_METADATA_CHANGE, { bubbles: true });
    this.dispatchEvent(event);
  }

  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    return ["application/octet-stream"].indexOf(mimeType) !== -1;
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    const types = super._themeCssFiles();
    types.push(ThemeTypes.CssFile.FONT_AWESOME);
    return types;
  }

  getBulkFileHandle(): BulkFileHandle {
    return this._bulkFileHandle;
  }

  setBulkFileHandle(handle: BulkFileHandle): void {
    this._releaseBulkFileHandle();

    this._bulkFileHandle = handle;
    handle.ref();

    this._onAvailableSizeChangeDisposable = this._bulkFileHandle.onAvailableSizeChange(
      () => this._updateLater.trigger());
    this._onStateChangeDisposable = this._bulkFileHandle.onStateChange(() => {
      this._ui.finished = true;
      this._updateLater.trigger()
    });
    this._ui.availableSize = handle.getAvailableSize();
    this._ui.totalSize = handle.getTotalSize()

    const metadata = handle.getMetadata();
    if (metadata["filename"] !== undefined) {
      this._ui.name = <string> metadata["filename"];
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
    this._updateLater.cancel();
    super.dispose();
  }
}
