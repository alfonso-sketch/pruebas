// Escribe la URL /exec de la aplicación web en dist/config.js.
// Uso: node tools/set-api-url.js https://script.google.com/macros/s/XXXX/exec
const fs = require('fs');
const path = require('path');

const url = process.argv[2];
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url || '')) {
  console.error('URL no válida. Debe ser https://script.google.com/macros/s/<id>/exec');
  process.exit(1);
}
const file = path.join(__dirname, '..', 'dist', 'config.js');
const src = fs.readFileSync(file, 'utf8').replace(/API_URL: '[^']*'/, "API_URL: '" + url + "'");
fs.writeFileSync(file, src);
console.log('dist/config.js actualizado');
