import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, Button, Classes, Icon, Spinner, Tag } from '@blueprintjs/core';
import type PeerConnection from '../../features/PeerConnection';
import { useTheme } from '../../providers/ThemeProvider';
import './index.css';

export interface SourceItem {
	id: string;
	name: string;
	type: 'screen' | 'window';
	appIcon?: string;
}

interface SourceSwitcherModalProps {
	isOpen: boolean;
	onClose: () => void;
	peer?: PeerConnection;
}

export const SourceSwitcherModal: React.FC<SourceSwitcherModalProps> = ({
	isOpen,
	onClose,
	peer,
}) => {
	const { isDarkMode } = useTheme();
	const [sources, setSources] = useState<SourceItem[]>([]);
	const [currentSourceId, setCurrentSourceId] = useState<string>('');
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [switchingToId, setSwitchingToId] = useState<string | null>(null);

	const fetchSources = useCallback(() => {
		if (!peer) return;
		setIsLoading(true);
		try {
			peer.getAvailableSources();
		} catch (err) {
			console.warn('Failed to request available sources:', err);
			setIsLoading(false);
		}
	}, [peer]);

	useEffect(() => {
		if (!isOpen) return;
		fetchSources();

		const handleAvailableSources = (e: Event) => {
			const customEvent = e as CustomEvent<{
				sources?: SourceItem[];
				currentSourceId?: string;
			}>;
			setIsLoading(false);
			if (customEvent.detail) {
				if (Array.isArray(customEvent.detail.sources)) {
					setSources(customEvent.detail.sources);
				}
				if (customEvent.detail.currentSourceId) {
					setCurrentSourceId(customEvent.detail.currentSourceId);
				}
			}
		};

		const handleSourceSwitched = (e: Event) => {
			const customEvent = e as CustomEvent<{ sourceId?: string }>;
			setSwitchingToId(null);
			if (customEvent.detail?.sourceId) {
				setCurrentSourceId(customEvent.detail.sourceId);
			}
			onClose();
		};

		window.addEventListener(
			'deskreen:available-sources',
			handleAvailableSources,
		);
		window.addEventListener('deskreen:source-switched', handleSourceSwitched);

		return () => {
			window.removeEventListener(
				'deskreen:available-sources',
				handleAvailableSources,
			);
			window.removeEventListener(
				'deskreen:source-switched',
				handleSourceSwitched,
			);
		};
	}, [isOpen, fetchSources, onClose]);

	const handleSelectSource = (source: SourceItem) => {
		if (!peer) return;
		setSwitchingToId(source.id);
		peer.switchSource(source.id);
		setTimeout(() => {
			setSwitchingToId(null);
			setCurrentSourceId(source.id);
			onClose();
		}, 800);
	};

	const screenSources = sources.filter((s) => s.type === 'screen');
	const windowSources = sources.filter((s) => s.type === 'window');

	const darkClass = isDarkMode ? `${Classes.DARK} bp3-dark` : '';

	return (
		<Dialog
			isOpen={isOpen}
			onClose={onClose}
			title="Cambiar Vista / Pantalla"
			icon="desktop"
			portalClassName={darkClass}
			className={`source-switcher-dialog ${darkClass}`.trim()}
		>
			<div className={Classes.DIALOG_BODY}>
				<div className="source-switcher-header">
					<span className="source-switcher-subtitle">
						Elige qué pantalla o ventana transmitir a este móvil
					</span>
					<Button
						minimal
						icon="refresh"
						loading={isLoading}
						onClick={fetchSources}
						title="Actualizar lista de ventanas"
					/>
				</div>

				{isLoading && sources.length === 0 ? (
					<div className="source-switcher-loading">
						<Spinner size={32} />
						<span>Cargando pantallas y ventanas del PC...</span>
					</div>
				) : (
					<div className="source-switcher-content">
						{/* Pantallas completas */}
						{screenSources.length > 0 && (
							<div className="source-section">
								<div className="source-section-title">
									<Icon icon="desktop" />
									<span>Pantallas Completas ({screenSources.length})</span>
								</div>
								<div className="source-grid">
									{screenSources.map((src) => {
										const isSelected = currentSourceId === src.id;
										const isSwitching = switchingToId === src.id;
										return (
											<button
												key={src.id}
												type="button"
												className={`source-card ${isSelected ? 'is-selected' : ''} ${isSwitching ? 'is-switching' : ''}`}
												onClick={() => handleSelectSource(src)}
												disabled={isSwitching}
											>
												<div className="source-card-icon">
													<Icon icon="desktop" size={24} />
												</div>
												<div className="source-card-info">
													<span className="source-card-name">{src.name}</span>
													{isSelected && (
														<Tag intent="success" minimal round>
															Activo
														</Tag>
													)}
													{isSwitching && (
														<Tag intent="primary" round>
															Cambiando...
														</Tag>
													)}
												</div>
											</button>
										);
									})}
								</div>
							</div>
						)}

						{/* Ventanas de aplicación */}
						{windowSources.length > 0 && (
							<div className="source-section">
								<div className="source-section-title">
									<Icon icon="application" />
									<span>Ventanas de Aplicación ({windowSources.length})</span>
								</div>
								<div className="source-grid">
									{windowSources.map((src) => {
										const isSelected = currentSourceId === src.id;
										const isSwitching = switchingToId === src.id;
										return (
											<button
												key={src.id}
												type="button"
												className={`source-card ${isSelected ? 'is-selected' : ''} ${isSwitching ? 'is-switching' : ''}`}
												onClick={() => handleSelectSource(src)}
												disabled={isSwitching}
											>
												<div className="source-card-icon">
													{src.appIcon ? (
														<img
															src={src.appIcon}
															alt=""
															className="source-app-icon"
														/>
													) : (
														<Icon icon="application" size={22} />
													)}
												</div>
												<div className="source-card-info">
													<span className="source-card-name" title={src.name}>
														{src.name}
													</span>
													{isSelected && (
														<Tag intent="success" minimal round>
															Activo
														</Tag>
													)}
													{isSwitching && (
														<Tag intent="primary" round>
															Cambiando...
														</Tag>
													)}
												</div>
											</button>
										);
									})}
								</div>
							</div>
						)}

						{screenSources.length === 0 &&
							windowSources.length === 0 &&
							!isLoading && (
								<div className="source-switcher-empty">
									<span>
										No se encontraron pantallas o ventanas disponibles.
									</span>
									<Button
										intent="primary"
										onClick={fetchSources}
										style={{ marginTop: '8px' }}
									>
										Reintentar
									</Button>
								</div>
							)}
					</div>
				)}
			</div>
			<div className={Classes.DIALOG_FOOTER}>
				<div className={Classes.DIALOG_FOOTER_ACTIONS}>
					<Button onClick={onClose}>Cerrar</Button>
				</div>
			</div>
		</Dialog>
	);
};

export default SourceSwitcherModal;
