// NOTFLİX tanıtım sitesi — sıfır bağımlılıklı statik sunucu.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const APK_SOURCE = 'https://github.com/steamixtvlive/Steamix-TV/releases/latest/download/notflix.apk';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

function streamApk(res) {
  function get(url, redirects) {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, (upstream) => {
      if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
        if (redirects > 6) {
          res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }).end('APK alınamadı');
          upstream.resume();
          return;
        }
        const next = new URL(upstream.headers.location, url).href;
        upstream.resume();
        get(next, redirects + 1);
        return;
      }
      if (upstream.statusCode !== 200) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }).end('APK alınamadı');
        upstream.resume();
        return;
      }
      const headers = {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="notflix.apk"',
        'Cache-Control': 'no-cache, must-revalidate'
      };
      if (upstream.headers['content-length']) headers['Content-Length'] = upstream.headers['content-length'];
      res.writeHead(200, headers);
      upstream.pipe(res);
    });
    req.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }).end('APK alınamadı');
    });
  }
  get(APK_SOURCE, 0);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad Request');
    return;
  }

  if (pathname === '/indir/notflix.apk' || pathname === '/download/notflix.apk') {
    streamApk(res);
    return;
  }

  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(ROOT, path.normalize(pathname).replace(/^([/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const type = MIME[ext] || 'application/octet-stream';
      const noCache = ext === '.html' || ext === '.css' || ext === '.js' || ext === '.svg';
      res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': noCache ? 'no-cache, must-revalidate' : 'public, max-age=3600'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    const index = path.join(ROOT, 'index.html');
    fs.readFile(index, (e2, buf) => {
      if (e2) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(buf);
    });
  });
});

server.listen(PORT, () => {
  console.log('NOTFLİX sitesi http://localhost:' + PORT + ' adresinde yayında');
});
