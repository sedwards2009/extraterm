/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { TermKeyStroke } from "../../keybindings/KeybindingsManager";
import { Event, EventEmitter } from "extraterm-event-emitter";


export class CommandKeybindingInfo {
  command: string;
  commandTitle: string;

  #onChangedEventEmitter = new EventEmitter<string>();
  onChanged: Event<string> = null;

  #baseKeyStrokeList: TermKeyStroke[] = null;
  #baseKeybindingsList: string[] = null;
  #customKeybindingsList: string[] | null = null;
  #customKeyStrokeList: TermKeyStroke[] | null = null;

  constructor(command: string, commandTitle: string) {
    this.onChanged = this.#onChangedEventEmitter.event;
    this.command = command;
    this.commandTitle = commandTitle;
  }

  set baseKeybindingsList(bindingsList: string[]) {
    this.#baseKeybindingsList = bindingsList;
    this.#baseKeyStrokeList = null;
  }

  get baseKeybindingsList(): string[] {
    return this.#baseKeybindingsList;
  }

  get baseKeyStrokeList(): TermKeyStroke[] {
    if (this.#baseKeyStrokeList == null) {
      this.#baseKeyStrokeList = this.baseKeybindingsList.map(TermKeyStroke.parseConfigString);
    }
    return this.#baseKeyStrokeList;
  }

  /**
   *
   * @param bindingsList A null for the `bindingsList` indicates that there
   *        are no custom overrides and the base values apply.
   */
  set customKeybindingsList(bindingsList: string[] | null) {
    this.#customKeybindingsList = bindingsList;
    this.#customKeyStrokeList = null;
    this.#onChangedEventEmitter.fire(this.command);
  }

  get customKeybindingsList(): string[] | null {
    return this.#customKeybindingsList;
  }

  get customKeyStrokeList(): TermKeyStroke[] | null {
    if (this.#customKeyStrokeList == null && this.#customKeybindingsList != null) {
      this.#customKeyStrokeList = this.#customKeybindingsList.map(TermKeyStroke.parseConfigString);
    }
    return this.#customKeyStrokeList;
  }
}
