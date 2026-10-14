# Revisión de Seguridad Técnica y Cadena de Suministro: Deskreen CE

**Fecha de evaluación:** 13 de octubre de 2026  
**Alcance:** Proceso principal de Electron 37, IPC, Servidor Koa / Socket.io, WebRTC y Dependencias  
**Documento de referencia:** `SECURITY.md` y `tasks/prd-public-release-compliance-and-branding.md`

---

## 1. Resumen de Seguridad

Esta revisión constituye un análisis estático exhaustivo de las configuraciones de seguridad de Electron, la superficie de red local, los flujos WebRTC y la cadena de suministro de dependencias.

- **Nivel de riesgo general:** **Bajo a Moderado** (propio de una herramienta de red de área local soberana).
- **Filtración de datos a la nube:** **Nula.** No existen servicios de telemetría remota forzados ni almacenamiento de video o capturas en la nube.
- **Cifrado en tránsito:** Los flujos de video y control remoto viajan protegidos mediante **DTLS-SRTP** en la capa WebRTC.
- **Riesgo residual principal:** 43 avisos en dependencias de desarrollo y construcción (`npm audit`), especialmente en Vite 7.2.4 y `ws` transitivo.

---

## 2. Auditoría del Proceso Principal de Electron

### 2.1. Configuración de `BrowserWindow` y `webPreferences`
En `src/main/index.ts`:
- **Aislamiento de contexto y Preload:** Utiliza scripts de precarga dedicados generados en `out/preload/index.js` y `out/preload/helperRenderer.js`.
- **Navegación externa restringida:** Implementa un manejador defensivo en `webContents.setWindowOpenHandler`:
  ```typescript
  this.mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: 'deny' };
  });
  ```
  Esto previene que enlaces web dentro de la aplicación abran ventanas secundarias embebidas arbitrarias o ejecuten exploits de Chromium dentro del contexto de Electron.
- **Gestión explícita de permisos (Electron 37):**
  ```typescript
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowed = ['media', 'display-capture', 'desktop-capturer', 'screen'];
      callback(allowed.includes(permission));
  });
  ```
  Garantiza que solo se otorguen los permisos de captura de pantalla necesarios y se rechacen solicitudes no autorizadas (como geolocalización, notificaciones forzadas o acceso a dispositivos Bluetooth).

---

## 3. Auditoría de Superficie de Red y Servidor de Señalización

### 3.1. Servidor Local Koa & Socket.io 4 (`src/server/index.ts`)
- **Puerto de escucha:** Predeterminado en `3131` (con puerto de respaldo en `3132` gestionado por `detect-port`).
- **Política de orígenes cruzados (CORS):**
  El servidor Koa y Socket.io reflejan el origen para permitir que cualquier dispositivo móvil en la misma subred local o en una interfaz Tailscale cargue el bundle web:
  ```typescript
  cors: {
      origin: (_origin, callback) => { callback(null, true); },
      methods: ['GET', 'POST'],
      credentials: true,
  }
  ```
  *Evaluación de riesgo:* Aceptable para redes locales privadas de confianza.  
  *Recomendación:* Se desaconseja exponer este puerto a través de reenvío de puertos NAT hacia Internet pública sin una capa de autenticación HTTP previa.

### 3.2. Configuración WebRTC y Servidores STUN/TURN
- En `handleCreatePeer.ts` y en el visor cliente, la configuración define explícitamente:
  ```typescript
  config: { iceServers: [] }
  ```
- **Consecuencia de seguridad positiva:** El navegador del dispositivo móvil y la PC anfitriona **no contactan servidores STUN/TURN públicos de terceros** (como Google STUN), protegiendo la dirección IP pública y los patrones de tráfico del usuario.
- **Consecuencia operativa:** Las conexiones P2P solo pueden establecerse cuando ambos dispositivos pueden alcanzarse directamente a nivel de red (misma Wi-Fi/LAN o túnel VPN privado).

---

## 4. Cadena de Suministro y Gestión de Vulnerabilidades

### 4.1. Análisis de `npm audit`
- **Raíz del proyecto:** 43 vulnerabilidades detectadas en dependencias de desarrollo y empaquetado.
  - **Vite (7.2.4):** Vulnerable a path traversal en el servidor de desarrollo local (`GHSA-4w7w-66w2-5vf9`). No afecta al bundle compilado de producción (`out/`).
  - **ws (8.x transitivo en engine.io):** Agotamiento de memoria por fragmentos pequeños (`GHSA-96hv-2xvq-fx4p`).
  - **undici (transitivo en @vercel/blob):** Inyección CRLF y DoS en descompresión.
- **Visor cliente (`src/client-viewer`):** 22 vulnerabilidades registradas.
  - **ua-parser-js (2.0.6):** ReDoS potencial en cabecera `Sec-CH-UA-Model`.
- **Estrategia de mitigación recomendada:**
  Dado que la compilación actual y los 393 tests funcionan con estabilidad absoluta, actualizar `vite` a `>=7.3.7` y `ua-parser-js` a `>=2.0.10` en una rama de mantenimiento posterior tras validar que no existan regresiones de empaquetado con `electron-vite`.

---

## 5. Higiene de Secretos y Permisos de CI

- **Análisis de secretos:** El repositorio ha sido escaneado. No se encontraron claves privadas SSH, certificados `.p12` no encriptados, tokens de GitHub ni credenciales de producción en el árbol de trabajo.
- **Flujo de CI (`.github/workflows/release.yml`):**
  - Solo se dispara en etiquetas `v*`.
  - No ejecuta tareas no controladas en Pull Requests externos.
  - Los permisos de empaquetado utilizan variables secretas del repositorio inyectadas únicamente durante el release oficial.
