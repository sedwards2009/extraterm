/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

@Component(
  {
    template: `
    <div id="top_container" :title="formattedTooltip">
      <audio ref="player" :src="url"
        v-on:durationchange="onDurationChange"
        v-on:timeupdate="onTimeUpdate"
        v-on:ended="onEnded"></audio>

      <div id="title">
        <i class="fa fa-volume-up"></i>
        {{title}}
      </div>
      <div id="toolbar">
        <div class="btn-group">
          <button v-on:click="onPlayPauseClick" class="btn btn-default">
            <i v-if="!playing" class="fa fa-play"></i>
            <i v-if="playing" class="fa fa-pause"></i>
          </button>
        </div>
      </div>
      <div id="time">
        {{formattedTimes}}
      </div>
      <div id="progress_bar">
        <progress :max="progressMax" :value="progressValue"></progress>
      </div>
      <div id="file_size">
        <et-compact-file-transfer-progress
          :finished="downloadFinished"
          :total="totalSizeBytes"
          :transferred="availableSizeBytes">
        </et-compact-file-transfer-progress>
      </div>
    </div>`
})
export class AudioViewerUi extends Vue {
  title = "-";
  playing = false;
  url: string = null;
  currentTime = 0;
  duration = NaN;
  availableSizeBytes = 0;
  totalSizeBytes = 0;
  downloadFinished = false;

  get formattedTooltip(): string {
    return this.playing ? "Playing " + this.title : this.title;
  }

  get formattedTimes(): string {
    if (Number.isNaN(this.duration)|| ! Number.isFinite(this.duration)) {
      return formatTimeSeconds(this.currentTime);
    } else {
      return formatTimeSeconds(this.currentTime) + " / " + formatTimeSeconds(this.duration);
    }
  }

  get progressValue(): number {
    return Number.isFinite(this.duration) ? this.currentTime : 0;
  }

  get progressMax(): number {
    return Number.isFinite(this.duration) ? this.duration : 1;
  }

  private _getAudioElement(): HTMLAudioElement {
    return <HTMLAudioElement> this.$refs.player;
  }

  onPlayPauseClick(): void {
    const player = this._getAudioElement();
    if ( ! this.playing) {
      player.play();
      this.playing = true;
    } else {
      player.pause();
      this.playing = false;
    }
  }

  onTimeUpdate(): void {
    this.currentTime = this._getAudioElement().currentTime;
  }

  onDurationChange(): void {
    this.duration = this._getAudioElement().duration;
  }

  onEnded(): void {
    this.playing = false;
    this.currentTime = 0;
  }
}

function formatTimeSeconds(timeSeconds: number): string {
  const minutes = Math.floor(timeSeconds/60);
  const seconds = Math.round(timeSeconds % 60);
  const secondsPad = seconds < 10 ? "0" : "";
  return `${minutes}:${secondsPad}${seconds}`;
}
