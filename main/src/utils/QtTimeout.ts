/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QObject, TimerType, WidgetEventTypes, QTimerEvent } from "@nodegui/nodegui";

/**
 * A pair of `setTimeout()` and `clearTimeout()` functions backed by Qt's
 * event loop.
 *
 * Note: This is a bit of a work-around until Qode's timeout functions are
 * fixed on Windows.
 */
export class QtTimeout {
  #qobject: QObject = null;

  #timerFuncMap = new Map<number, () => void>();

  constructor() {
    this.#qobject = new QObject();
    this.#qobject.addEventListener(WidgetEventTypes.Timer, (ev) => {
      const event = new QTimerEvent(ev);
      const timerId = event.timerId();
      this.#qobject.killTimer(timerId);
      const func = this.#timerFuncMap.get(timerId);
      this.#timerFuncMap.delete(timerId);
      if (func != null) {
        func();
      }
    });
  }

  setTimeout(func: () => void, timeoutMS: number): number {
    const timerId = this.#qobject.startTimer(timeoutMS, TimerType.PreciseTimer);
    this.#timerFuncMap.set(timerId, func);
    return timerId;
  }

  clearTimeout(timerId: number): void {
    this.#timerFuncMap.delete(timerId);
    this.#qobject.killTimer(timerId);
  }
}
