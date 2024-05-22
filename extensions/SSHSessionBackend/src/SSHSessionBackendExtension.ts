/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as child_process from "node:child_process";
import * as os from "node:os";

import { ExtensionContext, Logger, Pty, SessionConfiguration, SessionBackend,
  CreateSessionOptions,
  EnvironmentMap} from "@extraterm/extraterm-extension-api";
import { PtyOptions, SSHPty } from "./SSHPty";


interface SSHSessionConfiguration extends SessionConfiguration {
  host?: string;
  port?: number;
  username?: string;
}

class SSHBackend implements SessionBackend {

  constructor(private _log: Logger) {
  }

  defaultSessionConfigurations(): SessionConfiguration[] {
    const sessionConfig: SSHSessionConfiguration = {
      uuid: "",
      name: "SSH",
      type: "ssh",
      host: "",
      port: 22,
      username: "",
    };
    return [sessionConfig];
  }

  createSession(sessionConfiguration: SessionConfiguration, sessionOptions: CreateSessionOptions): Pty {
    const sessionConfig = <SSHSessionConfiguration> sessionConfiguration;
    const username = sessionConfig.username ?? getCurrentUsername();

    const preMessage = "";

    const options: PtyOptions = {
      env: this.#createEnv(sessionOptions),
      cols: sessionOptions.cols,
      rows: sessionOptions.rows,
      preMessage,
      host: sessionConfig.host,
      port: sessionConfig.port,
      username: username,
    };

    return new SSHPty(this._log, options);
  }

  #createEnv(sessionOptions: CreateSessionOptions): EnvironmentMap {
    const ptyEnv: EnvironmentMap = {};
    const processEnv = process.env;
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith("LC_")) {
        ptyEnv[key] = processEnv[key];
      }
    });
    ptyEnv["TERM"] = "xterm-256color";
    if (process.platform === "darwin" && !("LANG" in ptyEnv)) {
      ptyEnv["LANG"] = this.#readAppleLocale() + ".UTF-8";
    }

    let prop: string;
    for (prop in sessionOptions.extraEnv) {
      ptyEnv[prop] = sessionOptions.extraEnv[prop];
    }
    return ptyEnv;
  }

  #readAppleLocale(): string {
    try {
      const result: string = <any> child_process.execFileSync("defaults",
        ["read", "-g", "AppleLocale"],
        {encoding: "utf8"});
      const locale = result.trim();
      this._log.info("Found user locale: " + locale);
      return locale;
    } catch(e) {
      this._log.warn("Couldn't run defaults command to find the user's locale. Defaulting to en_US");
      return "en_US";
    }
  }
}

export function activate(context: ExtensionContext): any {
  context.sessions.registerSessionBackend("ssh", new SSHBackend(context.logger));
}

function getCurrentUsername(): string {
  const info = os.userInfo();
  return info.username;
}
