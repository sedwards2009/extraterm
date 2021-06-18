/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */
const SAMPLE_PERIOD_MS = 500;
const SMOOTHING_FACTOR = 0.05;

export class SpeedTracker {
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
