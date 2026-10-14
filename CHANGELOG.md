# Historial de Cambios (Changelog) - Deskreen CE

Todas las modificaciones notables de este proyecto están documentadas en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.0.0] - 2026-10-13 (Deskreen Community Edition - Lanzamiento Inaugural)

> **Hito de Versionado:** Deskreen CE `v1.0.0` marca el primer lanzamiento mayor e independiente de la **Community Edition**, reconstruida desde sus cimientos sobre un stack moderno y distanciada funcionalmente de la versión original descontinuada (Deskreen 2.0.x / 1.0.11).

### Añadido
- **Target Window Handle Lock (HWND Lock):** Enrutamiento nativo de entradas de teclado por handle de ventana Win32 (`HWND`) y PID, permitiendo que múltiples celulares operen consolas paralelas independientes sin robar el foco global.
- **Cola Asíncrona Serializada de Entradas:** Ejecución atómica FIFO de pulsaciones para prevenir colisiones o caracteres entrelazados entre múltiples sesiones concurrentes.
- **Soporte Completo para Depuración Inalámbrica Android 11+:** Detección de endpoints mDNS (`._adb-tls-connect._tcp`) y despacho automático de URL de red local sin dependencia de cables.
- **Doble Contingencia USB y Wi-Fi:** Auto-detección y reconexión resiliente vía `adb reverse` con fallback automático a la red local al desconectar el cable.
- **Identidad Visual Original y Assets SVG:** Logotipo (`deskreen-ce-logo.svg`), icono (`deskreen-ce-icon.svg`) y banner (`deskreen-ce-banner.svg`) completamente originales y libres de dependencias binarias pesadas.
- **Manual de Marca y Cumplimiento Legal:** Creación de `BRAND_GUIDELINES.md`, `LEGAL_COMPLIANCE.md`, `AUDIT_REPORT.md` y `SECURITY_REVIEW.md`.

### Modernizado
- **Electron 37.9.0:** Actualización desde Electron 13 obsoleto, con compatibilidad para Chromium 134+ y Node.js `>=22.6`.
- **React 19.2.0:** Migración del frontend del anfitrión y del visor cliente web a React 19.
- **Vite 7.2.4 & electron-vite 4.0.1:** Reemplazo integral de Webpack por Vite con compilación de alto rendimiento y HMR instantáneo.
- **TypeScript 5.9.3 & Biome 2.3.6:** Tipado estricto en todos los targets y linter/formateador moderno ultrarrápido.
- **Node Test Runner Nativo:** Suite de 393 pruebas unitarias y de estrés sin dependencias pesadas de frameworks externos (`node:test`).
- **Visor Cliente Accesible:** Soporte reactivo de tema oscuro/claro y cumplimiento de contraste WCAG AA.

### Corregido
- Eliminación de pantalla negra en Windows mediante desactivación preventiva de capturadores WGC inestables y fallback a DXGI/GDI.
- Eliminación de referencias obsoletas a Yarn y plantillas legadas de 2020.

---

## [Historial Histórico de Deskreen Upstream]

### 1.0.11 (8 Mar 2021)


Changes:

- add Danish language translations. Special thanks to @LauritsLL
- add German language translations. Special thanks to @Aceto1

<br/>
<br/>

# 1.0.10 (25 Feb 2021)

Changes:

- add Spanish language translations. Special thanks to @schiappa

<br/>
<br/>

# 1.0.9 (24 Feb 2021)

Changes:

- remove severe Windows UI lags.
- Increase performance on weak Windows machines.

<br/>
<br/>

# 1.0.8 (23 Feb 2021)

Changes:

- added locales for Traditional Chinese language, special thanks to @taotieren
- minor UI improvements

<br/>
<br/>

# 1.0.7 (21 Feb 2021)

Changes:

- added locales for Chinese language, special thanks to @taotieren
- minor UI improvements

<br/>
<br/>

# 1.0.6 (20 Feb 2021)

Changes:

- added locales for Russian and Ukrainian languages
- minor UI improvements

<br/>
<br/>

# 1.0.5 (7 Feb 2021)

Changes:

- Fix quality is not set to 100% when sharing started: https://github.com/pavlobu/deskreen/issues/100

<br/>
<br/>

# 1.0.4 (4 Feb 2021)

Changes:

- add Flip button in client web view (gear icon button, next to play button) for use a tablet as a teleprompter
- set 100% video quality by default when screen sharing starts
- add polyfills to remove issue of blank pages on old browsers. Thanks @klarkc
- display error message in client viewer if there is WebRTC error

<br/>
<br/>

# 1.0.3 (29 Jan 2021)

Changes:

- remove pulsing animation on orange step bubbles
- portable version on windows
- release draft before publishing release
- remove non-working macOS zip from release

<br/>
<br/>

# 1.0.2 (27 Jan 2021)

Changes:

- Security patches
- Updated electron version to 11.2.1
- fix for https://github.com/pavlobu/deskreen/issues/45
- ? fix for https://github.com/pavlobu/deskreen/issues/56
- ? fix for https://github.com/pavlobu/deskreen/issues/17

<br/>
<br/>

# 1.0.1 (25 Jan 2021)

Changes:

- Fix typos in Deskreen. Special thanks to @EdwardBetts

<br/>
<br/>

# 1.0.0 (18 Jan 2021)

Features:

- works with WiFi or LAN
- use any device with web browser as second screen for your computer (using Display Dummy Plug)
- use any device web browser to mirror your computer's screen
- use any device web browser to view a single application window from your computer's screen
- supports multiple screen sharing sessions to as many devices as you want
- supports changing picture quality while sharing a screen.
- Picture auto quality change supported. (for performance boost while watching youtube video for example)
- End-to-end security
- dark mode UI support
- available for Win / Mac / Linux
