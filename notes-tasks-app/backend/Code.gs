/**
 * Backend para Aplicación de Notas y Tareas con Google Sheets y Gmail
 *
 * Configuración:
 * 1. Crea una Hoja de Cálculo de Google.
 * 2. Ve a Extensiones > Apps Script.
 * 3. Pega este código.
 * 4. Ejecuta la función 'setup' una vez.
 * 5. Despliega como "Aplicación web".
 * 6. Configura "Quién tiene acceso" como "Cualquier persona" o "Cualquier persona con una cuenta de Google".
 */

const SHEET_NAME = 'Tareas';
const AUTHORIZED_EMAIL = ''; // OPCIONAL: Escribe tu email aquí (ej: 'tu@email.com') para restringir el acceso solo a ti.

/**
 * Verifica si el usuario tiene permiso para acceder.
 */
function checkAccess(userEmail) {
  if (AUTHORIZED_EMAIL && userEmail !== AUTHORIZED_EMAIL) {
    throw new Error('Acceso denegado: Esta aplicación está configurada para uso personal de ' + AUTHORIZED_EMAIL);
  }
}

/**
 * Inicializa la hoja de cálculo con las columnas necesarias.
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
    'enviarEmail', 'emailDestino', 'prioridad', 'archivada', 'ownerEmail'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  // Aplicar formato a la cabecera
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4a86e8')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
}

/**
 * Maneja las peticiones GET (Lectura de datos).
 */
function doGet(e) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    checkAccess(userEmail);
    const tasks = getTasks();
    return createJsonResponse({ success: true, data: tasks });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() }, 403);
  }
}

/**
 * Maneja las peticiones POST (Creación, Actualización, Eliminación).
 */
function doPost(e) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    checkAccess(userEmail);

    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const payload = body.payload;

    let result;
    switch (action) {
      case 'create':
        result = createTask(payload, userEmail);
        break;
      case 'update':
        result = updateTask(payload, userEmail);
        break;
      case 'delete':
        result = deleteTask(payload.id, userEmail);
        break;
      default:
        throw new Error('Acción no permitida');
    }

    return createJsonResponse({ success: true, data: result });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() }, 400);
  }
}

/**
 * Obtiene todas las tareas del usuario actual.
 */
function getTasks() {
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
  }).filter(task => task.ownerEmail === userEmail || !task.ownerEmail); // Filtro simple por usuario
}

/**
 * Crea una nueva tarea.
 */
function createTask(payload, userEmail) {
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
    false, // archivada
    userEmail
  ];

  sheet.appendRow(newTask);

  if (payload.enviarEmail) {
    sendNotification(payload, 'Creada');
  }

  return { id, ...payload };
}

/**
 * Actualiza una tarea existente.
 */
function updateTask(payload, userEmail) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('id');
  const now = new Date().toISOString();

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === payload.id) {
      // Verificar permiso (opcional pero recomendado)
      const ownerEmailIndex = headers.indexOf('ownerEmail');
      if (data[i][ownerEmailIndex] && data[i][ownerEmailIndex] !== userEmail) {
        throw new Error('No tienes permiso para editar esta tarea');
      }

      // Actualizar campos
      headers.forEach((header, colIndex) => {
        if (payload.hasOwnProperty(header)) {
          sheet.getRange(i + 1, colIndex + 1).setValue(payload[header]);
        }
      });

      // Actualizar fecha de actualización
      sheet.getRange(i + 1, headers.indexOf('fechaActualizacion') + 1).setValue(now);

      // Enviar notificación solo si el flag 'enviarEmail' está activo en esta actualización
      if (payload.enviarEmail === true) {
        // Obtenemos la tarea completa para el email
        const fullTask = {};
        headers.forEach((h, idx) => fullTask[h] = payload.hasOwnProperty(h) ? payload[h] : data[i][idx]);
        sendNotification(fullTask, 'Actualizada');
      }

      return payload;
    }
  }
  throw new Error('Tarea no encontrada');
}

/**
 * Elimina una tarea.
 */
function deleteTask(id, userEmail) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('id');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === id) {
      sheet.deleteRow(i + 1);
      return { id };
    }
  }
  throw new Error('Tarea no encontrada');
}

/**
 * Envía una notificación por Gmail.
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

  const body = `
    <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
      <h2 style="color: #4a86e8;">Notificación de Tarea: ${evento}</h2>
      <p><strong>Título:</strong> ${task.titulo}</p>
      <p><strong>Estado:</strong> ${task.estado}</p>
      <p><strong>Prioridad:</strong> ${task.prioridad || 'Media'}</p>
      <p><strong>Descripción:</strong> ${task.descripcion || 'Sin descripción'}</p>
      <p><strong>Fecha Límite:</strong> ${task.fechaLimite || 'No establecida'}</p>
      ${checklistHtml}
      <hr>
      <p style="font-size: 0.8em; color: #666;">Enviado automáticamente desde tu App de Notas.</p>
    </div>
  `;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: body
  });
}

/**
 * Helper para crear respuestas JSON.
 */
function createJsonResponse(data, statusCode = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
