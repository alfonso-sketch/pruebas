# TaskMaster Pro - Notas y Tareas

Una aplicación web profesional de gestión de tareas y notas con arquitectura limpia, diseño responsive y respaldada por **Google Sheets** como base de datos y **Gmail** para notificaciones.

## 🚀 Características

- **Gestión Completa (CRUD):** Crea, edita, elimina y busca tareas.
- **Checklists:** Cada tarea puede tener múltiples elementos de checklist.
- **Estados:** Control de flujo (Pendiente, En desarrollo, Finalizada).
- **Notificaciones por Email:** Opción para enviar alertas automáticas vía Gmail al crear o actualizar tareas.
- **Diseño Responsive:** Optimizado para móviles (Mobile-first) y escritorio.
- **Vistas Duales:** Vista de Lista y Vista Kanban.
- **Filtros Avanzados:** Filtra por estado, prioridad y búsqueda en tiempo real.
- **Seguridad:** Utiliza la infraestructura de Google para autenticación y almacenamiento.

## 🛠️ Requisitos Técnicos

- **Frontend:** HTML5, CSS3 (Tailwind CSS), JavaScript (Vanilla).
- **Backend:** Google Apps Script (GAS) actuando como API REST.
- **Base de Datos:** Google Sheets.
- **Servicio de Correo:** Gmail API (vía GAS).

---

## 📋 Instrucciones de Configuración y Despliegue

Sigue estos pasos para poner en marcha tu propia instancia de TaskMaster Pro:

### 1. Configurar la Hoja de Cálculo
1. Crea una nueva **Hoja de cálculo de Google**.
2. Ponle un nombre (ej. `BD_Tareas`).
3. No es necesario crear las columnas manualmente; el script lo hará por ti.

### 2. Configurar el Backend (Google Apps Script)
1. En tu hoja de cálculo, ve al menú superior: **Extensiones > Apps Script**.
2. Borra cualquier código existente y pega el contenido del archivo `backend/Code.gs`.
3. Haz clic en el icono de guardar (💾) y dale un nombre al proyecto (ej. `API_Tareas`).
4. Selecciona la función `setup` en la barra de herramientas y haz clic en **Ejecutar**. Esto creará las cabeceras necesarias en tu hoja de cálculo.
5. Autoriza los permisos necesarios cuando se te solicite (es seguro, ya que es tu propio script).

### 3. Desplegar como Aplicación Web
1. Haz clic en el botón azul **Desplegar > Nueva implementación**.
2. Tipo de implementación: **Aplicación web**.
3. Configuración:
   - **Descripción:** API TaskMaster.
   - **Ejecutar como:** El usuario que accede a la aplicación web (Esto asegura que cada usuario vea sus propias tareas y use su propia cuenta de Gmail para enviar correos).
   - **Quién tiene acceso:** Cualquier persona con una cuenta de Google.
4. Haz clic en **Desplegar**.
5. **IMPORTANTE:** Copia la **URL de la aplicación web** generada.

### 4. Configurar el Frontend
1. Abre el archivo `frontend/app.js`.
2. Localiza la variable `API_URL` al principio del archivo.
3. Reemplaza `'TU_URL_DE_WEB_APP_AQUI'` por la URL que copiaste en el paso anterior.
4. Guarda el archivo.

### 5. Despliegue del Frontend
Puedes abrir el archivo `frontend/index.html` directamente en tu navegador para usarlo localmente, o subir la carpeta `frontend` a cualquier servicio de hosting estático (Netlify, Vercel, GitHub Pages, etc.).

---

## 📖 Guía de Uso

- **Crear Tarea:** Haz clic en "Nueva Tarea", rellena los campos y guarda.
- **Activar Notificaciones:** Marca "Notificar por email" al crear o editar si quieres recibir un correo con los detalles.
- **Checklist:** Añade items en el modal. Al marcar todos como completados, la app te sugerirá marcar la tarea como "Finalizada".
- **Vistas:** Cambia entre la vista de lista clásica y el tablero Kanban usando los iconos de la parte superior derecha.
- **Búsqueda:** Escribe en el buscador para filtrar instantáneamente por título o descripción.

## 🏗️ Estructura del Proyecto

```text
notes-tasks-app/
├── backend/
│   └── Code.gs        # Código para Google Apps Script
├── frontend/
│   ├── index.html     # Estructura principal
│   ├── styles.css     # Estilos y personalizaciones
│   └── app.js         # Lógica de cliente e integración API
└── README.md          # Esta documentación
```

## 🔒 Seguridad y Privacidad

- Los datos se almacenan exclusivamente en **tu** Google Drive.
- El script utiliza `Session.getActiveUser().getEmail()` para asegurar que, aunque la API sea accesible, los datos mostrados se filtren por el usuario que ha iniciado sesión en Google (si se configura así el acceso).
- No compartas la URL de tu Web App públicamente si quieres mantener la privacidad absoluta.
