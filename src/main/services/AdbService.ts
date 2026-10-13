import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Adb from '@devicefarmer/adbkit';
import type { BrowserWindow } from 'electron';
import { IpcEvents } from '../../common/IpcEvents.enum';
import type {
	AdbAvailabilityStatus,
	AdbDeviceInfo,
} from '../../common/types/adb';
import SharingSessionStatusEnum from '../../features/SharingSessionService/SharingSessionStatusEnum';
import { getDeskreenGlobal } from '../helpers/getDeskreenGlobal';
import getMyLocalIpV4 from '../helpers/getMyLocalIpV4';
import { adbDownloaderService } from './AdbDownloaderService';

const execFileAsync = promisify(execFile);

type AdbClient = ReturnType<typeof Adb.createClient>;
type AdbTracker = Awaited<ReturnType<AdbClient['trackDevices']>>;

export class AdbService {
	private client: AdbClient | null = null;
	private tracker: AdbTracker | null = null;
	private resolvedAdbPath: string | null = null;
	private availabilitySource: 'system' | 'internal' | 'none' = 'none';
	private mainWindow: BrowserWindow | null = null;
	private connectedDevices = new Map<string, AdbDeviceInfo>();
	private reversedPorts = new Map<string, Set<number>>();
	private launchedSessions = new Set<string>();
	private gracePeriodTimers = new Map<string, NodeJS.Timeout>();
	private gracePeriodDevices = new Map<
		string,
		{ info: AdbDeviceInfo; disconnectedAt: number }
	>();
	private connectionSeq = new Map<string, number>();
	public gracePeriodDurationMs = 30000;
	public activeDeviceIds = new Set<string>();
	public deviceRoomIds = new Map<string, string>();
	private _currentRoomId = '';
	public currentPort = 0;
	public isInitialized = false;

	get activeDeviceId(): string | null {
		const first = this.activeDeviceIds.values().next();
		return first.done ? null : first.value;
	}
	set activeDeviceId(id: string | null) {
		this.activeDeviceIds.clear();
		if (id) {
			this.activeDeviceIds.add(id);
		}
	}

	get currentRoomId(): string {
		return (
			this._currentRoomId || this.deviceRoomIds.values().next().value || ''
		);
	}
	set currentRoomId(room: string) {
		this._currentRoomId = room;
	}

	setMainWindow(window: BrowserWindow | null): void {
		this.mainWindow = window;
	}

	setSessionInfo(port: number, roomID: string): void {
		this.currentPort = port;
		this.currentRoomId = roomID;
		console.log(
			`[AdbService] Session info updated: port=${port}, roomID=${roomID}`,
		);
		// Trigger reverse port and auto-launch only on new pending connected devices
		for (const dev of this.connectedDevices.values()) {
			const hasLaunched = Array.from(this.launchedSessions).some((key) =>
				key.startsWith(`${dev.id}:`),
			);
			if (!hasLaunched) {
				void this.handleDeviceConnected(dev);
			}
		}
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
			if (this.resolvedAdbPath) {
				try {
					await execFileAsync(this.resolvedAdbPath, ['start-server']);
				} catch (serverErr) {
					console.warn('[AdbService] Warning starting adb server:', serverErr);
				}
			}

			const adbModule = Adb as unknown as {
				createClient: (options?: { bin?: string }) => AdbClient;
				default?: { createClient: (options?: { bin?: string }) => AdbClient };
				Adb?: { createClient: (options?: { bin?: string }) => AdbClient };
			};
			const createClientFn =
				adbModule.createClient ||
				adbModule.default?.createClient ||
				adbModule.Adb?.createClient ||
				Adb.createClient;

			this.client = createClientFn({
				bin: this.resolvedAdbPath === 'adb' ? undefined : this.resolvedAdbPath,
			});

			await this.refreshConnectedDevices();

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
						const properties = await this.client
							?.getDevice(device.id)
							.getProperties();
						if (properties) {
							info.model = properties['ro.product.model'];
							info.product = properties['ro.product.name'];
						}
					}
				} catch {
					// safe fallback
				}

				this.connectedDevices.set(device.id, info);
				console.log(
					`[AdbService] Android device connected via USB: ${info.id} (${info.model || 'Unknown'})`,
				);

				void this.handleDeviceConnected(info);
			});

			tracker.on('change', async (deviceUnknown: unknown) => {
				const device = deviceUnknown as { id: string; type: string };
				console.log(
					`[AdbService] Device status changed: ${device.id} (${device.type})`,
				);
				if (device.type === 'device') {
					const info: AdbDeviceInfo = {
						id: device.id,
						type: device.type,
					};
					try {
						const properties = await this.client
							?.getDevice(device.id)
							.getProperties();
						if (properties) {
							info.model = properties['ro.product.model'];
							info.product = properties['ro.product.name'];
						}
					} catch {
						// safe fallback
					}
					this.connectedDevices.set(device.id, info);
					void this.handleDeviceConnected(info);
				}
			});

			tracker.on('remove', (deviceUnknown: unknown) => {
				const device = deviceUnknown as { id: string; type: string };
				this.handleDeviceDisconnected(device.id);
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

	private resolveCurrentPort(): number {
		if (this.currentPort > 0) return this.currentPort;
		return 3131;
	}

	public async resolveRoomIdForDevice(deviceId: string): Promise<string> {
		const existingRoomId = this.deviceRoomIds.get(deviceId);
		if (existingRoomId) {
			return existingRoomId;
		}

		try {
			const deskreenGlobal = getDeskreenGlobal();
			const sharingSessionService = deskreenGlobal.sharingSessionService;
			const waitingSession =
				sharingSessionService?.waitingForConnectionSharingSession;

			// Collect all room IDs that are actively streaming/connected to a device
			const streamingRoomIds = new Set<string>();
			for (const session of sharingSessionService?.sharingSessions?.values() ||
				[]) {
				if (
					session.status === SharingSessionStatusEnum.SHARING ||
					session.status === SharingSessionStatusEnum.CONNECTED
				) {
					if (session.roomID) streamingRoomIds.add(session.roomID);
				}
			}
			for (const [otherDevId, rid] of this.deviceRoomIds.entries()) {
				if (otherDevId !== deviceId) {
					streamingRoomIds.add(rid);
				}
			}

			// If waiting session exists, is not already streaming, and not reserved by another USB device
			if (
				waitingSession?.roomID &&
				!streamingRoomIds.has(waitingSession.roomID)
			) {
				this.deviceRoomIds.set(deviceId, waitingSession.roomID);
				return waitingSession.roomID;
			}

			// If waiting session is not available or occupied, provision a new one
			if (deskreenGlobal.connectedDevicesService?.isSlotAvailable()) {
				if (waitingSession && streamingRoomIds.has(waitingSession.roomID)) {
					sharingSessionService.waitingForConnectionSharingSession = null;
				}
				const newSession =
					await sharingSessionService?.createWaitingForConnectionSharingSession();
				if (newSession?.roomID) {
					this.deviceRoomIds.set(deviceId, newSession.roomID);
					return newSession.roomID;
				}
			}
		} catch (err) {
			console.warn('[AdbService] Error resolving room ID for device:', err);
		}

		if (this._currentRoomId) {
			return this._currentRoomId;
		}
		return '';
	}

	private resolveHostLanIp(): string {
		try {
			return getMyLocalIpV4() || '';
		} catch {
			return '';
		}
	}

	async handleDeviceConnected(info: AdbDeviceInfo): Promise<void> {
		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			this.mainWindow.webContents.send(IpcEvents.AdbDeviceConnected, info);
		}

		if (info.type !== 'device') return;

		const currentSeq = (this.connectionSeq.get(info.id) || 0) + 1;
		this.connectionSeq.set(info.id, currentSeq);

		// If the SAME device is reconnecting within the 30s grace period
		const wasInGracePeriod = this.isInGracePeriod(info.id);
		if (wasInGracePeriod) {
			this.cancelGracePeriod(info.id);
			console.log(
				`[AdbService] Device ${info.id} reconnected within 30s grace period. Resuming existing session.`,
			);
		}

		this.activeDeviceIds.add(info.id);
		this.connectedDevices.set(info.id, info);

		const port = this.resolveCurrentPort();
		const roomID = await this.resolveRoomIdForDevice(info.id);

		if (port > 0) {
			// Auto setup reverse port (force = true on reconnect to re-establish adb reverse tunnel)
			await this.setupReversePort(info.id, port, true);

			// Check sequence token and connection state to protect against rapid jitter / disconnect during await
			if (
				this.connectionSeq.get(info.id) !== currentSeq ||
				!this.connectedDevices.has(info.id) ||
				!this.activeDeviceIds.has(info.id)
			) {
				console.log(
					`[AdbService] Connection sequence superseded or device ${info.id} disconnected during reverse setup. Aborting launch.`,
				);
				return;
			}

			// Auto open browser on device ONLY if not already launched in this session
			if (roomID) {
				const launchKey = `${info.id}:${roomID}`;
				if (!this.launchedSessions.has(launchKey)) {
					this.launchedSessions.add(launchKey);
					const lanIp = this.resolveHostLanIp();
					const fallbackParam = lanIp ? `&fallbackHost=${lanIp}` : '';
					const usbUrl = `http://localhost:${port}/${roomID}?transport=usb${fallbackParam}`;
					console.log(
						`[AdbService] Automatically opening URL on Android device: ${usbUrl}`,
					);
					const launched = await this.launchClientOnDevice(info.id, usbUrl);
					// Re-check sequence token after launch await
					if (!launched && this.connectionSeq.get(info.id) === currentSeq) {
						this.launchedSessions.delete(launchKey);
					}
				} else {
					console.log(
						`[AdbService] Browser session already open on device ${info.id} for room ${roomID}. Keeping existing tab.`,
					);
				}
			}
		}
	}

	handleDeviceDisconnected(deviceId: string): void {
		// Invalidate any in-flight setupReversePort or launch operations for this device
		this.connectionSeq.set(
			deviceId,
			(this.connectionSeq.get(deviceId) || 0) + 1,
		);

		const info = this.connectedDevices.get(deviceId) ||
			this.gracePeriodDevices.get(deviceId)?.info || {
				id: deviceId,
				type: 'offline',
			};

		this.connectedDevices.delete(deviceId);
		this.reversedPorts.delete(deviceId);

		// If this is an active device or has a launched session, enter 30s grace period
		const hasActiveSession =
			this.activeDeviceIds.has(deviceId) ||
			Array.from(this.launchedSessions).some((key) =>
				key.startsWith(`${deviceId}:`),
			);

		if (hasActiveSession) {
			console.log(
				`[AdbService] Android device ${deviceId} disconnected. Entering 30s grace period without destroying session.`,
			);
			this.cancelGracePeriod(deviceId);

			this.gracePeriodDevices.set(deviceId, {
				info,
				disconnectedAt: Date.now(),
			});

			const timer = setTimeout(() => {
				this.onGracePeriodExpired(deviceId);
			}, this.gracePeriodDurationMs);
			timer.unref?.();

			this.gracePeriodTimers.set(deviceId, timer);
		} else {
			for (const key of Array.from(this.launchedSessions)) {
				if (key.startsWith(`${deviceId}:`)) {
					this.launchedSessions.delete(key);
				}
			}
		}

		console.log(
			`[AdbService] Android device disconnected from USB: ${deviceId}`,
		);

		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			this.mainWindow.webContents.send(IpcEvents.AdbDeviceDisconnected, {
				...info,
				inGracePeriod: hasActiveSession,
			});
		}
	}

	onGracePeriodExpired(deviceId: string): void {
		console.log(
			`[AdbService] Grace period (30s) expired for device ${deviceId}. Releasing session resources.`,
		);
		const timer = this.gracePeriodTimers.get(deviceId);
		if (timer) {
			clearTimeout(timer);
		}
		this.gracePeriodTimers.delete(deviceId);
		this.gracePeriodDevices.delete(deviceId);

		for (const key of Array.from(this.launchedSessions)) {
			if (key.startsWith(`${deviceId}:`)) {
				this.launchedSessions.delete(key);
			}
		}

		this.activeDeviceIds.delete(deviceId);
		this.deviceRoomIds.delete(deviceId);
		if (this.activeDeviceId === deviceId) {
			this._currentRoomId = '';
		}

		this.cleanupSessionForDevice(deviceId);

		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			this.mainWindow.webContents.send(IpcEvents.AdbDeviceDisconnected, {
				id: deviceId,
				type: 'offline',
				gracePeriodExpired: true,
			});
		}
	}

	cancelGracePeriod(deviceId: string): boolean {
		const timer = this.gracePeriodTimers.get(deviceId);
		if (timer) {
			clearTimeout(timer);
			this.gracePeriodTimers.delete(deviceId);
			this.gracePeriodDevices.delete(deviceId);
			return true;
		}
		return false;
	}

	isInGracePeriod(deviceId: string): boolean {
		return this.gracePeriodTimers.has(deviceId);
	}

	getGracePeriodRemainingMs(deviceId: string): number {
		const entry = this.gracePeriodDevices.get(deviceId);
		if (!entry) return 0;
		const elapsed = Date.now() - entry.disconnectedAt;
		return Math.max(0, this.gracePeriodDurationMs - elapsed);
	}

	cleanupSessionForDevice(deviceId: string): void {
		try {
			const deskreenGlobal = getDeskreenGlobal();
			if (!deskreenGlobal?.sharingSessionService) return;
			const deviceRoomId = this.deviceRoomIds.get(deviceId);

			for (const [
				sessionId,
				session,
			] of deskreenGlobal.sharingSessionService.sharingSessions.entries()) {
				if (
					(deviceId && session.deviceID === deviceId) ||
					(deviceRoomId && session.roomID === deviceRoomId)
				) {
					if (session.deviceID) {
						deskreenGlobal.connectedDevicesService?.disconnectDeviceByID(
							session.deviceID,
						);
					}
					session.disconnectByHostMachineUser();
					session.destroy();
					deskreenGlobal.sharingSessionService.sharingSessions.delete(
						sessionId,
					);
				}
			}

			const waitingSession =
				deskreenGlobal.sharingSessionService.waitingForConnectionSharingSession;
			if (
				waitingSession &&
				((deviceId && waitingSession.deviceID === deviceId) ||
					(deviceRoomId && waitingSession.roomID === deviceRoomId))
			) {
				const roomID = waitingSession.roomID;
				waitingSession.denyConnectionForPartner();
				waitingSession.disconnectByHostMachineUser();
				waitingSession.destroy();
				waitingSession.setStatus(SharingSessionStatusEnum.NOT_CONNECTED);
				if (waitingSession.id) {
					deskreenGlobal.sharingSessionService.sharingSessions.delete(
						waitingSession.id,
					);
				}
				if (roomID) {
					deskreenGlobal.roomIDService?.unmarkRoomIDAsTaken(roomID);
				}
				deskreenGlobal.sharingSessionService.waitingForConnectionSharingSession =
					null;
			}
		} catch (err) {
			console.warn(
				'[AdbService] Error cleaning up session resources for device:',
				err,
			);
		}
	}

	async setupReversePort(
		deviceId: string,
		port: number,
		force = false,
	): Promise<boolean> {
		if (!force && this.reversedPorts.get(deviceId)?.has(port)) {
			return true;
		}
		try {
			if (this.resolvedAdbPath) {
				await execFileAsync(this.resolvedAdbPath, [
					'-s',
					deviceId,
					'reverse',
					`tcp:${port}`,
					`tcp:${port}`,
				]);
			} else if (this.client) {
				await this.client
					.getDevice(deviceId)
					.reverse(`tcp:${port}`, `tcp:${port}`);
			}
			if (!this.reversedPorts.has(deviceId)) {
				this.reversedPorts.set(deviceId, new Set());
			}
			this.reversedPorts.get(deviceId)?.add(port);
			console.log(
				`[AdbService] Successfully reversed tcp:${port} -> tcp:${port} for ${deviceId}`,
			);
			return true;
		} catch (err: unknown) {
			const errMsg = String(err);
			if (errMsg.includes('cannot rebind') || errMsg.includes('already')) {
				if (!this.reversedPorts.has(deviceId)) {
					this.reversedPorts.set(deviceId, new Set());
				}
				this.reversedPorts.get(deviceId)?.add(port);
				return true;
			}
			console.warn(
				`[AdbService] Notice on reverse port ${port} on ${deviceId}:`,
				errMsg,
			);
			return false;
		}
	}

	async removeReversePort(deviceId: string, port: number): Promise<boolean> {
		try {
			if (this.resolvedAdbPath) {
				await execFileAsync(this.resolvedAdbPath, [
					'-s',
					deviceId,
					'reverse',
					'--remove',
					`tcp:${port}`,
				]);
			} else if (this.client) {
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

	async connectWifiDevice(
		ip: string,
		port = 5555,
	): Promise<{ success: boolean; deviceId?: string; error?: string }> {
		const endpoint = `${ip}:${port}`;
		try {
			if (!this.isInitialized || !this.resolvedAdbPath) {
				await this.init();
			}

			// If device is already connected and recognized
			const existing = this.connectedDevices.get(endpoint);
			if (existing && existing.type === 'device') {
				return { success: true, deviceId: endpoint };
			}

			// Execute adb connect with timeout
			const adbBin = this.resolvedAdbPath || 'adb';
			let timeoutHandle: NodeJS.Timeout | null = null;
			const connectPromise = execFileAsync(adbBin, ['connect', endpoint], {
				timeout: 8000,
			});
			const timeoutPromise = new Promise<{ stdout: string }>((_, reject) => {
				timeoutHandle = setTimeout(() => {
					reject(
						new Error(`ADB connect timeout (8s) connecting to ${endpoint}`),
					);
				}, 8000);
			});

			let output = '';
			try {
				const res = await Promise.race([connectPromise, timeoutPromise]);
				output = res.stdout || '';
			} catch (connErr) {
				const errMsg =
					connErr instanceof Error ? connErr.message : String(connErr);
				console.warn(
					`[AdbService] Error attempting adb connect to ${endpoint}:`,
					errMsg,
				);
				return { success: false, error: errMsg };
			} finally {
				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
					timeoutHandle = null;
				}
			}

			const lowerOutput = output.toLowerCase();
			if (
				lowerOutput.includes('connected to') ||
				lowerOutput.includes('already connected')
			) {
				await this.refreshConnectedDevices();
				return { success: true, deviceId: endpoint };
			}

			if (
				lowerOutput.includes('unable to connect') ||
				lowerOutput.includes('failed to connect') ||
				lowerOutput.includes('cannot connect')
			) {
				return {
					success: false,
					error: output.trim() || `Cannot connect to ${endpoint} via ADB Wi-Fi`,
				};
			}

			// Re-check refreshed connected devices
			const refreshed = await this.refreshConnectedDevices();
			const found = refreshed.find(
				(d) => d.id === endpoint && d.type === 'device',
			);
			if (found) {
				return { success: true, deviceId: endpoint };
			}

			return {
				success: false,
				error: output.trim() || `ADB connection to ${endpoint} unconfirmed`,
			};
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			console.warn('[AdbService] connectWifiDevice exception:', errMsg);
			return { success: false, error: errMsg };
		}
	}

	async launchClientOnDevice(deviceId: string, url: string): Promise<boolean> {
		try {
			// If device is a Wi-Fi endpoint (ip:port) and not yet connected, attempt connection first
			if (deviceId.includes(':') && !this.connectedDevices.has(deviceId)) {
				const [ip, portStr] = deviceId.split(':');
				const port = Number.parseInt(portStr, 10) || 5555;
				await this.connectWifiDevice(ip, port);
			}

			// Wake up screen if locked/sleeping (224 = KEYCODE_WAKEUP)
			try {
				if (this.resolvedAdbPath) {
					await execFileAsync(this.resolvedAdbPath, [
						'-s',
						deviceId,
						'shell',
						'input',
						'keyevent',
						'224',
					]);
				} else if (this.client) {
					await this.client.getDevice(deviceId).shell('input keyevent 224');
				}
			} catch {
				// Non-fatal if keyevent fails
			}

			if (this.resolvedAdbPath) {
				await execFileAsync(this.resolvedAdbPath, [
					'-s',
					deviceId,
					'shell',
					'am',
					'start',
					'-a',
					'android.intent.action.VIEW',
					'-d',
					url,
				]);
			} else if (this.client) {
				await this.client
					.getDevice(deviceId)
					.shell(`am start -a android.intent.action.VIEW -d "${url}"`);
			}
			console.log(
				`[AdbService] Opened browser URL on device ${deviceId}: ${url}`,
			);
			return true;
		} catch (err) {
			console.error(
				`[AdbService] Failed to launch client on device ${deviceId}:`,
				err,
			);
			return false;
		}
	}

	async refreshConnectedDevices(): Promise<AdbDeviceInfo[]> {
		if (!this.client) {
			const initialized = await this.init();
			if (!initialized || !this.client) {
				return [];
			}
		}

		try {
			const devices = await this.client.listDevices();
			const currentIds = new Set<string>();

			for (const dev of devices) {
				currentIds.add(dev.id);
				let info = this.connectedDevices.get(dev.id);
				const isNew = !info;
				const typeChanged = Boolean(info && info.type !== dev.type);
				if (isNew || typeChanged) {
					info = {
						id: dev.id,
						type: dev.type,
					};
					if (dev.type === 'device') {
						try {
							const properties = await this.client
								.getDevice(dev.id)
								.getProperties();
							if (properties) {
								info.model = properties['ro.product.model'];
								info.product = properties['ro.product.name'];
							}
						} catch {
							// safe ignore
						}
					}
					this.connectedDevices.set(dev.id, info);
					void this.handleDeviceConnected(info);
				}
			}

			for (const id of Array.from(this.connectedDevices.keys())) {
				if (!currentIds.has(id)) {
					this.handleDeviceDisconnected(id);
				}
			}
		} catch (err) {
			console.warn('[AdbService] Error refreshing connected devices:', err);
		}

		return Array.from(this.connectedDevices.values());
	}

	async getConnectedDevices(forceRefresh = false): Promise<AdbDeviceInfo[]> {
		if (forceRefresh || this.connectedDevices.size === 0) {
			return await this.refreshConnectedDevices();
		}
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
		for (const timer of this.gracePeriodTimers.values()) {
			clearTimeout(timer);
		}
		this.gracePeriodTimers.clear();
		this.gracePeriodDevices.clear();
		this.activeDeviceId = null;
		this.currentRoomId = '';
		this.connectionSeq.clear();
		this.launchedSessions.clear();
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
