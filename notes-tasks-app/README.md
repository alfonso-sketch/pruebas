# TaskMaster Pro - Versión Integrada (Google Apps Script)

Esta versión de la aplicación se ejecuta **completamente dentro de Google Apps Script**, lo que facilita el despliegue y mejora la seguridad al no requerir servidores externos para el frontend.

## 🚀 Instrucciones de Despliegue (Paso a Paso)

### 1. Preparar la Hoja de Cálculo
1. Crea una nueva **Hoja de cálculo de Google**.
2. Ve al menú superior: **Extensiones > Apps Script**.

### 2. Copiar los Archivos al Editor de Apps Script
En el editor de Apps Script, debes crear 4 archivos con los nombres exactos:

1.  **Code.gs**:
    - Si ya existe un archivo `Código.gs`, cámbiale el nombre a `Code.gs` o borra su contenido.
    - Pega el contenido de `gas/Code.gs`.
2.  **index.html**:
    - Haz clic en el símbolo **+** junto a "Archivos" y selecciona **HTML**.
    - Ponle de nombre `index` (Google añadirá .html).
    - Pega el contenido de `gas/index.html`.
3.  **styles.html**:
    - Crea otro archivo HTML llamado `styles`.
    - Pega el contenido de `gas/styles.html`.
4.  **javascript.html**:
    - Crea otro archivo HTML llamado `javascript`.
    - Pega el contenido de `gas/javascript.html`.

### 3. Configuración Inicial y Privacidad
1. En `Code.gs`, localiza la línea `const AUTHORIZED_EMAIL = '';`.
2. **Recomendado:** Pon tu correo electrónico entre las comillas para que solo tú puedas acceder.
3. En la barra de herramientas, selecciona la función `setup` y haz clic en **Ejecutar**. Esto preparará las columnas de la hoja de cálculo.
4. Otorga los permisos necesarios cuando se te soliciten.

### 4. Publicar la Aplicación
1. Haz clic en el botón azul **Desplegar > Nueva implementación**.
2. Selecciona el tipo: **Aplicación web**.
3. Configuración:
   - **Descripción:** TaskMaster UI.
   - **Ejecutar como:** El usuario que accede a la aplicación web.
   - **Quién tiene acceso:** Cualquier persona con una cuenta de Google.
4. Haz clic en **Desplegar** y copia la **URL de la aplicación web**.

---

## 💡 Ventajas de esta Versión
- **Sin CORS:** Al estar todo en el mismo dominio, no hay problemas de conexión.
- **Velocidad:** La comunicación vía `google.script.run` es nativa y más eficiente.
- **Privacidad Total:** Los datos y la interfaz viven exclusivamente en tu cuenta de Google.
- **Mantenimiento:** Solo necesitas gestionar un proyecto de Apps Script.

## 🏗️ Estructura en Apps Script
```text
Proyecto GAS/
├── Code.gs          # Lógica de servidor y rutas
├── index.html       # Estructura base de la interfaz
├── styles.html      # Estilos CSS y Tailwind
└── javascript.html  # Lógica del cliente (JS)
```
