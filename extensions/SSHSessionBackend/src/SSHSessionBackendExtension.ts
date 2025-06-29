/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { ExtensionContext, Logger, Pty, SessionConfiguration, SessionBackend,
  CreateSessionOptions,
  EnvironmentMap} from "@extraterm/extraterm-extension-api";
import { PtyOptions, SSHPty } from "./SSHPty";

// Note: This is duplicated in SSHSessionEditorExtension.ts.
enum AuthenticationMethod {
  DEFAULT_KEYS_PASSWORD,
  PASSWORD_ONLY,
  KEY_FILE_ONLY,
  SSH_AGENT_ONLY,
};

// Note: This is duplicated in SSHSessionEditorExtension.ts.
interface SSHSessionConfiguration extends SessionConfiguration {
  host?: string;
  port?: number;
  username?: string;
  authenticationMethod?: AuthenticationMethod;
  keyFilePath?: string;
  verboseLogging?: boolean;
}

const WINDOW_SSH_AUTH_SOCK = "\\\\.\\pipe\\openssh-ssh-agent";

class SSHBackend implements SessionBackend {

  constructor(private _log: Logger) {
  }

  defaultSessionConfigurations(): SessionConfiguration[] {
    return [];  // There are no safe defaults sessions for SSH. We can't assume that even localhost is available.
  }

  createSession(sessionConfiguration: SessionConfiguration, sessionOptions: CreateSessionOptions): Pty {
    const sessionConfig = <SSHSessionConfiguration> sessionConfiguration;
    const username = sessionConfig.username ?? getCurrentUsername();

    const preMessage = "";

    const privateKeyFilenames: string[] = [];
    let tryPasswordAuth = false;
    switch (sessionConfig.authenticationMethod) {
      case AuthenticationMethod.DEFAULT_KEYS_PASSWORD:
        const homeDir = os.homedir();
        privateKeyFilenames.push(path.join(homeDir, ".ssh", "id_rsa"));
        privateKeyFilenames.push(path.join(homeDir, ".ssh", "id_dsa"));
        privateKeyFilenames.push(path.join(homeDir, ".ssh", "id_ecdsa"));
        privateKeyFilenames.push(path.join(homeDir, ".ssh", "id_ed25519"));
        tryPasswordAuth = true;
        break;

      case AuthenticationMethod.KEY_FILE_ONLY:
        privateKeyFilenames.push(sessionConfig.keyFilePath);
        break;

      case AuthenticationMethod.PASSWORD_ONLY:
        tryPasswordAuth = true;
        break;

      default:
        break;
    }

    const options: PtyOptions = {
      env: this.#createEnv(sessionOptions),
      cols: sessionOptions.cols,
      rows: sessionOptions.rows,
      preMessage,
      host: sessionConfig.host,
      port: sessionConfig.port,
      username: username,
      privateKeyFilenames,
      tryPasswordAuth,
      agentSocketPath: this.#createAgentSocketPath(sessionConfig),
      verboseLogging: sessionConfig.verboseLogging,
    };

    return new SSHPty(this._log, options);
  }

  #createAgentSocketPath(sessionConfig: SSHSessionConfiguration): string {
    const needAgent = sessionConfig.authenticationMethod === AuthenticationMethod.DEFAULT_KEYS_PASSWORD ||
                      sessionConfig.authenticationMethod === AuthenticationMethod.SSH_AGENT_ONLY;
    if (! needAgent) {
      return undefined;
    }

    if (process.platform === "win32") {
      if (fs.existsSync(WINDOW_SSH_AUTH_SOCK)) {
        return WINDOW_SSH_AUTH_SOCK;
      }
      return undefined;
    } else {
      return process.env.SSH_AUTH_SOCK;
    }
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

let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;
  context.sessions.registerSessionBackend("ssh", new SSHBackend(context.logger));
}

function getCurrentUsername(): string {
  const info = os.userInfo();
  return info.username;
}
