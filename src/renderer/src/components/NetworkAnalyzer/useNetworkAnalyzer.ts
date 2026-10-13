import { useCallback, useEffect, useRef, useState } from 'react';
import { IpcEvents } from '../../../../common/IpcEvents.enum';

export type DevicePlatform =
	| 'android'
	| 'apple'
	| 'windows'
	| 'linux'
	| 'generic';

export type DeviceStatus = 'online' | 'connected' | 'busy' | 'unreachable';

export interface DiscoveredDevice {
	id: string; // unique identifier (IP, MAC, or ADB serial)
	name: string; // friendly hostname or model name
	ip: string; // IPv4 address
	platform: DevicePlatform;
	status: DeviceStatus;
	lastSeen: number; // timestamp ms
	adbAvailable?: boolean;
	adbPort?: number;
	mac?: string;
	services?: string[];
	txtRecords?: Record<string, string>;
	model?: string;
}

export interface DispatchResult {
	deviceId: string;
	success: boolean;
	url?: string;
	error?: string;
	adbStatus?: 'launched' | 'connected' | 'failed' | 'not_applicable';
	adbPort?: number;
	adbLaunched?: boolean;
	adbError?: string;
}

export interface UseNetworkAnalyzerReturn {
	devices: DiscoveredDevice[];
	selectedDeviceIds: Set<string>;
	isScanning: boolean;
	dispatchingDeviceIds: Set<string>;
	error: string | null;
	rescan: () => Promise<void>;
	toggleSelectDevice: (id: string) => void;
	selectAll: (selected: boolean) => void;
	dispatchSingle: (device: DiscoveredDevice) => Promise<DispatchResult>;
	dispatchBatch: (
		devicesToDispatch?: DiscoveredDevice[],
	) => Promise<DispatchResult[]>;
}

const POLLING_INTERVAL_MS = 2500;

export function useNetworkAnalyzer(): UseNetworkAnalyzerReturn {
	const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
	const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(
		new Set(),
	);
	const [isScanning, setIsScanning] = useState<boolean>(false);
	const [dispatchingDeviceIds, setDispatchingDeviceIds] = useState<Set<string>>(
		new Set(),
	);
	const [error, setError] = useState<string | null>(null);

	const isMountedRef = useRef<boolean>(true);

	const fetchDevices = useCallback(async (): Promise<void> => {
		try {
			if (typeof window === 'undefined' || !window.electron?.ipcRenderer) {
				return;
			}
			const result = (await window.electron.ipcRenderer.invoke(
				IpcEvents.NetworkGetDiscoveredDevices,
			)) as DiscoveredDevice[];

			if (isMountedRef.current && Array.isArray(result)) {
				setDevices(result);
				setError(null);
			}
		} catch (err) {
			if (isMountedRef.current) {
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg);
			}
		}
	}, []);

	const rescan = useCallback(async (): Promise<void> => {
		setIsScanning(true);
		try {
			if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
				await window.electron.ipcRenderer.invoke(IpcEvents.NetworkScanNow);
			}
			await fetchDevices();
		} catch (err) {
			if (isMountedRef.current) {
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg);
			}
		} finally {
			if (isMountedRef.current) {
				setIsScanning(false);
			}
		}
	}, [fetchDevices]);

	const toggleSelectDevice = useCallback((id: string): void => {
		setSelectedDeviceIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	const selectAll = useCallback(
		(selected: boolean): void => {
			if (!selected) {
				setSelectedDeviceIds(new Set());
			} else {
				setSelectedDeviceIds(new Set(devices.map((d) => d.id)));
			}
		},
		[devices],
	);

	const dispatchSingle = useCallback(
		async (device: DiscoveredDevice): Promise<DispatchResult> => {
			setDispatchingDeviceIds((prev) => new Set(prev).add(device.id));
			try {
				if (typeof window === 'undefined' || !window.electron?.ipcRenderer) {
					return {
						deviceId: device.id,
						success: false,
						error: 'Electron IPC unavailable',
					};
				}

				const res = (await window.electron.ipcRenderer.invoke(
					IpcEvents.DispatchUrlToDevice,
					{
						deviceId: device.id,
						ip: device.ip,
						platform: device.platform,
						adbPort: device.adbPort,
					},
				)) as {
					success: boolean;
					url?: string;
					error?: string;
					adbStatus?: 'launched' | 'connected' | 'failed' | 'not_applicable';
					adbPort?: number;
					adbLaunched?: boolean;
					adbError?: string;
				};

				return {
					deviceId: device.id,
					success: Boolean(res?.success),
					url: res?.url,
					error: res?.error,
					adbStatus: res?.adbStatus,
					adbPort: res?.adbPort,
					adbLaunched: res?.adbLaunched,
					adbError: res?.adbError,
				};
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return {
					deviceId: device.id,
					success: false,
					error: msg,
				};
			} finally {
				if (isMountedRef.current) {
					setDispatchingDeviceIds((prev) => {
						const next = new Set(prev);
						next.delete(device.id);
						return next;
					});
				}
			}
		},
		[],
	);

	const dispatchBatch = useCallback(
		async (
			devicesToDispatch?: DiscoveredDevice[],
		): Promise<DispatchResult[]> => {
			const targets =
				devicesToDispatch ?? devices.filter((d) => selectedDeviceIds.has(d.id));

			if (targets.length === 0) {
				return [];
			}

			const targetIds = targets.map((t) => t.id);
			setDispatchingDeviceIds((prev) => {
				const next = new Set(prev);
				for (const id of targetIds) {
					next.add(id);
				}
				return next;
			});

			try {
				if (typeof window === 'undefined' || !window.electron?.ipcRenderer) {
					return targets.map((t) => ({
						deviceId: t.id,
						success: false,
						error: 'Electron IPC unavailable',
					}));
				}

				const payload = {
					devices: targets.map((t) => ({
						deviceId: t.id,
						ip: t.ip,
						platform: t.platform,
						adbPort: t.adbPort,
					})),
				};

				const res = (await window.electron.ipcRenderer.invoke(
					IpcEvents.DispatchUrlToMultipleDevices,
					payload,
				)) as {
					results: Array<{
						deviceId: string;
						success: boolean;
						url?: string;
						error?: string;
						adbStatus?: 'launched' | 'connected' | 'failed' | 'not_applicable';
						adbPort?: number;
						adbLaunched?: boolean;
						adbError?: string;
					}>;
				};

				return res?.results || [];
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return targets.map((t) => ({
					deviceId: t.id,
					success: false,
					error: msg,
				}));
			} finally {
				if (isMountedRef.current) {
					setDispatchingDeviceIds((prev) => {
						const next = new Set(prev);
						for (const id of targetIds) {
							next.delete(id);
						}
						return next;
					});
				}
			}
		},
		[devices, selectedDeviceIds],
	);

	useEffect(() => {
		isMountedRef.current = true;
		void fetchDevices();

		const handleDevicesUpdated = (
			_event: unknown,
			updatedList: DiscoveredDevice[],
		): void => {
			if (isMountedRef.current && Array.isArray(updatedList)) {
				setDevices(updatedList);
				setError(null);
			}
		};

		if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
			window.electron.ipcRenderer.on(
				IpcEvents.NetworkDevicesUpdated,
				handleDevicesUpdated,
			);
		}

		const intervalId = setInterval(() => {
			void fetchDevices();
		}, POLLING_INTERVAL_MS);

		return () => {
			isMountedRef.current = false;
			clearInterval(intervalId);
			if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
				window.electron.ipcRenderer.removeListener(
					IpcEvents.NetworkDevicesUpdated,
					handleDevicesUpdated,
				);
			}
		};
	}, [fetchDevices]);

	return {
		devices,
		selectedDeviceIds,
		isScanning,
		dispatchingDeviceIds,
		error,
		rescan,
		toggleSelectDevice,
		selectAll,
		dispatchSingle,
		dispatchBatch,
	};
}
