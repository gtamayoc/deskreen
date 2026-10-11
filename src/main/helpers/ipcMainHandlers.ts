import {
	Display,
	ipcMain,
	BrowserWindow,
	screen,
	clipboard,
	shell,
	app,
	powerSaveBlocker,
} from 'electron';
import i18n from '../configs/i18next.config';
import { ConnectedDevicesService } from '../../features/ConnectedDevicesService';
import SharingSession from '../../features/SharingSessionService/SharingSession';
import RoomIDService from '../../server/RoomIDService';
import { signalingServer } from '../../server';
import { onDeviceConnectedCallback } from '../../server/onDeviceConnectedCallback';
import SharingSessionStatusEnum from '../../features/SharingSessionService/SharingSessionStatusEnum';
import getMyLocalIpV4, { getAvailableNetworkInterfaces } from './getMyLocalIpV4';
import isWifiConnected from './isWifiConnected';
import { getDeskreenGlobal } from './getDeskreenGlobal';
import { IpcEvents } from '../../common/IpcEvents.enum';
import { ElectronStoreKeys } from '../../common/ElectronStoreKeys.enum';
import { store } from '../../common/deskreen-electron-store';
import DesktopCapturerSourceType from '../../common/DesktopCapturerSourceType';
import isLinuxWaylandSession from '../utils/isLinuxWaylandSession';
import { checkScreenRecordingPermission } from './checkScreenRecordingPermission';
import {
	remoteInputInjectionService,
	type RemoteInputPayload,
} from '../services/RemoteInputInjectionService';
import { virtualDisplayService } from '../services/virtualDisplay/VirtualDisplayService';
import { adbService } from '../services/AdbService';
import { adbDownloaderService } from '../services/AdbDownloaderService';
import { deviceIdentityService } from '../services/DeviceIdentityService';
import type { DeviceSessionIdentity } from '../../common/types/adb';
import { isTerminalOrConsoleTitle } from '../../common/terminalDetection';
import { sourcePreferenceService } from '../services/SourcePreferenceService';


export const initIpcMainHandlers = (mainWindow: BrowserWindow): void => {
	ipcMain.on('client-changed-language', async (_, newLangCode) => {
		i18n.changeLanguage(newLangCode);
		if (store.has(ElectronStoreKeys.AppLanguage)) {
			if (store.get(ElectronStoreKeys.AppLanguage) === newLangCode) {
				return;
			}
			store.delete(ElectronStoreKeys.AppLanguage);
		}
		store.set(ElectronStoreKeys.AppLanguage, newLangCode);
	});

	ipcMain.handle('get-signaling-server-port', () => {
		if (mainWindow === null) return;
		mainWindow.webContents.send('sending-port-from-main', signalingServer.port);
	});

	ipcMain.handle('get-all-displays', () => {
		return screen.getAllDisplays();
	});

	ipcMain.handle('get-display-size-by-display-id', (_, displayID: string) => {
		const display = screen.getAllDisplays().find((d: Display) => {
			return `${d.id}` === displayID;
		});

		if (display) {
			return display.size;
		}
		return undefined;
	});

	ipcMain.handle(IpcEvents.GetIsLinuxWaylandSession, () => {
		return isLinuxWaylandSession;
	});

	ipcMain.handle(
		IpcEvents.RequestDesktopCapturerPortalSource,
		async (_, { mode }: { mode: 'screen' | 'window' }) => {
			const types =
				mode === 'window'
					? [DesktopCapturerSourceType.WINDOW]
					: [DesktopCapturerSourceType.SCREEN];

			if (!isLinuxWaylandSession) {
				await getDeskreenGlobal().desktopCapturerSourcesService.refreshDesktopCapturerSources();
				if (mode === 'window') {
					const sources =
						getDeskreenGlobal().desktopCapturerSourcesService.getAppWindowSources();
					return sources[0]?.id ?? null;
				}
				const sources =
					getDeskreenGlobal().desktopCapturerSourcesService.getScreenSources();
				return sources[0]?.id ?? null;
			}

			const source =
				await getDeskreenGlobal().desktopCapturerSourcesService.requestPortalSource(
					types,
				);
			return source?.id ?? null;
		},
	);

	ipcMain.handle('main-window-onbeforeunload', () => {
		const deskreenGlobal = getDeskreenGlobal();
		deskreenGlobal.connectedDevicesService = new ConnectedDevicesService();
		deskreenGlobal.roomIDService = new RoomIDService();
		deskreenGlobal.sharingSessionService.sharingSessions.forEach(
			(sharingSession: SharingSession) => {
				sharingSession.denyConnectionForPartner();
				sharingSession.destroy();
			},
		);

		deskreenGlobal.rendererWebrtcHelpersService.helpers.forEach(
			(helperWindow) => {
				helperWindow.close();
			},
		);

		deskreenGlobal.sharingSessionService.waitingForConnectionSharingSession =
			null;
		deskreenGlobal.rendererWebrtcHelpersService.helpers.clear();
		deskreenGlobal.sharingSessionService.sharingSessions.clear();
	});

	ipcMain.handle('get-latest-version', () => {
		return getDeskreenGlobal().latestAppVersion;
	});

	ipcMain.handle('get-current-version', () => {
		return getDeskreenGlobal().currentAppVersion;
	});

	ipcMain.handle('get-local-lan-ip', async () => {
		const deskreenGlobal = getDeskreenGlobal();
		if (deskreenGlobal.cliLocalIp) {
			return deskreenGlobal.cliLocalIp;
		}
		const ip = getMyLocalIpV4();
		return ip;
	});

	ipcMain.handle('check-wifi-connection', async () => {
		return isWifiConnected();
	});

	ipcMain.handle(IpcEvents.GetPort, () => {
		return signalingServer.port;
	});

	ipcMain.handle(IpcEvents.GetAppPath, () => {
		const deskreenGlobal = getDeskreenGlobal();
		return deskreenGlobal.appPath;
	});

	ipcMain.handle(IpcEvents.UnmarkRoomIDAsTaken, (_, roomID) => {
		const deskreenGlobal = getDeskreenGlobal();
		deskreenGlobal.roomIDService.unmarkRoomIDAsTaken(roomID);
	});

	async function createWaitingForConnectionSharingSession(
		roomID?: string,
	): Promise<void> {
		try {
			const deskreenGlobal = getDeskreenGlobal();
			if (
				deskreenGlobal.sharingSessionService
					.waitingForConnectionSharingSession !== null
			) {
				return;
			}
			if (!deskreenGlobal.connectedDevicesService.isSlotAvailable()) {
				return;
			}
			const waitingSession =
				await deskreenGlobal.sharingSessionService.createWaitingForConnectionSharingSession(
					roomID,
				);
			waitingSession.setOnDeviceConnectedCallback(onDeviceConnectedCallback);

			const initialSourceId =
				await sourcePreferenceService.resolveInitialSharingSource();
			waitingSession.setDesktopCapturerSourceID(initialSourceId);

			if (waitingSession.roomID) {
				adbService.setSessionInfo(signalingServer.port, waitingSession.roomID);
			}
		} catch (error) {
			console.error('Failed to create waiting sharing session', error);
		}
	}

	ipcMain.handle(
		IpcEvents.CreateWaitingForConnectionSharingSession,
		async (_, roomID?: string) => {
			await createWaitingForConnectionSharingSession(roomID);
		},
	);

	function resetWaitingForConnectionSharingSession(): void {
		const sharingSession =
			getDeskreenGlobal().sharingSessionService
				.waitingForConnectionSharingSession;
		const roomID = sharingSession?.roomID;
		sharingSession?.denyConnectionForPartner();
		sharingSession?.disconnectByHostMachineUser();
		sharingSession?.destroy();
		sharingSession?.setStatus(SharingSessionStatusEnum.NOT_CONNECTED);
		getDeskreenGlobal().sharingSessionService.sharingSessions.delete(
			sharingSession?.id as string,
		);
		if (roomID) {
			getDeskreenGlobal().roomIDService.unmarkRoomIDAsTaken(roomID);
		}
		getDeskreenGlobal().sharingSessionService.waitingForConnectionSharingSession =
			null;
	}

	ipcMain.handle(IpcEvents.ResetWaitingForConnectionSharingSession, () => {
		resetWaitingForConnectionSharingSession();
	});

	let powerSaveBlockerId: number | null = null;

	const updateSleepBlockerState = (): void => {
		const hasActiveDevices =
			getDeskreenGlobal().connectedDevicesService.getDevices().length > 0;
		if (hasActiveDevices) {
			if (
				powerSaveBlockerId === null ||
				!powerSaveBlocker.isStarted(powerSaveBlockerId)
			) {
				powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
			}
		} else if (
			powerSaveBlockerId !== null &&
			powerSaveBlocker.isStarted(powerSaveBlockerId)
		) {
			powerSaveBlocker.stop(powerSaveBlockerId);
			powerSaveBlockerId = null;
		}
	};

	const removeViewerAvailabilityListener =
		getDeskreenGlobal().connectedDevicesService.addAvailabilityListener(
			(state) => {
				updateSleepBlockerState();
				const isAvailable = state === 'available';
				const targetWindow = mainWindow?.isDestroyed() ? null : mainWindow;
				if (targetWindow) {
					targetWindow.webContents.send(
						IpcEvents.ViewerConnectionAvailabilityChanged,
						{
							isAvailable,
						},
					);
				}
				if (isAvailable) {
					void createWaitingForConnectionSharingSession();
				}
			},
		);

	mainWindow.on('closed', () => {
		removeViewerAvailabilityListener();
		if (
			powerSaveBlockerId !== null &&
			powerSaveBlocker.isStarted(powerSaveBlockerId)
		) {
			powerSaveBlocker.stop(powerSaveBlockerId);
			powerSaveBlockerId = null;
		}
	});

	ipcMain.handle(IpcEvents.SetDeviceConnectedStatus, () => {
		if (
			getDeskreenGlobal().sharingSessionService
				.waitingForConnectionSharingSession !== null
		) {
			const sharingSession =
				getDeskreenGlobal().sharingSessionService
					.waitingForConnectionSharingSession;
			sharingSession?.setStatus(SharingSessionStatusEnum.CONNECTED);
		}
	});

	ipcMain.handle(
		IpcEvents.GetSourceDisplayIDByDesktopCapturerSourceID,
		(_, sourceId) => {
			return getDeskreenGlobal().desktopCapturerSourcesService.getSourceDisplayIDByDisplayCapturerSourceID(
				sourceId,
			);
		},
	);

	ipcMain.handle(
		IpcEvents.DisconnectPeerAndDestroySharingSessionBySessionID,
		(_, sessionId) => {
			const sharingSession =
				getDeskreenGlobal().sharingSessionService.sharingSessions.get(
					sessionId,
				);
			if (sharingSession) {
				getDeskreenGlobal().connectedDevicesService.disconnectDeviceByID(
					sharingSession.deviceID,
				);
			}
			sharingSession?.disconnectByHostMachineUser();
			sharingSession?.destroy();
			getDeskreenGlobal().sharingSessionService.sharingSessions.delete(
				sessionId,
			);
		},
	);

	ipcMain.handle(
		IpcEvents.GetDesktopCapturerSourceIdBySharingSessionId,
		(_, sessionId) => {
			return getDeskreenGlobal().sharingSessionService.sharingSessions.get(
				sessionId,
			)?.desktopCapturerSourceID;
		},
	);

	ipcMain.handle(IpcEvents.GetConnectedDevices, () => {
		return getDeskreenGlobal().connectedDevicesService.getDevices();
	});

	ipcMain.handle(IpcEvents.GetViewerConnectionAvailability, () => {
		return getDeskreenGlobal().connectedDevicesService.isSlotAvailable();
	});

	ipcMain.handle(IpcEvents.DisconnectDeviceById, (_, id) => {
		getDeskreenGlobal().connectedDevicesService.disconnectDeviceByID(id);
	});

	ipcMain.handle(IpcEvents.DisconnectAllDevices, () => {
		getDeskreenGlobal().connectedDevicesService.disconnectAllDevices();
	});

	ipcMain.handle(IpcEvents.AppLanguageChanged, (_, newLang) => {
		if (store.has(ElectronStoreKeys.AppLanguage)) {
			store.delete(ElectronStoreKeys.AppLanguage);
		}
		store.set(ElectronStoreKeys.AppLanguage, newLang);
		getDeskreenGlobal().sharingSessionService.sharingSessions.forEach(
			(sharingSession) => {
				sharingSession?.appLanguageChanged();
			},
		);
		i18n.changeLanguage(newLang);
	});

	ipcMain.handle(IpcEvents.GetDesktopCapturerServiceSourcesMap, () => {
		const map =
			getDeskreenGlobal().desktopCapturerSourcesService.getSourcesMap();
		const res = {};

		for (const key of map.keys()) {
			const source = map.get(key);
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res[key] = {
				source: {
					thumbnail: source?.source.thumbnail?.toDataURL(),
					appIcon: source?.source.appIcon?.toDataURL(),
					name: source?.source.name,
				},
			};
		}
		return res;
	});

	ipcMain.handle(
		IpcEvents.GetDesktopCapturerServiceSourcesByIds,
		(_, ids: string[]) => {
			const map =
				getDeskreenGlobal().desktopCapturerSourcesService.getSourcesMap();
			const res = {};

			ids.forEach((id) => {
				const source = map.get(id);
				if (!source) return;
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				res[id] = {
					source: {
						thumbnail: source?.source.thumbnail?.toDataURL(),
						appIcon: source?.source.appIcon?.toDataURL(),
						name: source?.source.name,
					},
				};
			});
			return res;
		},
	);

	ipcMain.handle(
		IpcEvents.GetWaitingForConnectionSharingSessionSourceId,
		() => {
			return getDeskreenGlobal().sharingSessionService
				.waitingForConnectionSharingSession?.desktopCapturerSourceID;
		},
	);

	async function startSharingOnWaitingForConnectionSharingSession(): Promise<void> {
		const deskreenGlobal = getDeskreenGlobal();
		const { connectedDevicesService, sharingSessionService, roomIDService } =
			deskreenGlobal;
		if (!connectedDevicesService.isSlotAvailable()) {
			const waitingSession =
				sharingSessionService.waitingForConnectionSharingSession;
			waitingSession?.denyConnectionForPartner();
			waitingSession?.setStatus(SharingSessionStatusEnum.NOT_CONNECTED);
			sharingSessionService.waitingForConnectionSharingSession = null;
			connectedDevicesService.resetPendingConnectionDevice();
			return;
		}

		const pendingDevice = connectedDevicesService.pendingConnectionDevice;
		if (!pendingDevice.id) {
			return;
		}

		const sharingSession =
			sharingSessionService.waitingForConnectionSharingSession;
		if (sharingSession !== null) {
			roomIDService.unmarkRoomIDAsTaken(sharingSession.roomID);
		}

		try {
			connectedDevicesService.addDevice(pendingDevice);
		} catch (error) {
			console.error('failed to occupy single viewer slot', error);
			if (sharingSession !== null) {
				sharingSession.setStatus(SharingSessionStatusEnum.ERROR);
				sharingSession.denyConnectionForPartner();
				sharingSessionService.waitingForConnectionSharingSession = null;
			}
			connectedDevicesService.resetPendingConnectionDevice();
			return;
		}

		if (sharingSession !== null) {
			if (!sharingSession.desktopCapturerSourceID) {
				const fallbackSourceId =
					await sourcePreferenceService.resolveInitialSharingSource();
				if (fallbackSourceId) {
					sharingSession.setDesktopCapturerSourceID(fallbackSourceId);
				}
			}
			sharingSession.callPeer();
			sharingSession.setStatus(SharingSessionStatusEnum.SHARING);
			sharingSessionService.waitingForConnectionSharingSession = null;
		}

		connectedDevicesService.resetPendingConnectionDevice();
	}

	ipcMain.handle(
		IpcEvents.StartSharingOnWaitingForConnectionSharingSession,
		async () => {
			await startSharingOnWaitingForConnectionSharingSession();
		},
	);

	ipcMain.handle(IpcEvents.GetPendingConnectionDevice, () => {
		return getDeskreenGlobal().connectedDevicesService.pendingConnectionDevice;
	});

	ipcMain.handle(IpcEvents.GetWaitingForConnectionSharingSessionRoomId, () => {
		if (
			getDeskreenGlobal().sharingSessionService
				.waitingForConnectionSharingSession === null
		) {
			return undefined;
		}
		return getDeskreenGlobal().sharingSessionService
			.waitingForConnectionSharingSession?.roomID;
	});

	ipcMain.handle(
		IpcEvents.GetDesktopSharingSourceIds,
		async (_, { isEntireScreenToShareChosen }) => {
			if (isLinuxWaylandSession) {
				return [];
			}
			// ensure sources are up to date at request time
			await getDeskreenGlobal().desktopCapturerSourcesService.refreshDesktopCapturerSources();

			if (isEntireScreenToShareChosen === true) {
				return getDeskreenGlobal()
					.desktopCapturerSourcesService.getScreenSources()
					.map((source) => source.id);
			}
			return getDeskreenGlobal()
				.desktopCapturerSourcesService.getAppWindowSources()
				.map((source) => source.id);
		},
	);

	ipcMain.handle(IpcEvents.SetDesktopCapturerSourceId, async (_, id) => {
		getDeskreenGlobal().sharingSessionService.waitingForConnectionSharingSession?.setDesktopCapturerSourceID(
			id,
		);
		await sourcePreferenceService.saveSourcePreference(id);
	});

	ipcMain.handle(IpcEvents.GetIsFirstTimeAppStart, () => {
		if (store.has(ElectronStoreKeys.IsNotFirstTimeAppStart)) {
			return false;
		}
		return true;
	});

	ipcMain.handle(IpcEvents.SetAppStartedOnce, () => {
		if (store.has(ElectronStoreKeys.IsNotFirstTimeAppStart)) {
			store.delete(ElectronStoreKeys.IsNotFirstTimeAppStart);
		}
		store.set(ElectronStoreKeys.IsNotFirstTimeAppStart, 'true');
	});

	ipcMain.handle(IpcEvents.GetAppLanguage, () => {
		if (store.has(ElectronStoreKeys.AppLanguage)) {
			return store.get(ElectronStoreKeys.AppLanguage);
		}
		return 'en';
	});

	ipcMain.handle(IpcEvents.DestroySharingSessionById, (_, id) => {
		if (
			getDeskreenGlobal().sharingSessionService
				.waitingForConnectionSharingSession?.id === id
		) {
			getDeskreenGlobal().sharingSessionService.waitingForConnectionSharingSession =
				null;
		}
		const sharingSession =
			getDeskreenGlobal().sharingSessionService.sharingSessions.get(id);
		sharingSession?.setStatus(SharingSessionStatusEnum.DESTROYED);
		sharingSession?.destroy();
		getDeskreenGlobal().sharingSessionService.sharingSessions.delete(id);
	});

	ipcMain.handle(IpcEvents.OpenExternalLink, (_, url: string) => {
		if (typeof url !== 'string') {
			return;
		}
		shell.openExternal(url);
	});

	ipcMain.handle(IpcEvents.WriteTextToClipboard, (_, text) => {
		clipboard.writeText(text);
	});

	ipcMain.handle(IpcEvents.CheckScreenRecordingPermission, () => {
		return checkScreenRecordingPermission();
	});

	ipcMain.handle(IpcEvents.RelaunchApp, () => {
		app.relaunch();
		app.exit(0);
	});

	ipcMain.handle(IpcEvents.GetTrustedDevices, () => {
		try {
			const raw = store.get('trusted_devices');
			return raw ? (JSON.parse(raw) as string[]) : [];
		} catch {
			return [];
		}
	});

	ipcMain.handle(IpcEvents.AddTrustedDevice, (_, deviceFingerprint: string) => {
		try {
			const raw = store.get('trusted_devices');
			const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
			if (!list.includes(deviceFingerprint)) {
				list.push(deviceFingerprint);
				store.set('trusted_devices', JSON.stringify(list));
			}
			return true;
		} catch {
			return false;
		}
	});

	ipcMain.handle(IpcEvents.RemoveTrustedDevice, (_, deviceFingerprint: string) => {
		try {
			const raw = store.get('trusted_devices');
			let list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
			list = list.filter((id) => id !== deviceFingerprint);
			store.set('trusted_devices', JSON.stringify(list));
			return true;
		} catch {
			return false;
		}
	});

	ipcMain.handle(IpcEvents.IsDeviceTrusted, (_, deviceFingerprint: string) => {
		try {
			const raw = store.get('trusted_devices');
			const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
			return list.includes(deviceFingerprint);
		} catch {
			return false;
		}
	});

	ipcMain.handle(
		IpcEvents.ChangeDesktopCapturerSourceForSession,
		async (
			_,
			{
				sharingSessionId,
				sourceId,
			}: { sharingSessionId: string; sourceId: string },
		) => {
			const session =
				getDeskreenGlobal().sharingSessionService.sharingSessions.get(
					sharingSessionId,
				);
			if (session) {
				session.setDesktopCapturerSourceID(sourceId);
				await sourcePreferenceService.saveSourcePreference(sourceId);
				return true;
			}
			return false;
		},
	);

	ipcMain.handle(IpcEvents.GetAvailableNetworkInterfaces, () => {
		return getAvailableNetworkInterfaces();
	});

	ipcMain.handle(IpcEvents.GetSelectedNetworkInterface, () => {
		return store.get('selected_network_interface_ip') || 'auto';
	});

	ipcMain.handle(IpcEvents.SetSelectedNetworkInterface, (_, ip: string) => {
		store.set('selected_network_interface_ip', ip);
		return true;
	});

	ipcMain.handle(IpcEvents.GetCustomServerPort, () => {
		return store.get('custom_server_port') || '';
	});

	ipcMain.handle(IpcEvents.SetCustomServerPort, (_, port: string) => {
		store.set('custom_server_port', port);
		return true;
	});

	ipcMain.handle(IpcEvents.GetDeviceAliases, () => {
		try {
			const raw = store.get('device_aliases');
			return raw ? (JSON.parse(raw) as Record<string, string>) : {};
		} catch {
			return {};
		}
	});

	ipcMain.handle(
		IpcEvents.SetDeviceAlias,
		(_, { fingerprint, alias }: { fingerprint: string; alias: string }) => {
			try {
				const raw = store.get('device_aliases');
				const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
				if (alias && alias.trim()) {
					map[fingerprint] = alias.trim();
				} else {
					delete map[fingerprint];
				}
				store.set('device_aliases', JSON.stringify(map));
				return true;
			} catch {
				return false;
			}
		},
	);

	ipcMain.handle(
		IpcEvents.InjectRemoteConsoleInput,
		async (
			_,
			{
				sessionId,
				deviceFingerprint,
				payload,
			}: {
				sessionId?: string;
				deviceFingerprint?: string;
				payload: RemoteInputPayload;
			},
		) => {
			try {
				const rawBlocked = store.get('remote_control_blocked_devices');
				const blockedMap: Record<string, boolean> = rawBlocked
					? (JSON.parse(rawBlocked) as Record<string, boolean>)
					: {};
				if (deviceFingerprint && blockedMap[deviceFingerprint] === true) {
					console.warn(
						'[RemoteInput] Blocked input from unpermitted device:',
						deviceFingerprint,
					);
					return false;
				}
			} catch {
				// ignore parse error
			}

			if (sessionId) {
				const session =
					getDeskreenGlobal().sharingSessionService.sharingSessions.get(
						sessionId,
					);
				if (session?.desktopCapturerSourceID) {
					const sourceInfo =
						getDeskreenGlobal().desktopCapturerSourcesService.sources.get(
							session.desktopCapturerSourceID,
						);
					if (sourceInfo?.source?.name) {
						payload.targetWindowTitle = sourceInfo.source.name;
					}
				}
			}

			return remoteInputInjectionService.injectInput(payload);
		},
	);

	ipcMain.handle(
		IpcEvents.GetDeviceRemoteControlAllowed,
		(_, fingerprint: string) => {
			try {
				const rawBlocked = store.get('remote_control_blocked_devices');
				const blockedMap: Record<string, boolean> = rawBlocked
					? (JSON.parse(rawBlocked) as Record<string, boolean>)
					: {};
				return blockedMap[fingerprint] !== true;
			} catch {
				return true;
			}
		},
	);

	ipcMain.handle(
		IpcEvents.SetDeviceRemoteControlAllowed,
		(
			_,
			{
				fingerprint,
				allowed,
			}: { fingerprint: string; allowed: boolean },
		) => {
			try {
				const rawBlocked = store.get('remote_control_blocked_devices');
				const blockedMap: Record<string, boolean> = rawBlocked
					? (JSON.parse(rawBlocked) as Record<string, boolean>)
					: {};
				if (allowed) {
					delete blockedMap[fingerprint];
				} else {
					blockedMap[fingerprint] = true;
				}
				store.set(
					'remote_control_blocked_devices',
					JSON.stringify(blockedMap),
				);
				return true;
			} catch {
				return false;
			}
		},
	);

	ipcMain.handle(IpcEvents.GetVirtualDisplayStatus, () => {
		return virtualDisplayService.getStatus();
	});

	ipcMain.handle(IpcEvents.EnsureVirtualDisplay, async () => {
		return await virtualDisplayService.ensureVirtualDisplay();
	});

	ipcMain.handle(
		IpcEvents.MoveWindowToVirtualDisplay,
		async (_, windowTitle: string) => {
			return await virtualDisplayService.moveWindowToVirtualDisplay(windowTitle);
		},
	);

	ipcMain.handle(
		IpcEvents.RestoreWindowFromVirtualDisplay,
		async (_, windowTitle: string) => {
			return await virtualDisplayService.restoreWindow(windowTitle);
		},
	);

	adbService.setMainWindow(mainWindow);
	void adbService.init();

	ipcMain.handle(IpcEvents.AdbCheckAvailability, async () => {
		return await adbService.checkAvailability();
	});

	ipcMain.handle(IpcEvents.AdbGetStatus, () => {
		return adbService.getStatus();
	});

	ipcMain.handle(IpcEvents.AdbGetConnectedDevices, async () => {
		return await adbService.refreshConnectedDevices();
	});

	ipcMain.handle(
		IpcEvents.AdbSetupReverse,
		async (_, { deviceId, port }: { deviceId: string; port: number }) => {
			return await adbService.setupReversePort(deviceId, port);
		},
	);

	ipcMain.handle(
		IpcEvents.AdbLaunchUrl,
		async (_, { deviceId, url }: { deviceId: string; url: string }) => {
			return await adbService.launchClientOnDevice(deviceId, url);
		},
	);

	ipcMain.handle(IpcEvents.AdbDownloadBinaries, async () => {
		await adbDownloaderService.downloadAndInstall();
		return await adbService.init();
	});

	ipcMain.handle(
		IpcEvents.RegisterDeviceSessionToken,
		(_, identity: DeviceSessionIdentity) => {
			deviceIdentityService.registerSession(identity);
			return true;
		},
	);

	ipcMain.handle(
		IpcEvents.VerifyDeviceSessionToken,
		(
			_,
			{
				token,
				candidate,
			}: {
				token: string;
				candidate: {
					deviceId?: string;
					adbSerial?: string;
					deviceIP?: string;
				};
			},
		) => {
			return deviceIdentityService.verifySession(token, candidate);
		},
	);

	ipcMain.handle(IpcEvents.GetDeviceSessionToken, (_, token: string) => {
		return deviceIdentityService.getSession(token) ?? null;
	});

	ipcMain.handle(
		IpcEvents.GetSourceMetadataBySourceId,
		async (_, sourceId: string) => {
			if (!sourceId) {
				return { id: '', name: '', type: 'screen', isConsole: false };
			}
			const sourcesService =
				getDeskreenGlobal().desktopCapturerSourcesService;
			let sourceWithType = sourcesService.sources.get(sourceId);
			if (!sourceWithType) {
				try {
					await sourcesService.refreshDesktopCapturerSources();
					sourceWithType = sourcesService.sources.get(sourceId);
				} catch {
					// ignore
				}
			}
			const name = sourceWithType?.source?.name || '';
			const isScreen = sourceId.includes(DesktopCapturerSourceType.SCREEN);
			const type = isScreen
				? DesktopCapturerSourceType.SCREEN
				: DesktopCapturerSourceType.WINDOW;
			const isConsole = !isScreen && isTerminalOrConsoleTitle(name);

			return {
				id: sourceId,
				name,
				type,
				isConsole,
			};
		},
	);

	void createWaitingForConnectionSharingSession();
};
