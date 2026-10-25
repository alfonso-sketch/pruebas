// Descarga las páginas "Personal del CEP" a samples/ para poder probar el lector.
// Uso: node tools/fetch-pages.js
const fs = require('fs');
const path = require('path');
const { loadGas } = require('./gas-loader');

const { CEPS } = loadGas();
const dir = path.join(__dirname, '..', 'samples');
fs.mkdirSync(dir, { recursive: true });

(async () => {
  for (const cep of CEPS) {
    try {
      const res = await fetch(cep.url, { headers: { 'User-Agent': 'Mozilla/5.0 (DirectorioCEP)' } });
      const html = await res.text();
      fs.writeFileSync(path.join(dir, cep.id + '.html'), html);
      console.log(cep.id, res.status, html.length + ' bytes');
    } catch (err) {
      console.log(cep.id, 'ERROR', err.message);
    }
  }
})();
