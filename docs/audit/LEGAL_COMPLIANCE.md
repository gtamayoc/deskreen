# Dictamen de Cumplimiento Jurídico, Licencias y Propiedad Intelectual: Deskreen CE

**Fecha de evaluación:** 13 de octubre de 2026  
**Proyecto:** Deskreen Community Edition (Deskreen CE)  
**Licencia rectora:** GNU Affero General Public License v3.0 (AGPL-3.0)  
**Clasificación legal:** Bifurcación (fork) de software libre con modernización comunitaria  
**Documento base:** `C:\discolocal\PROYECTOS\PYTHON\SCREEN\LICENSE`

---

## 1. Naturaleza Jurídica del Código Base y Licencia Principal

### 1.1. Régimen de GNU AGPL-3.0
Deskreen fue publicado originalmente por **Pavlo (Paul) Buidenkov** bajo la licencia de copyleft recíproco estricto **GNU Affero General Public License versión 3 (AGPL-3.0)**.
- **Inmutabilidad de la licencia:** Conforme a la sección 5 y 10 de AGPL-3.0, toda obra derivada o modificación del programa debe distribuirse obligatoriamente bajo los términos exactos de la GNU AGPL-3.0. No es jurídicamente admisible relicenciar unilateralmente el proyecto bajo licencias permisivas (como MIT o Apache-2.0) ni cerrar el código de las mejoras.
- **Preservación del texto íntegro:** El repositorio conserva el archivo `LICENSE` oficial de la Free Software Foundation (662 líneas, hash de verificación conforme).

### 1.2. Cadena de Atribución y Avisos de Derechos de Autor
- **Titularidad preexistente:** Pavlo Bilida conserva los derechos morales y patrimoniales originarios sobre el código fuente creado hasta la versión 1.0.11/2.0.4.
- **Obligación de conservar avisos:** La sección 4 y 5.a de AGPL-3.0 exigen expresamente que cada archivo modificado conserve todos los avisos de copyright preexistentes y contenga avisos destacados que indiquen que el archivo fue modificado, junto con la fecha de cambio.
- **Atribución comunitaria legítima:** Las nuevas modificaciones desarrolladas en Deskreen CE (modernización a Electron 37, React 19, Target Window Handle Lock, USB ADB auto-reconnect, temas accesibles) constituyen contribuciones comunitarias cuyos derechos de autor corresponden a sus respectivos autores, cedidas a la comunidad bajo la misma licencia GNU AGPL-3.0.

---

## 2. Obligaciones Cruciales de Distribución y Red

### 2.1. Obligación de Código Fuente Correspondiente (Sección 6)
Al distribuir binarios precompilados (instaladores `.exe`, `.dmg`, `.AppImage`), Deskreen CE debe:
1. Acompañar el ejecutable con el código fuente completo correspondiente legible por máquina, O
2. Proporcionar una oferta por escrito válida y destacada (o un enlace directo en el sitio/README) que conduzca a un repositorio público (ej. `https://github.com/gtamayoc/deskreen`) donde el código fuente exacto esté disponible sin costo adicional.

### 2.2. Interacción Remota a través de Red Informática (Sección 13 de AGPL-3.0)
La sección 13 constituye la cláusula distintiva de la licencia AGPL frente a la GPL estándar:
> *"Notwithstanding any other provision of this License, if you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network [...] an opportunity to receive the Corresponding Source of your version by providing access to the Corresponding Source from a network server at no charge..."*

**Aplicación técnica a Deskreen CE:**
- Deskreen ejecuta un servidor HTTP Koa y señalización WebSocket que sirve la interfaz web `client-viewer` a teléfonos, tabletas o computadores clientes dentro de la red local o VPN.
- Por tanto, el usuario que visualiza y controla la pantalla desde su celular está interactuando remotamente con el programa a través de una red informática.
- **Acción de cumplimiento obligatoria:** La interfaz de usuario del visor cliente (`client-viewer`) debe incluir de manera discreta pero accesible (ej. en el pie de página, panel de configuración o menú de ayuda) un enlace directo que permita a cualquier usuario remoto descargar o inspeccionar el código fuente del proyecto en GitHub.

---

## 3. Régimen de Marcas Registradas y Deslinde de Identidad

### 3.1. Principio de Separación: Licencia de Software vs Derechos de Marca
El otorgamiento de derechos de explotación sobre el software bajo AGPL-3.0 **no transfiere derechos sobre marcas comerciales** (conforme a la Sección 7.e de AGPL-3.0). El nombre "Deskreen" y sus logotipos asociados identifican comercialmente el proyecto original de Pavlo Bilida y el servicio en `deskreen.com`.

### 3.2. Doctrina del Uso Nominativo Justo (Fair Use)
El uso del término "Deskreen" en esta bifurcación es legalmente admisible bajo las siguientes directrices estrictas:
1. **Uso meramente descriptivo y nominativo:** Exclusivamente para señalar el origen del software del que parte la bifurcación ("Deskreen Community Edition", "Fork comunitario de Deskreen").
2. **Prohibición de inducir a error:** No se debe dar a entender que el proyecto está respaldado, patrocinado, certificado u oficialmente afiliado a Pavlo Bilida ni a `deskreen.com`.
3. **Identidad visual diferenciada:** Deskreen CE debe emplear un logotipo, paleta e imaginería vectoriales completamente originales (ver `BRAND_GUIDELINES.md`), evitando calcar el imagotipo de Deskreen original.
4. **Preservación técnica interna:** Mantener `"name": "deskreen"` internamente en `package.json` responde estrictamente a la continuidad técnica de almacenamiento en disco del usuario (`appData/deskreen`), interoperabilidad de configuración y empaquetado, lo cual es admisible y estándar en forks de código abierto.

---

## 4. Inventario de Licencias de Terceros y Compatibilidad

Todas las bibliotecas principales incorporadas al proyecto han sido analizadas respecto a su compatibilidad de redistribución con GNU AGPL-3.0:

| Paquete / Módulo | Licencia Declarada | Compatibilidad con AGPL-3.0 | Observaciones / Requisitos |
| :--- | :--- | :--- | :--- |
| `electron` (37.9.0) | MIT | Totalmente compatible | Conservar aviso de copyright de Electron en bundle |
| `react` / `react-dom` (19.2.0) | MIT | Totalmente compatible | Licencia permisiva estándar de Meta |
| `vite` / `electron-vite` | MIT | Totalmente compatible | Herramienta de compilación |
| `@blueprintjs/core` (6.3.4) | Apache-2.0 | Compatible | Se aplican condiciones de atribución de Apache 2.0 |
| `koa` / `koa-router` / `kcors` | MIT | Totalmente compatible | Servidor HTTP de señalización local |
| `socket.io` / `socket.io-client` | MIT | Totalmente compatible | Mensajería de señalización |
| `simple-peer` (9.11.1) | MIT | Totalmente compatible | Capa WebRTC P2P |
| `node-forge` (1.3.1) | BSD-3-Clause / GPL | Totalmente compatible | Criptografía E2E (autorizada bajo BSD/GPL) |
| `@devicefarmer/adbkit` (3.3.9) | Apache-2.0 | Compatible | Comunicación USB local con dispositivos Android |
| `i18next` / `react-i18next` | MIT | Totalmente compatible | Motor de internacionalización |

**Conclusión de compatibilidad:** No existe ninguna incompatibilidad de licencias detectada en las dependencias de producción. No se incorporan componentes con licencias privativas, restrictivas o incompatibles con copyleft.

---

## 5. Marco Legal Aplicable, Privacidad y Responsabilidad

### 5.1. Legislación Colombiana e Internacional
- **Propiedad Intelectual (Colombia - Ley 23 de 1982 y Decisión Andina 351 de 1993):** Reconoce el software como obra literaria. Los derechos morales (paternidad e integridad) son irrenunciables, por lo que la atribución a Pavlo Bilida es obligatoria, mientras que los derechos de transformación son lícitos bajo la autorización previa otorgada por la licencia AGPL-3.0.
- **Protección de Datos (Ley 1581 de 2012 / RGPD):** Deskreen CE opera bajo un modelo de arquitectura local descentralizada (Peer-to-Peer). La aplicación **no recolecta, almacena ni transmite datos personales o biométricos a servidores centrales**, ni recopila capturas de pantalla de los usuarios. Todo el tráfico de video y control remoto fluye cifrado en la red local del usuario.

### 5.2. Cláusula de Descargo de Garantías (Artículos 15 y 16 AGPL-3.0)
El software se suministra *"TAL CUAL"* ("AS IS"), sin garantías de ningún tipo, expresas o implícitas, incluidas, entre otras, las garantías de comerciabilidad o idoneidad para un propósito determinado. En ningún caso los autores o colaboradores serán responsables de daños directos, indirectos o consecuentes derivados del uso del software.

---

## 6. Asuntos Pendientes y Recomendaciones Finales

1. **Revisión formal de marcas:** Si en el futuro se planea publicar instaladores empaquetados en Microsoft Store o Mac App Store, se recomienda registrar formalmente el nombre comercial propio (ej. `ScreenDeck CE` o `DeskCompanion`) si se desea evitar cualquier potencial reclamación marcaria internacional.
2. **Exención de responsabilidad profesional:** Este informe constituye una auditoría técnica y jurídica preliminar de buenas prácticas de código abierto y no sustituye el dictamen vinculante de un abogado colegiado especializado en propiedad intelectual de la jurisdicción respectiva.
