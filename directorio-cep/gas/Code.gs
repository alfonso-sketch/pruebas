/**
 * Directorio de contactos CEP Córdoba - Backend (Google Apps Script)
 *
 * - Descarga y analiza las páginas "Personal del CEP" de cada CEP.
 * - Guarda los contactos en la hoja de cálculo (pestaña "Contactos").
 * - Expone una API JSON (doGet / doPost) que consume la web de la carpeta dist.
 *
 * Los contactos con Origen = "auto" se regeneran en cada sincronización.
 * Los contactos con Origen = "manual" nunca se tocan al sincronizar.
 */

const SPREADSHEET_ID = '1E2jkmXI99XMbd1zsteKqS6m5HsRYUJDrubkwbkIwCwk';
const SHEET_CONTACTS = 'Contactos';
const SHEET_LOG = 'Registro';

const CEPS = [
  {
    id: 'cordoba',
    nombre: 'CEP de Córdoba',
    url: 'https://www.juntadeandalucia.es/educacion/portales/web/cep-cordoba/personal-del-cep'
  },
  {
    id: 'penarroya',
    nombre: 'CEP de Peñarroya-Pueblonuevo',
    url: 'https://www.juntadeandalucia.es/educacion/portales/web/cep-penarroya-pueblonuevo/personal-del-cep'
  },
  {
    id: 'priego-montilla',
    nombre: 'CEP de Priego-Montilla',
    url: 'https://www.juntadeandalucia.es/educacion/portales/web/cep-priego-montilla/personal-del-cep'
  }
];

const HEADERS = [
  'ID', 'CEP', 'Nombre', 'Cargo', 'Área', 'Email', 'Teléfono', 'Corporativo',
  'Origen', 'Notas', 'Actualizado'
];

// Hora (0-23, Europe/Madrid) de la sincronización diaria automática.
const SYNC_HOUR = 6;

/* ------------------------------------------------------------------ */
/* Menú en la hoja de cálculo                                          */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Directorio CEP')
    .addItem('Sincronizar ahora', 'syncAll')
    .addItem('Instalar sincronización diaria', 'setup')
    .addItem('Probar análisis (ver registro de ejecución)', 'debugParse')
    .addToUi();
}

/**
 * Ejecutar UNA vez desde el editor: crea las pestañas, la clave de edición,
 * el disparador diario y hace la primera sincronización.
 */
function setup() {
  getContactsSheet_();
  getLogSheet_();

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('EDIT_KEY')) {
    props.setProperty('EDIT_KEY', Utilities.getUuid().slice(0, 8));
  }

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncAll')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncAll').timeBased().everyDays(1).atHour(SYNC_HOUR).create();

  const result = syncAll();
  Logger.log('Clave de edición (EDIT_KEY): ' + props.getProperty('EDIT_KEY'));
  Logger.log(JSON.stringify(result));
  return result;
}

/* ------------------------------------------------------------------ */
/* API web                                                             */
/* ------------------------------------------------------------------ */

/**
 * GET ?action=list            -> contactos + última sincronización
 * GET ?action=ceps            -> lista de CEP configurados
 * Admite ?callback=fn (JSONP) por si el servidor bloquea fetch.
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    switch (p.action || 'list') {
      case 'ceps':
        out = { ok: true, ceps: CEPS.map(c => ({ id: c.id, nombre: c.nombre, url: c.url })) };
        break;
      case 'list':
      default:
        out = {
          ok: true,
          ceps: CEPS.map(c => ({ id: c.id, nombre: c.nombre, url: c.url })),
          contactos: listContacts_(),
          ultimaSincronizacion: PropertiesService.getScriptProperties().getProperty('LAST_SYNC') || null
        };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return respond_(out, p.callback);
}

/**
 * POST (Content-Type: text/plain, cuerpo JSON):
 *   { action: 'save',   key, contacto: {...} }   alta / edición de contacto manual
 *   { action: 'delete', key, id }                borrado de contacto manual
 *   { action: 'sync',   key }                    sincronización inmediata
 */
function doPost(e) {
  let out;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const editKey = PropertiesService.getScriptProperties().getProperty('EDIT_KEY');
    if (!editKey || body.key !== editKey) throw new Error('Clave de edición incorrecta');

    switch (body.action) {
      case 'save':
        out = { ok: true, contacto: saveManualContact_(body.contacto || {}) };
        break;
      case 'delete':
        deleteManualContact_(body.id);
        out = { ok: true };
        break;
      case 'sync':
        out = { ok: true, resultado: syncAll() };
        break;
      case 'check':
        out = { ok: true };
        break;
      default:
        throw new Error('Acción desconocida');
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return respond_(out);
}

function respond_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback && /^[\w.$]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* Sincronización                                                      */
/* ------------------------------------------------------------------ */

function syncAll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Ya hay una sincronización en curso');
  try {
    const resultado = CEPS.map(syncCep_);
    PropertiesService.getScriptProperties().setProperty('LAST_SYNC', new Date().toISOString());
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

function syncCep_(cep) {
  try {
    const res = UrlFetchApp.fetch(cep.url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (DirectorioCEP; Google Apps Script)' }
    });
    const code = res.getResponseCode();
    if (code !== 200) throw new Error('HTTP ' + code);

    const personas = parsePersonal(res.getContentText('UTF-8'));
    // Si el análisis no encuentra a nadie conservamos los datos anteriores.
    if (!personas.length) throw new Error('No se encontraron contactos en la página');

    replaceAutoContacts_(cep, personas);
    log_(cep.nombre, 'OK', personas.length + ' contactos');
    return { cep: cep.id, ok: true, contactos: personas.length };
  } catch (err) {
    log_(cep.nombre, 'ERROR', String(err && err.message || err));
    return { cep: cep.id, ok: false, error: String(err && err.message || err) };
  }
}

/** Muestra en el registro lo que se extrae de cada página, sin guardar nada. */
function debugParse() {
  CEPS.forEach(cep => {
    const html = UrlFetchApp.fetch(cep.url, { muteHttpExceptions: true }).getContentText('UTF-8');
    const personas = parsePersonal(html);
    Logger.log('=== ' + cep.nombre + ': ' + personas.length + ' contactos');
    personas.forEach(p => Logger.log(JSON.stringify(p)));
  });
}

/* ------------------------------------------------------------------ */
/* Análisis del HTML                                                   */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+34[\s.]?)?[6789]\d{2}(?:[\s.-]?\d{2,3}){2,3}/g;
const CORP_RE = /(?:corp(?:orativo)?|ext(?:ensi[oó]n)?|int(?:erno)?)\.?\s*:?\s*(\d{5,6})\b/i;
const LABEL_RE = /^(tel[eé]fono|tfno|tlf|tel|m[oó]vil|e-?mail|correo(?: electr[oó]nico)?|fax|corporativo|ext(?:ensi[oó]n)?)\b\.?\s*:?\s*/i;
const NAME_WORD = "[A-ZÁÉÍÓÚÑÜ][a-záéíóúñüªºA-ZÁÉÍÓÚÑÜ'’.-]+";
const NAME_RE = new RegExp(
  '^(?:(?:D\\.?|Dª\\.?|D\\.ª|Don|Doña|Dña\\.?)\\s+)?' + NAME_WORD +
  "(?:\\s+(?:(?:de|del|la|las|los|y|i|da)\\s+)*" + NAME_WORD + '){1,5}$'
);
// Palabras que indican que un texto con mayúsculas NO es un nombre de persona.
const NOT_NAME_RE = /\b(cep|personal|asesor[ií]as?|equipo|direcci[oó]n|directiv[oa]|administraci[oó]n|secretar[ií]a|formaci[oó]n|educaci[oó]n|centro|profesorado|contacto|departamento|[aá]rea|[aá]mbito|fp|tic|junta|andaluc[ií]a|consejer[ií]a|servicios?|horario|ubicaci[oó]n|correo|tel[eé]fono|plan|programas?|infantil|primaria|secundaria|permanente|bachillerato)\b/i;
const ROLE_HINT = /(direct|asesor|secretar|administra|auxiliar|ordenanza|conserje|jefe|jefa|coordina|vicedirec|técnic|tecnic|responsable|personal|equipo|área|ámbito|formación|educación|infantil|primaria|secundaria|fp|profesional|permanente|especial|tic|digital|idiomas|plurilingü|convivencia|igualdad|orientaci|biblioteca|lectura|ciencia|matem|artístic|música|deporte|adultos)/i;

/**
 * Convierte el HTML de "Personal del CEP" en una lista de
 * { nombre, cargo, area, email, telefono, corporativo }.
 * Función pura (sin servicios de GAS) para poder probarla fuera.
 */
function parsePersonal(html) {
  let content = extractMainContent_(html);
  content = content
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|button)\b[\s\S]*?<\/\1>/gi, ' ');

  // Los correos de los enlaces mailto: también cuentan aunque no estén como texto.
  content = content.replace(/<a\b[^>]*href=["']mailto:([^"'?]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    (m, mail, text) => {
      const t = htmlToText_(text);
      return t.indexOf('@') >= 0 ? text : text + ' ' + decodeURIComponent(mail);
    });

  const fromTables = parseTables_(content);
  const fromText = parseLines_(content.replace(/<table\b[\s\S]*?<\/table>/gi, '\n'));
  return dedupe_(fromTables.concat(fromText));
}

function extractMainContent_(html) {
  const markers = [
    /<div[^>]+class="[^"]*journal-content-article[^"]*"[^>]*>/i,
    /<div[^>]+class="[^"]*portlet-journal-content[^"]*"[^>]*>/i,
    /<main\b[^>]*>/i,
    /<div[^>]+id="content"[^>]*>/i,
    /<div[^>]+id="main-content"[^>]*>/i,
    /<body\b[^>]*>/i
  ];
  for (let i = 0; i < markers.length; i++) {
    const re = new RegExp(markers[i].source, 'gi');
    const parts = [];
    let m;
    while ((m = re.exec(html))) {
      parts.push(html.slice(m.index, findBlockEnd_(html, m.index)));
    }
    const joined = parts.join('\n');
    if (joined && (joined.match(EMAIL_RE) || NAME_RE.test(htmlToText_(joined)))) return joined;
    if (joined && i >= 2) return joined;
  }
  return html;
}

/** Busca el cierre de la etiqueta que empieza en `start` contando anidamiento. */
function findBlockEnd_(html, start) {
  const tag = /^<(\w+)/.exec(html.slice(start))[1].toLowerCase();
  const re = new RegExp('<\\/?' + tag + '\\b[^>]*>', 'gi');
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') {
      depth--;
      if (depth === 0) return re.lastIndex;
    } else if (!/\/>$/.test(m[0])) {
      depth++;
    }
  }
  return html.length;
}

function parseTables_(content) {
  const out = [];
  const tables = content.match(/<table\b[\s\S]*?<\/table>/gi) || [];
  tables.forEach(table => {
    const caption = htmlToText_((/<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(table) || [])[1] || '');
    const rows = (table.match(/<tr\b[\s\S]*?<\/tr>/gi) || []).map(tr =>
      (tr.match(/<t[hd]\b[\s\S]*?<\/t[hd]>/gi) || []).map(td => htmlToText_(td).replace(/\n+/g, ' ').trim())
    ).filter(r => r.some(c => c));
    if (!rows.length) return;

    // Cabecera: primera fila sin correos y con palabras clave.
    let cols = null;
    if (rows[0].join(' ').indexOf('@') < 0 &&
        /nombre|cargo|puesto|correo|e-?mail|tel[eé]fono|asesor[ií]a|[aá]rea|[aá]mbito/i.test(rows[0].join(' '))) {
      cols = rows.shift().map(h => {
        if (/nombre|apellidos|persona/i.test(h)) return 'nombre';
        if (/correo|e-?mail/i.test(h)) return 'email';
        if (/corp|ext/i.test(h)) return 'corporativo';
        if (/tel[eé]f|tfno|m[oó]vil/i.test(h)) return 'telefono';
        if (/[aá]rea|[aá]mbito|asesor[ií]a|departamento|etapa/i.test(h)) return 'area';
        if (/cargo|puesto|funci[oó]n/i.test(h)) return 'cargo';
        return 'cargo';
      });
    }

    let section = caption;
    rows.forEach(cells => {
      const nonEmpty = cells.filter(c => c);
      // Fila de un solo texto sin datos de contacto = subtítulo de sección.
      if (nonEmpty.length === 1 && nonEmpty[0].indexOf('@') < 0 && !isName_(nonEmpty[0])) {
        section = nonEmpty[0];
        return;
      }
      const p = { nombre: '', cargo: '', area: '', email: '', telefono: '', corporativo: '' };
      const extra = [];
      cells.forEach((cell, i) => {
        if (!cell) return;
        const field = cols ? cols[i] : null;
        const info = extractContactInfo_(cell);
        if (info.email && !p.email) p.email = info.email;
        if (info.telefono && !p.telefono) p.telefono = info.telefono;
        if (info.corporativo && !p.corporativo) p.corporativo = info.corporativo;
        const rest = info.rest;
        if (!rest) return;
        if (field === 'nombre' || (!field && !p.nombre && isName_(rest))) {
          p.nombre = p.nombre || cleanName_(rest);
        } else if (field === 'area') {
          p.area = joinText_(p.area, rest);
        } else if (field === 'email' || field === 'telefono' || field === 'corporativo') {
          // Ya extraído arriba.
        } else {
          extra.push(rest);
        }
      });
      p.cargo = joinText_(p.cargo, extra.join(' · '));
      if (!p.area && section) p.area = section;
      if (p.nombre || p.email) out.push(p);
    });
  });
  return out;
}

/**
 * Para contenido no tabular (párrafos, listas, encabezados).
 * Cada persona se identifica por una línea con aspecto de nombre propio;
 * las líneas siguientes (cargo, correo, teléfono) se le asignan hasta el
 * siguiente nombre. Los encabezados marcan el área.
 */
function parseLines_(content) {
  const lines = toLines_(content);
  const out = [];
  let area = '';
  let current = null;
  let pendingRole = [];

  const flush = () => {
    if (current && (current.nombre || current.email)) out.push(current);
    current = null;
  };

  lines.forEach(item => {
    let text = item.text;
    if (item.heading) {
      if (!isName_(text)) {
        flush();
        area = text.replace(/:$/, '');
        pendingRole = [];
        return;
      }
    }

    const info = extractContactInfo_(text);
    text = info.rest;

    // "Cargo: Nombre Apellidos"  o  "Nombre Apellidos - Cargo"
    let nameHere = '';
    let roleHere = '';
    if (text) {
      const parts = text.split(/\s*(?::|–|—|\s-\s|\|)\s*/).filter(Boolean);
      if (isName_(text)) {
        nameHere = cleanName_(text);
      } else if (parts.length >= 2) {
        const idx = parts.findIndex(pt => isName_(pt));
        if (idx >= 0) {
          nameHere = cleanName_(parts[idx]);
          roleHere = parts.filter((_, i) => i !== idx).join(' · ');
        } else {
          roleHere = text;
        }
      } else {
        roleHere = text;
      }
    }

    if (nameHere) {
      flush();
      current = {
        nombre: nameHere,
        cargo: joinText_(pendingRole.join(' · '), roleHere),
        area: area, email: '', telefono: '', corporativo: ''
      };
      pendingRole = [];
    } else if (roleHere && !info.email && !info.telefono && !info.corporativo) {
      if (current && !current.email && !current.cargo) {
        current.cargo = roleHere;
      } else if (current && !current.email && roleHere.length < 120) {
        current.cargo = joinText_(current.cargo, roleHere);
      } else {
        // Probablemente el cargo del siguiente nombre.
        flush();
        if (roleHere.length < 120 && ROLE_HINT.test(roleHere)) pendingRole.push(roleHere);
        else pendingRole = [];
      }
    }

    if (info.email || info.telefono || info.corporativo) {
      if (!current) {
        current = {
          nombre: '', cargo: joinText_(pendingRole.join(' · '), roleHere), area: area,
          email: '', telefono: '', corporativo: ''
        };
        pendingRole = [];
      }
      if (info.email) {
        if (current.email && current.email !== info.email) {
          // Un segundo correo sin nombre nuevo: nueva entrada (p. ej. correos de asesorías).
          flush();
          current = { nombre: '', cargo: roleHere, area: area, email: info.email, telefono: '', corporativo: '' };
        } else {
          current.email = info.email;
        }
      }
      if (info.telefono && !current.telefono) current.telefono = info.telefono;
      if (info.corporativo && !current.corporativo) current.corporativo = info.corporativo;
    }
  });
  flush();
  return out;
}

function toLines_(content) {
  const marked = content
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (m, l, inner) => '\n\u0001' + inner + '\n')
    .replace(/<(p|div|li|dt|dd|tr|br|section|article|ul|ol)\b[^>]*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|dt|dd|tr|section|article|ul|ol)>/gi, '\n')
    // Párrafos formados solo por <strong>/<b> actúan como encabezado.
    .replace(/\n\s*<(strong|b)\b[^>]*>([^<]{2,80})<\/\1>\s*:?\s*(?=\n)/gi, '\n\u0001$2');
  return marked.split('\n')
    .map(raw => {
      const heading = raw.indexOf('\u0001') >= 0;
      const text = htmlToText_(raw.replace(/\u0001/g, '')).replace(/\s+/g, ' ').trim();
      return { text: text, heading: heading };
    })
    .filter(l => l.text && l.text.length < 300);
}

function extractContactInfo_(text) {
  let t = String(text || '')
    .replace(/\s*(?:\(|\[)\s*(?:arroba|at)\s*(?:\)|\])\s*/gi, '@')
    .replace(/\s+@\s+/g, '@');
  const info = { email: '', telefono: '', corporativo: '', rest: '' };

  const emails = t.match(EMAIL_RE);
  if (emails) {
    info.email = emails[0].toLowerCase().replace(/\.$/, '');
    t = t.replace(EMAIL_RE, ' ');
  }
  const corp = CORP_RE.exec(t);
  if (corp) {
    info.corporativo = corp[1];
    t = t.replace(corp[0], ' ');
  }
  const phones = t.match(PHONE_RE);
  if (phones) {
    const valid = phones.filter(ph => ph.replace(/\D/g, '').replace(/^34(?=\d{9}$)/, '').length === 9);
    if (valid.length) {
      info.telefono = formatPhone_(valid[0]);
      valid.forEach(ph => { t = t.replace(ph, ' '); });
    }
  }
  info.rest = t
    .replace(LABEL_RE, '')
    .replace(/\b(tel[eé]fono|tfno|tlf|e-?mail|correo(?: electr[oó]nico)?|fax|corporativo)\b\.?\s*:?/gi, ' ')
    .replace(/[\s,;:·|/-]+$/g, '')
    .replace(/^[\s,;:·|/-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(contacto|datos de contacto|ver más|ver mas|volver)$/i.test(info.rest)) info.rest = '';
  return info;
}

function isName_(s) {
  const n = cleanName_(s);
  return n.length <= 70 && NAME_RE.test(n) && !NOT_NAME_RE.test(n);
}

function formatPhone_(ph) {
  const d = ph.replace(/\D/g, '').replace(/^34(?=\d{9}$)/, '');
  return d.slice(0, 3) + ' ' + d.slice(3, 5) + ' ' + d.slice(5, 7) + ' ' + d.slice(7, 9);
}

function cleanName_(s) {
  return String(s || '')
    .replace(/^(D\.?ª|Dª\.?|D\.ª|Dña\.?|Doña|Don|D\.)\s+/i, '')
    .replace(/[.,;:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function joinText_(a, b) {
  a = (a || '').trim();
  b = (b || '').trim();
  if (!a) return b;
  if (!b || a.indexOf(b) >= 0) return a;
  return a + ' · ' + b;
}

function htmlToText_(html) {
  const entities = {
    nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordf: 'ª', ordm: 'º',
    aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
    Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
    middot: '·', ndash: '–', mdash: '—', laquo: '«', raquo: '»'
  };
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (n in entities ? entities[n] : m))
    .replace(/[ \t ]+/g, ' ')
    .trim();
}

function dedupe_(list) {
  const seen = {};
  const out = [];
  list.forEach(p => {
    p.nombre = cleanName_(p.nombre);
    const k = (p.email || '') + '|' + p.nombre.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    out.push(p);
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Hoja de cálculo                                                     */
/* ------------------------------------------------------------------ */

function getContactsSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_CONTACTS);
  if (!sh) sh = ss.insertSheet(SHEET_CONTACTS);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#e8f0fe');
  }
  return sh;
}

function getLogSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_LOG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_LOG);
    sh.appendRow(['Fecha', 'CEP', 'Estado', 'Detalle']);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  return sh;
}

function log_(cep, estado, detalle) {
  const sh = getLogSheet_();
  sh.appendRow([new Date(), cep, estado, detalle]);
  // Mantener solo las últimas 500 entradas.
  const extra = sh.getLastRow() - 501;
  if (extra > 0) sh.deleteRows(2, extra);
}

function readRows_() {
  const sh = getContactsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { sh: sh, rows: [] };
  return { sh: sh, rows: sh.getRange(2, 1, last - 1, HEADERS.length).getValues() };
}

function rowToContact_(r) {
  const o = {};
  HEADERS.forEach((h, i) => { o[h] = r[i]; });
  return {
    id: String(o['ID']),
    cep: String(o['CEP']),
    nombre: String(o['Nombre']),
    cargo: String(o['Cargo']),
    area: String(o['Área']),
    email: String(o['Email']),
    telefono: String(o['Teléfono']),
    corporativo: String(o['Corporativo']),
    origen: String(o['Origen']),
    notas: String(o['Notas']),
    actualizado: o['Actualizado'] instanceof Date ? o['Actualizado'].toISOString() : String(o['Actualizado'])
  };
}

function listContacts_() {
  return readRows_().rows.filter(r => r[0]).map(rowToContact_);
}

function replaceAutoContacts_(cep, personas) {
  const data = readRows_();
  const sh = data.sh;
  const now = new Date();

  // Conservar notas escritas a mano en filas automáticas (por ID).
  const notasPrevias = {};
  const keep = data.rows.filter(r => {
    const isThisAuto = r[8] === 'auto' && r[1] === cep.nombre;
    if (isThisAuto && r[9]) notasPrevias[r[0]] = r[9];
    return r[0] && !isThisAuto;
  });

  const nuevas = personas.map(p => {
    const id = makeId_(cep.id, p.email || p.nombre);
    return [
      id, cep.nombre, p.nombre, p.cargo, p.area, p.email,
      p.telefono, p.corporativo, 'auto', notasPrevias[id] || '', now
    ];
  });

  const all = keep.concat(nuevas).sort((a, b) =>
    String(a[1]).localeCompare(String(b[1]), 'es') || String(a[2]).localeCompare(String(b[2]), 'es'));

  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, HEADERS.length).clearContent();
  if (all.length) {
    sh.getRange(2, 1, all.length, HEADERS.length).setNumberFormat('@').setValues(
      all.map(r => r.map((v, i) => (i === 10 && v instanceof Date ? v : String(v))))
    );
    sh.getRange(2, 11, all.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
  }
}

function makeId_(prefix, key) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, prefix + '|' + String(key).toLowerCase());
  return prefix + '-' + digest.slice(0, 5).map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

function saveManualContact_(c) {
  const nombre = String(c.nombre || '').trim();
  if (!nombre) throw new Error('El nombre es obligatorio');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const data = readRows_();
    const row = [
      c.id || 'manual-' + Utilities.getUuid().slice(0, 8),
      String(c.cep || 'Otros contactos'), nombre, String(c.cargo || ''), String(c.area || ''),
      String(c.email || '').trim().toLowerCase(), String(c.telefono || ''), String(c.corporativo || ''),
      'manual', String(c.notas || ''), new Date()
    ];
    const idx = c.id ? data.rows.findIndex(r => r[0] === c.id) : -1;
    if (idx >= 0) {
      if (data.rows[idx][8] !== 'manual') {
        // En los automáticos solo se pueden editar las notas.
        data.sh.getRange(idx + 2, 10).setValue(row[9]);
        return rowToContact_(data.sh.getRange(idx + 2, 1, 1, HEADERS.length).getValues()[0]);
      }
      data.sh.getRange(idx + 2, 1, 1, HEADERS.length).setNumberFormat('@').setValues([row]);
    } else {
      data.sh.appendRow(row);
    }
    return rowToContact_(row);
  } finally {
    lock.releaseLock();
  }
}

function deleteManualContact_(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const data = readRows_();
    const idx = data.rows.findIndex(r => r[0] === id);
    if (idx < 0) throw new Error('Contacto no encontrado');
    if (data.rows[idx][8] !== 'manual') {
      throw new Error('Los contactos automáticos se gestionan desde la web del CEP');
    }
    data.sh.deleteRow(idx + 2);
  } finally {
    lock.releaseLock();
  }
}
