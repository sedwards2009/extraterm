function activate(extensionContext) {
  console.log("Hello World extension activated!");
  extensionContext.activated = true;
}

exports.activate = activate;
