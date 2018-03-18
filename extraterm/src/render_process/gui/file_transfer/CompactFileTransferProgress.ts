/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

import Component from 'vue-class-component';
import { Disposable } from 'extraterm-extension-api';
import Vue from 'vue';
import {WebComponent, Attribute, Observe} from 'extraterm-web-component-decorators';

import * as DomUtils from '../../DomUtils';
import {DebouncedDoLater} from '../../../utils/DoLater';
import {Logger, getLogger} from '../../../logging/Logger';
import log from '../../../logging/LogDecorator';
import {SimpleElementBase} from '../SimpleElementBase';
import * as ThemeTypes from '../../../theme/Theme';
import { SpeedTracker } from './SpeedTracker';
import { formatHumanBytes, formatHumanDuration } from '../../../utils/TextUtils';

type ActionType = "download" | "upload";


@Component(
{
  template: `<div class="top_container" :title="formattedTooltip">
    <i v-if="!finished" class="fa fa-download"></i>
    {{status}}
</div>`
})
class FileTransferUI extends Vue {
  totalSize: number = 0;
  availableSize: number = 0;
  finished: boolean = false;
  etaSeconds = -1;
  speedBytesPerSecond = -1;
  averageSpeedBytesPerSecond = -1;

  get status(): string {
    const progressPercent = this.totalSize === 0 ? 0 : Math.round(100 * this.availableSize / this.totalSize);
    if ( ! this.finished) {
      return `${formatHumanBytes(this.availableSize)} (${progressPercent}%)`;
    } else {
      return formatHumanBytes(this.availableSize);
    }
  }

  get formattedTooltip(): string {
    const progressPercent = this.totalSize === 0 ? 0 : Math.round(100 * this.availableSize / this.totalSize);
    if ( ! this.finished) {
      return `${formatHumanBytes(this.availableSize)}/${formatHumanBytes(this.totalSize)} (${progressPercent}%)
(${this.availableSize.toLocaleString("en-US")}b/${this.totalSize.toLocaleString("en-US")}b)
Time remaining ${formatHumanDuration(this.etaSeconds)}`;
    }
    return `${formatHumanBytes(this.availableSize)} (${this.availableSize.toLocaleString("en-US")} bytes)`;
  }
}

@WebComponent({tag: "et-compact-file-transfer-progress"})
export class FileTransferProgress extends SimpleElementBase implements Disposable {

  static TAG_NAME = "et-compact-file-transfer-progress";

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
    types.push(ThemeTypes.CssFile.GUI_COMPACT_FILE_TRANSFER_PROGRESS);
    return types;
  }

  dispose(): void {
    this._updateLater.cancel();
  }
}
