const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

http.createServer(function (req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, urlPath);

  // If no extension, serve as .html or directory index
  if (!path.extname(filePath)) {
    fs.stat(filePath, function (err, stats) {
      if (!err && stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      } else {
        filePath += '.html';
      }
      serveFile(filePath, res);
    });
  } else {
    serveFile(filePath, res);
  }
}).listen(PORT, '0.0.0.0', function () {
  console.log('Server running at http://localhost:' + PORT);
  console.log('LAN: http://192.168.1.88:' + PORT);
});

function serveFile(filePath, res) {
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - Page Not Found</h1>');
    } else {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    }
  });
}
