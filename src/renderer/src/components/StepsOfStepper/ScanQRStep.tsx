import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SettingsContext } from '@renderer/contexts/SettingsContext';
import {
	Button,
	Callout,
	Text,
	Tooltip,
	Position,
	Classes,
	Icon,
} from '@blueprintjs/core';
import { Row, Col } from 'react-flexbox-grid';
import config from '../../../../common/config';
import { IpcEvents } from '../../../../common/IpcEvents.enum';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';

const { hostname } = config;

const ScanQRStep: React.FC = () => {
	const { t } = useTranslation();
	const { isDarkMode } = useContext(SettingsContext);
	const [clientViewerPort, setClientViewerPort] = useState('3131');

	const [isViewerSlotAvailable, setIsViewerSlotAvailable] = useState(true);
	const [roomID, setRoomID] = useState('');
	const [LOCAL_LAN_IP, setLocalLanIP] = useState('');
	const [usbDevice, setUsbDevice] = useState<{
		id: string;
		model?: string;
	} | null>(null);
	const usbDeviceRef = useRef<{
		id: string;
		model?: string;
		type?: string;
	} | null>(null);
	const [isAdbAvailable, setIsAdbAvailable] = useState<boolean | null>(null);

	useEffect(() => {
		usbDeviceRef.current = usbDevice;
	}, [usbDevice]);

	useEffect(() => {
		let isMounted = true;

		const checkAndSyncAdb = async (): Promise<void> => {
			try {
				const res = (await window.electron.ipcRenderer.invoke(
					IpcEvents.AdbCheckAvailability,
				)) as { available: boolean };
				if (!isMounted) return;
				const available = Boolean(res?.available);
				setIsAdbAvailable(available);

				if (available) {
					const devices = (await window.electron.ipcRenderer.invoke(
						IpcEvents.AdbGetConnectedDevices,
					)) as Array<{ id: string; model?: string; type?: string }>;
					if (!isMounted) return;
					if (devices && devices.length > 0) {
						const readyDev =
							devices.find((d) => d.type === 'device') || devices[0];
						setUsbDevice(readyDev);
						const port = Number(clientViewerPort);
						const isReadyWifi = Boolean(
							readyDev.id.includes(':') ||
								readyDev.id.includes('._tcp') ||
								readyDev.id.includes('adb-') ||
								/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(readyDev.id),
						);
						if (
							port &&
							port >= 1024 &&
							readyDev.type === 'device' &&
							!isReadyWifi
						) {
							if (usbDeviceRef.current?.id !== readyDev.id) {
								void window.electron.ipcRenderer.invoke(
									IpcEvents.AdbSetupReverse,
									{
										deviceId: readyDev.id,
										port,
									},
								);
							}
						}
					} else {
						setUsbDevice(null);
					}
				}
			} catch (err) {
				console.error('[ScanQRStep] Failed to sync ADB devices:', err);
			}
		};

		void checkAndSyncAdb();

		const handleAdbDeviceConnected = (
			_: unknown,
			dev: { id: string; model?: string; type?: string },
		) => {
			setUsbDevice(dev);
			const port = Number(clientViewerPort);
			const isDevWifi = Boolean(
				dev.id.includes(':') ||
					dev.id.includes('._tcp') ||
					dev.id.includes('adb-') ||
					/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(dev.id),
			);
			if (port && port >= 1024 && dev.type === 'device' && !isDevWifi) {
				if (usbDeviceRef.current?.id !== dev.id) {
					void window.electron.ipcRenderer.invoke(IpcEvents.AdbSetupReverse, {
						deviceId: dev.id,
						port,
					});
				}
			}
		};

		const handleAdbDeviceDisconnected = () => {
			setUsbDevice(null);
		};

		window.electron.ipcRenderer.on(
			IpcEvents.AdbDeviceConnected,
			handleAdbDeviceConnected,
		);
		window.electron.ipcRenderer.on(
			IpcEvents.AdbDeviceDisconnected,
			handleAdbDeviceDisconnected,
		);

		const interval = setInterval(() => {
			if (!usbDeviceRef.current) {
				void checkAndSyncAdb();
			}
		}, 3000);

		return () => {
			isMounted = false;
			clearInterval(interval);
			window.electron.ipcRenderer.removeListener(
				IpcEvents.AdbDeviceConnected,
				handleAdbDeviceConnected,
			);
			window.electron.ipcRenderer.removeListener(
				IpcEvents.AdbDeviceDisconnected,
				handleAdbDeviceDisconnected,
			);
		};
	}, [clientViewerPort]);

	useEffect(() => {
		window.electron.ipcRenderer
			.invoke(IpcEvents.GetPort)
			.then((port) => {
				return setClientViewerPort(port);
			})
			.catch((error) => {
				console.error('Failed to get port:', error);
			});
	}, []);

	useEffect(() => {
		let cancelled = false;
		window.electron.ipcRenderer
			.invoke(IpcEvents.GetViewerConnectionAvailability)
			.then((isAvailable: boolean) => {
				if (!cancelled) setIsViewerSlotAvailable(isAvailable);
			})
			.catch((err) => {
				console.error('Failed to check viewer availability:', err);
			});

		const handleAvailabilityChange = (
			_: unknown,
			isAvailable: boolean,
		): void => {
			if (!cancelled) {
				setIsViewerSlotAvailable(isAvailable);
			}
		};

		window.electron.ipcRenderer.on(
			IpcEvents.ViewerConnectionAvailabilityChanged,
			handleAvailabilityChange,
		);

		const syncInterval = setInterval(async () => {
			if (cancelled) return;
			try {
				const avail = await window.electron.ipcRenderer.invoke(
					IpcEvents.GetViewerConnectionAvailability,
				);
				if (!cancelled) setIsViewerSlotAvailable(Boolean(avail));
			} catch {
				// ignore
			}
		}, 2000);

		return () => {
			cancelled = true;
			clearInterval(syncInterval);
			window.electron.ipcRenderer.removeListener(
				IpcEvents.ViewerConnectionAvailabilityChanged,
				handleAvailabilityChange,
			);
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		const fetchRoomId = async (): Promise<void> => {
			const roomId = await window.electron.ipcRenderer.invoke(
				IpcEvents.GetWaitingForConnectionSharingSessionRoomId,
			);
			if (cancelled) return;
			if (
				typeof roomId === 'string' &&
				roomId !== '' &&
				isViewerSlotAvailable
			) {
				setRoomID(roomId);
			} else {
				setRoomID('');
			}
		};

		const fetchLocalIp = async (): Promise<void> => {
			const gotIP =
				await window.electron.ipcRenderer.invoke('get-local-lan-ip');
			if (!cancelled && gotIP) {
				setLocalLanIP(gotIP);
			}
		};

		void fetchRoomId();
		void fetchLocalIp();
		const roomInterval = setInterval(() => {
			void fetchRoomId();
		}, 1000);
		const ipInterval = setInterval(() => {
			void fetchLocalIp();
		}, 1000);

		return () => {
			cancelled = true;
			clearInterval(roomInterval);
			clearInterval(ipInterval);
		};
	}, [isViewerSlotAvailable]);

	const portString = useMemo(() => {
		return `:${clientViewerPort}`;
	}, [clientViewerPort]);
	const roomPath = useMemo(() => {
		return roomID !== '' ? `/${roomID}` : '';
	}, [roomID]);
	const shareUrl = useMemo(() => {
		if (!isViewerSlotAvailable) return '';
		if (LOCAL_LAN_IP === '') return '';
		if (roomPath === '') return '';
		const themeQuery = isDarkMode ? '?theme=dark' : '?theme=light';
		return `http://${LOCAL_LAN_IP}${portString}${roomPath}${themeQuery}`;
	}, [LOCAL_LAN_IP, portString, roomPath, isViewerSlotAvailable, isDarkMode]);
	const isConnectionAvailable = shareUrl !== '';
	const connectionLimitTooltip = t('connection-limit-reached-tooltip');
	const copyTooltipContent = isConnectionAvailable
		? t('click-to-copy')
		: connectionLimitTooltip;

	return (
		<>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					marginBottom: '16px',
				}}
			>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						marginBottom: '12px',
					}}
				>
					<Icon icon="feed" size={28} className={Classes.TEXT_MUTED} />
					<Text className={Classes.TEXT_MUTED} style={{ fontSize: '14px' }}>
						{isConnectionAvailable
							? t(
									'enter-the-following-address-in-browser-address-bar-on-any-device',
									'Escanea el código QR o abre la siguiente dirección en tu navegador:',
								)
							: t('one-viewing-client-is-connected-already')}
					</Text>
				</div>

				{isConnectionAvailable && (
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							padding: '12px',
							background: '#ffffff',
							borderRadius: '12px',
							boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
							marginBottom: '16px',
						}}
					>
						<QRCodeSVG
							value={shareUrl}
							size={170}
							level="M"
							bgColor="#ffffff"
							fgColor="#000000"
						/>
					</div>
				)}

				<Tooltip content={copyTooltipContent} position={Position.TOP}>
					<span>
						<Button
							intent={isConnectionAvailable ? 'primary' : 'none'}
							icon="duplicate"
							style={{ borderRadius: '100px' }}
							disabled={!isConnectionAvailable}
							onClick={() => {
								if (!isConnectionAvailable) return;
								void window.electron.ipcRenderer.invoke(
									IpcEvents.WriteTextToClipboard,
									shareUrl,
								);
							}}
						>
							{isConnectionAvailable
								? shareUrl
								: t('viewing-client-connected-label')}
						</Button>
					</span>
				</Tooltip>

				{isConnectionAvailable && (
					<div style={{ marginTop: '8px', textAlign: 'center' }}>
						<Text className={Classes.TEXT_MUTED} style={{ fontSize: '12px' }}>
							{`o escribe en tu navegador: http://${hostname}.local${portString}${roomPath}${isDarkMode ? '?theme=dark' : '?theme=light'}`}
						</Text>
					</div>
				)}
			</div>

			{usbDevice && isConnectionAvailable && (
				<Row
					center="xs"
					style={{
						marginTop: '12px',
						marginBottom: '6px',
						display: 'flex',
						justifyContent: 'center',
					}}
				>
					<Col xs={11}>
						{(() => {
							const isAdbWifi = Boolean(
								usbDevice.id.includes(':') ||
									usbDevice.id.includes('._tcp') ||
									usbDevice.id.includes('adb-') ||
									/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(usbDevice.id),
							);
							return (
								<Callout
									intent="success"
									icon={isAdbWifi ? 'ip-address' : 'flash'}
									title={
										isAdbWifi
											? `Dispositivo ADB Inalámbrico Detectado: ${usbDevice.model || usbDevice.id}`
											: `Dispositivo USB Detectado: ${usbDevice.model || usbDevice.id}`
									}
									style={{ textAlign: 'left', borderRadius: '8px' }}
								>
									<Row between="xs" middle="xs">
										<Col xs={12} md={8}>
											<Text style={{ fontSize: '12px' }}>
												{isAdbWifi
													? 'Depuración inalámbrica activa. Apertura automática directa en la red Wi-Fi.'
													: 'Canal USB directo activo (Reverse ADB a 60 FPS sin lag de Wi-Fi).'}
											</Text>
										</Col>
										<Col xs={12} md={4} style={{ textAlign: 'right' }}>
											<Button
												intent="success"
												icon="mobile-phone"
												small
												onClick={async () => {
													const hostIp = isAdbWifi
														? LOCAL_LAN_IP || '127.0.0.1'
														: 'localhost';
													const transportParam = isAdbWifi ? 'wifi' : 'usb';
													const targetUrl = `http://${hostIp}:${clientViewerPort}${roomPath}?transport=${transportParam}&theme=${isDarkMode ? 'dark' : 'light'}`;
													await window.electron.ipcRenderer.invoke(
														IpcEvents.AdbLaunchUrl,
														{
															deviceId: usbDevice.id,
															url: targetUrl,
														},
													);
												}}
											>
												{isAdbWifi ? 'Abrir por Wi-Fi' : 'Abrir en el móvil'}
											</Button>
										</Col>
									</Row>
								</Callout>
							);
						})()}
					</Col>
				</Row>
			)}

			{!usbDevice && isAdbAvailable === true && isConnectionAvailable && (
				<Row
					center="xs"
					style={{
						marginTop: '8px',
						display: 'flex',
						justifyContent: 'center',
					}}
				>
					<Button
						minimal
						small
						icon="refresh"
						text="¿Móvil conectado por USB? Detectar dispositivo"
						onClick={async () => {
							try {
								const devices = (await window.electron.ipcRenderer.invoke(
									IpcEvents.AdbGetConnectedDevices,
								)) as Array<{ id: string; model?: string; type?: string }>;
								if (devices && devices.length > 0) {
									const readyDev =
										devices.find((d) => d.type === 'device') || devices[0];
									setUsbDevice(readyDev);
									const port = Number(clientViewerPort);
									if (port && port >= 1024 && readyDev.type === 'device') {
										void window.electron.ipcRenderer.invoke(
											IpcEvents.AdbSetupReverse,
											{
												deviceId: readyDev.id,
												port,
											},
										);
									}
								}
							} catch (err) {
								console.error('Error detecting USB devices:', err);
							}
						}}
					/>
				</Row>
			)}

			{!usbDevice && isAdbAvailable === false && isConnectionAvailable && (
				<Row
					center="xs"
					style={{
						marginTop: '8px',
						display: 'flex',
						justifyContent: 'center',
					}}
				>
					<Button
						minimal
						small
						icon="download"
						text="¿Conectar por cable USB? Descargar Platform-Tools internamente"
						onClick={async () => {
							try {
								await window.electron.ipcRenderer.invoke(
									IpcEvents.AdbDownloadBinaries,
								);
								const res = await window.electron.ipcRenderer.invoke(
									IpcEvents.AdbCheckAvailability,
								);
								setIsAdbAvailable(Boolean(res?.available));
							} catch (dlErr) {
								console.error('Error downloading ADB binaries:', dlErr);
							}
						}}
					/>
				</Row>
			)}

			{!isConnectionAvailable && (
				<Row
					style={{
						marginTop: '12px',
						marginBottom: '10px',
						display: 'flex',
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'center',
						textAlign: 'center',
					}}
				>
					<Text className={Classes.TEXT_MUTED}>
						{t(
							'connection-limit-reached',
							'Límite de 5 conexiones simultáneas alcanzado.',
						)}
					</Text>
				</Row>
			)}
		</>
	);
};

export default ScanQRStep;
