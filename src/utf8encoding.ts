
/**
 * A wrapper around the utf8 module to support Uint8Array
 */

import utf8 = require('utf8');

export function decodeUint8Array(array: Uint8Array): string {
  const wrapper: utf8.Stringish = {
    charCodeAt: function(index) {
      return array[index];
    },

    length: array.length
  };
  return utf8.decode(wrapper);
}
