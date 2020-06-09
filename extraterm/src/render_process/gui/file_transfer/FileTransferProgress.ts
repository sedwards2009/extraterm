/**
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 */

import Component from 'vue-class-component';
import { Disposable } from '@extraterm/extraterm-extension-api';
import Vue from 'vue';
import {CustomElement, Attribute, Observe} from 'extraterm-web-component-decorators';

import {DebouncedDoLater} from 'extraterm-later';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import * as ThemeTypes from '../../../theme/Theme';
import { SpeedTracker } from './SpeedTracker';
import { formatHumanBytes, formatHumanDuration } from '../../../utils/TextUtils';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { ThemedContainerElementBase } from '../ThemedContainerElementBase';

type ActionType = "download" | "upload";


@Component(
{
  template: trimBetweenTags(`<div class="top_container" :title="formattedTooltip">
    <div v-if="finished" class="filename"><i class='fa fa-download'></i>&nbsp;{{name}}</div>
    <div v-else class="filename"><i class='fa fa-download'></i>&nbsp;{{actionMessage}}</div>

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
          <i class='far fa-hourglass'></i>&nbsp;{{formattedEta}}
        </template>
      </div>
    </template>
  </div>
</div>`)
})
class FileTransferUI extends Vue {
  name: string = "-";
  totalSize: number = 0;
  availableSize: number = 0;
  finished: boolean = false;
  etaSeconds = -1;
  speedBytesPerSecond = -1;
  averageSpeedBytesPerSecond = -1;
  actionType: ActionType = "download";

  get actionMessage(): string {
    const msgFormat = this.actionType === "download" ? "Downloading {{name}}" : "Uploading {{name}}";
    return msgFormat.replace("{{name}}", this.name);
  }

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

  get formattedTooltip(): string {
    if (this.finished) {
      const verb = this.actionType === "download" ? "download" : "upload";
      return `Completed ${verb} of ${this.formattedHumanAvailableBytes} (${this.formattedExactAvailableBytes} bytes)
at ${formatHumanBytes(this.averageSpeedBytesPerSecond)}/s`;

    } else {

      const verb = this.actionType === "download" ? "Downloaded" : "Uploaded";
      if (this.totalSize > 0) {
        const speed = this.speedBytesPerSecond === -1 ? "" : `
at ${formatHumanBytes(this.speedBytesPerSecond)}/s`;
        return `${verb} ${this.formattedHumanAvailableBytes} of ${this.formattedHumanTotalBytes}
(${this.formattedExactAvailableBytes} / ${this.formattedExactTotalBytes} bytes)${speed}`;

      } else {
        return `${verb} ${this.formattedHumanAvailableBytes} (${this.formattedExactAvailableBytes} bytes)`;
      }
    }
  }

  get progressPercent(): number {
    return this.totalSize === 0 ? 0 : Math.round(100 * this.availableSize / this.totalSize);
  }

  get formattedEta(): string {
    return formatHumanDuration(this.etaSeconds);
  }
}

@CustomElement("et-file-transfer-progress")
export class FileTransferProgress extends ThemedContainerElementBase implements Disposable {

  static TAG_NAME = "et-file-transfer-progress";

  private _log: Logger;
  private _ui: FileTransferUI = null;
  private _updateLater: DebouncedDoLater = null;
  private _speedTracker: SpeedTracker = null;

  constructor() {
    super();
    this._log = getLogger(FileTransferProgress.TAG_NAME, this);

    this._updateLater = new DebouncedDoLater(this._updateLaterCallback.bind(this), 250);

    this._ui = new FileTransferUI();
    const component = this._ui.$mount();
    this.getContainerNode().appendChild(component.$el);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._speedTracker = new SpeedTracker(this.total == null ? -1 : this.total);
  }

  @Attribute({default: ""}) public filename: string;

  @Observe("filename")
  private updateFilename(): void {
    this._ui.name = this.filename;
  }

  @Attribute({default: "download"}) public actionType: string;

  @Observe("actionType")
  private updateActionType(): void {
    if (this.actionType === "download" || this.actionType === "upload") {
      this._ui.actionType = this.actionType;
    }
  }

  @Attribute({default: null}) public total: number;

  @Observe("total")
  private updateTotal(): void {
    this._ui.totalSize = this.total;
    this._speedTracker = new SpeedTracker(this.total == null ? -1 : this.total);
  }

  @Attribute({default: null}) public transferred: number;

  @Observe("transferred")
  private _updateTransferred(): void {
    this._updateLater.trigger();
  }

  @Attribute({default: false}) public finished: boolean;

  @Observe("finished")
  private _updateFinished(): void {
    this._ui.finished = this.finished;
  }

  private _updateLaterCallback(): void {
    this._ui.availableSize = this.transferred;
    if (this._speedTracker != null) {
      this._speedTracker.updateProgress(this._ui.availableSize);
      this._ui.averageSpeedBytesPerSecond = this._speedTracker.getAverageSpeed();
      if (this._speedTracker.isSpeedAvailable()) {
        this._ui.etaSeconds = this._speedTracker.getETASeconds();
        this._ui.speedBytesPerSecond = this._speedTracker.getCurrentSpeed();
      }
    }
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    const types = super._themeCssFiles();
    types.push(ThemeTypes.CssFile.FONT_AWESOME);
    types.push(ThemeTypes.CssFile.GUI_FILE_TRANSFER_PROGRESS);
    return types;
  }

  dispose(): void {
    this._updateLater.cancel();
  }
}
