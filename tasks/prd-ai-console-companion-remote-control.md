# PRD: Deskreen CE - AI Console Companion & Remote Action Pad

## Overview
Deskreen CE se especializa en convertir cualquier dispositivo secundario (teléfono, tablet, monitor adicional) en una extensión de pantalla vía WebRTC. Al trabajar con herramientas de inteligencia artificial y agentes de codificación en terminales (como Antigravity CLI, Claude Code, Ralph TUI, Gemini CLI o Aider), el desarrollador a menudo monitorea la ejecución desde su teléfono mientras se mueve o programa. Sin embargo, interactuar con texto diminuto en una consola desde una pantalla táctil resulta impreciso y frustrante.

Esta funcionalidad introduce el **AI Console Companion & Remote Action Pad**: un panel táctil deslizable optimizado para dispositivos móviles en el visor web (`client-viewer`), equipado con botones de un toque para responder opciones de IA (`A/B/C/D`, `1/2/3/4`), autorizaciones inmediatas (`y + Enter`, `n + Enter`), teclas críticas de terminal (`Ctrl+C`, `Enter`, `Tab`, `Esc`, Flechas de historial) y una barra de inserción de texto rápido. Las pulsaciones se transmiten por WebRTC DataChannel y se inyectan en el anfitrión de manera infalible y dirigida a la ventana de la consola seleccionada (Target Window Lock), sentando además las bases arquitectónicas para el control táctil completo del sistema.

---

## Goals
- Proporcionar un **Action Pad táctil inferior deslizable** en el visor web de Deskreen cuando se comparte una consola o terminal.
- Permitir **responder y autorizar herramientas de IA** con un solo toque desde el teléfono (`y + Enter`, `n + Enter`, combinaciones de opciones `1a, 2b`).
- Implementar **Target Window Lock**: inyección dirigida de eventos de teclado hacia la ventana objetivo de la consola en el sistema anfitrión, garantizando que ninguna pulsación se pierda ni se desvíe a otra aplicación.
- Utilizar **WebRTC RTCDataChannel P2P encriptado** para garantizar latencias inferiores a 10 milisegundos sin sobrecargar el servidor de señalización.
- Proveer **control de seguridad y permisos** en el anfitrión con un conmutador por dispositivo que permita habilitar o revocar la interacción remota en cualquier momento.
- Establecer una arquitectura modular extensible que permita evolucionar en una fase posterior hacia emulación completa de ratón, puntero y gestos táctiles.

---

## Quality Gates

These commands must pass for every user story:
- `npm run typecheck` - Verificación estricta de tipos TypeScript en los proyectos `client-viewer`, `node` y `web`.
- `npm run lint:error-only` - Comprobación de linter Biome sin errores.
- `npm run build` - Compilación completa de producción (Vite client-viewer y paquetes de Electron `main`, `preload`, `renderer`).

For UI stories, also include:
- Verificación visual y de interacción táctil tanto en el navegador móvil/emulador táctil como en la ventana de escritorio de Electron.

---

## User Stories

### US-001: WebRTC Remote Input Data Channel & Protocolo de Eventos
**Description:** Como desarrollador, quiero un canal de datos WebRTC (`RTCDataChannel`) bidireccional y seguro entre el visor y el anfitrión para transmitir eventos de teclado y comandos de acción en tiempo real con latencia mínima.

**Acceptance Criteria:**
- [ ] En `src/client-viewer/src/features/PeerConnection/`, crear e inicializar un `RTCDataChannel` etiquetado `deskreen-remote-input` dentro de la sesión peer existente.
- [ ] En `src/renderer/src/features/PeerConnection/`, escuchar y registrar el canal de datos entrante asociándolo a la sesión activa.
- [ ] Definir el esquema TypeScript para mensajes de entrada: `{ type: 'key_tap' | 'key_combo' | 'text_input' | 'macro', payload: unknown }`.
- [ ] Las tramas de entrada se descartan de forma segura si el anfitrión tiene el control remoto deshabilitado para ese dispositivo.

---

### US-002: Inyección Dirigida a Ventana Objetivo en el Anfitrión (Target Window Lock)
**Description:** Como usuario anfitrión, quiero que las pulsaciones enviadas desde el visor se inyecten de forma precisa en la ventana de la terminal elegida, para que nunca fallen ni se desvíen aunque otra ventana reciba foco temporal.

**Acceptance Criteria:**
- [ ] En `src/main/services/`, crear `RemoteInputInjectionService.ts` para gestionar la simulación de pulsaciones de teclado en el sistema operativo anfitrión.
- [ ] Al seleccionar una ventana de consola en el flujo de compartir pantalla, almacenar el identificador de ventana de la consola como objetivo (`targetWindowHandle` / ID de captura).
- [ ] Implementar la función de inyección garantizando que el foco se restablezca o dirija de forma instantánea a la ventana objetivo antes de emitir las teclas simuladas.
- [ ] Soportar teclas especiales de consola: `Enter`, `Ctrl+C`, `Esc`, `Tab`, `Backspace`, flechas arriba/abajo.

---

### US-003: Action Pad Táctil Inferior en el Visor Web (`client-viewer`)
**Description:** Como usuario con un teléfono o tablet, quiero un panel táctil deslizable en la parte inferior del reproductor para acceder rápidamente a botones de respuesta sin tapar permanentemente la pantalla de la consola.

**Acceptance Criteria:**
- [ ] En `src/client-viewer/src/components/`, crear el componente `ConsoleActionPad.tsx`.
- [ ] El panel cuenta con una pestaña/handle táctil para expandirse o colapsarse con un gesto o toque en la parte inferior de `PlayerView`.
- [ ] El diseño es responsive y amigable para pulgares en pantallas móviles (botones de altura mínima 44px con separación adecuada).
- [ ] Incluye cuadrícula de botones de opción inmediata: `A`, `B`, `C`, `D`, `1`, `2`, `3`, `4`.
- [ ] Incluye barra de botones de acción rápida: `[✓ Y / Aprobar]`, `[✗ N / Rechazar]`, `[Enter]`, `[Ctrl+C]`.

---

### US-004: Macros de Respuesta Rápida para Asistentes de IA
**Description:** Como desarrollador que utiliza asistentes en terminal, quiero botones preconfigurados para las respuestas más frecuentes de IA para avanzar en el flujo con un solo toque.

**Acceptance Criteria:**
- [ ] Botón de macro *"Aprobar"* que envía automáticamente la secuencia `'y'` + `Enter`.
- [ ] Botón de macro *"Rechazar / Cancelar"* que envía `'n'` + `Enter`.
- [ ] Botón de macro *"Detener Tarea"* que envía la señal de interrupción `Ctrl+C`.
- [ ] Selector rápido de respuestas compuestas frecuentes para asistentes (por ejemplo botones tipo chip: `1a`, `1b`, `2a`, `2b` o combinaciones personalizadas).
- [ ] Feedback visual háptico o de animación en el botón al ser pulsado para confirmar el envío.

---

### US-005: Campo de Inserción de Texto Rápido y Teclas de Navegación
**Description:** Como usuario en el móvil, quiero poder escribir una respuesta corta o seleccionar comandos anteriores del historial de la terminal sin lidiar con el teclado táctil flotando sobre el video.

**Acceptance Criteria:**
- [ ] En `ConsoleActionPad.tsx`, incluir un input de texto rápido con botón *"Enviar a Consola"*.
- [ ] Al presionar *"Enviar"*, el texto se transmite caracter por caracter o en bloque seguido de `Enter` opcional.
- [ ] Incluir botones de navegación de historial de consola: `↑ (Flecha arriba)` para recuperar el último comando y `↓ (Flecha abajo)`.
- [ ] Botón de tecla `Tab` para autocompletado en terminal y `Esc` para cancelar menús interactivos.

---

### US-006: Control de Seguridad y Permisos en la Aplicación Anfitriona
**Description:** Como usuario anfitrión, quiero poder autorizar o revocar individualmente el permiso de control remoto para cada dispositivo conectado desde la ventana de Deskreen.

**Acceptance Criteria:**
- [ ] En `src/renderer/src/components/ConnectedDevicesListDrawer.tsx`, añadir un interruptor (switch) *"Permitir Control Remoto"* en cada tarjeta de dispositivo conectado.
- [ ] El estado por defecto para nuevas conexiones es deshabilitado (solo visualización), a menos que sea un "Dispositivo de Confianza" explícitamente configurado.
- [ ] Si un dispositivo desautorizado intenta enviar eventos, el anfitrión ignora la instrucción y notifica al usuario en la barra de estado.
- [ ] Mostrar un indicador visual en el visor remoto indicando si el modo de control está "Activo" o en "Solo Lectura".

---

## Functional Requirements
- **FR-1**: El sistema debe establecer un canal WebRTC `RTCDataChannel` para la transmisión bidireccional de eventos de entrada entre el visor y el anfitrión.
- **FR-2**: El visor web debe ofrecer un Action Pad inferior colapsable con accesos directos táctiles para opciones `A-D`, números `1-4`, `Y`, `N`, `Enter` y `Ctrl+C`.
- **FR-3**: El visor web debe soportar envío de macros de un solo toque que ejecutan combinaciones como `y + Enter` y `n + Enter`.
- **FR-4**: El visor web debe incluir botones para emitir flechas de historial (`↑`, `↓`), `Tab` y `Esc`.
- **FR-5**: El sistema anfitrión debe inyectar las pulsaciones directamente en la ventana de terminal seleccionada como objetivo.
- **FR-6**: El anfitrión debe validar los permisos de control remoto por dispositivo antes de procesar cualquier evento recibido.
- **FR-7**: El usuario anfitrión debe poder alternar el permiso de control remoto en tiempo real desde el cajón de dispositivos conectados.
- **FR-8**: El visor web debe reflejar en tiempo real si el control remoto está habilitado o restringido por el anfitrión.

---

## Non-Goals
- Emulación completa de cursor de ratón relativo para videojuegos (en esta fase se enfoca en consola e interacción táctil).
- Transferencia de archivos bidireccional a través del canal de datos en esta iteración.
- Soporte para atajos de teclado complejos del sistema operativo anfitrión (como `Alt+Tab` o `Win+L`).

---

## Technical Considerations
- **Latencia de Entrada**: El uso de `RTCDataChannel` P2P garantiza que las pulsaciones se reciban con latencia inferior a 10ms en redes de área local (Wi-Fi).
- **Inyección en el Sistema Operativo**: En Windows, la inyección debe realizarse de forma limpia a través de llamadas nativas a la API de Windows (`SendInput` / PowerShell script bridge o librería nativa compatible con Electron) asegurando compatibilidad en empaquetado de producción.
- **Viewport Móvil**: En navegadores móviles (Safari iOS, Chrome Android), el Action Pad debe situarse por encima de la barra de navegación del navegador utilizando `env(safe-area-inset-bottom)` para evitar toques fantasma.

---

## Success Metrics
- 0 errores en `npm run typecheck`, `npm run lint:error-only` y `npm run build`.
- Tiempo de respuesta entre toque en el móvil y aparición en la terminal inferior a 50 milisegundos.
- Tasa de acierto del 100% en respuestas a opciones de asistentes de IA (aprobación `y`, selección de letras/números).
- Cero desvíos de pulsaciones hacia ventanas no autorizadas del sistema operativo.

---

## Open Questions
- ¿Deseas que los botones de opciones (A/B/C/D y 1/2/3/4) envíen automáticamente un salto de línea `Enter` al tocarlos o requieran tocar `[Enter]` por separado para confirmar?
- ¿Te gustaría que el Action Pad guarde en memoria del móvil los últimos 5 textos enviados para reusarlos rápidamente?
