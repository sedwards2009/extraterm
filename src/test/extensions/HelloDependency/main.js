
const leftPad = require('left-pad');

function activate(extensionContext) {
  console.log("Hello Dependency extension activated!");
  extensionContext.activated = true;
}

exports.activate = activate;
