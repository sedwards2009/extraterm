/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { KnownHosts, VerifyResultCode } from "./KnownHosts";
import * as ssh2 from "ssh2";


class FakeParsedKey implements ssh2.ParsedKey {
  type: ssh2.KeyType;
  comment: string;
  key: Buffer;

  constructor(algoType: ssh2.KeyType, key: Buffer) {
    this.type = algoType;
    this.key = key;
  }

  sign(data: string | Buffer, algo?: string): Buffer {
    throw new Error("Method not implemented.");
  }
  verify(data: string | Buffer, signature: Buffer, algo?: string): boolean {
    throw new Error("Method not implemented.");
  }
  isPrivateKey(): boolean {
    throw new Error("Method not implemented.");
  }
  getPrivatePEM(): string {
    throw new Error("Method not implemented.");
  }
  getPublicPEM(): string {
    throw new Error("Method not implemented.");
  }
  getPublicSSH(): Buffer {
    throw new Error("Method not implemented.");
  }
  equals(key: string | ssh2.ParsedKey | Buffer): boolean {
    if (typeof key === 'string') {
      return this.key.equals(Buffer.from(key, 'base64'));
    } else if ('equals' in key) {
      return this.key.equals(key as Buffer);
    }
    throw new Error("Method not implemented.");
  }
}

test("plain host", done => {
  const knownHosts = new KnownHosts();
  knownHosts.loadString(`192.168.1.1 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=
rubuntu,192.168.1.3 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEAmrcgpIsIb9RZZdlhB44addflgtm0//PVBUjrvcYuAk5Jd3qbmyD6gtifxpcMlNoRtiGo7Fr5q5x3Zl1/ZgfXncrBaqJhFHfnwLk6XBtWg3wUYOb0kZdfouFaGFPwAKkmY58GJqBM0iLavmtCHmczDT3ZfR72PPKgP5vomCKqpMs=
`);
  expect(knownHosts.lines.length).toBe(3);
  expect(knownHosts.lines[0].type).toBe("host");
  expect(knownHosts.lines[0].type).toBe("host");
  expect(knownHosts.lines[2].type).toBe("comment");

  const publicKeys = [
    new FakeParsedKey("ssh-rsa", Buffer.from("AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=", "base64"))
  ];
  expect(knownHosts.verify("192.168.1.1", publicKeys).result).toBe(VerifyResultCode.OK);

  const publicKeys2 = [
    new FakeParsedKey("ssh-rsa", Buffer.from("AAAAB3NzaC1yc2EAAAABIwAAAIEAmrcgpIsIb9RZZdlhB44addflgtm0//PVBUjrvcYuAk5Jd3qbmyD6gtifxpcMlNoRtiGo7Fr5q5x3Zl1/ZgfXncrBaqJhFHfnwLk6XBtWg3wUYOb0kZdfouFaGFPwAKkmY58GJqBM0iLavmtCHmczDT3ZfR72PPKgP5vomCKqpMs=", "base64"))
  ];

  expect(knownHosts.verify("192.168.1.3", publicKeys2).result).toBe(VerifyResultCode.OK);
  expect(knownHosts.verify("rubuntu", publicKeys2).result).toBe(VerifyResultCode.OK);
  done();
});

test("plain host public key mismatch", done => {
  const knownHosts = new KnownHosts();
  knownHosts.loadString(`192.168.1.1 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=
rubuntu,192.168.1.3 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEAmrcgpIsIb9RZZdlhB44addflgtm0//PVBUjrvcYuAk5Jd3qbmyD6gtifxpcMlNoRtiGo7Fr5q5x3Zl1/ZgfXncrBaqJhFHfnwLk6XBtWg3wUYOb0kZdfouFaGFPwAKkmY58GJqBM0iLavmtCHmczDT3ZfR72PPKgP5vomCKqpMs=
`);

  const publicKeys = [
    new FakeParsedKey("ssh-rsa", Buffer.from("BAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=", "base64"))
  ];
  expect(knownHosts.verify("192.168.1.1", publicKeys).result).toBe(VerifyResultCode.CHANGED);
  done();
});

test("hash host", done => {
  const knownHosts = new KnownHosts();

  const publicKeys = [
    new FakeParsedKey("ssh-rsa", Buffer.from("AAAAB3NzaC1yc2EAAAABIwAAAQEAq3A1A0ovCLQMIypva4r+IOoy6d/Untkpjh0Qg00KNKgj7MsB+0PJlqqKSQORxeRTMfsgJ8adSkwEaoz6uu7/UhDCRXcnHqaX2GtPtSZTp6PT+uI3+aF0OJ07PsRUn3NW6DRXJP37gtxykasQowNbeO54qULXyzaDkAOt504S8pHPORP7EW5P19BBJsk5PFDkzf+eTlZtQtiNK1lhEG/+a/M60ggDUoEHpRgSqB5r3RleNlDt2/dBcvKcF/3AQIpgkEqtTgmJWZrwKF9HFMeY0NI+bHEMUsvPFoVAIZqXJwR/ipv9enib0/azQzUoSJJv59ETbToima6p5kNod+SjSw==", "base64"))
  ];

  // 192.168.1.2
  knownHosts.loadString(`|1|Lw/h2cw00uRxdmZeQ93a7++tPHM=|w+FeYx7J4ljE4a/k4YgY+8eXlBU= ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAq3A1A0ovCLQMIypva4r+IOoy6d/Untkpjh0Qg00KNKgj7MsB+0PJlqqKSQORxeRTMfsgJ8adSkwEaoz6uu7/UhDCRXcnHqaX2GtPtSZTp6PT+uI3+aF0OJ07PsRUn3NW6DRXJP37gtxykasQowNbeO54qULXyzaDkAOt504S8pHPORP7EW5P19BBJsk5PFDkzf+eTlZtQtiNK1lhEG/+a/M60ggDUoEHpRgSqB5r3RleNlDt2/dBcvKcF/3AQIpgkEqtTgmJWZrwKF9HFMeY0NI+bHEMUsvPFoVAIZqXJwR/ipv9enib0/azQzUoSJJv59ETbToima6p5kNod+SjSw==`);
  expect(knownHosts.verify("192.168.1.2", publicKeys).result).toBe(VerifyResultCode.OK);
  expect(knownHosts.verify("192.168.1.9", publicKeys).result).toBe(VerifyResultCode.UNKNOWN);
  done();
});

test("hash host public key mismatch", done => {
  const knownHosts = new KnownHosts();

  const publicKeys = [
    new FakeParsedKey("ssh-rsa", Buffer.from("BAAAB3NzaC1yc2EAAAABIwAAAQEAq3A1A0ovCLQMIypva4r+IOoy6d/Untkpjh0Qg00KNKgj7MsB+0PJlqqKSQORxeRTMfsgJ8adSkwEaoz6uu7/UhDCRXcnHqaX2GtPtSZTp6PT+uI3+aF0OJ07PsRUn3NW6DRXJP37gtxykasQowNbeO54qULXyzaDkAOt504S8pHPORP7EW5P19BBJsk5PFDkzf+eTlZtQtiNK1lhEG/+a/M60ggDUoEHpRgSqB5r3RleNlDt2/dBcvKcF/3AQIpgkEqtTgmJWZrwKF9HFMeY0NI+bHEMUsvPFoVAIZqXJwR/ipv9enib0/azQzUoSJJv59ETbToima6p5kNod+SjSw==", "base64"))
  ];

  // 192.168.1.2
  knownHosts.loadString(`|1|Lw/h2cw00uRxdmZeQ93a7++tPHM=|w+FeYx7J4ljE4a/k4YgY+8eXlBU= ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAq3A1A0ovCLQMIypva4r+IOoy6d/Untkpjh0Qg00KNKgj7MsB+0PJlqqKSQORxeRTMfsgJ8adSkwEaoz6uu7/UhDCRXcnHqaX2GtPtSZTp6PT+uI3+aF0OJ07PsRUn3NW6DRXJP37gtxykasQowNbeO54qULXyzaDkAOt504S8pHPORP7EW5P19BBJsk5PFDkzf+eTlZtQtiNK1lhEG/+a/M60ggDUoEHpRgSqB5r3RleNlDt2/dBcvKcF/3AQIpgkEqtTgmJWZrwKF9HFMeY0NI+bHEMUsvPFoVAIZqXJwR/ipv9enib0/azQzUoSJJv59ETbToima6p5kNod+SjSw==`);
  expect(knownHosts.verify("192.168.1.2", publicKeys).result).toBe(VerifyResultCode.CHANGED);
  done();
});

test("revoked", done => {
  const knownHosts = new KnownHosts();
  knownHosts.loadString(`@revoked 192.168.1.1 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=
`);
  expect(knownHosts.lines.length).toBe(2);
  expect(knownHosts.lines[0].type).toBe("revoked");

  const publicKeys = [
    new FakeParsedKey("ssh-rsa", Buffer.from("AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=", "base64"))
  ];
  expect(knownHosts.verify("192.168.1.1", publicKeys).result).toBe(VerifyResultCode.REVOKED);

  done();
});
