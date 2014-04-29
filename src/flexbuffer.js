/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
 */

var INITIAL_SIZE = 256;

function FlexBuffer() {
  this.buffer = new Buffer(INITIAL_SIZE);
  this._size = 0;
}

FlexBuffer.prototype._ensureCapacity = function(minSize) {
  var newBuffer;
  var newSize;
  
  if (this.buffer.length < minSize) {
    newSize = this.buffer.length;
    while (newSize < minSize) {
      newSize *= 2;
    }
    newBuffer = new Buffer(newSize);
    
    this.buffer.copy(newBuffer);
    this.buffer = newBuffer;
  }
};

FlexBuffer.prototype.appendBuffer = function(secondBuffer) {
  this._ensureCapacity(secondBuffer.length + this._size);
  secondBuffer.copy(this.buffer, this._size);
  this._size += secondBuffer.length;
  return this;
};

FlexBuffer.prototype.size = function() {
  return this._size;
};

FlexBuffer.prototype.clear = function() {
  this._size = 0;
};

FlexBuffer.prototype.delete = function(startOffset, endOffset) {
  this.buffer.copy(this.buffer, startOffset, endOffset, this._size);
  this._size -= endOffset - startOffset;
};

FlexBuffer.prototype.toString = function(encoding) {
  return this.buffer.toString(encoding === undefined ? "utf8" : encoding, 0, this._size);
};

exports.FlexBuffer = FlexBuffer;
