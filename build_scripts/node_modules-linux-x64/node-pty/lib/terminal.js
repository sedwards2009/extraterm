"use strict";
/**
 * Copyright (c) 2012-2015, Christopher Jeffrey (MIT License)
 * Copyright (c) 2016, Daniel Imms (MIT License).
 */
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");
exports.DEFAULT_COLS = 80;
exports.DEFAULT_ROWS = 24;
var Terminal = /** @class */ (function () {
    function Terminal(opt) {
        // for 'close'
        this._internalee = new events_1.EventEmitter();
        if (!opt) {
            return;
        }
        // Do basic type checks here in case node-pty is being used within JavaScript. If the wrong
        // types go through to the C++ side it can lead to hard to diagnose exceptions.
        this._checkType('name', opt.name ? opt.name : null, 'string');
        this._checkType('cols', opt.cols ? opt.cols : null, 'number');
        this._checkType('rows', opt.rows ? opt.rows : null, 'number');
        this._checkType('cwd', opt.cwd ? opt.cwd : null, 'string');
        this._checkType('env', opt.env ? opt.env : null, 'object');
        this._checkType('uid', opt.uid ? opt.uid : null, 'number');
        this._checkType('gid', opt.gid ? opt.gid : null, 'number');
        this._checkType('encoding', opt.encoding ? opt.encoding : null, 'string');
    }
    Object.defineProperty(Terminal.prototype, "pid", {
        get: function () { return this._pid; },
        enumerable: true,
        configurable: true
    });
    Terminal.prototype._checkType = function (name, value, type) {
        if (value && typeof value !== type) {
            throw new Error(name + " must be a " + type + " (not a " + typeof value + ")");
        }
    };
    /** See net.Socket.end */
    Terminal.prototype.end = function (data) {
        this._socket.end(data);
    };
    /** See stream.Readable.pipe */
    Terminal.prototype.pipe = function (dest, options) {
        return this._socket.pipe(dest, options);
    };
    /** See net.Socket.pause */
    Terminal.prototype.pause = function () {
        return this._socket.pause();
    };
    /** See net.Socket.resume */
    Terminal.prototype.resume = function () {
        return this._socket.resume();
    };
    /** See net.Socket.setEncoding */
    Terminal.prototype.setEncoding = function (encoding) {
        if (this._socket._decoder) {
            delete this._socket._decoder;
        }
        if (encoding) {
            this._socket.setEncoding(encoding);
        }
    };
    Terminal.prototype.addListener = function (eventName, listener) { this.on(eventName, listener); };
    Terminal.prototype.on = function (eventName, listener) {
        if (eventName === 'close') {
            this._internalee.on('close', listener);
            return;
        }
        this._socket.on(eventName, listener);
    };
    Terminal.prototype.emit = function (eventName) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (eventName === 'close') {
            return this._internalee.emit.apply(this._internalee, arguments);
        }
        return this._socket.emit.apply(this._socket, arguments);
    };
    Terminal.prototype.listeners = function (eventName) {
        return this._socket.listeners(eventName);
    };
    Terminal.prototype.removeListener = function (eventName, listener) {
        this._socket.removeListener(eventName, listener);
    };
    Terminal.prototype.removeAllListeners = function (eventName) {
        this._socket.removeAllListeners(eventName);
    };
    Terminal.prototype.once = function (eventName, listener) {
        this._socket.once(eventName, listener);
    };
    // TODO: Should this be in the API?
    Terminal.prototype.redraw = function () {
        var _this = this;
        var cols = this._cols;
        var rows = this._rows;
        // We could just send SIGWINCH, but most programs will  ignore it if the
        // size hasn't actually changed.
        this.resize(cols + 1, rows + 1);
        setTimeout(function () { return _this.resize(cols, rows); }, 30);
    };
    Terminal.prototype._close = function () {
        this._socket.writable = false;
        this._socket.readable = false;
        this.write = function () { };
        this.end = function () { };
        this._writable = false;
        this._readable = false;
    };
    Terminal.prototype._parseEnv = function (env) {
        var keys = Object.keys(env || {});
        var pairs = [];
        for (var i = 0; i < keys.length; i++) {
            pairs.push(keys[i] + '=' + env[keys[i]]);
        }
        return pairs;
    };
    return Terminal;
}());
exports.Terminal = Terminal;
//# sourceMappingURL=terminal.js.map