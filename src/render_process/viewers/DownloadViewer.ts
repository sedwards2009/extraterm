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
  template: `<div class="container" :title="formattedTooltip">
    <div v-if="finished" class="filename"><i class='fa fa-download'></i>&nbsp;{{name}}</div>
    <div v-else class="filename"><i class='fa fa-download'></i>&nbsp;Downloading {{name}}</div>

    <div v-if="totalSize == -1" class="available-bytes-unknown-total">
      {{formattedHumanAvailableBytes}}
    </div>

    <template v-else>
      <template v-if="finished">
        <div class="available-bytes-known-total-finished">
          {{formattedHumanAvailableBytes}}
        </div>
      </template>

      <template>
        <div class="available-bytes-known-total">
          {{formattedHumanAvailableBytes}}
        </div>

        <div class="progress-container">
          <div class="progress">
            <div class="progress-bar" role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100" :style="progressStyle">
            {{progressPercent}}%
            </div>
          </div>
        </div>
        <div class="eta">
        <i class='fa fa-hourglass-o'></i>&nbsp;{{formattedEta}}
        </div>
      </template>
    </template>
  </div>
</div>`
})
class DownloadUI extends Vue {
  name: string = "-";
  totalSize: number = 0;
  availableSize: number = 0;
  finished: boolean = false;
  etaSeconds = 0;
  speedBytesPerSecond = 0;

  get formattedExactAvailableBytes(): string {
    return this.availableSize.toLocaleString("en-US");
  }

  get formattedHumanAvailableBytes(): string {
    return formatHumanBytes(this.availableSize);
  }

  get formattedHumanTotalBytes(): string {
    return formatHumanBytes(this.totalSize);
  }

  get progressStyle(): string {
    return `width: ${this.progressPercent}%;`;
  }

  get formattedTooltip(): string {
    return `Downloaded ${this.formattedHumanAvailableBytes} (${this.formattedExactAvailableBytes} bytes)`;
  }

  get progressPercent(): number {
    return Math.floor(100 * this.availableSize / this.totalSize);
  }

  get formattedEta(): string {
    const ONE_HOUR = 60 * 60;
    const ONE_MINUTE = 60;

    if (this.etaSeconds >= ONE_HOUR) {
      const hours = Math.floor(this.etaSeconds / ONE_HOUR);
      const minutes = Math.floor((this.etaSeconds % ONE_HOUR) / 60);
      return `${hours}h${minutes}m`;

    } else if (this.etaSeconds >= ONE_MINUTE) {
      const minutes = Math.floor(this.etaSeconds / ONE_MINUTE);
      const seconds = Math.floor(this.etaSeconds % ONE_MINUTE);
      return `${minutes}m${seconds}s`;

    } else {
      const seconds = Math.floor(this.etaSeconds);
      return `${seconds}s`;
    }
  }
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
  private _speedTracker: SpeedTracker = null;

  constructor() {
    super();
    this._log = getLogger("et-download-viewer", this);

    this._updateLater = new DomUtils.DebouncedDoLater(this._updateLaterCallback.bind(this), 250);

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
    if (this._speedTracker != null) {
      this._speedTracker.updateProgress(this._ui.availableSize);
      this._ui.etaSeconds = this._speedTracker.getETASeconds();
      this._ui.speedBytesPerSecond = this._speedTracker.getCurrentSpeed();
    }

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
    types.push(ThemeTypes.CssFile.DOWNLOAD_VIEWER);
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
    if (this._ui.totalSize !== -1) {
      this._speedTracker = new SpeedTracker(this._ui.totalSize);
    }

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

const SAMPLE_PERIOD_MS = 500;
const SMOOTHING_FACTOR = 0.05;

class SpeedTracker {
  private _timeStart = 0;
  private _startReadBytes = 0;
  private _currentSpeed = 0;

  constructor(private _totalBytes: number) {
    this._timeStart = performance.now();
  }

  updateProgress(newReadBytes: number): void {
    const stamp = performance.now();
    if ((stamp - this._timeStart) > SAMPLE_PERIOD_MS) {
      const timePeriodSeconds = (stamp - this._timeStart) / 1000;
      const recentBytesPerSecond = (newReadBytes - this._startReadBytes) / timePeriodSeconds;
      this._currentSpeed = SMOOTHING_FACTOR * recentBytesPerSecond + (1-SMOOTHING_FACTOR) * this._currentSpeed;

      this._timeStart = stamp;
      this._startReadBytes = newReadBytes;
    }
  }

  getCurrentSpeed(): number {
    return this._currentSpeed;
  }

  getETASeconds(): number {
    return (this._totalBytes - this._startReadBytes) / this._currentSpeed;
  }
}