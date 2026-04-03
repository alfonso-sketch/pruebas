# Gestión de Visitas a Centros - CEP Córdoba

Web app para que asesores de formación del CEP de Córdoba gestionen sus visitas a centros educativos. Usa Google Sheets como base de datos e incluye autocompletado inteligente mediante OCR (foto de notas) e IA (Gemini gratuito).

## Características

- Formulario completo de visita (mismo formato que Séneca)
- Google Sheets como base de datos (pestaña Centros + Visitas)
- OCR: foto de notas manuscritas → rellena el formulario automáticamente
- IA: texto resumen → completa todos los campos del formulario
- Listado, búsqueda, edición y eliminación de visitas
- Responsive (funciona en móvil y escritorio)
- 100% gratuito

## Configuración paso a paso

### 1. Preparar la hoja de cálculo

Tu hoja de Google ya debe tener la pestaña **Centros** con columnas: `Código | Denominación del centro | Localidad`. La pestaña **Visitas** se creará automáticamente.

### 2. Desplegar el backend (Google Apps Script)

1. Abre tu hoja de cálculo de Google
2. Ve a **Extensiones → Apps Script**
3. Borra el contenido del editor y pega todo el código de `google-apps-script/Code.gs`
4. Guarda (Ctrl+S)
5. Click en **Implementar → Nueva implementación**
6. Tipo: **Aplicación web**
7. Ejecutar como: **Tu cuenta**
8. Acceso: **Cualquier persona**
9. Click en **Implementar** y copia la URL generada

### 3. Obtener API Key de Gemini (gratuita)

1. Ve a [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Inicia sesión con tu cuenta de Google
3. Click en **Create API Key**
4. Copia la clave generada

### 4. Abrir la web app

Tienes varias opciones para abrir `webapp/index.html`:

- **Opción A - Directa:** Abre el archivo `webapp/index.html` directamente en tu navegador (doble click o arrastrar al navegador)
- **Opción B - GitHub Pages:** Sube el repo a GitHub y activa Pages en Settings → Pages → Source: rama main, carpeta /root
- **Opción C - Servidor local:** Ejecuta `python3 -m http.server 8000` en la carpeta del proyecto y abre `http://localhost:8000/webapp/`

### 5. Configurar la app

1. Al abrir la app por primera vez, irás a la pestaña **Ajustes**
2. Pega la **URL de Apps Script** del paso 2
3. Pega la **API Key de Gemini** del paso 3
4. Click en **Guardar Configuración**
5. Click en **Probar Conexión** para verificar

## Uso

### Rellenar manualmente
Selecciona fecha, centro, y completa los campos del formulario.

### Autocompletado con foto
1. Pulsa "Foto de Notas" en la sección de autocompletado
2. Haz una foto a tus notas manuscritas (o selecciona una imagen)
3. Pulsa "Procesar con IA"
4. La app reconoce el texto (OCR) y usa IA para rellenar todos los campos

### Autocompletado con texto
1. Pulsa "Texto Resumen"
2. Escribe o pega un resumen de la visita (informal, como lo contarías)
3. Pulsa "Completar con IA"
4. La IA analiza el texto y rellena el formulario

## Estructura del proyecto

```
├── google-apps-script/
│   └── Code.gs          # Backend: Google Apps Script (conecta con Google Sheets)
├── webapp/
│   └── index.html       # Frontend: Web app completa (HTML + CSS + JS)
└── README.md
```

## Tecnologías

- **Frontend:** HTML5, CSS3, JavaScript (vanilla, sin frameworks)
- **Backend:** Google Apps Script (gratuito)
- **Base de datos:** Google Sheets
- **OCR:** Tesseract.js (gratuito, se ejecuta en el navegador)
- **IA:** Google Gemini API (plan gratuito)
