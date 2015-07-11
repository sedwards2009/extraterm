/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

export interface Config {
  blinkingCursor?: boolean;
  theme?: string;
  themePath?: string;
  sessionProfiles?: SessionProfile[];
}

export interface SessionProfile {
  name: string;
  command?: string;
  extraEnv?: Object;
  platform?: string | string[]; // "win32", "linux" etc.
}
