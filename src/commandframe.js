define(['gui/util'], function(util) {

var ID = "EtCommandFrameTemplate";
var COMMANDLINE_ATTR = "command-line";
var RETURN_CODE_ATTR = "return-code";
var EXPAND_ATTR = "expand";

var EtCommandFrameProto = Object.create(window.HTMLElement.prototype);

function createClone() {
  var template = window.document.getElementById(ID);
  if (template === null) {
    template = window.document.createElement('template');
    template.id = ID;
    
    var success_color = "#00ff00";
    var fail_color = "#ff0000";
    
    template.innerHTML = "<style>\n"
      + "#container {\n"
      + "  display: flex;\n"
      + "}\n"
    
      + "#main {\n"
      + "  flex: auto 1 1;\n"
      + "}\n"
      
      + "#header {\n"
      + "  border-top-right-radius: 0.5em;\n"
      + "  border-bottom-right-radius: 0.5em;\n"
      + "  padding-top: 1px;\n"
      + "  padding-left: 0.5em;\n"
      + "  padding-right: 0.5em;\n"
      + "  padding-bottom: 1px;\n"
      + "  display: flex;\n"
      + "}\n"
      
      + "#header.running {\n"
      + "  border: 1px solid white;\n"
      + "}\n"
      
      + "#header.success {\n"
      + "  border-top: 1px solid " + success_color + ";\n"
      + "  border-bottom: 1px solid " + success_color + ";\n"
      + "  border-right: 1px solid " + success_color + ";\n"
      + "}\n"
      
      + "#header.fail {\n"
      + "  border-top: 1px solid " + fail_color + ";\n"
      + "  border-bottom: 1px solid " + fail_color + ";\n"
      + "  border-right: 1px solid " + fail_color + ";\n"
      + "}\n"
      
      + "#output.closed {\n"
      + "  display: none;\n"
      + "  height: 1px;\n"
      + "  overflow: hidden;\n"
      + "}\n"
      
      
      + "#gutter {\n"
      + "  flex: 2rem 0 0;\n"
      + "  width: 2rem;\n"
      + "  padding: 1px\n"
      + "}\n"
      
      + "#gutter.running {\n"
      + "}\n"
      
      + "#gutter.success {\n"
      + "  color: " + success_color + ";\n"
      + "  border-right: 1px solid " + success_color + ";\n"
      + "}\n"
      
      + "#gutter.fail {\n"
      + "  color: " + fail_color + ";\n"
      + "  border-right: 1px solid " + fail_color + ";\n"
      + "}\n"
      
      + "#commandline {\n"
      + "  flex: auto 1 1;\n"
      + "}\n"
      
      +"#close_button {\n"
      + "  flex: auto 0 0;\n"
      + "  padding: 0px;\n"
      + "  background-color: transparent;\n"
      + "  border: 0px;\n"
      + "  color: white;\n"
      + "}\n"

      +"#close_button:hover {\n"
      + "  color: red;\n"
      + "}\n"
      
      + "#icon_div {\n"
      + "  display: inline-block;\n"
      + "  width: 1em;\n"
      + "  height: 1em;\n"
      + "}\n"
      
      + "#expand_button {\n"
      + "  display: inline-block;\n"
      + "  padding: 0px;\n"
      + "  background-color: transparent;\n"
      + "  color: white;\n"
      + "  border: 0px;\n"
      + "  width: 1em;\n"
      + "  height: 1em;\n"
      + "}\n"
      
      + "</style>\n"
      + "<div id='container'>"
      + "  <div id='gutter' class='running'>"
      +     "<div id='icon_div'><i id='icon'></i></div>"
      +     "<button id='expand_button'><i id='expand_icon' class='fa fa-caret-down'></i></button>"
      + "  </div>"
      + "  <div id='main'>"
      + "    <div id='header'><div id='commandline'></div><button id='close_button'><i class='fa fa-times-circle'></i></button></div>"
      + "    <div id='output'><content></content></div>"
      + "  </div>"
      + "</div>";
    window.document.body.appendChild(template);
  }
  
  return window.document.importNode(template.content, true);
}

function getById(self, id) {
  return self.webkitShadowRoot.querySelector('#'+id);
}

function setAttr(self, attrName, newValue) {
  var icon;
  var gutter;
  var rc;
  var header;
  var output;
  var expandicon;

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
    } else {
      // Collapsed.
      output.classList.add('closed');
      expandicon.classList.add('fa-plus-square-o');
      expandicon.classList.remove('fa-minus-square-o');
    }
  }
}

EtCommandFrameProto.createdCallback = function() {
//  var cover;
//  var container;
  var self = this;
  var closebutton;
  var expandbutton;
  var shadow = this.webkitCreateShadowRoot();
  shadow.applyAuthorStyles = true;
  
  var clone = createClone();
  shadow.appendChild(clone);
  
  setAttr(this, COMMANDLINE_ATTR, this.getAttribute(COMMANDLINE_ATTR));
  setAttr(this, RETURN_CODE_ATTR, this.getAttribute(RETURN_CODE_ATTR));
  setAttr(this, EXPAND_ATTR, this.getAttribute(EXPAND_ATTR));

  closebutton = getById(this, 'close_button');
  closebutton.addEventListener('click', function() {
      var event = new window.CustomEvent('close-request', { detail: null });
      self.dispatchEvent(event);
  });
  
  expandbutton = getById(this, 'expand_button');
  expandbutton.addEventListener('click', function() {
    var expanded = util.htmlValueToBool(self.getAttribute(EXPAND_ATTR), true);
    self.setAttribute(EXPAND_ATTR, !expanded);
  });
  
//  cover = this.__getById('cover');
//  cover.addEventListener('mousedown', function(ev) {
//    console.log("cover mousedown", ev);
//    if (ev.button === 0) {    
//      ev.stopPropagation();
//      ev.preventDefault();
//      self.close();
//    }
//  });
//  
//  cover.addEventListener('contextmenu', function(ev) {
//    console.log("cover contextmenu");
//    ev.stopPropagation();
//    ev.preventDefault();
//    self.close();
//  }, true);
//  
//  container = this.__getById('container');
//  container.addEventListener('mousedown', function(ev) {
//    ev.stopPropagation();
//    ev.preventDefault();
//  });
//  
//  container.addEventListener('mousemove', function(ev) {
//    if (ev.srcElement.nodeName.toLowerCase() === 'cb-menuitem') {
//      selectMenuItem(self.childNodes, ev.srcElement);
//    } else {
//      selectMenuItem(self.childNodes, null);
//    }
//  });
//  
//  container.addEventListener('mouseleave', function(ev) {
//    selectMenuItem(self.childNodes, null);
//  });
//  
//  container.addEventListener('click', function(ev) {
//    var name;
//
//    if (ev.srcElement.tagName.toLowerCase() === 'cb-menuitem') {
//      name = ev.srcElement.getAttribute('name');
//      self.close();
//      
//      var event = new CustomEvent('selected', { detail: name });
//      this.dispatchEvent(event);
//    }
//  });
//  container.addEventListener('keydown', function(ev) {
//    __handleKeyDown.call(self, ev);
//  });
  
};

//EtCommandFrameProto.open = function(x, y) {
//  var cover = this.__getById('cover');
//  cover.className = "cover_open";
//  
//  var container = this.__getById('container');
//  container.style.left = "" + x + "px";
//  container.style.top = "" + y + "px";
//  container.focus();
//  
//};

//CbContextMenuProto.close = function() {
//  var cover = this.webkitShadowRoot.querySelector('#cover');
//  cover.className = "cover_closed";
//};
EtCommandFrameProto.attributeChangedCallback = function(attrName, oldValue, newValue) {
  setAttr(this, attrName, newValue);
};

var EtCommandFrame = window.document.registerElement('et-commandframe', {prototype: EtCommandFrameProto});
return EtCommandFrame;  
});
