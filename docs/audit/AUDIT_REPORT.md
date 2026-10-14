# Auditoría Integral del Repositorio y Matriz de Hallazgos: Deskreen CE

**Fecha de auditoría:** 13 de octubre de 2026  
**Rama evaluada:** `chore/public-release-compliance-branding` (derivada de `feature/ai-console-companion`)  
**Repositorio local:** `C:\discolocal\PROYECTOS\PYTHON\SCREEN`  
**Repositorio upstream de referencia:** `https://github.com/pavlobu/deskreen` (último release oficial v1.0.11 / v2.0.4 en 2021)  
**Repositorio fork:** `https://github.com/gtamayoc/deskreen`  
**Versión declarada en package.json:** `3.2.16`  
**Licencia declarada:** GNU Affero General Public License v3.0 (AGPL-3.0)

---

## 1. Resumen Ejecutivo del Estado Actual

Deskreen CE representa una evolución técnica significativa frente al repositorio original de Pavlo Bilida (`pavlobu/deskreen`), el cual quedó congelado en el stack tecnológico de 2020-2021 (Electron 13, Webpack 4/5, React 16, Yarn 1). La versión actual ha completado una modernización profunda hacia:
- **Electron 37.9.0** con Chromium 134+ y Node.js `>=22.6.0`.
- **React 19.2.0** en anfitrión y visor cliente.
- **Vite 7.2.4** y **electron-vite 4.0.1** reemplazando completamente el bundler original.
- **TypeScript 5.9.3** estricto con comprobación multi-proyecto (`typecheck:client-viewer`, `typecheck:node`, `typecheck:web`).
- **Biome 2.3.6** para formateo y linter estático.
- **Node Test Runner nativo** (`node:test`) con 393 pruebas pasando sin fallas.

A pesar de la solidez técnica interna, el repositorio presentaba deficiencias críticas para su exposición pública:
1. **Discrepancia en metadatos y documentación:** El `README.md` y plantillas de GitHub conservaban referencias desactualizadas a Yarn, enlaces de clonación que apuntaban al repositorio upstream sin explicar el fork, y el verificador de actualizaciones consultaba la API de GitHub de `pavlobu/deskreen` en lugar de una fuente comunitaria.
2. **Ambigüedad sobre las capacidades de red y pantalla extendida:** El software requiere un controlador de pantalla virtual de terceros (como Virtual-Display-Driver por itsmikethetech) o un dongle HDMI físico para crear un monitor extendido real en Windows, y no incluye servidores STUN/TURN públicos para atravesar redes móviles o CGNAT sin una VPN Mesh (como Tailscale).
3. **Plantillas de comunidad obsoletas:** Las plantillas de issues exigían requisitos heredados de 2020 (ej. "Using yarn", "DEBUG_PROD=true yarn build") con tono restrictivo.
4. **Vulnerabilidades en dependencias de desarrollo:** Existen 43 alertas en la raíz (principalmente Vite 7.2.4 y `ws` transitivo) y 22 en `client-viewer`.

---

## 2. Inventario de Metadatos y Estructura del Proyecto

### 2.1. Metadatos de Raíz (`package.json`)
- **`name`:** `"deskreen-ce"` (Preservando internamente el identificador para scripts y packaging).
- **`version`:** `3.2.16`.
- **`description`:** *"Screen sharing and present screen: Turn any device into a secondary screen for your computer"*.
- **`author`:** `"deskreen.com"` (Pendiente de atribución comunitaria explícita).
- **`homepage`:** `"https://electron-vite.org"` *(Inconsistencia crítica: URL genérica de plantilla)*.
- **`packageManager`:** `"npm@10.9.0"`.

### 2.2. Metadatos de Subproyecto (`src/client-viewer/package.json`)
- **`name`:** `"deskreen-ce-client-viewer"`.
- **`version`:** `3.2.16`.
- **`type`:** `"module"`.
- **`scripts`:** `dev`, `build` (`tsc -b && vite build`), `preview`.

### 2.3. Estructura de Directorios Clave
```
C:\discolocal\PROYECTOS\PYTHON\SCREEN
├── .github/                 # Workflows (release.yml) y plantillas de issues
├── docs/                    # Informes técnicos y auditoría (docs/audit/)
├── resources/               # Iconos y assets de empaquetado (icon.png)
│   └── branding/            # (Nuevo) Assets vectoriales originales SVG
├── src/
│   ├── client-viewer/       # Aplicación web React 19 servida por Koa (puerto 5174 en dev)
│   ├── common/              # Constantes, configuraciones compartidas y electron-store
│   ├── features/            # 4 servicios principales (SharingSession, DesktopCapturer, etc.)
│   ├── main/                # Proceso principal de Electron 37 (index.ts, IPC, menús)
│   ├── preload/             # Preload scripts aislados para main y helper renderer
│   ├── renderer/            # Interfaz de usuario anfitriona en React 19
│   └── server/              # Servidor HTTP Koa 3 y señalización Socket.io 4 (darkwire.io)
├── tasks/                   # Especificaciones PRD y registros de tareas (gitignored)
└── tests/                   # Suite nativa de pruebas unitarias (tests/*.test.ts)
```

---

## 3. Auditoría de Dependencias y Cadena de Suministro

### 3.1. Raíz (`package.json`)
- **Total dependencias:** 719 (237 producción, 483 desarrollo, 166 opcionales).
- **Alertas de seguridad registradas (`npm audit`):**
  - **Críticas:** 4
  - **Altas:** 30
  - **Moderadas:** 8
  - **Bajas:** 1
  - **Total:** 43
- **Paquetes afectados relevantes:**
  - `vite` (v7.2.4): Vulnerable a path traversal y lectura de archivos arbitrarios vía WebSocket del dev server (GHSA-4w7w-66w2-5vf9, GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583). *Mitigación:* Se resuelve actualizando a `>=7.3.7`.
  - `ws` (`engine.io` / `socket.io-adapter` transitivo): Agotamiento de memoria DoS y fuga de memoria no inicializada.
  - `undici` (transitivo vía `@vercel/blob` devDependency): Inyección CRLF y DoS en descompresión WebSocket.

### 3.2. Visor Cliente (`src/client-viewer/package.json`)
- **Total dependencias:** 521 (166 producción, 356 desarrollo, 54 opcionales).
- **Alertas de seguridad registradas (`npm audit`):**
  - **Críticas:** 0
  - **Altas:** 9
  - **Moderadas:** 5
  - **Bajas:** 8
  - **Total:** 22
- **Paquetes afectados relevantes:**
  - `ua-parser-js` (v2.0.6): ReDoS potencial en cabecera `Sec-CH-UA-Model`. *Mitigación:* Actualizar a `>=2.0.10`.
  - `vite` (v7.2.4): Mismas advertencias que la raíz.

---

## 4. Discrepancias entre Afirmaciones Documentales y Realidad del Código

| Afirmación Previa / Asunción | Realidad Comprobada en el Código | Riesgo / Impacto |
| :--- | :--- | :--- |
| *"Convierte cualquier dispositivo en pantalla secundaria extendida"* | Windows no crea monitores virtuales automáticamente. Requiere un hardware Dummy Plug o un controlador IddCx externo como `Virtual-Display-Driver`. Sin esto, solo duplica pantallas o comparte ventanas activas. | Alto. Frustración de usuarios si no se explica con transparencia en el README. |
| *"Conéctate desde cualquier lugar por Internet"* | La configuración WebRTC en `handleCreatePeer.ts` define `iceServers: []`. Sin STUN/TURN, solo funciona en LAN o sobre redes malladas (Tailscale). Falla en conexiones móviles directas bajo CGNAT. | Crítico. Prometer acceso remoto universal es técnicamente falso en el estado actual. |
| *"Instalación con Yarn"* (en plantillas de issues) | El repositorio utiliza estrictamente `npm` (`packageManager: npm@10.9.0`) con Node `>=22.6`. Ejecutar `yarn` corrompe los lockfiles. | Medio. Dificulta el onboarding de nuevos desarrolladores. |
| *"Homepage: https://electron-vite.org"* | Es un valor residual de la plantilla inicial de electron-vite. | Medio. Falta de profesionalismo en metadatos públicos. |
| *"Búsqueda de actualizaciones en pavlobu/deskreen"* | `getNewVersionTag.ts` consulta el repo de Pavlo Bilida que está en v1.0.11/v2.0.4. Deskreen CE está en v3.2.16. | Alto. Notificaciones de actualización erróneas o fallidas. |

---

## 5. Matriz de Hallazgos y Acciones Correctivas

| ID | Componente / Archivo | Problema Detectado | Evidencia Fáctica | Impacto | Prioridad | Acción Propuesta | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **H-01** | `package.json` | `homepage` apunta a `electron-vite.org` | Línea 7 de `package.json` | Medio | Alta | Apuntar al repositorio del fork en GitHub | **En proceso** |
| **H-02** | `README.md` | Instrucciones de clonación apuntan a upstream sin explicar que es un fork | Líneas 39-41 de `README.md` | Alto | Alta | Reescribir README con 19 secciones, aclarando upstream y fork | **En proceso** |
| **H-03** | `README.md` | Omisión de requisitos de VDD para pantalla extendida | Análisis de `DesktopCapturerSourcesService` | Alto | Alta | Documentar explícitamente el uso de `Virtual-Display-Driver` | **En proceso** |
| **H-04** | `README.md` | Falta de documentación sobre modelo de red (LAN vs Tailscale) | `investigacion_conexion_datos_moviles.md` y `iceServers: []` | Alto | Alta | Documentar modelo LAN y guía de Tailscale para CGNAT | **En proceso** |
| **H-05** | `.github/ISSUE_TEMPLATE` | Plantillas obsoletas exigiendo Yarn y lenguaje restrictivo | `1-Bug_report.md`, `3-Feature_request.md` | Medio | Alta | Reemplazar con GitHub Issue Forms modernos (.yml) | **En proceso** |
| **H-06** | `CODE_OF_CONDUCT.md` | Dirección de reporte asignada al email personal de Pavlo Bilida | Línea 58: `pavlobu@gmail.com` | Alto | Alta | Cambiar a canal de reporte comunitario del fork | **En proceso** |
| **H-07** | `CHANGELOG.md` | Historial congelado en versión 1.0.11 (2021) | Fin de archivo `CHANGELOG.md` | Medio | Media | Agregar sección Deskreen CE 3.2.16 con hitos modernos | **En proceso** |
| **H-08** | `src/main/utils/getNewVersionTag.ts` | URL de releases apunta a repo upstream desactualizado | Línea 4: `repos/pavlobu/deskreen/releases/latest` | Alto | Alta | Documentar en `RELEASE_READINESS.md` y apuntar a fork | **Auditado** |
| **H-09** | Dependencias | 43 alertas de seguridad en raíz y 22 en visor | Reporte de `npm audit` | Medio | Media | Documentar en `SECURITY_REVIEW.md` con plan de bump | **Auditado** |
| **H-10** | Identidad gráfica | Ausencia de manual de marca y logotipos vectoriales originales | Solo existe `resources/icon.png` heredado | Alto | Alta | Crear `resources/branding/*.svg` y `BRAND_GUIDELINES.md` | **En proceso** |
