// NOTFLİX tanıtım sitesi — basit statik derleyici.
// Render/Netlify gibi platformlarda "build" komutu olarak kullanılır:
// site dosyalarını dist/ klasörüne kopyalar.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const out = path.join(root, 'dist');
const files = ['index.html', 'robots.txt', 'sitemap.xml'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of files) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, file));
}

const assets = path.join(root, 'assets');
if (fs.existsSync(assets)) {
  fs.cpSync(assets, path.join(out, 'assets'), { recursive: true });
}

console.log('NOTFLİX sitesi dist/ klasörüne hazırlandı.');
