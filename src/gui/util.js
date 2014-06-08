define([], function() {
  var exports = {};
  
  exports.htmlValueToBool = function(value) {
    return ! (value === null || value === undefined || value === false || value === "" || value === "false");
  };

  return exports;
});