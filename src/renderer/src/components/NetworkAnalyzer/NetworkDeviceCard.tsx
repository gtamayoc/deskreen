import React, { useMemo } from 'react';
import {
	Button,
	Card,
	Checkbox,
	Elevation,
	H5,
	Intent,
	Tag,
	Text,
	Classes,
} from '@blueprintjs/core';
import type {
	DevicePlatform,
	DeviceStatus,
	DiscoveredDevice,
} from './useNetworkAnalyzer';

export interface NetworkDeviceCardProps {
	device: DiscoveredDevice;
	isSelected: boolean;
	onToggleSelect: (id: string) => void;
	onDispatch: (device: DiscoveredDevice) => Promise<unknown> | void;
	isDispatching?: boolean;
}

export function getPlatformIcon(platform: DevicePlatform): {
	className: string;
	color?: string;
} {
	switch (platform) {
		case 'android':
			return { className: 'fab fa-android', color: '#3ddc84' };
		case 'apple':
			return { className: 'fab fa-apple' };
		case 'windows':
			return { className: 'fab fa-windows', color: '#00adef' };
		case 'linux':
			return { className: 'fab fa-linux', color: '#f5c211' };
		case 'generic':
		default:
			return { className: 'fas fa-laptop' };
	}
}

export function getStatusBadge(status: DeviceStatus): {
	intent: Intent;
	text: string;
} {
	switch (status) {
		case 'online':
			return { intent: Intent.SUCCESS, text: 'En línea' };
		case 'connected':
			return { intent: Intent.SUCCESS, text: 'Conectado' };
		case 'busy':
			return { intent: Intent.WARNING, text: 'Ocupado' };
		case 'unreachable':
		default:
			return { intent: Intent.DANGER, text: 'No disponible' };
	}
}

export const NetworkDeviceCard: React.FC<NetworkDeviceCardProps> = ({
	device,
	isSelected,
	onToggleSelect,
	onDispatch,
	isDispatching = false,
}) => {
	const platformIcon = useMemo(
		() => getPlatformIcon(device.platform),
		[device.platform],
	);
	const statusBadge = useMemo(
		() => getStatusBadge(device.status),
		[device.status],
	);

	const isActionDisabled =
		isDispatching ||
		device.status === 'unreachable' ||
		device.status === 'busy';

	return (
		<Card
			interactive
			elevation={isSelected ? Elevation.TWO : Elevation.ONE}
			className={`bp3-card network-device-card ${isSelected ? 'selected' : ''}`}
			style={{
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				padding: '16px',
				borderRadius: '12px',
				backgroundColor: 'var(--color-bg-card)',
				color: 'var(--color-text-primary)',
				border: isSelected
					? '2px solid var(--color-accent, #e2791b)'
					: '1px solid var(--color-border-muted, #d3dbe2)',
				boxShadow: isSelected
					? '0 0 0 1px var(--color-accent, #e2791b), 0 4px 12px rgba(0, 0, 0, 0.15)'
					: undefined,
				transition: 'all 0.2s ease-in-out',
				minWidth: '260px',
			}}
		>
			{/* Top Bar: Checkbox & Status Badge */}
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					marginBottom: '12px',
				}}
			>
				<Checkbox
					checked={isSelected}
					onChange={() => onToggleSelect(device.id)}
					style={{ marginBottom: 0 }}
					aria-label={`Seleccionar dispositivo ${device.name || device.ip}`}
				/>
				<Tag
					intent={statusBadge.intent}
					round
					minimal
					style={{
						fontWeight: 600,
						fontSize: '11px',
						letterSpacing: '0.02em',
					}}
				>
					{statusBadge.text}
				</Tag>
			</div>

			{/* Main Device Information */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '14px',
					marginBottom: '14px',
				}}
			>
				<div
					style={{
						width: '44px',
						height: '44px',
						borderRadius: '10px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: 'var(--color-bg-button, #ebf1f5)',
						fontSize: '22px',
						color: platformIcon.color || 'var(--color-text-primary)',
						flexShrink: 0,
					}}
				>
					<i className={platformIcon.className} aria-hidden="true" />
				</div>

				<div style={{ flex: 1, minWidth: 0 }}>
					<H5
						className="bp3-heading"
						style={{
							margin: 0,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
							color: 'var(--color-text-primary)',
							fontSize: '15px',
							fontWeight: 600,
						}}
						title={device.name || device.model || device.ip}
					>
						{device.name || device.model || device.ip}
					</H5>

					<div
						style={{
							marginTop: '4px',
							display: 'flex',
							alignItems: 'center',
							gap: '6px',
							flexWrap: 'wrap',
						}}
					>
						<Tag
							minimal={false}
							className="ip-address-badge"
							style={{
								backgroundColor: 'var(--color-badge-ip-bg)',
								color: 'var(--color-badge-ip-text)',
								fontWeight: 700,
								fontFamily: 'monospace',
								fontSize: '11px',
								borderRadius: '6px',
								padding: '2px 6px',
							}}
						>
							{device.ip}
						</Tag>
						{device.model && device.name && device.model !== device.name && (
							<Text
								className={Classes.TEXT_MUTED}
								style={{
									fontSize: '12px',
									color: 'var(--color-text-muted)',
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap',
									maxWidth: '120px',
								}}
							>
								{device.model}
							</Text>
						)}
					</div>
				</div>
			</div>

			{/* Action Footer */}
			<div style={{ marginTop: 'auto', paddingTop: '8px' }}>
				<Button
					intent={Intent.PRIMARY}
					loading={isDispatching}
					disabled={isActionDisabled}
					icon="share"
					onClick={() => onDispatch(device)}
					style={{
						width: '100%',
						borderRadius: '100px',
						fontWeight: 600,
						justifyContent: 'center',
					}}
				>
					{device.status === 'connected' ? 'Conectado' : 'Enviar Navegación'}
				</Button>
			</div>
		</Card>
	);
};

export default NetworkDeviceCard;
