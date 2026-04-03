/**
 * Google Apps Script - Backend para Gestión de Visitas a Centros
 *
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Abre tu hoja de cálculo de Google con las pestañas "Centros" y "Visitas"
 * 2. Ve a Extensiones > Apps Script
 * 3. Copia todo este código en el editor
 * 4. Despliega como aplicación web (Implementar > Nueva implementación > Aplicación web)
 *    - Ejecutar como: Tu cuenta
 *    - Acceso: Cualquier persona
 * 5. Copia la URL generada y pégala en el archivo webapp/index.html (variable APPS_SCRIPT_URL)
 */

// Configuración
const HOJA_CENTROS = 'Centros';
const HOJA_VISITAS = 'Visitas';

/**
 * Maneja peticiones GET (lectura de datos)
 */
function doGet(e) {
  const action = e.parameter.action;
  let result;

  try {
    switch (action) {
      case 'getCentros':
        result = getCentros();
        break;
      case 'getVisitas':
        result = getVisitas();
        break;
      case 'getVisita':
        result = getVisita(e.parameter.id);
        break;
      default:
        result = { error: 'Acción no reconocida' };
    }
  } catch (error) {
    result = { error: error.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Maneja peticiones POST (escritura de datos)
 */
function doPost(e) {
  let result;

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case 'guardarVisita':
        result = guardarVisita(data.visita);
        break;
      case 'actualizarVisita':
        result = actualizarVisita(data.id, data.visita);
        break;
      case 'eliminarVisita':
        result = eliminarVisita(data.id);
        break;
      default:
        result = { error: 'Acción no reconocida' };
    }
  } catch (error) {
    result = { error: error.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Obtiene la lista de centros
 */
function getCentros() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJA_CENTROS);

  if (!hoja) {
    return { error: 'No se encontró la hoja "Centros"' };
  }

  const datos = hoja.getDataRange().getValues();
  const centros = [];

  // Saltar la fila de cabecera
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0]) { // Solo si tiene código
      centros.push({
        codigo: String(datos[i][0]),
        denominacion: datos[i][1],
        localidad: datos[i][2]
      });
    }
  }

  return { success: true, centros: centros };
}

/**
 * Obtiene todas las visitas
 */
function getVisitas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_VISITAS);

  // Crear hoja de visitas si no existe
  if (!hoja) {
    hoja = crearHojaVisitas(ss);
  }

  const datos = hoja.getDataRange().getValues();
  const visitas = [];

  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0]) { // Solo si tiene ID
      visitas.push({
        id: datos[i][0],
        fecha: datos[i][1] ? Utilities.formatDate(new Date(datos[i][1]), 'Europe/Madrid', 'yyyy-MM-dd') : '',
        codigoCentro: String(datos[i][2]),
        centro: datos[i][3],
        resena: datos[i][4],
        actuaciones: datos[i][5] ? datos[i][5].split('|||') : [],
        motivos: datos[i][6],
        participantes: datos[i][7],
        asuntosTratados: datos[i][8],
        acuerdos: datos[i][9],
        fechaCreacion: datos[i][10] ? Utilities.formatDate(new Date(datos[i][10]), 'Europe/Madrid', 'yyyy-MM-dd HH:mm') : ''
      });
    }
  }

  return { success: true, visitas: visitas };
}

/**
 * Obtiene una visita por ID
 */
function getVisita(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJA_VISITAS);

  if (!hoja) return { error: 'No se encontró la hoja de visitas' };

  const datos = hoja.getDataRange().getValues();

  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]) === String(id)) {
      return {
        success: true,
        visita: {
          id: datos[i][0],
          fecha: datos[i][1] ? Utilities.formatDate(new Date(datos[i][1]), 'Europe/Madrid', 'yyyy-MM-dd') : '',
          codigoCentro: String(datos[i][2]),
          centro: datos[i][3],
          resena: datos[i][4],
          actuaciones: datos[i][5] ? datos[i][5].split('|||') : [],
          motivos: datos[i][6],
          participantes: datos[i][7],
          asuntosTratados: datos[i][8],
          acuerdos: datos[i][9]
        }
      };
    }
  }

  return { error: 'Visita no encontrada' };
}

/**
 * Guarda una nueva visita
 */
function guardarVisita(visita) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_VISITAS);

  if (!hoja) {
    hoja = crearHojaVisitas(ss);
  }

  const id = Utilities.getUuid();
  const ahora = new Date();

  hoja.appendRow([
    id,
    new Date(visita.fecha),
    visita.codigoCentro,
    visita.centro,
    visita.resena || '',
    Array.isArray(visita.actuaciones) ? visita.actuaciones.join('|||') : visita.actuaciones || '',
    visita.motivos || '',
    visita.participantes || '',
    visita.asuntosTratados || '',
    visita.acuerdos || '',
    ahora
  ]);

  return { success: true, id: id, message: 'Visita guardada correctamente' };
}

/**
 * Actualiza una visita existente
 */
function actualizarVisita(id, visita) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJA_VISITAS);

  if (!hoja) return { error: 'No se encontró la hoja de visitas' };

  const datos = hoja.getDataRange().getValues();

  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]) === String(id)) {
      const fila = i + 1;
      hoja.getRange(fila, 2).setValue(new Date(visita.fecha));
      hoja.getRange(fila, 3).setValue(visita.codigoCentro);
      hoja.getRange(fila, 4).setValue(visita.centro);
      hoja.getRange(fila, 5).setValue(visita.resena || '');
      hoja.getRange(fila, 6).setValue(
        Array.isArray(visita.actuaciones) ? visita.actuaciones.join('|||') : visita.actuaciones || ''
      );
      hoja.getRange(fila, 7).setValue(visita.motivos || '');
      hoja.getRange(fila, 8).setValue(visita.participantes || '');
      hoja.getRange(fila, 9).setValue(visita.asuntosTratados || '');
      hoja.getRange(fila, 10).setValue(visita.acuerdos || '');

      return { success: true, message: 'Visita actualizada correctamente' };
    }
  }

  return { error: 'Visita no encontrada' };
}

/**
 * Elimina una visita
 */
function eliminarVisita(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJA_VISITAS);

  if (!hoja) return { error: 'No se encontró la hoja de visitas' };

  const datos = hoja.getDataRange().getValues();

  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]) === String(id)) {
      hoja.deleteRow(i + 1);
      return { success: true, message: 'Visita eliminada correctamente' };
    }
  }

  return { error: 'Visita no encontrada' };
}

/**
 * Crea la hoja de visitas con cabeceras
 */
function crearHojaVisitas(ss) {
  const hoja = ss.insertSheet(HOJA_VISITAS);

  const cabeceras = [
    'ID',
    'Fecha',
    'Código Centro',
    'Centro',
    'Breve Reseña',
    'Actuaciones',
    'Motivos',
    'Participantes',
    'Asuntos Tratados',
    'Acuerdos',
    'Fecha Creación'
  ];

  hoja.getRange(1, 1, 1, cabeceras.length).setValues([cabeceras]);

  // Formato de cabecera
  const rangoCabecera = hoja.getRange(1, 1, 1, cabeceras.length);
  rangoCabecera.setBackground('#006B3F');
  rangoCabecera.setFontColor('#FFFFFF');
  rangoCabecera.setFontWeight('bold');

  // Ajustar anchos
  hoja.setColumnWidth(1, 100);  // ID
  hoja.setColumnWidth(2, 120);  // Fecha
  hoja.setColumnWidth(3, 100);  // Código
  hoja.setColumnWidth(4, 250);  // Centro
  hoja.setColumnWidth(5, 300);  // Reseña
  hoja.setColumnWidth(6, 300);  // Actuaciones
  hoja.setColumnWidth(7, 300);  // Motivos
  hoja.setColumnWidth(8, 200);  // Participantes
  hoja.setColumnWidth(9, 300);  // Asuntos
  hoja.setColumnWidth(10, 300); // Acuerdos
  hoja.setColumnWidth(11, 150); // Fecha creación

  return hoja;
}

/**
 * Función de prueba para verificar conexión
 */
function testConexion() {
  const centros = getCentros();
  Logger.log(JSON.stringify(centros));
  return centros;
}
