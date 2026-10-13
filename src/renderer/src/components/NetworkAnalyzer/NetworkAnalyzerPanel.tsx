import {
	Button,
	Callout,
	Checkbox,
	Classes,
	H4,
	Icon,
	Intent,
	Spinner,
	Tag,
	Text,
} from '@blueprintjs/core';
import { SettingsContext } from '@renderer/contexts/SettingsContext';
import React, {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { IpcEvents } from '../../../../common/IpcEvents.enum';
import DeviceNavigationModal from './DeviceNavigationModal';
import NetworkDeviceCard from './NetworkDeviceCard';
import { useNetworkAnalyzer } from './useNetworkAnalyzer';
import type { DiscoveredDevice } from './useNetworkAnalyzer';

export interface NetworkAnalyzerPanelProps {
	onDeviceDispatched?: (device: DiscoveredDevice) => void;
	localIp?: string;
	port?: string | number;
	roomId?: string;
}

export const NetworkAnalyzerPanel: React.FC<NetworkAnalyzerPanelProps> = ({
	onDeviceDispatched,
	localIp,
	port,
	roomId,
}) => {
	const { isDarkMode } = useContext(SettingsContext);

	const {
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
	} = useNetworkAnalyzer();

	// Connection details state with optional props and fallback to IPC queries
	const [resolvedLocalIp, setResolvedLocalIp] = useState<string>(localIp || '');
	const [resolvedPort, setResolvedPort] = useState<string>(
		port ? String(port) : '',
	);
	const [resolvedRoomId, setResolvedRoomId] = useState<string>(roomId || '');
	const [copiedBannerUrl, setCopiedBannerUrl] = useState<boolean>(false);

	// Navigation modal state
	const [modalDevice, setModalDevice] = useState<DiscoveredDevice | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [modalDirectUrl, setModalDirectUrl] = useState('');
	const [modalStatus, setModalStatus] = useState<
		'idle' | 'dispatching' | 'success' | 'error'
	>('idle');
	const [modalAdbStatus, setModalAdbStatus] = useState<
		'launched' | 'connected' | 'failed' | 'not_applicable' | undefined
	>(undefined);
	const [modalAdbPort, setModalAdbPort] = useState<number | undefined>(
		undefined,
	);
	const [modalAdbLaunched, setModalAdbLaunched] = useState<boolean | undefined>(
		undefined,
	);
	const [modalError, setModalError] = useState<string | undefined>(undefined);

	useEffect(() => {
		let isMounted = true;
		const fetchConnectionDetails = async (): Promise<void> => {
			try {
				if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
					if (!localIp) {
						const ip =
							await window.electron.ipcRenderer.invoke('get-local-lan-ip');
						if (isMounted && typeof ip === 'string') {
							setResolvedLocalIp(ip);
						}
					}
					if (!port) {
						const p = await window.electron.ipcRenderer.invoke(
							IpcEvents.GetPort,
						);
						if (isMounted && p) {
							setResolvedPort(String(p));
						}
					}
					if (!roomId) {
						const r = await window.electron.ipcRenderer.invoke(
							IpcEvents.GetWaitingForConnectionSharingSessionRoomId,
						);
						if (isMounted && typeof r === 'string') {
							setResolvedRoomId(r);
						}
					}
				}
			} catch (err) {
				console.error('Failed to resolve host connection details', err);
			}
		};

		void fetchConnectionDetails();

		return () => {
			isMounted = false;
		};
	}, [localIp, port, roomId]);

	useEffect(() => {
		let timer: NodeJS.Timeout;
		if (copiedBannerUrl) {
			timer = setTimeout(() => {
				setCopiedBannerUrl(false);
			}, 2500);
		}
		return () => {
			if (timer) clearTimeout(timer);
		};
	}, [copiedBannerUrl]);

	const effectiveIp = localIp || resolvedLocalIp || '127.0.0.1';
	const effectivePort = port ? String(port) : resolvedPort || '3131';
	const effectiveRoom = roomId || resolvedRoomId || '';
	const themeQuery = isDarkMode ? 'theme=dark' : 'theme=light';

	const sessionUrl = useMemo(() => {
		const roomSegment = effectiveRoom ? `/${effectiveRoom}` : '';
		return `http://${effectiveIp}:${effectivePort}${roomSegment}?${themeQuery}`;
	}, [effectiveIp, effectivePort, effectiveRoom, themeQuery]);

	const handleCopyBannerUrl = useCallback(async (): Promise<void> => {
		try {
			if (
				typeof window !== 'undefined' &&
				window.electron?.ipcRenderer?.invoke
			) {
				await window.electron.ipcRenderer.invoke(
					IpcEvents.WriteTextToClipboard,
					sessionUrl,
				);
			} else if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(sessionUrl);
			}
			setCopiedBannerUrl(true);
		} catch (err) {
			console.error('Failed to copy session URL to clipboard', err);
		}
	}, [sessionUrl]);

	const totalCount = devices.length;
	const selectedCount = selectedDeviceIds.size;

	const allSelected = totalCount > 0 && selectedCount === totalCount;
	const isIndeterminate = selectedCount > 0 && selectedCount < totalCount;

	const handleToggleSelectAll = (): void => {
		if (allSelected) {
			selectAll(false);
		} else {
			selectAll(true);
		}
	};

	const handleSingleDispatch = async (
		device: DiscoveredDevice,
	): Promise<void> => {
		setModalDevice(device);
		setIsModalOpen(true);
		setModalStatus('dispatching');
		setModalError(undefined);
		setModalAdbStatus(undefined);
		setModalAdbPort(device.adbPort);
		setModalAdbLaunched(false);

		// Instant fallback direct URL for immediate modal feedback
		const transportParam =
			device.platform === 'android' ? '&transport=wifi' : '';
		const roomSegment = effectiveRoom ? `/${effectiveRoom}` : '';
		const immediateUrl = `http://${effectiveIp}:${effectivePort}${roomSegment}?${themeQuery}${transportParam}`;
		setModalDirectUrl(immediateUrl);

		const res = await dispatchSingle(device);

		if (res.url) {
			setModalDirectUrl(res.url);
		}
		setModalStatus(res.success ? 'success' : 'error');
		setModalAdbStatus(res.adbStatus);
		setModalAdbPort(res.adbPort || device.adbPort);
		setModalAdbLaunched(res.adbLaunched);
		setModalError(res.error);

		if (res.success && onDeviceDispatched) {
			onDeviceDispatched(device);
		}
	};

	const handleCloseModal = (): void => {
		setIsModalOpen(false);
	};

	const isBatchDispatching = useMemo(() => {
		for (const id of selectedDeviceIds) {
			if (dispatchingDeviceIds.has(id)) {
				return true;
			}
		}
		return false;
	}, [selectedDeviceIds, dispatchingDeviceIds]);

	const handleBatchDispatch = async (): Promise<void> => {
		const results = await dispatchBatch();
		if (onDeviceDispatched) {
			for (const r of results) {
				if (r.success) {
					const dev = devices.find((d) => d.id === r.deviceId);
					if (dev) {
						onDeviceDispatched(dev);
					}
				}
			}
		}
	};

	return (
		<div
			className="network-analyzer-panel"
			style={{
				width: '100%',
				maxWidth: '960px',
				margin: '0 auto',
				padding: '16px',
				boxSizing: 'border-box',
			}}
		>
			{/* Prominent Connection Banner */}
			<div
				className="connection-banner"
				style={{
					backgroundColor: 'var(--color-bg-card, #ffffff)',
					border: '1px solid var(--color-border-muted, #d3dbe2)',
					borderRadius: '12px',
					padding: '16px 20px',
					marginBottom: '20px',
					boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
					display: 'flex',
					flexDirection: 'column',
					gap: '12px',
				}}
			>
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						flexWrap: 'wrap',
						gap: '10px',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<Icon icon="feed" intent={Intent.PRIMARY} size={18} />
						<span
							style={{
								fontWeight: 700,
								fontSize: '15px',
								color: 'var(--color-text-primary)',
							}}
						>
							Dirección de Conexión del Host
						</span>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<Tag
							minimal
							round
							style={{
								backgroundColor: 'var(--color-badge-ip-bg, #0d3824)',
								color: 'var(--color-badge-ip-text, #00f992)',
								fontFamily: 'monospace',
								fontWeight: 600,
								fontSize: '12px',
							}}
						>
							IP: {effectiveIp}
						</Tag>
						<Tag
							minimal
							round
							intent={Intent.NONE}
							style={{ fontFamily: 'monospace', fontWeight: 600 }}
						>
							Puerto: {effectivePort}
						</Tag>
					</div>
				</div>

				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: '12px',
						backgroundColor:
							'var(--color-bg-contrast-subtle, rgba(0, 0, 0, 0.03))',
						border: '1px solid var(--color-border-muted, #d3dbe2)',
						borderRadius: '8px',
						padding: '8px 12px',
						flexWrap: 'wrap',
					}}
				>
					<div style={{ flex: 1, minWidth: '240px' }}>
						<span
							style={{
								fontFamily: 'monospace',
								fontSize: '13px',
								fontWeight: 600,
								color: 'var(--color-text-primary)',
								overflowWrap: 'anywhere',
								wordBreak: 'break-all',
								userSelect: 'all',
							}}
						>
							{sessionUrl}
						</span>
					</div>
					<Button
						intent={copiedBannerUrl ? Intent.SUCCESS : Intent.PRIMARY}
						icon={copiedBannerUrl ? 'tick' : 'clipboard'}
						onClick={handleCopyBannerUrl}
						style={{ borderRadius: '100px', fontWeight: 600, flexShrink: 0 }}
					>
						{copiedBannerUrl ? '¡URL Copiada!' : 'Copiar URL completa'}
					</Button>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
					<Icon icon="info-sign" size={14} className={Classes.TEXT_MUTED} />
					<Text
						className={Classes.TEXT_MUTED}
						style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}
					>
						También disponible vía mDNS:{' '}
						<span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
							deskreen.local:{effectivePort}
						</span>{' '}
						en dispositivos de la misma red Wi-Fi (iOS/macOS).
					</Text>
				</div>
			</div>

			{/* Header Toolbar */}
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					flexWrap: 'wrap',
					gap: '12px',
					marginBottom: '16px',
					borderBottom: '1px solid var(--color-border-muted, #d3dbe2)',
					paddingBottom: '12px',
				}}
			>
				<div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
						<H4
							className="bp3-heading"
							style={{
								margin: 0,
								color: 'var(--color-text-primary)',
								fontWeight: 700,
							}}
						>
							Analizador de Red Wi-Fi
						</H4>
						{isScanning && (
							<Spinner
								size={16}
								intent={Intent.PRIMARY}
								aria-label="Escaneando"
							/>
						)}
					</div>
					<Text
						className={Classes.TEXT_MUTED}
						style={{
							fontSize: '13px',
							color: 'var(--color-text-muted)',
							marginTop: '2px',
						}}
					>
						Dispositivos detectados en tiempo real
					</Text>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<Button
						icon="refresh"
						loading={isScanning}
						onClick={rescan}
						intent={Intent.NONE}
						style={{ borderRadius: '100px' }}
					>
						Escanear ahora
					</Button>
				</div>
			</div>

			{/* Multi-Selection Action Bar */}
			{totalCount > 0 && (
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						flexWrap: 'wrap',
						gap: '12px',
						backgroundColor: 'var(--color-bg-card)',
						padding: '10px 16px',
						borderRadius: '8px',
						border: '1px solid var(--color-border-muted, #d3dbe2)',
						marginBottom: '16px',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
						<Checkbox
							checked={allSelected}
							indeterminate={isIndeterminate}
							onChange={handleToggleSelectAll}
							label="Seleccionar todos"
							style={{ marginBottom: 0, fontWeight: 500 }}
						/>
						<Tag
							round
							intent={selectedCount > 0 ? Intent.PRIMARY : Intent.NONE}
							style={{ fontWeight: 600 }}
						>
							{selectedCount} seleccionados
						</Tag>
					</div>

					<Button
						intent={Intent.SUCCESS}
						icon="multi-select"
						loading={isBatchDispatching}
						disabled={selectedCount === 0 || isBatchDispatching}
						onClick={handleBatchDispatch}
						style={{ borderRadius: '100px', fontWeight: 600 }}
					>
						{`Enviar Navegación a Seleccionados (${selectedCount})`}
					</Button>
				</div>
			)}

			{/* Error Banner if any */}
			{error && (
				<Callout
					intent={Intent.WARNING}
					icon="warning-sign"
					title="Aviso de escaneo de red"
					style={{ marginBottom: '16px' }}
				>
					{error}
				</Callout>
			)}

			{/* Responsive CSS Grid of Devices */}
			{totalCount > 0 ? (
				<div
					className="network-devices-grid"
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
						gap: '16px',
						width: '100%',
					}}
				>
					{devices.map((device) => (
						<NetworkDeviceCard
							key={device.id}
							device={device}
							isSelected={selectedDeviceIds.has(device.id)}
							onToggleSelect={toggleSelectDevice}
							onDispatch={handleSingleDispatch}
							isDispatching={dispatchingDeviceIds.has(device.id)}
						/>
					))}
				</div>
			) : (
				/* Empty State Callout */
				<Callout
					intent={Intent.PRIMARY}
					icon="search"
					title="Buscando dispositivos en la red local..."
					style={{
						width: '100%',
						maxWidth: '560px',
						margin: '24px auto',
						textAlign: 'center',
						backgroundColor: 'var(--color-bg-card)',
						color: 'var(--color-text-primary)',
						borderRadius: '12px',
						border: '1px solid var(--color-border-muted, #d3dbe2)',
						padding: '24px',
					}}
				>
					<p
						style={{
							color: 'var(--color-text-muted)',
							marginTop: '8px',
							lineHeight: '1.5',
							fontSize: '13px',
						}}
					>
						Asegúrate de que tus dispositivos móviles o computadoras estén
						conectados a la misma red Wi-Fi y que el router permita el tráfico
						multicast (mDNS/DNS-SD).
					</p>
					<div
						style={{
							marginTop: '16px',
							display: 'flex',
							justifyContent: 'center',
						}}
					>
						<Button
							icon="refresh"
							intent={Intent.PRIMARY}
							loading={isScanning}
							onClick={rescan}
							style={{ borderRadius: '100px', fontWeight: 600 }}
						>
							Escanear ahora
						</Button>
					</div>
				</Callout>
			)}

			{/* Interactive Single-Device Navigation Modal */}
			<DeviceNavigationModal
				isOpen={isModalOpen}
				onClose={handleCloseModal}
				device={modalDevice}
				directUrl={modalDirectUrl}
				isDispatching={modalStatus === 'dispatching'}
				status={modalStatus}
				adbLaunched={modalAdbLaunched}
				adbStatus={modalAdbStatus}
				adbPort={modalAdbPort}
				error={modalError}
			/>
		</div>
	);
};

export default NetworkAnalyzerPanel;
