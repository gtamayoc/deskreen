# PRD: Deskreen-CE Mantenimiento, Multi-Viewer y Modernización

## Overview
Consolidación integral de la arquitectura de Deskreen-CE. Este documento especifica las tareas de mantenimiento de repositorio, optimización de linters, habilitación de soporte para múltiples visores simultáneos (hasta 5 dispositivos), prevención de suspensión de pantalla (`powerSaveBlocker`), modernización de APIs de captura de pantalla en Electron (transición hacia `getDisplayMedia`), y perfeccionamiento de la interfaz de usuario con controles de visualización (rotación/espejo) y pulido del modo oscuro para resolver problemas de contraste y visibilidad.

## Goals
- Mantener el repositorio limpio y acelerar la verificación estática de código excluyendo librerías minificadas de Biome.
- Permitir que hasta 5 dispositivos se conecten y visualicen la pantalla en simultáneo mediante WebRTC sin colisión de sesiones.
- Impedir la suspensión de pantalla en el equipo anfitrión mientras haya dispositivos conectados activamente.
- Preparar la ruta de modernización de captura de pantalla frente a la deprecación de `chromeMediaSource` en Electron/Chromium.
- Dotar al visor de controles rápidos de rotación y espejo horizontal.
- Garantizar contraste y legibilidad óptimos en el modo oscuro tanto en la aplicación anfitriona como en el visor remoto.

## Quality Gates

These commands must pass for every user story:
- `npm run typecheck` - Verificación de tipos TypeScript en client-viewer, node y web
- `npm run lint` - Linter de Biome sin errores
- `npm run buildClientViewer` - Empaquetado de producción de la aplicación web del visor
- `npm run buildDev` - Empaquetado completo de Electron (main, preload y renderer)

For UI stories, also include:
- Verificación visual de renderizado y contraste en navegador y ventana de Electron

---

## User Stories

### US-001: Mantenimiento del Repositorio y Optimización de Biome
**Description:** Como desarrollador, quiero ignorar la base de datos de memoria de código en Git y excluir bundles minificados de terceros en el linter para que `npm run lint` se ejecute en segundos sin falsos positivos.

**Acceptance Criteria:**
- [ ] Agregar `.codebase-memory/` a `.gitignore`
- [ ] Actualizar `biome.json` para excluir `src/renderer/public/assets/**` tanto en `files.includes` como en `linter.includes`
- [ ] `npm run lint` se ejecuta y finaliza en menos de 5 segundos sin analizar archivos minificados de SimplePeer
- [ ] `git status` no reporta `.codebase-memory/` como archivo no rastreado

---

### US-002: Soporte Multi-Viewer para hasta 5 Dispositivos Conectados
**Description:** Como usuario anfitrión, quiero conectar hasta 5 dispositivos simultáneamente para poder proyectar mi pantalla a varios visores a la vez.

**Acceptance Criteria:**
- [ ] En `src/features/ConnectedDevicesService/index.ts`, implementar `MultiViewerSlot` permitiendo hasta `MAX_CONNECTED_DEVICES = 5` dispositivos concurrentes
- [ ] El método `isAvailable()` retorna `true` cuando `devices.size < 5` y `false` al alcanzar el límite
- [ ] La liberación por ID (`releaseById`) desconecta únicamente al dispositivo indicado sin afectar al resto
- [ ] En `src/features/SharingSessionService/index.ts`, validar la disponibilidad de ranura antes de generar una nueva sesión de espera
- [ ] El Drawer y panel superior (`TopPanel.tsx`) reflejan el contador exacto de dispositivos conectados activos

---

### US-003: Prevención Automática de Suspensión de Pantalla (powerSaveBlocker)
**Description:** Como usuario anfitrión, quiero que la pantalla de mi ordenador no se apague ni entre en reposo mientras haya visores conectados.

**Acceptance Criteria:**
- [ ] En `src/main/helpers/ipcMainHandlers.ts`, registrar listener de disponibilidad con `powerSaveBlocker.start('prevent-display-sleep')`
- [ ] El bloqueo de suspensión se activa inmediatamente cuando la cantidad de dispositivos conectados es mayor a 0
- [ ] El bloqueo se detiene con `powerSaveBlocker.stop()` en cuanto la lista de dispositivos llega a 0
- [ ] Al cerrar o destruir `mainWindow`, se detiene de forma segura cualquier bloqueo activo para evitar fugas de energía

---

### US-004: Preparación y Transición de la API de Captura de Pantalla
**Description:** Como desarrollador, quiero implementar la arquitectura de `getDisplayMedia` y `session.setDisplayMediaRequestHandler` para desacoplar el proyecto de la sintaxis heredada `chromeMediaSource` antes de futuras versiones de Electron.

**Acceptance Criteria:**
- [ ] En `src/main/index.ts`, configurar `session.defaultSession.setDisplayMediaRequestHandler` para gestionar solicitudes de pantalla
- [ ] En `src/renderer/src/features/PeerConnection/getDesktopSourceStreamBySourceID.ts`, implementar manejo con compatibilidad hacia atrás que soporte `navigator.mediaDevices.getDisplayMedia` como opción preferente manteniendo el fallback a `getUserMedia`
- [ ] La selección de fuentes de ventanas y pantallas completas sigue funcionando sin interrupción ni pantallas negras

---

### US-005: Controles Visuales en el Visor (Rotación y Modo Espejo)
**Description:** Como usuario del visor, quiero rotar la pantalla compartida en pasos de 90° e invertirla horizontalmente para ajustar la orientación según la posición de mi dispositivo.

**Acceptance Criteria:**
- [ ] En `src/client-viewer/src/components/PlayerControlPanel/index.tsx`, añadir botones para rotación (icono de giro) y modo espejo (espejo horizontal)
- [ ] En `src/client-viewer/src/containers/PlayerView/index.tsx`, aplicar la transformación CSS correspondiente (`transform: scaleX(-1) rotate(Xdeg)`) al contenedor del video con transición suave
- [ ] La rotación cicla ordenadamente entre 0°, 90°, 180° y 270°
- [ ] Los controles táctiles y clics responden adecuadamente en dispositivos móviles y de escritorio

---

### US-006: Corrección y Coherencia Integral del Modo Oscuro
**Description:** Como usuario, quiero que el modo oscuro se aplique coherentemente en toda la interfaz sin elementos con fondos blancos desalineados o texto ilegible.

**Acceptance Criteria:**
- [ ] En `src/renderer/src/components/TopPanel.tsx`, alternar y persistir la preferencia en `localStorage('deskreen_app_dark_mode')` aplicando la clase `bp3-dark` al `body`
- [ ] En los diálogos de configuración (`SettingsOverlay`), Drawer de dispositivos conectados y tarjetas de previsualización, corregir estilos CSS donde el fondo o texto contrastaban incorrectamente
- [ ] En `src/client-viewer/src/containers/PlayerView/index.tsx`, proveer botón de cambio de tema oscuro/claro para la barra de controles del visor
- [ ] Ningún menú desplegable o tooltip queda con texto claro sobre fondo blanco ni fondo oscuro sobre texto negro

---

## Functional Requirements
- **FR-1**: El sistema debe admitir hasta 5 sesiones WebRTC activas de manera simultánea en el servicio de dispositivos conectados.
- **FR-2**: El sistema debe activar el bloqueo de suspensión del sistema operativo mientras haya al menos 1 dispositivo transmitiendo y liberarlo al llegar a 0.
- **FR-3**: El visor web debe permitir transformar la orientación del video en pantalla completa y ventana normal.
- **FR-4**: El modo oscuro debe persistir entre reinicios de la aplicación y aplicarse a todos los contenedores Blueprint.
- **FR-5**: El linter Biome debe omitir dependencias y activos externos compilados.

## Non-Goals
- Soporte para audio bidireccional en esta iteración.
- Integración de servidores de búsqueda externa Exa en esta fase.
- Soporte para más de 5 dispositivos simultáneos (limitado a 5 por restricciones de ancho de banda y codificación WebRTC en CPU/GPU).

## Technical Considerations
- `simple-peer` maneja cada conexión P2P de forma aislada; verificar que el bitrate agregado de múltiples conexiones no degrade el rendimiento de codificación.
- `powerSaveBlocker` es una API nativa de Electron; asegurar que el identificador retornado se almacene y limpie correctamente.
- La clase `bp3-dark` de Blueprint requiere que los elementos anidados respeten las variables de color de Blueprint v6.

## Success Metrics
- 0 errores de TypeScript (`npm run typecheck`).
- Ejecución de `npm run lint` en menos de 5 segundos.
- Soporte verificado de 2 o más dispositivos visualizando la misma fuente sin cuelgues.
- Contraste visual adecuado (legibilidad 100%) en modo oscuro en todas las pantallas.

## Open Questions
- ¿Deseas que la rotación y el espejo se guarden en el almacenamiento local del dispositivo visor para recordar la preferencia por pantalla?
