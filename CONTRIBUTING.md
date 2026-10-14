# Guía de Contribución para Deskreen CE

¡Gracias por tu interés en contribuir a **Deskreen Community Edition (Deskreen CE)**! Este es un proyecto de código abierto comunitario bajo la licencia **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Para mantener la estabilidad, confiabilidad y calidad del código, requerimos que todas las contribuciones sigan las pautas descritas en este documento.

---

## 1. Código de Conducta

Al participar en este proyecto, te comprometes a respetar y promover un ambiente abierto, respetuoso y libre de acoso según lo establecido en nuestro [Código de Conducta](CODE_OF_CONDUCT.md).

---

## 2. Flujo de Trabajo y Ramas

1. **Bifurca (Fork) el repositorio** en GitHub: `https://github.com/gtamayoc/deskreen`.
2. **Crea una rama de trabajo temática** a partir de la rama principal:
   ```bash
   git checkout -b feature/nombre-de-tu-mejora
   # o para corrección de errores:
   git checkout -b fix/descripcion-del-bug
   ```
3. Mantén los cambios enfocados: un Pull Request debe resolver un problema específico o añadir una característica concreta.

---

## 3. Configuración del Entorno de Desarrollo

El proyecto cuenta con dos raíces de paquetes independientes que deben ser instaladas:

```bash
# 1. Verificar versión de Node y npm (Node >= 22.6.0, npm >= 10.9.0)
node --version
npm --version

# 2. Instalar dependencias del anfitrión
npm install

# 3. Instalar dependencias del visor web
cd src/client-viewer
npm install
cd ../..
```

Para iniciar el entorno en modo desarrollo con recarga en caliente:
```bash
npm run dev
```

---

## 4. Estándares de Calidad Obligatorios (Quality Gates)

Antes de enviar cualquier Pull Request o realizar una confirmación (`commit`), debes verificar que se superen con éxito las tres puertas de calidad:

```bash
# 1. Comprobación estricta de tipos TypeScript en todos los targets
npm run typecheck

# 2. Análisis estático y verificación de formato con Biome
npm run lint

# 3. Suite completa de pruebas unitarias de Node.js
npm test
```

### Estilo de Código (Biome)
- **Indentación:** Tabulaciones (`tabs`).
- **Comillas:** Comillas simples (`'single quotes'`).
- **TypeScript:** Modo estricto activado. Evita `any` explícito siempre que sea posible.
- Puedes formatear automáticamente tu código ejecutando:
  ```bash
  npm run format
  ```

---

## 5. Convenciones de Commits

Utilizamos el estándar de **Conventional Commits**:
- `feat(componente): descripción de nueva característica`
- `fix(componente): corrección de error comprobable`
- `docs: mejoras o correcciones en la documentación`
- `test: adición o corrección de pruebas automatizadas`
- `refactor: cambio de estructura de código sin alterar comportamiento externo`
- `chore: tareas de mantenimiento de dependencias o configuración`

---

## 6. Preservación Legal y Licenciamiento

- Todo código aportado al proyecto se distribuirá bajo la **GNU AGPL-3.0**.
- **No elimines avisos de autoría existentes** en los encabezados de archivos preexistentes.
- Si incorporas bibliotecas o fragmentos externos, asegúrate de que su licencia sea compatible con AGPL-3.0 (ej. MIT, Apache 2.0, BSD-3-Clause) y documenta su procedencia.
- **No incluyas secretos:** Queda terminantemente prohibido incluir tokens de API, certificados privados, contraseñas o datos personales en el repositorio.

---

## 7. Proceso de Pull Request

1. Asegúrate de que `npm run typecheck`, `npm run lint` y `npm test` pasen al 100%.
2. Completa la lista de verificación en [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md).
3. Describe con claridad el problema solucionado y los pasos para reproducir o verificar manualmente el cambio.
4. El mantenedor revisará tu solicitud y te proporcionará retroalimentación constructiva.
