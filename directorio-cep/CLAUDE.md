# Directorio de contactos CEP Córdoba — contexto para Claude

Si el usuario dice **«continúa»** (o similar), retoma el plan de abajo desde el
primer paso no completado. Responde siempre en español. Marca cada paso como
hecho en la sección «Estado» de este archivo al terminarlo.

## Qué es

Web app responsive con la agenda compartida del personal de los CEP de la
provincia de Córdoba. Los datos se extraen automáticamente de:

- CEP de Córdoba: https://www.juntadeandalucia.es/educacion/portales/web/cep-cordoba/personal-del-cep
- CEP de Peñarroya-Pueblonuevo: https://www.juntadeandalucia.es/educacion/portales/web/cep-penarroya-pueblonuevo/personal-del-cep
- CEP de Priego-Montilla: https://www.juntadeandalucia.es/educacion/portales/web/cep-priego-montilla/personal-del-cep

y se guardan en la hoja de cálculo de Google `1E2jkmXI99XMbd1zsteKqS6m5HsRYUJDrubkwbkIwCwk`,
cuyo proyecto de Apps Script (vinculado) es
`1bUWNXW3mkeqIPEJ1lCeLgjYtA6mEU9KIWzI4F2shccow5LBupZzoGWDR`.
El usuario solo necesita el contenido de `dist/` para subirlo a cepcordoba.es.

## Estructura

- `gas/Code.gs` — backend Apps Script: `syncAll` (descarga + análisis +
  escritura en la pestaña `Contactos`), `setup` (pestañas, `EDIT_KEY`,
  disparador diario 6:00, primera sincronización), `doGet`/`doPost` (API JSON),
  `debugParse`. `parsePersonal(html)` es una función pura, probada en Node.
- `gas/appsscript.json` — manifiesto (webapp: ejecutar como propietario,
  acceso anónimo). `gas/.clasp.json` ya apunta al scriptId.
- `dist/` — frontend estático (index.html, styles.css, app.js, config.js).
  `config.js` lleva `API_URL`, hoy con un marcador `PEGA_AQUI...`.
- `tools/` — `fetch-pages.js` (descarga las páginas reales a `samples/`),
  `test-parser.js` (muestra lo que extrae el lector), `set-api-url.js`
  (escribe la URL /exec en `dist/config.js`).

## Historia

Se escribió desde una sesión en la nube que tenía bloqueados
juntadeandalucia.es y script.google.com: **el lector nunca se ha probado con
las páginas reales**, solo con HTML de ejemplo. Por eso lo primero es probarlo.

## Plan

1. **Probar el lector con las páginas reales.**
   `node tools/fetch-pages.js` y `node tools/test-parser.js`.
   Revisa cada CEP: ¿están todas las personas?, ¿nombre y cargo bien
   separados?, ¿correos y teléfonos correctos?, ¿sin basura (menús, pies)?
   Compara con el HTML de `samples/` y ajusta `parsePersonal` y sus
   auxiliares en `gas/Code.gs` hasta que los tres CEP salgan limpios.
   Si fetch falla en Node, prueba con `curl -L -o samples/<id>.html <url>`.
2. **clasp.** Si `clasp` no está instalado: `npm install -g @google/clasp`.
   Si no hay sesión (`clasp login --status` o falla `clasp push`), pide al
   usuario que ejecute `clasp login` (abre el navegador; es interactivo) y que
   active la API de Apps Script en https://script.google.com/home/usersettings.
   Después, desde `gas/`: `clasp push -f`.
3. **Primera ejecución de `setup`.** `clasp run` necesita configuración extra
   (proyecto GCP propio), así que pide al usuario: «abre el editor
   (`clasp open-script` o `clasp open`), elige la función `setup`, pulsa
   Ejecutar y acepta los permisos; luego dime la clave de edición que sale en
   el registro». Comprueba después la pestaña `Contactos` si tienes acceso, o
   pide al usuario que confirme.
4. **Desplegar la aplicación web.** Desde `gas/`:
   `clasp deploy --description "Directorio CEP"`. Toma el deploymentId de la
   salida; la URL es `https://script.google.com/macros/s/<deploymentId>/exec`.
   Comprueba con `curl -L "<url>?action=list"` que devuelve `{"ok":true,...}`.
   Si devuelve una página de inicio de sesión, el acceso no es anónimo: pide
   al usuario que en Implementar > Gestionar implementaciones ponga
   «Cualquier usuario».
   En despliegues posteriores reutiliza el mismo id:
   `clasp deploy -i <deploymentId> --description "..."` para no cambiar la URL.
5. **Configurar la web.** `node tools/set-api-url.js <url>`. Abre
   `dist/index.html` en el navegador (o sirve con `npx serve dist`) y comprueba
   que carga los contactos.
6. **Entregar.** Comprime `dist/` en `dist.zip` y di al usuario que suba el
   contenido de `dist/` a cepcordoba.es. Haz commit y push en la rama
   `claude/vibrant-tesla-kp2ng2` si hay repositorio git.

## Estado

- [ ] 1. Lector probado con las páginas reales
- [ ] 2. Código subido con clasp
- [ ] 3. `setup` ejecutado (clave de edición: _pendiente_)
- [ ] 4. Aplicación web desplegada (URL: _pendiente_)
- [ ] 5. `dist/config.js` configurado y probado
- [ ] 6. Entregado
