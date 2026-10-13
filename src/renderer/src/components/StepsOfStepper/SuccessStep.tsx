import {
	Button,
	Card,
	Classes,
	H5,
	Icon,
	Intent,
	Tag,
	Text,
} from '@blueprintjs/core';
import React, { useCallback, useEffect, useState } from 'react';
import { Col, Row } from 'react-flexbox-grid';
import { useTranslation } from 'react-i18next';
import { Device } from '../../../../common/Device';
import { IpcEvents } from '../../../../common/IpcEvents.enum';

interface SuccessStepProps {
	handleReset: () => void;
}

const SuccessStep: React.FC<SuccessStepProps> = (props: SuccessStepProps) => {
	const { t } = useTranslation();
	const [connectedDevices, setConnectedDevices] = useState<Device[]>([]);

	const fetchDevices = useCallback(async () => {
		try {
			const devices = (await window.electron.ipcRenderer.invoke(
				IpcEvents.GetConnectedDevices,
			)) as Device[];
			if (Array.isArray(devices)) {
				setConnectedDevices(devices);
			}
		} catch (err) {
			console.error('Failed to fetch connected devices in SuccessStep:', err);
		}
	}, []);

	useEffect(() => {
		void fetchDevices();

		const handleUpdate = () => {
			void fetchDevices();
		};

		window.electron.ipcRenderer.on(
			IpcEvents.ViewerConnectionAvailabilityChanged,
			handleUpdate,
		);
		window.electron.ipcRenderer.on(
			IpcEvents.SetPendingConnectionDevice,
			handleUpdate,
		);

		const interval = setInterval(fetchDevices, 2000);

		document
			.querySelector('#top-panel-connected-devices-list-button')
			?.classList.remove('pulse-not-infinite');

		document
			.querySelector('#top-panel-connected-devices-list-button')
			?.classList.add('pulse-not-infinite');

		const pulseTimeout = setTimeout(() => {
			document
				.querySelector('#top-panel-connected-devices-list-button')
				?.classList.remove('pulse-not-infinite');
		}, 4000);

		return () => {
			clearInterval(interval);
			clearTimeout(pulseTimeout);
			window.electron.ipcRenderer.removeListener(
				IpcEvents.ViewerConnectionAvailabilityChanged,
				handleUpdate,
			);
			window.electron.ipcRenderer.removeListener(
				IpcEvents.SetPendingConnectionDevice,
				handleUpdate,
			);
		};
	}, [fetchDevices]);

	const handleDisconnectDevice = useCallback(
		async (device: Device) => {
			if (device.sharingSessionID) {
				await window.electron.ipcRenderer.invoke(
					IpcEvents.DisconnectPeerAndDestroySharingSessionBySessionID,
					device.sharingSessionID,
				);
			}
			await window.electron.ipcRenderer.invoke(
				IpcEvents.DisconnectDeviceById,
				device.id,
			);
			void fetchDevices();
		},
		[fetchDevices],
	);

	const handleTextConnectedListMouseEnter = useCallback(() => {
		document
			.querySelector('#top-panel-connected-devices-list-button')
			?.classList.add('pulsing');
	}, []);

	const handleTextConnectedListMouseLeave = useCallback(() => {
		document
			.querySelector('#top-panel-connected-devices-list-button')
			?.classList.remove('pulsing');
	}, []);

	return (
		<Col
			xs={10}
			md={8}
			style={{
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				alignItems: 'center',
			}}
		>
			<Row center="xs" style={{ width: '100%' }}>
				<Col xs={12}>
					<Icon icon="endorsed" size={35} intent={Intent.SUCCESS} />
					<H5 style={{ marginTop: '8px' }}>Done!</H5>
				</Col>
			</Row>
			<Row center="xs" style={{ width: '100%' }}>
				<Col xs={12} md={10}>
					<div style={{ marginBottom: '14px' }}>
						<Text>
							Now you can see your screen on connected devices (
							{connectedDevices.length}/5)
						</Text>
					</div>

					{connectedDevices.length > 0 && (
						<div style={{ marginBottom: '16px', width: '100%' }}>
							{connectedDevices.map((dev) => {
								const isUsb =
									dev.transportType === 'usb' ||
									dev.deviceIP.includes('127.0.0.1') ||
									dev.deviceIP.includes('localhost') ||
									dev.deviceIP === '::1';
								return (
									<Card
										key={dev.id}
										elevation={1}
										style={{
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											padding: '10px 16px',
											marginBottom: '8px',
											borderRadius: '8px',
											textAlign: 'left',
										}}
									>
										<div
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: '12px',
											}}
										>
											<Icon
												icon={isUsb ? 'flash' : 'mobile-phone'}
												size={22}
												intent={isUsb ? Intent.SUCCESS : Intent.PRIMARY}
											/>
											<div>
												<Text style={{ fontWeight: 600, fontSize: '13px' }}>
													{dev.deviceBrowser || dev.deviceOS || 'Dispositivo'}
												</Text>
												<div
													style={{
														display: 'flex',
														gap: '6px',
														alignItems: 'center',
														marginTop: '2px',
													}}
												>
													<Tag
														minimal
														intent={isUsb ? Intent.SUCCESS : Intent.PRIMARY}
														style={{ fontSize: '10px' }}
													>
														{isUsb ? 'USB (ADB)' : 'Wi-Fi'}
													</Tag>
													<Text
														className={Classes.TEXT_MUTED}
														style={{ fontSize: '11px' }}
													>
														{dev.deviceOS ? `${dev.deviceOS} • ` : ''}
														{dev.deviceIP || ''}
													</Text>
												</div>
											</div>
										</div>
										<Button
											minimal
											intent={Intent.DANGER}
											icon="cross"
											small
											title={t('disconnect')}
											onClick={() => handleDisconnectDevice(dev)}
										/>
									</Card>
								);
							})}
						</div>
					)}

					<div
						id="connected-devices-list-text-success"
						onMouseEnter={handleTextConnectedListMouseEnter}
						onMouseLeave={handleTextConnectedListMouseLeave}
						style={{
							marginBottom: '20px',
							textDecoration: 'underline dotted',
							cursor: 'pointer',
						}}
					>
						<Text className={Classes.TEXT_MUTED} style={{ fontSize: '12px' }}>
							{t(
								'you-can-manage-connected-devices-by-clicking-connected-devices-button-in-top-panel',
							)}
						</Text>
					</div>
				</Col>
			</Row>
			<Button
				intent="primary"
				onClick={props.handleReset}
				icon="plus"
				style={{ borderRadius: '100px', padding: '8px 24px' }}
			>
				{t('connect-new-device')}
			</Button>
		</Col>
	);
};

export default SuccessStep;
