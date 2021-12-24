/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event } from "extraterm-event-emitter";
import { NodeWidget, QLabel } from "@nodegui/nodegui";


/**
 * A user defined configuration for a terminal session.
 *
 * This is represented in the UI as a session block in the Settings ->
 * "Session Types" tab. All of the different types of sessions have
 * these fields in common.
 */
export interface SessionConfiguration {
  /**
   * Unique identifier for this session type.
   */
  uuid: string;

  /**
   * Human readable name for this session type.
   */
  name: string;

  /**
   * Identifies this type of session and the back-end needed to run it.
   *
   * The value here matches that defined in the `contributes` ->
   * `sessionEditors` -> `type` field in the corresponding extension's
   * `package.json` file.
   */
  type?: string;

  /**
   * Command line arguments to be passed to shell command.
   */
  args?: string;

  /**
   * The initial directory in which to start the shell command.
   */
  initialDirectory?: string;

  /**
   * This is where the data for any extensions which is associated with this
   * session type are kept.
   *
   * Don not touch this.
   */
  extensions?: any;
}

/**
 * Extensions which implement Session Editors are given an instance of this.
 */
export interface SessionEditorBase {
  setSessionConfiguration(sessionConfiguration: SessionConfiguration): void;
  readonly sessionConfiguration: SessionConfiguration;
}


export interface SessionEditorFactory {
  (sessionEditorBase: SessionEditorBase): NodeWidget<any>;
}

/**
 * Simple object based string key to string value map used to hold environment variables.
 */
export interface EnvironmentMap {
  [key: string]: string;
}

/**
 * This interface defines the methods required from every session back-end.
 */
export interface SessionBackend {
  /**
   * Create some reasonable default session configurations for this back-end
   */
  defaultSessionConfigurations(): SessionConfiguration[];

  /**
   * Create a new live session
   */
  createSession(sessionConfiguration: SessionConfiguration, options: CreateSessionOptions): Pty;
}

/**
 * Extra options passed during session creation.
 */
export interface CreateSessionOptions {
  /**
   * Extra environment variables to set in the new terminal session.
   */
  extraEnv: EnvironmentMap;

  /**
   * The initial number of columns this terminal has.
   */
  cols: number;

  /**
   * The inital number of rows this terminal has.
   */
  rows: number;

  /**
   * A suggested directory in which this terminal session should start in.
   */
  workingDirectory?: string;
}

export interface BufferSizeChange {
  totalBufferSize: number;  // Sizes here are in 16bit characters.
  availableDelta: number;
}


/**
 * Represents a PTY.
 */
export interface Pty {
  /**
   * Write data to the pty
   *
   * @param data data to write.
   */
  write(data: string): void;

  getAvailableWriteBufferSize(): number;

  onAvailableWriteBufferSizeChange: Event<BufferSizeChange>;

  /**
   * Tell the pty that the size of the terminal has changed
   *
   * @param cols number of columns in ther terminal.
   * @param rows number of rows in the terminal.
   */
  resize(cols: number, rows: number): void;

  permittedDataSize(size: number): void;

  /**
   * Destroy the pty and shut down the attached process
   */
  destroy(): void;

  onData: Event<string>;

  onExit: Event<void>;

  /**
   * Get the working directory of the process on the other side of this PTY.
   *
   * @return The working directory or null if it could not be determined.
   */
  getWorkingDirectory(): Promise<string | null>;
}

/**
 *
 */
export interface SessionSettingsEditorBase {
  /**
   * Container element under which this session settings editor's contents can be placed.
   */
  readonly containerElement: HTMLElement;

  setSettings(settings: Object): void;

  readonly settings: Object;
}

export interface SessionSettingsEditorFactory {
  (sessionSettingsEditorBase: SessionSettingsEditorBase): void;
}
