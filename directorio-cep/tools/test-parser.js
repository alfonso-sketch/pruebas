// Ejecuta el lector de gas/Code.gs sobre samples/*.html y muestra lo extraído.
// Uso: node tools/test-parser.js [id-del-cep]
const fs = require('fs');
const path = require('path');
const { loadGas } = require('./gas-loader');

const { parsePersonal } = loadGas();
const dir = path.join(__dirname, '..', 'samples');
const only = process.argv[2];

fs.readdirSync(dir).filter(f => f.endsWith('.html') && (!only || f === only + '.html')).forEach(f => {
  const personas = parsePersonal(fs.readFileSync(path.join(dir, f), 'utf8'));
  console.log('\n=== ' + f + ': ' + personas.length + ' contactos');
  console.table(personas);
});
