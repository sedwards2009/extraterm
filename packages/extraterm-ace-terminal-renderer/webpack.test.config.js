var path = require("path");

module.exports = {
  mode: 'development',
  entry: "./dist/test/test.js",
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'test_bundle.js'
  }
}
