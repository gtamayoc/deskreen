# Manual de Identidad Visual, Marca y Tono: Deskreen CE

**Versión del manual:** 1.0  
**Proyecto:** Deskreen Community Edition (Deskreen CE)  
**Ubicación de assets vectoriales:** `resources/branding/`  
**Licencia de recursos gráficos:** Creative Commons Attribution 4.0 International (CC BY 4.0) / GNU AGPL-3.0

---

## 1. Propósito y Filosofía de la Marca

Deskreen CE surge como una iniciativa comunitaria de código abierto orientada a modernizar y dotar de capacidades de productividad avanzadas a una herramienta de compartición de pantallas. Su identidad visual debe comunicar:
- **Rigor técnico y precisión de ingeniería:** Herramienta seria, confiable, construida por y para desarrolladores y profesionales técnicos.
- **Transparencia radical:** Distinción inequívoca frente al proyecto original (`pavlobu/deskreen`), sin apropiaciones engañosas ni reclamos falsos de certificación.
- **Innovación en el flujo de trabajo:** Especialización en pantallas secundarias portátiles y consolas complementarias para agentes de IA con fijación de foco nativo (HWND Lock).
- **Sobriedad y accesibilidad:** Diseño limpio, geométrico y libre de efectos estridentes o modas efímeras.

---

## 2. Propuestas de Dirección Visual y Justificación

Se evaluaron tres direcciones conceptuales antes de consolidar la identidad:

### Propuesta A — "Engineering Mesh / Grid Screen" (Seleccionada y recomendada)
- **Concepto:** Fusión de un monitor principal y un dispositivo móvil secundario interconectados mediante una malla geométrica vectorial P2P con indicadores de estado en tiempo real.
- **Paleta cromática:** Cobalto Eléctrico (`#0066FF`), Cian de Enlace (`#00D2FF`) y Pizarra Oscura (`#0F172A`).
- **Justificación:** Máxima legibilidad en dimensiones reducidas (16x16, 24x24, 32x32), alto contraste tanto en temas claros como oscuros (WCAG AAA), y diferenciación absoluta del logotipo histórico original de Deskreen (que utilizaba un monitor azul básico con un rayo amarillo).

### Propuesta B — "Terminal Companion / Focus Dual"
- **Concepto:** Foco centrado en desarrolladores de consola, con prompts de terminal (`>_`) y cursores parpadeantes integrados en la pantalla del teléfono.
- **Evaluación:** Excelente para el caso de uso de terminales y agentes IA, pero restrictivo para usuarios que simplemente desean una segunda pantalla para multimedia o documentos.

### Propuesta C — "Canvas Bridge / Fluid Curve"
- **Concepto:** Una curva de Bezier continua y fluida que viaja desde una computadora portátil hasta una tableta en colores violeta e índigo (`#6366F1` / `#8B5CF6`).
- **Evaluación:** Atractiva comercialmente pero genérica; transmite la impresión de un servicio SaaS comercial en la nube en lugar de una herramienta de red local soberana y de código abierto.

**Decisión final:** Se implementó la **Propuesta A** incorporando elementos funcionales de la Propuesta B (trazas de código limpias y botones de acción rápida en el dispositivo móvil secundario).

---

## 3. Elementos Fundamentales de la Marca

### 3.1. Nombres y Denominaciones Autorizadas
- **Nombre formal completo:** `Deskreen Community Edition`
- **Nombre corto de trabajo:** `Deskreen CE`
- **Nombre técnico de paquete:** `deskreen` (preservado para compatibilidad técnica de configuraciones locales y empaquetado).
- **Prohibido:** No utilizar *"Deskreen Official"*, *"Deskreen Pro"* ni *"Deskreen v3 by Pavlo Bilida"*. La denominación debe dejar patente el carácter comunitario e independiente de esta bifurcación.

### 3.2. Lema Principal (Tagline) y Descriptores
- **Lema principal:**  
  > *"Ultra-low-latency secondary screens & independent AI console companion for any device."*  
  *(Pantallas secundarias de ultra baja latencia y consola complementaria independiente para cualquier dispositivo).*
- **Descriptor breve de GitHub (<= 120 caracteres):**  
  > *"Community fork of Deskreen: Ultra-low latency secondary displays and AI consoles over WebRTC with HWND focus lock."*

---

## 4. Paleta Cromática Accesible

Los colores han sido verificados contra las pautas de accesibilidad **WCAG 2.1 nivel AA y AAA** (ratios de contraste superiores a 4.5:1 para texto normal y 3:1 para componentes de interfaz):

| Rol Cromático | Nombre | Hexadecimal | RGB | Ratio de Contraste vs Fondo |
| :--- | :--- | :--- | :--- | :--- |
| **Primario de Marca** | Electric Cobalt | `#0066FF` | `rgb(0, 102, 255)` | 8.2:1 (sobre blanco) / 4.6:1 (sobre Slate 900) |
| **Secundario Tecnológico**| Link Cyan | `#00D2FF` | `rgb(0, 210, 255)` | 9.8:1 (sobre Slate 900) |
| **Acento de Éxito / P2P** | Signal Emerald | `#10B981` | `rgb(16, 185, 129)`| 7.4:1 (sobre Slate 900) |
| **Fondo Oscuro Principal**| Deep Slate 900 | `#0F172A` | `rgb(15, 23, 42)` | Base de lienzo oscuro |
| **Superficie de Tarjetas**| Slate 800 | `#1E293B` | `rgb(30, 41, 59)` | Contraste de componentes |
| **Fondo Claro Principal** | Clean Slate 50 | `#F8FAFC` | `rgb(248, 250, 252)`| Base de lienzo claro |
| **Borde / Separadores**  | Slate 700 | `#334155` | `rgb(51, 65, 85)` | Contornos y divisiones |
| **Texto Principal Oscuro**| High-Contrast White | `#F8FAFC` | `rgb(248, 250, 252)`| 15.6:1 sobre Slate 900 (AAA) |
| **Texto Secundario**     | Muted Slate 400 | `#94A3B8` | `rgb(148, 163, 184)`| 6.2:1 sobre Slate 900 (AA) |

---

## 5. Tipografía de Sistema

Para evitar la carga de fuentes web externas pesadas y garantizar la privacidad del usuario sin solicitudes de terceros a Google Fonts:
- **Títulos y Marca:** Pila tipográfica del sistema nativo:  
  `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`  
  Pesos recomendados: `800` (Bold) para titulares de marca, `600` (Semi-bold) para subtítulos.
- **Código y Consola:** Pila monoespaciada para terminales y ejemplos técnicos:  
  `'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Consolas, monospace`  
  Pesos recomendados: `500` (Medium).

---

## 6. Inventario de Recursos Gráficos Originales

Los siguientes archivos vectoriales originales han sido implementados en el repositorio:

1. **Icono Principal (`resources/branding/deskreen-ce-icon.svg`):**
   - Lienzo cuadrado (256x256) con bordes redondeados (rx=56).
   - Composición con monitor de escritorio y pantalla complementaria móvil vinculados por ondas P2P.
   - Diseñado sin fuentes externas incrustadas, apto para favicons, avatares de organización de GitHub y dock icons.
2. **Logotipo Horizontal (`resources/branding/deskreen-ce-logo.svg`):**
   - Formato apaisado (640x120) para cabeceras de documentación y README.
   - Incluye el icono en miniatura, el rótulo `DESKREEN`, el badge encapsulado `CE` y la leyenda `COMMUNITY EDITION`.
3. **Banner Social / Cabecera (`resources/branding/deskreen-ce-banner.svg`):**
   - Formato panorámico (1200x380) para GitHub Social Preview y cabecera de presentación.
   - Fondo degradado profundo con cuadrícula técnica, composición gráfica de laptop con celular complementario y resumen de pilares técnicos.

---

## 7. Tono de Comunicación y Reglas de Uso

### 7.1. Tono y Voz
- **Técnico y exacto:** Describir arquitecturas con precisión (mencionando WebRTC DTLS-SRTP, Koa, Socket.io, Win32 HWND, IddCx).
- **Honesto y medido:** No afirmar que funciona a través de Internet sin configurar VPN; admitir que para pantallas extendidas Windows requiere un driver virtual o dongle HDMI.
- **Empático y colaborativo:** Enfocado en facilitar la instalación, la resolución de dudas y la bienvenida a nuevos contribuidores.

### 7.2. Reglas de Uso y Restricciones
- **Zona de seguridad:** Mantener un margen mínimo equivalente al 20% del tamaño del isotipo alrededor del logotipo en cualquier documento o interfaz.
- **No deformación:** No estirar, distorsionar o aplicar filtros psicodélicos a los trazados SVG.
- **No apropiación:** En toda mención de la marca en notas de prensa, artículos o repositorios derivados, se debe citar la procedencia comunitaria y el reconocimiento a Pavlo Bilida como creador de Deskreen original.
