// Carga gas/Code.gs en Node (sin servicios de Google) para probar el análisis.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

exports.loadGas = function () {
  const ctx = {};
  vm.createContext(ctx);
  const code = fs.readFileSync(path.join(__dirname, '..', 'gas', 'Code.gs'), 'utf8');
  vm.runInContext(code + ';this.parsePersonal = parsePersonal; this.CEPS = CEPS;', ctx);
  return ctx;
};
