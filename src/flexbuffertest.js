/**
 * Unit test for flexbuffer.js.
 * 
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */
var flexbuffer = require("./flexbuffer");

exports.CreateTest = function(test) {
  var buf = new flexbuffer.FlexBuffer();
  buf.appendBuffer(new Buffer(324));
  test.ok(buf.size() === 324, "New size is wrong.");
  test.ok(buf.buffer.length === 512, "Internal buffer is an unexpected size.");
  buf.clear();
  test.ok(buf.size() === 0, "clear() failed.");
  test.done();
};

exports.DeleteTest = function(test) {
  var buf = new flexbuffer.FlexBuffer();
  buf.appendBuffer(new Buffer('0123456789','ascii'));
  test.ok(buf.size() === 10, "Size was wrong.");
  buf.delete(2, 6);
  test.ok(buf.size() === 6, "New size was wrong.");
  test.ok(buf.toString() === '016789', "Contents are wrong.");
  test.done();
};