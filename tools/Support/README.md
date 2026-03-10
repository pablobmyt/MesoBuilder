# MesoBuilder — Despliegue y ejecución

Este documento explica cómo ejecutar y distribuir MesoBuilder en Windows (modo desarrollo y standalone).

## Objetivo

Permitir ejecutar el proyecto localmente con un navegador moderno, con un servidor HTTP (recomendado) o como aplicación de escritorio empaquetada con Electron.

## Requisitos

- Node.js (>=16) y `npm` — necesario para Electron y `npx` (opcional).
- Python 3 (opcional) — para `python -m http.server`.
- PowerShell (incluido en Windows) — puede usarse para un servidor simple.

## Ejecutar en modo desarrollo (navegador)

Se recomienda servir los archivos a través de HTTP para evitar problemas con `file://` (módulos ES, CORS, CSS, fuentes). En la carpeta raíz del proyecto:

Usando Python (si está instalado):

```powershell
cd "C:\YOUR_ROUTE...MesoBuilder"
python -m http.server 8080
```

Usando `npx http-server` (Node):

```powershell
cd "C:\YOUR_ROUTE...MesoBuilder"
npx http-server -p 8080 -c-1
```

Luego abre en el navegador: `http://127.0.0.1:8080/`.

Si no quieres instalar nada, puedes usar PowerShell y su `HttpListener` (ejemplo rápido): crea un fichero `serve.ps1` con un pequeño servidor, o usar el siguiente snippet en una consola PowerShell elevada:

```powershell
$prefix = "http://127.0.0.1:8080/"; $root = "C:\YOUR_ROUTE...MesoBuilder"
Add-Type -AssemblyName System.Net.HttpListener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $root on $prefix"
while ($listener.IsListening) {
  $ctx = $listener.GetContext(); $req = $ctx.Request
  $path = $req.Url.AbsolutePath.TrimStart('/') -replace '/','\'
  $file = Join-Path $root $path
  if (-not (Test-Path $file) -or $path -eq '') { $file = Join-Path $root 'index.html' }
  try { $bytes = [System.IO.File]::ReadAllBytes($file); $ctx.Response.ContentLength64 = $bytes.Length; $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length) } catch { $ctx.Response.StatusCode = 404 }
  $ctx.Response.OutputStream.Close()
}
$listener.Stop()
```

## Ejecutar como app de escritorio (Electron) — recomendado para standalone

Se incluye un wrapper mínimo de Electron en `electron/main.js` y un `package.json` con scripts.

Instalación y ejecución:

```powershell
cd "C:\YOUR_ROUTE...MesoBuilder"
npm install
npm run start-electron
```

`start-electron` abrirá la ventana de la aplicación usando Chromium incluido en Electron, y mostrará `index.html` correctamente.

Para empaquetar (generar carpeta `dist` con ejecutable Windows):

```powershell
npm run package-win
```

Notas:
- Descargar Electron requiere ancho de banda (decenas/hundreds MB). El packaging crea un binario auto contenido.
- Podemos cambiar a `electron-builder` para generar instaladores .exe/.msi si lo deseas.

## Launcher: `bin\MesoBuilder.vbs`

El archivo `bin\MesoBuilder.vbs` crea una ventana HTA apuntando a `file:///.../index.html` y también intenta abrir la URL con la aplicación por defecto. Ten en cuenta:

- HTA usa el motor de Internet Explorer y puede no soportar módulos ES ni características CSS modernas.
- Para una experiencia consistente, usa el servidor HTTP o Electron.

Ejecutar el launcher manualmente:

```bat
cscript //nologo "C:\YOUR_ROUTE...MesoBuilder\bin\MesoBuilder.vbs"
```

## Problemas comunes y soluciones

- CSS/JS no cargan o fallan en HTA: HTA usa Trident/IE; en su lugar ejecuta la app vía HTTP o empaqueta con Electron.
- Módulos ES (`<script type="module">`): no funcionan con `file://` en algunos navegadores o en HTA; usa HTTP o bundling con `esbuild`.
- Fuentes o recursos relativos rotos: verifica las rutas relativas en `index.html` y que los archivos existan en el repo.

## Opciones de distribución

- Single-file HTML: usar `esbuild` para bundlear scripts y estilos en un único `game.html`. Esto mejora la compatibilidad con HTA, pero cuidado con imágenes y tamaños.
- Electron: la opción que implementamos aquí — mejor compatibilidad y experiencia "standalone".

## Próximos pasos sugeridos

- Si quieres que prepare el bundler con `esbuild`, puedo añadir `tools/make-single-html.js` y scripts `npm run build-single`.
- Si prefieres instalador Windows, puedo añadir `electron-builder` y configuración básica.

---
Archivo creado: [tools/Support/README.md](tools/Support/README.md)
