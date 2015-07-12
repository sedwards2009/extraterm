/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

import config = require('./config');
type SessionProfile = config.SessionProfile;

const DEFAULT_SESSION_PROFILES: SessionProfile[]  = [
  {
    name: "bash",
    platform: ["linux", "darwin", "freebsd"],
    command: "/bin/bash"
  },
  {
    name: "babun",
    platform: "win32",
    command: "/bin/bash"
  }
];

export = DEFAULT_SESSION_PROFILES;
