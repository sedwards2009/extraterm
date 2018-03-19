/*
 * A little webserver to serving the GUI test files and keeping the browser happy.
 */
var finalhandler = require('finalhandler');
var http = require('http');
var serveStatic = require('serve-static');
 
// Serve up public/ftp folder 
var serve = serveStatic('../', { dotfiles: "allow"});

// Create server 
var server = http.createServer(function(req, res){
  var done = finalhandler(req, res);
  serve(req, res, done);
});
 
// Listen 
var PORT = 3000;
console.log("Listening for requests on port "+PORT);
console.log("Try http://localhost:3000/guitest.html");
server.listen(PORT);
