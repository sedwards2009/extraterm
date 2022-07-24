/**
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 */
const SAMPLE_PERIOD_MS = 500;
const SMOOTHING_FACTOR = 0.05;

export class SpeedTracker {
  #creationTime = 0;
  #lastUpdateTime = -1;
  #lastBytesRead = 0;
  #currentSpeed = 0;
  #updateCounter = 0;
  #totalBytes = 0;

  constructor(totalBytes: number) {
    this.#totalBytes = totalBytes;
    this.#creationTime = performance.now();
    this.#lastUpdateTime = 0;
  }

  updateProgress(newReadBytes: number): void {
    const stamp = performance.now();

    if (this.#lastUpdateTime === -1) {
      const timePeriodSeconds = (stamp - this.#creationTime) / 1000;

      if (timePeriodSeconds !== 0) {
        const recentBytesPerSecond = newReadBytes / timePeriodSeconds;
        this.#currentSpeed = recentBytesPerSecond;;

        this.#lastUpdateTime = stamp;
        this.#lastBytesRead = newReadBytes;
      }
    } else {

      if ((stamp - this.#lastUpdateTime) > SAMPLE_PERIOD_MS) {
        const timePeriodSeconds = (stamp - this.#lastUpdateTime) / 1000;
        const recentBytesPerSecond = (newReadBytes - this.#lastBytesRead) / timePeriodSeconds;
        this.#currentSpeed = SMOOTHING_FACTOR * recentBytesPerSecond + (1-SMOOTHING_FACTOR) * this.#currentSpeed;

        this.#lastUpdateTime = stamp;
        this.#lastBytesRead = newReadBytes;
      }
    }
    this.#updateCounter++;
  }

  isSpeedAvailable(): boolean {
    return this.#updateCounter > 20;
  }

  getCurrentSpeed(): number {
    return this.#currentSpeed;
  }

  getAverageSpeed(): number {
    if (this.#lastBytesRead === 0) {
      return 0;
    }
    const timePeriodSeconds = (this.#lastUpdateTime - this.#creationTime) / 1000;
    return this.#lastBytesRead / timePeriodSeconds;
  }

  getETASeconds(): number {
    return (this.#totalBytes - this.#lastBytesRead) / this.#currentSpeed;
  }
}
