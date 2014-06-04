define([], function() {
var ID = "CbContextMenuTemplate";

var CbContextMenuProto = Object.create(HTMLElement.prototype);;
console.log("document",document);

function createClone() {
  var template = document.getElementById(ID);
  if (template === null) {
    template = document.createElement('template');
    template.id = ID;
    template.innerHTML = "<style>\n"
      + ".container {\n"
      + "    position: absolute;\n"
      + "    background-color: #F4F4F4;\n"
      + "    border-radius: 4px;\n"
      + "    padding: 4px 0px 4px 0px;\n"
      + "    width: 10rem;\n"
      + "    box-shadow: 0px 0px 8px black;\n"
      + "}\n"
      + ".cover_closed {\n"
      + "    visibility: hidden;\n"
      + "}\n"
      + ".cover_open {\n"
      + "    visibility: visible;\n"
      + "    position: absolute;\n"
      + "    width: 100%;\n"
      + "    height: 100%;\n"
      + "    z-index: 100;\n"
      + "}\n"
      + "</style>\n"
      + "<div id='cover' class='cover_closed'>"
      + "<div id='container' class='container container_closed' tabindex='0'><content></content></div>"
      + "</div>";
    document.body.appendChild(template);
  }
  
  return document.importNode(template.content, true);
}

CbContextMenuProto.__getById = function(id) {
  return this.webkitShadowRoot.querySelector('#'+id);
};

CbContextMenuProto.createdCallback = function() {
  var cover;
  var container;
  var self = this;
  var shadow = this.webkitCreateShadowRoot();
  shadow.applyAuthorStyles = true;
  
  var clone = createClone();
  shadow.appendChild(clone);
  
  cover = this.__getById('cover');
  cover.addEventListener('mousedown', function(ev) {
    console.log("cover mousedown", ev);
    if (ev.button === 0) {    
      ev.stopPropagation();
      ev.preventDefault();
      self.close();
    }
  });
  
  cover.addEventListener('contextmenu', function(ev) {
    console.log("cover contextmenu");
    ev.stopPropagation();
    ev.preventDefault();
    self.close();
  }, true);
  
  container = this.__getById('container');
  container.addEventListener('mousedown', function(ev) {
    ev.stopPropagation();
    ev.preventDefault();
  });
  
  container.addEventListener('mousemove', function(ev) {
    if (ev.srcElement.nodeName.toLowerCase() === 'cb-menuitem') {
      selectMenuItem(self.childNodes, ev.srcElement);
    } else {
      selectMenuItem(self.childNodes, null);
    }
  });
  
  container.addEventListener('mouseleave', function(ev) {
    selectMenuItem(self.childNodes, null);
  });
  
  container.addEventListener('click', function(ev) {
    var name;

    if (ev.srcElement.tagName.toLowerCase() === 'cb-menuitem') {
      name = ev.srcElement.getAttribute('name');
      self.close();
      
      var event = new CustomEvent('selected', { detail: name });
      this.dispatchEvent(event);
    }
  });
  container.addEventListener('keydown', function(ev) {
    __handleKeyDown.call(self, ev);
  });
  
};

function fetchCbMenuItems(kids) {
  var i;
  var len;
  var result;
  var item;
  
  len = kids.length;
  result = [];
  for (i=0; i<len; i++) {
    item = kids[i];
    if(item.nodeName.toLowerCase() === 'cb-menuitem') {
      result.push(item);
    }
  }
  return result;
}

function selectMenuItem(kids, selectitem) {
  var i;
  var len;
  var item;
  
  len = kids.length;
  for (i=0; i<len; i++) {
    item = kids[i];
    if (item.nodeName.toLowerCase() === 'cb-menuitem') {
      item.setAttribute('selected', '' + (selectitem === item) );
    }
  }
}

function __handleKeyDown(ev) {
  var keyboardselected;
  var menuitems;
  var i;
  var name;
  
  // Escape.
  if (ev.keyIdentifier === "U+001B") {
    this.close();
    return;
  }
  
  if (ev.keyIdentifier === "Up" || ev.keyIdentifier === "Down" || ev.keyIdentifier === "Enter") {
    menuitems = fetchCbMenuItems(this.childNodes);
    if (menuitems.length === 0) {
      return;
    }

    keyboardselected = menuitems.filter(function(item) {
      var value;
      value = item.getAttribute("selected");
      return value === "true" || value === true;
    });

    if (ev.keyIdentifier === "Up") {
      if (keyboardselected.length === 0) {
        selectMenuItem(this.childNodes, menuitems[menuitems.length-1]);
      } else {
        i = menuitems.indexOf(keyboardselected[0]);
        i = i === 0 ? menuitems.length-1 : i-1;
        selectMenuItem(this.childNodes, menuitems[i]);
      }
    } else if (ev.keyIdentifier === "Down") {
      if (keyboardselected.length === 0) {
        selectMenuItem(this.childNodes, menuitems[0]);
      } else {
        i = menuitems.indexOf(keyboardselected[0]) + 1;
        if (i === menuitems.length) {
          i = 0;
        }
        selectMenuItem(this.childNodes, menuitems[i]);
      }
    } else {
      // Enter
      if (keyboardselected.length !== 0) {
        name = keyboardselected[0].getAttribute('name');
        this.close();

        var event = new CustomEvent('selected', { detail: name });
        this.dispatchEvent(event);
      }
    }
    return;
  }
};

CbContextMenuProto.open = function(x, y) {
  var cover = this.__getById('cover');
  cover.className = "cover_open";
  
  var container = this.__getById('container');
  container.style.left = "" + x + "px";
  container.style.top = "" + y + "px";
  container.focus();
  
};

CbContextMenuProto.close = function() {
  var cover = this.webkitShadowRoot.querySelector('#cover');
  cover.className = "cover_closed";
};

var CbContextMenu = document.registerElement('cb-contextmenu', {prototype: CbContextMenuProto});
return CbContextMenu;
});
