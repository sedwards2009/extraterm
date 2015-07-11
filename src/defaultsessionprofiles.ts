
import configInterfaces = require('config');
type SessionProfile = configInterfaces.SessionProfile;

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
