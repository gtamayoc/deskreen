# Project: Deskreen PC UI & Navigation Dispatch Refactoring

## Architecture
- **Host UI (Renderer)**:
  - `src/renderer/src/containers/DeskreenStepper.tsx`: Hosts main connection flow. Renders `TopPanel` and intermediate steps (`IntermediateStep`, `SuccessStep`).
  - `src/renderer/src/components/TopPanel.tsx`: Header panel hosting controls.
  - `src/renderer/src/components/TopPanel.module.css`: Flexbox styling for header controls.
  - `src/renderer/src/components/NetworkAnalyzer/NetworkAnalyzerPanel.tsx`: Wi-Fi device discovery panel, active session banner, and device grid.
  - `src/renderer/src/components/NetworkAnalyzer/DeviceNavigationModal.tsx`: Interactive modal dialog for single-device navigation dispatch, direct link display, clipboard copy, and real-time ADB status.
  - `src/renderer/src/components/NetworkAnalyzer/useNetworkAnalyzer.ts`: React hook managing discovered devices, batch/single dispatch, and IPC bridge.
- **Main Process (IPC & Services)**:
  - `src/main/helpers/ipcMainHandlers.ts`: Implements `IpcEvents.DispatchUrlToDevice`, resolving dynamic mDNS ports, invoking `AdbService`, and returning rich dispatch telemetry.
  - `src/main/services/AdbService.ts`: Manages ADB device connections and URL intent launching via `am start`.
  - `src/main/services/NetworkDiscoveryService.ts`: Scans local network via mDNS/DNS-SD, extracts dynamic `adbPort` from SRV records (`_adb._tcp.local`).

## Feature Inventory
Every feature from the Survey phase must appear here with its assigned milestone. No feature may be left unassigned.
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1: Stepper Graphical Bar Removal | Remove visual `<Stepper>` component from `DeskreenStepper.tsx` while preserving internal functional screen selection and auto-approval state machine | Milestone 1 | Survey / ORIGINAL_REQUEST |
| 2 | R2: Header Centering without App Title | Remove 'Deskreen Community Edition' text and logo row in `TopPanel.tsx`, horizontally center all 5 control icons via `TopPanel.module.css` | Milestone 1 | Survey / ORIGINAL_REQUEST |
| 3 | R3: Prominent Connection Banner in NetworkAnalyzer | Add prominent banner in `NetworkAnalyzerPanel.tsx` displaying host IP, port, active session URL, 1-click 'Copiar URL completa' button, and `deskreen.local` reference | Milestone 1 | Survey / ORIGINAL_REQUEST |
| 4 | R4: Interactive Device Navigation Modal | Modal dialog shown when clicking 'Enviar Navegación' displaying direct device URL, copy button, and ADB wireless launch status | Milestone 1 | Survey / ORIGINAL_REQUEST |
| 5 | R4: Dynamic mDNS ADB Port Resolution in Backend | In `ipcMainHandlers.ts`, replace static port 5555 with dynamic mDNS port resolution cascade (`adbPort` -> deviceId -> cache -> 5555 fallback) and return rich ADB status | Milestone 1 | Survey / ORIGINAL_REQUEST |
| 6 | Quality & Test Suite Verification | Verify 100% passing tests (318+ tests), `npm run typecheck` across all 3 targets, and Biome linting | Milestone 2 | Survey / ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Refactor PC UI & Navigation Dispatch | Implement R1 (Stepper removal), R2 (TopPanel centering), R3 (NetworkAnalyzer IP/URL banner), and R4 (DeviceNavigationModal & dynamic mDNS ADB port in ipcMainHandlers) | none | DONE |
| 2 | Full Test & Adversarial Verification | Verify 100% test pass (353 tests), typecheck across all 3 targets, Biome linting, and adversarial coverage | M1 | DONE |

## Interface Contracts
### IPC Contract: `IpcEvents.DispatchUrlToDevice`
- **Request Payload**:
  ```typescript
  {
    deviceId: string;
    ip: string;
    platform: string;
    customRoomId?: string;
    adbPort?: number;
  }
  ```
- **Response Result**:
  ```typescript
  {
    success: boolean;
    url: string;
    error?: string;
    adbStatus?: 'launched' | 'connected' | 'failed' | 'not_applicable';
    adbPort?: number;
    adbLaunched?: boolean;
    adbError?: string;
  }
  ```

### Props Contract: `NetworkAnalyzerPanelProps`
```typescript
export interface NetworkAnalyzerPanelProps {
  onDeviceDispatched?: (device: DiscoveredDevice) => void;
  localIp?: string;
  port?: string | number;
  roomId?: string;
}
```

### Component Contract: `DeviceNavigationModalProps`
```typescript
export interface DeviceNavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: DiscoveredDevice | null;
  directUrl: string;
  isDispatching: boolean;
  status: 'idle' | 'dispatching' | 'success' | 'error';
  adbConnected?: boolean;
  adbLaunched?: boolean;
  error?: string;
}
```

## Code Layout
- `src/renderer/src/containers/DeskreenStepper.tsx` (Owned by M1)
- `src/renderer/src/components/TopPanel.tsx` (Owned by M1)
- `src/renderer/src/components/TopPanel.module.css` (Owned by M1)
- `tests/hostStepperAndContrastRegression.test.ts` (Owned by M1)
- `src/renderer/src/components/NetworkAnalyzer/NetworkAnalyzerPanel.tsx` (Owned by M2)
- `src/renderer/src/components/NetworkAnalyzer/DeviceNavigationModal.tsx` (Owned by M2)
- `src/renderer/src/components/NetworkAnalyzer/useNetworkAnalyzer.ts` (Owned by M2)
- `src/main/helpers/ipcMainHandlers.ts` (Owned by M2)
- `src/main/services/NetworkDiscoveryService.ts` (Owned by M2, if port refresh needed)
- `tests/networkAnalyzerBannerAndModal.test.ts` (Owned by M3)
- `tests/multiDeviceDispatch.test.ts` (Owned by M3)
