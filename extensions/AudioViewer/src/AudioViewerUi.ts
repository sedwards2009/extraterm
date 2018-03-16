/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import Component from 'vue-class-component';
import Vue from 'vue';

@Component(
  {
    template: `<div id="top_container" :title="formattedTooltip">
    <audio ref="player" :src="url"
      v-on:durationchange="onDurationChange"
      v-on:timeupdate="onTimeUpdate"
      v-on:ended="onEnded"></audio>
    <div>
      {{title}}
    </div>
    <div class="btn-toolbar">
      <div class="btn-group">
        <button v-on:click="onPlayPauseClick" class="btn btn-default">
          <i v-if="!playing" class="fa fa-fw fa-play"></i>
          <i v-if="playing" class="fa fa-fw fa-pause"></i>
        </button>
      </div>
    </div>
    <div>
      {{formattedTime}}/{{formattedDuration}}
    </div>
  </div>`
})
export class AudioViewerUi extends Vue {
  title = "-";
  playing = false;
  url: string = null;
  currentTime = 0;
  duration = 0;

  get formattedTooltip(): string {
    return this.playing ? "Playing " + this.title : this.title;
  }

  get formattedTime(): string {
    return formatTimeSeconds(this.currentTime);
  }

  get formattedDuration(): string {
    return formatTimeSeconds(this.duration);
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
