/* Directorio CEP Córdoba - frontend */
(function () {
  'use strict';

  const API = (window.DIRECTORIO_CONFIG || {}).API_URL || '';
  const CACHE_KEY = 'directorio-cep:data';
  const KEY_STORE = 'directorio-cep:key';
  const CEP_COLORS = {
    'CEP de Córdoba': 'var(--c-cordoba)',
    'CEP de Peñarroya-Pueblonuevo': 'var(--c-penarroya)',
    'CEP de Priego-Montilla': 'var(--c-priego-montilla)'
  };

  const $ = sel => document.querySelector(sel);
  const state = {
    contactos: [],
    ceps: [],
    ultimaSincronizacion: null,
    cep: '',
    area: '',
    q: '',
    editKey: storage('get', KEY_STORE) || ''
  };

  /* ---------- utilidades ---------- */

  function storage(op, key, value) {
    try {
      if (op === 'get') return localStorage.getItem(key);
      if (op === 'set') localStorage.setItem(key, value);
      if (op === 'del') localStorage.removeItem(key);
    } catch (e) { /* almacenamiento no disponible */ }
    return null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function initials(name) {
    const parts = String(name || '?').replace(/^(D\.?ª?|Dña\.?)\s+/i, '').split(/\s+/).filter(w => /^[A-ZÁÉÍÓÚÑ]/.test(w));
    return ((parts[0] || '?')[0] + ((parts[1] || '')[0] || '')).toUpperCase();
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 3500);
  }

  function setStatus(msg) { $('#status').textContent = msg || ''; }

  function apiConfigured() { return API && API.indexOf('PEGA_AQUI') < 0; }

  /* ---------- API ---------- */

  function apiGet(params) {
    const url = API + '?' + new URLSearchParams(params).toString();
    return fetch(url, { redirect: 'follow' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(() => jsonp(url)); // Respaldo si el navegador o el servidor bloquean fetch.
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = '__dir_cb_' + Date.now();
      const s = document.createElement('script');
      const done = () => { delete window[cb]; s.remove(); };
      window[cb] = data => { done(); resolve(data); };
      s.onerror = () => { done(); reject(new Error('No se pudo conectar con el servidor')); };
      s.src = url + '&callback=' + cb;
      document.head.appendChild(s);
    });
  }

  function apiPost(body) {
    // text/plain evita la petición previa CORS que Apps Script no admite.
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ key: state.editKey }, body)),
      redirect: 'follow'
    }).then(r => r.json()).then(res => {
      if (!res.ok) throw new Error(res.error || 'Error desconocido');
      return res;
    });
  }

  /* ---------- carga de datos ---------- */

  function applyData(data) {
    state.contactos = data.contactos || [];
    state.ceps = data.ceps || [];
    state.ultimaSincronizacion = data.ultimaSincronizacion || null;
    buildFilters();
    render();
  }

  function load() {
    const cached = storage('get', CACHE_KEY);
    if (cached) {
      try { applyData(JSON.parse(cached)); } catch (e) { /* caché corrupta */ }
    } else {
      $('#list').innerHTML = '<div class="grid">' + '<div class="skeleton"></div>'.repeat(6) + '</div>';
    }

    if (!apiConfigured()) {
      setStatus('Falta configurar la URL de la API en config.js.');
      if (!cached) $('#list').innerHTML = '';
      return Promise.resolve();
    }

    setStatus(cached ? 'Actualizando…' : 'Cargando contactos…');
    return apiGet({ action: 'list' }).then(data => {
      if (!data.ok) throw new Error(data.error);
      storage('set', CACHE_KEY, JSON.stringify(data));
      applyData(data);
      setStatus('');
    }).catch(err => {
      setStatus(cached
        ? 'Sin conexión: mostrando la última copia guardada.'
        : 'No se pudieron cargar los contactos (' + err.message + ').');
      if (!cached) $('#list').innerHTML = '';
    });
  }

  /* ---------- filtros ---------- */

  function cepNames() {
    const names = state.ceps.map(c => c.nombre);
    state.contactos.forEach(c => { if (c.cep && names.indexOf(c.cep) < 0) names.push(c.cep); });
    return names;
  }

  function buildFilters() {
    const counts = {};
    state.contactos.forEach(c => { counts[c.cep] = (counts[c.cep] || 0) + 1; });
    const names = cepNames();
    const chips = [{ v: '', label: 'Todos', n: state.contactos.length }]
      .concat(names.map(n => ({ v: n, label: n.replace(/^CEP de /, ''), n: counts[n] || 0 })));
    if (state.cep && names.indexOf(state.cep) < 0) state.cep = '';
    $('#cepChips').innerHTML = chips.map(c =>
      '<button type="button" class="chip" data-cep="' + esc(c.v) + '" aria-pressed="' + (state.cep === c.v) + '">' +
      esc(c.label) + '<span class="n">' + c.n + '</span></button>').join('');

    $('#cepList').innerHTML = names.concat(['Otros contactos'])
      .filter((v, i, a) => a.indexOf(v) === i).map(n => '<option value="' + esc(n) + '">').join('');

    buildAreaFilter();
  }

  function buildAreaFilter() {
    const areas = [];
    state.contactos.forEach(c => {
      if ((!state.cep || c.cep === state.cep) && c.area && areas.indexOf(c.area) < 0) areas.push(c.area);
    });
    areas.sort((a, b) => a.localeCompare(b, 'es'));
    if (areas.indexOf(state.area) < 0) state.area = '';
    $('#areaFilter').innerHTML = '<option value="">Todas las áreas</option>' +
      areas.map(a => '<option' + (a === state.area ? ' selected' : '') + '>' + esc(a) + '</option>').join('');
    $('#areaFilter').hidden = !areas.length;
  }

  function filtered() {
    const terms = norm(state.q).split(/\s+/).filter(Boolean);
    const digits = state.q.replace(/\D/g, '');
    return state.contactos.filter(c => {
      if (state.cep && c.cep !== state.cep) return false;
      if (state.area && c.area !== state.area) return false;
      if (!terms.length) return true;
      const hay = norm([c.nombre, c.cargo, c.area, c.email, c.cep, c.notas, c.telefono, c.corporativo].join(' '));
      if (digits.length >= 3 && (c.telefono + c.corporativo).replace(/\D/g, '').indexOf(digits) >= 0) return true;
      return terms.every(t => hay.indexOf(t) >= 0);
    });
  }

  /* ---------- render ---------- */

  const ICONS = {
    mail: '<svg viewBox="0 0 24 24"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2.4V17h16V7.4l-8 5.3-8-5.3ZM5.2 7 12 11.5 18.8 7H5.2Z"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z"/></svg>',
    corp: '<svg viewBox="0 0 24 24"><path d="M4 3h10v6h6v12H4V3Zm2 2v14h3v-3h2v3h3V5H6Zm10 6v8h2v-8h-2ZM8 7h2v2H8V7Zm0 4h2v2H8v-2Zm4-4h1v2h-1V7Zm0 4h1v2h-1v-2Z"/></svg>'
  };

  function card(c) {
    const color = CEP_COLORS[c.cep] || 'var(--c-otros)';
    const tel = String(c.telefono || '').replace(/[^\d+]/g, '');
    const lines = [];
    if (c.email) lines.push('<a href="mailto:' + esc(c.email) + '">' + ICONS.mail + '<span>' + esc(c.email) + '</span></a>');
    if (tel) lines.push('<a href="tel:' + esc(tel) + '">' + ICONS.phone + '<span>' + esc(c.telefono) + '</span></a>');
    if (c.corporativo) lines.push('<a href="tel:' + esc(c.corporativo) + '">' + ICONS.corp + '<span>Corporativo ' + esc(c.corporativo) + '</span></a>');
    const tags = [];
    if (c.area) tags.push('<span class="tag">' + esc(c.area) + '</span>');
    if (c.origen === 'manual') tags.push('<span class="tag manual">Añadido manualmente</span>');

    return '<article class="card" style="--cep-color:' + color + '">' +
      '<div class="card-head"><div class="avatar" aria-hidden="true">' + esc(initials(c.nombre || c.cargo)) + '</div>' +
      '<div><h3>' + esc(c.nombre || c.cargo || c.email) + '</h3>' +
      (c.cargo && c.nombre ? '<p class="role">' + esc(c.cargo) + '</p>' : '') + '</div></div>' +
      (tags.length ? '<div class="tags">' + tags.join('') + '</div>' : '') +
      (lines.length ? '<div class="contact">' + lines.join('') + '</div>' : '') +
      (c.notas ? '<p class="notes">' + esc(c.notas) + '</p>' : '') +
      '<div class="card-actions">' +
      '<button type="button" class="btn ghost" data-act="vcard" data-id="' + esc(c.id) + '">Guardar en agenda</button>' +
      (c.email ? '<button type="button" class="btn ghost" data-act="copy" data-id="' + esc(c.id) + '">Copiar correo</button>' : '') +
      (state.editKey ? '<button type="button" class="btn ghost" data-act="edit" data-id="' + esc(c.id) + '">Editar</button>' : '') +
      '</div></article>';
  }

  function render() {
    const list = filtered();
    $('#count').textContent = list.length + (list.length === 1 ? ' contacto' : ' contactos');

    if (!list.length) {
      $('#list').innerHTML = state.contactos.length
        ? '<p class="empty">No hay contactos que coincidan con la búsqueda.</p>'
        : '<p class="empty">Todavía no hay contactos. Ejecuta la sincronización en Apps Script.</p>';
    } else {
      const groups = {};
      list.forEach(c => { (groups[c.cep] = groups[c.cep] || []).push(c); });
      const order = cepNames().filter(n => groups[n]);
      const urls = {};
      state.ceps.forEach(c => { urls[c.nombre] = c.url; });
      $('#list').innerHTML = order.map(n =>
        '<h2 class="group-title" style="--cep-color:' + (CEP_COLORS[n] || 'var(--c-otros)') + '">' + esc(n) +
        ' <span>(' + groups[n].length + ')</span>' +
        (urls[n] ? '<a href="' + esc(urls[n]) + '" target="_blank" rel="noopener">Web del CEP ↗</a>' : '') + '</h2>' +
        '<div class="grid">' + groups[n].map(card).join('') + '</div>'
      ).join('');
    }

    $('#lastSync').textContent = state.ultimaSincronizacion
      ? 'Última sincronización: ' + new Date(state.ultimaSincronizacion).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
      : '';
  }

  /* ---------- exportación ---------- */

  function vcard(c) {
    const v = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + v(c.nombre || c.cargo), 'ORG:' + v(c.cep)];
    if (c.cargo) lines.push('TITLE:' + v(c.cargo));
    if (c.email) lines.push('EMAIL;TYPE=WORK:' + v(c.email));
    if (c.telefono) lines.push('TEL;TYPE=WORK,VOICE:' + v(c.telefono));
    if (c.corporativo) lines.push('TEL;TYPE=WORK:' + v(c.corporativo));
    const note = [c.area, c.notas].filter(Boolean).join(' - ');
    if (note) lines.push('NOTE:' + v(note));
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type: type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function exportCsv() {
    const cols = ['cep', 'nombre', 'cargo', 'area', 'email', 'telefono', 'corporativo', 'notas'];
    const head = ['CEP', 'Nombre', 'Cargo', 'Área', 'Correo', 'Teléfono', 'Corporativo', 'Notas'];
    const q = s => '"' + String(s || '').replace(/"/g, '""') + '"';
    const rows = [head.map(q).join(';')].concat(filtered().map(c => cols.map(k => q(c[k])).join(';')));
    download('directorio-cep.csv', '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  }

  /* ---------- edición ---------- */

  function setEditMode(on) {
    $('#adminBar').hidden = !on;
    $('#btnEditMode').setAttribute('aria-pressed', String(on));
    render();
  }

  function openEditor(c) {
    const f = $('#editForm');
    f.reset();
    const isAuto = c && c.origen === 'auto';
    ['id', 'nombre', 'cep', 'cargo', 'area', 'email', 'telefono', 'corporativo', 'notas'].forEach(k => {
      f.elements[k].value = (c && c[k]) || '';
      if (k !== 'notas' && k !== 'id') f.elements[k].readOnly = isAuto;
    });
    if (!c) f.elements.cep.value = state.cep || 'Otros contactos';
    $('#editTitle').textContent = c ? 'Editar contacto' : 'Nuevo contacto';
    $('#autoHint').hidden = !isAuto;
    $('#btnDelete').hidden = !c || isAuto;
    $('#editDialog').showModal();
  }

  function saveFromForm() {
    const f = $('#editForm');
    const contacto = {};
    ['id', 'nombre', 'cep', 'cargo', 'area', 'email', 'telefono', 'corporativo', 'notas']
      .forEach(k => { contacto[k] = f.elements[k].value.trim(); });
    $('#btnSave').disabled = true;
    apiPost({ action: 'save', contacto: contacto }).then(res => {
      const i = state.contactos.findIndex(c => c.id === res.contacto.id);
      if (i >= 0) state.contactos[i] = res.contacto; else state.contactos.push(res.contacto);
      persist();
      buildFilters();
      render();
      $('#editDialog').close();
      toast('Contacto guardado');
    }).catch(err => toast('Error: ' + err.message))
      .finally(() => { $('#btnSave').disabled = false; });
  }

  function persist() {
    storage('set', CACHE_KEY, JSON.stringify({
      ok: true, contactos: state.contactos, ceps: state.ceps, ultimaSincronizacion: state.ultimaSincronizacion
    }));
  }

  /* ---------- eventos ---------- */

  let qTimer;
  $('#q').addEventListener('input', e => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = e.target.value; render(); }, 120);
  });

  $('#cepChips').addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    state.cep = b.dataset.cep;
    document.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    buildAreaFilter();
    render();
  });

  $('#areaFilter').addEventListener('change', e => { state.area = e.target.value; render(); });

  $('#list').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const c = state.contactos.find(x => x.id === b.dataset.id);
    if (!c) return;
    if (b.dataset.act === 'vcard') {
      download((c.nombre || 'contacto').replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/g, '') + '.vcf', vcard(c), 'text/vcard');
    } else if (b.dataset.act === 'copy') {
      navigator.clipboard.writeText(c.email).then(() => toast('Correo copiado'), () => toast(c.email));
    } else if (b.dataset.act === 'edit') {
      openEditor(c);
    }
  });

  $('#btnExport').addEventListener('click', exportCsv);

  $('#btnEditMode').addEventListener('click', () => {
    if (state.editKey) { setEditMode($('#adminBar').hidden); return; }
    $('#keyForm').reset();
    $('#keyError').textContent = '';
    $('#keyDialog').showModal();
  });

  $('#keyForm').addEventListener('submit', e => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    const key = $('#keyForm').elements.key.value.trim();
    state.editKey = key;
    apiPost({ action: 'check' }).then(() => {
      storage('set', KEY_STORE, key);
      $('#keyDialog').close();
      setEditMode(true);
    }).catch(err => {
      state.editKey = '';
      $('#keyError').textContent = err.message;
    });
  });

  $('#btnLogout').addEventListener('click', () => {
    state.editKey = '';
    storage('del', KEY_STORE);
    setEditMode(false);
  });

  $('#btnAdd').addEventListener('click', () => openEditor(null));

  $('#editForm').addEventListener('submit', e => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    saveFromForm();
  });

  $('#btnDelete').addEventListener('click', () => {
    const id = $('#editForm').elements.id.value;
    if (!id || !confirm('¿Eliminar este contacto?')) return;
    apiPost({ action: 'delete', id: id }).then(() => {
      state.contactos = state.contactos.filter(c => c.id !== id);
      persist();
      buildFilters();
      render();
      $('#editDialog').close();
      toast('Contacto eliminado');
    }).catch(err => toast('Error: ' + err.message));
  });

  $('#btnSync').addEventListener('click', () => {
    const b = $('#btnSync');
    b.disabled = true;
    setStatus('Sincronizando con las webs de los CEP… (puede tardar un minuto)');
    apiPost({ action: 'sync' }).then(res => {
      const errores = (res.resultado || []).filter(r => !r.ok);
      toast(errores.length ? 'Sincronizado con avisos: ' + errores.map(r => r.cep + ' (' + r.error + ')').join(', ') : 'Sincronización completada');
      return load();
    }).catch(err => { setStatus(''); toast('Error: ' + err.message); })
      .finally(() => { b.disabled = false; });
  });

  if (state.editKey) setEditMode(true);
  load();
})();
