import {
	Button,
	Callout,
	Classes,
	Dialog,
	Icon,
	Intent,
	Spinner,
	Tag,
	Text,
} from '@blueprintjs/core';
import React, { useCallback, useEffect, useState } from 'react';
import { IpcEvents } from '../../../../common/IpcEvents.enum';
import type { DiscoveredDevice } from './useNetworkAnalyzer';

export interface DeviceNavigationModalProps {
	isOpen: boolean;
	onClose: () => void;
	device: DiscoveredDevice | null;
	directUrl: string;
	isDispatching: boolean;
	status: 'idle' | 'dispatching' | 'success' | 'error';
	adbConnected?: boolean;
	adbLaunched?: boolean;
	adbStatus?: 'launched' | 'connected' | 'failed' | 'not_applicable';
	adbPort?: number;
	error?: string;
}

export const DeviceNavigationModal: React.FC<DeviceNavigationModalProps> = ({
	isOpen,
	onClose,
	device,
	directUrl,
	isDispatching,
	status,
	adbLaunched,
	adbStatus,
	adbPort,
	error,
}) => {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		let timeoutId: NodeJS.Timeout;
		if (copied) {
			timeoutId = setTimeout(() => {
				setCopied(false);
			}, 2500);
		}
		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [copied]);

	const handleCopyUrl = useCallback(async (): Promise<void> => {
		if (!directUrl) return;

		try {
			if (
				typeof window !== 'undefined' &&
				window.electron?.ipcRenderer?.invoke
			) {
				await window.electron.ipcRenderer.invoke(
					IpcEvents.WriteTextToClipboard,
					directUrl,
				);
			} else if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(directUrl);
			}
			setCopied(true);
		} catch (err) {
			console.error('Failed to copy direct navigation URL to clipboard', err);
		}
	}, [directUrl]);

	if (!device) {
		return null;
	}

	const isAndroid = device.platform === 'android';
	const effectiveAdbLaunched = adbLaunched || adbStatus === 'launched';
	const effectiveAdbPort = adbPort || device.adbPort || 5555;

	return (
		<Dialog
			isOpen={isOpen}
			onClose={onClose}
			title={`Enviar Navegación: ${device.name || device.ip}`}
			icon="share"
			canOutsideClickClose={true}
			canEscapeKeyClose={true}
			style={{
				width: '92%',
				maxWidth: '560px',
				borderRadius: '12px',
				backgroundColor: 'var(--color-bg-card, #ffffff)',
			}}
		>
			<div className={Classes.DIALOG_BODY} style={{ padding: '16px 20px' }}>
				{/* Device summary bar */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						flexWrap: 'wrap',
						gap: '8px',
						padding: '10px 14px',
						backgroundColor:
							'var(--color-bg-contrast-subtle, rgba(0,0,0,0.03))',
						borderRadius: '8px',
						border: '1px solid var(--color-border-muted, #d3dbe2)',
						marginBottom: '16px',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<Icon icon={isAndroid ? 'mobile-phone' : 'globe-network'} />
						<span style={{ fontWeight: 600 }}>{device.name}</span>
						{device.model && (
							<Text className={Classes.TEXT_MUTED} style={{ fontSize: '12px' }}>
								({device.model})
							</Text>
						)}
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
						<Tag
							minimal
							round
							style={{
								backgroundColor: 'var(--color-badge-ip-bg, #0d3824)',
								color: 'var(--color-badge-ip-text, #00f992)',
								fontFamily: 'monospace',
								fontWeight: 600,
							}}
						>
							{device.ip}
						</Tag>
						<Tag round minimal intent={Intent.PRIMARY}>
							{device.platform.toUpperCase()}
						</Tag>
					</div>
				</div>

				{/* Real-time Dispatch and ADB Status Feedback */}
				{isDispatching || status === 'dispatching' ? (
					<Callout
						intent={Intent.PRIMARY}
						icon="cloud-upload"
						title="Despachando sesión a dispositivo..."
						style={{ marginBottom: '16px' }}
					>
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '10px',
								marginTop: '6px',
							}}
						>
							<Spinner size={18} intent={Intent.PRIMARY} />
							<Text>
								Conectando y enviando URL de navegación en tiempo real...
							</Text>
						</div>
					</Callout>
				) : isAndroid ? (
					effectiveAdbLaunched ? (
						<Callout
							intent={Intent.SUCCESS}
							icon="tick-circle"
							title="Lanzamiento automático por ADB Wi-Fi completado"
							style={{ marginBottom: '16px' }}
						>
							El navegador se ha iniciado en el dispositivo Android mediante ADB
							inalámbrico en el puerto {effectiveAdbPort}.
						</Callout>
					) : adbStatus === 'connected' ? (
						<Callout
							intent={Intent.WARNING}
							icon="warning-sign"
							title="Conexión ADB Wi-Fi establecida (Intent pendiente)"
							style={{ marginBottom: '16px' }}
						>
							Conectado al puerto {effectiveAdbPort}, pero la apertura
							automática no pudo completarse. Abre el enlace directo manualmente
							en el navegador del dispositivo.
						</Callout>
					) : (
						<Callout
							intent={Intent.PRIMARY}
							icon="info-sign"
							title="Enlace directo generado"
							style={{ marginBottom: '16px' }}
						>
							{error
								? `ADB Wi-Fi no disponible (${error}). `
								: 'ADB inalámbrico no conectado. '}
							Copia el enlace a continuación y ábrelo en el navegador de tu
							celular para iniciar la transmisión.
						</Callout>
					)
				) : (
					<Callout
						intent={Intent.PRIMARY}
						icon="globe"
						title="Enlace directo listo para transmisión"
						style={{ marginBottom: '16px' }}
					>
						Copia el enlace directo y ábrelo en Safari, Chrome u otro navegador
						web en tu dispositivo {device.platform}.
					</Callout>
				)}

				{/* Direct URL Container with 1-Click Copy */}
				<div style={{ marginTop: '8px' }}>
					<label
						htmlFor="direct-navigation-url-field"
						style={{
							display: 'block',
							fontSize: '12px',
							fontWeight: 600,
							color: 'var(--color-text-muted, #5c7080)',
							marginBottom: '6px',
						}}
					>
						Enlace Directo del Visor:
					</label>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							backgroundColor: 'var(--color-bg-code, rgba(0, 0, 0, 0.05))',
							border: '1px solid var(--color-border-muted, #d3dbe2)',
							borderRadius: '8px',
							padding: '8px 12px',
						}}
					>
						<span
							id="direct-navigation-url-field"
							style={{
								flex: 1,
								fontFamily: 'monospace',
								fontSize: '13px',
								overflowWrap: 'anywhere',
								wordBreak: 'break-all',
								userSelect: 'all',
								color: 'var(--color-text-primary, inherit)',
							}}
						>
							{directUrl || 'Generando enlace...'}
						</span>
						<Button
							minimal
							icon={copied ? 'tick' : 'clipboard'}
							intent={copied ? Intent.SUCCESS : Intent.PRIMARY}
							onClick={handleCopyUrl}
							text={copied ? 'Copiado' : 'Copiar'}
							disabled={!directUrl}
							style={{ flexShrink: 0, fontWeight: 600 }}
						/>
					</div>
				</div>
			</div>

			<div className={Classes.DIALOG_FOOTER}>
				<div className={Classes.DIALOG_FOOTER_ACTIONS}>
					<Button
						intent={copied ? Intent.SUCCESS : Intent.PRIMARY}
						icon={copied ? 'tick' : 'duplicate'}
						onClick={handleCopyUrl}
						disabled={!directUrl}
						style={{ borderRadius: '6px', fontWeight: 600 }}
					>
						{copied ? '¡URL Copiada!' : 'Copiar Enlace'}
					</Button>
					<Button onClick={onClose} style={{ borderRadius: '6px' }}>
						Cerrar
					</Button>
				</div>
			</div>
		</Dialog>
	);
};

export default DeviceNavigationModal;
