# Política de Seguridad: Deskreen CE

La seguridad y la privacidad de las comunicaciones entre tu computadora y tus dispositivos móviles son fundamentales para **Deskreen Community Edition (Deskreen CE)**.

---

## 1. Versiones con Soporte de Seguridad

| Versión | Estado de Soporte |
| :--- | :--- |
| **1.0.x (Community Edition)** | :white_check_mark: Soportada activamente |
| < 1.0.0 (Upstream legacy 1.x / 2.x) | :x: Obsoleta / No soportada |

---

## 2. Reporte Responsable de Vulnerabilidades

Si descubres una vulnerabilidad de seguridad en Deskreen CE:
1. **NO publiques los detalles en una incidencia abierta de GitHub**, redes sociales o foros públicos.
2. Abre un informe de seguridad privado utilizando la función de **GitHub Private Vulnerability Reporting**:
   - Accede a: [https://github.com/gtamayoc/deskreen/security/advisories/new](https://github.com/gtamayoc/deskreen/security/advisories/new)
3. Proporciona:
   - Descripción detallada del hallazgo.
   - Pasos para reproducir la vulnerabilidad o prueba de concepto (PoC).
   - Componentes o plataformas afectadas (Windows, macOS, Linux, Viewer Web).

### Tiempo de Respuesta
- Confirmación de recepción: dentro de las **48 horas**.
- Evaluación preliminar y propuesta de mitigación: dentro de los **7 días calendario**.

---

## 3. Modelo de Seguridad y Buenas Prácticas del Usuario

- **Red Local Segura:** Deskreen CE está diseñado para operar en redes de área local protegidas o túneles cifrados punto a punto (como Tailscale). No expongas el puerto `3131` directamente a la Internet pública mediante reenvío de puertos (port forwarding) no autenticado.
- **Tokens de Sesión Únicos:** Cada sesión de compartición genera un identificador de sala aleatorio y cifrado criptográficamente mediante SHA-256.
- **Aislamiento de Electron:** La ventana de Electron opera con `contextIsolation: true` y una superficie IPC restringida.
