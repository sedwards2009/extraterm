define(['require', 'gui/contextmenu', 'gui/menuitem', 'gui/checkboxmenuitem', 'gui/util'],
function(require, contextmenu, menuitem, checkboxmenuitem, util) {

var ID = "EtCommandFrameTemplate";
var COMMANDLINE_ATTR = "command-line";
var RETURN_CODE_ATTR = "return-code";
var EXPAND_ATTR = "expand";
var LINE_NUMBERS_ATTR = "line-numbers";

var EtCommandFrameProto = Object.create(window.HTMLElement.prototype);

function createClone() {
  var template = window.document.getElementById(ID);
  if (template === null) {
    template = window.document.createElement('template');
    template.id = ID;
    
    var success_color = "#00ff00";
    var fail_color = "#ff0000";
    
    template.innerHTML = "<style>\n" +
      "@import url('" + require.toUrl("css/topcoat-desktop-light.css") + "');\n" +
      "@import url('" + require.toUrl("css/font-awesome.css") + "');\n" +

      ":host {\n" +
      "display: block;\n" +
      "}\n" +

      "#container {\n" +
      "  display: flex;\n" +
      "}\n" +

      "#main {\n" +
      "  flex: auto 1 1;\n" +
      "}\n" +

      "#header {\n" +
      "  border-top-right-radius: 0.5em;\n" +
      "  border-bottom-right-radius: 0.5em;\n" +
      "  padding-top: 1px;\n" +
      "  padding-left: 0.5em;\n" +
      "  padding-right: 0.5em;\n" +
      "  padding-bottom: 1px;\n" +
      "  display: flex;\n" +
      "}\n" +

      "#header.running {\n" +
      "  border: 1px solid white;\n" +
      "}\n" +

      "#header.success {\n" +
      "  border-top: 1px solid " + success_color + ";\n" +
      "  border-bottom: 1px solid " + success_color + ";\n" +
      "  border-right: 1px solid " + success_color + ";\n" +
      "}\n" +

      "#header.fail {\n" +
      "  border-top: 1px solid " + fail_color + ";\n" +
      "  border-bottom: 1px solid " + fail_color + ";\n" +
      "  border-right: 1px solid " + fail_color + ";\n" +
      "}\n" +

      "@-webkit-keyframes PULSE_ANIMATION {\n" +
      "  0%   { background-color: rgba(255, 165, 0, 1.0); }\n" +
      "  25%   { background-color: rgba(255, 165, 0, 1.0); }\n" +
      "  50% { background-color: rgba(255, 165, 0, 0.5); }\n" +
      "  75% { background-color: rgba(255, 165, 0, 1.0); }\n" +
      "  100%   { background-color: rgba(255, 165, 0, 1.0); }\n" +
      "}\n" +

      "#header:focus {\n" +
      "  -webkit-animation: PULSE_ANIMATION 2s infinite;\n" +
      "  animation: PULSE_ANIMATION 2s infinite;\n" +
      "}\n" +

      "#output.closed {\n" +
      "  display: none;\n" +
      "  height: 1px;\n" +
      "  overflow: hidden;\n" +
      "}\n" +
       

      "#gutter {\n" +
      "  flex: 2rem 0 0;\n" +
      "  width: 2rem;\n" +
      "  padding: 1px\n" +
      "}\n" +

      "#gutter.running {\n" +
      "}\n" +

      "#gutter.success {\n" +
      "  color: " + success_color + ";\n" +
      "  border-right: 1px solid " + success_color + ";\n" +
      "}\n" +

      "#gutter.fail {\n" +
      "  color: " + fail_color + ";\n" +
      "  border-right: 1px solid " + fail_color + ";\n" +
      "}\n" +

      "#commandline {\n" +
      "  flex: auto 1 1;\n" +
      "}\n" +

      "#close_button {\n" +
      "  flex: auto 0 0;\n" +
      "  padding: 0px;\n" +
      "  background-color: transparent;\n" +
      "  border: 0px;\n" +
      "  color: white;\n" +
      "}\n" +
      "#close_button:hover {\n" +
      "  color: red;\n" +
      "}\n" +

      "#icon_div {\n" +
      "  display: inline-block;\n" +
      "  width: 1em;\n" +
      "  height: 1em;\n" +
      "}\n" +

      "#expand_button {\n" +
      "  display: inline-block;\n" +
      "  padding: 0px;\n" +
      "  background-color: transparent;\n" +
      "  color: white;\n" +
      "  border: 0px;\n" +
      "  width: 1em;\n" +
      "  height: 1em;\n" +
      "}\n" +
       
      "content.line_numbers::content > div {\n" +
      "  counter-increment: lines;\n" +
      "  position: relative;\n" +
      "  left: calc(-2rem - 2px);\n" +
      "}\n" +

      "content.line_numbers::content > div:before {\n" +
      "  display: inline-block;\n" +
      "  width: 2rem;\n" +
      "  margin-right: 2px;\n" +
      "  content: counter(lines);\n" +
      "  color: white;\n" +
      "  text-align: right;\n" +
      "  font-size: 0.7rem;\n" +
      "  }\n" +
      "</style>\n" +
      "<div id='container'>" +
      "  <div id='gutter' class='running'>" +
       "<div id='icon_div'><i id='icon'></i></div>" +
       "<button id='expand_button'><i id='expand_icon' class='fa fa-plus-square-o'></i></button>" +
      "  </div>" +
      "  <div id='main'>" +
      "    <div id='header' tabindex='-1'><div id='commandline'></div><button id='close_button'><i class='fa fa-times-circle'></i></button></div>" +
      "    <div id='output'><content id='lines_content'></content></div>" +
      "  </div>" +
      "</div>" +
      "<cb-contextmenu id='contextmenu'>\n" +
      "<cb-menuitem icon='terminal' name='typecommand'>Type Command</cb-menuitem>\n" +
      "<cb-menuitem icon='copy' name='copycommand'>Copy Command to Clipboard</cb-menuitem>\n" +
      "<cb-checkboxmenuitem icon='list-ol' id='expandmenuitem' checked='true' name='expand'>Expand</cb-checkboxmenuitem>\n" +
      "<cb-checkboxmenuitem icon='list-ol' id='linesnumbersmenuitem' checked='false' name='showlines'>Line numbers</cb-checkboxmenuitem>\n" +
      "<cb-menuitem icon='times-circle' name='close'>Close</cb-menuitem>\n" +
      "</cb-contextmenu>\n";
    window.document.body.appendChild(template);
  }
  
  return window.document.importNode(template.content, true);
}

function getById(self, id) {
  return util.getShadowRoot(self).querySelector('#'+id);
}

function setAttr(self, attrName, newValue) {
  var icon;
  var gutter;
  var rc;
  var header;
  var output;
  var expandicon;
  var linescontent;

  if (attrName === COMMANDLINE_ATTR) {
    getById(self, 'commandline').innerText = newValue;
    return;
  }
  
  if (attrName === RETURN_CODE_ATTR) {
    gutter = getById(self, 'gutter');
    icon = getById(self, "icon");
    header= getById(self, 'header');

    if (newValue === null || newValue === undefined || newValue === "") {
      icon.className = "fa fa-cog";
      gutter.classList.add('running');
      header.classList.add('running');
    } else {
      
      rc = parseInt(newValue, 10);
      gutter.classList.remove('running');
      header.classList.remove('running');
      gutter.setAttribute('title', 'Return code: ' + rc);
      if (rc === 0) {
        icon.className = "fa fa-check";
        gutter.classList.add('success');
        header.classList.add('success');
      } else {
        icon.className = "fa fa-times";
        gutter.classList.add('fail');
        header.classList.add('fail');
      }
    }
    
    return;
  }
  
  if (attrName === EXPAND_ATTR) {
    output = getById(self, 'output');
    expandicon = getById(self, 'expand_icon');
    if (util.htmlValueToBool(newValue, true)) {
      // Expanded.
      output.classList.remove('closed');
      expandicon.classList.remove('fa-plus-square-o');
      expandicon.classList.add('fa-minus-square-o');
      getById(self, 'expandmenuitem').setAttribute('checked', true);
    } else {
      // Collapsed.
      output.classList.add('closed');
      expandicon.classList.add('fa-plus-square-o');
      expandicon.classList.remove('fa-minus-square-o');
      getById(self, 'expandmenuitem').setAttribute('checked', false);
    }
    return;
  }
  
  if (attrName === LINE_NUMBERS_ATTR) {
    linescontent = getById(self, 'lines_content');
    if (util.htmlValueToBool(newValue, false)) {
      linescontent.classList.add('line_numbers');
    } else {
      linescontent.classList.remove('line_numbers');      
    }
    return;
  }
}

EtCommandFrameProto.createdCallback = function() {
  var closebutton;
  var expandbutton;
  var cm;
  var shadow = util.createShadowRoot(this);
  
  var clone = createClone();
  shadow.appendChild(clone);
  
  setAttr(this, COMMANDLINE_ATTR, this.getAttribute(COMMANDLINE_ATTR));
  setAttr(this, RETURN_CODE_ATTR, this.getAttribute(RETURN_CODE_ATTR));
  setAttr(this, EXPAND_ATTR, this.getAttribute(EXPAND_ATTR));
  setAttr(this, LINE_NUMBERS_ATTR, this.getAttribute(LINE_NUMBERS_ATTR));

  closebutton = getById(this, 'close_button');
  closebutton.addEventListener('click', (function() {
      var event = new window.CustomEvent('close-request', { detail: null });
      this.dispatchEvent(event);
  }).bind(this));
  
  expandbutton = getById(this, 'expand_button');
  expandbutton.addEventListener('click', (function() {
    var expanded = util.htmlValueToBool(this.getAttribute(EXPAND_ATTR), true);
    this.setAttribute(EXPAND_ATTR, !expanded);
  }).bind(this));

  cm = getById(this, 'contextmenu');
  getById(this, 'container').addEventListener('contextmenu', (function(ev) {
    var cm;
    ev.stopPropagation();
    ev.preventDefault();
    cm = getById(this, 'contextmenu');
    cm.open(ev.clientX, ev.clientY);
  }).bind(this));

  cm.addEventListener('selected', (function(ev) {
    var event;
    switch (ev.detail.name) {
      case "copycommand":
        event = new window.CustomEvent('copy-clipboard-request', { detail: this.getAttribute(COMMANDLINE_ATTR) });
        this.dispatchEvent(event);
        break;
        
      case "typecommand":
        event = new window.CustomEvent('type', { detail: this.getAttribute(COMMANDLINE_ATTR) });
        this.dispatchEvent(event);
        break;
        
      case "showlines":
        this.setAttribute(LINE_NUMBERS_ATTR, ev.detail.checked);
        break;
        
      case "expand":
        this.setAttribute(EXPAND_ATTR, ev.detail.checked);
        break;
        
      case 'close':
        event = new window.CustomEvent('close-request', { detail: null });
        this.dispatchEvent(event);
        break;
        
      default:
        break;
    }
    getById(this, 'header').focus();
  }).bind(this));
  
  cm.addEventListener('before-close', (function(ev) {
    var header = getById(this, 'header');
    header.focus();
  }).bind(this));
};

EtCommandFrameProto.attributeChangedCallback = function(attrName, oldValue, newValue) {
  setAttr(this, attrName, newValue);
};

EtCommandFrameProto.focusLast = function() {
  var header = getById(this, 'header');
  header.focus();
  header.scrollIntoView(true);
};

EtCommandFrameProto.focusFirst = function() {
  var header = getById(this, 'header');
  header.focus();
  header.scrollIntoView(true);
};

EtCommandFrameProto.openMenu = function() {
  var header = getById(this, 'header');
  var cm;
  var rect;

  cm = getById(this, 'contextmenu');
  rect = header.getBoundingClientRect();
  cm.openAround(header); //(rect.left, rect.top );
};

var EtCommandFrame = window.document.registerElement('et-commandframe', {prototype: EtCommandFrameProto});
return EtCommandFrame;  
});
