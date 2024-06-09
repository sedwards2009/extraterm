/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {EventEmitter} from "extraterm-event-emitter";
import {Event, BufferSizeChange, Pty, Logger, EnvironmentMap} from "@extraterm/extraterm-extension-api";
import { DebouncedDoLater } from "extraterm-later";
import ssh2 from "ssh2";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { KnownHosts, VerifyResult, VerifyResultCode, makeHostPort } from "./KnownHosts";


const MAXIMUM_WRITE_BUFFER_SIZE = 64 * 1024;

export interface PtyOptions {
  cols: number;
  rows: number;
  env: EnvironmentMap;
  preMessage?: string;
  host: string;
  port: number;
  username: string;
  privateKeyFilenames?: string[];
  tryPasswordAuth: boolean;
  verboseLogging?: boolean;
}

enum PtyState {
  NEW,
  LIVE,
  HOST_KEY_CONFIRM,
  WAIT_EXIT_CONFIRM,
  WAIT_PASSWORD_ENTER,
  DEAD
}

export class SSHPty implements Pty {

  private _log: Logger;
  #sshConnection: ssh2.Client = null;
  #stream: ssh2.ClientChannel = null;
  #remainingPrivateKeyFilenames: string[] = [];
  #tryPasswordAuth = false;
  #passwordCallback: ssh2.NextAuthHandler = null;
  #password: string = "";

  #ptyOptions: PtyOptions = null;
  #verifyCallback: ssh2.VerifyCallback = null;

  #permittedDataSize = 0;
  #paused = true;
  #state = PtyState.NEW;
  #onDataEventEmitter = new EventEmitter<string>();
  #onExitEventEmitter = new EventEmitter<void>();
  #onAvailableWriteBufferSizeChangeEventEmitter = new EventEmitter<BufferSizeChange>();
  #outstandingWriteDataCount = 0;
  #emitBufferSizeLater: DebouncedDoLater = null;

  // Amount of data which went directly to the OS but still needs to 'announced' via an event.
  #directWrittenDataCount = 0;

  #knownHosts: KnownHosts = null;
  #remoteKey: ssh2.ParsedKey = null;

  onData: Event<string>;
  onExit: Event<void>;
  onAvailableWriteBufferSizeChange: Event<BufferSizeChange>;

  constructor(log: Logger, options: PtyOptions) {
    this._log = log;
    this.#ptyOptions = options;
    this.#remainingPrivateKeyFilenames = [...(options.privateKeyFilenames ?? [])];
    this.#tryPasswordAuth = options.tryPasswordAuth;
    this.onData = this.#onDataEventEmitter.event;
    this.onExit = this.#onExitEventEmitter.event;
    this.onAvailableWriteBufferSizeChange = this.#onAvailableWriteBufferSizeChangeEventEmitter.event;

    this.#sshConnection = new ssh2.Client();

    this.#sshConnection.on("error", (err: Error) => {
      log.warn(err);
      this.#state = PtyState.WAIT_EXIT_CONFIRM;
      this.#onDataEventEmitter.fire(`${err}\n\r\n[Connection closed. Press Enter to close this terminal.]`);
    });

    this.#sshConnection.on("ready", (): void => {
      const wndopts: ssh2.PseudoTtyOptions = {
        rows: this.#ptyOptions.rows,
        cols: this.#ptyOptions.cols,
        term: options.env["TERM"],
      };

      this.#sshConnection.shell(wndopts, {env: this.#ptyOptions.env}, (err, stream) => {
        if (err) {
          this.#state = PtyState.WAIT_EXIT_CONFIRM;
          this.#onDataEventEmitter.fire(`${err}\n\r\n[Connection closed. Press Enter to close this terminal.]`);
          return;
        }
        this.#stream = stream;

        stream.on("error", (err) => {
          log.warn(err);
          this.#state = PtyState.WAIT_EXIT_CONFIRM;
          this.#onDataEventEmitter.fire(`${err}\n\r\n[Connection closed. Press Enter to close this terminal.]`);
        });

        stream.on("handshake", (negotiated) => {
          const jsonStr = JSON.stringify(negotiated, null, 2);
          this.#onDataEventEmitter.fire(`${jsonStr}\n`);
        });

        stream.on("greeting", (message: string): void => {
          this.#onDataEventEmitter.fire(`${message}\n\n`);
        });

        stream.on("banner", (message: string, language: string): void => {
          this.#onDataEventEmitter.fire(`${message}\n\n`);
        });

        stream.on("keyboard-interactive", (name: string, instructions: string, instructionsLang: string,
            prompts: ssh2.Prompt[], finish: ssh2.KeyboardInteractiveCallback) => {
          log.debug(`keyboard-interactive name: ${name}, instructions: ${instructions}, instructionsLang: ${instructionsLang}, promps: ${prompts}`);
        });

        stream.on("close", (): void => {
          this._log.debug(`ssh close`);
          this.#closeSSHConnection();
        });

        stream.on("exit", (code: null, signal: string, dump: string, desc: string): void => {
        });

        stream.on("data", (data: string | Buffer): void => {
          let dataString: string = null;
          if (typeof data === 'string') {
            dataString = data;
          } else {
            dataString = data.toString();
          }
          this.permittedDataSize(this.#permittedDataSize - dataString.length);
          this.#onDataEventEmitter.fire(dataString);
        });

        stream.on("drain", () => {
          this.#directWrittenDataCount = 0;
          this.#outstandingWriteDataCount = 0;
          this.#emitBufferSizeLater.trigger();
        });

        this.#state = PtyState.LIVE;
      });
    });

    let debugFunction: ssh2.DebugFunction = undefined;
    if (options.verboseLogging) {
      debugFunction = (message: string): void => {
        this.#onDataEventEmitter.fire(`ssh logging: ${message}\n\r`);
      };
    }

    this.#sshConnection.connect({
      debug: debugFunction,
      host: options.host,
      port: options.port,
      username: options.username,
      tryKeyboard: false,
      authHandler: (
          methodsLeft: ssh2.AuthenticationType[],
          partialSuccess: boolean,
          callback: ssh2.NextAuthHandler) => {

        this.#handleAuth(methodsLeft, partialSuccess, callback);
      },
      hostVerifier: (key: Buffer, verify: ssh2.VerifyCallback): void => {
        this.#verifyHost(key, verify);
      },
      readyTimeout: 0  // Turn the timeout off
    });

    this.#emitBufferSizeLater = new DebouncedDoLater(this.#emitAvailableWriteBufferSizeChange.bind(this), 0);

    if (options.preMessage != null && options.preMessage !== "") {
      process.nextTick(() => {
        this.#onDataEventEmitter.fire(options.preMessage);
      });
    }
  }

  #verifyHost(key: Buffer, verify: ssh2.VerifyCallback): void {
    const parsedKey = ssh2.utils.parseKey(key);

    if (parsedKey instanceof Error) {
      this._log.warn(parsedKey);
      this.#onDataEventEmitter.fire(
        `Unable to parse the public key for host {this.#ptyOptions.host}` +
        `\n\r\n[Connection closed. Press Enter to close this terminal.]`);
      this.#state = PtyState.WAIT_EXIT_CONFIRM;
      verify(false);
      return;
    }

    this.#knownHosts = this.#readKnownHostsFiles();
    this.#remoteKey = parsedKey;
    const result = this.#knownHosts.verify(this.#ptyOptions.host, this.#ptyOptions.port, parsedKey);

    switch (result.result) {
      case VerifyResultCode.OK:
        verify(true);
        break;

      case VerifyResultCode.UNKNOWN:
        this.#handleHostUnknown(result, parsedKey, verify);
        break;

      case VerifyResultCode.REVOKED:
        this.#handleHostRevoked(result, parsedKey, verify);
        break;

      case VerifyResultCode.CHANGED:
        this.#handleHostChanged(result, parsedKey, verify);
        break;
    }
  }

  #handleHostUnknown(result: VerifyResult, parsedKey: ssh2.ParsedKey, verifyCallback: ssh2.VerifyCallback): void {
    const hostport = makeHostPort(this.#ptyOptions.host, this.#ptyOptions.port);
    const fingerprint = this.#keyBufferToFingerprint(parsedKey.getPublicSSH());
    this.#onDataEventEmitter.fire(
      `The authenticity of host ${hostport} can't be established.\n\r` +
      `${parsedKey.type} key fingerprint is ${fingerprint}.\n\r`);

    if (result.aliases.length === 0) {
      this.#onDataEventEmitter.fire("This key is not known by any other names.\n\r");
    } else {
      this.#onDataEventEmitter.fire("This host key is known by the following other names/addresses:\n\r");
      for (const alias of result.aliases) {
        this.#onDataEventEmitter.fire(`    ${alias.filename}:${alias.lineNumber}: ${alias.host}\n\r`);
      }
    }

    this.#onDataEventEmitter.fire(`Are you sure you want to continue connecting (y/n) `);
    this.#state = PtyState.HOST_KEY_CONFIRM;
    this.#verifyCallback = verifyCallback;
  }

  #handleHostKeyWrite(data: string): void {
    // Handle 'n' for no and treat Ctrl+C as no too.
    if (data.indexOf("n") !== -1 || data.indexOf(String.fromCodePoint(0x03)) !== -1) {
      this.#onDataEventEmitter.fire("\r\n");
      this.#state = PtyState.NEW;
      this.#verifyCallback(false);
      return;
    }

    // Accept 'y' key.
    if (data.indexOf("y") !== -1) {
      this.#state = PtyState.NEW;

      this.#knownHosts.appendHost(this.#ptyOptions.host, this.#ptyOptions.port, this.#remoteKey,
        this.#getUserKnownHostsFilePath());
      this.#writeUserKnownHosts(this.#knownHosts);

      const hostport = makeHostPort(this.#ptyOptions.host, this.#ptyOptions.port);
      this.#onDataEventEmitter.fire(
        `\r\nWarning: Permanently added ${hostport} (${this.#remoteKey.type}) to the list of known hosts.\r\n`);

      this.#verifyCallback(true);
      return;
    }
  }

  #writeUserKnownHosts(knownHosts: KnownHosts): void {
    const userKnownHostsPath = this.#getUserKnownHostsFilePath();

    // Create all of the parent directories in the path userKnownHostsPath.
    const dirPath = path.dirname(userKnownHostsPath);
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        this._log.warn(err);
        return;
      }
    }

    fs.writeFileSync(userKnownHostsPath, knownHosts.dumpString(userKnownHostsPath));
  }

  #handleHostRevoked(result: VerifyResult, parsedKey: ssh2.ParsedKey, verifyCallback: ssh2.VerifyCallback): void {
    const hostport = makeHostPort(this.#ptyOptions.host, this.#ptyOptions.port);

    const warningBar = warningStripe(60);
    const warningSide = warningStripe(2, 1);

    this.#onDataEventEmitter.fire(`${warningBar}\n\r` +
      `${warningSide}      WARNING: REVOKED HOST KEY DETECTED!               ${warningSide}\n\r` +
      `${warningBar}\n\r` +
      `The ${parsedKey.type} host key for ${hostport} is marked as revoked.\n\r` +
      `This could mean that a stolen key is being used to\n\r` +
      `impersonate this host.\n\r` +
      `Revoked key found at ${result.filename}:${result.lineNumber}.\n\r` +
      `Host key verification failed.\n\r`
    );
    verifyCallback(false);
  }

  #handleHostChanged(result: VerifyResult, parsedKey: ssh2.ParsedKey, verifyCallback: ssh2.VerifyCallback): void {
    const hostport = makeHostPort(this.#ptyOptions.host, this.#ptyOptions.port);
    const fingerprint = this.#keyBufferToFingerprint(parsedKey.getPublicSSH());

    const warningBar = warningStripe(60);
    const warningSide = warningStripe(2, 1);

    this.#onDataEventEmitter.fire(`${warningBar}\n\r` +
      `${warningSide}      WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!  ${warningSide}\n\r` +
      `${warningBar}\n\r` +
      `IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!\n\r` +
      `Someone could be eavesdropping on you right now (man-in-the-middle attack)!\n\r` +
      `It is also possible that a host key has just been changed.\n\r` +
      `The fingerprint for the ${parsedKey.type} host key sent by ${hostport} is\n\r` +
      `${fingerprint}\n\r` +
      `Add the correct host key to ${this.#getUserKnownHostsFilePath()} to get rid of this message.\n\r` +
      `Offending ${parsedKey.type} key in ${result.filename}:${result.lineNumber}\n\r` +
      `Host key verification failed.\n\r`
    );
    verifyCallback(false);
  }

  #readKnownHostsFiles(): KnownHosts {
    const knownHosts = new KnownHosts(this._log);

    const systemKnownHostsPath = this.#getSystemKnownHostsFilePath();
    if (fs.existsSync(systemKnownHostsPath)) {
      const knownHostsContent = fs.readFileSync(systemKnownHostsPath, "utf8");
      knownHosts.loadString(knownHostsContent, systemKnownHostsPath);
    }

    const userKnownHostsPath = this.#getUserKnownHostsFilePath();
    if (fs.existsSync(userKnownHostsPath)) {
      const knownHostsContent = fs.readFileSync(userKnownHostsPath, "utf8");
      knownHosts.loadString(knownHostsContent, userKnownHostsPath);
    }

    return knownHosts;
  }

  #getUserKnownHostsFilePath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, ".ssh", "known_hosts");
  }

  #getSystemKnownHostsFilePath(): string {
    return "/etc/ssh/known_hosts";
  }

  #keyBufferToFingerprint(buf: Buffer): string {
    const hash = crypto.createHash("sha256");
    hash.update(buf);
    return "SHA256:" + hash.digest("base64");
  }

  #handleAuth(
      methodsLeft: ssh2.AuthenticationType[],
      partialSuccess: boolean,
      callback: ssh2.NextAuthHandler): void {

    while (this.#remainingPrivateKeyFilenames.length !== 0) {
      const keyFilename = this.#remainingPrivateKeyFilenames.pop();
      if (this.#handlePrivateKeyAuth(keyFilename, callback)) {
        return;
      }
    }

    if (this.#tryPasswordAuth) {
      this.#startPasswordInput(callback);
      return;
    }

    callback(<any>false);
  }

  #startPasswordInput(callback: ssh2.NextAuthHandler): void {
    this.#passwordCallback = callback;
    this.#state = PtyState.WAIT_PASSWORD_ENTER;
    this.#onDataEventEmitter.fire(`\r\n${this.#ptyOptions.username}@${this.#ptyOptions.host}'s password: `);
  }

  #handlePasswordWrite(data: string): void {
    this.#password = applyBackspaceChars(this.#password + data);

    const enterIndex = this.#password.indexOf("\r");
    if (enterIndex !== -1) {
      this.#passwordCallback({
        type: "password",
        username: this.#ptyOptions.username,
        password: this.#password.substring(0, enterIndex)
      });
      this.#password = "";
      this.#onDataEventEmitter.fire("\n\r\n");
      this.#state = PtyState.NEW;
    }

    // Handle Ctrl+C to cancel
    if (this.#password.indexOf(String.fromCodePoint(0x03)) !== -1) {
      this.#closeSSHConnection();
    }
  }

  #handlePrivateKeyAuth(keyFilename: string, callback: ssh2.NextAuthHandler): boolean {
    try {
      if (fs.existsSync(keyFilename)) {
        const fileContents = fs.readFileSync(keyFilename);
        callback({
          type: "publickey",
          username: this.#ptyOptions.username,
          key: fileContents
        });
        return true;
      }
    } catch (error) {
      this._log.warn(`Failed to read private key file '${keyFilename}'. ${error}`);
    }
    return false;
  }

  #closeSSHConnection(): void {
    this.#onDataEventEmitter.fire(`\n\r\n[Connection closed. Press Enter to close this terminal.]`);
    this.#state = PtyState.WAIT_EXIT_CONFIRM;
    this.#sshConnection.end();
  }

  write(data: string): void {
    switch (this.#state) {
      case PtyState.LIVE:
        if (this.#stream.stdin.write(data)) {
          this.#directWrittenDataCount += data.length;
          this.#emitBufferSizeLater.trigger();
        } else {
          this.#outstandingWriteDataCount += data.length;
        }
        break;

      case PtyState.WAIT_EXIT_CONFIRM:
        // See if the user hit the Enter key to fully close the terminal.
        if (data.indexOf("\r") !== -1) {
          this.#onExitEventEmitter.fire(undefined);
        }
        break;

      case PtyState.WAIT_PASSWORD_ENTER:
        this.#handlePasswordWrite(data);
        break;

      case PtyState.HOST_KEY_CONFIRM:
        this.#handleHostKeyWrite(data);
        break;
    }
  }

  #emitAvailableWriteBufferSizeChange(): void {
    const writtenCount = this.#directWrittenDataCount;
    this.#directWrittenDataCount = 0;
    this.#onAvailableWriteBufferSizeChangeEventEmitter.fire({
      totalBufferSize: MAXIMUM_WRITE_BUFFER_SIZE,
      availableDelta: writtenCount
    });
  }

  getAvailableWriteBufferSize(): number {
    return MAXIMUM_WRITE_BUFFER_SIZE - this.#outstandingWriteDataCount - this.#directWrittenDataCount;
  }

  resize(cols: number, rows: number): void {
    if (this.#state !== PtyState.LIVE) {
      return;
    }
    this.#stream.setWindow(cols, rows, 0, 0);
  }

  destroy(): void {
    if (this.#state === PtyState.DEAD) {
      return;
    }

    this.#emitBufferSizeLater.cancel();
    this.#sshConnection.destroy();
    this.#state = PtyState.DEAD;
  }

  permittedDataSize(size: number): void {
    if (this.#state !== PtyState.LIVE) {
      return;
    }

    this.#permittedDataSize = size;
    if (size > 0) {
      if (this.#paused) {
        this.#paused = false;
        this.#stream.resume();
      }
    } else {
      if ( ! this.#paused) {
        this.#paused = true;
        this.#stream.pause();
      }
    }
  }

  async getWorkingDirectory(): Promise<string> {
    return null;
  }
}

const CODEPOINT_BACKSPACE = 0x08;
const CODEPOINT_DEL = 0x7f;

function applyBackspaceChars(str: string): string {
  const codePoints = stringToCodePointArray(str);

  const codePointCount = codePoints.length;
  let outputIndex = 0;
  for (let i=0; i< codePointCount; i++) {
    if (codePoints[i] === CODEPOINT_BACKSPACE || codePoints[i] === CODEPOINT_DEL) {
      outputIndex = Math.max(0, outputIndex-1);
    } else {
      codePoints[outputIndex] = codePoints[i];
      outputIndex++;
    }
  }
  return String.fromCharCode(...codePoints.slice(0, outputIndex));
}

/**
 * Convert a JS style UTF16 string to a Uint32Array of unicode code points
 */
function stringToCodePointArray(str: string): Uint32Array {
  const codePointArray = new Uint32Array(countCodePoints(str));
  const len = str.length;
  let c = 0;
  let i = 0;
  while (i < len) {
    const codePoint = str.codePointAt(i);
    codePointArray[c] = codePoint;
    i += utf16LengthOfCodePoint(codePoint);
    c++;
  }

  return codePointArray;
}

/**
 * Count the number of code points in a JS UTF16 string
 */
function countCodePoints(str: string): number {
  const len = str.length;
  let c = 0;
  let i = 0;
  while (i < len) {
    const codePoint = str.codePointAt(i);
    i += utf16LengthOfCodePoint(codePoint);
    c++;
  }
  return c;
}

function utf16LengthOfCodePoint(codePoint: number): number {
  return codePoint > 0xffff ? 2 : 1;
}

function warningStripe(length: number, offset: number = 0): string {
  const parts: string[] = [];
  parts.push("\x1b[38;2;255;255;0m");
  parts.push("\x1b[48;2;0;0;0m");
  const triangles = ["\u25E2", "\u25E4"];
  for (let i=0; i<length; i++) {
    parts.push(triangles[(i+offset) % 2]);
  }
  parts.push("\x1b[0m");
  return parts.join("");
}
