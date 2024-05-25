/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger } from "@extraterm/extraterm-extension-api";
import * as crypto from "node:crypto";
import ssh2 from "ssh2";
import { HostPattern } from "./HostPattern";

export type KnownHostsLineType = "host" | "hash" | "comment" | "revoked" | "cert-authority";


export interface KnownHostsLineBase {
  type: KnownHostsLineType;
  filename: string;
  lineNumber: number;   // 1 based line number in the file the line came from.
  rawLine: string;
}

export interface KnownHostsLineComment extends KnownHostsLineBase {
  type: "comment" | "cert-authority";
  rawLine: string;
}

export interface KnownHostsLineHost extends KnownHostsLineBase {
  type: "host";
  algo: string;
  hostPattern: string;
  publicKeyB64: string;
}

export interface KnownHostsLineHash extends KnownHostsLineBase {
  type: "hash";
  algo: string;
  hostHash: string;
  publicKeyB64: string;
}

export interface KnownHostsLineRevoked extends KnownHostsLineBase {
  type: "revoked",
  algo: string;
  publicKeyB64: string;
}

export type KnownHostsLine = KnownHostsLineHost | KnownHostsLineHash | KnownHostsLineComment | KnownHostsLineRevoked;

export enum VerifyResultCode {
  OK,
  UNKNOWN,
  CHANGED,
  REVOKED
};

export interface HostAlias {
  host: string;
  filename: string;
  lineNumber: number;
}

export interface VerifyResult {
  result: VerifyResultCode;
  filename?: string;
  lineNumber?: number;
  publicKey?: Buffer;
  aliases?: HostAlias[]
}

export class KnownHosts {

  private _log: Logger;
  lines: KnownHostsLine[] = [];

  constructor(log: Logger) {
    this._log = log;
  }

  loadString(knownHostsString: string, filename: string=""): void {
    const lines = knownHostsString.split("\n");
    this.lines = lines.map((line, index) => this.#parseLine(line, filename, index+1));
  }

  appendHost(host: string, port: number, remoteKey: ssh2.ParsedKey, filename: string=""): void {
    const hostHash = this.#makeNewHostHash(host, port);
    const publicKeyB64 = remoteKey.getPublicSSH().toString("base64");
    const lineNumber = this.lines.filter(l => l.filename  === filename).length + 1;
    const newLine: KnownHostsLineHash = {
      type: "hash",
      filename,
      lineNumber,
      algo: remoteKey.type,
      hostHash,
      publicKeyB64,
      rawLine: `${hostHash} ${remoteKey.type} ${publicKeyB64}`
    };
    this.lines.push(newLine);
  }

  dumpString(filename: string): string {
    return this.lines.filter(l => l.filename === filename).map(l => l.rawLine).join("\n");
  }

  #makeNewHostHash(host: string, port: number): string {
    const salt = crypto.randomBytes(20);
    const hashBuffer = this.#hashHostPort(makeHostPort(host, port), salt);
    const hashB64 = hashBuffer.toString("base64");
    const saltB64 = salt.toString("base64");
    return `|1|${saltB64}|${hashB64}`;
  }

  #parseLine(line: string, filename: string, lineNumber: number): KnownHostsLine {
    if (line.startsWith("#") || line.trim() === "") {
      return {
        type: "comment",
        filename,
        lineNumber,
        rawLine: line
      };
    }

    if (line.startsWith("@revoked")) {
      const parts = line.split(" ").filter(part => part.trim() !== "");
      if (parts.length < 4) {
        return {
          type: "comment",
          filename,
          lineNumber,
          rawLine: line
        };
      }

      const result: KnownHostsLineRevoked ={
        type: "revoked",
        filename,
        lineNumber,
        algo: parts[2],
        publicKeyB64: parts[3],
        rawLine: line
      };
      return result;
    }

    if (line.startsWith("@cert-authority")) {
      return {
        type: "cert-authority",
        filename,
        lineNumber,
        rawLine: line
      };
    }

    const parts = line.split(" ").filter(part => part.trim() !== "");
    if (parts.length < 3) {
      return {
        type: "comment",
        filename,
        lineNumber,
        rawLine: line
      };
    }

    if (parts[0].startsWith("|")) {
      const hashLine: KnownHostsLineHash = {
        type: "hash",
        filename,
        lineNumber,
        hostHash: parts[0],
        algo: parts[1],
        publicKeyB64: parts[2],
        rawLine: line
      };
      return hashLine;
    }

    const hostLine: KnownHostsLineHost = {
      type: "host",
      filename,
      lineNumber,
      hostPattern: parts[0],
      algo: parts[1],
      publicKeyB64: parts[2],
      rawLine: line
    };
    return hostLine;
  }

  verify(hostname: string, port: number, remoteKey: ssh2.ParsedKey): VerifyResult {
    const revokeResult = this.#isPublicKeyRevoked(remoteKey);
    if (revokeResult != null) {
      return revokeResult;
    }

    for (const line of this.lines) {
      if (line.type === "host") {
        if (this.#matchHostPattern(hostname, port, line)) {
          return this.#verifyPublicKeys(line, remoteKey);
        }
      } else if (line.type === "hash") {
        if (this.#matchHashedHost(hostname, port, line)) {
          return this.#verifyPublicKeys(line, remoteKey);
        }
      }
    }

    const aliases = this.#findMatchingKeys(remoteKey);

    return {
      result: VerifyResultCode.UNKNOWN,
      aliases
    };
  }

  #isPublicKeyRevoked(remoteKey: ssh2.ParsedKey): VerifyResult {
    for (const line of this.lines) {
      if (line.type === "revoked") {
        const lineKey = Buffer.from(line.publicKeyB64, "base64");
        if (this.#parsedKeyEquals(remoteKey, line.algo, lineKey)) {
          return {
            result: VerifyResultCode.REVOKED,
            filename: line.filename,
            lineNumber: line.lineNumber,
            publicKey: lineKey
          };
        }
      }
    }
    return null;
  }

  #matchHostPattern(hostname: string, port: number, line: KnownHostsLineHost): boolean {
    const hostport = makeHostPort(hostname, port);
    const hostPatterns = line.hostPattern.split(",").map(hp => new HostPattern(hp));

    for (const pattern of hostPatterns) {
      if (pattern.isNegative() && pattern.match(hostport)) {
        return false;
      }
    }

    for (const pattern of hostPatterns) {
      if (!pattern.isNegative() && pattern.match(hostport)) {
        return true;
      }
    }
    return false;
  }

  #matchHashedHost(hostname: string, port: number, line: KnownHostsLineHash): boolean {
    const parts = line.hostHash.split("|");
    const salt = Buffer.from(parts[2], "base64");
    const lineHost = Buffer.from(parts[3], "base64");
    const hostHash = this.#hashHostPort(makeHostPort(hostname, port), salt);
    return lineHost.equals(hostHash);
  }

  #hashHostPort(hostport: string, salt: Buffer): Buffer {
    const hmac = crypto.createHmac("sha1", salt);
    hmac.update(Buffer.from(hostport, "utf8"));
    const digest = hmac.digest();
    hmac.end();
    return digest;
  }

  #findMatchingKeys(remoteKey: ssh2.ParsedKey): HostAlias[] {
    const result: HostAlias[] = [];
    for (const line of this.lines) {
      if (line.type === "host" || line.type === "hash") {
        const verifyResult = this.#verifyPublicKeys(line, remoteKey);
        if (verifyResult.result === VerifyResultCode.OK) {
          result.push({
            lineNumber: line.lineNumber,
            filename: line.filename,
            host: line.type === "host" ? line.hostPattern : "[hashed host]"
          });
        }
      }
    }
    return result;
  }

  #verifyPublicKeys(line: KnownHostsLineHost | KnownHostsLineHash, remoteKey: ssh2.ParsedKey): VerifyResult {
    const lineKey = Buffer.from(line.publicKeyB64, "base64");
    if (this.#parsedKeyEquals(remoteKey, line.algo, lineKey)) {
      return {
        result: VerifyResultCode.OK,
        filename: line.filename,
        lineNumber: line.lineNumber,
        publicKey: lineKey
      };
    }
    return {
      result: VerifyResultCode.CHANGED,
      filename: line.filename,
      lineNumber: line.lineNumber,
      publicKey: lineKey
    };
  }

  #parsedKeyEquals(parsedKey: ssh2.ParsedKey, algo: string, key: Buffer): boolean {
    if (parsedKey.getPublicSSH() == null) {
      return false;
    }
    return parsedKey.type === algo && parsedKey.getPublicSSH().equals(key);
  }
}

export function makeHostPort(hostname: string, port: number): string {
  return port === 22 ? hostname : `[${hostname}]:${port}`;
}
