import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('.');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
http
  .createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (urlPath !== '/' && urlPath !== '/index.html' && !urlPath.startsWith('/assets/'))
        throw Error('not public');
      const p = path.resolve(
        root,
        '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
      );
      if (p !== root && !p.startsWith(root + path.sep)) throw Error('path');
      const file = p === root ? path.join(root, 'index.html') : p;
      const body = await fs.readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  })
  .listen(4173, '127.0.0.1', () => console.log('Card Atlas: http://127.0.0.1:4173'));
