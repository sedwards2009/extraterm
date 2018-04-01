/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */
import { Disposable, Event } from 'extraterm-extension-api';

interface OnChangeEmitter {
  onChange: Event<void>;
}

/**
 * Binds the handling of an OnChangeEmitter with the lifecycle of an HTML
 * custom element. It connects and disconnects to the onChange event as
 * the element is added and removed from the DOM. This is important to
 * avoid memory leaks where registered event handlers can keep the main
 * object alive.
 * 
 * The an onChange event is triggered, or when the element is connected to
 * the DOM, then the function passed to the constructor will be called.
 * 
 * To use this properly be sure to call the `connecteCallback()` and
 * `disconnectedCallback()` methods from the matching methods in your
 * custom element.
 */
export class OnChangeEmitterElementLifecycleBinder<E extends OnChangeEmitter> {

  private _connected = false;
  private _onChangeEmitter: E = null;
  private _onChangeEmitterDisposable: Disposable = null;

  constructor(private _onChangeCallback: (onChangeEmitter: E) => void) {
  }

  setOnChangeEmitter(onChangeEmitter: E): void {
    if (this._onChangeEmitter === onChangeEmitter) {
      return;
    }

    this._stopHandle();
    this._onChangeEmitter = onChangeEmitter;

    if (this._connected) {
      this._onChangeEmitterDisposable = this._onChangeEmitter.onChange(this._handleOnChange.bind(this));
      this._handleOnChange();
    }
  }

  getOnChangeEmitter(): E {
    return this._onChangeEmitter;
  }

  private _stopHandle(): void {
    if (this._onChangeEmitterDisposable != null) {
      this._onChangeEmitterDisposable.dispose();
      this._onChangeEmitterDisposable = null;
    }
  }

  private _handleOnChange(): void {
    if (this._onChangeEmitter != null) {
      this._onChangeCallback(this._onChangeEmitter);
    }
  }

  connectedCallback(): void {
    if (this._onChangeEmitter != null) {
      this._onChangeEmitterDisposable = this._onChangeEmitter.onChange(this._handleOnChange.bind(this));
    }

    this._connected = true;

    if (this._onChangeEmitter != null) {
      this._handleOnChange();
    }
  }

  disconnectedCallback(): void {
    this._stopHandle();
    this._connected = false;
  }
}
