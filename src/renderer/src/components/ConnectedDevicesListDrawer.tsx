import { useEffect, useState, useCallback } from 'react';
import {
	Button,
	Text,
	Position,
	Drawer,
	Card,
	Alert,
	H4,
	DrawerSize,
	InputGroup,
} from '@blueprintjs/core';
import { Row, Col } from 'react-flexbox-grid';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import CloseOverlayButton from './CloseOverlayButton';
import DeviceInfoCallout from './DeviceInfoCallout';
import SharingSourcePreviewCard from './SharingSourcePreviewCard';
import ChangeSourceModal from './ChangeSourceModal';
import { Device } from '../../../common/Device';
import { IpcEvents } from '../../../common/IpcEvents.enum';
import isProduction from '../../../common/isProduction';
import { useTranslation } from 'react-i18next';

type DeviceWithDesktopCapturerSourceId = Device & {
	desktopCapturerSourceId: string;
};

interface ConnectedDevicesListDrawerProps {
	isOpen: boolean;
	handleToggle: () => void;
	handleReset: () => void;
}

const useStyles = makeStyles(() =>
	createStyles({
		drawerRoot: { overflowY: 'scroll', overflowX: 'hidden' },
		drawerInnerTopPanel: { padding: '20px 10px 0px 30px' },
		connectedDevicesRoot: { padding: '10px 20px' },
		topHeader: {
			marginRight: '20px',
			fontSize: '20px',
			fontWeight: 900,
		},
		zoomFullWidth: {
			width: '100%',
		},
	}),
);

export default function ConnectedDevicesListDrawer(
	props: ConnectedDevicesListDrawerProps,
) {
	const classes = useStyles();
	const { t } = useTranslation();

	const [isAlertDisconectAllOpen, setIsAlertDisconectAllOpen] = useState(false);
	const [connectedDevices, setConnectedDevices] = useState<
		DeviceWithDesktopCapturerSourceId[]
	>([]);
	const [devicesDisplayed, setDevicesDisplayed] = useState(new Map());
	const [trustedList, setTrustedList] = useState<string[]>([]);
	const [selectedDeviceForChangeSource, setSelectedDeviceForChangeSource] =
		useState<DeviceWithDesktopCapturerSourceId | null>(null);
	const [aliases, setAliases] = useState<Record<string, string>>({});

	const refreshAliases = useCallback(async () => {
		try {
			const res = await window.electron.ipcRenderer.invoke(
				IpcEvents.GetDeviceAliases,
			);
			if (res && typeof res === 'object') {
				setAliases(res);
			}
		} catch (e) {
			console.error(e);
		}
	}, []);

	const handleSaveAlias = useCallback(
		async (fingerprint: string, alias: string) => {
			await window.electron.ipcRenderer.invoke(IpcEvents.SetDeviceAlias, {
				fingerprint,
				alias,
			});
			void refreshAliases();
		},
		[refreshAliases],
	);

	const refreshTrustedList = useCallback(async () => {
		try {
			const list = await window.electron.ipcRenderer.invoke(
				IpcEvents.GetTrustedDevices,
			);
			if (Array.isArray(list)) {
				setTrustedList(list);
			}
		} catch (e) {
			console.error(e);
		}
	}, []);

	useEffect(() => {
		if (props.isOpen) {
			void refreshTrustedList();
			void refreshAliases();
		}
	}, [props.isOpen, refreshTrustedList, refreshAliases]);

	const handleToggleTrust = useCallback(
		async (device: Device) => {
			const fingerprint = `${device.deviceIP || ''}_${device.deviceOS || ''}_${device.deviceBrowser || ''}`;
			if (trustedList.includes(fingerprint)) {
				await window.electron.ipcRenderer.invoke(
					IpcEvents.RemoveTrustedDevice,
					fingerprint,
				);
			} else {
				await window.electron.ipcRenderer.invoke(
					IpcEvents.AddTrustedDevice,
					fingerprint,
				);
			}
			await refreshTrustedList();
		},
		[trustedList, refreshTrustedList],
	);

	useEffect(() => {
		function getConnectedDevicesCallback() {
			window.electron.ipcRenderer
				.invoke(IpcEvents.GetConnectedDevices)
				.then(async (devices: Device[]) => {
					const devicesWithSourceIds: DeviceWithDesktopCapturerSourceId[] = [];

					for await (const device of devices) {
						const sharingSourceId = await window.electron.ipcRenderer.invoke(
							IpcEvents.GetDesktopCapturerSourceIdBySharingSessionId,
							device.sharingSessionID,
						);
						devicesWithSourceIds.push({
							...device,
							desktopCapturerSourceId: sharingSourceId,
						});
					}
					setConnectedDevices(devicesWithSourceIds);

					const map = new Map();
					devicesWithSourceIds.forEach((el) => {
						map.set(el.id, true);
					});
					setDevicesDisplayed(map);
				})

				.catch((e) => console.error(e));
		}

		getConnectedDevicesCallback();

		const connectedDevicesInterval = setInterval(
			getConnectedDevicesCallback,
			4000,
		);

		return () => {
			clearInterval(connectedDevicesInterval);
		};
	}, []);

	const handleDisconnectOneDevice = useCallback(
		async (id: string) => {
			const device = connectedDevices.find((d: Device) => d.id === id);
			if (!device) return;
			await window.electron.ipcRenderer.invoke(
				IpcEvents.DisconnectPeerAndDestroySharingSessionBySessionID,
				device.sharingSessionID,
			);
			await window.electron.ipcRenderer.invoke(
				IpcEvents.DisconnectDeviceById,
				device.id,
			);
			setConnectedDevices(connectedDevices.filter((d: Device) => d.id !== id));
		},
		[connectedDevices, setConnectedDevices],
	);

	const handleDisconnectAll = useCallback(() => {
		connectedDevices.forEach((device: Device) => {
			window.electron.ipcRenderer.invoke(
				IpcEvents.DisconnectPeerAndDestroySharingSessionBySessionID,
				device.sharingSessionID,
			);
		});
		window.electron.ipcRenderer.invoke(IpcEvents.DisconnectAllDevices);
	}, [connectedDevices]);

	const hideOneDeviceInDevicesDisplayed = useCallback(
		(id) => {
			const newDevicesDisplayed = new Map(devicesDisplayed);
			newDevicesDisplayed.set(id, false);
			setDevicesDisplayed(newDevicesDisplayed);
			newDevicesDisplayed.delete(id);
			setDevicesDisplayed(newDevicesDisplayed);
			setConnectedDevices(
				connectedDevices.filter((device) => device.id !== id),
			);
		},
		[
			connectedDevices,
			setConnectedDevices,
			devicesDisplayed,
			setDevicesDisplayed,
		],
	);

	const hideAllDevicesInDevicesDisplayed = useCallback(() => {
		const newDevicesDisplayed = new Map(devicesDisplayed);
		[...newDevicesDisplayed.keys()].forEach((key) => {
			newDevicesDisplayed.set(key, false);
		});
		setDevicesDisplayed(newDevicesDisplayed);
	}, [devicesDisplayed, setDevicesDisplayed]);

	const handleDisconnectAndHideOneDevice = useCallback(
		(id) => {
			hideOneDeviceInDevicesDisplayed(id);
			handleDisconnectOneDevice(id);
		},
		[handleDisconnectOneDevice, hideOneDeviceInDevicesDisplayed],
	);

	const handleDisconnectAndHideAllDevices = useCallback(() => {
		hideAllDevicesInDevicesDisplayed();
		setTimeout(
			() => {
				handleDisconnectAll();
				props.handleToggle();
				props.handleReset();
			},
			isProduction() ? 1000 : 0,
		);
	}, [handleDisconnectAll, hideAllDevicesInDevicesDisplayed, props]);

	const disconnectAllCancelButtonText = t('no-cancel');
	const disconnectAllConfirmButtonText = t('yes-disconnect-all');

	return (
		<>
			<Drawer
				className={classes.drawerRoot}
				position={Position.BOTTOM}
				size={DrawerSize.LARGE}
				isOpen={props.isOpen}
				onClose={props.handleToggle}
				transitionDuration={0}
			>
				<Row between="xs" middle="xs" className={classes.drawerInnerTopPanel}>
					<Col xs={11}>
						<Row middle="xs">
							<div className={classes.topHeader}>
								<Text className="bp3-text-muted">{t('connected-devices')}</Text>
							</div>
							<Button
								intent="danger"
								disabled={connectedDevices.length === 0}
								onClick={() => {
									setIsAlertDisconectAllOpen(true);
								}}
								icon="disable"
								style={{
									borderRadius: '100px',
								}}
							>
								{t('disconnect-all-devices')}
							</Button>
						</Row>
					</Col>
					<Col xs={1}>
						<CloseOverlayButton onClick={props.handleToggle} isDefaultStyles />
					</Col>
				</Row>
				<Row className={classes.connectedDevicesRoot}>
					<Col xs={12}>
						<div className={classes.zoomFullWidth}>
							{connectedDevices.map((device) => {
								const fingerprint = `${device.deviceIP || ''}_${device.deviceOS || ''}_${device.deviceBrowser || ''}`;
								const alias = aliases[fingerprint] || '';
								const isTrusted = trustedList.includes(fingerprint);

								return (
									<div key={device.id} style={{ marginBottom: '16px' }}>
										<Card className="connected-device-card">
											<Row between="xs" middle="xs" style={{ marginBottom: '12px' }}>
												<Col xs={12} md={7}>
													<InputGroup
														leftIcon="tag"
														placeholder="Asignar alias (ej. Mi iPad)"
														defaultValue={alias}
														onBlur={(e) => handleSaveAlias(fingerprint, e.currentTarget.value)}
														onKeyDown={(e) => {
															if (e.key === 'Enter') {
																handleSaveAlias(fingerprint, e.currentTarget.value);
															}
														}}
														round
														small
														style={{ maxWidth: '280px' }}
													/>
												</Col>
												<Col xs={12} md={5}>
													{alias !== '' && (
														<Text className="bp3-text-muted" style={{ fontWeight: 600 }}>
															{`Alias: ${alias}`}
														</Text>
													)}
												</Col>
											</Row>
											<Row middle="xs">
												<Col xs={6}>
													<DeviceInfoCallout
														deviceType={device.deviceType}
														deviceOS={device.deviceOS}
														deviceIP={device.deviceIP}
														deviceBrowser={alias || device.deviceBrowser}
														deviceRoomId={device.deviceRoomId}
													/>
												</Col>
												<Col xs={6}>
													<SharingSourcePreviewCard
														sharingSourceID={device.desktopCapturerSourceId}
													/>
												</Col>
											</Row>
											<Row center="xs" style={{ gap: '12px', marginTop: '14px' }}>
												<Button
													intent="primary"
													icon="exchange"
													onClick={() => setSelectedDeviceForChangeSource(device)}
													style={{ borderRadius: '100px' }}
												>
													Cambiar Fuente
												</Button>
												<Button
													intent={isTrusted ? 'warning' : 'primary'}
													minimal={!isTrusted}
													onClick={() => handleToggleTrust(device)}
													icon={isTrusted ? 'star' : 'star-empty'}
													style={{ borderRadius: '100px' }}
												>
													{isTrusted
														? 'Dispositivo Recordado'
														: 'Recordar Dispositivo'}
												</Button>
												<Button
													id={`disconnect-device-${device.deviceIP}`}
													intent="danger"
													onClick={(): void => {
														handleDisconnectAndHideOneDevice(device.id);
													}}
													icon="disable"
													style={{
														borderRadius: '100px',
													}}
												>
													{t('disconnect')}
												</Button>
											</Row>
										</Card>
									</div>
								);
							})}
						</div>
					</Col>
				</Row>
			</Drawer>
			<ChangeSourceModal
				isOpen={selectedDeviceForChangeSource !== null}
				sharingSessionId={selectedDeviceForChangeSource?.sharingSessionID || ''}
				deviceName={
					selectedDeviceForChangeSource
						? aliases[`${selectedDeviceForChangeSource.deviceIP || ''}_${selectedDeviceForChangeSource.deviceOS || ''}_${selectedDeviceForChangeSource.deviceBrowser || ''}`] ||
							selectedDeviceForChangeSource.deviceBrowser
						: ''
				}
				onClose={() => {
					setSelectedDeviceForChangeSource(null);
				}}
			/>
			<Alert
				isOpen={isAlertDisconectAllOpen}
				onClose={() => {
					setIsAlertDisconectAllOpen(false);
				}}
				icon="warning-sign"
				cancelButtonText={disconnectAllCancelButtonText}
				confirmButtonText={disconnectAllConfirmButtonText}
				intent="danger"
				canEscapeKeyCancel
				canOutsideClickCancel
				onCancel={() => {
					setIsAlertDisconectAllOpen(false);
				}}
				onConfirm={handleDisconnectAndHideAllDevices}
				transitionDuration={0}
			>
				<H4>
					{t(
						'are-you-sure-you-want-to-disconnect-all-connected-viewing-devices',
					)}
				</H4>
				<Text>{t('this-step-can-not-be-undone')}</Text>
				<Text>{t('you-will-have-to-connect-all-devices-manually-again')}</Text>
			</Alert>
		</>
	);
}
