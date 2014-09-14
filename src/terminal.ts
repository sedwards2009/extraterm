/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
///<reference path='./chrome_lib.d.ts'/>
///<reference path="./typings/node/node.d.ts" />
///<reference path="./typings/node-webkit/node-webkit.d.ts" />
///<reference path="./term_js.d.ts" />
///<reference path='./typings/lodash/lodash.d.ts'/>
///<amd-dependency path="nw.gui" />
import _ = require('lodash');
import commandframe = require('commandframe');
import domutils = require('domutils');
import termjs = require('term.js');
import child_process = require('child_process');
import events = require('events');
import scrollbar = require('gui/scrollbar');

var EventEmitter = events.EventEmitter;

var gui: typeof nw.gui = require('nw.gui');

scrollbar.init();
commandframe.init();

var debug = false;
function log(...msgs:any[]) {
  if (debug) {
    console.log.apply(console, msgs);
  }
}

var EXTRATERM_COOKIE_ENV = "EXTRATERM_COOKIE";
var SEMANTIC_TYPE = "data-extraterm-type";
var SEMANTIC_VALUE = "data-extraterm-value";

enum ApplicationMode {
  APPLICATION_MODE_NONE = 0,
  APPLICATION_MODE_HTML = 1,
  APPLICATION_MODE_OUTPUT_BRACKET_START = 2,
  APPLICATION_MODE_OUTPUT_BRACKET_END = 3
}

/**
 * Create a new terminal.
 * 
 * A terminal is full terminal emulator with GUI intergration. It handles the
 * UI chrome wrapped around the smaller terminal emulation part (term.js).
 * 
 * See startUp().
 * 
 * @param {type} parentElement The DOM element under which the terminal will
 *     be placed.
 * @returns {Terminal}
 */
export class Terminal {
  
  private _parentElement: HTMLElement;
  private _container: HTMLElement;
  
  private _scrollbar: scrollbar;
  private _scrollSyncID: number = -1;
  private _autoscroll = true;
  
  private _termContainer: HTMLElement;

  private _term: termjs.Terminal = null;
  private _htmlData: string = null;
  private _applicationMode: ApplicationMode = ApplicationMode.APPLICATION_MODE_NONE;
  private _bracketStyle: string = null;
  private _lastBashBracket: string = null;
  private _blinkingCursor = false;
  private _title = "New Tab";
  private _ptyBridge: child_process.ChildProcess;
  private _super_lineToHTML: (line: any[]) => string;
  
  events: NodeJS.EventEmitter = new EventEmitter();

  constructor(parentElement: HTMLElement) {
    this._parentElement = parentElement;
    _.bindAll(this);
  }

  /**
   * Get this terminal's title.
   */
  getTitle(): string {
    return this._title;
  }

  /**
   * Set whether the cursor should blink.
   * 
   * @param {boolean} blink Set to true if the cursor should blink.
   */
  setBlinkingCursor(blinking: boolean): void {
    this._blinkingCursor = blinking;
    if (this._term !== null) {
      this._term.setCursorBlink(blinking);
    }
  }

  /**
   * Get the window which this terminal is on.
   * 
   * @returns {Window} The window object.
   */
  _getWindow(): Window {
    return this._parentElement.ownerDocument.defaultView;  
  }
  
  _getDocument(): Document {
    return this._parentElement.ownerDocument;
  }
  
  _colors(): string[] {
    var colorList = termjs.Terminal.colors.slice();

    var linuxColors = [
      "#000000",
      "#b21818",
      "#18b218",
      "#b26818",
      "#3535ff",
      "#b218b2",
      "#18b2b2",
      "#b2b2b2",
      "#686868",
      "#ff5454",
      "#54ff54",
      "#ffff54",
      "#7373ff",
      "#ff54ff",
      "#54ffff",
      "#ffffff"];

    for (var i=0; i < linuxColors.length; i++) {
      colorList[i] = linuxColors[i];
    }

    colorList[256] = "#000000";
    colorList[257] = "#b2b2b2";

    return colorList;
  }

  /**
   * Start the terminal up.
   * 
   * This method should be called once all event handlers have been set up.
   */
  startUp(): void {
    this._parentElement.innerHTML = "<div class='terminal_container'>" +
      "<div class='term_container'></div>" +
      "<cb-scrollbar class='terminal_scrollbar'></cb-scrollbar>" +
      "</div>";
    this._container = <HTMLElement>this._parentElement.firstElementChild;
    this._scrollbar = <scrollbar>this._container.querySelector('cb-scrollbar');
    this._termContainer = <HTMLElement>this._container.firstElementChild;
    
    var cookie = "DEADBEEF";  // FIXME
    process.env[EXTRATERM_COOKIE_ENV] = cookie;

    this._term = new termjs.Terminal({
      cols: 80,
      rows: 30,
      colors: this._colors(),
      scrollback: 1000,
      cursorBlink: this._blinkingCursor,
      physicalScroll: true,
      applicationModeCookie: cookie
    });

    var defaultLineToHTML = this._term._lineToHTML;
    this._super_lineToHTML = this._term._lineToHTML;
    this._term._lineToHTML=  this._lineToHTML;

    this._term.debug = true;
    this._term.on('title', this._handleTitle);
    this._term.on('data', this._handleTermData);
    this._getWindow().addEventListener('resize', this._handleResize);
    this._term.on('key', this._handleKeyDown);
    this._term.on('unknown-keydown', this._handleUnknownKeyDown);
    this._term.on('manual-scroll', this._handleManualScroll);
    
    // Application mode handlers    
    this._term.on('application-mode-start', this._handleApplicationModeStart);
    this._term.on('application-mode-data', this._handleApplicationModeData);
    this._term.on('application-mode-end', this._handleApplicationModeEnd);

    // Window DOM event handlers
    this._getWindow().document.body.addEventListener('click', this._handleWindowClick);

    this._term.open(this._termContainer);

    this._term.element.addEventListener('keypress', this._handleKeyPressTerminal);
    this._term.element.addEventListener('keydown', this._handleKeyDownTerminal);
    this._container.addEventListener('scroll-move', (ev: CustomEvent) => {
      this._syncManualScroll();  
    });

    this._term.write('\x1b[31mWelcome to Extraterm!\x1b[m\r\n');

    // Start our PTY bridge process and connect it to our terminal.
    this._ptyBridge = child_process.spawn('node', ['pty_bridge.js'], {
      env: process.env
    });
    this._ptyBridge.stdout.on('data', this._handlePtyStdoutData);
    this._ptyBridge.stderr.on('data', this._handlePtyStderrData);
    this._ptyBridge.on('close', this._handlePtyClose);

    this._scrollbar.addEventListener('scroll', (ev: CustomEvent) => {
      this._autoscroll = ev.detail.isBottom;
    });
    
    var size = this._term.resizeToContainer();
    this._sendResize(size.cols, size.rows);
    
    this._syncScrolling();
  }
  
  /**
   * Synchronize the scrollbar with the term.
   */
  private _syncScrolling(): void {
    this._scrollbar.size = this._term.element.scrollHeight;
    if (this._autoscroll) {
      // Scroll to the bottom.
      this._scrollbar.position = Number.MAX_VALUE;
      this._term.element.scrollTop = this._term.element.scrollHeight - this._term.element.clientHeight;
    } else {
       this._term.element.scrollTop = this._scrollbar.position;
    }
    
    this._scrollSyncID = this._getWindow().requestAnimationFrame( (id: number): void => {
      this._syncScrolling();
    });
  }
  
  /**
   * Handle manual-scroll events from the term.
   * 
   * These happen when the user does something in the terminal which
   * intentionally scrolls the contents.
   */
  private _handleManualScroll(scrollDetail: termjs.ScrollDetail): void {
    this._autoscroll = scrollDetail.isBottom;
    if (scrollDetail.isBottom === false) {
      this._scrollbar.size = this._term.element.scrollHeight;
      this._scrollbar.position = scrollDetail.position;
    }
  }

  private _syncManualScroll(): void {
    var el = this._term.element;
    this._autoscroll = el.scrollTop === el.scrollHeight - el.clientHeight;
    this._scrollbar.position = el.scrollTop;
  }
  
  /**
   * Destroy the terminal.
   */
  destroy(): void {
    if (this._scrollSyncID !== -1) {
      cancelAnimationFrame(this._scrollSyncID);
    }
    
    if (this._ptyBridge !== null) {
      this._ptyBridge.removeAllListeners();

      this._ptyBridge.kill('SIGHUP');
      this._ptyBridge.disconnect();
      this._ptyBridge = null;
    }

    if (this._term !== null) {
      this._getWindow().removeEventListener('resize', this._handleResize);
      this._getWindow().document.body.removeEventListener('click', this._handleWindowClick);
      this._term.destroy();
    }
    this._term = null;
  }

  
  /**
   * Focus on this terminal.
   */
  focus(): void {
    if (this._term !== null) {
      this._term.focus();
    }
  }

  /**
   * Write data to the terminal screen.
   * 
   * @param text the stream of data to write.
   */
  write(text: string): void {
    if (this._term !== null) {
      this._term.write(text);
    }
  }
  
  /**
   * Send data to the pty and process connected to the terminal.
   * @param text the data to send.
   */
  send(text: string): void {
    if (this._term !== null) {
      this._sendDataToPty(text);
    }
  }
  
  /**
   * Scroll the terminal down as far as possible.
   */
  scrollToBottom(): void {
    this._term.scrollToBottom();
  }

  /**
   * Handler for window title change events from the pty.
   * 
   * @param title The new window title for this terminal.
   */
  _handleTitle(title: string): void {
    this._title = title;
    this.events.emit('title', this, title);
  }
  
  /**
   * Handle a resize event from the window.
   */
  _handleResize(): void {
    var size = this._term.resizeToContainer();
    this._sendResize(size.cols, size.rows);
  }

  _handleKeyDown(key: string, ev: KeyboardEvent): void {
    if (key !== null) {
      this._term.scrollToBottom();
    }
  }
  
  /**
   * Handle an unknown key down event from the term.
   */
  _handleUnknownKeyDown(ev: KeyboardEvent): boolean {
    this.events.emit('unknown-keydown', this, ev);
    return false;
  }

  _handleKeyPressTerminal(ev: KeyboardEvent): void {
//    console.log("._handleKeyPressTerminal: ", ev.keyCode);
    this._term.keyPress(ev);
  }

  _handleKeyDownTerminal(ev: KeyboardEvent): void {
    var frames: commandframe[];
    var index: number;

    // Key down on a command frame.
    if ((<HTMLElement>ev.target).tagName === "ET-COMMANDFRAME") {
      if (ev.keyCode === 27) {
        // 27 = esc.
        this._term.element.focus();
        this._term.scrollToBottom();
        ev.preventDefault();
        return;

      } else if (ev.keyCode === 32 && ev.ctrlKey) {
        // 32 = space
        (<commandframe>ev.target).openMenu();
        ev.preventDefault();
        return;

      } else if (ev.keyCode === 38) {
        // 38 = update arrow.

        // Note ugly convert-to-array code. ES6 Array.from() help us!
        frames = Array.prototype.slice.call(this._term.element.querySelectorAll("et-commandframe"));
        index = frames.indexOf(<commandframe>ev.target);
        if (index > 0) {
          frames[index-1].focusLast();
        }
        ev.preventDefault();
        return;

      } else if (ev.keyCode === 40) {
        // 40 = down arros.

        frames = Array.prototype.slice.call(this._term.element.querySelectorAll("et-commandframe"));
        index = frames.indexOf(<commandframe>ev.target);
        if (index < frames.length -1) {
          frames[index+1].focusFirst();
        }
        ev.preventDefault();
        return;
      }

    } else if (ev.target === this._term.element) {
      // In normal typing mode.

      if (ev.keyCode === 32 && ev.ctrlKey) {
        // Enter cursor mode.
        // 32 = space.
        var lastFrame = <commandframe>this._term.element.querySelector("et-commandframe:last-of-type");
        if (lastFrame !== null) {
          lastFrame.focusLast();
        }
        ev.preventDefault();
        return;
      }
    }


    this._term.keyDown(ev);
  }

  /**
   * Handle when the embedded term.js enters start of application mode.
   * 
   * @param {array} params The list of parameter which were specified in the
   *     escape sequence.
   */
  _handleApplicationModeStart(params: string[]): void {
    log("application-mode started! ",params);
    if (params.length === 1) {
      // Normal HTML mode.
      this._applicationMode = ApplicationMode.APPLICATION_MODE_HTML;

    } else if(params.length >= 2) {
      switch ("" + params[1]) {
        case "2":
          this._applicationMode = ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START;
          this._bracketStyle = params[2];
          break;

        case "3":
          this._applicationMode = ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END;
          log("Starting APPLICATION_MODE_OUTPUT_BRACKET_END");
          break;

        default:
          log("Unrecognized application escape parameters.");
          break;
      }
    }
    this._htmlData = "";
  }

  /**
   * Handle incoming data while in application mode.
   * 
   * @param {string} data The new data.
   */
  _handleApplicationModeData(data: string): void {
    log("html-mode data!", data);
    if (this._applicationMode !== ApplicationMode.APPLICATION_MODE_NONE) {
      this._htmlData = this._htmlData + data;
    }
  }

  /**
   * Handle the exit from application mode.
   */
  _handleApplicationModeEnd(): void {
    var el: HTMLElement;

    switch (this._applicationMode) {
      case ApplicationMode.APPLICATION_MODE_HTML:
        el = this._getWindow().document.createElement("div");
        el.innerHTML = this._htmlData;
        this._term.appendElement(el);
        break;

      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
        var startdivs = this._term.element.querySelectorAll("et-commandframe:not([return-code])");
        log("startdivs:", startdivs);
        if (startdivs.length !== 0) {
          break;  // Don't open a new frame.
        }
        
        // Create and set up a new command-frame.
        el = this._getWindow().document.createElement("et-commandframe");

        el.addEventListener('close-request', (function() {
          el.remove();
          this.focus();
        }).bind(this));

        el.addEventListener('type', (function(ev: CustomEvent) {
          this._sendDataToPty(ev.detail);
        }).bind(this));

        el.addEventListener('copy-clipboard-request', (function(ev: CustomEvent) {
          var clipboard = gui.Clipboard.get();
          clipboard.set(ev.detail, 'text');
        }).bind(this));

        var cleancommand = this._htmlData;
        if (this._bracketStyle === "bash") {
          // Bash includes the history number. Remove it.
          var trimmed = this._htmlData.trim();
          cleancommand = trimmed.slice(trimmed.indexOf(" ")).trim();
        }
        el.setAttribute('command-line', cleancommand);
        this._term.appendElement(el);
        break;

      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
        var startdivs = this._term.element.querySelectorAll("et-commandframe:not([return-code])");
        log("startdivs:", startdivs);
        if (startdivs.length !== 0) {

          this.preserveScroll(function() {
            this._term.moveRowsToScrollback();
            var outputdiv = <HTMLDivElement>startdivs[startdivs.length-1];
            var node = outputdiv.nextSibling;

            var nodelist: Node[] = [];
            while (node !== null) {
              nodelist.push(node);
              node = node.nextSibling;
            }
            nodelist.forEach(function(node) {
              outputdiv.appendChild(node);
            });
            outputdiv.setAttribute('return-code', this._htmlData);
            outputdiv.className = "extraterm_output";
          });
        }

        break;

      default:
        break;
    }
    this._applicationMode = ApplicationMode.APPLICATION_MODE_NONE;

    log("html-mode end!",this._htmlData);
    this._htmlData = null;
  }

  preserveScroll(task:()=>void): void {
    var scrollatbottom = this._term.isScrollAtBottom();
    task.call(this);
    if (scrollatbottom) {
      // Scroll the terminal down to the bottom.
      this._term.scrollToBottom();
    }
  }

  /**
   * Handle a click inside the terminal.
   * 
   * @param {event} event
   */
// FIXME this is an obsolete way of working.
  _handleWindowClick(event: Event) {
  //      log("body on click!",event);
    var type = event.srcElement.getAttribute(SEMANTIC_TYPE);
    var value = event.srcElement.getAttribute(SEMANTIC_VALUE);
    this._handleMineTypeClick(type, value);
  }

  /**
   * Handle new stdout data from the pty.
   * 
   * @param {string} data New data.
   */
  _handlePtyStdoutData (data: string): void {
    log("incoming data:",""+data);
    this._term.write("" + data);
  }

  /**
   * Handle new stderr data from the pty.
   * 
   * @param {type} data New data.
   */
  _handlePtyStderrData(data: string): void {
    this._term.write(data);
  }

  /**
   * Handle a pty close event.
   * 
   * @param {string} data
   */
  _handlePtyClose(data: string): void {
    this._ptyBridge = null;
    this.events.emit('ptyclose', this);
  }
  
  /**
   * Handle data coming from the user.
   * 
   * This just pushes the keys from the user through to the pty.
   * @param {string} data The data to process.
   */
  _handleTermData(data: string): void {
    this._sendDataToPty(data);
  }

  /**
   * Send data to the pseudoterminal.
   * 
   * @param {string} text
   * @param {function} callback (Optional) Callback to call once the data has
   *     been sent.
   */
  _sendDataToPty(text: string, callback?: Function): void {
    var jsonString = JSON.stringify({stream: text});
  //      console.log("<<< json string is ",jsonString);
  //      console.log("<<< json string length is ",jsonString.length);
    var sizeHeaderBuffer = new Buffer(4);
    sizeHeaderBuffer.writeUInt32BE(jsonString.length, 0);

    this._ptyBridge.stdin.write(sizeHeaderBuffer);
    this._ptyBridge.stdin.write(jsonString, callback);
  }

  /**
   * Send a resize message to the pty.
   * 
   * @param {number} cols The new number of columns in the terminal.
   * @param {number} rows The new number of rows in the terminal.
   * @param {function} callback (Optional) Callback to call once the data has
   *     been sent.
   */
  _sendResize(cols: number, rows: number, callback?: Function): void {
    var jsonString = JSON.stringify({resize: [cols, rows]});
  //      console.log("<<< json string is ",jsonString);
  //      console.log("<<< json string length is ",jsonString.length);
    var sizeHeaderBuffer = new Buffer(4);
    sizeHeaderBuffer.writeUInt32BE(jsonString.length, 0);

    this._ptyBridge.stdin.write(sizeHeaderBuffer);
    this._ptyBridge.stdin.write(jsonString, callback);
  }
    
  // git diff scroll speed test
  // --------------------------
  // Original with innerHTML: 11-14ms per line scroll update.
  // DOM work, no decorate:   10-15ms per line scroll update.
  // decorate SPAN:           20-25ms per line scroll update.
  // decorate et-word:        28-34ms per line scroll update.
  // SPAN with innerHTML:     12-19ms per line scroll update.
  // et-word with innerHTML:  20-24ms per line scroll update.

  _lineToHTML(line: any[]): string {
    var len = line.length;
    var whiteState = true;
    var tempLine: any[];
    var tuple: any;
    var output = "";
    var WORD_SPAN = "<span class='et-word' tabindex='-1'>";

    tempLine = [];
    for (var i=0; i<len; i++) {
      tuple = line[i];
      var isWhite = tuple[1] === ' ';
      if (whiteState !== isWhite) {
        if (tempLine.length !== 0) {
          if (whiteState) {
            output = output + this._super_lineToHTML.call(this._term, tempLine);
          } else {
            output = output + WORD_SPAN + this._super_lineToHTML.call(this._term, tempLine) + "</span>";
          }
          tempLine = [];
        }
        whiteState = isWhite;
      }
      tempLine.push(tuple);
    }

    if (tempLine.length !== 0) {
      if (whiteState) {
        output = output + this._super_lineToHTML.call(this._term, tempLine);
      } else {
        output = output + WORD_SPAN + this._super_lineToHTML.call(this._term, tempLine) + "</span>";
      }
    }

    return output;
  }

  /**
   * Process a click on a item of the given mimetype and value.
   * 
   * @param {string} type
   * @param {string} value
   */
  _handleMineTypeClick(type: string, value: string): void {
    if (type === "directory") {
      this._sendDataToPty("cd " + value + "\n"); // FIXME escaping
    }
  }
}
