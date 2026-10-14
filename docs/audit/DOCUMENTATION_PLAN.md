# Plan de Documentación y Gobernanza Comunitaria: Deskreen CE

**Fecha de emisión:** 13 de octubre de 2026  
**Proyecto:** Deskreen Community Edition (Deskreen CE)  
**Objetivo:** Establecer una arquitectura documental profesional, accesible y fáctica para la publicación pública del repositorio.

---

## 1. Justificación y Objetivos de la Reestructuración Documental

El repositorio histórico de Deskreen contenía documentación fragmentada, menciones a herramientas obsoletas (Yarn 1, Webpack, Electron React Boilerplate) y un `README.md` que omitía advertencias técnicas esenciales sobre la conectividad de red y los controladores de pantalla virtual en Windows.

El nuevo plan documental garantiza:
1. **Verificabilidad:** Ninguna afirmación en la documentación promete capacidades no implementadas o no demostradas.
2. **Onboarding rápido:** Nuevos colaboradores pueden clonar, instalar y compilar el proyecto en menos de 5 minutos utilizando `npm`.
3. **Cumplimiento legal transparente:** Visibilidad clara de las obligaciones de GNU AGPL-3.0, el acceso al código fuente correspondiente (art. 13) y la preservación de los derechos de autor originarios.
4. **Higiene comunitaria:** Plantillas de incidencias modernas en formato YAML que guían al usuario sin solicitar datos confidenciales ni emplear un tono restrictivo.

---

## 2. Inventario de Documentos Creados y Modificados

| Archivo | Acción Realizada | Justificación Técnica y Comunitaria | Audiencia Objetivo |
| :--- | :--- | :--- | :--- |
| `README.md` | Reescritura total | Estructura en 19 secciones estándar con diagramas Mermaid, identidad visual SVG, advertencias honestas sobre VDD/Tailscale e instrucciones de compilación probadas. | Usuarios generales, desarrolladores nuevos y evaluadores de software. |
| `CONTRIBUTING.md` | Creación | Directrices de desarrollo, flujo de ramas, estándares de Biome (tabulaciones/comillas simples), Conventional Commits y quality gates obligatorios. | Colaboradores de código abierto. |
| `CODE_OF_CONDUCT.md` | Actualización | Sustitución del correo electrónico personal de Pavlo Bilida por el canal de reporte de moderación del fork en GitHub. | Toda la comunidad del proyecto. |
| `SUPPORT.md` | Creación | Preguntas frecuentes técnicas (pantalla extendida con VDD, conexión móvil con Tailscale, pantalla negra) y canales de ayuda. | Usuarios finales y administradores de sistemas. |
| `SECURITY.md` | Creación | Política de divulgación responsable de vulnerabilidades, versiones con soporte activo y buenas prácticas de seguridad de red local. | Investigadores de seguridad y usuarios corporativos. |
| `CHANGELOG.md` | Actualización | Inserción de la versión `3.2.16 (Community Edition)` detallando los avances de modernización y HWND lock bajo el estándar Keep a Changelog. | Desarrolladores y usuarios interesados en la evolución del software. |
| `.github/ISSUE_TEMPLATE/1-Bug_report.yml` | Creación (reemplaza .md legado) | Formulario estructurado para reporte de bugs que previene fugas de direcciones IP privadas y elimina referencias anacrónicas a Yarn. | Usuarios que experimentan errores. |
| `.github/ISSUE_TEMPLATE/3-Feature_request.yml` | Creación (reemplaza .md legado) | Formulario estructurado para recepción constructiva de solicitudes y propuestas de funcionalidad. | Usuarios y desarrolladores con propuestas técnicas. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Creación | Lista de verificación de quality gates (`typecheck`, `lint`, `test`) y preservación de licencias para revisión ágil de PRs. | Desarrolladores que envían contribuciones. |
| `docs/audit/AUDIT_REPORT.md` | Creación | Matriz integral de hallazgos del estado inicial del repositorio. | Mantenedores y auditores técnicos. |
| `docs/audit/LEGAL_COMPLIANCE.md` | Creación | Dictamen jurídico sobre AGPL-3.0, marcas comerciales, código fuente correspondiente y descargo de garantías. | Mantenedores y asesores legales. |
| `docs/audit/BRAND_GUIDELINES.md` | Creación | Manual de identidad visual, colores WCAG AA/AAA, tipografías y reglas de uso de marca. | Diseñadores y desarrolladores de interfaz. |
| `docs/audit/DOCUMENTATION_PLAN.md` | Creación | Este plan estratégico de documentación. | Mantenedores y comunidad. |
| `docs/audit/SECURITY_REVIEW.md` | Creación (Fase F) | Auditoría de seguridad técnica de Electron, WebRTC y dependencias. | Mantenedores e ingenieros de seguridad. |
| `docs/audit/RELEASE_READINESS.md` | Creación (Fase J) | Checklist final de preparación para publicación pública. | Mantenedor y revisores. |
| `docs/audit/IMPLEMENTATION_SUMMARY.md` | Creación (Fase J) | Resumen fáctico de cambios y resultados de pruebas. | Mantenedor y revisores. |

---

## 3. Verificación de Rutas y Enlaces Cruzados

Todos los documentos locales utilizan enlaces Markdown relativos verificados contra la estructura de directorios real del repositorio.
- No se utilizan enlaces a rutas absolutas locales de la máquina de desarrollo (ej. `C:\...`) en archivos destinados al repositorio público.
- Los enlaces al código fuente apuntan consistentemente al repositorio del fork: `https://github.com/gtamayoc/deskreen`.
- Los enlaces de atribución histórica apuntan con respeto al creador original en `https://github.com/pavlobu/deskreen`.
