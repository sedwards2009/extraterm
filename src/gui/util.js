define([], function() {
  var exports = {};
  
  /**
   * Convert a value to a boolean.
   * 
   * @param {Object} value The value to parse and convert.
   * @param {Boolean} defaultValue (Optional) The default value if the input
   *     was too ambigious. Defaults to false.
   * @returns {Boolean} The converted value.
   */
  exports.htmlValueToBool = function(value, defaultValue) {
    if (value === null || value === undefined || value === "") {
      return defaultValue === undefined ? false : defaultValue;
    }
    return ! (value === false || value === "false");
  };

  exports.createShadowRoot = function(self) {
    return self.webkitCreateShadowRoot ? self.webkitCreateShadowRoot() : self.createShadowRoot();
  };
  
  exports.getShadowRoot = function(self) {
    return self.webkitShadowRoot ? self.webkitShadowRoot : self.shadowRoot;
  };
  return exports;
});