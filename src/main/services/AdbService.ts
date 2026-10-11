import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Adb from '@devicefarmer/adbkit';
import type { BrowserWindow } from 'electron';
import { IpcEvents } from '../../common/IpcEvents.enum';
import type {
	AdbAvailabilityStatus,
	AdbDeviceInfo,
} from '../../common/types/adb';
import { adbDownloaderService } from './AdbDownloaderService';

const execFileAsync = promisify(execFile);

export class AdbService {
	private client: ReturnType<typeof Adb.createClient> | null = null;
	private tracker: {
		on: (event: string, cb: (...args: unknown[]) => void) => void;
		end?: () => void;
	} | null = null;
	private resolvedAdbPath: string | null = null;
	private availabilitySource: 'system' | 'internal' | 'none' = 'none';
	private mainWindow: BrowserWindow | null = null;
	private connectedDevices = new Map<string, AdbDeviceInfo>();
	private reversedPorts = new Map<string, Set<number>>();
	private isInitialized = false;

	setMainWindow(window: BrowserWindow | null): void {
		this.mainWindow = window;
	}

	async checkAvailability(): Promise<AdbAvailabilityStatus> {
		// 1. Check system ADB (Priority 1)
		try {
			const { stdout } = await execFileAsync('adb', ['version']);
			this.resolvedAdbPath = 'adb';
			this.availabilitySource = 'system';
			return {
				available: true,
				source: 'system',
				path: 'adb',
				version: stdout.trim().split('\n')[0],
			};
		} catch {
			// System ADB not in PATH
		}

		// 2. Check internal isolated platform-tools (Priority 2)
		if (adbDownloaderService.isInternalAdbInstalled()) {
			const internalPath = adbDownloaderService.getInternalAdbBinaryPath();
			try {
				const { stdout } = await execFileAsync(internalPath, ['version']);
				this.resolvedAdbPath = internalPath;
				this.availabilitySource = 'internal';
				return {
					available: true,
					source: 'internal',
					path: internalPath,
					version: stdout.trim().split('\n')[0],
				};
			} catch {
				// Internal binary corrupted or incompatible
			}
		}

		this.resolvedAdbPath = null;
		this.availabilitySource = 'none';
		return {
			available: false,
			source: 'none',
		};
	}

	async init(): Promise<boolean> {
		const status = await this.checkAvailability();
		if (!status.available || !this.resolvedAdbPath) {
			console.log('[AdbService] ADB binary not available on host system.');
			return false;
		}

		try {
			this.client = Adb.createClient({
				bin: this.resolvedAdbPath === 'adb' ? undefined : this.resolvedAdbPath,
			});
			await this.startTracking();
			this.isInitialized = true;
			console.log(
				`[AdbService] Initialized successfully using ${this.availabilitySource} ADB.`,
			);
			return true;
		} catch (err) {
			console.warn('[AdbService] Failed to initialize ADB client:', err);
			return false;
		}
	}

	private async startTracking(): Promise<void> {
		if (!this.client) return;

		try {
			const tracker = await this.client.trackDevices();
			this.tracker = tracker;

			tracker.on('add', async (deviceUnknown: unknown) => {
				const device = deviceUnknown as { id: string; type: string };
				const info: AdbDeviceInfo = {
					id: device.id,
					type: device.type,
				};

				try {
					if (device.type === 'device') {
						const properties = await this.client?.getDevice(device.id).getProperties();
						if (properties) {
							info.model = properties['ro.product.model'];
							info.product = properties['ro.product.name'];
						}
					}
				} catch {
					// safe fallback if properties cannot be queried
				}

				this.connectedDevices.set(device.id, info);
				console.log(`[AdbService] Android device connected via USB: ${info.id} (${info.model || 'Unknown'})`);

				if (this.mainWindow && !this.mainWindow.isDestroyed()) {
					this.mainWindow.webContents.send(IpcEvents.AdbDeviceConnected, info);
				}
			});

			tracker.on('remove', (deviceUnknown: unknown) => {
				const device = deviceUnknown as { id: string; type: string };
				const info = this.connectedDevices.get(device.id) || {
					id: device.id,
					type: 'offline',
				};
				this.connectedDevices.delete(device.id);
				this.reversedPorts.delete(device.id);
				console.log(`[AdbService] Android device disconnected from USB: ${device.id}`);

				if (this.mainWindow && !this.mainWindow.isDestroyed()) {
					this.mainWindow.webContents.send(IpcEvents.AdbDeviceDisconnected, info);
				}
			});

			tracker.on('end', () => {
				console.log('[AdbService] Device tracking ended.');
			});

			tracker.on('error', (err: unknown) => {
				console.error('[AdbService] Device tracker encountered error:', err);
			});
		} catch (err) {
			console.warn('[AdbService] Error while starting device tracker:', err);
		}
	}

	async setupReversePort(deviceId: string, port: number): Promise<boolean> {
		if (!this.client) return false;
		try {
			await this.client.getDevice(deviceId).reverse(`tcp:${port}`, `tcp:${port}`);
			if (!this.reversedPorts.has(deviceId)) {
				this.reversedPorts.set(deviceId, new Set());
			}
			this.reversedPorts.get(deviceId)?.add(port);
			console.log(`[AdbService] Successfully reversed tcp:${port} -> tcp:${port} for ${deviceId}`);
			return true;
		} catch (err) {
			console.error(`[AdbService] Failed to reverse port ${port} on ${deviceId}:`, err);
			return false;
		}
	}

	async removeReversePort(deviceId: string, port: number): Promise<boolean> {
		if (!this.client) return false;
		try {
			if (this.resolvedAdbPath) {
				await execFileAsync(this.resolvedAdbPath, ['-s', deviceId, 'reverse', '--remove', `tcp:${port}`]);
			} else {
				const dev = this.client.getDevice(deviceId) as unknown as {
					reverseRemove?: (p: string) => Promise<void>;
				};
				await dev.reverseRemove?.(`tcp:${port}`);
			}
			this.reversedPorts.get(deviceId)?.delete(port);
			console.log(`[AdbService] Removed reverse tcp:${port} on ${deviceId}`);
			return true;
		} catch {
			return false;
		}
	}

	async launchClientOnDevice(deviceId: string, url: string): Promise<boolean> {
		if (!this.client) return false;
		try {
			const command = `am start -a android.intent.action.VIEW -d "${url}"`;
			await this.client.getDevice(deviceId).shell(command);
			console.log(`[AdbService] Opened browser URL on device ${deviceId}: ${url}`);
			return true;
		} catch (err) {
			console.error(`[AdbService] Failed to launch client on device ${deviceId}:`, err);
			return false;
		}
	}

	getConnectedDevices(): AdbDeviceInfo[] {
		return Array.from(this.connectedDevices.values());
	}

	getStatus(): {
		initialized: boolean;
		source: 'system' | 'internal' | 'none';
		deviceCount: number;
	} {
		return {
			initialized: this.isInitialized,
			source: this.availabilitySource,
			deviceCount: this.connectedDevices.size,
		};
	}

	stop(): void {
		if (this.tracker) {
			try {
				this.tracker.end?.();
			} catch {
				// ignore
			}
			this.tracker = null;
		}
		this.connectedDevices.clear();
		this.reversedPorts.clear();
		this.isInitialized = false;
	}
}

export const adbService = new AdbService();
