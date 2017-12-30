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
      <div class="available-bytes-known-total">
        {{formattedHumanAvailableBytes}}
      </div>

      <div class="progress-container">
        <progress min="0" max="100" :value="progressPercent"></progress>
      </div>
      <div class="eta">
        <template v-if="etaSeconds !== -1 && ! finished">
          <i class='fa fa-hourglass-o'></i>&nbsp;{{formattedEta}}
        </template>
      </div>
    </template>
  </div>
</div>`
})
class DownloadUI extends Vue {
  name: string = "-";
  totalSize: number = 0;
  availableSize: number = 0;
  finished: boolean = false;
  etaSeconds = -1;
  speedBytesPerSecond = -1;
  averageSpeedBytesPerSecond = -1;

  get formattedExactAvailableBytes(): string {
    return this.availableSize.toLocaleString("en-US");
  }

  get formattedExactTotalBytes(): string {
    return this.totalSize.toLocaleString("en-US");
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
    if (this.finished) {
      return `Completed download of ${this.formattedHumanAvailableBytes} (${this.formattedExactAvailableBytes} bytes)
at ${formatHumanBytes(this.averageSpeedBytesPerSecond)}/s`;

    } else {

      if (this.totalSize > 0) {
        const speed = this.speedBytesPerSecond === -1 ? "" : `
at ${formatHumanBytes(this.speedBytesPerSecond)}/s`;

        return `Downloaded ${this.formattedHumanAvailableBytes} of ${this.formattedHumanTotalBytes}
(${this.formattedExactAvailableBytes} / ${this.formattedExactTotalBytes} bytes)${speed}`;

      } else {
        return `Downloaded ${this.formattedHumanAvailableBytes} (${this.formattedExactAvailableBytes} bytes)`;
      }
    }
  }

  get progressPercent(): number {
    return this.totalSize === 0 ? 0 : Math.round(100 * this.availableSize / this.totalSize);
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
      this._ui.averageSpeedBytesPerSecond = this._speedTracker.getAverageSpeed();
      if (this._speedTracker.isSpeedAvailable()) {
        this._ui.etaSeconds = this._speedTracker.getETASeconds();
        this._ui.speedBytesPerSecond = this._speedTracker.getCurrentSpeed();
      }
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
  return displayNumber.toLocaleString("en-US", {minimumFractionDigits: 1, maximumFractionDigits: 1}) + units;
}

const SAMPLE_PERIOD_MS = 500;
const SMOOTHING_FACTOR = 0.05;

class SpeedTracker {
  private _creationTime = 0;
  private _lastUpdateTime = -1;
  private _lastBytesRead = 0;
  private _currentSpeed = 0;
  private _updateCounter = 0;

  constructor(private _totalBytes: number) {
    this._creationTime = performance.now();
    this._lastUpdateTime = 0;
  }

  updateProgress(newReadBytes: number): void {
    const stamp = performance.now();

    if (this._lastUpdateTime === -1) {
      const timePeriodSeconds = (stamp - this._creationTime) / 1000;

      if (timePeriodSeconds !== 0) {
        const recentBytesPerSecond = newReadBytes / timePeriodSeconds;
        this._currentSpeed = recentBytesPerSecond;;

        this._lastUpdateTime = stamp;
        this._lastBytesRead = newReadBytes;
      }
    } else {

      if ((stamp - this._lastUpdateTime) > SAMPLE_PERIOD_MS) {
        const timePeriodSeconds = (stamp - this._lastUpdateTime) / 1000;
        const recentBytesPerSecond = (newReadBytes - this._lastBytesRead) / timePeriodSeconds;
        this._currentSpeed = SMOOTHING_FACTOR * recentBytesPerSecond + (1-SMOOTHING_FACTOR) * this._currentSpeed;

        this._lastUpdateTime = stamp;
        this._lastBytesRead = newReadBytes;
      }
    }
    this._updateCounter++;
  }

  isSpeedAvailable(): boolean {
    return this._updateCounter > 20;
  }

  getCurrentSpeed(): number {
    return this._currentSpeed;
  }

  getAverageSpeed(): number {
    if (this._lastBytesRead === 0) {
      return 0;
    }
    const timePeriodSeconds = (this._lastUpdateTime - this._creationTime) / 1000;
    return this._lastBytesRead / timePeriodSeconds;
  }

  getETASeconds(): number {
    return (this._totalBytes - this._lastBytesRead) / this._currentSpeed;
  }
}