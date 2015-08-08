/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

import _  = require('lodash');
import fs  = require('fs');
import crypto = require('crypto');
import EtEmbeddedViewer = require('./embeddedviewer');
import EtCommandPlaceHolder = require('./commandplaceholder');
import markdownviewer = require('./gui/markdownviewer');

import domutils = require('./domutils');
import termjs = require('./term');
import scrollbar = require('./gui/scrollbar');
import util = require('./gui/util');
import clipboard = require('clipboard');
import webipc = require('./webipc');
import globalcss = require('./gui/globalcss');

const debug = true;
let startTime: number = window.performance.now();
let registered = false;

function log(...msgs: any[]): void {
  if (debug) {
    const offset = window.performance.now() - startTime;
    const msg: string = msgs.reduce( (accu: string, value: string) => accu + value, "");
    console.timeStamp(msg);
    console.log(""+offset + ": " + msg);
  }
}

const ID = "EtTerminalTemplate";
const EXTRATERM_COOKIE_ENV = "EXTRATERM_COOKIE";
const SEMANTIC_TYPE = "data-extraterm-type";
const SEMANTIC_VALUE = "data-extraterm-value";
const ID_CONTAINER = "terminal_container";
const ID_MAIN_STYLE = "main_style";
const ID_THEME_STYLE = "theme_style";

const enum ApplicationMode {
  APPLICATION_MODE_NONE = 0,
  APPLICATION_MODE_HTML = 1,
  APPLICATION_MODE_OUTPUT_BRACKET_START = 2,
  APPLICATION_MODE_OUTPUT_BRACKET_END = 3,
  APPLICATION_MODE_REQUEST_FRAME = 4,
  APPLICATION_MODE_SHOW_MIME = 5,
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
class EtTerminal extends HTMLElement {
  
  //-----------------------------------------------------------------------
  // Statics
  
  static TAG_NAME = "et-terminal";
  
  static EVENT_USER_INPUT = "user-input";
  
  static EVENT_TERMINAL_RESIZE = "terminal-resize";
  
  static EVENT_TITLE = "title";
  
  static EVENT_UNKNOWN_KEY_DOWN = "unknown-key-down";
  
  /**
   * 
   */
  static init(): void {
    if (registered === false) {
      scrollbar.init();
      EtEmbeddedViewer.init();
      EtCommandPlaceHolder.init();
      markdownviewer.init();
      window.document.registerElement(EtTerminal.TAG_NAME, {prototype: EtTerminal.prototype});
      registered = true;
    }
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically.
  private _container: HTMLDivElement;
  private _scrollbar: scrollbar;
  private _scrollSyncID: number;
  private _autoscroll: boolean;
  
  private _termContainer: HTMLDivElement;

  private _term: termjs.Terminal;
  private _htmlData: string;
  
  private _mimeType: string;
  private _mimeData: string;
  
  private _applicationMode: ApplicationMode;
  private _bracketStyle: string;
  private _lastBashBracket: string;
  
  private _blinkingCursor: boolean;
  private _title: string;
  private _noFrameCommands: RegExp[];
  private _super_lineToHTML: (line: any[]) => string;
  
  private _tagCounter: number;
  
  private _mainStyleLoaded: boolean;
  private _themeStyleLoaded: boolean;
  private _resizePollHandle: util.LaterHandle;
  private _elementAttached: boolean;
  
  private _initProperties(): void {
    this._elementAttached = false;
    this._scrollSyncID = -1;
    this._autoscroll = true;
    this._term = null;
    this._htmlData = null;
    this._mimeType = null;
    this._mimeData = null;
    this._applicationMode = ApplicationMode.APPLICATION_MODE_NONE;
    this._bracketStyle = null;
    this._lastBashBracket = null;
    this._blinkingCursor = false;
    this._noFrameCommands = [];
    this._title = "New Tab";
    this._tagCounter = 0;    
    this._mainStyleLoaded = false;
    this._themeStyleLoaded = false;
    this._resizePollHandle = null;
  }
  
  //-----------------------------------------------------------------------
  // Public members.
  createdCallback(): void {
    this._initProperties();
    const shadow = util.createShadowRoot(this);

    const clone = this._createClone();
    shadow.appendChild(clone);
    
    this._handleResize = this._handleResize.bind(this);

    util.getShadowId(this, ID_MAIN_STYLE).addEventListener('load', () => {
      this._mainStyleLoaded = true;
      this._handleStyleLoad();
    });

    util.getShadowId(this, ID_THEME_STYLE).addEventListener('load', () => {
      this._themeStyleLoaded = true;
      this._handleStyleLoad();
      });

    this._container = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
    this._scrollbar = <scrollbar>this._container.querySelector('cb-scrollbar');
    this._termContainer = <HTMLDivElement>this._container.firstElementChild;
    
    const cookie = crypto.randomBytes(10).toString('hex');
    
    process.env[EXTRATERM_COOKIE_ENV] = cookie;

    this._term = new termjs.Terminal({
      colors: this._colors(),
      scrollback: 1000,
      cursorBlink: this._blinkingCursor,
      physicalScroll: true,
      applicationModeCookie: cookie,
      debug: true
    });

    // const defaultLineToHTML = this._term._lineToHTML;
    // this._super_lineToHTML = this._term._lineToHTML;
    // this._term._lineToHTML=  this._lineToHTML.bind(this);

    this._term.debug = true;
    this._term.on('title', this._handleTitle.bind(this));
    this._term.on('data', this._handleTermData.bind(this));
    
    this._getWindow().addEventListener('resize', this._handleResize);
    
    this._term.on('key', this._handleKeyDown.bind(this));
    this._term.on('unknown-keydown', this._handleUnknownKeyDown.bind(this));
    this._term.on('manual-scroll', this._handleManualScroll.bind(this));
    
    // Application mode handlers    
    this._term.on('application-mode-start', this._handleApplicationModeStart.bind(this));
    this._term.on('application-mode-data', this._handleApplicationModeData.bind(this));
    this._term.on('application-mode-end', this._handleApplicationModeEnd.bind(this));
  }
  
  attachedCallback(): void {
    if (this._elementAttached) {
      return;
    }
    this._elementAttached = true;
    
    // Window DOM event handlers
    this._handleWindowClick = this._handleWindowClick.bind(this);
    this._getWindow().document.body.addEventListener('click', this._handleWindowClick);
    
    this._term.open(this._termContainer);

    this._term.element.addEventListener('keypress', this._handleKeyPressTerminal.bind(this));
    this._term.element.addEventListener('keydown', this._handleKeyDownTerminal.bind(this));
    this._container.addEventListener('scroll-move', (ev: CustomEvent) => {
      this._syncManualScroll();  
    });

    this._term.write('\x1b[31mWelcome to Extraterm!\x1b[m\r\n');

    this._scrollbar.addEventListener('scroll', (ev: CustomEvent) => {
      this._autoscroll = ev.detail.isBottom;
    });
  
    this._syncScrolling();
  }
  
  /**
   * Blinking cursor
   * 
   * True means the cursor should blink, otherwise it doesn't.
   */
  set blinkingCursor(blink: boolean) {
    this._blinkingCursor = blink;
    if (this._term !== null) {
      this._term.setCursorBlink(blink);
    }
  }
  
  set themeCssPath(path: string) {
    const themeCss = fs.readFileSync(path, {encoding: 'utf8'});
    const themeTag = <HTMLStyleElement> util.getShadowId(this, ID_THEME_STYLE);
    themeTag.innerHTML = globalcss.stripFontFaces(themeCss);
  }
  
  set noFrameCommands(commandList: string[]) {
    if (commandList === null) {
      this._noFrameCommands = [];
      return;
    }
    
    this._noFrameCommands = commandList.map( exp => new RegExp(exp) );
  }
  
  private _isNoFrameCommand(commandLine: string): boolean {
    const cmd = commandLine.trim();
    return this._noFrameCommands.some( exp => exp.test(cmd) );
  }
  
  /**
   * Get this terminal's title.
   *
   * This is the window title of the terminal, don't confuse it with more
   * general HTML title of the element.
   */
  get terminalTitle(): string {
    return this._title;
  }
  
  /**
   * Destroy the terminal.
   */
  destroy(): void {
    if (this._scrollSyncID !== -1) {
      cancelAnimationFrame(this._scrollSyncID);
    }

    if (this._resizePollHandle !== null) {
      this._resizePollHandle.cancel();
      this._resizePollHandle = null;
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
   * Returns true if this terminal has the input focus.
   *
   * @return true if the terminal has the focus.
   */
  hasFocus(): boolean {
    return this._term === null ? false : this._term.hasFocus();
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
      this._sendDataToPtyEvent(text);
    }
  }
  
  /**
   * Scroll the terminal down as far as possible.
   */
  scrollToBottom(): void {
    this._term.scrollToBottom();
  }
  
  resizeToContainer(): void {
    this._handleResize();
  }
  
  //-----------------------------------------------------------------------
  private _createClone(): Node {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;

      const success_color = "#00ff00";
      const fail_color = "#ff0000";
      template.innerHTML = `<style id="${ID_MAIN_STYLE}">
        :host {
          display: block;
        }
        
        .terminal_container {
            display: flex;
            flex-direction: row;
            width: 100%;
            height: 100%;
        }

        .terminal_scrollbar {
            flex: 0;
            min-width: 15px;
            height: 100%;
        }

        .term_container {
            flex: 1;
            height: 100%;
        }

        .terminal {
            width: 100%;
            height: 100%;

            white-space: nowrap;
            font-family: sans-serif, ${termjs.Terminal.NO_STYLE_HACK};
            overflow-x: scroll;
            overflow-y: hidden;
        }
        
        .terminal > DIV.terminal-active, .terminal > DIV.terminal-scrollback {
            margin-left: 2px;
            margin-right: 2px;
        }
        </style>
        <style id="${ID_THEME_STYLE}"></style>
        <div class='terminal_container' id='${ID_CONTAINER}'>
          <div class='term_container'></div>
          <cb-scrollbar class='terminal_scrollbar'></cb-scrollbar>
        </div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  /**
   * Get the window which this terminal is on.
   * 
   * @returns {Window} The window object.
   */
  private _getWindow(): Window {
    return this.ownerDocument.defaultView;  
  }
  
  private _getDocument(): Document {
    return this.ownerDocument;
  }
  
  private _colors(): string[] {
    const colorList = termjs.Terminal.colors.slice();

    const linuxColors = [
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

    for (let i=0; i < linuxColors.length; i++) {
      colorList[i] = linuxColors[i];
    }

    colorList[256] = "#000000";
    colorList[257] = "#b2b2b2";

    return colorList;
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
    const el = this._term.element;
    this._autoscroll = el.scrollTop === el.scrollHeight - el.clientHeight;
    this._scrollbar.position = el.scrollTop;
  }
  
  
  /**
   * Handler for window title change events from the pty.
   * 
   * @param title The new window title for this terminal.
   */
  _handleTitle(title: string): void {
    this._title = title;
    this._sendTitleEvent(title);
  }
  
  /**
   * Handle a resize event from the window.
   */
  _handleResize(): void {
    if (this._term !== null) {
      if (this._mainStyleLoaded && this._themeStyleLoaded) {
        const size = this._term.resizeToContainer();
        this._sendResizeEvent(size.cols, size.rows);
      }
    }
  }
  
  _resizePoll(): void {
    if (this._term !== null && this._mainStyleLoaded && this._themeStyleLoaded) {
      if (this._term.effectiveFontFamily().indexOf(termjs.Terminal.NO_STYLE_HACK) !== -1) {
        // Font has not been correctly applied yet.
        this._resizePollHandle = util.doLaterFrame(this._resizePoll.bind(this));
      } else {
        // Yay! the font is correct. Resize the term now.
        this._handleResize();
      }
    }
  }
  
  _handleStyleLoad(): void {
    if (this._mainStyleLoaded && this._themeStyleLoaded) {
      // Start polling the term for application of the font.
      this._resizePollHandle = util.doLaterFrame(this._resizePoll.bind(this));
    }
  }
  
  _handleKeyDown(key: string, ev: KeyboardEvent): void {
    if (key !== null) {
      this._term.scrollToBottom();
    }
  }
  
  /**
   * Handle an unknown key down event from the term.
   */
  private _handleUnknownKeyDown(ev: KeyboardEvent): boolean {
    // this.events.emit('unknown-keydown', this, ev);
    if (ev.keyCode === 67 && ev.ctrlKey && ev.shiftKey) {
      // Ctrl+Shift+C
      this.copyToClipboard();
      return false;
      
    } else if (ev.keyCode === 86 && ev.ctrlKey && ev.shiftKey) {
      // Ctrl+Shift+V
      this._pasteFromClipboard();
      return false;  
    }
    
    this._sendUnknownKeyDown(ev);
    return false;
  }

  _handleKeyPressTerminal(ev: KeyboardEvent): void {
//    console.log("._handleKeyPressTerminal: ", ev.keyCode);
    this._term.keyPress(ev);
  }

  private _handleKeyDownTerminal(ev: KeyboardEvent): void {
    let frames: EtEmbeddedViewer[];
    let index: number;

    // Key down on a command frame.
    if ((<HTMLElement>ev.target).tagName === EtEmbeddedViewer.TAG_NAME) {
      if (ev.keyCode === 27) {
        // 27 = esc.
        this._term.element.focus();
        this._term.scrollToBottom();
        ev.preventDefault();
        return;

      } else if (ev.keyCode === 32 && ev.ctrlKey) {
        // 32 = space
        (<EtEmbeddedViewer>ev.target).openMenu();
        ev.preventDefault();
        return;

      } else if (ev.keyCode === 38) {
        // 38 = up arrow.

        // Note ugly convert-to-array code. ES6 Array.from() help us!
        frames = Array.prototype.slice.call(this._term.element.querySelectorAll(EtEmbeddedViewer.TAG_NAME));
        index = frames.indexOf(<EtEmbeddedViewer>ev.target);
        if (index > 0) {
          frames[index-1].focusLast();
        }
        ev.preventDefault();
        return;

      } else if (ev.keyCode === 40) {
        // 40 = down arrow.

        frames = Array.prototype.slice.call(this._term.element.querySelectorAll(EtEmbeddedViewer.TAG_NAME));
        index = frames.indexOf(<EtEmbeddedViewer>ev.target);
        if (index < frames.length -1) {
          frames[index+1].focusFirst();
        }
        ev.preventDefault();
        return;
      }

    } else if (ev.target === this._term.element) {
      // In normal typing mode.

      // Enter cursor mode.
      if (ev.keyCode === 38 && ev.shiftKey) {
        // Shift + Up arrow.
        const lastFrame = <EtEmbeddedViewer>this._term.element.querySelector(EtEmbeddedViewer.TAG_NAME + ":last-of-type");
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
    
    // FIXME check cookie!

    if (params.length === 1) {
      // Normal HTML mode.
      this._applicationMode = ApplicationMode.APPLICATION_MODE_HTML;

    } else if(params.length >= 2) {
      switch ("" + params[1]) {
        case "" + ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
          this._applicationMode = ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START;
          this._bracketStyle = params[2];
          break;

        case "" + ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
          this._applicationMode = ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END;
          log("Starting APPLICATION_MODE_OUTPUT_BRACKET_END");
          break;
          
        case "" + ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
          this._applicationMode = ApplicationMode.APPLICATION_MODE_REQUEST_FRAME;
          log("Starting APPLICATION_MODE_REQUEST_FRAME");
          break;
          
        case "" + ApplicationMode.APPLICATION_MODE_SHOW_MIME:
          log("Starting APPLICATION_MODE_SHOW_MIME");
          this._applicationMode = ApplicationMode.APPLICATION_MODE_SHOW_MIME;
          this._mimeData = "";
          this._mimeType = params[2];
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
    switch (this._applicationMode) {
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
        this._htmlData = this._htmlData + data;
        break;
        
      case ApplicationMode.APPLICATION_MODE_SHOW_MIME:
        this._mimeData = this._mimeData + data;
        break;
        
      default:
        break;
    }
  }
  
  /**
   * Handle the exit from application mode.
   */
  _handleApplicationModeEnd(): void {
    let el: HTMLElement;
    let startdivs: NodeList;
    
    switch (this._applicationMode) {
      case ApplicationMode.APPLICATION_MODE_HTML:
        el = this._getWindow().document.createElement("div");
        el.innerHTML = this._htmlData;
        this._term.appendElement(el);
        break;

      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
        this._handleApplicationModeBracketStart();
        break;

      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
        this._handleApplicationModeBracketEnd();
        break;

      case ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
        this.handleRequestFrame(this._htmlData);
        break;
        
      case ApplicationMode.APPLICATION_MODE_SHOW_MIME:
        this._handleShowMimeType(this._mimeType, this._mimeData);
        this._mimeType = "";
        this._mimeData = "";
        break;
        
      default:
        break;
    }
    this._applicationMode = ApplicationMode.APPLICATION_MODE_NONE;

    log("html-mode end!",this._htmlData);
    this._htmlData = null;
  }

  private _handleApplicationModeBracketStart(): void {
    const startdivs = this._term.element.querySelectorAll(
                        EtEmbeddedViewer.TAG_NAME + ":not([return-code]), "+EtCommandPlaceHolder.TAG_NAME);

    if (startdivs.length !== 0) {
      return;  // Don't open a new frame.
    }
    
    // Fetch the command line.
    let cleancommand = this._htmlData;
    if (this._bracketStyle === "bash") {
      // Bash includes the history number. Remove it.
      const trimmed = this._htmlData.trim();
      cleancommand = trimmed.slice(trimmed.indexOf(" ")).trim();
    }
    
    if ( ! this._isNoFrameCommand(cleancommand)) {
      // Create and set up a new command-frame.
      const el = this._createEmbeddedViewerElement(cleancommand);
      this._term.appendElement(el);
    } else {
            
      // Don't place an embedded viewer, but use an invisible place holder instead.
      const el = this._getWindow().document.createElement(EtCommandPlaceHolder.TAG_NAME);
      el.setAttribute('command-line', cleancommand);
      this._term.appendElement(el);
    }
  }
  
  private _createEmbeddedViewerElement(commandLine: string): EtEmbeddedViewer {
    // Create and set up a new command-frame.
    const el = <EtEmbeddedViewer> this._getWindow().document.createElement(EtEmbeddedViewer.TAG_NAME);

    el.addEventListener('close-request', (function() {
      el.remove();
      this.focus();
    }).bind(this));

    el.addEventListener('type', (function(ev: CustomEvent) {
      this._sendDataToPty(ev.detail);
    }).bind(this));

    // el.addEventListener('copy-clipboard-request', (function(ev: CustomEvent) {
    //   var clipboard = gui.Clipboard.get();
    //   clipboard.set(ev.detail, 'text');
    // }).bind(this));
// FIXME
    // el.addEventListener('frame-pop-out', (ev: CustomEvent): void => {
    //   this.events.emit('frame-pop-out', this, ev.detail);
    // });
    
    el.setAttribute('command-line', commandLine);  // FIXME attr name
    el.setAttribute('tag', "" + this._getNextTag());
    return el;
  }
  
  private _handleApplicationModeBracketEnd(): void {
    const startElement = this._term.element.querySelectorAll(
                          EtEmbeddedViewer.TAG_NAME + ":not([return-code]), " + EtCommandPlaceHolder.TAG_NAME);

    if (startElement.length !== 0) {

      this.preserveScroll(function() {
        
        const returnCode = this._htmlData;
        let viewerElement = <HTMLElement>startElement[startElement.length-1];
        if (viewerElement instanceof EtCommandPlaceHolder) {
          // There is a place holder and not an embedded viewer.
          if (returnCode === "0") {
            // The command returned successful, just remove the place holder and that is it.
            viewerElement.parentNode.removeChild(viewerElement);
            return;
          } else {
            // The command went wrong. Replace the place holder with a real viewer
            // element and pretend that we had done this when the command started running.
            const newViewerElement = this._createEmbeddedViewerElement(viewerElement.getAttribute("command-line"));
            viewerElement.parentNode.replaceChild(newViewerElement, viewerElement);
            viewerElement = newViewerElement;
          }
        }
        
        this._term.moveRowsToScrollback();        
        let node = viewerElement.nextSibling;

        // Collect the DIVs in the scrollback from the EtEmbeddedViewer up to the end of the scrollback.
        const nodelist: Node[] = [];
        while (node !== null) {
          if (node.nodeName !== "DIV" || ! (<HTMLElement> node).classList.contains("terminal-active")) {
            nodelist.push(node);
          }
          node = node.nextSibling;
        }
        nodelist.forEach(function(node) {
          viewerElement.appendChild(node);
        });
        viewerElement.setAttribute('return-code', returnCode);
        viewerElement.className = "extraterm_output";
      });
    }
  }

  /**
   * Copy the selection to the clipboard.
   */
  copyToClipboard(): void {
    const selection = this.shadowRoot.getSelection();
    if (selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      return;
    }
    
    const text = this._extractTextFromRange(range);
    webipc.clipboardWrite(text.replace(/\u00a0/g,' '));
  }
  
  /**
   * Extracts formatted plain text from a document range.
   *
   * @param range the range to scan and extract the text from.
   * @return the formatted plain text representation.
   */
  private _extractTextFromRange(range: Range): string {
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    let result = "";
    
    // Use case where the start and end of the range are inside the same text node.
    if (startContainer === range.endContainer) {
      if (startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = <Text> startContainer;
        return textNode.data.slice(range.startOffset, range.endOffset);
      }
    }
    
    let currentNode: Node;
    if (startContainer.nodeType === Node.TEXT_NODE) {
      result += (<Text> startContainer).data.slice(range.startOffset);
      currentNode = nextDocumentOrderNode(startContainer);
    } else {
      currentNode = startContainer.childNodes[range.startOffset];
    }

    const endNode = endContainer.nodeType === Node.TEXT_NODE ? endContainer : endContainer.childNodes[range.endOffset];
    
    while (currentNode !== endNode && currentNode !== null) {
      if (currentNode.nodeType === Node.TEXT_NODE) {
        result += (<Text> currentNode).data;
      }
      currentNode = nextDocumentOrderNode(currentNode);
    }
    
    if (endContainer.nodeType === Node.TEXT_NODE) {
      result += (<Text> endContainer).data.slice(0, range.endOffset);
    }
    
    return result;
  }
  
  pasteText(text: string): void {
    this.send(text);
    this._term.scrollToBottom();
  }

  /**
   * Paste text from the clipboard.
   *
   * This method is async and returns before the paste is done.
   */
  private _pasteFromClipboard(): void {
    webipc.clipboardReadRequest();
  }
  
// FIXME delete this.
  preserveScroll(task:()=>void): void {
    const scrollatbottom = this._term.isScrollAtBottom();
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
    const type = event.srcElement.getAttribute(SEMANTIC_TYPE);
    const value = event.srcElement.getAttribute(SEMANTIC_VALUE);
    this._handleMineTypeClick(type, value);
  }

  /**
   * Handle new stdout data from the pty.
   * 
   * @param {string} data New data.
   */
  private _handlePtyStdoutData (data: string): void {
    log("incoming data:",""+data);
    this._term.write("" + data);
  }

  /**
   * Handle new stderr data from the pty.
   * 
   * @param {type} data New data.
   */
  private _handlePtyStderrData(data: string): void {
    this._term.write(data);
  }

  /**
   * Handle data coming from the user.
   * 
   * This just pushes the keys from the user through to the pty.
   * @param {string} data The data to process.
   */
  private _handleTermData(data: string): void {
    this._sendDataToPtyEvent(data);
  }

  /**
   * Send data to the pseudoterminal.
   * 
   * @param {string} text
   */
  private _sendDataToPtyEvent(text: string): void {
    const event = new CustomEvent(EtTerminal.EVENT_USER_INPUT, { detail: {data: text } });
    this.dispatchEvent(event);
  }

  /**
   * Send a resize message to the pty.
   * 
   * @param {number} cols The new number of columns in the terminal.
   * @param {number} rows The new number of rows in the terminal.
   */
  private _sendResizeEvent(cols: number, rows: number, callback?: Function): void {
    const event = new CustomEvent(EtTerminal.EVENT_TERMINAL_RESIZE, { detail: {columns: cols, rows: rows } });
    this.dispatchEvent(event);    
  }

  private _sendTitleEvent(title: string): void {
    const event = new CustomEvent(EtTerminal.EVENT_TITLE, { detail: {title: title } });
    this.dispatchEvent(event);    
  }
  
  private _sendUnknownKeyDown(ev: KeyboardEvent): void {
    const event = new CustomEvent(EtTerminal.EVENT_UNKNOWN_KEY_DOWN, { detail: ev });
    this.dispatchEvent(event);
  }
  
  // git diff scroll speed test
  // --------------------------
  // Original with innerHTML: 11-14ms per line scroll update.
  // DOM work, no decorate:   10-15ms per line scroll update.
  // decorate SPAN:           20-25ms per line scroll update.
  // decorate et-word:        28-34ms per line scroll update.
  // SPAN with innerHTML:     12-19ms per line scroll update.
  // et-word with innerHTML:  20-24ms per line scroll update.

  private _lineToHTML(line: any[]): string {
    const len = line.length;
    let whiteState = true;
    let tempLine: any[];
    let tuple: any;
    let output = "";
    const WORD_SPAN = "<span class='et-word' tabindex='-1'>";

    tempLine = [];
    for (let i=0; i<len; i++) {
      tuple = line[i];
      const isWhite = tuple[1] === ' ';
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
  
  handleRequestFrame(frameId: string): void {
    const sourceFrame: EtEmbeddedViewer = this._findFrame(frameId);
    const data = sourceFrame !== null ? sourceFrame.text : "";
    const lines = data.split("\n");
    let encodedData: string = "";
    lines.forEach( (line: string) => {
      encodedData = window.btoa(line +"\n");
      this._sendDataToPtyEvent(encodedData+"\n");
    });
      
    this._sendDataToPtyEvent("\x04");
    
    if (encodedData.length !== 0) {
      this._sendDataToPtyEvent("\x04");
    }
  }

  _handleShowMimeType(mimeType: string, mimeData: string): void {
    if (mimeType === "text/markdown") {
      const win = this._getWindow();
      const el = win.document.createElement(markdownviewer.TAG_NAME);
      const decodedMimeData = window.atob(mimeData);
      el.appendChild(win.document.createTextNode(decodedMimeData));
      this._term.appendElement(el);
    } else {
      log("Unknown mime type: " + mimeType);
    }    
  }

  /**
   * Find a command frame by ID.
   */
  private _findFrame(frameId: string): EtEmbeddedViewer {
    if (/[^0-9]/.test(frameId)) {
      return null;
    }
    const matches = this._term.element.querySelectorAll(EtEmbeddedViewer.TAG_NAME + "[tag='" + frameId + "']");
    return matches.length === 0 ? null : <EtEmbeddedViewer>matches[0];
  }
  
  /**
   * Process a click on a item of the given mimetype and value.
   * 
   * @param {string} type
   * @param {string} value
   */
  private _handleMineTypeClick(type: string, value: string): void {
    if (type === "directory") {
      this._sendDataToPtyEvent("cd " + value + "\n"); // FIXME escaping
    }
  }
  
  private _getNextTag(): number {
    this._tagCounter++;
    return this._tagCounter;
  }
}

function nextDocumentOrderNode(currentNode: Node): Node {
  if (currentNode.childNodes.length !== 0) {
    return currentNode.childNodes[0];
  }
  
  if (currentNode.nextSibling !== null) {
    return currentNode.nextSibling;
  }
  
  return nextDocumentOrderNodeUp(currentNode.parentNode);
}

function nextDocumentOrderNodeUp(currentNode: Node): Node {
  if (currentNode.nextSibling !== null) {
    return currentNode.nextSibling;
  }
  return nextDocumentOrderNodeUp(currentNode.parentNode);
}

export = EtTerminal;
