/**
 * TaskMaster Pro - Versión Integrada en Google Apps Script
 *
 * Este archivo contiene la lógica del servidor (Backend).
 */

const SHEET_NAME = 'Tareas';
const AUTHORIZED_EMAIL = ''; // OPCIONAL: Escribe tu email aquí para restringir el acceso.

/**
 * Sirve la interfaz de usuario.
 */
function doGet() {
  const userEmail = Session.getActiveUser().getEmail();

  // Verificación de acceso para el renderizado inicial
  if (AUTHORIZED_EMAIL && userEmail !== AUTHORIZED_EMAIL) {
    return HtmlService.createHtmlOutput('Acceso denegado: Esta aplicación es privada.');
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('TaskMaster Pro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper para incluir archivos HTML (CSS/JS) en el index.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Verifica si el usuario tiene permiso.
 */
function checkAccess() {
  const userEmail = Session.getActiveUser().getEmail();
  if (AUTHORIZED_EMAIL && userEmail !== AUTHORIZED_EMAIL) {
    throw new Error('No tienes permiso para realizar esta acción.');
  }
  return userEmail;
}

/**
 * Inicializa la hoja.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  const headers = [
    'id', 'titulo', 'descripcion', 'estado', 'checklist',
    'fechaCreacion', 'fechaActualizacion', 'fechaLimite',
    'enviarEmail', 'emailDestino', 'prioridad', 'archivada', 'ownerEmail', 'ultimoEstadoNotificado',
    'notasPrevias', 'notasReunion'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

/**
 * Obtiene todas las tareas.
 */
function getTasks() {
  checkAccess();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  const userEmail = Session.getActiveUser().getEmail();

  return rows.map(row => {
    let task = {};
    headers.forEach((header, index) => {
      task[header] = row[index];
    });
    return task;
  }).filter(task => task.ownerEmail === userEmail);
}

/**
 * Crea una tarea.
 */
function createTask(payload) {
  const userEmail = checkAccess();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const id = Utilities.getUuid();
  const now = new Date().toISOString();

  const newTask = [
    id,
    payload.titulo || 'Nueva Tarea',
    payload.descripcion || '',
    payload.estado || 'Pendiente',
    payload.checklist || '[]',
    now,
    now,
    payload.fechaLimite || '',
    payload.enviarEmail || false,
    payload.emailDestino || userEmail,
    payload.prioridad || 'Media',
    false,
    userEmail,
    payload.enviarEmail ? payload.estado : '',
    payload.notasPrevias || '[]',
    payload.notasReunion || '[]'
  ];

  sheet.appendRow(newTask);

  if (payload.enviarEmail) {
    sendNotification(Object.assign({}, payload, { id }), 'Creada');
  }

  return { success: true, id };
}

/**
 * Actualiza una tarea.
 */
function updateTask(payload) {
  const userEmail = checkAccess();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('id');
  const now = new Date().toISOString();

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === payload.id) {
      const ownerEmailIndex = headers.indexOf('ownerEmail');
      if (data[i][ownerEmailIndex] !== userEmail) {
        throw new Error('No tienes permiso');
      }

      headers.forEach((header, colIndex) => {
        if (payload.hasOwnProperty(header)) {
          sheet.getRange(i + 1, colIndex + 1).setValue(payload[header]);
        }
      });

      sheet.getRange(i + 1, headers.indexOf('fechaActualizacion') + 1).setValue(now);

      const fullTask = {};
      headers.forEach((h, idx) => fullTask[h] = payload.hasOwnProperty(h) ? payload[h] : data[i][idx]);

      if (fullTask.enviarEmail === true && fullTask.estado !== fullTask.ultimoEstadoNotificado) {
        sendNotification(fullTask, 'Actualizada');
        sheet.getRange(i + 1, headers.indexOf('ultimoEstadoNotificado') + 1).setValue(fullTask.estado);
      }

      return { success: true };
    }
  }
  throw new Error('No encontrada');
}

/**
 * Elimina una tarea.
 */
function deleteTask(id) {
  const userEmail = checkAccess();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const idIndex = data[0].indexOf('id');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === id) {
      if (data[i][data[0].indexOf('ownerEmail')] !== userEmail) {
        throw new Error('No tienes permiso');
      }
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('No encontrada');
}

/**
 * Notificación por Gmail.
 */
function sendNotification(task, evento) {
  const email = task.emailDestino || Session.getActiveUser().getEmail();
  const subject = `[Tarea] ${task.titulo} - ${task.estado} (${evento})`;

  let checklistHtml = '';
  try {
    const items = JSON.parse(task.checklist || '[]');
    if (items.length > 0) {
      checklistHtml = '<h3>Checklist:</h3><ul>' +
        items.map(item => `<li>[${item.completed ? 'X' : ' '}] ${item.text}</li>`).join('') +
        '</ul>';
    }
  } catch (e) {}

  let notasPreviasHtml = '';
  try {
    const notas = JSON.parse(task.notasPrevias || '[]');
    if (notas.length > 0) {
      notasPreviasHtml = '<h3>Notas Previas:</h3><ul>' +
        notas.map(n => `<li><strong>${n.fecha}:</strong> ${n.texto}</li>`).join('') +
        '</ul>';
    }
  } catch (e) {}

  let notasReunionHtml = '';
  try {
    const notas = JSON.parse(task.notasReunion || '[]');
    if (notas.length > 0) {
      notasReunionHtml = '<h3>Notas de la Reunión:</h3><ul>' +
        notas.map(n => `<li><strong>${n.fecha}:</strong> ${n.texto}</li>`).join('') +
        '</ul>';
    }
  } catch (e) {}

  const body = `
    <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
      <h2 style="color: #4a86e8;">Notificación de Tarea: ${evento}</h2>
      <p><strong>Título:</strong> ${task.titulo}</p>
      <p><strong>Estado:</strong> ${task.estado}</p>
      <p><strong>Prioridad:</strong> ${task.prioridad || 'Media'}</p>
      <p><strong>Descripción:</strong> ${task.descripcion || 'Sin descripción'}</p>
      <p><strong>Fecha Límite:</strong> ${task.fechaLimite || 'No establecida'}</p>
      ${checklistHtml}
      ${notasPreviasHtml}
      ${notasReunionHtml}
      <hr>
      <p style="font-size: 0.8em; color: #666;">Enviado desde TaskMaster Pro.</p>
    </div>
  `;

  MailApp.sendEmail({ to: email, subject: subject, htmlBody: body });
}
