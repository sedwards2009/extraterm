define([], function() {
  var exports = {};
  
  exports.htmlValueToBool = function(value, defaultValue) {
    if (value === null || value === undefined || value === "") {
      return defaultValue === undefined ? false : defaultValue;
    }
    return ! (value === false || value === "false");
  };

  return exports;
});