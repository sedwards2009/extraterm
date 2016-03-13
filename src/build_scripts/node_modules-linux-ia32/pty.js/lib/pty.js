/**
 * pty.js
 * Copyright (c) 2012-2015, Christopher Jeffrey (MIT License)
 * Binding to the pseudo terminals.
 */

var extend = require('extend');
var EventEmitter = require('events').EventEmitter;
var pty = require('../build/Release/pty.node');
var net = require('net');
var tty = require('tty');
var nextTick = global.setImmediate || process.nextTick;

var version = process.versions.node.split('.').map(function(n) {
  return +(n + '').split('-')[0];
});

/**
 * Terminal
 */

// Example:
//  var term = new Terminal('bash', [], {
//    name: 'xterm-color',
//    cols: 80,
//    rows: 24,
//    cwd: process.env.HOME,
//    env: process.env
//  });

function Terminal(file, args, opt) {
  if (!(this instanceof Terminal)) {
    return new Terminal(file, args, opt);
  }

  var self = this
    , env
    , cwd
    , name
    , cols
    , rows
    , uid
    , gid
    , term;

  // backward compatibility
  if (typeof args === 'string') {
    opt = {
      name: arguments[1],
      cols: arguments[2],
      rows: arguments[3],
      cwd: process.env.HOME
    };
    args = [];
  }

  // for 'close'
  this._internalee = new EventEmitter;

  // arguments
  args = args || [];
  file = file || 'sh';
  opt = opt || {};

  cols = opt.cols || 80;
  rows = opt.rows || 24;

  uid = opt.uid != null ? opt.uid : -1;
  gid = opt.gid != null ? opt.gid : -1;

  opt.env = opt.env || process.env;
  env = extend({}, opt.env);

  if (opt.env === process.env) {
    // Make sure we didn't start our
    // server from inside tmux.
    delete env.TMUX;
    delete env.TMUX_PANE;

    // Make sure we didn't start
    // our server from inside screen.
    // http://web.mit.edu/gnu/doc/html/screen_20.html
    delete env.STY;
    delete env.WINDOW;

    // Delete some variables that
    // might confuse our terminal.
    delete env.WINDOWID;
    delete env.TERMCAP;
    delete env.COLUMNS;
    delete env.LINES;
  }

  // Could set some basic env vars
  // here, if they do not exist:
  // USER, SHELL, HOME, LOGNAME, WINDOWID

  cwd = opt.cwd || process.cwd();
  name = opt.name || env.TERM || 'xterm';
  env.TERM = name;
  // XXX Shouldn't be necessary:
  // env.LINES = rows + '';
  // env.COLUMNS = cols + '';

  env = environ(env);

  function onexit(code, signal) {
    // XXX Sometimes a data event is emitted
    // after exit. Wait til socket is destroyed.
    if (!self._emittedClose) {
      if (self._boundClose) return;
      self._boundClose = true;
      self.once('close', function() {
        self.emit('exit', code, signal);
      });
      return;
    }
    self.emit('exit', code, signal);
  }

  // fork
  term = pty.fork(file, args, env, cwd, cols, rows, uid, gid, onexit);

  this.socket = TTYStream(term.fd);
  this.socket.setEncoding('utf8');
  this.socket.resume();

  // setup
  this.socket.on('error', function(err) {
    // NOTE: fs.ReadStream gets EAGAIN twice at first:
    if (err.code) {
      if (~err.code.indexOf('EAGAIN')) return;
    }

    // close
    self._close();
    // EIO on exit from fs.ReadStream:
    if (!self._emittedClose) {
      self._emittedClose = true;
      Terminal.total--;
      self.emit('close');
    }

    // EIO, happens when someone closes our child
    // process: the only process in the terminal.
    // node < 0.6.14: errno 5
    // node >= 0.6.14: read EIO
    if (err.code) {
      if (~err.code.indexOf('errno 5')
          || ~err.code.indexOf('EIO')) return;
    }

    // throw anything else
    if (self.listeners('error').length < 2) {
      throw err;
    }
  });

  this.pid = term.pid;
  this.fd = term.fd;
  this.pty = term.pty;

  this.file = file;
  this.name = name;
  this.cols = cols;
  this.rows = rows;

  this.readable = true;
  this.writable = true;

  Terminal.total++;

  this.socket.on('close', function() {
    if (self._emittedClose) return;
    self._emittedClose = true;
    Terminal.total--;
    self._close();
    self.emit('close');
  });

  env = null;
}

Terminal.fork =
Terminal.spawn =
Terminal.createTerminal = function(file, args, opt) {
  return new Terminal(file, args, opt);
};

/**
 * openpty
 */

Terminal.open = function(opt) {
  var self = Object.create(Terminal.prototype)
    , opt = opt || {};

  if (arguments.length > 1) {
    opt = {
      cols: arguments[1],
      rows: arguments[2]
    };
  }

  var cols = opt.cols || 80
    , rows = opt.rows || 24
    , term;

  // open
  term = pty.open(cols, rows);

  self.master = TTYStream(term.master);
  self.master.setEncoding('utf8');
  self.master.resume();

  self.slave = TTYStream(term.slave);
  self.slave.setEncoding('utf8');
  self.slave.resume();

  self.socket = self.master;
  self.pid = null;
  self.fd = term.master;
  self.pty = term.pty;

  self.file = process.argv[0] || 'node';
  self.name = process.env.TERM || '';
  self.cols = cols;
  self.rows = rows;

  self.readable = true;
  self.writable = true;

  self.socket.on('error', function(err) {
    Terminal.total--;
    self._close();
    if (self.listeners('error').length < 2) {
      throw err;
    }
  });

  Terminal.total++;
  self.socket.on('close', function() {
    Terminal.total--;
    self._close();
  });

  return self;
};

/**
 * Total
 */

// Keep track of the total
// number of terminals for
// the process.
Terminal.total = 0;

/**
 * Events
 */

Terminal.prototype.write = function(data) {
  return this.socket.write(data);
};

Terminal.prototype.end = function(data) {
  return this.socket.end(data);
};

Terminal.prototype.pipe = function(dest, options) {
  return this.socket.pipe(dest, options);
};

Terminal.prototype.pause = function() {
  return this.socket.pause();
};

Terminal.prototype.resume = function() {
  return this.socket.resume();
};

Terminal.prototype.setEncoding = function(enc) {
  if (this.socket._decoder) {
    delete this.socket._decoder;
  }
  if (enc) {
    this.socket.setEncoding(enc);
  }
};

Terminal.prototype.addListener =
Terminal.prototype.on = function(type, func) {
  if (type === 'close') {
    this._internalee.on('close', func);
    return this;
  }
  this.socket.on(type, func);
  return this;
};

Terminal.prototype.emit = function(evt) {
  if (evt === 'close') {
    return this._internalee.emit.apply(this._internalee, arguments);
  }
  return this.socket.emit.apply(this.socket, arguments);
};

Terminal.prototype.listeners = function(type) {
  return this.socket.listeners(type);
};

Terminal.prototype.removeListener = function(type, func) {
  this.socket.removeListener(type, func);
  return this;
};

Terminal.prototype.removeAllListeners = function(type) {
  this.socket.removeAllListeners(type);
  return this;
};

Terminal.prototype.once = function(type, func) {
  this.socket.once(type, func);
  return this;
};

Terminal.prototype.__defineGetter__('stdin', function() {
  return this;
});

Terminal.prototype.__defineGetter__('stdout', function() {
  return this;
});

Terminal.prototype.__defineGetter__('stderr', function() {
  throw new Error('No stderr.');
});

/**
 * TTY
 */

Terminal.prototype.resize = function(cols, rows) {
  cols = cols || 80;
  rows = rows || 24;

  this.cols = cols;
  this.rows = rows;

  pty.resize(this.fd, cols, rows);
};

Terminal.prototype.destroy = function() {
  var self = this;

  // close
  this._close();

  // Need to close the read stream so
  // node stops reading a dead file descriptor.
  // Then we can safely SIGHUP the shell.
  this.socket.once('close', function() {
    self.kill('SIGHUP');
  });

  this.socket.destroy();
};

Terminal.prototype.kill = function(sig) {
  try {
    process.kill(this.pid, sig || 'SIGHUP');
  } catch(e) {
    ;
  }
};

Terminal.prototype.redraw = function() {
  var self = this
    , cols = this.cols
    , rows = this.rows;

  // We could just send SIGWINCH, but most programs will
  // ignore it if the size hasn't actually changed.

  this.resize(cols + 1, rows + 1);

  setTimeout(function() {
    self.resize(cols, rows);
  }, 30);
};

Terminal.prototype.__defineGetter__('process', function() {
  return pty.process(this.fd, this.pty) || this.file;
});

Terminal.prototype._close = function() {
  this.socket.writable = false;
  this.socket.readable = false;
  this.write = function() {};
  this.end = function() {};
  this.writable = false;
  this.readable = false;
};

/**
 * TTY Stream
 */

function TTYStream(fd) {
  // Could use: if (!require('tty').ReadStream)
  if (version[0] === 0 && version[1] < 7) {
    return new net.Socket(fd);
  }

  if (version[0] === 0 && version[1] < 12) {
    return new tty.ReadStream(fd);
  }

  return new Socket(fd);
}

/**
 * Wrap net.Socket for a workaround
 */

function Socket(options) {
  if (!(this instanceof Socket)) {
    return new Socket(options);
  }
  var tty = process.binding('tty_wrap');
  var guessHandleType = tty.guessHandleType;
  tty.guessHandleType = function() {
    return 'PIPE';
  };
  net.Socket.call(this, options);
  tty.guessHandleType = guessHandleType;
}

Socket.prototype.__proto__ = net.Socket.prototype;

/**
 * Helpers
 */

function environ(env) {
  var keys = Object.keys(env || {})
    , l = keys.length
    , i = 0
    , pairs = [];

  for (; i < l; i++) {
    pairs.push(keys[i] + '=' + env[keys[i]]);
  }

  return pairs;
}

/**
 * Expose
 */

module.exports = exports = Terminal;
exports.Terminal = Terminal;
exports.native = pty;
