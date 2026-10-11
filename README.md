# Deskreen CE (Community Edition)

![platform](https://img.shields.io/badge/platform-Windows%20%7C%20MacOS%20%7C%20Linux-lightgrey)
![node](https://img.shields.io/badge/node-%3E%3D22.6.0%20(LTS)%20%7C%20%3E%3D23-green)
![license](https://img.shields.io/badge/license-AGPL--3.0-blue)

Deskreen Community Edition turns any device with a modern web browser (phone, tablet, laptop, or smart TV) into an ultra-low-latency secondary screen for your computer over local Wi-Fi or LAN.

Deskreen CE is a 100% free, community-maintained, open-source application built on **Electron 37**, **React 19**, **Vite 7**, and **WebRTC** with end-to-end encryption.

---

## Key Features & Capabilities

- **Instant Connection Auto-Approval**: Incoming client devices are automatically and instantaneously approved upon connection. No manual "Allow Device" dialogs or network/Wi-Fi check interruptions.
- **Default Entire Screen Auto-Streaming**: Immediately begins streaming the default entire screen upon device authorization, eliminating manual multi-step stepper wizards.
- **Persistent Display Preferences & Smart Fallback**: Automatically persists the user's preferred screen or monitor. Subsequent sessions restore the configured display, with seamless fallback to the primary display if a secondary monitor is unplugged.
- **Remote Source Switching (`SWITCH_SOURCE`)**: Viewers on mobile phones or tablets can dynamically switch between active monitors or application windows directly from the web client without needing physical access to the host computer.
- **Accessible & Optimized Client Viewer**:
  - Distraction-free interface with branding removed to maximize vertical screen real estate on mobile devices.
  - Fully reactive Dark and Light mode theme engine synchronized with system `prefers-color-scheme` or toggled manually, stored in `localStorage`.
  - Strict compliance with WCAG 2.1 AA accessibility contrast standards (>= 4.5:1 text, >= 3:1 controls) and touch targets of >= 40px.
- **End-to-End Encryption**: Peer video streams are secured with standard WebRTC DTLS-SRTP encryption.
- **Virtual Display Support**: Seamlessly pairs with virtual display drivers or dummy HDMI plugs to create true extended desktops.

---

## Prerequisites

- **Node.js**: `>= 22.6.0` (LTS) or `>= 23.x`
- **npm**: `>= 10.x`

---

## Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/pavlobu/deskreen.git
   cd deskreen
   ```

2. **Install root dependencies**:
   ```bash
   npm install
   ```

3. **Install client-viewer dependencies**:
   ```bash
   cd src/client-viewer
   npm install
   cd ../..
   ```

---

## Development & Running

### Hot-Reload Development Mode
Run both the host Electron app and the client-viewer Vite dev server concurrently with hot module replacement (HMR):
```bash
npm run dev
```

### Production Build & Preview
Build the production bundles and launch the packaged preview:
```bash
npm run build
npm run start
```

### Packaging Executables
- **Windows**: `npm run build:win`
- **macOS**: `npm run build:mac`
- **Linux**: `npm run build:linux`

---

## Quality Assurance & Verification

Deskreen CE maintains strict quality gates across all targets:

- **Type Checking (TypeScript 5.9)**:
  ```bash
  # Check all targets (client-viewer, node main process, renderer web)
  npm run typecheck

  # Individual target typechecks
  npm run typecheck:client-viewer
  npm run typecheck:node
  npm run typecheck:web
  ```

- **Automated Regression Test Suite (Node Native Test Runner)**:
  ```bash
  npm test
  ```

- **Static Analysis & Formatting (Biome 2.3.6)**:
  ```bash
  npm run lint     # Check for lint violations
  npm run format   # Format source files
  ```

---

## Starting with Custom Local IP

You can start Deskreen CE with a custom local IP address using the `--local-ip` or `--ip` CLI flag. This is useful when you want to specify a particular network interface IP address.

### macOS

```bash
# Using open command (recommended)
open -a "Deskreen CE" --args --ip 192.168.1.100

# Or using the executable directly
/Applications/Deskreen\ CE.app/Contents/MacOS/Deskreen\ CE --ip 192.168.1.100
```

### Windows

```powershell
# Using PowerShell Start-Process
Start-Process "Deskreen CE" -ArgumentList "--ip", "192.168.1.100"

# Or using the executable directly
"C:\Program Files\Deskreen CE\Deskreen CE.exe" --ip 192.168.1.100
```

### Linux

```bash
# If installed via AppImage
./Deskreen\ CE-*.AppImage --ip 192.168.1.100

# Or using package binary
deskreen-ce --ip 192.168.1.100
```

---

## Technology Stack & Credits

- **Application Shell**: [Electron 37](https://www.electronjs.org/) & [electron-vite](https://electron-vite.org/)
- **UI Framework**: [React 19](https://react.dev/)
- **Design System**: [Blueprint v6 (`@blueprintjs/core`)](https://blueprintjs.com/)
- **Bundler & Tooling**: [Vite 7](https://vitejs.dev/) & [TypeScript 5.9](https://www.typescriptlang.org/)
- **Linter & Formatter**: [Biome 2.3.6](https://biomejs.dev/)
- **Cryptography**: [node-forge](https://github.com/digitalbazaar/forge)
- **Signaling & Server**: [Koa 3](https://koajs.com/) & [Socket.io 4](https://socket.io/)
- **WebRTC Transport**: WebRTC W3C Standards & [simple-peer](https://github.com/feross/simple-peer)
- **ADB Automation**: [`@devicefarmer/adbkit`](https://github.com/devicefarmer/adbkit)

---

## Maintainer & License

- **Original Creator & Maintainer**: [Pavlo (Paul) Buidenkov](https://www.linkedin.com/in/pavlobu)
- **License**: AGPL-3.0 License © [Pavlo (Paul) Buidenkov](https://github.com/pavlobu/deskreen)
- Many thanks to all open source community members and maintainers whose libraries empower this project.
