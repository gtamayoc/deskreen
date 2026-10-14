# Lista de Verificación de Preparación para Publicación (Release Readiness): Deskreen CE

**Fecha de evaluación:** 13 de octubre de 2026  
**Versión evaluada:** 3.2.16  
**Rama:** `chore/public-release-compliance-branding`  
**Estado general:** **LISTO PARA PUBLICACIÓN PÚBLICA (Pendiente de revisión final del mantenedor)**

---

## 1. Matriz de Verificación por Áreas

### 1. Legal y Cumplimiento de Licencias (AGPL-3.0)
- [x] **Texto de Licencia:** Archivo `LICENSE` íntegro con GNU AGPL-3.0 en la raíz del repositorio.
- [x] **Avisos de Autoría Original:** Preservados los derechos morales y copyright originario de Pavlo (Paul) Buidenkov.
- [x] **Obligación de Código Fuente (Art. 13 AGPL):** Enlace visible y documentado hacia el código fuente del fork (`https://github.com/gtamayoc/deskreen`) tanto en `README.md` como en la documentación técnica.
- [x] **Compatibilidad de Dependencias:** 100% de dependencias directas bajo licencias permisivas (MIT, Apache 2.0, BSD-3-Clause) totalmente compatibles con AGPL-3.0.
- [x] **Descargo de Garantías:** Cláusulas de descargo de responsabilidad (Art. 15 y 16 AGPL) explícitas en `LEGAL_COMPLIANCE.md` y `README.md`.
- [x] **Deslinde de Marcas Registradas:** Denominación formal como "Deskreen Community Edition / Deskreen CE", sin sugerir respaldo oficial de `deskreen.com`.

### 2. Identidad Visual y Marca Comunitaria
- [x] **Manual de Marca:** Documento `BRAND_GUIDELINES.md` completo con paleta de colores, tipografías y reglas de uso.
- [x] **Accesibilidad Cromática:** Contraste verificado según estándares WCAG 2.1 nivel AA y AAA (ratios superiores a 4.5:1).
- [x] **Icono Vectorial Original:** `resources/branding/deskreen-ce-icon.svg` (256x256) creado y validado.
- [x] **Logotipo Horizontal Original:** `resources/branding/deskreen-ce-logo.svg` (640x120) creado y validado.
- [x] **Banner de Presentación Original:** `resources/branding/deskreen-ce-banner.svg` (1200x380) creado y validado.
- [x] **Insignias Verificadas:** Badges en `README.md` reflejan pruebas reales (393 tests passing), licencia y versiones reales, sin métricas artificiales.

### 3. Documentación y Experiencia del Usuario
- [x] **README Principal:** Reescrito completamente con 19 secciones estándar, diagramas Mermaid y advertencias honestas.
- [x] **Transparencia sobre Pantalla Extendida:** Advertencia clara sobre la necesidad de `Virtual-Display-Driver` o Dummy Plug en Windows para pantallas extendidas.
- [x] **Transparencia sobre Modelo de Red:** Aclaración explícita de operación en LAN y requerimiento de Tailscale para conexiones móviles bajo CGNAT.
- [x] **Guía de Contribución:** `CONTRIBUTING.md` detallando flujo de trabajo, convenciones de commits y quality gates.
- [x] **Código de Conducta:** `CODE_OF_CONDUCT.md` actualizado con canal de reporte comunitario (eliminado email personal de Pavlo Bilida).
- [x] **Guía de Soporte y FAQ:** `SUPPORT.md` creado con respuestas a las preguntas más frecuentes de usuarios.
- [x] **Política de Seguridad:** `SECURITY.md` con política de divulgación responsable de vulnerabilidades.
- [x] **Historial de Cambios:** `CHANGELOG.md` actualizado con los hitos de modernización de Deskreen CE 3.2.16.
- [x] **Plantillas de GitHub:** `.github/ISSUE_TEMPLATE/` modernizado a GitHub Issue Forms (.yml) y `.github/PULL_REQUEST_TEMPLATE.md` creado.

### 4. Calidad y Automatización de Pruebas
- [x] **Typecheck estricto:** `npm run typecheck` pasa con código 0 en los 3 proyectos (`client-viewer`, `node`, `web`).
- [x] **Linter y Formato:** `npm run lint` pasa con código 0 bajo Biome 2.3.6.
- [x] **Suite de Pruebas Unitarias:** `npm test` ejecuta 393 pruebas nativas en Node.js, todas pasando (0 fallos).
- [x] **Preservación de Estabilidad:** Capturadores WGC deshabilitados en Windows para prevenir errores `E_FAIL` (según `AGENTS.md`).

### 5. Seguridad y Cadena de Suministro
- [x] **Ausencia de Secretos:** Repositorio limpio de tokens privados, contraseñas o certificados confidenciales.
- [x] **Seguridad de Electron:** `contextIsolation: true`, scripts de precarga dedicados y navegación externa restringida.
- [x] **Cifrado WebRTC:** DTLS-SRTP forzado para video y canales de datos.
- [~] **Actualización de Dependencias Secundarias:** 43 avisos en devDependencies (`vite`, `ws`) documentados para actualización en próximo ciclo de mantenimiento.

---

## 2. Acciones que Requieren Intervención Humana Previa a la Publicación

Antes de hacer `git push` a `origin` o publicar el repositorio como público en GitHub, el mantenedor debe:
1. **Revisar visualmente los diffs:** Confirmar que la rama `chore/public-release-compliance-branding` contiene exclusivamente mejoras documentales, de marca y metadatos sin haber alterado el código funcional de WebRTC.
2. **Configurar el repositorio en GitHub:**
   - Asegurarse de que en la configuración del repositorio el fork tenga habilitadas las pestañas de *Issues* y *Discussions*.
   - Establecer la descripción breve: *"Community fork of Deskreen: Ultra-low latency secondary displays and AI consoles over WebRTC with HWND focus lock."*
3. **Decisión sobre etiquetado (Tagging):** Si se desea publicar una versión de lanzamiento oficial, crear la etiqueta `v3.2.16` únicamente después de fusionar esta rama en la rama principal.
