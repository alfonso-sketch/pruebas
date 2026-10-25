# Directorio de contactos CEP Córdoba

Agenda compartida del personal de los CEP de Córdoba, Peñarroya-Pueblonuevo y
Priego-Montilla. Los datos se descargan automáticamente de las páginas
«Personal del CEP» y se guardan en la hoja de cálculo
`1E2jkmXI99XMbd1zsteKqS6m5HsRYUJDrubkwbkIwCwk`.

```
gas/   Backend de Google Apps Script (proyecto 1bUWNXW3mkeqIPEJ1lCeLgjYtA6mEU9KIWzI4F2shccow5LBupZzoGWDR)
dist/  Web estática para subir a cepcordoba.es
```

## 1. Instalar el backend en Apps Script

Con [clasp](https://github.com/google/clasp) (ya está configurado `gas/.clasp.json`):

```bash
npm install -g @google/clasp
clasp login
cd gas && clasp push
```

O a mano: abre la hoja > Extensiones > Apps Script, pega `gas/Code.gs` en
`Code.gs` y, en Configuración del proyecto, marca «Mostrar el archivo de
manifiesto appsscript.json» y pega `gas/appsscript.json`.

## 2. Primera ejecución

1. En el editor de Apps Script selecciona la función `setup` y pulsa **Ejecutar**.
   Acepta los permisos. Esto crea las pestañas `Contactos` y `Registro`, programa
   la sincronización diaria (6:00) y descarga los datos de los tres CEP.
2. En el **Registro de ejecución** aparece la **clave de edición** (`EDIT_KEY`).
   También está en Configuración del proyecto > Propiedades del script.
3. Revisa la pestaña `Contactos`. Si algún CEP no se ha leído bien, ejecuta
   `debugParse` para ver qué extrae de cada página. La pestaña `Registro`
   guarda el resultado de cada sincronización.

## 3. Publicar la API

Implementar > Nueva implementación > Tipo: **Aplicación web**

- Ejecutar como: **Yo**
- Quién tiene acceso: **Cualquier usuario**

Copia la URL que termina en `/exec`.

## 4. Subir la web

Edita `dist/config.js` y pega la URL en `API_URL`. Sube el contenido de `dist/`
a cepcordoba.es (por ejemplo a `/directorio/`). No necesita compilación.

## Funcionamiento

- Contactos con Origen `auto`: se sustituyen en cada sincronización. Si la web de
  un CEP falla o no devuelve a nadie, se conservan los datos anteriores.
  Las notas añadidas a estos contactos se mantienen.
- Contactos con Origen `manual`: se añaden desde la web (botón **Editar** +
  clave) o directamente en la hoja, y la sincronización nunca los toca.
- La web funciona sin conexión con la última copia descargada, permite buscar,
  filtrar por CEP y área, llamar o escribir con un toque, guardar cada contacto
  en la agenda del móvil (vCard) y exportar a CSV.
- Para cambiar la clave de edición, modifica la propiedad `EDIT_KEY`.
- Si cambias `Code.gs`, crea una nueva versión de la implementación
  (Gestionar implementaciones > Editar > Nueva versión) para que la URL use el
  código nuevo.
