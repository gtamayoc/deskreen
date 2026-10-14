# Soporte y Ayuda: Deskreen CE

Bienvenido a la página de soporte de **Deskreen Community Edition (Deskreen CE)**. Esta guía describe cómo resolver problemas comunes y cómo solicitar ayuda a la comunidad.

---

## 1. Preguntas Frecuentes y Solución Rápida de Problemas

### ¿Cómo obtengo una pantalla secundaria extendida real en Windows?
Windows no permite extender el escritorio hacia un monitor que no exista físicamente en tu tarjeta gráfica. Deskreen CE por defecto puede duplicar tus monitores existentes o compartir ventanas individuales de aplicaciones.  
Para tener un **monitor extendido virtual real**:
1. Instala el controlador de código abierto [`Virtual-Display-Driver`](https://github.com/itsmikethetech/Virtual-Display-Driver):
   ```powershell
   winget install --id=VirtualDrivers.Virtual-Display-Driver -e
   ```
2. O conecta un adaptador físico económico de emulación (**HDMI Dummy Plug**).
3. Selecciona la nueva pantalla extendida en Deskreen CE y comenzará a transmitirse inmediatamente a tu celular o tableta.

### ¿Puedo conectarme a través de Internet con datos móviles 4G/5G?
Deskreen CE está optimizado para funcionar dentro de la misma red local (Wi-Fi o cable Ethernet).  
Para conectarte desde redes móviles a través de Internet sin abrir puertos en tu router:
1. Instala **[Tailscale](https://tailscale.com/)** tanto en tu computador como en tu teléfono móvil (gratuito para uso personal).
2. En Deskreen CE, ve a *Ajustes* y selecciona la dirección IP de Tailscale (`100.x.y.z`).
3. Abre la URL en el navegador de tu celular con Tailscale encendido.

### ¿Por qué mi celular muestra una pantalla negra?
1. Verifica que el anfitrión haya otorgado permisos de captura de pantalla.
2. Si estás en Windows, Deskreen CE desactiva automáticamente las capturas WGC por estabilidad y utiliza DXGI/GDI.
3. Asegúrate de que el puerto de señalización (`3131`) no esté bloqueado por el Firewall de Windows.

### ¿Cómo reporto que dos consolas de terminal interfieren entre sí?
Deskreen CE implementa **Target Window Handle Lock (HWND Lock)**. Cada ventana de consola debe asignarse a un dispositivo móvil independiente. Si experimentas problemas de foco, verifica que la sesión esté vinculada a la terminal correspondiente en el panel de dispositivos.

---

## 2. Canales de Ayuda Comunitaria

- **Reportar un error técnico:** Abre un issue utilizando nuestra [plantilla de reporte de errores](https://github.com/gtamayoc/deskreen/issues/new?template=1-Bug_report.yml).
- **Solicitar una nueva funcionalidad:** Envía tu propuesta mediante la [plantilla de solicitud de funciones](https://github.com/gtamayoc/deskreen/issues/new?template=3-Feature_request.yml).
- **Problemas de seguridad:** Por favor consulta nuestra política de divulgación responsable en [SECURITY.md](SECURITY.md).

---

## 3. Alcance del Soporte Voluntario

Deskreen CE es un proyecto de código abierto mantenido por voluntarios. No existe un acuerdo de nivel de servicio (SLA) comercial. Hacemos nuestro mejor esfuerzo para responder a las solicitudes fundamentadas con información técnica detallada y pasos de reproducción claros.
