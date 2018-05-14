"use strict";
/**
 * Copyright (c) 2012-2015, Christopher Jeffrey, Peter Sunde (MIT License)
 * Copyright (c) 2016, Daniel Imms (MIT License).
 */
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var net_1 = require("net");
var pty = require(path.join('..', 'build', 'Release', 'pty.node'));
/**
 * Agent. Internal class.
 *
 * Everytime a new pseudo terminal is created it is contained
 * within agent.exe. When this process is started there are two
 * available named pipes (control and data socket).
 */
var WindowsPtyAgent = /** @class */ (function () {
    function WindowsPtyAgent(file, args, env, cwd, cols, rows, debug) {
        var _this = this;
        // Sanitize input variable.
        cwd = path.resolve(cwd);
        // Compose command line
        var commandLine = argsToCommandLine(file, args);
        // Open pty session.
        var term = pty.startProcess(file, commandLine, env, cwd, cols, rows, debug);
        // Terminal pid.
        this._pid = term.pid;
        this._innerPid = term.innerPid;
        this._innerPidHandle = term.innerPidHandle;
        // Not available on windows.
        this._fd = term.fd;
        // Generated incremental number that has no real purpose besides  using it
        // as a terminal id.
        this._pty = term.pty;
        // Create terminal pipe IPC channel and forward to a local unix socket.
        this._outSocket = new net_1.Socket();
        this._outSocket.setEncoding('utf8');
        this._outSocket.connect(term.conout, function () {
            // TODO: Emit event on agent instead of socket?
            // Emit ready event.
            _this._outSocket.emit('ready_datapipe');
        });
        this._inSocket = new net_1.Socket();
        this._inSocket.setEncoding('utf8');
        this._inSocket.connect(term.conin);
        // TODO: Wait for ready event?
    }
    Object.defineProperty(WindowsPtyAgent.prototype, "inSocket", {
        get: function () { return this._inSocket; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WindowsPtyAgent.prototype, "outSocket", {
        get: function () { return this._outSocket; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WindowsPtyAgent.prototype, "fd", {
        get: function () { return this._fd; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WindowsPtyAgent.prototype, "innerPid", {
        get: function () { return this._innerPid; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WindowsPtyAgent.prototype, "pty", {
        get: function () { return this._pty; },
        enumerable: true,
        configurable: true
    });
    WindowsPtyAgent.prototype.resize = function (cols, rows) {
        pty.resize(this._pid, cols, rows);
    };
    WindowsPtyAgent.prototype.kill = function () {
        this._inSocket.readable = false;
        this._inSocket.writable = false;
        this._outSocket.readable = false;
        this._outSocket.writable = false;
        var processList = pty.getProcessList(this._pid);
        // Tell the agent to kill the pty, this releases handles to the process
        pty.kill(this._pid, this._innerPidHandle);
        // Since pty.kill will kill most processes by itself and process IDs can be
        // reused as soon as all handles to them are dropped, we want to immediately
        // kill the entire console process list. If we do not force kill all
        // processes here, node servers in particular seem to become detached and
        // remain running (see Microsoft/vscode#26807).
        processList.forEach(function (pid) {
            try {
                process.kill(pid);
            }
            catch (e) {
                // Ignore if process cannot be found (kill ESRCH error)
            }
        });
    };
    WindowsPtyAgent.prototype.getExitCode = function () {
        return pty.getExitCode(this._innerPidHandle);
    };
    return WindowsPtyAgent;
}());
exports.WindowsPtyAgent = WindowsPtyAgent;
// Convert argc/argv into a Win32 command-line following the escaping convention
// documented on MSDN (e.g. see CommandLineToArgvW documentation). Copied from
// winpty project.
function argsToCommandLine(file, args) {
    if (isCommandLine(args)) {
        if (args.length === 0) {
            return file;
        }
        return argsToCommandLine(file, []) + " " + args;
    }
    var argv = [file];
    Array.prototype.push.apply(argv, args);
    var result = '';
    for (var argIndex = 0; argIndex < argv.length; argIndex++) {
        if (argIndex > 0) {
            result += ' ';
        }
        var arg = argv[argIndex];
        var quote = arg.indexOf(' ') !== -1 ||
            arg.indexOf('\t') !== -1 ||
            arg === '';
        if (quote) {
            result += '\"';
        }
        var bsCount = 0;
        for (var i = 0; i < arg.length; i++) {
            var p = arg[i];
            if (p === '\\') {
                bsCount++;
            }
            else if (p === '"') {
                result += repeatText('\\', bsCount * 2 + 1);
                result += '"';
                bsCount = 0;
            }
            else {
                result += repeatText('\\', bsCount);
                bsCount = 0;
                result += p;
            }
        }
        if (quote) {
            result += repeatText('\\', bsCount * 2);
            result += '\"';
        }
        else {
            result += repeatText('\\', bsCount);
        }
    }
    return result;
}
exports.argsToCommandLine = argsToCommandLine;
function isCommandLine(args) {
    return typeof args === 'string';
}
function repeatText(text, count) {
    var result = '';
    for (var i = 0; i < count; i++) {
        result += text;
    }
    return result;
}
//# sourceMappingURL=windowsPtyAgent.js.map