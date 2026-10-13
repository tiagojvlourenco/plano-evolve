// Servidor de ficheiros mínimo para os testes no browser (o service worker só funciona em http/https, não em file://).
var http = require("http"), fs = require("fs"), path = require("path");
var TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".css": "text/css"};
module.exports = function startStaticServer(root){
  return new Promise(function(resolve){
    var server = http.createServer(function(req, res){
      var p = decodeURIComponent(req.url.split("?")[0]);
      if (p === "/") p = "/index.html";
      var f = path.join(root, p);
      if (f.indexOf(root) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, {"Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache"});
      fs.createReadStream(f).pipe(res);
    });
    server.listen(0, "127.0.0.1", function(){ resolve({server: server, url: "http://127.0.0.1:" + server.address().port + "/"}); });
  });
};
