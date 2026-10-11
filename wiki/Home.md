# Deskreen Community Edition Developer Guide

Welcome to the **Deskreen Community Edition (Deskreen-CE)** developer wiki. This document serves as the comprehensive architectural reference, protocol specification, and contributor guide for Deskreen-CE.

---

## 1. System Architecture Overview

Deskreen-CE operates as a distributed multi-process Electron application paired with an embedded HTTP/WebSocket signaling server and a standalone client-viewer web application.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DESKREEN HOST (ELECTRON)                        │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │      Main Process     │◄─── IPC ───►│       Renderer Process     │  │
│  │ (Node.js / Electron)  │             │   (React 19 / Blueprint)   │  │
│  └──────────┬────────────┘             └─────────────┬──────────────┘  │
│             │                                        │                 │
│             ▼                                        ▼                 │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │ Embedded HTTP Server  │             │   WebRTC Helper Window     │  │
│  │ (Koa 3 + Socket.io 4) │             │  (DesktopCapturer Stream)  │  │
│  └──────────┬────────────┘             └─────────────┬──────────────┘  │
└─────────────┼────────────────────────────────────────┼─────────────────┘
              │                                        │
     HTTP & WebSocket Signaling               WebRTC Media Stream (SRTP)
              │                                        │
              ▼                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       REMOTE VIEWER (WEB CLIENT)                       │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   Client-Viewer Web Application                  │  │
│  │     (React 19 / Vite 7 / Socket.io JSON Relay / WebRTC SRTP)     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Components:

1. **Main Process (`src/main/`)**:
   - Manages application lifecycle, window management (`BrowserWindow`), and tray integration.
   - Registers IPC handlers (`src/main/helpers/ipcMainHandlers.ts`).
   - Initializes local storage (`PersistentStorage`) and source preferences (`SourcePreferenceService`).
   - Discovers network interfaces and launches the embedded server (`src/server/`).

2. **Renderer Process (`src/renderer/`)**:
   - Drives the desktop host user interface using React 19 and Blueprint v6.
   - Coordinates the connection flow (`DeskreenStepper`, `HomePage`).
   - Manages active sharing sessions and connected client devices.

3. **WebRTC Helper Window (`src/features/PeerConnectionHelperRendererService/`)**:
   - Runs a dedicated helper window that captures system display streams via `desktopCapturer.getSources`.
   - Manages WebRTC peer connections and media pipelines.

4. **Embedded Server & Signaling (`src/server/`)**:
   - Built on Koa 3 and Socket.io 4.
   - Serves pre-built static client-viewer bundles over local HTTP.
   - Coordinates peer discovery, room IDs, and WebRTC signaling handshakes.

5. **Client-Viewer Web App (`src/client-viewer/`)**:
   - Lightweight, responsive Vite 7 + React 19 application running in any modern mobile or desktop web browser.
   - Establishes Socket.io signaling and receives WebRTC streams from the host.
   - Renders low-latency video via standard HTML5 `<video>` elements.

---

## 2. WebRTC Streaming Engine & Protocol

### 2.1 Signaling Protocol & WebRTC Media Transport
All signaling traffic between the host and remote viewer is coordinated via **Socket.io JSON message relays**:
1. When a viewer connects, the host and viewer exchange session identifiers and signaling metadata over WebSocket/Socket.io JSON payloads (with URI-component-encoded text).
2. WebRTC signaling envelopes (SDP offers, SDP answers, ICE candidates) are relayed through the Socket.io signaling channel to establish peer-to-peer connectivity.
3. Once established, all media streams (desktop video) are encrypted and transported end-to-end using standard WebRTC DTLS-SRTP encryption directly between host and viewer.

### 2.2 Connection Auto-Approval Pipeline
Deskreen-CE incorporates an instant auto-approval mechanism:
- Upon receiving a connection request from a new viewer, `autoApprovalWorkflow` verifies the device's client fingerprint (IP, OS, browser) and approves the connection immediately without requiring user interaction with an "Allow Device" prompt.
- Network and Wi-Fi checking routines operate non-blockingly, preventing disconnection warnings or dialog traps during active streaming.

### 2.3 Screen Capture & Dynamic Track Swapping
- **Desktop Capture**: Host displays are captured via Electron's `desktopCapturer` API, which yields a `MediaStream` containing video tracks at native resolutions.
- **Dynamic Track Replacement**: When switching between screens or application windows (via `ChangeSourceModal` or remote viewer `SWITCH_SOURCE`), the system uses `replacePeerVideoTrack.ts` to replace the video track directly on active `RTCRtpSender` instances without tearing down or renegotiating the WebRTC peer connection.
- **In-Flight Bitrate Control**: SDP bitrate controls (`setSdpMediaBitrate.ts`) dynamically throttle bandwidth to maintain optimal frame rates on fluctuating wireless networks.

---

## 3. Persistent Display Preferences (`SourcePreferenceService`)

Deskreen-CE preserves user display choices across application restarts and client reconnects:
1. **Source Tracking**: Whenever a screen is selected (locally or via mobile `SWITCH_SOURCE`), the display ID and screen name are serialized to `deskreen-ce-storage.json` via `PersistentStorage`.
2. **Intelligent Fallback Hierarchy**:
   - If the saved `displayId` is present among connected monitors, it is immediately selected.
   - If the preferred monitor was unplugged, the engine matches by display name (e.g., "Screen 1" or "Entire screen").
   - If no match is found, the engine seamlessly falls back to the primary display (`display_id === ''` or index 0).

---

## 4. Client-Viewer Architecture & Accessibility

The client-viewer (`src/client-viewer/`) is designed for maximum performance, minimal battery consumption, and accessible usability:

- **Vertical Space Optimization**: All header branding and promotional logos have been eliminated to ensure controls and video viewports fit comfortably on compact mobile screens (375x667, 390x844) without unwanted scrolling.
- **Reactive Theme System**:
  - `ThemeProvider` dynamically detects OS preference via `window.matchMedia('(prefers-color-scheme: dark)')`.
  - Manual theme toggling updates the DOM instantly (`bp3-dark` class) and persists preference under `localStorage.getItem('deskreen_dark_mode')`.
  - Zero hardcoded inline background colors ensure immediate theme responsiveness.
- **WCAG 2.1 AA Accessibility**:
  - Contrast ratios for text meet or exceed 4.5:1 against both light and dark backgrounds.
  - Interactive controls maintain a minimum contrast ratio of 3.0:1 with distinct 2px focus rings.
  - Touch targets for all interactive buttons meet or exceed 40px in mobile viewports.

---

## 5. IPC Channels & Contracts (`IpcEvents`)

Key IPC events defined in `src/common/IpcEvents.enum.ts` and registered in `src/main/helpers/ipcMainHandlers.ts`:

| IPC Event Channel | Direction | Description |
|---|---|---|
| `CreateWaitingForConnectionSharingSession` | Renderer -> Main | Initializes a new sharing session waiting for incoming client connections. |
| `ResetWaitingForConnectionSharingSession` | Renderer -> Main | Cleans up pending sessions and resets server room tokens. |
| `GetDesktopSharingSourceIds` | Renderer -> Main | Enumerates available display and application window source IDs. |
| `ChangeDesktopCapturerSourceForSession` | Renderer -> Main | Switches the active capture source for a running peer connection. |
| `GetConnectedDevices` | Renderer -> Main | Returns the list of currently connected and authorized viewer devices. |
| `DisconnectDeviceById` | Renderer -> Main | Terminates a specific device's connection and cleans up peer resources. |
| `GetIsLinuxWaylandSession` | Renderer -> Main | Detects if the host environment is running Linux Wayland for portal capture. |
| `RequestDesktopCapturerPortalSource` | Renderer -> Main | Invokes the XDG Desktop Portal picker for Wayland screen streaming. |

---

## 6. Developer Workflows & Quality Verification

### 6.1 Prerequisites
- **Node.js**: `>= 22.6.0` (LTS) or `>= 23.x`
- **npm**: `>= 10.9.0`

### 6.2 Setup
```bash
# Clone the repository
git clone https://github.com/pavlobu/deskreen.git
cd deskreen

# Install root dependencies
npm install

# Install client-viewer dependencies
cd src/client-viewer
npm install
cd ../..
```

### 6.3 Development Mode
Launch hot-reloading dev servers for both the Electron shell and the client-viewer web application:
```bash
npm run dev
```

### 6.4 Verification Pipeline
Deskreen-CE requires all commits to pass the following quality verification commands:

```bash
# 1. TypeScript Strict Type Checking across all subprojects
npm run typecheck:client-viewer
npm run typecheck:node
npm run typecheck:web
npm run typecheck # Runs all three

# 2. Automated Regression Test Suite
npm test

# 3. Biome Linter and Formatter
npm run lint
npm run format
```

### 6.5 Building Executables
```bash
# Build production bundle and package for current platform
npm run build

# Package installers
npm run build:win      # Windows installer
npm run build:mac      # macOS DMG / zip
npm run build:linux    # Linux AppImage / deb / rpm
```
