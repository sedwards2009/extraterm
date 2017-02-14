/*
 * A little webserver to serving the GUI test files and keeping the browser happy.
 */
const finalhandler = require('finalhandler');
const http = require('http');
const path = require('path');
const serveStatic = require('serve-static');
const fs = require('fs');
const theme = require('../../theme');

// Serve up public/ftp folder 
const staticPath = path.join(__dirname, '../..');
const staticServe = serveStatic(staticPath, { dotfiles: "allow"});
console.log("Src path: ", staticPath);

const modulePath = path.join(__dirname, '../../..');
const moduleServe = serveStatic(modulePath, { dotfiles: "allow"});
console.log("Root path: ", modulePath);

const cssPath = path.join(__dirname, 'css');
const cssServe = serveStatic(cssPath, { dotfiles: "allow"});
console.log("CSS path: ", cssPath);

const testPath = __dirname;
const testServe = serveStatic(testPath, { dotfiles: "allow"});
console.log("Test path: ", testPath);

// Create server 
const server = http.createServer(function(req, res){
  const done = finalhandler(req, res);

  console.log("Request: ",req.url);

  const remap = {
    "/lodash.js": "../../../node_modules/lodash/index.js",
    "/codemirror.js": "../../../node_modules/codemirror/lib/codemirror.js"
  };

  if (req.url in remap) {
    res.writeHead(200, {"Content-Type": "text/javascript"});
    const fullPath = path.join(__dirname, remap[req.url]);
    res.write(fs.readFileSync(fullPath, 'utf8'));
    res.end();

  } else if (req.url === "/cssmap.js") {

    res.writeHead(200, {"Content-Type": "text/json"});

    res.write(`const mapping = new Map();
`);

    theme.cssFileEnumItems.forEach( (cssType) => {
      const cssPath = path.join(__dirname, "css", theme.cssFileNameBase(cssType) + ".css");
      res.write(`mapping.set(${cssType}, ${JSON.stringify(fs.readFileSync(cssPath, 'utf8'))});
`);
    });

    res.write(`module.exports = mapping;
`);
    res.end();

  } else if (req.url.startsWith("/css/")) {
    cssServe(req, res, done);
  } else if (req.url === "/test.html" || req.url === "/test.js") {
    testServe(req, res, done);
  } else if (req.url.startsWith("/node_modules/")) {
    moduleServe(req, res, done);
  } else {
    staticServe(req, res, done);
  }
});

// Listen 
const PORT = 3000;
console.log("Listening for requests on port "+PORT);
console.log("Try http://localhost:3000/test.html");
server.listen(PORT);
