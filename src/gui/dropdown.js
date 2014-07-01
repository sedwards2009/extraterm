define(['gui/util'], function(util) {
var ID = "CbDropDownTemplate";

/**
 * A Drop Down.
 */
var CbDropDownProto = Object.create(window.HTMLElement.prototype);

function createClone() {
  var template = window.document.getElementById(ID);
  if (template === null) {
    template = window.document.createElement('template');
    template.id = ID;
    template.innerHTML = "\n" +
      "<div><content select='cb-contextmenu'></content></div>" +
      "<div><content></content></div>";
    window.document.body.appendChild(template);
  }

  return window.document.importNode(template.content, true);
}

CbDropDownProto.createdCallback = function() {
  var i;
  var len;
  var kid;
  var shadow;
  var cm;
  var self = this;
  var clickHandler;
  var clone;
  
  shadow = util.createShadowRoot(this);
  clone = createClone();
  shadow.appendChild(clone);
  
  clickHandler = function(ev) {
    var cm = self.querySelector('cb-contextmenu');
    cm.openAround(this);        
  };

  len = this.childNodes.length;
  for (i=0; i<len; i++) {
    kid = this.childNodes[i];
    if (kid.nodeName.slice(0,1) !== '#' && kid.nodeName !== 'CB-CONTEXTMENU') {
      kid.addEventListener('click', clickHandler);
    }
  }
  
  cm = this.querySelector('cb-contextmenu');  
  cm.addEventListener('selected', function(ev) {
      var event = new window.CustomEvent('selected', { detail: ev.detail });
      self.dispatchEvent(event);
  });
};

var CbDropDown = window.document.registerElement('cb-dropdown', {prototype: CbDropDownProto});
return CbDropDown;
});
